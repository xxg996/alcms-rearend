/**
 * 管理员收藏管理路由
 * 处理收藏相关的统计和管理功能
 */

const express = require('express');
const router = express.Router();
const favoriteController = require('../../controllers/favoriteController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

// 获取热门收藏资源
router.get('/popular',
  authenticateToken,
  requireAdmin(),
  favoriteController.getPopularFavorites
);

module.exports = router;