/**
 * 管理员用户管理路由
 * 处理管理员对用户的管理操作
 */

const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const {
  authenticateToken,
  requirePermission,
  requireRole
} = require('../../middleware/auth');
const {
  createUserValidation,
  updateUserStatusValidation,
  assignRoleValidation,
  freezeUserValidation
} = require('../../middleware/validation');

// 获取用户列表（管理员功能）
router.get('/',
  authenticateToken,
  requireRole('admin'),
  userController.getUserList
);

// 获取用户统计信息（管理员功能）
router.get('/stats',
  authenticateToken,
  requireRole('admin'),
  userController.getUserStats
);

// 根据ID获取用户详情（管理员功能）
router.get('/:id',
  authenticateToken,
  requireRole('admin'),
  userController.getUserById
);

// 创建用户（管理员功能）
router.post('/',
  authenticateToken,
  requireRole('admin'),
  createUserValidation,
  userController.createUser
);

// 更新用户状态（管理员功能）
router.put('/:id/status',
  authenticateToken,
  requireRole('admin'),
  updateUserStatusValidation,
  userController.updateUserStatus
);

// 分配用户角色（管理员功能）
router.post('/:id/assign-role',
  authenticateToken,
  requireRole('admin'),
  assignRoleValidation,
  userController.assignUserRole
);

// 撤销用户角色（管理员功能）
router.delete('/:id/roles/:roleId',
  authenticateToken,
  requireRole('admin'),
  userController.revokeUserRole
);

// 冻结用户（管理员功能）
router.put('/:id/freeze',
  authenticateToken,
  requireRole('admin'),
  freezeUserValidation,
  userController.freezeUser
);

// 解冻用户（管理员功能）
router.put('/:id/unfreeze',
  authenticateToken,
  requireRole('admin'),
  userController.unfreezeUser
);

// 重置用户密码（管理员功能）
router.put('/:id/reset-password',
  authenticateToken,
  requireRole('admin'),
  userController.resetUserPassword
);

// 管理员更新用户资料（管理员功能）
router.put('/:id/profile',
  authenticateToken,
  requireRole('admin'),
  userController.updateUserProfile
);

// 获取用户角色列表（管理员功能）
router.get('/:id/roles',
  authenticateToken,
  requireRole('admin'),
  userController.getUserRoles
);

// 更新用户角色（管理员功能）
router.put('/:id/roles',
  authenticateToken,
  requireRole('admin'),
  userController.updateUserRoles
);

// 获取用户权限列表（管理员功能）
router.get('/:id/permissions',
  authenticateToken,
  requireRole('admin'),
  userController.getUserPermissions
);

// 批量更新用户状态（管理员功能）
router.patch('/batch/status',
  authenticateToken,
  requireRole('admin'),
  userController.batchUpdateUserStatus
);

// 批量删除用户（管理员功能）
router.post('/batch/delete',
  authenticateToken,
  requireRole('admin'),
  userController.batchDeleteUsers
);

module.exports = router;