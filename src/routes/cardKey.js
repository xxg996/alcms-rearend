/**
 * 卡密系统路由
 * 处理卡密生成、兑换、查询等路由
 */

const express = require('express');
const router = express.Router();
const cardKeyController = require('../controllers/cardKeyController');
const { authenticateToken, requireRole, requireAdmin } = require('../middleware/auth');

// 需要认证的路由
// 兑换卡密（普通用户可用）
router.post('/redeem', 
  authenticateToken, 
  cardKeyController.redeemCard
);

// 查询卡密信息（用户只能查看基本信息，管理员可查看详细信息）
router.get('/info/:code', 
  authenticateToken, 
  cardKeyController.getCardInfo
);

// 管理员功能路由
// 生成单个卡密
router.post('/generate/single', 
  authenticateToken, 
  requireAdmin(), 
  cardKeyController.generateSingleCard
);

// 批量生成卡密
router.post('/generate/batch', 
  authenticateToken, 
  requireAdmin(), 
  cardKeyController.generateBatchCards
);

// 获取卡密列表
router.get('/list', 
  authenticateToken, 
  requireAdmin(), 
  cardKeyController.getCardsList
);

// 获取卡密统计信息
router.get('/statistics', 
  authenticateToken, 
  requireAdmin(), 
  cardKeyController.getCardsStatistics
);

// 获取批次列表
router.get('/batches', 
  authenticateToken, 
  requireAdmin(), 
  cardKeyController.getBatchesList
);

// 获取批次详情
router.get('/batches/:batchId', 
  authenticateToken, 
  requireAdmin(), 
  cardKeyController.getBatchDetails
);

// 更新卡密状态
router.put('/:cardId/status', 
  authenticateToken, 
  requireAdmin(), 
  cardKeyController.updateCardStatus
);

// 删除卡密
router.delete('/:cardId', 
  authenticateToken, 
  requireRole('super_admin'), 
  cardKeyController.deleteCard
);

// 删除整个批次
router.delete('/batches/:batchId', 
  authenticateToken, 
  requireRole('super_admin'), 
  cardKeyController.deleteBatch
);

module.exports = router;
