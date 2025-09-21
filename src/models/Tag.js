/**
 * 标签数据模型
 * 处理标签相关的数据库操作
 */

const { query } = require('../config/database');

class Tag {
  /**
   * 创建新标签
   * @param {Object} tagData - 标签数据
   * @returns {Promise<Object>} 创建的标签信息
   */
  static async create(tagData) {
    const { name, displayName, description, color = '#007bff' } = tagData;

    // 检查标签名称是否已存在
    const existingTag = await query('SELECT id FROM tags WHERE name = $1', [name]);
    if (existingTag.rows.length > 0) {
      throw new Error('标签名称已存在');
    }

    const result = await query(
      `INSERT INTO tags (name, display_name, description, color)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, displayName, description, color]
    );

    return result.rows[0];
  }

  /**
   * 根据ID获取标签
   * @param {number} id - 标签ID
   * @returns {Promise<Object|null>} 标签信息
   */
  static async findById(id) {
    const result = await query('SELECT * FROM tags WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * 根据名称获取标签
   * @param {string} name - 标签名称
   * @returns {Promise<Object|null>} 标签信息
   */
  static async findByName(name) {
    const result = await query('SELECT * FROM tags WHERE name = $1', [name]);
    return result.rows[0] || null;
  }

  /**
   * 获取标签总数
   * @param {Object} options - 查询选项
   * @returns {Promise<number>} 标签总数
   */
  static async countAll(options = {}) {
    const { search } = options;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR display_name ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT COUNT(*) as total FROM tags ${whereClause}`,
      values
    );

    return parseInt(result.rows[0].total) || 0;
  }

  /**
   * 获取所有标签
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 标签列表
   */
  static async findAll(options = {}) {
    const { 
      search, 
      sortBy = 'usage_count', 
      sortOrder = 'DESC',
      limit,
      offset = 0 
    } = options;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR display_name ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 验证排序字段
    const allowedSortFields = ['name', 'display_name', 'usage_count', 'created_at'];
    const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'usage_count';
    const finalSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    let limitClause = '';
    if (limit) {
      limitClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      values.push(limit, offset);
    }

    const result = await query(
      `SELECT * FROM tags
       ${whereClause}
       ORDER BY ${finalSortBy} ${finalSortOrder}
       ${limitClause}`,
      values
    );

    return result.rows;
  }

  /**
   * 更新标签
   * @param {number} id - 标签ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新后的标签信息
   */
  static async update(id, updateData) {
    const allowedFields = ['name', 'display_name', 'description', 'color'];
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        values.push(updateData[field]);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error('没有可更新的字段');
    }

