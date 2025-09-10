/**
 * 签到系统路由
 * 处理用户签到、签到配置管理等路由
 */

const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkinController');
const { authenticateToken, requireRole, requireAdmin } = require('../middleware/auth');

// 用户功能路由
// 执行签到
router.post('/check', 
  authenticateToken, 
  checkinController.performCheckin
);

// 获取当前用户签到状态
router.get('/my-status', 
  authenticateToken, 
  checkinController.getMyCheckinStatus
);

// 获取当前用户签到历史
router.get('/my-history', 
  authenticateToken, 
  checkinController.getMyCheckinHistory
);

// 公开路由
// 获取签到排行榜
router.get('/leaderboard', 
  checkinController.getCheckinLeaderboard
);

// 管理员功能路由
// 获取所有签到配置
router.get('/configs', 
  authenticateToken, 
  requireAdmin(), 
  checkinController.getAllConfigs
);

// 创建签到配置
router.post('/configs', 
  authenticateToken, 
  requireAdmin(), 
  checkinController.createConfig
);

// 更新签到配置
router.put('/configs/:configId', 
  authenticateToken, 
  requireAdmin(), 
  checkinController.updateConfig
);

// 获取用户签到信息
router.get('/users/:userId/info', 
  authenticateToken, 
  requireAdmin(), 
  checkinController.getUserCheckinInfo
);

// 获取用户签到历史
router.get('/users/:userId/history', 
  authenticateToken, 
  requireAdmin(), 
  checkinController.getUserCheckinHistory
);

// 补签功能
router.post('/users/:userId/makeup', 
  authenticateToken, 
  requireAdmin(), 
  checkinController.makeupCheckin
);

// 重置用户签到数据
router.delete('/users/:userId/reset', 
  authenticateToken, 
  requireAdmin(), 
  checkinController.resetUserCheckins
);

// 获取签到统计
router.get('/statistics', 
  authenticateToken, 
  requireAdmin(), 
  checkinController.getCheckinStatistics
);

module.exports = router;
