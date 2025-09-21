/**
 * 管理端邀请佣金路由
 */

const express = require('express');
const router = express.Router();
const referralAdminController = require('../../controllers/referralAdminController');
const { authenticateToken, requirePermission } = require('../../middleware/auth');

router.get('/commission-config',
  authenticateToken,
  requirePermission('referral:commission:read'),
  referralAdminController.getCommissionConfig
);

router.put('/commission-config',
  authenticateToken,
  requirePermission('referral:commission:update'),
  referralAdminController.updateCommissionConfig
);

router.get('/commissions',
  authenticateToken,
  requirePermission('referral:commission:read'),
  referralAdminController.getCommissionRecords
);

router.post('/commissions/:id/review',
  authenticateToken,
  requirePermission('referral:commission:update'),
  referralAdminController.reviewCommission
);

router.get('/payouts',
  authenticateToken,
  requirePermission('referral:commission:read'),
  referralAdminController.getPayoutRequests
);

router.post('/payouts/:id/review',
  authenticateToken,
  requirePermission('referral:commission:update'),
  referralAdminController.reviewPayoutRequest
);

module.exports = router;