    values.push(id);
    const result = await query(
      `UPDATE tags SET ${updateFields.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('标签不存在');
    }

    return result.rows[0];
  }

  /**
   * 删除标签
   * @param {number} id - 标签ID
   * @returns {Promise<boolean>} 删除是否成功
   */
  static async delete(id) {
    // 检查是否有关联资源
    const resourcesResult = await query(
      'SELECT COUNT(*) as count FROM resource_tags WHERE tag_id = $1', 
      [id]
    );
    
    if (parseInt(resourcesResult.rows[0].count) > 0) {
      throw new Error('存在关联资源，无法删除');
    }

    const result = await query('DELETE FROM tags WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  /**
   * 批量创建或获取标签
   * @param {Array} tagNames - 标签名称数组
   * @returns {Promise<Array>} 标签ID数组
   */
  static async createOrGetTags(tagNames) {
    const tagIds = [];
    
    for (const tagName of tagNames) {
      const cleanTagName = tagName.trim().toLowerCase();
      if (!cleanTagName) continue;

      // 查找现有标签
      let tag = await this.findByName(cleanTagName);
      
      if (!tag) {
        // 创建新标签
        tag = await this.create({
          name: cleanTagName,
          displayName: tagName.trim(), // 保持原始大小写作为显示名称
          description: `自动创建的标签: ${tagName.trim()}`
        });
      }
      
      tagIds.push(tag.id);
    }
    
    return tagIds;
  }

  /**
   * 过滤出数据库中真实存在的标签ID
   * @param {Array<number>} tagIds - 待校验的标签ID数组
   * @returns {Promise<Array<number>>} 存在的标签ID
   */
  static async filterExistingIds(tagIds = []) {
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return [];
    }

    const uniqueIds = Array.from(new Set(tagIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (uniqueIds.length === 0) {
      return [];
    }

    const result = await query(
      'SELECT id FROM tags WHERE id = ANY($1)',
      [uniqueIds]
    );

    return result.rows.map((row) => row.id);
  }

  /**
   * 更新标签使用次数
   * @param {number} id - 标签ID
   * @param {number} increment - 增量（可为负数）
   * @returns {Promise<void>}
   */
  static async updateUsageCount(id, increment = 1) {
    await query(
      'UPDATE tags SET usage_count = GREATEST(usage_count + $1, 0) WHERE id = $2',
      [increment, id]
    );
  }

  /**
   * 获取热门标签
   * @param {number} limit - 限制数量
   * @returns {Promise<Array>} 热门标签列表
   */
  static async getPopularTags(limit = 20) {
    const result = await query(
      `SELECT t.*, COUNT(rt.resource_id) as active_usage_count
       FROM tags t
       LEFT JOIN resource_tags rt ON t.id = rt.tag_id
       LEFT JOIN resources r ON rt.resource_id = r.id AND r.status = 'published' AND r.is_public = true
       GROUP BY t.id
       ORDER BY active_usage_count DESC, t.usage_count DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * 搜索标签
   * @param {string} query - 搜索查询
   * @param {number} limit - 限制数量
   * @returns {Promise<Array>} 搜索结果
   */
  static async searchTags(searchQuery, limit = 10) {
    const result = await query(
      `SELECT * FROM tags
       WHERE name ILIKE $1 OR display_name ILIKE $1
       ORDER BY 
         CASE 
           WHEN name = $2 THEN 1
           WHEN name ILIKE $2 || '%' THEN 2
           WHEN display_name = $2 THEN 3
           WHEN display_name ILIKE $2 || '%' THEN 4
           ELSE 5
         END,
         usage_count DESC
       LIMIT $3`,
      [`%${searchQuery}%`, searchQuery, limit]
    );

    return result.rows;
  }

  /**
   * 获取资源的标签
   * @param {number} resourceId - 资源ID
   * @returns {Promise<Array>} 标签列表
   */
  static async getResourceTags(resourceId) {
    const result = await query(
      `SELECT t.* FROM tags t
       JOIN resource_tags rt ON t.id = rt.tag_id
       WHERE rt.resource_id = $1
       ORDER BY t.name`,
      [resourceId]
    );

    return result.rows;
  }

  /**
   * 为资源添加标签
   * @param {number} resourceId - 资源ID
   * @param {Array} tagIds - 标签ID数组
   * @returns {Promise<void>}
   */
  static async addTagsToResource(resourceId, tagIds) {
    for (const tagId of tagIds) {
      await query(
        'INSERT INTO resource_tags (resource_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [resourceId, tagId]
      );
      
      // 更新标签使用次数
      await this.updateUsageCount(tagId, 1);
    }
  }

  /**
   * 移除资源的标签
   * @param {number} resourceId - 资源ID
   * @param {Array} tagIds - 要移除的标签ID数组（可选，不传则移除所有）
   * @returns {Promise<void>}
   */
  static async removeTagsFromResource(resourceId, tagIds = null) {
    let deleteQuery;
    let params;

    if (tagIds && tagIds.length > 0) {
      deleteQuery = 'DELETE FROM resource_tags WHERE resource_id = $1 AND tag_id = ANY($2) RETURNING tag_id';
      params = [resourceId, tagIds];
    } else {
      deleteQuery = 'DELETE FROM resource_tags WHERE resource_id = $1 RETURNING tag_id';
      params = [resourceId];
    }

    const result = await query(deleteQuery, params);
    
    // 更新标签使用次数
    for (const row of result.rows) {
      await this.updateUsageCount(row.tag_id, -1);
    }
  }

  /**
   * 同步资源标签
   * @param {number} resourceId - 资源ID
   * @param {Array} tagIds - 新的标签ID数组
   * @returns {Promise<void>}
   */
  static async syncResourceTags(resourceId, tagIds) {
    // 获取当前标签
    const currentTags = await this.getResourceTags(resourceId);
    const currentTagIds = currentTags.map(tag => tag.id);

    // 计算需要添加和移除的标签
    const tagsToAdd = tagIds.filter(id => !currentTagIds.includes(id));
    const tagsToRemove = currentTagIds.filter(id => !tagIds.includes(id));

    // 移除不需要的标签
    if (tagsToRemove.length > 0) {
      await this.removeTagsFromResource(resourceId, tagsToRemove);
    }

    // 添加新标签
    if (tagsToAdd.length > 0) {
      await this.addTagsToResource(resourceId, tagsToAdd);
    }
  }
}

module.exports = Tag;
