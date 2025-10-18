/**
 * Alist管理路由
 * 提供Alist系统的管理员功能接口
 */

const express = require('express');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const {
  getAlistConfig,
  updateAlistConfig,
  getAlistIngestSettings,
  createAlistIngestSetting,
  updateAlistIngestSetting,
  deleteAlistIngestSetting,
  scanAlistIngestSetting,
  getAlistResources,
  addAlistResource,
  deleteAlistResource,
  deleteAlistResourceById,
  getAlistStats,
  refreshAlistToken,
  getAlistTokenStatus
} = require('../../controllers/admin/alistController');

const router = express.Router();

// 所有Alist管理路由都需要管理员权限
router.use(authenticateToken);
router.use(requireRole('admin'));

/**
 * 获取Alist系统配置
 */
router.get('/config', getAlistConfig);

/**
 * 更新Alist系统配置
 */
router.put('/config', updateAlistConfig);

/**
 * 入库配置管理
 */
router.get('/ingest/settings', getAlistIngestSettings);
router.post('/ingest/settings', createAlistIngestSetting);
router.put('/ingest/settings/:id', updateAlistIngestSetting);
router.delete('/ingest/settings/:id', deleteAlistIngestSetting);
router.post('/ingest/settings/:id/scan', scanAlistIngestSetting);

/**
 * 获取Alist资源关联列表
 */
router.get('/resources', getAlistResources);

/**
 * 为资源添加Alist文件关联
 */
router.post('/resources/:resourceId', addAlistResource);

/**
 * 删除资源的Alist文件关联
 */
router.delete('/resources/:resourceId', deleteAlistResource);

/**
 * 删除单个Alist文件关联
 */
router.delete('/resources/items/:alistResourceId', deleteAlistResourceById);

/**
 * 获取Alist系统统计信息
 */
router.get('/stats', getAlistStats);

/**
 * 手动刷新Alist Token
 */
router.post('/token/refresh', refreshAlistToken);

/**
 * 获取Alist Token状态
 */
router.get('/token/status', getAlistTokenStatus);

module.exports = router;
