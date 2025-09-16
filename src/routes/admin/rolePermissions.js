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

// 权限管理路由 - 在 /api/admin/permissions 路径下
router.get('/',
  ...requireAdmin,
  (req, res, next) => {
    // 如果是权限管理路径，调用权限控制器
    if (req.originalUrl.includes('/permissions') && !req.originalUrl.includes('/roles')) {
      return rolePermissionController.getAllPermissions(req, res, next);
    }
    // 否则继续到下一个中间件（角色管理）
    next();
  }
);

// 权限状态管理 - 在 /api/admin/permissions 路径下
router.patch('/:permissionId/toggle',
  ...requireAdmin,
  (req, res, next) => {
    // 只在权限路径下响应
    if (req.originalUrl.includes('/permissions')) {
      return rolePermissionController.togglePermission(req, res, next);
    }
    next();
  }
);

module.exports = router;