/**
 * 创作者统计控制器
 */

const { query } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/users/creator/stats:
 *   get:
 *     tags: [创作者相关]
 *     summary: 获取创作者统计信息
 *     description: 返回当前登录用户作为创作者的核心数据，包括粉丝数、资源总浏览量、评论数（仅统计已审核评论）、点赞数及收藏数。
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/CreatorStats'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getCreatorStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT
         COALESCE((SELECT COUNT(*) FROM user_follows WHERE following_id = $1), 0) AS total_followers,
         COALESCE((SELECT SUM(view_count) FROM resources WHERE author_id = $1), 0) AS total_views,
         COALESCE((
           SELECT COUNT(*)
           FROM resource_comments rc
           JOIN resources r ON rc.resource_id = r.id
           WHERE r.author_id = $1 AND rc.is_approved = true
         ), 0) AS total_comments,
         COALESCE((
           SELECT COUNT(*)
           FROM resource_likes rl
           JOIN resources r ON rl.resource_id = r.id
           WHERE r.author_id = $1
         ), 0) AS total_likes,
         COALESCE((
           SELECT COUNT(*)
           FROM user_favorites uf
           JOIN resources r ON uf.resource_id = r.id
           WHERE r.author_id = $1
         ), 0) AS total_favorites,
         COALESCE((
           SELECT total_points_amount
           FROM creator_download_points cdp
           WHERE cdp.author_id = $1
         ), 0) AS total_points_earned
       `,
      [userId]
    );

    const row = result.rows[0] || {};

    const stats = {
      total_followers: Number(row.total_followers || 0),
      total_views: Number(row.total_views || 0),
      total_comments: Number(row.total_comments || 0),
      total_likes: Number(row.total_likes || 0),
      total_favorites: Number(row.total_favorites || 0),
      total_points_earned: Number(row.total_points_earned || 0)
    };

    return successResponse(res, '获取创作者统计成功', stats);
  } catch (error) {
    logger.error('获取创作者统计失败:', error);
    return errorResponse(res, '获取创作者统计失败', 500);
  }
};

module.exports = {
  getCreatorStats
};
