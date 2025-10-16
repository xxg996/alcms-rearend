/**
 * Alist文件管理路由
 * 提供Alist文件详情获取和下载链接生成的API端点
 */

const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { getResourceFileInfo, generateDownloadLink } = require('../controllers/alistController');

const router = express.Router();

/**
 * 获取资源的Alist文件详情
 */
router.get('/file-info/:resourceId', optionalAuth, getResourceFileInfo);

/**
 * 生成Alist文件下载链接
 */
router.post('/download-link', authenticateToken, generateDownloadLink);

module.exports = router;
