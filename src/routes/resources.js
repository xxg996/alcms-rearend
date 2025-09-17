/**
 * 资源管理路由
 * 定义资源相关的API端点
 */

const express = require('express');
const router = express.Router();
const ResourceController = require('../controllers/resourceController');
const { authenticateToken, requirePermission, optionalAuth } = require('../middleware/auth');
const { resourceListCache, resourceDetailCache, statsCache, clearResourceCache } = require('../middleware/cacheMiddleware');
const { logger } = require('../utils/logger');

// 公开路由（无需认证）

// 获取公开资源列表（添加缓存）
router.get('/', optionalAuth, resourceListCache, ResourceController.getResources);

// 获取单个资源详情（添加缓存）
router.get('/:id', optionalAuth, resourceDetailCache, ResourceController.getResource);

// 搜索资源（不缓存，因为查询结果变化大）
router.get('/search/query', ResourceController.searchResources);

// 获取资源统计信息（添加缓存）
router.get('/stats/overview', statsCache, ResourceController.getResourceStats);

// 需要认证的路由

// 创建资源（需要登录和创建权限）
router.post('/', 
  authenticateToken, 
  requirePermission('resource:create'),
  ResourceController.createResource,
  clearResourceCache // 创建后清除缓存
);

// 更新资源（需要登录，权限在控制器中检查）
router.put('/:id', 
  authenticateToken,
  ResourceController.updateResource,
  clearResourceCache // 更新后清除缓存
);

// 删除资源（需要登录，权限在控制器中检查）
router.delete('/:id', 
  authenticateToken,
  ResourceController.deleteResource,
  clearResourceCache // 删除后清除缓存
);

// 注意：下载功能已迁移到 /api/admin/resources/:id/files 和 /api/user/download/:fileId

module.exports = router;
