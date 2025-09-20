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
  requirePermission('vip:user:read'),
  vipController.getMyVIPInfo
);

// 获取当前用户订单历史
router.get('/my-orders',
  authenticateToken,
  requirePermission('vip:order:read'),
  vipController.getMyOrders
);

// 获取订单详情
router.get('/orders/:orderId',
  authenticateToken,
  requirePermission('vip:order:read'),
  vipController.getOrderById
);

module.exports = router;
