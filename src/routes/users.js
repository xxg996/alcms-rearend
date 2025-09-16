/**
 * 用户路由
 * 处理用户个人资料管理等用户功能
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const {
  authenticateToken
} = require('../middleware/auth');

// 用户个人功能
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

module.exports = router;