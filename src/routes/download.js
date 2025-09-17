/**
 * 下载管理路由
 * 处理用户下载统计和相关操作
 */

const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/downloadController');
const { authenticateToken } = require('../middleware/auth');

// 获取用户下载统计
router.get('/download-stats',
  authenticateToken,
  downloadController.getUserDownloadStatistics
);

// 下载资源文件
router.get('/file/:resourceId',
  authenticateToken,
  downloadController.downloadResourceFiles
);

module.exports = router;