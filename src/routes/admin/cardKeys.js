/**
 * 管理员卡密管理路由
 * 处理管理员对卡密系统的管理操作
 */

const express = require('express');
const router = express.Router();
const cardKeyController = require('../../controllers/cardKeyController');
const {
  authenticateToken,
  requirePermission
} = require('../../middleware/auth');

// 卡密管理功能
// 生成单个卡密
router.post('/generate/single',
  authenticateToken,
  requirePermission('card_key.generate'),
  cardKeyController.generateSingleCard
);

// 批量生成卡密
router.post('/generate/batch',
  authenticateToken,
  requirePermission('card_key.generate'),
  cardKeyController.generateBatchCards
);

// 获取卡密列表
router.get('/list',
  authenticateToken,
  requirePermission('card_key.read'),
  cardKeyController.getCardsList
);

// 获取卡密统计信息
router.get('/statistics',
  authenticateToken,
  requirePermission('card_key.statistics'),
  cardKeyController.getCardsStatistics
);

// 获取批次列表
router.get('/batches',
  authenticateToken,
  requirePermission('card_key.read'),
  cardKeyController.getBatchesList
);

// 获取批次详情
router.get('/batches/:batchId',
  authenticateToken,
  requirePermission('card_key.read'),
  cardKeyController.getBatchDetails
);

// 更新卡密状态
router.put('/:cardId/status',
  authenticateToken,
  requirePermission('card_key.update'),
  cardKeyController.updateCardStatus
);

// 删除卡密
router.post('/:cardId/delete',
  authenticateToken,
  requirePermission('card_key.delete'),
  cardKeyController.deleteCard
);

// 删除整个批次
router.post('/batches/:batchId/delete',
  authenticateToken,
  requirePermission('card_key.delete'),
  cardKeyController.deleteBatch
);

module.exports = router;