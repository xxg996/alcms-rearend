const { query } = require('../config/database');
const { logger } = require('../utils/logger');

class AlistIngestSetting {
  static normalizePath(path) {
    if (!path) return '/';
    let normalized = path.trim();

    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }

    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.replace(/\/+$/, '');
      if (normalized === '') {
        normalized = '/';
      }
    }

    return normalized;
  }

  static async create(data) {
    const normalizedPath = this.normalizePath(data.alist_root_path);

    try {
      const result = await query(
        `INSERT INTO alist_ingest_settings (
           title, alist_root_path, category_id, resource_type_id,
           author_id, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.title,
          normalizedPath,
          data.category_id || null,
          data.resource_type_id || null,
          data.author_id || null,
          data.is_active !== undefined ? data.is_active : true
        ]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('创建Alist入库配置失败:', error);
      throw error;
    }
  }

  static async update(id, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const payload = { ...data };
    if (payload.alist_root_path !== undefined) {
      payload.alist_root_path = this.normalizePath(payload.alist_root_path);
    }

    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      return await this.findById(id);
    }

    values.push(id);

    try {
      const result = await query(
        `UPDATE alist_ingest_settings
         SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('更新Alist入库配置失败:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const result = await query(
        'DELETE FROM alist_ingest_settings WHERE id = $1 RETURNING *',
        [id]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('删除Alist入库配置失败:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const result = await query(
        'SELECT * FROM alist_ingest_settings WHERE id = $1',
        [id]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('查询Alist入库配置失败:', error);
      throw error;
    }
  }

  static async findAll({ is_active } = {}) {
    const conditions = [];
    const values = [];
    let index = 1;

    if (is_active !== undefined) {
      conditions.push(`is_active = $${index}`);
      values.push(is_active);
      index++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const result = await query(
        `SELECT *
         FROM alist_ingest_settings
         ${whereClause}
         ORDER BY created_at DESC`,
        values
      );

      return result.rows;
    } catch (error) {
      logger.error('获取Alist入库配置列表失败:', error);
      throw error;
    }
  }
}

module.exports = AlistIngestSetting;
