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

// 注意：VIP订单查询已迁移到 /api/card-orders/my-orders
// 请使用新的卡密兑换订单记录接口

module.exports = router;
