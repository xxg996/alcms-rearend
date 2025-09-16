/**
 * 标签管理路由
 * 定义标签相关的API端点
 */

const express = require('express');
const router = express.Router();
const TagController = require('../controllers/tagController');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// 公开路由（无需认证）

// 获取标签列表
router.get('/', TagController.getTags);

// 获取单个标签详情
router.get('/:id', TagController.getTag);

// 搜索标签
router.get('/search/query', TagController.searchTags);

// 获取热门标签
router.get('/popular/list', TagController.getPopularTags);

// 需要认证和权限的路由

// 创建标签
router.post('/', 
  authenticateToken, 
  requirePermission('tag:create'),
  TagController.createTag
);

// 更新标签
router.put('/:id', 
  authenticateToken,
  requirePermission('tag:update'),
  TagController.updateTag
);

// 删除标签
router.delete('/:id', 
  authenticateToken,
  requirePermission('tag:delete'),
  TagController.deleteTag
);

// 批量创建标签
router.post('/batch-create',
  authenticateToken,
  requirePermission('tag:create'),
  TagController.createTags
);


module.exports = router;
