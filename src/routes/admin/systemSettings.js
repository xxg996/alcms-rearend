/**
 * 系统设置管理路由
 * 提供系统设置的API接口
 */

const express = require('express');
const router = express.Router();
const {
  getAllSettings,
  getSetting,
  upsertSetting,
  deleteSetting,
  batchUpdateSettings,
  resetToDefault,
  getSettingsSchema,
  testEmailService
} = require('../../controllers/admin/systemSettingsController');

// 中间件
const { authenticateToken, requirePermission } = require('../../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     SystemSetting:
 *       type: object
 *       properties:
 *         key:
 *           type: string
 *           description: 设置键名
 *         value:
 *           type: object
 *           description: 设置值（JSON对象）
 *         description:
 *           type: string
 *           description: 设置描述
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *         updated_by:
 *           type: integer
 *           description: 更新者用户ID
 *     SettingUpdate:
 *       type: object
 *       required:
 *         - value
 *       properties:
 *         value:
 *           type: object
 *           description: 设置值
 *         description:
 *           type: string
 *           description: 设置描述
 *     BatchSettingUpdate:
 *       type: object
 *       required:
 *         - settings
 *       properties:
 *         settings:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               value:
 *                 type: object
 *               description:
 *                 type: string
 */

/**
 * @swagger
 * /api/admin/system-settings:
 *   get:
 *     tags: [系统设置管理]
 *     summary: 获取所有系统设置
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SystemSetting'
 */
router.get('/', authenticateToken, requirePermission('system:configure'), getAllSettings);

/**
 * @swagger
 * /api/admin/system-settings/schema:
 *   get:
 *     tags: [系统设置管理]
 *     summary: 获取系统设置模式
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 */
router.get('/schema', authenticateToken, requirePermission('system:configure'), getSettingsSchema);

/**
 * @swagger
 * /api/admin/system-settings/batch:
 *   put:
 *     tags: [系统设置管理]
 *     summary: 批量更新系统设置
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BatchSettingUpdate'
 *     responses:
 *       200:
 *         description: 批量更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SystemSetting'
 */
router.put('/batch', authenticateToken, requirePermission('system:configure'), batchUpdateSettings);

/**
 * @swagger
 * /api/admin/system-settings/{key}:
 *   get:
 *     tags: [系统设置管理]
 *     summary: 获取单个系统设置
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: 设置键名
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                     value:
 *                       type: object
 *       404:
 *         description: 设置不存在
 */
router.get('/:key', authenticateToken, requirePermission('system:configure'), getSetting);

/**
 * @swagger
 * /api/admin/system-settings/{key}:
 *   put:
 *     tags: [系统设置管理]
 *     summary: 更新或创建系统设置
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: 设置键名
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SettingUpdate'
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/SystemSetting'
 */
router.put('/:key', authenticateToken, requirePermission('system:configure'), upsertSetting);

/**
 * @swagger
 * /api/admin/system-settings/{key}:
 *   delete:
 *     tags: [系统设置管理]
 *     summary: 删除系统设置
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: 设置键名
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/SystemSetting'
 *       404:
 *         description: 设置不存在
 */
router.delete('/:key', authenticateToken, requirePermission('system:configure'), deleteSetting);

/**
 * @swagger
 * /api/admin/system-settings/{key}/reset:
 *   post:
 *     tags: [系统设置管理]
 *     summary: 重置系统设置为默认值
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: 设置键名
 *     responses:
 *       200:
 *         description: 重置成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/SystemSetting'
 *       400:
 *         description: 未知的设置项
 */
router.post('/:key/reset', authenticateToken, requirePermission('system:configure'), resetToDefault);

/**
 * @swagger
 * /api/admin/system-settings/test-email:
 *   post:
 *     summary: 测试SMTP邮件发送
 *     description: 管理员测试系统邮件发送功能，包括SMTP连接测试和发送测试邮件
 *     tags: [系统设置管理]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - test_type
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 测试邮件接收地址
 *                 example: "admin@example.com"
 *               test_type:
 *                 type: string
 *                 enum: [connection, send_email]
 *                 description: 测试类型
 *                 example: "send_email"
 *               email_type:
 *                 type: string
 *                 enum: [register, reset_password]
 *                 description: 邮件类型（当test_type为send_email时必需）
 *                 example: "register"
 *           examples:
 *             connectionTest:
 *               summary: SMTP连接测试
 *               value:
 *                 email: "admin@example.com"
 *                 test_type: "connection"
 *             sendEmailTest:
 *               summary: 发送测试邮件
 *               value:
 *                 email: "admin@example.com"
 *                 test_type: "send_email"
 *                 email_type: "register"
 *     responses:
 *       200:
 *         description: 测试成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "邮件发送测试成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     test_type:
 *                       type: string
 *                       example: "send_email"
 *                     email:
 *                       type: string
 *                       example: "admin@example.com"
 *                     verification_code:
 *                       type: string
 *                       description: 发送的验证码（仅在发送邮件测试时返回）
 *                       example: "123456"
 *                     smtp_config:
 *                       type: object
 *                       description: SMTP配置信息
 *                       properties:
 *                         host:
 *                           type: string
 *                           example: "smtp.qq.com"
 *                         port:
 *                           type: integer
 *                           example: 587
 *                         secure:
 *                           type: boolean
 *                           example: false
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingFields:
 *                 summary: 缺少必填字段
 *                 value:
 *                   success: false
 *                   message: "邮箱和测试类型为必填项"
 *               invalidEmail:
 *                 summary: 邮箱格式无效
 *                 value:
 *                   success: false
 *                   message: "邮箱格式不正确"
 *               missingEmailType:
 *                 summary: 缺少邮件类型
 *                 value:
 *                   success: false
 *                   message: "发送邮件测试时必须指定邮件类型"
 *       500:
 *         description: 测试失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               connectionFailed:
 *                 summary: SMTP连接失败
 *                 value:
 *                   success: false
 *                   message: "SMTP连接测试失败"
 *               sendFailed:
 *                 summary: 邮件发送失败
 *                 value:
 *                   success: false
 *                   message: "邮件发送失败"
 */
router.post('/test-email', authenticateToken, requirePermission('system:configure'), testEmailService);

module.exports = router;