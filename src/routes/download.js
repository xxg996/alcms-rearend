/**
 * 下载管理路由
 * 处理用户下载统计和相关操作
 */

const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/downloadController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// 获取用户下载统计
router.get('/download-stats',
  authenticateToken,
  downloadController.getUserDownloadStatistics
);

// 获取资源文件列表（包含用户下载状态信息）
router.get('/files/:resourceId',
  optionalAuth,
  downloadController.getResourceFilesList
);

// 下载资源文件
router.get('/file/:resourceId',
  authenticateToken,
  downloadController.downloadResourceFiles
);

// 下载资源文件（按资源ID）
router.get('/download/:resourceId',
  authenticateToken,
  downloadController.downloadResource
);

// 下载单个文件（按文件ID）
router.get('/file-download/:fileId',
  authenticateToken,
  downloadController.downloadSingleFile
);

// 获取当前用户文件统计
router.get('/user-filestats',
  authenticateToken,
  downloadController.getCurrentUserStats
);

module.exports = router;