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
      summary,
      category_id,
      resource_type_id,
      cover_image_url,
      is_public = true,
      status = 'published',
      author_id,
      tags = [],
      official = false
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
          title, slug, description, summary, category_id, resource_type_id,
          cover_image_url, is_public, status, author_id, published_at, official
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12
        )
        RETURNING *`,
        [
          title,
          finalSlug,
          description,
          summary,
          category_id,
          resource_type_id,
          cover_image_url,
          is_public,
          status,
          author_id,
          new Date(),
          official
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
      category_id,
      resource_type_id,
      author_id,
      status = null,
      is_public,
      search,
      tags,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = options;

    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const currentLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (currentPage - 1) * currentLimit;
    const conditions = [];
    const values = [];
    let paramIndex = 1;
    const sanitizedSearch = typeof search === 'string' ? search.trim() : '';

    // 构建查询条件

    if (status !== undefined && status !== null) {
      conditions.push(`r.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (category_id) {
      conditions.push(`r.category_id = $${paramIndex}`);
      values.push(category_id);
      paramIndex++;
    }

    if (resource_type_id) {
      conditions.push(`r.resource_type_id = $${paramIndex}`);
      values.push(resource_type_id);
      paramIndex++;
    }

    if (author_id) {
      conditions.push(`r.author_id = $${paramIndex}`);
      values.push(author_id);
      paramIndex++;
    }

    if (is_public !== undefined) {
      conditions.push(`r.is_public = $${paramIndex}`);
      values.push(is_public);
      paramIndex++;
    }
    if (sanitizedSearch) {
      const tsQueryParamIndex = paramIndex;
      const fuzzyParamIndex = paramIndex + 1;

      conditions.push(`(
        to_tsvector('simple', coalesce(r.title, '') || ' ' || coalesce(r.description, '')) @@ websearch_to_tsquery('simple', $${tsQueryParamIndex})
        OR r.title ILIKE $${fuzzyParamIndex}
        OR r.description ILIKE $${fuzzyParamIndex}
      )`);

      values.push(sanitizedSearch);
      values.push(`%${sanitizedSearch}%`);
      paramIndex += 2;
    }

    // 标签过滤
    let tagJoin = '';
    if (tags && tags.length > 0) {
      const numericTags = tags
        .map(tag => Number(tag))
        .filter(value => Number.isFinite(value));

      if (numericTags.length > 0) {
      tagJoin = `
        JOIN resource_tags rt_filter ON r.id = rt_filter.resource_id
      `;
      conditions.push(`rt_filter.tag_id = ANY($${paramIndex})`);
      values.push(numericTags);
      paramIndex++;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 验证排序字段
    const allowedSortFields = ['created_at', 'updated_at', 'title', 'view_count', 'download_count', 'like_count'];
    const finalSortBy = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const finalSortOrder = ['ASC', 'DESC'].includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'DESC';

    // 查询资源列表
    const resourcesQuery = `
      SELECT
        r.id, r.title, r.slug, r.description, r.summary, r.cover_image_url,
        r.is_public, r.official, r.view_count, r.download_count, r.like_count, r.created_at, r.published_at,
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

    values.push(currentLimit, offset);

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
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.ceil(total / currentLimit)
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
      'title',
      'slug',
      'description',
      'summary',
      'category_id',
      'resource_type_id',
      'cover_image_url',
      'is_public',
      'status',
      'official'
    ];

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updateData[field] === undefined) {
        continue;
      }

      updateFields.push(`${field} = $${paramIndex}`);
      values.push(updateData[field]);
      paramIndex++;
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
   * 随机获取指定类型的公开已发布资源
   * @param {string} typeName 资源类型名称（resource_types.name）
   * @param {number} limit 返回数量，范围1-50
   * @returns {Promise<Array>} 资源列表
   */
  static async getRandomPublishedResourcesByType(typeName = 'video', limit = 6) {
    const resolvedType = typeof typeName === 'string' && typeName.trim()
      ? typeName.trim().toLowerCase()
      : 'video';

    const resolvedLimit = Math.min(Math.max(parseInt(limit, 10) || 6, 1), 50);

    const result = await query(
      `SELECT
         r.id,
         r.title,
         r.slug,
         r.summary,
         r.description,
         r.cover_image_url,
         r.view_count,
         r.download_count,
         r.like_count,
         r.created_at,
         r.published_at,
         r.author_id,
         r.category_id,
         rt.id AS resource_type_id,
         rt.name AS resource_type_name,
         rt.display_name AS resource_type_display_name,
         c.name AS category_name,
         c.display_name AS category_display_name,
         u.username AS author_username,
         u.nickname AS author_nickname
       FROM resources r
       JOIN resource_types rt ON r.resource_type_id = rt.id
       LEFT JOIN categories c ON r.category_id = c.id
       LEFT JOIN users u ON r.author_id = u.id
       WHERE r.status = 'published'
         AND r.is_public = TRUE
         AND rt.name = $1
       ORDER BY RANDOM()
       LIMIT $2`,
      [resolvedType, resolvedLimit]
    );

    return result.rows;
  }
}

module.exports = Resource;
