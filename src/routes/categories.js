/**
 * 分类管理路由
 * 定义分类相关的API端点
 */

const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/categoryController');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { categoryListCache, clearCategoryCache } = require('../middleware/cacheMiddleware');
const { logger } = require('../utils/logger');

// 公开路由（无需认证）

// 获取分类列表（添加缓存）
router.get('/', categoryListCache, CategoryController.getCategories);

// 获取热门分类 - 必须放在 /:id 之前
router.get('/popular', CategoryController.getPopularCategories);
router.get('/popular/list', CategoryController.getPopularCategories);

// 获取单个分类详情
router.get('/:id', CategoryController.getCategory);

// 需要认证和权限的路由

// 创建分类
router.post('/',
  authenticateToken,
  requirePermission('category:create'),
  CategoryController.createCategory,
  clearCategoryCache // 创建后清除缓存
);

// 更新分类
router.put('/:id',
  authenticateToken,
  requirePermission('category:update'),
  CategoryController.updateCategory,
  clearCategoryCache // 更新后清除缓存
);

// 删除分类
router.delete('/:id',
  authenticateToken,
  requirePermission('category:delete'),
  CategoryController.deleteCategory,
  clearCategoryCache // 删除后清除缓存
);


module.exports = router;
