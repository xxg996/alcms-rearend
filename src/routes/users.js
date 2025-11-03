/**
 * 用户路由
 * 处理用户个人资料管理等用户功能
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const userFollowController = require('../controllers/userFollowController');
const creatorController = require('../controllers/creatorController');
const {
  authenticateToken,
  optionalAuth
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

// 修改邮箱
router.put('/email',
  authenticateToken,
  userController.changeEmail
);

// 修改密码
router.put('/password',
  authenticateToken,
  userController.changePassword
);

// 关注用户
router.post('/:id/follow',
  authenticateToken,
  userFollowController.followUser
);

// 取消关注
router.delete('/:id/follow',
  authenticateToken,
  userFollowController.unfollowUser
);

// 关注状态
router.get('/:id/follow-status',
  optionalAuth,
  userFollowController.getFollowStatus
);

// 我的粉丝
router.get('/followers',
  authenticateToken,
  userFollowController.getFollowers
);

// 我的关注
router.get('/following',
  authenticateToken,
  userFollowController.getFollowing
);

// 创作者统计
router.get('/creator/stats',
  authenticateToken,
  creatorController.getCreatorStats
);

// 创作者资源列表
router.get('/creator/resources',
  authenticateToken,
  creatorController.getCreatorResources
);

// 获取指定用户详情（公开）
router.get('/:id',
  optionalAuth,
  userController.getUserById
);

module.exports = router;
