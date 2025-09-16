/**
 * VIP系统路由
 * 处理VIP等级管理、用户VIP操作等路由
 */

const express = require('express');
const router = express.Router();
const vipController = require('../controllers/vipController');
const { authenticateToken, requireRole, requireAdmin, requirePermission } = require('../middleware/auth');

// 公开路由（无需认证）
// 获取所有VIP等级配置
router.get('/levels', vipController.getAllLevels);

// 获取指定VIP等级配置
router.get('/levels/:level', vipController.getLevelById);

// 需要认证的路由
// 获取当前用户VIP信息
router.get('/my-info',
  authenticateToken,
  requirePermission('vip.user.read'),
  vipController.getMyVIPInfo
);

// 获取当前用户订单历史
router.get('/my-orders',
  authenticateToken,
  requirePermission('vip.order.read'),
  vipController.getMyOrders
);

// 获取订单详情
router.get('/orders/:orderId',
  authenticateToken,
  requirePermission('vip.order.read'),
  vipController.getOrderById
);

// 管理员功能路由
// 创建VIP等级配置
router.post('/levels',
  authenticateToken,
  requirePermission('vip.level.create'),
  vipController.createLevel
);

// 更新VIP等级配置
router.put('/levels/:level',
  authenticateToken,
  requirePermission('vip.level.update'),
  vipController.updateLevel
);

// 删除VIP等级配置
router.delete('/levels/:level',
  authenticateToken,
  requirePermission('vip.level.delete'),
  vipController.deleteLevel
);

// 获取用户VIP信息
router.get('/users/:userId/info',
  authenticateToken,
  requirePermission('vip.user.read'),
  vipController.getUserVIPInfo
);

// 设置用户VIP
router.post('/users/:userId/set',
  authenticateToken,
  requirePermission('vip.user.set'),
  vipController.setUserVIP
);

// 延长用户VIP时间
router.post('/users/:userId/extend',
  authenticateToken,
  requirePermission('vip.user.extend'),
  vipController.extendUserVIP
);

// 取消用户VIP
router.delete('/users/:userId/cancel',
  authenticateToken,
  requirePermission('vip.user.cancel'),
  vipController.cancelUserVIP
);

// 系统任务路由
// 更新过期VIP用户
router.post('/system/update-expired',
  authenticateToken,
  requirePermission('vip.user.set'),
  vipController.updateExpiredVIP
);

module.exports = router;
