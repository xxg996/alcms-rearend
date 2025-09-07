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

// 更新当前用户资料
router.put('/profile', authenticateToken, userController.updateProfile);

// 管理员功能路由组
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

// 更新用户状态（封禁/冻结/解除）
router.put('/:userId/status', 
  authenticateToken, 
  requirePermission('user:ban'), 
  userController.updateUserStatus
);

// 为用户分配角色
router.post('/:userId/roles', 
  authenticateToken, 
  requirePermission('role:assign'), 
  userController.assignUserRole
);

// 移除用户角色
router.delete('/:userId/roles', 
  authenticateToken, 
  requirePermission('role:assign'), 
  userController.removeUserRole
);

module.exports = router;
