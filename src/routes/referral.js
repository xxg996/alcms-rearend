/**
 * 邀请与佣金路由
 * 提供邀请码生成与邀请信息查询接口
 */

const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const { authenticateToken } = require('../middleware/auth');

// 获取邀请面板信息
router.get('/dashboard', authenticateToken, referralController.getDashboard);

// 生成或刷新邀请码
router.post('/code', authenticateToken, referralController.generateCode);

// 获取佣金记录
router.get('/commissions', authenticateToken, referralController.getCommissionRecords);

// 用户提现申请列表
router.get('/payouts', authenticateToken, referralController.getPayoutRequests);

// 发起提现申请
router.post('/payouts', authenticateToken, referralController.applyPayout);

// 获取提现账号
router.get('/payout-setting', authenticateToken, referralController.getPayoutSetting);

// 更新提现账号
router.put('/payout-setting', authenticateToken, referralController.updatePayoutSetting);

module.exports = router;
