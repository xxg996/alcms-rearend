/**
 * VIP系统路由
 * 处理VIP等级管理、用户VIP操作等路由
 */

const express = require('express');
const router = express.Router();
const vipController = require('../controllers/vipController');
const { authenticateToken, requireRole, requireAdmin } = require('../middleware/auth');

// 公开路由（无需认证）
// 获取所有VIP等级配置
router.get('/levels', vipController.getAllLevels);

// 获取指定VIP等级配置
router.get('/levels/:level', vipController.getLevelById);

// 需要认证的路由
// 获取当前用户VIP信息
router.get('/my-info', 
  authenticateToken, 
  vipController.getMyVIPInfo
);

// 获取当前用户订单历史
router.get('/my-orders', 
  authenticateToken, 
  vipController.getMyOrders
);

// 获取订单详情
router.get('/orders/:orderId', 
  authenticateToken, 
  vipController.getOrderById
);

// 管理员功能路由
// 创建VIP等级配置
router.post('/levels', 
  authenticateToken, 
  requireAdmin(), 
  vipController.createLevel
);

// 更新VIP等级配置
router.put('/levels/:level', 
  authenticateToken, 
  requireAdmin(), 
  vipController.updateLevel
);

// 删除VIP等级配置
router.delete('/levels/:level', 
  authenticateToken, 
  requireAdmin(), 
  vipController.deleteLevel
);

// 获取用户VIP信息
router.get('/users/:userId/info', 
  authenticateToken, 
  requireAdmin(), 
  vipController.getUserVIPInfo
);

// 设置用户VIP
router.post('/users/:userId/set', 
  authenticateToken, 
  requireAdmin(), 
  vipController.setUserVIP
);

// 延长用户VIP时间
router.post('/users/:userId/extend', 
  authenticateToken, 
  requireAdmin(), 
  vipController.extendUserVIP
);

// 取消用户VIP
router.delete('/users/:userId/cancel', 
  authenticateToken, 
  requireAdmin(), 
  vipController.cancelUserVIP
);

// 系统任务路由
// 更新过期VIP用户
router.post('/system/update-expired', 
  authenticateToken, 
  requireRole('super_admin'), 
  vipController.updateExpiredVIP
);

module.exports = router;
