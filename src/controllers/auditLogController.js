/**
 * 审计日志控制器
 * 提供登录日志、系统操作日志与积分审计日志的查询接口
 * @swagger
 * tags:
 *   name: 审计日志
 *   description: 管理员用于排查风险、回溯操作的日志查询接口
 */

const { services } = require('../services');
const { logger } = require('../utils/logger');

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

module.exports = {
  getLoginLogs,
  getSystemLogs,
  getPointsLogs
};
