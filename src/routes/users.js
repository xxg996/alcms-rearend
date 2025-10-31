/**
 * 用户路由
 * 处理用户个人资料管理等用户功能
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const userFollowController = require('../controllers/userFollowController');
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

module.exports = router;
