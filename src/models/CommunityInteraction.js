/**
 * 社区互动功能数据模型
 * 处理点赞、收藏、分享、举报等互动功能
 */

const { query } = require('../config/database');

class CommunityInteraction {
  /**
   * 点赞或取消点赞
   * @param {number} userId - 用户ID
   * @param {string} targetType - 目标类型 (post, comment)
   * @param {number} targetId - 目标ID
   * @returns {Promise<Object>} 操作结果
   */
  static async toggleLike(userId, targetType, targetId) {
    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');

      // 检查是否已经点赞
      const existingLike = await client.query(
        'SELECT id FROM community_likes WHERE user_id = $1 AND target_type = $2 AND target_id = $3',
        [userId, targetType, targetId]
      );

      let isLiked = false;
      let likeCount = 0;

      if (existingLike.rows.length > 0) {
        // 取消点赞
        await client.query(
          'DELETE FROM community_likes WHERE user_id = $1 AND target_type = $2 AND target_id = $3',
          [userId, targetType, targetId]
        );
        isLiked = false;
      } else {
        // 添加点赞
        await client.query(
          'INSERT INTO community_likes (user_id, target_type, target_id) VALUES ($1, $2, $3)',
          [userId, targetType, targetId]
        );
        isLiked = true;
      }

      // 获取最新点赞数
      const countResult = await client.query(
        'SELECT COUNT(*) as count FROM community_likes WHERE target_type = $1 AND target_id = $2',
        [targetType, targetId]
      );
      likeCount = parseInt(countResult.rows[0].count);

      await client.query('COMMIT');

      return {
        isLiked,
        likeCount,
        action: isLiked ? 'liked' : 'unliked'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 收藏或取消收藏帖子
   * @param {number} userId - 用户ID
   * @param {number} postId - 帖子ID
   * @returns {Promise<Object>} 操作结果
   */
  static async toggleFavorite(userId, postId) {
    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');

      // 检查是否已经收藏
      const existingFavorite = await client.query(
        'SELECT id FROM community_favorites WHERE user_id = $1 AND post_id = $2',
        [userId, postId]
      );

      let isFavorited = false;
      let favoriteCount = 0;

      if (existingFavorite.rows.length > 0) {
        // 取消收藏
        await client.query(
          'DELETE FROM community_favorites WHERE user_id = $1 AND post_id = $2',
          [userId, postId]
        );
        isFavorited = false;
      } else {
        // 添加收藏
        await client.query(
          'INSERT INTO community_favorites (user_id, post_id) VALUES ($1, $2)',
          [userId, postId]
        );
        isFavorited = true;
      }

      // 获取最新收藏数
      const countResult = await client.query(
        'SELECT COUNT(*) as count FROM community_favorites WHERE post_id = $1',
        [postId]
      );
      favoriteCount = parseInt(countResult.rows[0].count);

      await client.query('COMMIT');

      return {
        isFavorited,
        favoriteCount,
        action: isFavorited ? 'favorited' : 'unfavorited'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 分享帖子
   * @param {number} userId - 用户ID
   * @param {number} postId - 帖子ID
   * @param {string} platform - 分享平台
   * @returns {Promise<Object>} 分享结果
   */
  static async sharePost(userId, postId, platform = 'link') {
    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');

      // 记录分享
      await client.query(
        'INSERT INTO community_shares (user_id, post_id, share_platform) VALUES ($1, $2, $3)',
        [userId, postId, platform]
      );

      // 更新帖子分享数
      await client.query(
        'UPDATE community_posts SET share_count = share_count + 1 WHERE id = $1',
        [postId]
      );

      // 获取最新分享数
      const countResult = await client.query(
        'SELECT share_count FROM community_posts WHERE id = $1',
        [postId]
      );

      await client.query('COMMIT');

      return {
        shareCount: countResult.rows[0].share_count,
        platform,
        sharedAt: new Date()
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 举报内容
   * @param {Object} reportData - 举报数据
   * @returns {Promise<Object>} 举报结果
   */
  static async reportContent(reportData) {
    const {
      reporterId,
      targetType,
      targetId,
      reason,
      description
    } = reportData;

    // 检查是否已经举报过
    const existingReport = await query(
      'SELECT id FROM community_reports WHERE reporter_id = $1 AND target_type = $2 AND target_id = $3',
      [reporterId, targetType, targetId]
    );

    if (existingReport.rows.length > 0) {
      throw new Error('您已经举报过该内容');
    }

    // 创建举报记录
    const sql = `
      INSERT INTO community_reports (reporter_id, target_type, target_id, reason, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await query(sql, [reporterId, targetType, targetId, reason, description]);
    return result.rows[0];
  }

  /**
   * 获取用户的点赞列表
   * @param {number} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 分页结果
   */
  static async getUserLikes(userId, options = {}) {
    const { page = 1, limit = 20, targetType } = options;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT 
        cl.*,
        CASE 
          WHEN cl.target_type = 'post' THEN 
            json_build_object(
              'id', cp.id,
              'title', cp.title,
              'author_username', u.username,
              'board_name', cb.display_name
            )
          WHEN cl.target_type = 'comment' THEN
            json_build_object(
              'id', cc.id,
              'content', LEFT(cc.content, 100),
              'post_title', cp2.title,
              'author_username', u2.username
            )
        END as target_info
      FROM community_likes cl
      LEFT JOIN community_posts cp ON cl.target_type = 'post' AND cl.target_id = cp.id
      LEFT JOIN users u ON cp.author_id = u.id
      LEFT JOIN community_boards cb ON cp.board_id = cb.id
      LEFT JOIN community_comments cc ON cl.target_type = 'comment' AND cl.target_id = cc.id
      LEFT JOIN community_posts cp2 ON cc.post_id = cp2.id
      LEFT JOIN users u2 ON cc.author_id = u2.id
      WHERE cl.user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (targetType) {
      sql += ` AND cl.target_type = $${paramIndex}`;
      params.push(targetType);
      paramIndex++;
    }

    sql += ` ORDER BY cl.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const countSql = `
      SELECT COUNT(*) as total FROM community_likes 
      WHERE user_id = $1 ${targetType ? 'AND target_type = $2' : ''}
    `;
    
    const countParams = targetType ? [userId, targetType] : [userId];

    const [dataResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
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
   * 获取用户的收藏列表
   * @param {number} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 分页结果
   */
  static async getUserFavorites(userId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const sql = `
      SELECT 
        cf.*,
        cp.id as post_id,
        cp.title,
        cp.summary,
        cp.view_count,
        cp.like_count,
        cp.reply_count,
        u.username as author_username,
        u.nickname as author_nickname,
        cb.display_name as board_display_name
      FROM community_favorites cf
      JOIN community_posts cp ON cf.post_id = cp.id
      JOIN users u ON cp.author_id = u.id
      JOIN community_boards cb ON cp.board_id = cb.id
      WHERE cf.user_id = $1 AND cp.status = 'published'
      ORDER BY cf.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM community_favorites cf
      JOIN community_posts cp ON cf.post_id = cp.id
      WHERE cf.user_id = $1 AND cp.status = 'published'
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
   * 获取举报列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 分页结果
   */
  static async getReports(options = {}) {
    const { 
      page = 1, 
      limit = 20, 
      status = 'pending',
      targetType,
      reason 
    } = options;
    
    const offset = (page - 1) * limit;

    let sql = `
      SELECT 
        cr.*,
        ru.username as reporter_username,
        ru.nickname as reporter_nickname,
        hu.username as handler_username,
        hu.nickname as handler_nickname,
        CASE 
          WHEN cr.target_type = 'post' THEN 
            json_build_object(
              'id', cp.id,
              'title', cp.title,
              'author_username', pu.username
            )
          WHEN cr.target_type = 'comment' THEN
            json_build_object(
              'id', cc.id,
              'content', LEFT(cc.content, 100),
              'author_username', cu.username
            )
          WHEN cr.target_type = 'user' THEN
            json_build_object(
              'id', tu.id,
              'username', tu.username,
              'nickname', tu.nickname
            )
        END as target_info
      FROM community_reports cr
      JOIN users ru ON cr.reporter_id = ru.id
      LEFT JOIN users hu ON cr.handler_id = hu.id
      LEFT JOIN community_posts cp ON cr.target_type = 'post' AND cr.target_id = cp.id
      LEFT JOIN users pu ON cp.author_id = pu.id
      LEFT JOIN community_comments cc ON cr.target_type = 'comment' AND cr.target_id = cc.id
      LEFT JOIN users cu ON cc.author_id = cu.id
      LEFT JOIN users tu ON cr.target_type = 'user' AND cr.target_id = tu.id
    `;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`cr.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (targetType) {
      conditions.push(`cr.target_type = $${paramIndex}`);
      params.push(targetType);
      paramIndex++;
    }

    if (reason) {
      conditions.push(`cr.reason = $${paramIndex}`);
      params.push(reason);
      paramIndex++;
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ` ORDER BY cr.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    // 构建计数查询
    let countSql = 'SELECT COUNT(*) as total FROM community_reports cr';
    if (conditions.length > 0) {
      countSql += ' WHERE ' + conditions.join(' AND ');
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
   * 处理举报
   * @param {number} reportId - 举报ID
   * @param {Object} handleData - 处理数据
   * @returns {Promise<Object>} 处理结果
   */
  static async handleReport(reportId, handleData) {
    const { handlerId, status, handlerNote } = handleData;

    const sql = `
      UPDATE community_reports 
      SET status = $1, handler_id = $2, handler_note = $3, handled_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;

    const result = await query(sql, [status, handlerId, handlerNote, reportId]);
    return result.rows[0];
  }

  /**
   * 获取用户互动统计
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 用户互动统计
   */
  static async getUserInteractionStats(userId) {
    const sql = `
      SELECT 
        (SELECT COUNT(*) FROM community_likes WHERE user_id = $1) as likes_given,
        (SELECT COUNT(*) FROM community_favorites WHERE user_id = $1) as favorites_count,
        (SELECT COUNT(*) FROM community_shares WHERE user_id = $1) as shares_count,
        (SELECT COUNT(*) FROM community_reports WHERE reporter_id = $1) as reports_made,
        (SELECT SUM(cp.like_count) FROM community_posts cp WHERE cp.author_id = $1) as post_likes_received,
        (SELECT SUM(cc.like_count) FROM community_comments cc WHERE cc.author_id = $1) as comment_likes_received
    `;

    const result = await query(sql, [userId]);
    const stats = result.rows[0];

    // 处理NULL值
    Object.keys(stats).forEach(key => {
      if (stats[key] === null) {
        stats[key] = 0;
      } else {
        stats[key] = parseInt(stats[key]);
      }
    });

    return stats;
  }

  /**
   * 检查用户是否点赞了目标
   * @param {number} userId - 用户ID
   * @param {string} targetType - 目标类型
   * @param {number} targetId - 目标ID
   * @returns {Promise<boolean>} 是否点赞
   */
  static async isLiked(userId, targetType, targetId) {
    const result = await query(
      'SELECT id FROM community_likes WHERE user_id = $1 AND target_type = $2 AND target_id = $3',
      [userId, targetType, targetId]
    );
    return result.rows.length > 0;
  }

  /**
   * 检查用户是否收藏了帖子
   * @param {number} userId - 用户ID
   * @param {number} postId - 帖子ID
   * @returns {Promise<boolean>} 是否收藏
   */
  static async isFavorited(userId, postId) {
    const result = await query(
      'SELECT id FROM community_favorites WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );
    return result.rows.length > 0;
  }
}

module.exports = CommunityInteraction;
