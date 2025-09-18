/**
 * 资源文件数据模型
 * 处理下载资源文件的数据库操作
 */

const { query, getClient } = require('../config/database');
const { logger } = require('../utils/logger');

class ResourceFile {
  /**
   * 创建资源文件记录
   * @param {Object} fileData - 文件数据
   * @returns {Promise<Object>} 创建的文件记录
   */
  static async create(fileData) {
    const {
      resourceId,
      name,
      url,
      fileSize = 0,
      fileType,
      fileExtension,
      quality,
      version,
      language,
      isActive = true,
      sortOrder = 0
    } = fileData;

    try {
      const queryStr = `
        INSERT INTO resource_files (
          resource_id, name, url, file_size, file_type, file_extension,
          quality, version, language, is_active, sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const values = [
        resourceId, name, url, fileSize, fileType, fileExtension,
        quality, version, language, isActive, sortOrder
      ];

      const result = await query(queryStr, values);
      return result.rows[0];

    } catch (error) {
      logger.error('创建资源文件失败:', error);
      throw error;
    }
  }

  /**
   * 根据资源ID获取所有文件
   * @param {number} resourceId - 资源ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 文件列表
   */
  static async findByResourceId(resourceId, options = {}) {
    const {
      includeInactive = false,
      fileType,
      quality,
      isActive,
      limit,
      offset = 0
    } = options;

    try {
      let queryStr = `
        SELECT *
        FROM resource_files
        WHERE resource_id = $1 AND deleted_at IS NULL
      `;
      const values = [resourceId];
      let paramCount = 1;

      // 新增明确的 is_active 筛选功能
      if (isActive !== undefined) {
        paramCount++;
        queryStr += ` AND is_active = $${paramCount}`;
        values.push(isActive);
      } else if (!includeInactive) {
        // 向后兼容：如果没有明确指定 isActive，则使用 includeInactive 逻辑
        queryStr += ` AND is_active = TRUE`;
      }

      // 添加文件类型筛选
      if (fileType) {
        paramCount++;
        queryStr += ` AND file_type = $${paramCount}`;
        values.push(fileType);
      }

      // 添加质量筛选
      if (quality) {
        paramCount++;
        queryStr += ` AND quality = $${paramCount}`;
        values.push(quality);
      }

      // 排序：按sort_order排序，然后按创建时间
      queryStr += ` ORDER BY sort_order ASC, created_at ASC`;

      // 添加分页
      if (limit) {
        paramCount++;
        queryStr += ` LIMIT $${paramCount}`;
        values.push(limit);

        paramCount++;
        queryStr += ` OFFSET $${paramCount}`;
        values.push(offset);
      }

      const result = await query(queryStr, values);
      return result.rows;

    } catch (error) {
      logger.error('获取资源文件失败:', error);
      throw error;
    }
  }

  /**
   * 获取资源的第一个文件（按排序顺序）
   * @param {number} resourceId - 资源ID
   * @returns {Promise<Object|null>} 第一个文件
   */
  static async findFirstByResourceId(resourceId) {
    try {
      const queryStr = `
        SELECT *
        FROM resource_files
        WHERE resource_id = $1
          AND is_active = TRUE
          AND deleted_at IS NULL
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 1
      `;

      const result = await query(queryStr, [resourceId]);
      return result.rows[0] || null;

    } catch (error) {
      logger.error('获取第一个资源文件失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取文件
   * @param {number} id - 文件ID
   * @returns {Promise<Object|null>} 文件信息
   */
  static async findById(id) {
    try {
      const queryStr = `
        SELECT rf.*, r.title as resource_title
        FROM resource_files rf
        LEFT JOIN resources r ON rf.resource_id = r.id
        WHERE rf.id = $1 AND rf.deleted_at IS NULL
      `;

      const result = await query(queryStr, [id]);
      return result.rows[0] || null;

    } catch (error) {
      logger.error('获取资源文件失败:', error);
      throw error;
    }
  }

  /**
   * 更新资源文件
   * @param {number} id - 文件ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新后的文件信息
   */
  static async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    // 构建动态更新语句
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        paramCount++;
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('没有提供更新数据');
    }

    try {
      paramCount++;
      values.push(id);

      const queryStr = `
        UPDATE resource_files
        SET ${fields.join(', ')}
        WHERE id = $${paramCount} AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await query(queryStr, values);
      return result.rows[0];

    } catch (error) {
      logger.error('更新资源文件失败:', error);
      throw error;
    }
  }

  /**
   * 更新文件排序
   * @param {number} resourceId - 资源ID
   * @param {Array} sortData - 排序数据 [{id: 1, sortOrder: 0}, {id: 2, sortOrder: 1}]
   * @returns {Promise<Array>} 更新后的文件列表
   */
  static async updateSortOrder(resourceId, sortData) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      const results = [];
      for (const item of sortData) {
        const result = await client.query(`
          UPDATE resource_files
          SET sort_order = $1
          WHERE id = $2 AND resource_id = $3 AND deleted_at IS NULL
          RETURNING *
        `, [item.sortOrder, item.id, resourceId]);

        if (result.rows[0]) {
          results.push(result.rows[0]);
        }
      }

