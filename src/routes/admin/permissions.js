/**
 * 管理员权限管理路由
 * 处理权限的查询和状态管理操作
 */

const express = require('express');
const router = express.Router();
const rolePermissionController = require('../../controllers/rolePermissionController');
const { authenticateToken, requireRole } = require('../../middleware/auth');

// 需要管理员权限的所有路由
const requireAdmin = [authenticateToken, requireRole('admin')];

// 获取所有权限列表
router.get('/',
  ...requireAdmin,
  rolePermissionController.getAllPermissions
);

// 切换权限状态（启用/禁用）
router.patch('/:permissionId/toggle',
  ...requireAdmin,
  rolePermissionController.togglePermission
);

module.exports = router;