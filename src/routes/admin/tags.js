/**
 * 管理员标签管理路由
 * 处理标签统计、清理和维护功能
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission } = require('../../middleware/auth');
const { logger } = require('../../utils/logger');

// 获取标签统计信息
router.get('/stats',
  authenticateToken,
  requirePermission('tag:read'),
  async (req, res) => {
    try {
      const { query } = require('../../config/database');

      const stats = await query(`
        SELECT
          COUNT(*) as total_tags,
          AVG(usage_count) as avg_usage,
          MAX(usage_count) as max_usage,
          COUNT(CASE WHEN usage_count = 0 THEN 1 END) as unused_tags
        FROM tags
      `);

      const tagUsage = await query(`
        SELECT
          t.id,
          t.name,
          t.display_name,
          t.usage_count,
          COUNT(rt.resource_id) as active_usage,
          t.created_at
        FROM tags t
        LEFT JOIN resource_tags rt ON t.id = rt.tag_id
        LEFT JOIN resources r ON rt.resource_id = r.id AND r.status = 'published'
        GROUP BY t.id, t.name, t.display_name, t.usage_count, t.created_at
        ORDER BY active_usage DESC, t.usage_count DESC
        LIMIT 50
      `);

      const tagDistribution = await query(`
        SELECT
          CASE
            WHEN usage_count = 0 THEN '0'
            WHEN usage_count <= 5 THEN '1-5'
            WHEN usage_count <= 10 THEN '6-10'
            WHEN usage_count <= 20 THEN '11-20'
            WHEN usage_count <= 50 THEN '21-50'
            ELSE '50+'
          END as usage_range,
          COUNT(*) as tag_count
        FROM tags
        GROUP BY
          CASE
            WHEN usage_count = 0 THEN '0'
            WHEN usage_count <= 5 THEN '1-5'
            WHEN usage_count <= 10 THEN '6-10'
            WHEN usage_count <= 20 THEN '11-20'
            WHEN usage_count <= 50 THEN '21-50'
            ELSE '50+'
          END
        ORDER BY
          CASE
            WHEN usage_count = 0 THEN 1
            WHEN usage_count <= 5 THEN 2
            WHEN usage_count <= 10 THEN 3
            WHEN usage_count <= 20 THEN 4
            WHEN usage_count <= 50 THEN 5
            ELSE 6
          END
      `);

      res.json({
        success: true,
        data: {
          overview: stats.rows[0],
          usage: tagUsage.rows,
          distribution: tagDistribution.rows
        }
      });
    } catch (error) {
      logger.error('获取标签统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: error.message
      });
    }
  }
);

// 清理未使用的标签
router.delete('/cleanup',
  authenticateToken,
  requirePermission('tag:delete'),
  async (req, res) => {
    try {
      const { query } = require('../../config/database');

      // 查找未使用的标签
      const unusedTags = await query(`
        SELECT t.* FROM tags t
        LEFT JOIN resource_tags rt ON t.id = rt.tag_id
        WHERE rt.tag_id IS NULL AND t.usage_count = 0
      `);

      if (unusedTags.rows.length === 0) {
        return res.json({
          success: true,
          message: '没有需要清理的未使用标签',
          data: { deletedCount: 0 }
        });
      }

      // 删除未使用的标签
      const deleteResult = await query(`
        DELETE FROM tags
        WHERE id IN (
          SELECT t.id FROM tags t
          LEFT JOIN resource_tags rt ON t.id = rt.tag_id
          WHERE rt.tag_id IS NULL AND t.usage_count = 0
        )
      `);

      res.json({
        success: true,
        message: `成功清理 ${deleteResult.rowCount} 个未使用的标签`,
        data: {
          deletedCount: deleteResult.rowCount,
          deletedTags: unusedTags.rows
        }
      });
    } catch (error) {
      logger.error('清理未使用标签失败:', error);
      res.status(500).json({
        success: false,
        message: '清理失败',
        error: error.message
      });
    }
  }
);

// 重新计算标签使用次数
router.post('/recalculate-usage',
  authenticateToken,
  requirePermission('tag:update'),
  async (req, res) => {
    try {
      const { query } = require('../../config/database');

      // 重新计算每个标签的使用次数
      await query(`
        UPDATE tags SET usage_count = (
          SELECT COUNT(*)
          FROM resource_tags rt
          JOIN resources r ON rt.resource_id = r.id
          WHERE rt.tag_id = tags.id AND r.status = 'published'
        )
      `);

      // 获取更新后的统计
      const updatedStats = await query(`
        SELECT
          COUNT(*) as total_tags,
          SUM(usage_count) as total_usage,
          AVG(usage_count) as avg_usage
        FROM tags
      `);

      res.json({
        success: true,
        message: '标签使用次数重新计算完成',
        data: updatedStats.rows[0]
      });
    } catch (error) {
      logger.error('重新计算标签使用次数失败:', error);
      res.status(500).json({
        success: false,
        message: '重新计算失败',
        error: error.message
      });
    }
  }
);

module.exports = router;