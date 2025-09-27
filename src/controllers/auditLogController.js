/**
 * 审计日志控制器
 * 提供登录日志、系统操作日志与积分审计日志的查询接口
 * @swagger
 * tags:
 *   name: 审计日志
 *   description: 管理员用于排查风险、回溯操作的日志查询接口
 */

const { services } = require('../services');
const AuditLog = require('../models/AuditLog');
const { logger } = require('../utils/logger');

const getRequestMeta = (req) => ({
  ipAddress: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
  userAgent: req.get('user-agent') || ''
});

const recordSystemOperation = async (req, payload) => {
  const { ipAddress, userAgent } = getRequestMeta(req);
  await AuditLog.createSystemLog({
    operatorId: req.user?.id || null,
    ipAddress,
    userAgent,
    ...payload
  });
};

const isClientError = (message = '') => {
  const keywords = ['参数', '格式', '状态', '缺少'];
  return keywords.some(keyword => message.includes(keyword));
};

const handleError = (res, error, fallbackMessage) => {
  logger.error(fallbackMessage, error);
  const message = error.message || fallbackMessage;
  const status = isClientError(message) ? 400 : 500;
  res.status(status).json({
    success: false,
    message
  });
};

/**
 * @swagger
 * /api/admin/logs/login:
 *   get:
 *     tags: [审计日志]
 *     summary: 查询登录日志
 *     description: 管理员按状态、账号、时间范围筛选登录成功与失败记录
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码，从1开始
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: 每页数量
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [success, failure]
 *         description: 登录状态筛选
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: 关联的用户ID
 *       - in: query
 *         name: identifier
 *         schema:
 *           type: string
 *         description: 登录使用的邮箱或用户名关键字
 *       - in: query
 *         name: ip
 *         schema:
 *           type: string
 *         description: 登录IP地址
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 模糊搜索字段（账号、IP、User-Agent）
 *       - in: query
 *         name: start_at
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 开始时间
 *       - in: query
 *         name: end_at
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 结束时间
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedAuditLoginResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getLoginLogs = async (req, res) => {
  try {
    const result = await services.auditLog.getLoginLogs(req.query);
    res.json(result);
  } catch (error) {
    handleError(res, error, '查询登录日志失败');
  }
};

/**
 * @swagger
 * /api/admin/logs/system:
 *   get:
 *     tags: [审计日志]
 *     summary: 查询系统操作日志
 *     description: 管理员按操作人、目标对象、操作行为等条件筛选后台操作记录
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: operator_id
 *         schema:
 *           type: integer
 *         description: 操作人用户ID
 *       - in: query
 *         name: target_type
 *         schema:
 *           type: string
 *         description: 操作对象类型，例如 user、resource、commission
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: 操作行为编码
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 模糊搜索（操作摘要或详情）
 *       - in: query
 *         name: start_at
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 开始时间
 *       - in: query
 *         name: end_at
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 结束时间
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedAuditSystemResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getSystemLogs = async (req, res) => {
  try {
    const result = await services.auditLog.getSystemLogs(req.query);
    res.json(result);
  } catch (error) {
    handleError(res, error, '查询系统操作日志失败');
  }
};

/**
 * @swagger
 * /api/admin/logs/points:
 *   get:
 *     tags: [审计日志]
 *     summary: 查询积分审计日志
 *     description: 管理员用于追踪积分增减、核查积分来源的日志列表
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: 积分归属用户ID
 *       - in: query
 *         name: operator_id
 *         schema:
 *           type: integer
 *         description: 操作者用户ID
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *         description: 积分来源标识
 *       - in: query
 *         name: related_type
 *         schema:
 *           type: string
 *         description: 关联业务类型
 *       - in: query
 *         name: min_amount
 *         schema:
 *           type: integer
 *         description: 最小积分变动值（>=）
 *       - in: query
 *         name: max_amount
 *         schema:
 *           type: integer
 *         description: 最大积分变动值（<=）
 *       - in: query
 *         name: start_at
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 开始时间
 *       - in: query
 *         name: end_at
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 结束时间
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedAuditPointsResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getPointsLogs = async (req, res) => {
  try {
    const result = await services.auditLog.getPointsLogs(req.query);
    res.json(result);
  } catch (error) {
    handleError(res, error, '查询积分审计日志失败');
  }
};

/**
 * @swagger
 * /api/admin/logs/clear:
 *   post:
 *     tags: [审计日志]
 *     summary: 一键清理审计日志
 *     description: 管理员选择日志类型并可指定时间阈值，批量清理系统操作、登录或积分日志。
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               log_type:
 *                 type: string
 *                 enum: [system, login, points, all]
 *                 description: 需要清理的日志类型，默认 system
 *               before_date:
 *                 type: string
 *                 format: date-time
 *                 description: 仅删除早于该时间的日志，留空则全部删除
 *           example:
 *             log_type: "system"
 *             before_date: "2025-01-01T00:00:00Z"
 *     responses:
 *       200:
 *         description: 日志清理成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         clearedTypes:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: 已清理的日志类型
 *                         beforeDate:
 *                           type: string
 *                           nullable: true
 *                           description: 清理使用的时间阈值
 *                         counts:
 *                           type: object
 *                           additionalProperties:
 *                             type: integer
 *                           description: 各日志类型清理数量
 *                         total:
 *                           type: integer
 *                           description: 清理的日志总条数
 *             example:
 *               success: true
 *               message: "日志清理成功"
 *               data:
 *                 clearedTypes: ["system", "login"]
 *                 beforeDate: "2025-01-01T00:00:00.000Z"
 *                 counts:
 *                   system: 120
 *                   login: 45
 *                 total: 165
 *               timestamp: "2025-09-27T09:30:00.000Z"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const clearLogs = async (req, res) => {
  const payload = req.body || {};
  try {
    const result = await services.auditLog.clearLogs(payload);

    const detail = result?.data || {};
    await recordSystemOperation(req, {
      targetType: 'audit_log',
      targetId: null,
      action: 'logs_clear',
      summary: `清理审计日志: ${(detail.clearedTypes || []).join(', ') || '未指定'}`,
      detail
    });

    res.json(result);
  } catch (error) {
    await recordSystemOperation(req, {
      targetType: 'audit_log',
      targetId: null,
      action: 'logs_clear_failed',
      summary: '清理审计日志失败',
      detail: {
        logType: payload.log_type || payload.logType || 'system',
        error: error.message
      }
    });
    handleError(res, error, '清理审计日志失败');
  }
};

/**
 * @swagger
 * /api/admin/logs/vip:
 *   get:
 *     tags: [审计日志]
 *     summary: 查询用户VIP变更日志
 *     description: 管理员按用户、操作者、时间范围查看VIP授权、续期、取消等记录。
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: 被操作的用户ID
 *       - in: query
 *         name: operator_id
 *         schema:
 *           type: integer
 *         description: 操作者ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: 操作标识（如 vip_user_set、vip_user_extend、vip_user_cancel）
 *       - in: query
 *         name: start_at
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_at
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 模糊搜索摘要或详情
 *     responses:
 *       200:
 *         description: 查询成功
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getVipChangeLogs = async (req, res) => {
  try {
    const result = await services.auditLog.getVipChangeLogs(req.query);
    res.json(result);
  } catch (error) {
    handleError(res, error, '查询VIP变更日志失败');
  }
};

/**
 * @swagger
 * /api/admin/logs/card-keys:
 *   get:
 *     tags: [审计日志]
 *     summary: 查询卡密使用日志
 *     description: 管理员查看卡密兑换记录，可按用户、操作者、时间筛选。
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: 使用卡密的用户ID
 *       - in: query
 *         name: operator_id
 *         schema:
 *           type: integer
 *         description: 操作者ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           default: card_key_redeem
 *       - in: query
 *         name: start_at
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_at
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 模糊搜索摘要或详情
 *     responses:
 *       200:
 *         description: 查询成功
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
const getCardKeyUsageLogs = async (req, res) => {
  try {
    const result = await services.auditLog.getCardKeyUsageLogs(req.query);
    res.json(result);
  } catch (error) {
    handleError(res, error, '查询卡密使用日志失败');
  }
};

module.exports = {
  getLoginLogs,
  getSystemLogs,
  getPointsLogs,
  clearLogs,
  getVipChangeLogs,
  getCardKeyUsageLogs
};
