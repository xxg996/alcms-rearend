/**
 * 社区评论数据模型
 * 处理评论的CRUD操作，支持楼中楼结构
 */

const { query } = require('../config/database');
const NotificationService = require('../services/NotificationService');

class CommunityComment {
  /**
   * 获取帖子的评论列表
   * @param {number} postId - 帖子ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 分页结果
   */
  static async findByPostId(postId, options = {}) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'ASC',
      userId
    } = options;

    const offset = (page - 1) * limit;

    // 构建主评论查询（parent_id为NULL的评论）
    let sql = `
      WITH RECURSIVE comment_tree AS (
        -- 获取主评论
        SELECT 
          cc.*,
          u.username as author_username,
          u.nickname as author_nickname,
          u.avatar_url as author_avatar,
          ru.username as reply_to_username,
          ru.nickname as reply_to_nickname,
          0 as level,
          cc.floor_number as sort_floor
          ${userId ? `,
          (SELECT COUNT(*) > 0 FROM community_likes cl 
           WHERE cl.user_id = $4 AND cl.target_type = 'comment' AND cl.target_id = cc.id) as is_liked
          ` : ''}
        FROM community_comments cc
        JOIN users u ON cc.author_id = u.id
        LEFT JOIN users ru ON cc.reply_to_user_id = ru.id
        WHERE cc.post_id = $1 AND cc.parent_id IS NULL AND cc.deleted_at IS NULL
        
        UNION ALL
        
        -- 递归获取子评论
        SELECT 
          child.*,
          cu.username as author_username,
          cu.nickname as author_nickname,
          cu.avatar_url as author_avatar,
          cru.username as reply_to_username,
          cru.nickname as reply_to_nickname,
          parent.level + 1,
          parent.sort_floor
          ${userId ? `,
          (SELECT COUNT(*) > 0 FROM community_likes cl 
           WHERE cl.user_id = $4 AND cl.target_type = 'comment' AND cl.target_id = child.id) as is_liked
          ` : ''}
        FROM community_comments child
        JOIN comment_tree parent ON child.parent_id = parent.id
        JOIN users cu ON child.author_id = cu.id
        LEFT JOIN users cru ON child.reply_to_user_id = cru.id
        WHERE child.deleted_at IS NULL
      )
      SELECT * FROM comment_tree
    `;

    // 排序
    const allowedSortFields = {
      'created_at': 'created_at',
      'like_count': 'like_count',
      'floor_number': 'floor_number'
    };

    const sortField = allowedSortFields[sortBy] || 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    sql += ` ORDER BY sort_floor ${order}, level ASC, ${sortField} ${order}`;

    // 分页
    sql += ` LIMIT $2 OFFSET $3`;

    const params = userId ? [postId, limit, offset, userId] : [postId, limit, offset];

    // 获取总评论数
    const countSql = `
      SELECT COUNT(*) as total
      FROM community_comments 
      WHERE post_id = $1 AND deleted_at IS NULL
    `;

    const [dataResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, [postId])
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    // 构建树形结构
    const comments = this.buildCommentTree(dataResult.rows);

    return {
      data: comments,
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
   * 根据ID获取评论详情
   * @param {number} id - 评论ID
   * @param {number} userId - 当前用户ID
   * @returns {Promise<Object|null>} 评论详情
   */
  static async findById(id, userId = null) {
    let sql = `
      SELECT 
        cc.*,
        u.username as author_username,
        u.nickname as author_nickname,
        u.avatar_url as author_avatar,
        ru.username as reply_to_username,
        ru.nickname as reply_to_nickname,
        cp.title as post_title
        ${userId ? `,
        (SELECT COUNT(*) > 0 FROM community_likes cl 
         WHERE cl.user_id = $2 AND cl.target_type = 'comment' AND cl.target_id = cc.id) as is_liked
        ` : ''}
      FROM community_comments cc
      JOIN users u ON cc.author_id = u.id
      LEFT JOIN users ru ON cc.reply_to_user_id = ru.id
      JOIN community_posts cp ON cc.post_id = cp.id
      WHERE cc.id = $1 AND cc.deleted_at IS NULL
    `;

    const params = userId ? [id, userId] : [id];
    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * 创建新评论
   * @param {Object} commentData - 评论数据
   * @returns {Promise<Object>} 创建的评论
   */
  static async create(commentData) {
    const {
      content,
      authorId,
      postId,
      parentId = null,
      replyToUserId = null
    } = commentData;

    // 开始事务
    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');

      // 获取楼层号
      let floorNumber = 1;
      if (!parentId) {
        // 主评论，计算楼层号
        const floorResult = await client.query(
          'SELECT COALESCE(MAX(floor_number), 0) + 1 as next_floor FROM community_comments WHERE post_id = $1 AND parent_id IS NULL',
          [postId]
        );
        floorNumber = floorResult.rows[0].next_floor;
      } else {
        // 子评论，使用父评论的楼层号
        const parentResult = await client.query(
          'SELECT floor_number FROM community_comments WHERE id = $1',
          [parentId]
        );
        if (parentResult.rows.length === 0) {
          throw new Error('父评论不存在');
        }
        floorNumber = parentResult.rows[0].floor_number;
      }

      // 创建评论
      const sql = `
        INSERT INTO community_comments (
          content, author_id, post_id, parent_id, reply_to_user_id, floor_number
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const params = [content, authorId, postId, parentId, replyToUserId, floorNumber];
      const result = await client.query(sql, params);
      const comment = result.rows[0];

      // 更新帖子回复数和最后回复信息
      await client.query(`
        UPDATE community_posts 
        SET reply_count = reply_count + 1,
            last_reply_id = $1,
            last_reply_time = $2,
            last_reply_user_id = $3
        WHERE id = $4
      `, [comment.id, comment.created_at, authorId, postId]);

      // 更新板块最后帖子时间
      await client.query(`
        UPDATE community_boards 
        SET last_post_time = $1
        WHERE id = (SELECT board_id FROM community_posts WHERE id = $2)
      `, [comment.created_at, postId]);

      await client.query('COMMIT');

      // 异步创建通知，不阻塞主流程
      setImmediate(async () => {
        try {
          // 获取帖子信息和作者信息
          const postInfoResult = await query(
            'SELECT cp.title, cp.author_id, u.username, u.nickname FROM community_posts cp LEFT JOIN users u ON cp.author_id = u.id WHERE cp.id = $1',
            [postId]
          );
          const postInfo = postInfoResult.rows[0];

          // 获取评论者信息
          const commenterResult = await query(
            'SELECT username, nickname FROM users WHERE id = $1',
            [authorId]
          );
          const commenterInfo = commenterResult.rows[0];

          if (postInfo && commenterInfo) {
            if (parentId) {
              // 这是回复评论，通知原评论者或被回复的用户
              const targetUserId = replyToUserId || (await query(
                'SELECT author_id FROM community_comments WHERE id = $1',
                [parentId]
              )).rows[0]?.author_id;

              if (targetUserId && targetUserId !== authorId) {
                await NotificationService.createCommunityReplyNotification({
                  originalCommentId: parentId,
                  originalCommenterId: targetUserId,
                  replierId: authorId,
                  replierName: commenterInfo.nickname || commenterInfo.username,
                  replyContent: content,
                  postTitle: postInfo.title,
                  commentId: comment.id
                });
              }
            } else {
              // 这是新评论，通知帖子作者
              if (postInfo.author_id && postInfo.author_id !== authorId) {
                await NotificationService.createCommunityCommentNotification({
                  postId: postId,
                  postTitle: postInfo.title,
                  authorId: postInfo.author_id,
                  commenterId: authorId,
                  commenterName: commenterInfo.nickname || commenterInfo.username,
                  commentContent: content,
                  commentId: comment.id
                });
              }
            }
          }
        } catch (error) {
          console.error('创建社区评论通知失败:', error);
        }
      });

      // 返回完整的评论信息
      return await this.findById(comment.id, authorId);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 更新评论
   * @param {number} id - 评论ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object|null>} 更新后的评论
   */
  static async update(id, updateData) {
    const allowedFields = ['content'];

    const updates = [];
    const params = [];
    let paramIndex = 1;

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramIndex}`);
        params.push(updateData[key]);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      throw new Error('没有有效的更新字段');
    }

    params.push(id);
    const sql = `
      UPDATE community_comments 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * 删除评论（软删除）
   * @param {number} id - 评论ID
   * @param {string} reason - 删除原因
   * @param {number} deletedBy - 删除操作者ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  static async delete(id, reason = null, deletedBy = null) {
    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');

      // 获取评论信息
      const commentResult = await client.query(
        'SELECT post_id, parent_id FROM community_comments WHERE id = $1',
        [id]
      );

      if (commentResult.rows.length === 0) {
        throw new Error('评论不存在');
      }

      const { post_id, parent_id } = commentResult.rows[0];

      // 软删除评论
      await client.query(`
        UPDATE community_comments 
        SET deleted_at = CURRENT_TIMESTAMP,
            deleted_by = $2
        WHERE id = $3
      `, [reason, deletedBy, id]);

      // 递归删除子评论
      await client.query(`
        WITH RECURSIVE child_comments AS (
          SELECT id FROM community_comments WHERE parent_id = $1
          UNION ALL
          SELECT cc.id FROM community_comments cc
          JOIN child_comments ch ON cc.parent_id = ch.id
        )
        UPDATE community_comments 
        SET deleted_at = CURRENT_TIMESTAMP,
            deleted_by = $3
        WHERE id IN (SELECT id FROM child_comments)
      `, [id, reason, deletedBy]);

      // 更新帖子回复数
      const replyCountResult = await client.query(
        'SELECT COUNT(*) as count FROM community_comments WHERE post_id = $1 AND deleted_at IS NULL',
        [post_id]
      );

      await client.query(
        'UPDATE community_posts SET reply_count = $1 WHERE id = $2',
        [replyCountResult.rows[0].count, post_id]
      );

      await client.query('COMMIT');
      return true;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取用户的评论列表
   * @param {number} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 分页结果
   */
  static async findByUserId(userId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const sql = `
      SELECT 
        cc.*,
        cp.title as post_title,
        cp.id as post_id,
        cb.display_name as board_display_name
      FROM community_comments cc
      JOIN community_posts cp ON cc.post_id = cp.id
      JOIN community_boards cb ON cp.board_id = cb.id
      WHERE cc.author_id = $1 AND cc.deleted_at IS NULL
      ORDER BY cc.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM community_comments cc
      JOIN community_posts cp ON cc.post_id = cp.id
      WHERE cc.author_id = $1 AND cc.deleted_at IS NULL
    `;

    const [dataResult, countResult] = await Promise.all([
      query(sql, [userId, limit, offset]),
      query(countSql, [userId])
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
   * 获取评论的子评论数量
   * @param {number} commentId - 评论ID
   * @returns {Promise<number>} 子评论数量
   */
  static async getChildrenCount(commentId) {
    const sql = `
      WITH RECURSIVE child_comments AS (
        SELECT id FROM community_comments WHERE parent_id = $1 AND deleted_at IS NULL
        UNION ALL
        SELECT cc.id FROM community_comments cc
        JOIN child_comments ch ON cc.parent_id = ch.id
        WHERE cc.deleted_at IS NULL
      )
      SELECT COUNT(*) as count FROM child_comments
    `;

    const result = await query(sql, [commentId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * 构建评论树形结构
   * @param {Array} comments - 扁平评论数组
   * @returns {Array} 树形结构评论数组
   */
  static buildCommentTree(comments) {
    const commentMap = new Map();
    const rootComments = [];

    // 创建评论映射
    comments.forEach(comment => {
      comment.children = [];
      commentMap.set(comment.id, comment);
    });

    // 构建树形结构
    comments.forEach(comment => {
      if (comment.parent_id === null) {
        rootComments.push(comment);
      } else {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.children.push(comment);
        }
      }
    });

    return rootComments;
  }

  /**
   * 获取热门评论
   * @param {number} postId - 帖子ID
   * @param {number} limit - 限制数量
   * @returns {Promise<Array>} 热门评论列表
   */
  static async getHotComments(postId, limit = 5) {
    const sql = `
      SELECT 
        cc.*,
        u.username as author_username,
        u.nickname as author_nickname,
        u.avatar_url as author_avatar
      FROM community_comments cc
      JOIN users u ON cc.author_id = u.id
      WHERE cc.post_id = $1 AND cc.deleted_at IS NULL AND cc.parent_id IS NULL
      ORDER BY cc.like_count DESC, cc.created_at DESC
      LIMIT $2
    `;

    const result = await query(sql, [postId, limit]);
    return result.rows;
  }

  /**
   * 获取用户的评论统计
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 用户评论统计
   */
  static async getUserStats(userId) {
    const sql = `
      SELECT 
        COUNT(*) as total_comments,
        SUM(like_count) as total_likes,
        MAX(created_at) as latest_comment_time,
        COUNT(DISTINCT post_id) as commented_posts
      FROM community_comments 
      WHERE author_id = $1 AND deleted_at IS NULL
    `;

    const result = await query(sql, [userId]);
    return result.rows[0];
  }
}

module.exports = CommunityComment;
