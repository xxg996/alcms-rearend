/**
 * 通知控制器
 * 负责处理通知列表与详情的API请求
 */

const Notification = require('../models/Notification');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { logger } = require('../utils/logger');

class NotificationController {
  static async handleCategoryList(req, res, category) {
    try {
      const { page, limit, is_read: isReadQuery, read } = req.query;
      const result = await Notification.getUserNotifications(req.user.id, {
        page,
        limit,
        category,
        isRead: isReadQuery ?? read
      });

      return successResponse(res, '获取通知列表成功', result);
    } catch (error) {
      logger.error('按类别获取通知失败:', error);
      return errorResponse(res, '获取通知列表失败', 500);
    }
  }

  static async handleCategoryDetail(req, res, category) {
    try {
      const notificationId = parseInt(req.params.id, 10);
      if (Number.isNaN(notificationId) || notificationId <= 0) {
        return errorResponse(res, '通知ID格式不正确', 400);
      }

      const notification = await Notification.getNotificationById(
        notificationId,
        req.user.id,
        { enrich: true, markRead: true }
      );

      if (!notification || notification.category !== category) {
        return errorResponse(res, '通知不存在', 404);
      }

      return successResponse(res, '获取通知详情成功', notification);
    } catch (error) {
      logger.error('按类别获取通知详情失败:', error);
      return errorResponse(res, '获取通知详情失败', 500);
    }
  }

  static async getMyNotifications(req, res) {
    try {
      const { page, limit, category, is_read: isReadQuery, read } = req.query;
      const result = await Notification.getUserNotifications(req.user.id, {
        page,
        limit,
        category,
        isRead: isReadQuery ?? read
      });

      return successResponse(res, '获取通知列表成功', result);
    } catch (error) {
      logger.error('获取通知列表失败:', error);
      return errorResponse(res, '获取通知列表失败', 500);
    }
  }

  /**
   * @swagger
   * /api/notifications/categories/{category}:
   *   get:
   *     summary: 按类别获取当前用户通知
   *     tags: [通知]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: category
   *         required: true
   *         schema:
   *           type: string
   *           enum: [resource, community, system]
   *         description: 通知类别
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: 获取通知列表成功
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotificationListResponse'
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async getCategoryNotifications(req, res) {
    const categoryParam = Notification.normalizeCategory(req.params.category);
    if (!Notification.isValidCategory(categoryParam)) {
      return errorResponse(res, '通知类别不合法', 400);
    }

    return NotificationController.handleCategoryList(req, res, categoryParam);
  }

  /**
   * @swagger
   * /api/notifications/{id}:
   *   get:
   *     summary: 获取通知详情
   *     tags: [通知]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: 获取通知详情成功
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotificationDetailResponse'
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         description: 通知不存在
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async getNotificationDetail(req, res) {
    try {
      const notificationId = parseInt(req.params.id, 10);
      if (Number.isNaN(notificationId) || notificationId <= 0) {
        return errorResponse(res, '通知ID格式不正确', 400);
      }

      const notification = await Notification.getNotificationById(
        notificationId,
        req.user.id,
        { enrich: true, markRead: true }
      );

      if (!notification) {
        return errorResponse(res, '通知不存在', 404);
      }

      return successResponse(res, '获取通知详情成功', notification);
    } catch (error) {
      logger.error('获取通知详情失败:', error);
      return errorResponse(res, '获取通知详情失败', 500);
    }
  }

  static async getNotificationDetailByCategory(req, res) {
    const categoryParam = Notification.normalizeCategory(req.params.category);
    if (!Notification.isValidCategory(categoryParam)) {
      return errorResponse(res, '通知类别不合法', 400);
    }

    return NotificationController.handleCategoryDetail(req, res, categoryParam);
  }

  static async getResourceNotifications(req, res) {
    return NotificationController.handleCategoryList(req, res, 'resource');
  }

  static async getResourceNotificationDetail(req, res) {
    return NotificationController.handleCategoryDetail(req, res, 'resource');
  }

  static async getCommunityNotifications(req, res) {
    return NotificationController.handleCategoryList(req, res, 'community');
  }

  static async getCommunityNotificationDetail(req, res) {
    return NotificationController.handleCategoryDetail(req, res, 'community');
  }

  static async getSystemNotifications(req, res) {
    return NotificationController.handleCategoryList(req, res, 'system');
  }

  static async getSystemNotificationDetail(req, res) {
    return NotificationController.handleCategoryDetail(req, res, 'system');
  }

  /**
   * @swagger
   * /api/notifications/{id}/read:
   *   patch:
   *     summary: 标记单条通知已读/未读
   *     tags: [通知]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/NotificationMarkRequest'
   *           example:
   *             is_read: true
   *     responses:
   *       200:
   *         description: 更新通知状态成功
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         description: 通知不存在或无权限操作
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async markNotificationRead(req, res) {
    try {
      const notificationId = parseInt(req.params.id, 10);
      if (Number.isNaN(notificationId) || notificationId <= 0) {
        return errorResponse(res, '通知ID格式不正确', 400);
      }

      const { is_read: isReadBody } = req.body || {};
      const targetState = Notification.parseBoolean(isReadBody);
      const isRead = targetState === null ? true : targetState;

      const success = await Notification.updateReadState(notificationId, req.user.id, isRead);

      if (!success) {
        return errorResponse(res, '通知不存在或无权限操作', 404);
      }

      return successResponse(res, isRead ? '标记通知为已读成功' : '标记通知为未读成功');
    } catch (error) {
      logger.error('标记通知已读失败:', error);
      return errorResponse(res, '标记通知状态失败', 500);
    }
  }

  /**
   * @swagger
   * /api/notifications/read:
   *   patch:
   *     summary: 批量标记通知已读/未读
   *     tags: [通知]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/NotificationBatchMarkRequest'
   *           example:
   *             ids: [128, 129]
   *             category: "resource"
   *             is_read: true
   *     responses:
   *       200:
   *         description: 批量更新通知状态成功
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async batchMarkNotifications(req, res) {
    try {
      const { ids, category, is_read: isReadBody } = req.body || {};

      if (ids !== undefined && (!Array.isArray(ids) || ids.length === 0)) {
        return errorResponse(res, 'ids 参数必须为非空数组', 400);
      }

      const normalizedCategory = Notification.normalizeCategory(category);
      if (normalizedCategory && !Notification.isValidCategory(normalizedCategory)) {
        return errorResponse(res, '通知类别不合法', 400);
      }

      const targetState = Notification.parseBoolean(isReadBody);
      const isRead = targetState === null ? true : targetState;

      const affected = await Notification.batchUpdateReadState(req.user.id, {
        ids,
        category: normalizedCategory,
        isRead
      });

      return successResponse(res, '批量更新通知状态成功', { affected });
    } catch (error) {
      logger.error('批量标记通知状态失败:', error);
      return errorResponse(res, '批量更新通知状态失败', 500);
    }
  }
}

module.exports = NotificationController;
