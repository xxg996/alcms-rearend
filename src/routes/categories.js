/**
 * 分类管理路由
 * 定义分类相关的API端点
 */

const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/categoryController');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// 公开路由（无需认证）

// 获取分类列表
router.get('/', CategoryController.getCategories);

// 获取单个分类详情
router.get('/:id', CategoryController.getCategory);

// 获取热门分类
router.get('/popular/list', CategoryController.getPopularCategories);

// 需要认证和权限的路由

// 创建分类
router.post('/', 
  authenticateToken, 
  requirePermission('category:create'),
  CategoryController.createCategory
);

// 更新分类
router.put('/:id', 
  authenticateToken,
  requirePermission('category:update'),
  CategoryController.updateCategory
);

// 删除分类
router.delete('/:id', 
  authenticateToken,
  requirePermission('category:delete'),
  CategoryController.deleteCategory
);

// 管理员专用路由

// 批量创建分类
router.post('/admin/batch-create',
  authenticateToken,
  requirePermission('category:create'),
  async (req, res) => {
    try {
      const { categories } = req.body;

      if (!Array.isArray(categories) || categories.length === 0) {
        return res.status(400).json({
          success: false,
          message: '分类数据格式错误'
        });
      }

      const Category = require('../models/Category');
      const results = [];
      const errors = [];

      for (const categoryData of categories) {
        try {
          const { name, displayName, description, parentId, sortOrder, iconUrl } = categoryData;
          
          if (!name || !displayName) {
            errors.push({
              category: categoryData,
              error: '分类名称和显示名称为必填字段'
            });
            continue;
          }

          const processedCategoryData = {
            name: name.toLowerCase().trim(),
            displayName: displayName.trim(),
            description,
            parentId: parentId ? parseInt(parentId) : null,
            sortOrder: sortOrder ? parseInt(sortOrder) : 0,
            iconUrl
          };

          const category = await Category.create(processedCategoryData);
          results.push(category);
        } catch (error) {
          errors.push({
            category: categoryData,
            error: error.message
          });
        }
      }

      res.status(201).json({
        success: true,
        message: `成功创建 ${results.length} 个分类`,
        data: {
          created: results,
          errors: errors.length > 0 ? errors : undefined
        }
      });
    } catch (error) {
      logger.error('批量创建分类失败:', error);
      res.status(500).json({
        success: false,
        message: '批量创建分类失败',
        error: error.message
      });
    }
  }
);

// 批量更新分类排序
router.patch('/admin/batch-sort',
  authenticateToken,
  requirePermission('category:update'),
  async (req, res) => {
    try {
      const { categories } = req.body;

      if (!Array.isArray(categories) || categories.length === 0) {
        return res.status(400).json({
          success: false,
          message: '分类排序数据格式错误'
        });
      }

      const Category = require('../models/Category');
      const results = [];

      for (const { id, sortOrder } of categories) {
        try {
          const updatedCategory = await Category.update(parseInt(id), {
            sortOrder: parseInt(sortOrder)
          });
          results.push(updatedCategory);
        } catch (error) {
          logger.error(`更新分类 ${id} 排序失败:`, error);
        }
      }

      res.json({
        success: true,
        message: `成功更新 ${results.length} 个分类排序`,
        data: results
      });
    } catch (error) {
      logger.error('批量更新分类排序失败:', error);
      res.status(500).json({
        success: false,
        message: '批量更新排序失败',
        error: error.message
      });
    }
  }
);

// 获取分类统计信息
router.get('/admin/stats',
  authenticateToken,
  requirePermission('category:read'),
  async (req, res) => {
    try {
      const { query } = require('../config/database');

      const stats = await query(`
        SELECT 
          COUNT(*) as total_categories,
          COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as root_categories,
          COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END) as sub_categories,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_categories
        FROM categories
      `);

      const categoryUsage = await query(`
        SELECT 
          c.id,
          c.name,
          c.display_name,
          COUNT(r.id) as resource_count,
          SUM(r.view_count) as total_views
        FROM categories c
        LEFT JOIN resources r ON c.id = r.category_id AND r.status = 'published'
        GROUP BY c.id, c.name, c.display_name
        ORDER BY resource_count DESC, total_views DESC
      `);

      res.json({
        success: true,
        data: {
          overview: stats.rows[0],
          usage: categoryUsage.rows
        }
      });
    } catch (error) {
      logger.error('获取分类统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: error.message
      });
    }
  }
);

module.exports = router;
