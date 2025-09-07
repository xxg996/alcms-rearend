/**
 * 社区帖子数据模型
 * 处理帖子的CRUD操作、搜索和统计
 */

const { query } = require('../config/database');

class CommunityPost {
  /**
   * 获取帖子列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 分页结果
   */
  static async findAll(options = {}) {
    const {
      page = 1,
      limit = 20,
      boardId,
      authorId,
      status = 'published',
      isPinned,
      isFeatured,
      sortBy = 'last_reply_time',
      sortOrder = 'DESC',
      search,
      tags
    } = options;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // 基本查询
    let sql = `
      SELECT 
        cp.*,
        u.username as author_username,
        u.nickname as author_nickname,
        u.avatar_url as author_avatar,
        cb.name as board_name,
        cb.display_name as board_display_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'name', t.name,
              'display_name', t.display_name,
              'color', t.color
            )
          ) FILTER (WHERE t.id IS NOT NULL), 
          '[]'
        ) as tags
      FROM community_posts cp
      JOIN users u ON cp.author_id = u.id
      JOIN community_boards cb ON cp.board_id = cb.id
      LEFT JOIN community_post_tags cpt ON cp.id = cpt.post_id
      LEFT JOIN tags t ON cpt.tag_id = t.id
    `;

    // 添加条件
    if (status) {
      conditions.push(`cp.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (boardId) {
      conditions.push(`cp.board_id = $${paramIndex}`);
      params.push(boardId);
      paramIndex++;
    }

    if (authorId) {
      conditions.push(`cp.author_id = $${paramIndex}`);
      params.push(authorId);
      paramIndex++;
    }

    if (isPinned !== undefined) {
      conditions.push(`cp.is_pinned = $${paramIndex}`);
      params.push(isPinned);
      paramIndex++;
    }

    if (isFeatured !== undefined) {
      conditions.push(`cp.is_featured = $${paramIndex}`);
      params.push(isFeatured);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(cp.title ILIKE $${paramIndex} OR cp.content ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (tags && Array.isArray(tags) && tags.length > 0) {
      conditions.push(`cp.id IN (
        SELECT DISTINCT cpt.post_id 
        FROM community_post_tags cpt 
        JOIN tags t ON cpt.tag_id = t.id 
        WHERE t.name = ANY($${paramIndex})
      )`);
      params.push(tags);
      paramIndex++;
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' GROUP BY cp.id, u.id, cb.id';

    // 排序
    const allowedSortFields = {
      'created_at': 'cp.created_at',
      'updated_at': 'cp.updated_at',
      'last_reply_time': 'cp.last_reply_time',
      'view_count': 'cp.view_count',
      'reply_count': 'cp.reply_count',
      'like_count': 'cp.like_count',
      'title': 'cp.title'
    };

    const sortField = allowedSortFields[sortBy] || 'cp.last_reply_time';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // 置顶和精华帖优先排序
    sql += ` ORDER BY cp.is_pinned DESC, cp.is_featured DESC, ${sortField} ${order}`;

    // 分页
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    // 获取总数
    let countSql = `
      SELECT COUNT(DISTINCT cp.id) as total
      FROM community_posts cp
      JOIN users u ON cp.author_id = u.id
      JOIN community_boards cb ON cp.board_id = cb.id
    `;

    if (tags && Array.isArray(tags) && tags.length > 0) {
      countSql += ' LEFT JOIN community_post_tags cpt ON cp.id = cpt.post_id LEFT JOIN tags t ON cpt.tag_id = t.id';
    }

    if (conditions.length > 0) {
      // 重新构建count查询的条件（排除tags相关的子查询）
      const countConditions = conditions.filter(condition => 
        !condition.includes('cp.id IN')
      );
      
      if (tags && Array.isArray(tags) && tags.length > 0) {
        countConditions.push('t.name = ANY($' + (params.length - 1) + ')');
      }
      
      if (countConditions.length > 0) {
        countSql += ' WHERE ' + countConditions.join(' AND ');
      }
    }

    const [dataResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, params.slice(0, -2)) // 移除limit和offset参数
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * 根据ID获取帖子详情
   * @param {number} id - 帖子ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object|null>} 帖子详情
   */
  static async findById(id, options = {}) {
    const { includeContent = true, userId } = options;

    let sql = `
      SELECT 
        cp.*,
        u.username as author_username,
        u.nickname as author_nickname,
        u.avatar_url as author_avatar,
        cb.name as board_name,
        cb.display_name as board_display_name,
        cb.description as board_description,
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'name', t.name,
              'display_name', t.display_name,
              'color', t.color
            )
          ) FILTER (WHERE t.id IS NOT NULL), 
          '[]'
        ) as tags
        ${userId ? `,
        (SELECT COUNT(*) > 0 FROM community_likes cl 
         WHERE cl.user_id = $2 AND cl.target_type = 'post' AND cl.target_id = cp.id) as is_liked,
        (SELECT COUNT(*) > 0 FROM community_favorites cf 
         WHERE cf.user_id = $2 AND cf.post_id = cp.id) as is_favorited
        ` : ''}
      FROM community_posts cp
      JOIN users u ON cp.author_id = u.id
      JOIN community_boards cb ON cp.board_id = cb.id
      LEFT JOIN community_post_tags cpt ON cp.id = cpt.post_id
      LEFT JOIN tags t ON cpt.tag_id = t.id
      WHERE cp.id = $1
      GROUP BY cp.id, u.id, cb.id
    `;

    const params = userId ? [id, userId] : [id];
    const result = await query(sql, params);
    
    if (result.rows.length === 0) {
      return null;
    }

    const post = result.rows[0];

    // 如果不需要包含内容（用于列表显示），则移除content字段
    if (!includeContent) {
      delete post.content;
    }

    return post;
  }

  /**
   * 创建新帖子
   * @param {Object} postData - 帖子数据
   * @returns {Promise<Object>} 创建的帖子
   */
  static async create(postData) {
    const {
      title,
      content,
      contentType = 'markdown',
      summary,
      authorId,
      boardId,
      tags = [],
      status = 'published'
    } = postData;

    // 开始事务
    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');

      // 创建帖子
      const postSql = `
        INSERT INTO community_posts (
          title, content, content_type, summary, author_id, board_id, status, published_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const publishedAt = status === 'published' ? new Date() : null;
      const postParams = [title, content, contentType, summary, authorId, boardId, status, publishedAt];
      
      const postResult = await client.query(postSql, postParams);
      const post = postResult.rows[0];

      // 关联标签
      if (tags.length > 0) {
        await this.updatePostTags(client, post.id, tags);
      }

      // 更新板块帖子计数
      if (status === 'published') {
        await client.query(
          'UPDATE community_boards SET post_count = post_count + 1 WHERE id = $1',
          [boardId]
        );
      }

      await client.query('COMMIT');
      
      // 返回完整的帖子信息
      return await this.findById(post.id);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 更新帖子
   * @param {number} id - 帖子ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object|null>} 更新后的帖子
   */
  static async update(id, updateData) {
    const allowedFields = [
      'title', 'content', 'content_type', 'summary', 'status', 
      'is_pinned', 'is_featured', 'is_locked'
    ];

    const updates = [];
    const params = [];
    let paramIndex = 1;

    Object.keys(updateData).forEach(key => {
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbField)) {
        updates.push(`${dbField} = $${paramIndex}`);
        params.push(updateData[key]);
        paramIndex++;
      }
    });

    if (updates.length === 0 && !updateData.tags) {
      throw new Error('没有有效的更新字段');
    }

    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');

      // 更新帖子基本信息
      if (updates.length > 0) {
        // 如果状态变为已发布，设置发布时间
        if (updateData.status === 'published') {
          updates.push(`published_at = $${paramIndex}`);
          params.push(new Date());
          paramIndex++;
        }

        params.push(id);
        const sql = `
          UPDATE community_posts 
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `;

        await client.query(sql, params);
      }

      // 更新标签
      if (updateData.tags) {
        await this.updatePostTags(client, id, updateData.tags);
      }

      await client.query('COMMIT');
      
      return await this.findById(id);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 删除帖子
   * @param {number} id - 帖子ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  static async delete(id) {
    const result = await query('DELETE FROM community_posts WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  /**
   * 增加浏览数
   * @param {number} id - 帖子ID
   * @returns {Promise<void>}
   */
  static async incrementViewCount(id) {
    await query(
      'UPDATE community_posts SET view_count = view_count + 1 WHERE id = $1',
      [id]
    );
  }

  /**
   * 搜索帖子
   * @param {string} keyword - 搜索关键词
   * @param {Object} options - 搜索选项
   * @returns {Promise<Object>} 搜索结果
   */
  static async search(keyword, options = {}) {
    const { page = 1, limit = 20, boardId } = options;
    
    // 使用PostgreSQL全文搜索
    let sql = `
      SELECT 
        cp.*,
        u.username as author_username,
        u.nickname as author_nickname,
        u.avatar_url as author_avatar,
        cb.display_name as board_display_name,
        ts_rank(to_tsvector('english', cp.title || ' ' || cp.content), plainto_tsquery('english', $1)) as rank
      FROM community_posts cp
      JOIN users u ON cp.author_id = u.id
      JOIN community_boards cb ON cp.board_id = cb.id
      WHERE cp.status = 'published'
        AND to_tsvector('english', cp.title || ' ' || cp.content) @@ plainto_tsquery('english', $1)
    `;

    const params = [keyword];
    let paramIndex = 2;

    if (boardId) {
      sql += ` AND cp.board_id = $${paramIndex}`;
      params.push(boardId);
      paramIndex++;
    }

    sql += ' ORDER BY rank DESC, cp.created_at DESC';
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const result = await query(sql, params);
    return {
      data: result.rows,
      pagination: { page, limit }
    };
  }

  /**
   * 更新帖子标签
   * @param {Object} client - 数据库客户端
   * @param {number} postId - 帖子ID
   * @param {Array} tagNames - 标签名称数组
   * @returns {Promise<void>}
   */
  static async updatePostTags(client, postId, tagNames) {
    // 删除现有标签关联
    await client.query('DELETE FROM community_post_tags WHERE post_id = $1', [postId]);

    if (tagNames.length === 0) return;

    // 获取或创建标签
    const tagIds = [];
    for (const tagName of tagNames) {
      let tagResult = await client.query('SELECT id FROM tags WHERE name = $1', [tagName]);
      
      if (tagResult.rows.length === 0) {
        // 创建新标签
        const newTagResult = await client.query(
          'INSERT INTO tags (name, display_name) VALUES ($1, $1) RETURNING id',
          [tagName]
        );
        tagIds.push(newTagResult.rows[0].id);
      } else {
        tagIds.push(tagResult.rows[0].id);
      }
    }

    // 创建新的标签关联
    for (const tagId of tagIds) {
      await client.query(
        'INSERT INTO community_post_tags (post_id, tag_id) VALUES ($1, $2)',
        [postId, tagId]
      );
    }
  }

  /**
   * 获取用户的帖子统计
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 用户帖子统计
   */
  static async getUserStats(userId) {
    const sql = `
      SELECT 
        COUNT(*) as total_posts,
        COUNT(*) FILTER (WHERE status = 'published') as published_posts,
        COUNT(*) FILTER (WHERE is_pinned = true) as pinned_posts,
        COUNT(*) FILTER (WHERE is_featured = true) as featured_posts,
        SUM(view_count) as total_views,
        SUM(reply_count) as total_replies,
        SUM(like_count) as total_likes,
        MAX(created_at) as latest_post_time
      FROM community_posts 
      WHERE author_id = $1
    `;

    const result = await query(sql, [userId]);
    return result.rows[0];
  }

  /**
   * 获取热门帖子
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 热门帖子列表
   */
  static async getHotPosts(options = {}) {
    const { limit = 10, boardId, days = 7 } = options;
    
    let sql = `
      SELECT 
        cp.*,
        u.username as author_username,
        u.nickname as author_nickname,
        cb.display_name as board_display_name,
        (cp.view_count * 0.3 + cp.reply_count * 0.4 + cp.like_count * 0.3) as hot_score
      FROM community_posts cp
      JOIN users u ON cp.author_id = u.id
      JOIN community_boards cb ON cp.board_id = cb.id
      WHERE cp.status = 'published' 
        AND cp.created_at >= NOW() - INTERVAL '${days} days'
    `;

    const params = [];
    if (boardId) {
      sql += ' AND cp.board_id = $1';
      params.push(boardId);
    }

    sql += ' ORDER BY hot_score DESC, cp.created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await query(sql, params);
    return result.rows;
  }
}

module.exports = CommunityPost;
