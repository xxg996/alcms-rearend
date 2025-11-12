/**
 * 管理端邀请佣金控制器
 * 提供佣金配置读取与更新能力
 */

const { services } = require('../services');
const { logger } = require('../utils/logger');
const AuditLog = require('../models/AuditLog');

const getRequestMeta = (req) => ({
  ipAddress: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
  userAgent: req.get('user-agent') || ''
});

/**
 * @swagger
 * /api/admin/referral/commissions:
 *   get:
 *     tags: [佣金]
 *     summary: 获取佣金记录列表
 *     description: 管理员查看所有邀请佣金记录，支持按状态、邀请人筛选
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: 页码（默认1）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: 每页数量（默认20）
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, paid]
 *       - in: query
 *         name: event_type
 *         schema:
 *           type: string
 *           enum: [first_recharge, renewal]
 *       - in: query
 *         name: inviter_id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionPayoutListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
const getCommissionRecords = async (req, res) => {
  try {
    const result = await services.referral.getAdminCommissionRecords(req.query);
    res.json(result);
  } catch (error) {
    logger.error('管理员获取佣金记录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取佣金记录失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/referral/commissions/{id}/review:
 *   post:
 *     tags: [佣金]
 *     summary: 审核佣金记录
 *     description: 管理员审核佣金记录，支持通过、驳回、标记已打款
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 佣金记录ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommissionPayoutReviewRequest'
 *     responses:
 *       200:
 *         description: 审核成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionRecord'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
const reviewCommission = async (req, res) => {
  try {
    const reviewerId = req.user.id;
    const { id } = req.params;
    const payload = req.body;
    const { ipAddress, userAgent } = getRequestMeta(req);
    const result = await services.referral.reviewCommission(id, payload, reviewerId);

    await AuditLog.createSystemLog({
      operatorId: reviewerId,
      targetType: 'referral_commission',
      targetId: id,
      action: `commission_${payload?.status || 'review'}`,
      summary: `佣金审核${payload?.status || ''}`.trim(),
      detail: {
        status: payload?.status,
        review_notes: payload?.review_notes || null
      },
      ipAddress,
      userAgent
    });

    res.json(result);
  } catch (error) {
    logger.error('审核佣金失败:', error);
    const { ipAddress, userAgent } = getRequestMeta(req);
    await AuditLog.createSystemLog({
      operatorId: req.user?.id || null,
      targetType: 'referral_commission',
      targetId: req.params?.id || null,
      action: 'commission_review_failed',
      summary: '佣金审核失败',
      detail: { error: error.message },
      ipAddress,
      userAgent
    });
    res.status(400).json({
      success: false,
      message: error.message || '审核佣金失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/referral/commission-config:
 *   get:
 *     tags: [佣金]
 *     summary: 获取邀请佣金配置
 *     description: 管理员查询邀请佣金启用状态及比例
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionConfigResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getCommissionConfig = async (req, res) => {
  try {
    const result = await services.referral.getCommissionConfig();
    res.json(result);
  } catch (error) {
    logger.error('获取邀请佣金配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取邀请佣金配置失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/referral/commission-config:
 *   put:
 *     tags: [佣金]
 *     summary: 更新邀请佣金配置
 *     description: 管理员调整邀请佣金的启用状态、首充比例与续费比例
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommissionConfig'
 *           examples:
 *             updateRates:
 *               summary: 更新佣金配置
 *               value:
 *                 enabled: true
 *                 first_rate: 0.12
 *                 renewal_rate: 0.04
 *                 card_type_rates:
 *                   points: 0.08
 *                   download: 0.15
 *                   vip_special: 0.20
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionConfigResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
const updateCommissionConfig = async (req, res) => {
  try {
    const adminId = req.user.id;
    const payload = req.body;
    const { ipAddress, userAgent } = getRequestMeta(req);
    const result = await services.referral.updateCommissionConfig(payload, adminId);

    await AuditLog.createSystemLog({
      operatorId: adminId,
      targetType: 'referral_commission_config',
      targetId: 'global',
      action: 'commission_config_update',
      summary: '更新佣金配置',
      detail: payload,
      ipAddress,
      userAgent
    });

    res.json(result);
  } catch (error) {
    logger.error('更新邀请佣金配置失败:', error);
    const { ipAddress, userAgent } = getRequestMeta(req);
    await AuditLog.createSystemLog({
      operatorId: req.user?.id || null,
      targetType: 'referral_commission_config',
      targetId: 'global',
      action: 'commission_config_update_failed',
      summary: '更新佣金配置失败',
      detail: { error: error.message },
      ipAddress,
      userAgent
    });
    res.status(400).json({
      success: false,
      message: error.message || '更新邀请佣金配置失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/referral/payouts:
 *   get:
 *     tags: [佣金]
 *     summary: 获取提现申请列表
 *     description: 管理员查看所有提现申请，支持按状态筛选
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, paid]
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionRecordListResponse'
 */
const getPayoutRequests = async (req, res) => {
  try {
    const result = await services.referral.getAdminPayoutRequests(req.query);
    res.json(result);
  } catch (error) {
    logger.error('管理员获取提现申请失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取提现申请失败'
    });
  }
};

/**
 * @swagger
 * /api/admin/referral/payouts/{id}/review:
 *   post:
 *     tags: [佣金]
 *     summary: 审核提现申请
 *     description: 管理员审核提现申请并更新状态
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommissionReviewRequest'
 *     responses:
 *       200:
 *         description: 审核成功
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
const reviewPayoutRequest = async (req, res) => {
  try {
    const reviewerId = req.user.id;
    const { id } = req.params;
    const payload = req.body;
    const { ipAddress, userAgent } = getRequestMeta(req);
    const result = await services.referral.reviewPayoutRequest(id, payload, reviewerId);

    await AuditLog.createSystemLog({
      operatorId: reviewerId,
      targetType: 'referral_payout',
      targetId: id,
      action: `payout_${payload?.status || 'review'}`,
      summary: '提现申请审核',
      detail: {
        status: payload?.status,
        review_notes: payload?.review_notes || null
      },
      ipAddress,
      userAgent
    });

    res.json(result);
  } catch (error) {
    logger.error('审核提现申请失败:', error);
    const { ipAddress, userAgent } = getRequestMeta(req);
    await AuditLog.createSystemLog({
      operatorId: req.user?.id || null,
      targetType: 'referral_payout',
      targetId: req.params?.id || null,
      action: 'payout_review_failed',
      summary: '提现审核失败',
      detail: { error: error.message },
      ipAddress,
      userAgent
    });
    res.status(400).json({
      success: false,
      message: error.message || '审核提现申请失败'
    });
  }
};

module.exports = {
  getCommissionRecords,
  reviewCommission,
  getCommissionConfig,
  updateCommissionConfig,
  getPayoutRequests,
  reviewPayoutRequest
};
