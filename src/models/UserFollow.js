/**
 * 用户关注模型
 * 处理关注/取消关注及关注列表查询
 */

const { query } = require('../config/database');

class UserFollow {
  static async follow(followerId, followingId) {
    const result = await query(
      `INSERT INTO user_follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, following_id) DO NOTHING
       RETURNING *`,
      [followerId, followingId]
    );

    return result.rows[0] || null;
  }

  static async unfollow(followerId, followingId) {
    const result = await query(
      `DELETE FROM user_follows
       WHERE follower_id = $1 AND following_id = $2
       RETURNING *`,
      [followerId, followingId]
    );

    return result.rows[0] || null;
  }

  static async isFollowing(followerId, followingId) {
    const result = await query(
      `SELECT 1 FROM user_follows
       WHERE follower_id = $1 AND following_id = $2
       LIMIT 1`,
      [followerId, followingId]
    );

    return result.rows.length > 0;
  }

  static async getFollowers(userId, { limit = 20, offset = 0 } = {}) {
    const result = await query(
      `SELECT
         uf.follower_id AS user_id,
         uf.created_at AS followed_at,
         u.username,
         u.nickname,
         u.avatar_url
       FROM user_follows uf
       JOIN users u ON uf.follower_id = u.id
       WHERE uf.following_id = $1
       ORDER BY uf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  static async countFollowers(userId) {
    const result = await query(
      `SELECT COUNT(*)::INTEGER AS total
       FROM user_follows
       WHERE following_id = $1`,
      [userId]
    );

    return result.rows[0]?.total || 0;
  }

  static async getFollowing(userId, { limit = 20, offset = 0 } = {}) {
    const result = await query(
      `SELECT
         uf.following_id AS user_id,
         uf.created_at AS followed_at,
         u.username,
         u.nickname,
         u.avatar_url
       FROM user_follows uf
       JOIN users u ON uf.following_id = u.id
       WHERE uf.follower_id = $1
       ORDER BY uf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  static async countFollowing(userId) {
    const result = await query(
      `SELECT COUNT(*)::INTEGER AS total
       FROM user_follows
       WHERE follower_id = $1`,
      [userId]
    );

    return result.rows[0]?.total || 0;
  }
}

module.exports = UserFollow;
