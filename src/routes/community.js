/**
 * 社区模块路由配置
 * 集成板块、帖子、评论、互动功能的路由
 */

const express = require('express');
const router = express.Router();

// 导入控制器
const CommunityBoardController = require('../controllers/communityBoardController');
const CommunityPostController = require('../controllers/communityPostController');
const CommunityCommentController = require('../controllers/communityCommentController');
const CommunityInteractionController = require('../controllers/communityInteractionController');

// 导入中间件
const { authenticateToken, requirePermission } = require('../middleware/auth');

// ================================
// 板块管理路由
// ================================

// 获取板块列表
router.get('/boards', CommunityBoardController.getBoards);

// 获取板块详情
router.get('/boards/:id', CommunityBoardController.getBoardById);

// 搜索板块
router.get('/boards/search/query', CommunityBoardController.searchBoards);

// 获取板块统计
router.get('/boards/:id/stats', CommunityBoardController.getBoardStats);

// 创建板块 (需要管理员权限)
router.post('/boards', 
  authenticateToken, 
  requirePermission('community.board.manage'), 
  CommunityBoardController.createBoard
);

// 更新板块 (需要管理员权限)
router.put('/boards/:id', 
  authenticateToken, 
  requirePermission('community.board.manage'), 
  CommunityBoardController.updateBoard
);

// 删除板块 (需要管理员权限)
router.delete('/boards/:id', 
  authenticateToken, 
  requirePermission('community.board.manage'), 
  CommunityBoardController.deleteBoard
);

// 批量更新板块排序 (需要管理员权限)
router.patch('/boards/batch/sort', 
  authenticateToken, 
  requirePermission('community.board.manage'), 
  CommunityBoardController.batchUpdateSort
);

// 批量创建板块 (需要管理员权限)
router.post('/boards/batch/create', 
  authenticateToken, 
  requirePermission('community.board.manage'), 
  CommunityBoardController.batchCreateBoards
);

// 添加版主 (需要管理员权限)
router.post('/boards/:id/moderators', 
  authenticateToken, 
  requirePermission('community.board.manage'), 
  CommunityBoardController.addModerator
);

// 移除版主 (需要管理员权限)
router.delete('/boards/:id/moderators', 
  authenticateToken, 
  requirePermission('community.board.manage'), 
  CommunityBoardController.removeModerator
);

// ================================
// 帖子管理路由
// ================================

// 获取帖子列表
router.get('/posts', CommunityPostController.getPosts);

// 获取帖子详情
router.get('/posts/:id', CommunityPostController.getPostById);

// 搜索帖子
router.get('/posts/search/query', CommunityPostController.searchPosts);

// 获取热门帖子
router.get('/posts/hot/list', CommunityPostController.getHotPosts);

// 获取用户的帖子列表
router.get('/posts/user/:userId', CommunityPostController.getUserPosts);

// 获取用户帖子统计
router.get('/posts/user/:userId/stats', CommunityPostController.getUserPostStats);

// 创建帖子 (需要登录)
router.post('/posts', 
  authenticateToken, 
  requirePermission('community.post.create'), 
  CommunityPostController.createPost
);

// 更新帖子 (需要登录)
router.put('/posts/:id', 
  authenticateToken, 
  requirePermission('community.post.edit_own'), 
  CommunityPostController.updatePost
);

// 删除帖子 (需要登录)
router.delete('/posts/:id', 
  authenticateToken, 
  requirePermission('community.post.delete_own'), 
  CommunityPostController.deletePost
);

// 置顶帖子 (需要版主或管理员权限)
router.patch('/posts/:id/pin', 
  authenticateToken, 
  requirePermission('community.post.pin'), 
  CommunityPostController.pinPost
);

// 设置精华帖 (需要版主或管理员权限)
router.patch('/posts/:id/feature', 
  authenticateToken, 
  requirePermission('community.post.feature'), 
  CommunityPostController.featurePost
);

// 锁定帖子 (需要版主或管理员权限)
router.patch('/posts/:id/lock', 
  authenticateToken, 
  requirePermission('community.post.lock'), 
  CommunityPostController.lockPost
);

// 批量更新帖子 (需要管理员权限)
router.patch('/posts/batch/update', 
  authenticateToken, 
  requirePermission('community.moderate'), 
  CommunityPostController.batchUpdatePosts
);

// ================================
// 评论管理路由
// ================================

// 获取帖子的评论列表
router.get('/posts/:postId/comments', CommunityCommentController.getCommentsByPostId);

// 获取评论详情
router.get('/comments/:id', CommunityCommentController.getCommentById);

// 获取热门评论
router.get('/posts/:postId/comments/hot', CommunityCommentController.getHotComments);

// 获取用户的评论列表
router.get('/comments/user/:userId', CommunityCommentController.getUserComments);

// 获取用户评论统计
router.get('/comments/user/:userId/stats', CommunityCommentController.getUserCommentStats);

// 获取子评论数量
router.get('/comments/:id/children/count', CommunityCommentController.getChildrenCount);

// 创建评论 (需要登录)
router.post('/comments', 
  authenticateToken, 
  requirePermission('community.comment.create'), 
  CommunityCommentController.createComment
);

// 更新评论 (需要登录)
router.put('/comments/:id', 
  authenticateToken, 
  requirePermission('community.comment.edit_own'), 
  CommunityCommentController.updateComment
);

// 删除评论 (需要登录)
router.delete('/comments/:id', 
  authenticateToken, 
  requirePermission('community.comment.delete_own'), 
  CommunityCommentController.deleteComment
);

// 批量删除评论 (需要管理员权限)
router.delete('/comments/batch/delete', 
  authenticateToken, 
  requirePermission('community.comment.delete_any'), 
  CommunityCommentController.batchDeleteComments
);

// ================================
// 互动功能路由
// ================================

// 点赞/取消点赞
router.post('/interactions/like', 
  authenticateToken, 
  requirePermission('community.like'), 
  CommunityInteractionController.toggleLike
);

// 收藏/取消收藏
router.post('/interactions/favorite', 
  authenticateToken, 
  requirePermission('community.favorite'), 
  CommunityInteractionController.toggleFavorite
);

// 分享帖子
router.post('/interactions/share', 
  authenticateToken, 
  requirePermission('community.share'), 
  CommunityInteractionController.sharePost
);

// 举报内容
router.post('/interactions/report', 
  authenticateToken, 
  requirePermission('community.report'), 
  CommunityInteractionController.reportContent
);

// 获取用户点赞列表
router.get('/interactions/likes/user/:userId', CommunityInteractionController.getUserLikes);

// 获取用户收藏列表
router.get('/interactions/favorites/user/:userId', CommunityInteractionController.getUserFavorites);

// 获取用户互动统计
router.get('/interactions/stats/user/:userId', CommunityInteractionController.getUserInteractionStats);

// 检查用户是否点赞了内容
router.get('/interactions/like/check', 
  authenticateToken, 
  CommunityInteractionController.checkUserLike
);

// 检查用户是否收藏了帖子
router.get('/interactions/favorite/check', 
  authenticateToken, 
  CommunityInteractionController.checkUserFavorite
);

// ================================
// 管理员功能路由
// ================================


module.exports = router;
