/**
 * 用户管理路由
 * 用户资料修改、用户管理（管理员功能）等接口
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { 
  authenticateToken, 
  requirePermission, 
  requireRole, 
  requireOwnershipOrAdmin 
} = require('../middleware/auth');
const {
  createUserValidation,
  updateUserStatusValidation,
  assignRoleValidation,
  updateProfileValidation,
  freezeUserValidation
} = require('../middleware/validation');

// 获取当前用户资料
router.get('/profile', 
  authenticateToken, 
  userController.getProfile
);

// 更新当前用户资料
router.put('/profile', 
  authenticateToken, 
  userController.updateProfile
);

// 修改密码
router.put('/password', 
  authenticateToken, 
  userController.changePassword
);

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

// 获取指定用户信息（管理员功能）
router.get('/:id', 
  authenticateToken, 
  requireRole('admin'), 
  userController.getUserById
);

// 创建用户（管理员功能）
router.post('/', 
  authenticateToken, 
  requireRole('admin'), 
  userController.createUser
);

// 删除用户（管理员功能）
router.delete('/:id', 
  authenticateToken, 
  requireRole('admin'), 
  userController.deleteUser
);

// 更新用户状态（管理员功能）
router.put('/:id/status', 
  authenticateToken, 
  requireRole('admin'),
  userController.updateUserStatus
);

// 分配用户角色（管理员功能）
router.post('/:id/roles', 
  authenticateToken, 
  requireRole('admin'), 
  userController.assignUserRole
);

// 移除用户角色（管理员功能）
router.delete('/:id/roles', 
  authenticateToken, 
  requireRole('admin'), 
  userController.removeUserRole
);

// 获取用户角色列表（管理员功能）
router.get('/:id/roles', 
  authenticateToken, 
  requireRole('admin'), 
  userController.getUserRoles
);

// 获取用户权限列表（管理员功能）
router.get('/:id/permissions', 
  authenticateToken, 
  requireRole('admin'), 
  userController.getUserPermissions
);

module.exports = router;
