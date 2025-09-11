/**
 * 资源收藏路由
 * 定义收藏功能相关的API端点
 */

const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 需要认证的用户功能路由

// 切换收藏状态（收藏/取消收藏）
router.post('/resources/:resourceId/toggle', 
  authenticateToken, 
  favoriteController.toggleFavorite
);

// 检查单个资源收藏状态
router.get('/resources/:resourceId/status', 
  authenticateToken, 
  favoriteController.checkFavoriteStatus
);

// 批量检查资源收藏状态
router.post('/resources/batch-check', 
  authenticateToken, 
  favoriteController.batchCheckFavoriteStatus
);

// 获取用户收藏的资源列表
router.get('/my-favorites', 
  authenticateToken, 
  favoriteController.getUserFavorites
);

// 获取用户收藏统计信息
router.get('/my-stats', 
  authenticateToken, 
  favoriteController.getUserFavoriteStats
);

// 批量取消收藏
router.delete('/batch-remove', 
  authenticateToken, 
  favoriteController.batchRemoveFavorites
);

// 公开访问的路由

// 获取资源收藏统计信息（不需要认证，任何人都可以查看）
router.get('/resources/:resourceId/stats', 
  favoriteController.getResourceFavoriteStats
);

// 管理员功能路由

// 获取热门收藏资源
router.get('/admin/popular', 
  authenticateToken, 
  requireAdmin(), 
  favoriteController.getPopularFavorites
);

module.exports = router;