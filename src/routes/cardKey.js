/**
 * 卡密系统路由
 * 处理卡密生成、兑换、查询等路由
 */

const express = require('express');
const router = express.Router();
const cardKeyController = require('../controllers/cardKeyController');
const { authenticateToken, requireRole, requireAdmin, requirePermission } = require('../middleware/auth');

// 需要认证的路由
// 兑换卡密（普通用户可用）
router.post('/redeem',
  authenticateToken,
  requirePermission('card_key:redeem'),
  cardKeyController.redeemCard
);

// 查询卡密信息（用户只能查看基本信息，管理员可查看详细信息）
router.get('/info/:code',
  authenticateToken,
  requirePermission('card_key:read'),
  cardKeyController.getCardInfo
);


module.exports = router;
