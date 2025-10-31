/**
 * @fileoverview 资源评论路由
 * 处理资源评论相关的API路由
 */

const express = require('express');
const ResourceCommentController = require('../controllers/resourceCommentController');
const { authenticateToken, requirePermission, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// 资源评论相关路由

// 创建评论（需要登录）
router.post('/resources/:id/comments',
  authenticateToken,
  requirePermission('resource_comment:create'),
  ResourceCommentController.createComment
);

// 获取资源评论列表（公开）
router.get('/resources/:id/comments',
  optionalAuth,
  ResourceCommentController.getResourceComments
);

// 获取评论回复列表（公开）
router.get('/comments/:id/replies',
  optionalAuth,
  ResourceCommentController.getCommentReplies
);

// 更新评论（需要登录，只能修改自己的评论）
router.put('/comments/:id',
  authenticateToken,
  ResourceCommentController.updateComment
);

// 删除评论（需要登录，只能删除自己的评论或管理员可删除任意评论）
router.delete('/comments/:id',
  authenticateToken,
  ResourceCommentController.deleteComment
);

// 点赞评论（需要登录）
router.post('/comments/:id/like',
  authenticateToken,
  ResourceCommentController.likeComment
);

// 用户个人评论相关路由

// 获取我的评论列表（需要登录）
router.get('/my/comments',
  authenticateToken,
  ResourceCommentController.getMyComments
);

// 管理员评论管理路由

// 获取所有评论列表（管理员）
router.get('/admin/comments',
  authenticateToken,
  requirePermission('resource_comment:moderate'),
  ResourceCommentController.getAllComments
);

// 审核评论（管理员）
router.put('/admin/comments/:id/approve',
  authenticateToken,
  requirePermission('resource_comment:moderate'),
  ResourceCommentController.approveComment
);

// 获取评论统计信息（管理员）
router.get('/admin/comments/statistics',
  authenticateToken,
  requirePermission('resource_comment:moderate'),
  ResourceCommentController.getCommentStatistics
);

module.exports = router;
