/**
 * 积分系统路由
 * 处理用户积分管理、积分记录查询等路由
 */

const express = require('express');
const router = express.Router();
const pointsController = require('../controllers/pointsController');
const { authenticateToken, requireRole, requireAdmin, requirePermission } = require('../middleware/auth');

// 用户功能路由
// 获取当前用户积分信息
router.get('/my-info',
  authenticateToken,
  requirePermission('points.read'),
  pointsController.getMyPoints
);

// 获取当前用户积分记录
router.get('/my-records',
  authenticateToken,
  requirePermission('points.read'),
  pointsController.getMyPointsRecords
);

// 获取当前用户积分排名
router.get('/my-rank',
  authenticateToken,
  requirePermission('points.read'),
  pointsController.getMyPointsRank
);

// 积分转账
router.post('/transfer',
  authenticateToken,
  requirePermission('points.transfer'),
  pointsController.transferPoints
);

// 公开路由
// 获取积分排行榜
router.get('/leaderboard', 
  pointsController.getPointsLeaderboard
);

// 管理员功能路由
// 获取用户积分信息
router.get('/users/:userId/info',
  authenticateToken,
  requirePermission('points.read'),
  pointsController.getUserPoints
);

// 获取用户积分记录
router.get('/users/:userId/records',
  authenticateToken,
  requirePermission('points.read'),
  pointsController.getUserPointsRecords
);

// 调整用户积分
router.post('/users/:userId/adjust',
  authenticateToken,
  requirePermission('points.adjust'),
  pointsController.adjustUserPoints
);

// 批量发放积分
router.post('/batch/grant',
  authenticateToken,
  requirePermission('points.grant'),
  pointsController.batchGrantPoints
);

// 获取积分统计
router.get('/statistics',
  authenticateToken,
  requirePermission('points.statistics'),
  pointsController.getPointsStatistics
);

module.exports = router;
