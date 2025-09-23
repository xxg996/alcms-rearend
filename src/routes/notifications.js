/**
 * 通知路由
 * 提供通知列表与详情查询能力
 */

const express = require('express');
const NotificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 获取全部通知或按查询参数过滤
router.get('/notifications',
  authenticateToken,
  NotificationController.getMyNotifications
);

// 批量标记通知状态
router.patch('/notifications/read',
  authenticateToken,
  NotificationController.batchMarkNotifications
);

// 按类别获取通知列表
router.get('/notifications/categories/:category',
  authenticateToken,
  NotificationController.getCategoryNotifications
);

// 资源类通知列表与详情
router.get('/notifications/resource',
  authenticateToken,
  NotificationController.getResourceNotifications
);

router.get('/notifications/resource/:id',
  authenticateToken,
  NotificationController.getResourceNotificationDetail
);

// 社区类通知列表与详情
router.get('/notifications/community',
  authenticateToken,
  NotificationController.getCommunityNotifications
);

router.get('/notifications/community/:id',
  authenticateToken,
  NotificationController.getCommunityNotificationDetail
);

// 系统类通知列表与详情
router.get('/notifications/system',
  authenticateToken,
  NotificationController.getSystemNotifications
);

router.get('/notifications/system/:id',
  authenticateToken,
  NotificationController.getSystemNotificationDetail
);

// 按类别获取通知详情
router.get('/notifications/categories/:category/:id',
  authenticateToken,
  NotificationController.getNotificationDetailByCategory
);

// 获取单条通知详情
router.get('/notifications/:id',
  authenticateToken,
  NotificationController.getNotificationDetail
);

// 标记单条通知状态
router.patch('/notifications/:id/read',
  authenticateToken,
  NotificationController.markNotificationRead
);

module.exports = router;
