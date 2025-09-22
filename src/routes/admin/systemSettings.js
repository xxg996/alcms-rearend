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
  getSettingsSchema
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

module.exports = router;