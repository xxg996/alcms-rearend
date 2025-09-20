/**
 * 管理员VIP管理路由
 * 处理管理员对VIP系统的管理操作
 */

const express = require('express');
const router = express.Router();
const vipController = require('../../controllers/vipController');
const {
  authenticateToken,
  requirePermission
} = require('../../middleware/auth');

// VIP等级管理
// 创建VIP等级配置
router.post('/levels',
  authenticateToken,
  requirePermission('vip:level:create'),
  vipController.createLevel
);

// 更新VIP等级配置
router.put('/levels/:level',
  authenticateToken,
  requirePermission('vip:level:update'),
  vipController.updateLevel
);

// 删除VIP等级配置
router.post('/levels/:level/delete',
  authenticateToken,
  requirePermission('vip:level:delete'),
  vipController.deleteLevel
);


// VIP用户管理
// 获取用户VIP信息
router.get('/users/:userId/info',
  authenticateToken,
  requirePermission('vip:user:read'),
  vipController.getUserVIPInfo
);

// 设置用户VIP
router.post('/users/:userId/set',
  authenticateToken,
  requirePermission('vip:user:set'),
  vipController.setUserVIP
);

// 延长用户VIP时间
router.post('/users/:userId/extend',
  authenticateToken,
  requirePermission('vip:user:extend'),
  vipController.extendUserVIP
);

// 取消用户VIP
router.post('/users/:userId/cancel',
  authenticateToken,
  requirePermission('vip:user:cancel'),
  vipController.cancelUserVIP
);

// 系统任务
// 更新过期VIP用户
router.post('/system/update-expired',
  authenticateToken,
  requirePermission('vip:user:set'),
  vipController.updateExpiredVIP
);

module.exports = router;
