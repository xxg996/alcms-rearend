/**
 * 管理员资源管理路由
 * 处理资源的批量操作和统计功能
 */

const express = require('express');
const router = express.Router();
const ResourceController = require('../../controllers/resourceController');
const { authenticateToken, requirePermission } = require('../../middleware/auth');
const { clearResourceCache } = require('../../middleware/cacheMiddleware');
const { logger } = require('../../utils/logger');

// 获取所有资源（包括私有和草稿）
router.get('/all',
  authenticateToken,
  requirePermission('resource:read'),
  (req, res, next) => {
    // 允许管理员查看所有状态的资源
    req.query.includeAll = 'true';
    next();
  },
  ResourceController.getResources
);

// 批量更新资源状态处理器
async function batchUpdateResources(req, res) {
  try {
    const { resourceIds, updateData } = req.body;

    if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '资源ID列表不能为空'
      });
    }

    const Resource = require('../../models/Resource');
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
    logger.error('批量更新资源失败:', error);
    res.status(500).json({
      success: false,
      message: '批量更新失败',
      error: error.message
    });
  }
}

// 批量更新资源状态
router.patch('/batch-update',
  authenticateToken,
  requirePermission('resource:update'),
  clearResourceCache, // 成功响应后清理资源缓存（列表/详情）
  batchUpdateResources
);

// 获取详细统计信息
router.get('/stats/detailed',
  authenticateToken,
  requirePermission('system:configure'),
  async (req, res) => {
    try {
      const { query } = require('../../config/database');

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
      logger.error('获取详细统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: error.message
      });
    }
  }
);

module.exports = router;
