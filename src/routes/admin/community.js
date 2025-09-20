/**
 * 管理员社区管理路由
 * 处理举报管理等社区管理功能
 */

const express = require('express');
const router = express.Router();
const CommunityInteractionController = require('../../controllers/communityInteractionController');
const { authenticateToken, requirePermission } = require('../../middleware/auth');

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

module.exports = router;
