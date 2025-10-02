/**
 * 积分系统路由
 * 处理用户积分管理、积分记录查询等路由
 */

const express = require('express');
const router = express.Router();
const pointsController = require('../controllers/pointsController');
const pointsProductController = require('../controllers/pointsProductController');
const { authenticateToken, requireRole, requireAdmin, requirePermission } = require('../middleware/auth');

// 用户功能路由
// 获取当前用户积分信息
router.get('/my-info',
  authenticateToken,
  requirePermission('points:read'),
  pointsController.getMyPoints
);

// 获取当前用户积分记录
router.get('/my-records',
  authenticateToken,
  requirePermission('points:read'),
  pointsController.getMyPointsRecords
);

// 获取可兑换虚拟商品列表
router.get('/products',
  authenticateToken,
  requirePermission('points:read'),
  pointsProductController.getProducts
);

// 兑换虚拟商品
router.post('/products/:productId/redeem',
  authenticateToken,
  requirePermission('points:read'),
  pointsProductController.redeemProduct
);

// 获取兑换记录
router.get('/products/exchanges',
  authenticateToken,
  requirePermission('points:read'),
  pointsProductController.getMyExchanges
);

// 获取当前用户积分排名
router.get('/my-rank',
  authenticateToken,
  requirePermission('points:read'),
  pointsController.getMyPointsRank
);

// 积分转账
router.post('/transfer',
  authenticateToken,
  requirePermission('points:transfer'),
  pointsController.transferPoints
);

// 公开路由
// 获取积分排行榜
router.get('/leaderboard', 
  pointsController.getPointsLeaderboard
);


module.exports = router;
