/**
 * 资源管理路由
 * 定义资源相关的API端点
 */

const express = require('express');
const router = express.Router();
const ResourceController = require('../controllers/resourceController');
const FrontendContentController = require('../controllers/frontendContentController');
const { authenticateToken, requirePermission, optionalAuth } = require('../middleware/auth');
const { resourceListCache, resourceDetailCache, statsCache, clearResourceCache } = require('../middleware/cacheMiddleware');
const { logger } = require('../utils/logger');

// 公开路由（无需认证）

// 获取公开资源列表（添加缓存）
router.get('/', optionalAuth, resourceListCache, ResourceController.getResources);

// 前端展示资源
router.get('/frontend', FrontendContentController.getRandomVideoResources);

// 获取单个资源详情（添加缓存）
router.get('/:id', optionalAuth, resourceDetailCache, ResourceController.getResource);

// 获取资源统计信息（添加缓存）
router.get('/stats/overview', statsCache, ResourceController.getResourceStats);

// 需要认证的路由

// 创建资源（需要登录和创建权限）
router.post('/',
  authenticateToken,
  requirePermission('resource:create'),
  clearResourceCache, // 创建时清除缓存
  ResourceController.createResource
);

// 更新资源（需要登录，权限在控制器中检查）
router.put('/:id',
  authenticateToken,
  clearResourceCache, // 更新时清除缓存
  ResourceController.updateResource
);

// 删除资源（需要登录，权限在控制器中检查）
router.delete('/:id',
  authenticateToken,
  clearResourceCache, // 删除时清除缓存
  ResourceController.deleteResource
);

// 资源点赞状态与操作
router.get('/:id/like',
  optionalAuth,
  ResourceController.getResourceLikeStatus
);

router.post('/:id/like',
  authenticateToken,
  ResourceController.toggleLike
);

// 获取资源点赞列表
router.get('/:id/likes',
  optionalAuth,
  ResourceController.getResourceLikes
);

// 注意：下载功能已迁移到 /api/admin/resources/:id/files 和 /api/user/download/:fileId

module.exports = router;
