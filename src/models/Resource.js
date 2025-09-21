/**
 * 资源数据模型
 * 处理资源相关的数据库操作
 */

const { query, getClient } = require('../config/database');

class Resource {
  /**
   * 创建新资源
   * @param {Object} resourceData - 资源数据
   * @returns {Promise<Object>} 创建的资源信息
   */
  static async create(resourceData) {
    const {
      title,
      slug,
      description,
      content,
      summary,
      categoryId,
      resourceTypeId,
      coverImageUrl,
      isPublic = true,
      isFree = true,
      requiredPoints = 0,
      authorId,
      tags = []
    } = resourceData;

    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      // 生成唯一的slug
      let finalSlug = slug;
      if (!finalSlug) {
        finalSlug = title.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim('-');
      }

      // 检查slug唯一性
      const slugCheck = await client.query('SELECT id FROM resources WHERE slug = $1', [finalSlug]);
      if (slugCheck.rows.length > 0) {
        finalSlug = `${finalSlug}-${Date.now()}`;
      }

      // 插入资源
      const resourceResult = await client.query(
        `INSERT INTO resources (
          title, slug, description, content, summary, category_id, resource_type_id,
          cover_image_url, is_public, is_free, required_points, author_id, published_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          title, finalSlug, description, content, summary, categoryId, resourceTypeId,
          coverImageUrl, isPublic, isFree, requiredPoints, authorId, new Date()
        ]
      );

      const resource = resourceResult.rows[0];

      // 添加标签关联
      if (tags.length > 0) {
        for (const tagId of tags) {
          await client.query(
            'INSERT INTO resource_tags (resource_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [resource.id, tagId]
          );
        }
      }

      await client.query('COMMIT');
      return resource;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 根据ID获取资源
   * @param {number} id - 资源ID
   * @param {number} userId - 用户ID（用于权限检查）
   * @returns {Promise<Object|null>} 资源信息
   */
  static async findById(id, userId = null) {
    const result = await query(
      `SELECT 
        r.*,
        rt.name as resource_type_name,
        rt.display_name as resource_type_display_name,
        rt.is_streamable,
        c.name as category_name,
        c.display_name as category_display_name,
        u.username as author_username,
        u.nickname as author_nickname,
        CASE WHEN f.id IS NOT NULL THEN true ELSE false END as is_favorited
      FROM resources r
      LEFT JOIN resource_types rt ON r.resource_type_id = rt.id
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN users u ON r.author_id = u.id
      LEFT JOIN user_favorites f ON r.id = f.resource_id AND f.user_id = $2
      WHERE r.id = $1`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const resource = result.rows[0];

    // 获取标签
    const tagsResult = await query(
      `SELECT t.* FROM tags t
       JOIN resource_tags rt ON t.id = rt.tag_id
       WHERE rt.resource_id = $1`,
      [id]
    );

    resource.tags = tagsResult.rows;
    return resource;
  }

  /**
   * 获取资源列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 资源列表和分页信息
   */
  static async findAll(options = {}) {
    const {
      page = 1,
      limit = 20,
      categoryId,
      resourceTypeId,
      authorId,
      status = 'published',
      isPublic,
      isFree,
      search,
      tags,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    // 构建查询条件

    if (status) {
      conditions.push(`r.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (categoryId) {
      conditions.push(`r.category_id = $${paramIndex}`);
      values.push(categoryId);
      paramIndex++;
    }

    if (resourceTypeId) {
      conditions.push(`r.resource_type_id = $${paramIndex}`);
      values.push(resourceTypeId);
      paramIndex++;
    }

    if (authorId) {
      conditions.push(`r.author_id = $${paramIndex}`);
      values.push(authorId);
      paramIndex++;
    }

    if (isPublic !== undefined) {
      conditions.push(`r.is_public = $${paramIndex}`);
      values.push(isPublic);
      paramIndex++;
    }

    if (isFree !== undefined) {
      conditions.push(`r.is_free = $${paramIndex}`);
      values.push(isFree);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(
        r.title ILIKE $${paramIndex} OR 
        r.description ILIKE $${paramIndex} OR
        r.content ILIKE $${paramIndex}
      )`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    // 标签过滤
    let tagJoin = '';
    if (tags && tags.length > 0) {
      tagJoin = `
        JOIN resource_tags rt_filter ON r.id = rt_filter.resource_id
        JOIN tags t_filter ON rt_filter.tag_id = t_filter.id
      `;
      conditions.push(`t_filter.name = ANY($${paramIndex})`);
      values.push(tags);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 验证排序字段
    const allowedSortFields = ['created_at', 'updated_at', 'title', 'view_count', 'download_count', 'like_count'];
    const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const finalSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    // 查询资源列表
    const resourcesQuery = `
      SELECT 
        r.id, r.title, r.slug, r.description, r.summary, r.cover_image_url,
        r.is_public, r.is_free, r.required_points,
        r.view_count, r.download_count, r.like_count, r.created_at, r.published_at,
        rt.name as resource_type_name, rt.display_name as resource_type_display_name,
        c.name as category_name, c.display_name as category_display_name,
        u.username as author_username, u.nickname as author_nickname
      FROM resources r
      LEFT JOIN resource_types rt ON r.resource_type_id = rt.id
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN users u ON r.author_id = u.id
      ${tagJoin}
      ${whereClause}
      ORDER BY r.${finalSortBy} ${finalSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    const resourcesResult = await query(resourcesQuery, values);

    // 查询总数
    const countQuery = `
      SELECT COUNT(DISTINCT r.id) as total
      FROM resources r
      LEFT JOIN resource_types rt ON r.resource_type_id = rt.id
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN users u ON r.author_id = u.id
      ${tagJoin}
      ${whereClause}
    `;

    const countResult = await query(countQuery, values.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    return {
      resources: resourcesResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 更新资源
   * @param {number} id - 资源ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新后的资源信息
   */
  static async update(id, updateData) {
    const allowedFields = [
      'title', 'slug', 'description', 'content', 'summary', 'category_id',
      'cover_image_url', 'is_public', 'is_free', 'required_points', 'status'
    ];

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
      `UPDATE resources SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('资源不存在');
    }

    return result.rows[0];
  }


  /**
   * 删除资源（保留历史数据）
   * @param {number} id - 资源ID
   * @returns {Promise<boolean>} 删除是否成功
   */
  static async delete(id) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // 检查资源是否存在
      const resourceResult = await client.query(
        'SELECT id, title FROM resources WHERE id = $1',
        [id]
      );

      if (resourceResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('资源不存在');
      }

      const resource = resourceResult.rows[0];

      const deleteResult = await client.query(
        `UPDATE resources
         SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      await client.query('COMMIT');

      const { logger } = require('../utils/logger');
      logger.info('资源删除成功，历史数据已保留', {
        resourceId: id,
        resourceTitle: resource.title
      });

      return deleteResult.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      const { logger } = require('../utils/logger');
      logger.error('资源删除失败', { resourceId: id, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 通用删除方法（用于服务层调用）
   * @param {number} id - 资源ID
   * @returns {Promise<boolean>} 删除是否成功
   */
  static async deleteById(id) {
    return this.delete(id);
  }

  /**
   * 增加浏览次数
   * @param {number} id - 资源ID
   * @returns {Promise<void>}
   */
  static async incrementViewCount(id) {
    await query('UPDATE resources SET view_count = view_count + 1 WHERE id = $1', [id]);
  }

  /**
   * 增加下载次数
   * @param {number} id - 资源ID
   * @returns {Promise<void>}
   */
  static async incrementDownloadCount(id) {
    await query('UPDATE resources SET download_count = download_count + 1 WHERE id = $1', [id]);
  }

  /**
   * 记录下载
   * @param {Object} downloadData - 下载记录数据
   * @returns {Promise<Object>} 下载记录
   */
  static async recordDownload(downloadData) {
    const { userId, resourceId, ipAddress, userAgent, downloadUrl, expiresAt } = downloadData;

    const result = await query(
      `INSERT INTO download_records (user_id, resource_id, ip_address, user_agent, download_url, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, resourceId, ipAddress, userAgent, downloadUrl, expiresAt]
    );

    // 增加下载次数
    await this.incrementDownloadCount(resourceId);

    return result.rows[0];
  }

  /**
   * 全文搜索
   * @param {string} searchTerm - 搜索词
   * @param {Object} options - 搜索选项
   * @returns {Promise<Array>} 搜索结果
   */
  static async fullTextSearch(searchTerm, options = {}) {
    const { limit = 20, offset = 0 } = options;

    const result = await query(
      `SELECT 
        r.id, r.title, r.slug, r.description, r.summary, r.cover_image_url,
        r.view_count, r.download_count, r.created_at,
        rt.display_name as resource_type_display_name,
        c.display_name as category_display_name,
        u.nickname as author_nickname,
        ts_rank(to_tsvector('english', r.title || ' ' || COALESCE(r.description, '') || ' ' || COALESCE(r.content, '')), query) as rank
      FROM resources r
      LEFT JOIN resource_types rt ON r.resource_type_id = rt.id
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN users u ON r.author_id = u.id,
      to_tsquery('english', $1) query
      WHERE to_tsvector('english', r.title || ' ' || COALESCE(r.description, '') || ' ' || COALESCE(r.content, '')) @@ query
      AND r.status = 'published' AND r.is_public = true
      ORDER BY rank DESC, r.created_at DESC
      LIMIT $2 OFFSET $3`,
      [searchTerm.replace(/\s+/g, ' & '), limit, offset]
    );

    return result.rows;
  }
}

module.exports = Resource;
