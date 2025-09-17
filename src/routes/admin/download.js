/**
 * 管理员下载管理路由
 * 处理管理员对下载系统的管理操作
 */

const express = require('express');
const router = express.Router();
const downloadController = require('../../controllers/downloadController');
const {
  authenticateToken,
  requirePermission
} = require('../../middleware/auth');

// 重置所有用户每日下载次数
router.post('/reset-daily-limits',
  authenticateToken,
  requirePermission('system.manage'),
  downloadController.resetAllDailyDownloads
);

module.exports = router;