      await client.query('COMMIT');
      return results;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('更新文件排序失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 软删除文件
   * @param {number} id - 文件ID
   * @returns {Promise<Object>} 删除的文件信息
   */
  static async softDelete(id) {
    try {
      const queryStr = `
        UPDATE resource_files
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await query(queryStr, [id]);
      return result.rows[0];

    } catch (error) {
      logger.error('删除资源文件失败:', error);
      throw error;
    }
  }

  /**
   * 增加下载次数
   * @param {number} id - 文件ID
   * @returns {Promise<void>}
   */
  static async incrementDownloadCount(id) {
    try {
      await query(`
        UPDATE resource_files
        SET
          download_count = download_count + 1,
          last_downloaded_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
      `, [id]);

    } catch (error) {
      logger.error('增加下载次数失败:', error);
      throw error;
    }
  }

  /**
   * 获取热门文件
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 热门文件列表
   */
  static async findPopular(options = {}) {
    const {
      fileType,
      limit = 10,
      days = 30
    } = options;

    try {
      let queryStr = `
        SELECT rf.*, r.title as resource_title, r.author_id
        FROM resource_files rf
        LEFT JOIN resources r ON rf.resource_id = r.id
        WHERE rf.deleted_at IS NULL
          AND rf.is_active = TRUE
          AND r.status = 'published'
      `;
      const values = [];
      let paramCount = 0;

      // 文件类型筛选
      if (fileType) {
        paramCount++;
        queryStr += ` AND rf.file_type = $${paramCount}`;
        values.push(fileType);
      }

      // 时间范围筛选
      if (days > 0) {
        paramCount++;
        queryStr += ` AND (rf.last_downloaded_at IS NULL OR rf.last_downloaded_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days')`;
      }

      queryStr += ` ORDER BY rf.download_count DESC, rf.created_at DESC`;

      paramCount++;
      queryStr += ` LIMIT $${paramCount}`;
      values.push(limit);

      const result = await query(queryStr, values);
      return result.rows;

    } catch (error) {
      logger.error('获取热门文件失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有文件列表（管理员功能）
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 分页文件列表
   */
  static async findAll(options = {}) {
    const {
      page = 1,
      limit = 20,
      isActive,
      fileType,
      quality,
      resourceId,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    try {
      const offset = (page - 1) * limit;

      // 构建基础查询 - 简化版本先测试
      let whereConditions = ['rf.deleted_at IS NULL'];
      let values = [];
      let paramCount = 0;

      // 添加筛选条件
      if (isActive !== undefined) {
        paramCount++;
        whereConditions.push(`rf.is_active = $${paramCount}`);
        values.push(isActive);
      }

      if (fileType) {
        paramCount++;
        whereConditions.push(`rf.file_type = $${paramCount}`);
        values.push(fileType);
      }

      if (quality) {
        paramCount++;
        whereConditions.push(`rf.quality = $${paramCount}`);
        values.push(quality);
      }

      if (resourceId) {
        paramCount++;
        whereConditions.push(`rf.resource_id = $${paramCount}`);
        values.push(resourceId);
      }

      if (search) {
        paramCount++;
        whereConditions.push(`(rf.name ILIKE $${paramCount} OR r.title ILIKE $${paramCount})`);
        values.push(`%${search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      // 验证排序字段
      const allowedSortFields = ['created_at', 'name', 'file_size', 'download_count', 'sort_order'];
      const safeSortBy = allowedSortFields.includes(sortBy) ? `rf.${sortBy}` : 'rf.created_at';
      const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // 使用模板字符串正确方式
      const listQuery = `
        SELECT
          rf.*,
          r.title as resource_title,
          r.author_id as resource_author_id,
          u.username as resource_author_username
        FROM resource_files rf
        LEFT JOIN resources r ON rf.resource_id = r.id
        LEFT JOIN users u ON r.author_id = u.id
        WHERE ${whereClause}
        ORDER BY ${safeSortBy} ${safeSortOrder}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      // 查询总数
      const countQuery = `
        SELECT COUNT(*)
        FROM resource_files rf
        LEFT JOIN resources r ON rf.resource_id = r.id
        WHERE ${whereClause}
      `;

      // 添加 limit 和 offset 参数
      const listValues = [...values, limit, offset];
      const countValues = values;

      const [listResult, countResult] = await Promise.all([
        query(listQuery, listValues),
        query(countQuery, countValues)
      ]);

      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      return {
        files: listResult.rows,
        pagination: {
          current_page: page,
          per_page: limit,
          total_items: total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      };

    } catch (error) {
      logger.error('获取所有文件列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件统计信息
   * @param {number} resourceId - 资源ID（可选）
   * @returns {Promise<Object>} 统计信息
   */
  static async getStatistics(resourceId = null) {
    try {
      let queryStr = `
        SELECT
          COUNT(*) as total_files,
          COUNT(*) FILTER (WHERE is_active = TRUE) as active_files,
          COALESCE(SUM(download_count), 0) as total_downloads,
          COALESCE(SUM(file_size), 0) as total_size,
          COUNT(DISTINCT file_type) as file_types_count
        FROM resource_files
        WHERE deleted_at IS NULL
      `;

      const values = [];
      if (resourceId) {
        queryStr += ` AND resource_id = $1`;
        values.push(resourceId);
      }

      const result = await query(queryStr, values);
      return result.rows[0];

    } catch (error) {
      logger.error('获取文件统计失败:', error);
      throw error;
    }
  }
}

module.exports = ResourceFile;