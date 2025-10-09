/**
 * Alist资源数据模型
 * 管理资源与Alist文件的关联关系
 */

const { query } = require('../config/database');
const { alistClient } = require('../utils/alistClient');
const { logger } = require('../utils/logger');

class AlistResource {
  /**
   * 创建或更新Alist资源关联
   */
  static async upsertAlistResource(resourceId, alistPath, fileInfo = {}) {
    try {
      const result = await query(`
        INSERT INTO alist_resources (
          resource_id, alist_path, alist_name, file_size,
          file_hash, mime_type, is_folder, folder_size,
          file_count, last_sync_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        ON CONFLICT (resource_id, alist_path)
        DO UPDATE SET
          alist_name = EXCLUDED.alist_name,
          file_size = EXCLUDED.file_size,
          file_hash = EXCLUDED.file_hash,
          mime_type = EXCLUDED.mime_type,
          is_folder = EXCLUDED.is_folder,
          folder_size = EXCLUDED.folder_size,
          file_count = EXCLUDED.file_count,
          last_sync_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        resourceId,
        alistPath,
        fileInfo.name || null,
        fileInfo.size || null,
        fileInfo.hash || null,
        fileInfo.type || null,
        fileInfo.is_dir || false,
        fileInfo.folder_size || 0,
        fileInfo.file_count || 0
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('创建/更新Alist资源关联失败:', error);
      throw error;
    }
  }

  /**
   * 根据资源ID获取Alist资源信息
   */
  static async getByResourceId(resourceId) {
    try {
      const result = await query(
        'SELECT * FROM alist_resources WHERE resource_id = $1 ORDER BY created_at DESC',
        [resourceId]
      );

      return result.rows;
    } catch (error) {
      logger.error('获取Alist资源信息失败:', error);
      throw error;
    }
  }

  /**
   * 根据Alist路径获取资源信息
   */
  static async getByAlistPath(alistPath) {
    try {
      const result = await query(
        `SELECT ar.*, r.title, r.description, r.status, r.author_id
         FROM alist_resources ar
         JOIN resources r ON ar.resource_id = r.id
         WHERE ar.alist_path = $1`,
        [alistPath]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('根据路径获取Alist资源失败:', error);
      throw error;
    }
  }

  /**
   * 同步Alist文件信息
   */
  static async syncFileInfo(resourceId, alistPath) {
    try {
      // 从Alist获取最新文件信息
      const fileInfo = await alistClient.getFileInfo(alistPath);

      // 更新数据库记录
      const updated = await this.upsertAlistResource(resourceId, alistPath, {
        name: fileInfo.name,
        size: fileInfo.size,
        type: fileInfo.type,
        is_dir: fileInfo.is_dir,
        hash: fileInfo.sign
      });

      logger.info('Alist文件信息同步成功', {
        resourceId,
        alistPath,
        fileSize: fileInfo.size
      });

      return updated;
    } catch (error) {
      logger.error('同步Alist文件信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取需要同步的资源列表
   */
  static async getNeedSyncResources(hours = 1) {
    try {
      const result = await query(`
        SELECT ar.*, r.title
        FROM alist_resources ar
        JOIN resources r ON ar.resource_id = r.id
        WHERE ar.last_sync_at < CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
        OR ar.last_sync_at IS NULL
        ORDER BY ar.last_sync_at ASC NULLS FIRST
        LIMIT 100
      `);

      return result.rows;
    } catch (error) {
      logger.error('获取需要同步的资源失败:', error);
      throw error;
    }
  }

  /**
   * 删除Alist资源关联
   */
  static async deleteByResourceId(resourceId) {
    try {
      const result = await query(
        'DELETE FROM alist_resources WHERE resource_id = $1 RETURNING *',
        [resourceId]
      );

      return result.rows;
    } catch (error) {
      logger.error('删除Alist资源关联失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID删除Alist资源关联
   * @param {number} id - alist_resources表ID
   * @returns {Promise<Object|null>} 被删除的记录
   */
  static async deleteById(id) {
    try {
      const result = await query(
        'DELETE FROM alist_resources WHERE id = $1 RETURNING *',
        [id]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('根据ID删除Alist资源关联失败:', error);
      throw error;
    }
  }

  /**
   * 删除指定路径的Alist资源关联
   */
  static async deleteByPath(resourceId, alistPath) {
    try {
      const result = await query(
        'DELETE FROM alist_resources WHERE resource_id = $1 AND alist_path = $2 RETURNING *',
        [resourceId, alistPath]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('删除指定路径的Alist资源失败:', error);
      throw error;
    }
  }

  /**
   * 获取统计信息
   */
  static async getStats() {
    try {
      const result = await query(`
        SELECT
          COUNT(*) as total_records,
          COUNT(DISTINCT resource_id) as total_resources,
          SUM(CASE WHEN is_folder THEN 1 ELSE 0 END) as folder_count,
          SUM(CASE WHEN NOT is_folder THEN 1 ELSE 0 END) as file_count,
          SUM(COALESCE(file_size, 0)) as total_size,
          AVG(COALESCE(file_size, 0)) as avg_file_size
        FROM alist_resources
      `);

      const stats = result.rows[0];

      return {
        total_records: parseInt(stats.total_records),
        total_resources: parseInt(stats.total_resources),
        folder_count: parseInt(stats.folder_count),
        file_count: parseInt(stats.file_count),
        total_size: parseInt(stats.total_size),
        avg_file_size: parseFloat(stats.avg_file_size) || 0
      };
    } catch (error) {
      logger.error('获取Alist资源统计失败:', error);
      throw error;
    }
  }

  /**
   * 批量同步文件信息
   */
  static async batchSyncFileInfo(limit = 10) {
    try {
      const resources = await this.getNeedSyncResources();
      let syncCount = 0;
      let errorCount = 0;

      for (const resource of resources.slice(0, limit)) {
        try {
          await this.syncFileInfo(resource.resource_id, resource.alist_path);
          syncCount++;
        } catch (error) {
          logger.error(`同步资源 ${resource.resource_id} 失败:`, error);
          errorCount++;
        }
      }

      logger.info('批量同步完成', { syncCount, errorCount, total: resources.length });

      return { syncCount, errorCount, total: resources.length };
    } catch (error) {
      logger.error('批量同步失败:', error);
      throw error;
    }
  }
}

module.exports = AlistResource;
