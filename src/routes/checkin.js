/**
 * 签到系统路由
 * 处理用户签到、签到配置管理等路由
 */

const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkinController');
const { authenticateToken, requireRole, requireAdmin, requirePermission } = require('../middleware/auth');

// 用户功能路由
// 执行签到
router.post('/check',
  authenticateToken,
  requirePermission('checkin.check'),
  checkinController.performCheckin
);

// 获取当前用户签到状态
router.get('/my-status',
  authenticateToken,
  requirePermission('checkin.read'),
  checkinController.getMyCheckinStatus
);

// 获取当前用户签到历史
router.get('/my-history',
  authenticateToken,
  requirePermission('checkin.read'),
  checkinController.getMyCheckinHistory
);

// 公开路由
// 获取签到排行榜
router.get('/leaderboard', 
  checkinController.getCheckinLeaderboard
);


module.exports = router;
