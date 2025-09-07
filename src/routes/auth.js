/**
 * 认证相关路由
 * 用户注册、登录、令牌刷新、登出等接口
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// 用户注册
router.post('/register', authController.register);

// 用户登录
router.post('/login', authController.login);

// 刷新访问令牌
router.post('/refresh', authController.refreshToken);

// 用户登出
router.post('/logout', authController.logout);

// 获取当前用户信息（需要认证）
router.get('/profile', authenticateToken, authController.getProfile);

module.exports = router;
