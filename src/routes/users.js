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

// 更新当前用户资料
router.put('/profile', 
  authenticateToken, 
  updateProfileValidation, 
  userController.updateProfile
);

// 管理员功能路由组

// 创建用户（管理员功能）
router.post('/', 
  authenticateToken, 
  requireRole('admin'),
  createUserValidation,
  userController.createUser
);

// 获取用户列表
router.get('/', 
  authenticateToken, 
  requirePermission('user:list'), 
  userController.getUserList
);

// 获取用户统计信息
router.get('/stats', 
  authenticateToken, 
  requireRole('admin'), 
  userController.getUserStats
);

// 获取指定用户信息
router.get('/:userId', 
  authenticateToken, 
  requireOwnershipOrAdmin, 
  userController.getUserById
);

// 删除用户（管理员功能）
router.delete('/:userId', 
  authenticateToken, 
  requireRole('admin'),
  userController.deleteUser
);

// 更新用户状态（封禁/冻结/解除）
router.put('/:userId/status', 
  authenticateToken, 
  requirePermission('user:ban'),
  updateUserStatusValidation,
  userController.updateUserStatus
);

// 冻结/解冻用户（管理员功能）
router.patch('/:userId/freeze', 
  authenticateToken, 
  requireRole('admin'),
  freezeUserValidation,
  userController.freezeUser
);

// 为用户分配角色
router.post('/:userId/roles', 
  authenticateToken, 
  requirePermission('role:assign'),
  assignRoleValidation,
  userController.assignUserRole
);

// 移除用户角色
router.delete('/:userId/roles', 
  authenticateToken, 
  requirePermission('role:assign'),
  assignRoleValidation,
  userController.removeUserRole
);

module.exports = router;
