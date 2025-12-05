/**
 * 用户关注控制器
 */

const UserFollow = require('../models/UserFollow');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { UserService } = require('../services');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { logger } = require('../utils/logger');

const parsePaginationParams = (page, limit) => {
  const numericPage = Math.max(parseInt(page, 10) || 1, 1);
  const numericLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const offset = (numericPage - 1) * numericLimit;

  return { page: numericPage, limit: numericLimit, offset };
};

const buildPagination = (page, limit, total) => ({
  page,
  limit,
  total,
  total_pages: Math.ceil(total / limit) || 1
});

const ensureTargetUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('用户不存在');
  }
  return user;
};

const createAuditLog = async ({ operatorId, targetId, action, detail }) => {
  try {
    await AuditLog.createSystemLog({
      operatorId,
      targetType: 'user_follow',
      targetId,
      action,
      summary: action,
      detail: detail || {}
    });
  } catch (error) {
    logger.warn('记录关注操作审计日志失败', { error: error.message });
  }
};

const invalidateUserCaches = async (...userIds) => {
  const uniqueIds = [...new Set(userIds.filter(id => Number.isFinite(id) && id > 0))];
  if (!uniqueIds.length) {
    return;
  }

  try {
    await Promise.all(uniqueIds.map(id => UserService.clearCache(`user:${id}:*`)));
  } catch (error) {
    logger.warn('清理用户缓存失败', { userIds: uniqueIds, error: error.message });
  }
};

/**
 * @swagger
 * /api/users/{id}/follow:
 *   post:
 *     tags: [用户关注相关]
 *     summary: 关注用户
 *     description: 当前登录用户关注指定用户。
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 要关注的用户ID
 *     responses:
 *       200:
 *         description: 关注成功
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const followUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const targetId = parseInt(req.params.id, 10);

    if (!Number.isFinite(targetId) || targetId <= 0) {
      return errorResponse(res, '用户ID格式不正确', 400);
    }

    if (followerId === targetId) {
      return errorResponse(res, '不能关注自己', 400);
    }

    await ensureTargetUser(targetId);

    const existed = await UserFollow.isFollowing(followerId, targetId);
    if (existed) {
      return successResponse(res, '已关注该用户', { is_following: true });
    }

    await UserFollow.follow(followerId, targetId);

    await createAuditLog({
      operatorId: followerId,
      targetId,
      action: 'follow',
      detail: { follower_id: followerId, following_id: targetId }
    });

    await invalidateUserCaches(followerId, targetId);

    return successResponse(res, '关注成功', { is_following: true });
  } catch (error) {
    logger.error('关注用户失败:', error);
    if (error.message === '用户不存在') {
      return errorResponse(res, error.message, 404);
    }
    return errorResponse(res, error.message || '关注失败', 500);
  }
};

/**
 * @swagger
 * /api/users/{id}/follow:
 *   delete:
 *     tags: [用户关注相关]
 *     summary: 取消关注用户
 *     description: 当前登录用户取消关注指定用户。
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 要取消关注的用户ID
 *     responses:
 *       200:
 *         description: 取消关注成功
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const unfollowUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const targetId = parseInt(req.params.id, 10);

    if (!Number.isFinite(targetId) || targetId <= 0) {
      return errorResponse(res, '用户ID格式不正确', 400);
    }

    if (followerId === targetId) {
      return errorResponse(res, '不能取消关注自己', 400);
    }

    await ensureTargetUser(targetId);

    await UserFollow.unfollow(followerId, targetId);

    await createAuditLog({
      operatorId: followerId,
      targetId,
      action: 'unfollow',
      detail: { follower_id: followerId, following_id: targetId }
    });

    await invalidateUserCaches(followerId, targetId);

    return successResponse(res, '已取消关注', { is_following: false });
  } catch (error) {
    logger.error('取消关注失败:', error);
    if (error.message === '用户不存在') {
      return errorResponse(res, error.message, 404);
    }
    return errorResponse(res, error.message || '取消关注失败', 500);
  }
};

/**
 * @swagger
 * /api/users/followers:
 *   get:
 *     tags: [用户关注相关]
 *     summary: 获取我的粉丝列表
 *     description: 返回当前登录用户的粉丝列表，支持分页。
  *     security:
  *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: 每页数量
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserFollowListResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getFollowers = async (req, res) => {
  try {
    const userId = req.user.id;

    const { page, limit, offset } = parsePaginationParams(req.query.page, req.query.limit);

    const [items, total] = await Promise.all([
      UserFollow.getFollowers(userId, { limit, offset }),
      UserFollow.countFollowers(userId)
    ]);

    return successResponse(res, '获取粉丝列表成功', {
      items,
      pagination: buildPagination(page, limit, total)
    });
  } catch (error) {
    logger.error('获取粉丝列表失败:', error);
    return errorResponse(res, error.message || '获取粉丝列表失败', 500);
  }
};

/**
 * @swagger
 * /api/users/following:
 *   get:
 *     tags: [用户关注相关]
 *     summary: 获取我的关注列表
 *     description: 返回当前登录用户关注的用户列表，支持分页。
  *     security:
  *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: 每页数量
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserFollowListResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getFollowing = async (req, res) => {
  try {
    const userId = req.user.id;

    const { page, limit, offset } = parsePaginationParams(req.query.page, req.query.limit);

    const [items, total] = await Promise.all([
      UserFollow.getFollowing(userId, { limit, offset }),
      UserFollow.countFollowing(userId)
    ]);

    return successResponse(res, '获取关注列表成功', {
      items,
      pagination: buildPagination(page, limit, total)
    });
  } catch (error) {
    logger.error('获取关注列表失败:', error);
    return errorResponse(res, error.message || '获取关注列表失败', 500);
  }
};

/**
 * @swagger
 * /api/users/{id}/follow-status:
 *   get:
 *     tags: [用户关注相关]
 *     summary: 获取关注状态
 *     description: 返回当前登录用户是否关注指定用户。
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 用户ID
 *     responses:
 *       200:
 *         description: 获取成功
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getFollowStatus = async (req, res) => {
  try {
    const currentUserId = req.user?.id ? parseInt(req.user.id, 10) : null;
    const targetId = parseInt(req.params.id, 10);

    if (!Number.isFinite(targetId) || targetId <= 0) {
      return errorResponse(res, '用户ID格式不正确', 400);
    }

    await ensureTargetUser(targetId);

    if (!currentUserId || currentUserId === targetId) {
      return successResponse(res, '获取关注状态成功', {
        is_following: false
      });
    }

    const isFollowing = await UserFollow.isFollowing(currentUserId, targetId);

    return successResponse(res, '获取关注状态成功', {
      is_following: isFollowing
    });
  } catch (error) {
    logger.error('获取关注状态失败:', error);
    if (error.message === '用户不存在') {
      return errorResponse(res, error.message, 404);
    }
    return errorResponse(res, error.message || '获取关注状态失败', 500);
  }
};

module.exports = {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowStatus
};
