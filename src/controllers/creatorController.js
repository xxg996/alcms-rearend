/**
 * 创作者统计控制器
 */

const { query } = require('../config/database');
const Resource = require('../models/Resource');
const { generateSecureResourceInfoBatch } = require('../utils/downloadUtilsBatch');
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

/**
 * @swagger
 * /api/users/creator/resources:
 *   get:
 *     tags: [创作者相关]
 *     summary: 获取当前创作者的资源列表
 *     description: |
 *       返回当前登录用户创建的所有资源，包含待审核或已下线的资源。
 *       支持按状态与公开性筛选，默认返回全部状态的资源。
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: 页码，默认1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: 每页数量，默认20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, archived, banned, deleted]
 *         description: 按资源状态筛选
 *       - in: query
 *         name: is_public
 *         schema:
 *           type: boolean
 *         description: 是否按公开状态筛选
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 关键字模糊搜索
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, title, view_count, download_count, like_count]
 *         description: 排序字段
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *         description: 排序方向，默认DESC
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
 *                       $ref: '#/components/schemas/CreatorResourceList'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getCreatorResources = async (req, res) => {
  try {
    const userId = req.user.id;

    const parsePositiveInt = (value, defaultValue) => {
      const parsed = parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return defaultValue;
      }
      return parsed;
    };

    const parseBoolean = (value) => {
      if (value === undefined || value === null) {
        return undefined;
      }
      const normalized = String(value).trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'off'].includes(normalized)) {
        return false;
      }
      return undefined;
    };

    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const status = typeof req.query.status === 'string' && req.query.status.trim()
      ? req.query.status.trim()
      : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const sortBy = typeof req.query.sort_by === 'string' ? req.query.sort_by : undefined;
    const sortOrder = typeof req.query.sort_order === 'string' ? req.query.sort_order : undefined;
    const isPublic = parseBoolean(req.query.is_public);

    const result = await Resource.findAll({
      page,
      limit,
      author_id: userId,
      status,
      search,
      sort_by: sortBy,
      sort_order: sortOrder,
      is_public: isPublic
    });

    const resourcesWithSecureInfo = await generateSecureResourceInfoBatch(result.resources, userId);
    const resources = resourcesWithSecureInfo.map(resource => {
      if (!resource || typeof resource !== 'object') {
        return resource;
      }
      const { tags, ...rest } = resource;
      return rest;
    });

    return successResponse(res, '获取创作者资源列表成功', {
      resources,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('获取创作者资源列表失败:', error);
    return errorResponse(res, '获取创作者资源列表失败', 500);
  }
};

module.exports = {
  getCreatorStats,
  getCreatorResources
};
