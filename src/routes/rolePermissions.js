/**
 * 角色权限管理路由
 * 处理角色权限的分配、撤销和查询操作
 */

const express = require('express');
const router = express.Router();
const rolePermissionController = require('../controllers/rolePermissionController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// 需要管理员权限的所有路由
const requireAdmin = [authenticateToken, requireRole('admin')];

// 角色管理路由
router.get('/roles', 
  ...requireAdmin, 
  rolePermissionController.getAllRoles
);

// 权限管理路由
router.get('/permissions', 
  ...requireAdmin, 
  rolePermissionController.getAllPermissions
);

// 角色权限管理路由
router.get('/roles/:roleId/permissions', 
  ...requireAdmin, 
  rolePermissionController.getRolePermissions
);

router.post('/roles/:roleId/permissions', 
  ...requireAdmin, 
  rolePermissionController.assignPermissions
);

router.post('/roles/:roleId/permissions/revoke', 
  ...requireAdmin, 
  rolePermissionController.revokePermissions
);

// 权限状态管理
router.patch('/permissions/:permissionId/toggle', 
  ...requireAdmin, 
  rolePermissionController.togglePermission
);

module.exports = router;