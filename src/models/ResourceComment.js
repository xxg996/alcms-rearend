/**
 * 资源评论数据模型
 * 处理资源评论的增删改查和层级管理
 */

const { query, getClient } = require('../config/database');
const NotificationService = require('../services/NotificationService');

class ResourceComment {
  /**
   * 创建评论
   * @param {Object} commentData - 评论数据
   * @param {number} commentData.resource_id - 资源ID
   * @param {number} commentData.user_id - 用户ID
   * @param {string} commentData.content - 评论内容
   * @param {number|null} commentData.parent_id - 父评论ID（可选）
   * @returns {Promise<Object>} 创建的评论信息
   */
  static async createComment(commentData) {
    const {
      resource_id,
      user_id,
      content,
      parent_id = null
    } = commentData;

    // 获取资源信息和作者信息
    let resourceInfo = null;
    const resourceCheck = await query('SELECT COUNT(*) as count FROM resources');
    if (parseInt(resourceCheck.rows[0].count) > 0) {
      const resourceResult = await query(
        'SELECT r.id, r.title, r.author_id, u.username, u.nickname FROM resources r LEFT JOIN users u ON r.author_id = u.id WHERE r.id = $1',
        [resource_id]
      );
      if (resourceResult.rows.length === 0) {
        throw new Error('指定的资源不存在');
      }
      resourceInfo = resourceResult.rows[0];
    }

    // 获取父评论信息（用于回复通知）
    let parentCommentInfo = null;
    if (parent_id) {
      const parentResult = await query(
        'SELECT rc.resource_id, rc.user_id, u.username, u.nickname FROM resource_comments rc LEFT JOIN users u ON rc.user_id = u.id WHERE rc.id = $1',
        [parent_id]
      );

      if (parentResult.rows.length === 0) {
        throw new Error('父评论不存在');
      }

      if (parentResult.rows[0].resource_id !== resource_id) {
        throw new Error('子评论必须与父评论属于同一资源');
      }

      parentCommentInfo = parentResult.rows[0];
    }

    // 获取评论者信息
    const commenterResult = await query(
      'SELECT username, nickname FROM users WHERE id = $1',
      [user_id]
    );
    const commenterInfo = commenterResult.rows[0];

    const queryStr = `
      INSERT INTO resource_comments (resource_id, user_id, content, parent_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await query(queryStr, [resource_id, user_id, content, parent_id]);
    const newComment = result.rows[0];

    return newComment;
  }

  /**
   * 获取资源的评论列表（分页、层级结构）
   * @param {number} resourceId - 资源ID
   * @param {Object} options - 查询选项
   * @param {number} options.limit - 每页数量
   * @param {number} options.offset - 偏移量
   * @param {boolean} options.approved_only - 只显示已审核的评论
   * @returns {Promise<Object>} 评论列表和分页信息
   */
  static async getResourceComments(resourceId, options = {}) {
    const {
      limit = 20,
      offset = 0,
      approved_only = true,
      user_id = null
    } = options;

    const allowedUserId = Number.isFinite(user_id) ? user_id : null;

    let whereConditions = ['rc.resource_id = $1', 'rc.parent_id IS NULL']; // 只获取根评论
    let values = [resourceId];
    let paramCount = 2;

    if (approved_only) {
      if (allowedUserId) {
        whereConditions.push('(rc.is_approved = true OR rc.user_id = $' + paramCount + ')');
        values.push(allowedUserId);
        paramCount++;
      } else {
        whereConditions.push('rc.is_approved = true');
      }
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    const countValues = values.slice();
    if (!approved_only || !allowedUserId) {
      // values already prepared
    }

    const countQueryStr = `
      SELECT COUNT(*) as total
      FROM resource_comments rc
      ${whereClause}
    `;
    const countResult = await query(countQueryStr, values.slice(0, paramCount - 1));
    const total = parseInt(countResult.rows[0].total);

    // 获取根评论
    values.push(limit, offset);
    const queryStr = `
      SELECT
        rc.*,
        u.username,
        u.nickname,
        u.avatar_url
      FROM resource_comments rc
      LEFT JOIN users u ON rc.user_id = u.id
      ${whereClause}
      ORDER BY rc.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const rootResult = await query(queryStr, values);
    const rootRows = rootResult.rows;

    const resourceAuthorResult = await query(
      'SELECT author_id FROM resources WHERE id = $1',
      [resourceId]
    );
    const resourceAuthorId = resourceAuthorResult.rows[0]?.author_id || null;

    const rootComments = rootRows.map(row => ({
      id: row.id,
      resource_id: row.resource_id,
      user_id: row.user_id,
      parent_id: row.parent_id,
      content: row.content,
      is_approved: row.is_approved,
      like_count: row.like_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
      username: row.username,
      nickname: row.nickname,
      avatar_url: row.avatar_url,
      reply_count: 0,
      is_author: resourceAuthorId !== null && row.user_id === resourceAuthorId
    }));

    if (rootComments.length > 0) {
      const rootIds = rootComments.map(comment => comment.id);
      let replyCountWhere = 'WHERE parent_id = ANY($1::int[]) AND resource_id = $2';
      const params = [rootIds, resourceId];
      let paramIndex = 3;

      if (approved_only) {
        if (allowedUserId) {
          replyCountWhere += ` AND (is_approved = true OR user_id = $${paramIndex})`;
          params.push(allowedUserId);
          paramIndex += 1;
        } else {
          replyCountWhere += ' AND is_approved = true';
        }
      }

      const replyCountQuery = `
        SELECT parent_id, COUNT(*) AS reply_count
        FROM resource_comments
        ${replyCountWhere}
        GROUP BY parent_id
      `;

      const countRows = await query(replyCountQuery, params);
      const countMap = new Map();
      countRows.rows.forEach(row => {
        countMap.set(row.parent_id, parseInt(row.reply_count, 10) || 0);
      });

      rootComments.forEach(comment => {
        const count = countMap.get(comment.id) || 0;
        comment.reply_count = count;
      });
    }

    return {
      data: rootComments,
      pagination: {
        total,
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: offset > 0
      }
    };
  }

