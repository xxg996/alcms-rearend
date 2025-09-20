/**
 * 资源文件管理路由（支持作者权限）
 * 处理资源文件的增删改查操作，支持资源作者和管理员权限
 */

const express = require('express');
const router = express.Router();
const resourceFileController = require('../controllers/resourceFileController');
const Resource = require('../models/Resource');
const {
  authenticateToken,
  requirePermission
} = require('../middleware/auth');

/**
 * 检查用户是否有权限操作指定资源
 * 管理员或资源作者可以操作
 */
const checkResourcePermission = async (req, res, next) => {
  try {
    const { resourceId } = req.params;
    const userId = req.user.id;
    const userRoles = req.user.roles || [];

    // 如果是管理员，直接放行
    if (userRoles.includes('admin') || userRoles.includes('super_admin')) {
      return next();
    }

    // 检查是否是资源作者
    if (resourceId) {
      const resource = await Resource.findById(parseInt(resourceId));
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: '资源不存在'
        });
      }

      if (resource.author_id === userId) {
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: '没有权限操作此资源'
    });
  } catch (error) {
    console.error('权限检查失败:', error);
    return res.status(500).json({
      success: false,
      message: '权限检查失败'
    });
  }
};

/**
 * 检查用户是否有权限操作指定文件
 * 通过文件ID查找对应的资源，然后检查权限
 */
const checkFilePermission = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;
    const userRoles = req.user.roles || [];

    // 如果是管理员，直接放行
    if (userRoles.includes('admin') || userRoles.includes('super_admin')) {
      return next();
    }

    // 通过文件ID查找资源
    if (fileId) {
      const { query } = require('../config/database');
      const result = await query(`
        SELECT r.author_id
        FROM resource_files rf
        JOIN resources r ON rf.resource_id = r.id
        WHERE rf.id = $1 AND rf.deleted_at IS NULL
      `, [parseInt(fileId)]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        });
      }

      if (result.rows[0].author_id === userId) {
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: '没有权限操作此文件'
    });
  } catch (error) {
    console.error('权限检查失败:', error);
    return res.status(500).json({
      success: false,
      message: '权限检查失败'
    });
  }
};

// 获取资源的所有文件（作者和管理员）
router.get('/resources/:resourceId/files',
  authenticateToken,
  checkResourcePermission,
  resourceFileController.getResourceFiles
);

// 为资源添加文件（作者和管理员）
router.post('/resources/:resourceId/files',
  authenticateToken,
  checkResourcePermission,
  resourceFileController.createResourceFile
);

// 更新文件排序（作者和管理员）
router.put('/resources/:resourceId/files/sort',
  authenticateToken,
  checkResourcePermission,
  resourceFileController.updateFileSort
);

// 更新资源文件（作者和管理员）
router.put('/resource-files/:fileId',
  authenticateToken,
  checkFilePermission,
  resourceFileController.updateResourceFile
);

// 删除资源文件（作者和管理员）
router.post('/resource-files/:fileId/delete',
  authenticateToken,
  checkFilePermission,
  resourceFileController.deleteResourceFile
);

// 管理员专属功能：获取文件统计信息
router.get('/resource-files/statistics',
  authenticateToken,
  requirePermission('resource:read'),
  resourceFileController.getFileStatistics
);

// 管理员专属功能：批量删除资源文件
router.post('/resource-files/batch-delete',
  authenticateToken,
  requirePermission('resource:delete'),
  resourceFileController.batchDeleteResourceFiles
);

// 管理员专属功能：批量更新资源文件
router.post('/resource-files/batch-update',
  authenticateToken,
  requirePermission('resource:update'),
  resourceFileController.batchUpdateResourceFiles
);

module.exports = router;
