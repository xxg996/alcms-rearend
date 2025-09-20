/**
 * 标签管理路由
 * 定义标签相关的API端点
 */

const express = require('express');
const router = express.Router();
const TagController = require('../controllers/tagController');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { tagListCache, clearTagCache } = require('../middleware/cacheMiddleware');
const { logger } = require('../utils/logger');

// 公开路由（无需认证）

// 获取标签列表（添加缓存）
router.get('/', tagListCache, TagController.getTags);

// 获取单个标签详情
router.get('/:id', TagController.getTag);


// 获取热门标签
router.get('/popular/list', TagController.getPopularTags);

// 需要认证和权限的路由

// 创建标签
router.post('/',
  authenticateToken,
  requirePermission('tag:create'),
  clearTagCache, // 创建时清除缓存
  TagController.createTag
);

// 更新标签
router.put('/:id',
  authenticateToken,
  requirePermission('tag:update'),
  clearTagCache, // 更新时清除缓存
  TagController.updateTag
);


// 批量创建标签
router.post('/batch-create',
  authenticateToken,
  requirePermission('tag:create'),
  clearTagCache, // 批量创建时清除缓存
  TagController.createTags
);

// 删除标签（POST方法）
router.post('/delete/:id',
  authenticateToken,
  requirePermission('tag:delete'),
  clearTagCache, // 删除时清除缓存
  TagController.deleteTag
);

module.exports = router;
