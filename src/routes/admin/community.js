/**
 * 管理员社区管理路由
 * 处理举报管理等社区管理功能
 */

const express = require('express');
const router = express.Router();
const CommunityInteractionController = require('../../controllers/communityInteractionController');
const CommunityPostController = require('../../controllers/communityPostController');
const { authenticateToken, requirePermission } = require('../../middleware/auth');
const { clearPostCache } = require('../../middleware/cacheMiddleware');

// 获取举报列表
router.get('/reports',
  authenticateToken,
  requirePermission('community:report:handle'),
  CommunityInteractionController.getReports
);

// 处理举报
router.patch('/reports/:id',
  authenticateToken,
  requirePermission('community:report:handle'),
  CommunityInteractionController.handleReport
);

// 管理员修改帖子状态
router.put('/posts/:id/status',
  authenticateToken,
  requirePermission('community:moderate'),
  clearPostCache,
  CommunityPostController.adminUpdateStatus
);

// 管理员硬删除帖子
router.delete('/posts/:id/hard-delete',
  authenticateToken,
  requirePermission('community:moderate'),
  clearPostCache,
  CommunityPostController.adminHardDelete
);

module.exports = router;
