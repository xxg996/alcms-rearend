/**
 * 管理端审计日志路由
 */

const express = require('express');
const router = express.Router();
const auditLogController = require('../../controllers/auditLogController');
const { authenticateToken, requireRole } = require('../../middleware/auth');

// 登录日志
router.get('/login',
  authenticateToken,
  requireRole('admin'),
  auditLogController.getLoginLogs
);

// 系统操作日志
router.get('/system',
  authenticateToken,
  requireRole('admin'),
  auditLogController.getSystemLogs
);

// 积分审计日志
router.get('/points',
  authenticateToken,
  requireRole('admin'),
  auditLogController.getPointsLogs
);

// VIP 变更日志
router.get('/vip',
  authenticateToken,
  requireRole('admin'),
  auditLogController.getVipChangeLogs
);

// 卡密使用日志
router.get('/card-keys',
  authenticateToken,
  requireRole('admin'),
  auditLogController.getCardKeyUsageLogs
);

// 一键清理日志
router.post('/clear',
  authenticateToken,
  requireRole('admin'),
  auditLogController.clearLogs
);

module.exports = router;
