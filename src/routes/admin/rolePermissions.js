/**
 * 角色权限管理路由
 * 处理角色权限的分配、撤销和查询操作
 */

const express = require('express');
const router = express.Router();
const rolePermissionController = require('../../controllers/rolePermissionController');
const { authenticateToken, requireRole } = require('../../middleware/auth');

// 需要管理员权限的所有路由
const requireAdmin = [authenticateToken, requireRole('admin')];

// 角色管理路由
router.get('/',
  ...requireAdmin,
  rolePermissionController.getAllRoles
);

// 创建角色
router.post('/',
  ...requireAdmin,
  rolePermissionController.createRole
);

// 删除角色（使用POST方法）
router.post('/delete',
  ...requireAdmin,
  rolePermissionController.deleteRole
);

// 角色权限管理路由
router.get('/:roleId/permissions',
  ...requireAdmin,
  rolePermissionController.getRolePermissions
);

router.post('/:roleId/permissions',
  ...requireAdmin,
  rolePermissionController.assignPermissions
);

router.post('/:roleId/permissions/revoke',
  ...requireAdmin,
  rolePermissionController.revokePermissions
);


module.exports = router;