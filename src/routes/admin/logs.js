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

module.exports = router;
