/**
 * 资源管理路由
 * 定义资源相关的API端点
 */

const express = require('express');
const router = express.Router();
const ResourceController = require('../controllers/resourceController');
const { authenticateToken, requirePermission, optionalAuth } = require('../middleware/auth');

// 公开路由（无需认证）

// 获取公开资源列表
router.get('/', optionalAuth, ResourceController.getResources);

// 获取单个资源详情
router.get('/:id', optionalAuth, ResourceController.getResource);

// 搜索资源
router.get('/search/query', ResourceController.searchResources);

// 获取资源统计信息（公开统计）
router.get('/stats/overview', ResourceController.getResourceStats);

// 需要认证的路由

// 创建资源（需要登录和创建权限）
router.post('/', 
  authenticateToken, 
  requirePermission('resource:create'),
  ResourceController.createResource
);

// 更新资源（需要登录，权限在控制器中检查）
router.put('/:id', 
  authenticateToken,
  ResourceController.updateResource
);

// 删除资源（需要登录，权限在控制器中检查）
router.delete('/:id', 
  authenticateToken,
  ResourceController.deleteResource
);

// 下载资源（需要登录，权限在控制器中检查）
router.post('/:id/download', 
  authenticateToken,
  ResourceController.downloadResource
);

// 下载资源（GET方法，支持URL参数）
router.get('/:id/download', 
  authenticateToken,
  ResourceController.downloadResource
);

// 管理员专用路由

// 获取所有资源（包括私有和草稿）
router.get('/admin/all',
  authenticateToken,
  requirePermission('resource:read'),
  (req, res, next) => {
    // 允许管理员查看所有状态的资源
    req.query.includeAll = 'true';
    next();
  },
  ResourceController.getResources
);

// 批量更新资源状态
router.patch('/admin/batch-update',
  authenticateToken,
  requirePermission('resource:update'),
  async (req, res) => {
    try {
      const { resourceIds, updateData } = req.body;

      if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '资源ID列表不能为空'
        });
      }

      const Resource = require('../models/Resource');
      const results = [];
      const errors = [];

      for (const id of resourceIds) {
        try {
          const updatedResource = await Resource.update(parseInt(id), updateData);
          results.push(updatedResource);
        } catch (error) {
          errors.push({
            resourceId: id,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        message: `成功更新 ${results.length} 个资源`,
        data: {
          updated: results,
          errors: errors.length > 0 ? errors : undefined
        }
      });
    } catch (error) {
      console.error('批量更新资源失败:', error);
      res.status(500).json({
        success: false,
        message: '批量更新失败',
        error: error.message
      });
    }
  }
);

// 获取详细统计信息（管理员专用）
router.get('/admin/stats/detailed',
  authenticateToken,
  requirePermission('system:configure'),
  async (req, res) => {
    try {
      const { query } = require('../config/database');

      // 按日期统计
      const dailyStats = await query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as resources_created,
          SUM(view_count) as total_views,
          SUM(download_count) as total_downloads
        FROM resources
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      // 按作者统计
      const authorStats = await query(`
        SELECT 
          u.username,
          u.nickname,
          COUNT(r.id) as resource_count,
          SUM(r.view_count) as total_views,
          SUM(r.download_count) as total_downloads
        FROM users u
        LEFT JOIN resources r ON u.id = r.author_id
        GROUP BY u.id, u.username, u.nickname
        HAVING COUNT(r.id) > 0
        ORDER BY resource_count DESC
        LIMIT 20
      `);

      // 热门资源
      const popularResources = await query(`
        SELECT 
          r.id, r.title, r.view_count, r.download_count,
          u.username as author_username,
          c.display_name as category_name
        FROM resources r
        LEFT JOIN users u ON r.author_id = u.id
        LEFT JOIN categories c ON r.category_id = c.id
        WHERE r.status = 'published' AND r.is_public = true
        ORDER BY (r.view_count + r.download_count * 2) DESC
        LIMIT 20
      `);

      res.json({
        success: true,
        data: {
          dailyStats: dailyStats.rows,
          authorStats: authorStats.rows,
          popularResources: popularResources.rows
        }
      });
    } catch (error) {
      console.error('获取详细统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: error.message
      });
    }
  }
);

module.exports = router;
