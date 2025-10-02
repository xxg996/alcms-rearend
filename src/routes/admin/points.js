/**
 * 管理员积分管理路由
 * 处理管理员对积分系统的管理操作
 */

const express = require('express');
const router = express.Router();
const pointsController = require('../../controllers/pointsController');
const pointsProductController = require('../../controllers/pointsProductController');
const {
  authenticateToken,
  requirePermission
} = require('../../middleware/auth');

// 积分管理功能
// 获取用户积分信息
router.get('/users/:userId/info',
  authenticateToken,
  requirePermission('points:read'),
  pointsController.getUserPoints
);

// 获取用户积分记录
router.get('/users/:userId/records',
  authenticateToken,
  requirePermission('points:read'),
  pointsController.getUserPointsRecords
);

// 调整用户积分
router.post('/users/:userId/adjust',
  authenticateToken,
  requirePermission('points:adjust'),
  pointsController.adjustUserPoints
);

// 批量发放积分
router.post('/batch/grant',
  authenticateToken,
  requirePermission('points:grant'),
  pointsController.batchGrantPoints
);

// 获取积分统计
router.get('/statistics',
  authenticateToken,
  requirePermission('points:statistics'),
  pointsController.getPointsStatistics
);

// 虚拟商品管理
router.get('/products',
  authenticateToken,
  requirePermission('points:statistics'),
  pointsProductController.adminGetProducts
);

router.post('/products',
  authenticateToken,
  requirePermission('points:grant'),
  pointsProductController.createProduct
);

router.put('/products/:productId',
  authenticateToken,
  requirePermission('points:grant'),
  pointsProductController.updateProduct
);

router.post('/products/:productId/inventory',
  authenticateToken,
  requirePermission('points:grant'),
  pointsProductController.addInventory
);

router.get('/products/:productId/inventory',
  authenticateToken,
  requirePermission('points:statistics'),
  pointsProductController.getInventory
);

router.get('/products/exchanges',
  authenticateToken,
  requirePermission('points:statistics'),
  pointsProductController.adminGetExchanges
);

module.exports = router;
