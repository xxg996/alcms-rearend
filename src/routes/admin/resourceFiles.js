/**
 * 管理员资源文件管理路由
 * 处理资源文件的增删改查操作
 */

const express = require('express');
const router = express.Router();
const resourceFileController = require('../../controllers/resourceFileController');
const {
  authenticateToken,
  requirePermission
} = require('../../middleware/auth');

// 获取资源的所有文件
router.get('/resources/:resourceId/files',
  authenticateToken,
  requirePermission('resource.read'),
  resourceFileController.getResourceFiles
);

// 为资源添加文件
router.post('/resources/:resourceId/files',
  authenticateToken,
  requirePermission('resource.create'),
  resourceFileController.createResourceFile
);

// 更新文件排序
router.put('/resources/:resourceId/files/sort',
  authenticateToken,
  requirePermission('resource.update'),
  resourceFileController.updateFileSort
);

// 更新资源文件
router.put('/resource-files/:fileId',
  authenticateToken,
  requirePermission('resource.update'),
  resourceFileController.updateResourceFile
);

// 删除资源文件
router.delete('/resource-files/:fileId',
  authenticateToken,
  requirePermission('resource.delete'),
  resourceFileController.deleteResourceFile
);

// 获取文件统计信息
router.get('/resource-files/statistics',
  authenticateToken,
  requirePermission('resource.read'),
  resourceFileController.getFileStatistics
);

module.exports = router;