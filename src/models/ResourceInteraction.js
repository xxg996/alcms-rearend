/**
 * 资源互动功能数据模型
 * 处理资源点赞、收藏等互动功能
 */

const { query, getClient } = require('../config/database');
const NotificationService = require('../services/NotificationService');

class ResourceInteraction {
  /**
   * 资源点赞或取消点赞
   * @param {number} userId - 用户ID
   * @param {number} resourceId - 资源ID
   * @returns {Promise<Object>} 操作结果
   */
  static async toggleLike(userId, resourceId) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // 检查是否已经点赞
      const existingLike = await client.query(
        'SELECT id FROM resource_likes WHERE user_id = $1 AND resource_id = $2',
        [userId, resourceId]
      );

      let isLiked = false;
      let likeCount = 0;

      if (existingLike.rows.length > 0) {
        // 取消点赞
        await client.query(
          'DELETE FROM resource_likes WHERE user_id = $1 AND resource_id = $2',
          [userId, resourceId]
        );
        isLiked = false;
      } else {
        // 添加点赞
        await client.query(
          'INSERT INTO resource_likes (user_id, resource_id) VALUES ($1, $2)',
          [userId, resourceId]
        );
        isLiked = true;
      }

      // 获取最新点赞数
      const countResult = await client.query(
        'SELECT like_count FROM resources WHERE id = $1',
        [resourceId]
      );
      likeCount = parseInt(countResult.rows[0]?.like_count || 0);

      await client.query('COMMIT');

      // 异步创建点赞通知（只在点赞时创建，取消点赞不通知）
      if (isLiked) {
        setImmediate(async () => {
          try {
            // 获取资源信息
            const resourceResult = await query(
              'SELECT title, author_id FROM resources WHERE id = $1',
              [resourceId]
            );

            if (resourceResult.rows.length > 0) {
              const resource = resourceResult.rows[0];

              // 获取点赞者信息
              if (resource.author_id && resource.author_id !== userId) {
                const likerResult = await query(
                  'SELECT username, nickname FROM users WHERE id = $1',
                  [userId]
                );
                const likerInfo = likerResult.rows[0];

                if (likerInfo) {
                  await NotificationService.createLikeNotification({
                    targetType: 'post', // 在通知服务中，资源被视为post类型
                    targetId: resourceId,
                    targetTitle: resource.title,
                    targetAuthorId: resource.author_id,
                    likerId: userId,
                    likerName: likerInfo.nickname || likerInfo.username,
                    category: 'resource'
                  });
                }
              }
            }
          } catch (error) {
            console.error('创建资源点赞通知失败:', error);
          }
        });
      }

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
   * 获取用户是否点赞了指定资源
   * @param {number} userId - 用户ID
   * @param {number} resourceId - 资源ID
   * @returns {Promise<boolean>} 是否已点赞
   */
  static async isLiked(userId, resourceId) {
    if (!userId) return false;

    const result = await query(
      'SELECT id FROM resource_likes WHERE user_id = $1 AND resource_id = $2',
      [userId, resourceId]
    );

    return result.rows.length > 0;
  }

  /**
   * 批量检查用户对多个资源的点赞状态
   * @param {number} userId - 用户ID
   * @param {Array<number>} resourceIds - 资源ID数组
   * @returns {Promise<Object>} 点赞状态映射 {resourceId: boolean}
   */
  static async batchCheckLiked(userId, resourceIds) {
    if (!userId || !resourceIds.length) return {};

    const result = await query(
      'SELECT resource_id FROM resource_likes WHERE user_id = $1 AND resource_id = ANY($2)',
      [userId, resourceIds]
    );

    const likedMap = {};
    resourceIds.forEach(id => {
      likedMap[id] = false;
    });

    result.rows.forEach(row => {
      likedMap[row.resource_id] = true;
    });

    return likedMap;
  }

  /**
   * 获取资源的点赞列表
   * @param {number} resourceId - 资源ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 分页结果
   */
  static async getResourceLikes(resourceId, options = {}) {
    const {
      page = 1,
      limit = 20
    } = options;

    const offset = (page - 1) * limit;

    // 获取总数
    const countResult = await query(
      'SELECT COUNT(*) as total FROM resource_likes WHERE resource_id = $1',
      [resourceId]
    );
    const total = parseInt(countResult.rows[0].total);

    // 获取点赞用户列表
    const likesResult = await query(`
      SELECT
        rl.id,
        rl.created_at,
        u.id as user_id,
        u.username,
        u.nickname,
        u.avatar_url
      FROM resource_likes rl
      JOIN users u ON rl.user_id = u.id
      WHERE rl.resource_id = $1
      ORDER BY rl.created_at DESC
      LIMIT $2 OFFSET $3
    `, [resourceId, limit, offset]);

    return {
      data: likesResult.rows,
      pagination: {
        total,
        limit,
        page,
        totalPages: Math.ceil(total / limit) || 0,
        hasNext: offset + limit < total,
        hasPrev: offset > 0
      }
    };
  }

  /**
   * 获取用户的点赞统计
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 统计信息
   */
  static async getUserLikeStats(userId) {
    const result = await query(`
      SELECT
        COUNT(*) as total_likes,
        MAX(created_at) as latest_like_time
      FROM resource_likes
      WHERE user_id = $1
    `, [userId]);

    return result.rows[0] || { total_likes: 0, latest_like_time: null };
  }

  /**
   * 获取资源的热门点赞者（用于显示）
   * @param {number} resourceId - 资源ID
   * @param {number} limit - 限制数量
   * @returns {Promise<Array>} 点赞者列表
   */
  static async getTopLikers(resourceId, limit = 5) {
    const result = await query(`
      SELECT
        u.id,
        u.username,
        u.nickname,
        u.avatar_url,
        rl.created_at
      FROM resource_likes rl
      JOIN users u ON rl.user_id = u.id
      WHERE rl.resource_id = $1
      ORDER BY rl.created_at DESC
      LIMIT $2
    `, [resourceId, limit]);

    return result.rows;
  }
}

module.exports = ResourceInteraction;