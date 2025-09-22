/**
 * 用户卡密兑换订单记录路由
 * 处理用户查看自己的卡密兑换订单记录
 */

const express = require('express');
const router = express.Router();
const cardOrderController = require('../../controllers/cardOrderController');
const { authenticateToken, requirePermission } = require('../../middleware/auth');

// 获取我的卡密兑换订单记录列表
router.get('/my-orders',
  authenticateToken,
  requirePermission('card_key:redeem'),
  cardOrderController.getMyOrderRecords
);

// 获取单个订单详情
router.get('/orders/:orderId',
  authenticateToken,
  requirePermission('card_key:redeem'),
  cardOrderController.getOrderDetail
);

module.exports = router;