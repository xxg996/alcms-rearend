/**
 * 缓存管理路由
 * 提供缓存清理和管理的API端点
 */

const express = require('express');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const { clearAllCache, getCacheStatus } = require('../../controllers/admin/cacheController');

const router = express.Router();

// 所有缓存管理路由都需要管理员权限
router.use(authenticateToken);
router.use(requireRole('admin'));

/**
 * 一键清理所有缓存
 */
router.post('/clear', clearAllCache);

/**
 * 获取缓存状态
 */
router.get('/status', getCacheStatus);

module.exports = router;