  /**
   * 获取评论的回复列表
   * @param {number} parentId - 父评论ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 回复列表
   */
  static async getCommentReplies(parentId, options = {}) {
    const {
      limit = 10,
      offset = 0,
      approved_only = true,
      user_id = null
    } = options;

    const allowedUserId = Number.isFinite(user_id) ? user_id : null;

    let whereConditions = ['rc.parent_id = $1'];
    let values = [parentId];
    let paramCount = 2;

    if (approved_only) {
      if (allowedUserId) {
        whereConditions.push('(rc.is_approved = true OR rc.user_id = $' + paramCount + ')');
        values.push(allowedUserId);
        paramCount++;
      } else {
        whereConditions.push('rc.is_approved = true');
      }
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    // 获取回复总数
    const countQueryStr = `
      SELECT COUNT(*) as total
      FROM resource_comments rc
      ${whereClause}
    `;
    const countResult = await query(countQueryStr, values.slice(0, paramCount - 1));
    const total = parseInt(countResult.rows[0].total);

    // 获取回复列表
    values.push(limit, offset);
    const queryStr = `
      SELECT
        rc.*,
        u.username,
        u.nickname,
        u.avatar_url
      FROM resource_comments rc
      LEFT JOIN users u ON rc.user_id = u.id
      ${whereClause}
      ORDER BY rc.created_at ASC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const result = await query(queryStr, values);

    const parentResourceResult = await query(
      'SELECT resource_id FROM resource_comments WHERE id = $1',
      [parentId]
    );
    const parentResourceId = parentResourceResult.rows[0]?.resource_id || null;
    let resourceAuthorId = null;

    if (parentResourceId) {
      const authorResult = await query(
        'SELECT author_id FROM resources WHERE id = $1',
        [parentResourceId]
      );
      resourceAuthorId = authorResult.rows[0]?.author_id || null;
    }

    const replies = result.rows.map(row => ({
      id: row.id,
      resource_id: row.resource_id,
      user_id: row.user_id,
      parent_id: row.parent_id,
      content: row.content,
      is_approved: row.is_approved,
      like_count: row.like_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
      username: row.username,
      nickname: row.nickname,
      avatar_url: row.avatar_url,
      reply_count: 0,
      is_author: resourceAuthorId !== null && row.user_id === resourceAuthorId
    }));

    if (replies.length > 0) {
      const replyIds = replies.map(comment => comment.id);
      let replyCountWhere = 'WHERE parent_id = ANY($1::int[])';
      const params = [replyIds];
      let paramIndex = 2;

      if (approved_only) {
        if (allowedUserId) {
          replyCountWhere += ` AND (is_approved = true OR user_id = $${paramIndex})`;
          params.push(allowedUserId);
          paramIndex += 1;
        } else {
          replyCountWhere += ' AND is_approved = true';
        }
      }

      const replyCountQuery = `
        SELECT parent_id, COUNT(*) AS reply_count
        FROM resource_comments
        ${replyCountWhere}
        GROUP BY parent_id
      `;

      const countRows = await query(replyCountQuery, params);
      const countMap = new Map();
      countRows.rows.forEach(row => {
        countMap.set(row.parent_id, parseInt(row.reply_count, 10) || 0);
      });

      replies.forEach(comment => {
        comment.reply_count = countMap.get(comment.id) || 0;
      });
    }

    return {
      data: replies,
      pagination: {
        total,
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: offset > 0
      }
    };
  }

  /**
   * 根据ID获取评论详情
   * @param {number} commentId - 评论ID
   * @returns {Promise<Object|null>} 评论信息
   */
  static async getCommentById(commentId) {
    const queryStr = `
      SELECT
        rc.*,
        u.username,
        u.nickname,
        u.avatar_url
      FROM resource_comments rc
      LEFT JOIN users u ON rc.user_id = u.id
      WHERE rc.id = $1
    `;

    const result = await query(queryStr, [commentId]);
    return result.rows[0] || null;
  }

  /**
   * 更新评论内容
   * @param {number} commentId - 评论ID
   * @param {number} userId - 用户ID（权限检查）
   * @param {string} content - 新的评论内容
   * @returns {Promise<Object>} 更新后的评论信息
   */
  static async updateComment(commentId, userId, content) {
    const queryStr = `
      UPDATE resource_comments
      SET content = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await query(queryStr, [commentId, userId, content]);
    if (result.rows.length === 0) {
      throw new Error('评论不存在或无权限修改');
    }

    return result.rows[0];
  }

  /**
   * 删除评论
   * @param {number} commentId - 评论ID
   * @param {number} userId - 用户ID（权限检查）
   * @param {boolean} isAdmin - 是否为管理员
   * @returns {Promise<Object>} 删除的评论信息
   */
  static async deleteComment(commentId, userId, isAdmin = false) {
    let whereClause = 'id = $1';
    let values = [commentId];

    if (!isAdmin) {
      whereClause += ' AND user_id = $2';
      values.push(userId);
    }

    const queryStr = `
      DELETE FROM resource_comments
      WHERE ${whereClause}
      RETURNING *
    `;

    const result = await query(queryStr, values);
    if (result.rows.length === 0) {
      throw new Error('评论不存在或无权限删除');
    }

    return result.rows[0];
  }

  /**
   * 审核评论
   * @param {number} commentId - 评论ID
   * @param {boolean} approved - 是否通过审核
   * @returns {Promise<Object>} 更新后的评论信息
   */
  static async approveComment(commentId, approved = true) {
    const existingResult = await query(
      'SELECT * FROM resource_comments WHERE id = $1',
      [commentId]
    );

    if (existingResult.rows.length === 0) {
      throw new Error('评论不存在');
    }

    const existing = existingResult.rows[0];

    const updateResult = await query(
      `UPDATE resource_comments
       SET is_approved = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [commentId, approved]
    );

    const updated = updateResult.rows[0];

    if (approved && existing.is_approved !== true) {
      this.sendApprovalNotification(updated).catch(error => {
        console.error('发送评论审核通过通知失败:', error);
      });
    }

    return updated;
  }

  static async sendApprovalNotification(commentRow) {
    if (!commentRow) {
      return;
    }

    const {
      id,
      resource_id: resourceId,
      user_id: userId,
      parent_id: parentId,
      content
    } = commentRow;

    try {
      const [resourceResult, commenterResult] = await Promise.all([
        query('SELECT id, title, author_id FROM resources WHERE id = $1', [resourceId]),
        query('SELECT username, nickname FROM users WHERE id = $1', [userId])
      ]);

      const resourceInfo = resourceResult.rows[0];
      const commenterInfo = commenterResult.rows[0];

      if (!resourceInfo || !commenterInfo) {
        return;
      }

      if (parentId) {
        const parentResult = await query(
          'SELECT user_id FROM resource_comments WHERE id = $1',
          [parentId]
        );
        const parentInfo = parentResult.rows[0];

        if (parentInfo && parentInfo.user_id !== userId) {
          await NotificationService.createResourceReplyNotification({
            originalCommentId: parentId,
            originalCommenterId: parentInfo.user_id,
            replierId: userId,
            replierName: commenterInfo.nickname || commenterInfo.username,
            replyContent: content,
            resourceTitle: resourceInfo.title,
            resourceId: resourceId,
            commentId: id
          });
        }
      } else {
        if (resourceInfo.author_id && resourceInfo.author_id !== userId) {
          await NotificationService.createResourceCommentNotification({
            resourceId,
            resourceTitle: resourceInfo.title,
            authorId: resourceInfo.author_id,
            commenterId: userId,
            commenterName: commenterInfo.nickname || commenterInfo.username,
            commentContent: content,
            resourceId,
            commentId: id
          });
        }
      }
    } catch (error) {
      console.error('评论审核通知发送失败:', error);
    }
  }

  /**
   * 点赞/取消点赞评论
   * @param {number} commentId - 评论ID
   * @param {number} increment - 增量（1为点赞，-1为取消点赞）
   * @returns {Promise<Object>} 更新后的评论信息
   */
  static async updateLikeCount(commentId, increment = 1) {
    const queryStr = `
      UPDATE resource_comments
      SET like_count = GREATEST(0, like_count + $2), updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(queryStr, [commentId, increment]);
    if (result.rows.length === 0) {
      throw new Error('评论不存在');
    }

    return result.rows[0];
  }

  static async likeComment(commentId, userId) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      const commentResult = await client.query(
        'SELECT id FROM resource_comments WHERE id = $1 FOR UPDATE',
        [commentId]
      );

      if (commentResult.rows.length === 0) {
        throw new Error('评论不存在');
      }

      const existingLike = await client.query(
        'SELECT 1 FROM resource_comment_likes WHERE comment_id = $1 AND user_id = $2',
        [commentId, userId]
      );

      if (existingLike.rows.length > 0) {
        const error = new Error('已经点赞该评论');
        error.code = 'ALREADY_LIKED';
        throw error;
      }

      await client.query(
        'INSERT INTO resource_comment_likes (comment_id, user_id) VALUES ($1, $2)',
        [commentId, userId]
      );

      const updatedResult = await client.query(
        `UPDATE resource_comments
         SET like_count = like_count + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, like_count`,
        [commentId]
      );

      await client.query('COMMIT');

      return updatedResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取管理员评论列表
   * 支持按资源与审核状态过滤
   * @param {Object} options - 查询选项
   * @param {number} options.page - 页码
   * @param {number} options.limit - 每页数量
   * @param {number|null} options.resourceId - 资源ID过滤
   * @param {string} options.approved - 审核状态过滤
   * @returns {Promise<Object>} 评论列表与分页信息
   */
  static async getAdminComments(options = {}) {
    const {
      page = 1,
      limit = 20,
      resourceId = null,
      approved = 'all'
    } = options;

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (safePage - 1) * safeLimit;

    const conditions = [];
    const values = [];

    if (resourceId !== null && !Number.isNaN(resourceId)) {
      conditions.push(`rc.resource_id = $${values.length + 1}`);
      values.push(resourceId);
    }

    if (approved === 'pending') {
      conditions.push('(rc.is_approved IS NULL OR rc.is_approved = false)');
    } else if (approved === 'approved') {
      conditions.push('rc.is_approved = true');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQueryStr = `
      SELECT COUNT(*) AS total
      FROM resource_comments rc
      ${whereClause}
    `;

    const countResult = await query(countQueryStr, values);
    const total = parseInt(countResult.rows[0].total) || 0;

    const limitParamIndex = values.length + 1;
    const offsetParamIndex = values.length + 2;

    const dataQueryStr = `
      SELECT
        rc.*,
        u.username,
        u.nickname,
        u.avatar_url,
        r.title AS resource_title,
        r.slug AS resource_slug,
        r.cover_image_url AS resource_cover_image_url,
        r.status AS resource_status,
        parent.content AS parent_content,
        parent.user_id AS parent_user_id,
        pu.username AS parent_username,
        pu.nickname AS parent_nickname,
        (SELECT COUNT(*) FROM resource_comments WHERE parent_id = rc.id) AS reply_count
      FROM resource_comments rc
      LEFT JOIN users u ON rc.user_id = u.id
      LEFT JOIN resources r ON rc.resource_id = r.id
      LEFT JOIN resource_comments parent ON rc.parent_id = parent.id
      LEFT JOIN users pu ON parent.user_id = pu.id
      ${whereClause}
      ORDER BY rc.created_at DESC
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `;

    const dataValues = [...values, safeLimit, offset];
    const result = await query(dataQueryStr, dataValues);

    return {
      data: result.rows,
      pagination: {
        total,
        limit: safeLimit,
        offset,
        page: safePage,
        totalPages: Math.ceil(total / safeLimit) || 0,
        hasNext: offset + safeLimit < total,
        hasPrev: offset > 0
      }
    };
  }

  /**
   * 获取用户的评论列表
   * @param {number} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 用户评论列表
   */
  static async getUserComments(userId, options = {}) {
    const {
      limit = 20,
      offset = 0
    } = options;

    // 获取总数
    const countQueryStr = `
      SELECT COUNT(*) as total
      FROM resource_comments
      WHERE user_id = $1
    `;
    const countResult = await query(countQueryStr, [userId]);
    const total = parseInt(countResult.rows[0].total);

    // 获取评论列表
    const queryStr = `
      SELECT
        rc.*,
        r.title as resource_title,
        r.slug as resource_slug,
        (CASE WHEN rc.parent_id IS NOT NULL THEN
          (SELECT content FROM resource_comments WHERE id = rc.parent_id LIMIT 1)
        ELSE NULL END) as parent_content
      FROM resource_comments rc
      LEFT JOIN resources r ON rc.resource_id = r.id
      WHERE rc.user_id = $1
      ORDER BY rc.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(queryStr, [userId, limit, offset]);

    return {
      data: result.rows,
      pagination: {
        total,
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: offset > 0
      }
    };
  }

  /**
   * 获取评论统计信息
   * @param {number|null} resourceId - 资源ID（可选，用于获取特定资源的统计）
   * @returns {Promise<Object>} 统计信息
   */
  static async getCommentStatistics(resourceId = null) {
    let whereClause = '';
    let values = [];

    if (resourceId) {
      whereClause = 'WHERE resource_id = $1';
      values.push(resourceId);
    }

    const queryStr = `
      SELECT
        COUNT(*) as total_comments,
        COUNT(CASE WHEN is_approved = true THEN 1 END) as approved_comments,
        COUNT(CASE WHEN is_approved = false THEN 1 END) as pending_comments,
        COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as root_comments,
        COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END) as reply_comments
      FROM resource_comments
      ${whereClause}
    `;

    const result = await query(queryStr, values);
    return result.rows[0];
  }
}

module.exports = ResourceComment;
