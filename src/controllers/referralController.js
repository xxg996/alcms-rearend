/**
 * 邀请与佣金控制器
 * 提供邀请码生成、邀请列表与佣金信息查询接口
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
 * /api/referral/dashboard:
 *   get:
 *     tags: [佣金]
 *     summary: 获取邀请面板
 *     description: 返回当前登录用户的邀请码、邀请统计和最近的下级列表
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionDashboardResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await services.referral.getReferralDashboard(userId);
    res.json(result);
  } catch (error) {
    logger.error('获取邀请信息失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取邀请信息失败'
    });
  }
};

/**
 * @swagger
 * /api/referral/code:
 *   post:
 *     tags: [佣金]
 *     summary: 生成或刷新邀请码
 *     description: 生成新的邀请码，force=true 时强制刷新旧邀请码
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force:
 *                 type: boolean
 *                 default: false
 *                 description: 是否强制刷新邀请码
 *     responses:
 *       200:
 *         description: 生成成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionCodeResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
const generateCode = async (req, res) => {
  try {
    const userId = req.user.id;
    const { force = false } = req.body || {};
    const { ipAddress, userAgent } = getRequestMeta(req);
    const result = await services.referral.generateCode(userId, { force });

    if (result?.success) {
      await AuditLog.createSystemLog({
        operatorId: userId,
        targetType: 'referral_code',
        targetId: result?.data?.referral_code || null,
        action: force ? 'generate_force' : 'generate',
        summary: force ? '强制刷新邀请码' : '生成邀请码',
        detail: { force },
        ipAddress,
        userAgent
      });
    }
    res.json(result);
  } catch (error) {
    logger.error('生成邀请码失败:', error);
    const { ipAddress, userAgent } = getRequestMeta(req);
    await AuditLog.createSystemLog({
      operatorId: req.user?.id || null,
      targetType: 'referral_code',
      targetId: null,
      action: 'generate_failed',
      summary: '生成邀请码失败',
      detail: { error: error.message },
      ipAddress,
      userAgent
    });
    res.status(400).json({
      success: false,
      message: error.message || '生成邀请码失败'
    });
  }
};

/**
 * @swagger
 * /api/referral/commissions:
 *   get:
 *     tags: [佣金]
 *     summary: 获取佣金记录
 *     description: 返回当前用户作为邀请人所获得的佣金明细，支持分页与事件类型筛选
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: 页码（默认1）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: 每页数量（默认20）
 *       - in: query
 *         name: event_type
 *         schema:
 *           type: string
 *           enum: [first_recharge, renewal]
 *         description: 按事件类型过滤佣金记录
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, paid]
 *         description: 按审核状态过滤佣金记录
 *     responses:
 *       200:
 *         description: 请求成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionPayoutListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getCommissionRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, event_type, status } = req.query;

    const result = await services.referral.getCommissionRecords(userId, {
      page,
      limit,
      event_type,
      status
    });

    res.json(result);
  } catch (error) {
    logger.error('获取佣金记录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取佣金记录失败'
    });
  }
};

/**
 * @swagger
 * /api/referral/payouts:
 *   get:
 *     tags: [佣金]
 *     summary: 获取提现申请列表
 *     description: 返回当前用户的提现申请记录
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
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionPayoutListResponse'
 */
const getPayoutRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, status } = req.query;

    const result = await services.referral.getUserPayoutRequests(userId, {
      page,
      limit,
      status
    });

    res.json(result);
  } catch (error) {
    logger.error('获取提现申请失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取提现申请失败'
    });
  }
};

/**
 * @swagger
 * /api/referral/payouts:
 *   post:
 *     tags: [佣金]
 *     summary: 发起提现申请
 *     description: 根据当前可提现余额发起申请，未传账号则默认使用保存的提现账号
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommissionPayoutApplyRequest'
 *     responses:
 *       200:
 *         description: 提交成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionPayoutApplyResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
const applyPayout = async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body;
    const { ipAddress, userAgent } = getRequestMeta(req);
    const result = await services.referral.applyPayout(userId, payload);

    if (result?.success) {
      await AuditLog.createSystemLog({
        operatorId: userId,
        targetType: 'referral_payout',
        targetId: result?.data?.id || null,
        action: 'apply',
        summary: '用户发起提现申请',
        detail: {
          amount: result?.data?.amount,
          method: result?.data?.method || null
        },
        ipAddress,
        userAgent
      });
    }
    res.json(result);
  } catch (error) {
    logger.error('提交提现申请失败:', error);
    const { ipAddress, userAgent } = getRequestMeta(req);
    await AuditLog.createSystemLog({
      operatorId: req.user?.id || null,
      targetType: 'referral_payout',
      targetId: null,
      action: 'apply_failed',
      summary: '提现申请失败',
      detail: { error: error.message },
      ipAddress,
      userAgent
    });
    res.status(400).json({
      success: false,
      message: error.message || '提现申请提交失败'
    });
  }
};

/**
 * @swagger
 * /api/referral/payout-setting:
 *   get:
 *     tags: [佣金]
 *     summary: 获取提现账号
 *     description: 返回当前用户配置的提现方式与账号信息
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionPayoutApplyResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getPayoutSetting = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await services.referral.getPayoutSetting(userId);
    res.json(result);
  } catch (error) {
    logger.error('获取提现账号失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取提现账号失败'
    });
  }
};

/**
 * @swagger
 * /api/referral/payout-setting:
 *   put:
 *     tags: [佣金]
 *     summary: 更新提现账号
 *     description: 设置或更新提现方式（支付宝、USDT）及账号信息
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommissionPayoutSettingRequest'
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionPayoutResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const updatePayoutSetting = async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body;
    const { ipAddress, userAgent } = getRequestMeta(req);
    const result = await services.referral.updatePayoutSetting(userId, payload, userId);

    if (result?.success) {
      await AuditLog.createSystemLog({
        operatorId: userId,
        targetType: 'referral_payout_setting',
        targetId: userId,
        action: 'update',
        summary: '更新提现账号',
        detail: {
          method: payload?.method,
          account: payload?.account ? '***' : null
        },
        ipAddress,
        userAgent
      });
    }
    res.json(result);
  } catch (error) {
    logger.error('更新提现账号失败:', error);
    const { ipAddress, userAgent } = getRequestMeta(req);
    await AuditLog.createSystemLog({
      operatorId: req.user?.id || null,
      targetType: 'referral_payout_setting',
      targetId: req.user?.id || null,
      action: 'update_failed',
      summary: '更新提现账号失败',
      detail: { error: error.message },
      ipAddress,
      userAgent
    });
    res.status(400).json({
      success: false,
      message: error.message || '更新提现账号失败'
    });
  }
};

module.exports = {
  getDashboard,
  generateCode,
  getCommissionRecords,
  getPayoutRequests,
  applyPayout,
  getPayoutSetting,
  updatePayoutSetting
};
