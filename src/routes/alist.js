/**
 * Alist文件管理路由
 * 提供Alist文件详情获取和下载链接生成的API端点
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getResourceFileInfo, generateDownloadLink } = require('../controllers/alistController');

const router = express.Router();

// 所有Alist相关路由都需要用户认证
router.use(authenticateToken);

/**
 * 获取资源的Alist文件详情
 */
router.get('/file-info/:resourceId', getResourceFileInfo);

/**
 * 生成Alist文件下载链接
 */
router.post('/download-link', generateDownloadLink);

module.exports = router;