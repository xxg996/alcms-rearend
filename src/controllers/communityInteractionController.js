/**
 * 社区互动控制器
 * 处理点赞、收藏、分享、举报等互动功能
 */

const CommunityInteraction = require('../models/CommunityInteraction');
const CommunityPost = require('../models/CommunityPost');
const CommunityComment = require('../models/CommunityComment');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { logger } = require('../utils/logger');

class CommunityInteractionController {
  /**
   * 点赞或取消点赞
   */
  static async toggleLike(req, res) {
    try {
      const { targetType, targetId } = req.body;
      const userId = req.user.id;

      // 验证参数
      if (!targetType || !targetId) {
        return errorResponse(res, '目标类型和ID不能为空', 400);
      }

      if (!['post', 'comment'].includes(targetType)) {
        return errorResponse(res, '无效的目标类型', 400);
      }

      // 验证目标是否存在
      if (targetType === 'post') {
        const post = await CommunityPost.findById(targetId);
        if (!post) {
          return errorResponse(res, '帖子不存在', 404);
        }
      } else if (targetType === 'comment') {
        const comment = await CommunityComment.findById(targetId);
        if (!comment) {
          return errorResponse(res, '评论不存在', 404);
        }
      }

      const result = await CommunityInteraction.toggleLike(userId, targetType, targetId);
      
      return successResponse(res, `${result.action === 'liked' ? '点赞' : '取消点赞'}成功`, result);
    } catch (error) {
      logger.error('点赞操作失败:', error);
      return errorResponse(res, '点赞操作失败', 500);
    }
  }

  /**
   * 收藏或取消收藏帖子
   */
  static async toggleFavorite(req, res) {
    try {
      const { postId } = req.body;
      const userId = req.user.id;

      if (!postId) {
        return errorResponse(res, '帖子ID不能为空', 400);
      }

      // 验证帖子是否存在
      const post = await CommunityPost.findById(postId);
      if (!post) {
        return errorResponse(res, '帖子不存在', 404);
      }

      const result = await CommunityInteraction.toggleFavorite(userId, postId);
      
      return successResponse(res, `${result.action === 'favorited' ? '收藏' : '取消收藏'}成功`, result);
    } catch (error) {
      logger.error('收藏操作失败:', error);
      return errorResponse(res, '收藏操作失败', 500);
    }
  }

  /**
   * 分享帖子
   */
  static async sharePost(req, res) {
    try {
      const { postId, platform = 'link' } = req.body;
      const userId = req.user.id;

      if (!postId) {
        return errorResponse(res, '帖子ID不能为空', 400);
      }

      // 验证帖子是否存在
      const post = await CommunityPost.findById(postId);
      if (!post) {
        return errorResponse(res, '帖子不存在', 404);
      }

      // 验证分享平台
      const validPlatforms = ['wechat', 'weibo', 'qq', 'link'];
      if (!validPlatforms.includes(platform)) {
        return errorResponse(res, '无效的分享平台', 400);
      }

      const result = await CommunityInteraction.sharePost(userId, postId, platform);
      
      return successResponse(res, '分享成功', result);
    } catch (error) {
      logger.error('分享失败:', error);
      return errorResponse(res, '分享失败', 500);
    }
  }

  /**
   * 举报内容
   */
  static async reportContent(req, res) {
    try {
      const {
        targetType,
        targetId,
        reason,
        description
      } = req.body;

      const reporterId = req.user.id;

      // 验证必填字段
      if (!targetType || !targetId || !reason) {
        return errorResponse(res, '目标类型、ID和举报原因不能为空', 400);
      }

      // 验证目标类型
      if (!['post', 'comment', 'user'].includes(targetType)) {
        return errorResponse(res, '无效的举报目标类型', 400);
      }

      // 验证举报原因
      const validReasons = ['spam', 'inappropriate', 'harassment', 'fake', 'other'];
      if (!validReasons.includes(reason)) {
        return errorResponse(res, '无效的举报原因', 400);
      }

      // 验证目标是否存在
      if (targetType === 'post') {
        const post = await CommunityPost.findById(targetId);
        if (!post) {
          return errorResponse(res, '帖子不存在', 404);
        }
      } else if (targetType === 'comment') {
        const comment = await CommunityComment.findById(targetId);
        if (!comment) {
          return errorResponse(res, '评论不存在', 404);
        }
      }

      const reportData = {
        reporterId,
        targetType,
        targetId,
        reason,
        description
      };

      const report = await CommunityInteraction.reportContent(reportData);
      
      return successResponse(res, '举报提交成功', report, 201);
    } catch (error) {
      logger.error('举报失败:', error);
      if (error.message === '您已经举报过该内容') {
        return errorResponse(res, error.message, 400);
      }
      return errorResponse(res, '举报失败', 500);
    }
  }

  /**
   * 获取用户的点赞列表
   */
  static async getUserLikes(req, res) {
    try {
      const { userId } = req.params;
      const {
        page = 1,
        limit = 20,
        targetType
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        targetType
      };

      const result = await CommunityInteraction.getUserLikes(parseInt(userId), options);
      
      return successResponse(res, '获取用户点赞列表成功', result);
    } catch (error) {
      logger.error('获取用户点赞列表失败:', error);
      return errorResponse(res, '获取用户点赞列表失败', 500);
    }
  }

  /**
   * 获取用户的收藏列表
   */
  static async getUserFavorites(req, res) {
    try {
      const { userId } = req.params;
      const {
        page = 1,
        limit = 20
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const result = await CommunityInteraction.getUserFavorites(parseInt(userId), options);
      
      return successResponse(res, '获取用户收藏列表成功', result);
    } catch (error) {
      logger.error('获取用户收藏列表失败:', error);
      return errorResponse(res, '获取用户收藏列表失败', 500);
    }
  }

  /**
   * 获取举报列表（管理员功能）
   */
  static async getReports(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status = 'pending',
        targetType,
        reason
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        targetType,
        reason
      };

      const result = await CommunityInteraction.getReports(options);
      
      return successResponse(res, '获取举报列表成功', result);
    } catch (error) {
      logger.error('获取举报列表失败:', error);
      return errorResponse(res, '获取举报列表失败', 500);
    }
  }

  /**
   * 处理举报（管理员功能）
   */
  static async handleReport(req, res) {
    try {
      const { id } = req.params;
      const { status, handlerNote } = req.body;
      const handlerId = req.user.id;

      // 验证必填字段
      if (!status) {
        return errorResponse(res, '处理状态不能为空', 400);
      }

      // 验证状态值
      const validStatuses = ['reviewing', 'resolved', 'rejected'];
      if (!validStatuses.includes(status)) {
        return errorResponse(res, '无效的处理状态', 400);
      }

      const handleData = {
        handlerId,
        status,
        handlerNote
      };

      const report = await CommunityInteraction.handleReport(parseInt(id), handleData);
      
      if (!report) {
        return errorResponse(res, '举报不存在', 404);
      }

      return successResponse(res, '处理举报成功', report);
    } catch (error) {
      logger.error('处理举报失败:', error);
      return errorResponse(res, '处理举报失败', 500);
    }
  }

  /**
   * 获取用户互动统计
   */
  static async getUserInteractionStats(req, res) {
    try {
      const { userId } = req.params;
      
      const stats = await CommunityInteraction.getUserInteractionStats(parseInt(userId));
      
      return successResponse(res, '获取用户互动统计成功', stats);
    } catch (error) {
      logger.error('获取用户互动统计失败:', error);
      return errorResponse(res, '获取用户互动统计失败', 500);
    }
  }

  /**
   * 检查用户是否点赞了内容
   */
  static async checkUserLike(req, res) {
    try {
      const { targetType, targetId } = req.query;
      const userId = req.user.id;

      if (!targetType || !targetId) {
        return errorResponse(res, '目标类型和ID不能为空', 400);
      }

      const isLiked = await CommunityInteraction.isLiked(userId, targetType, parseInt(targetId));
      
      return successResponse(res, '检查点赞状态成功', { isLiked });
    } catch (error) {
      logger.error('检查点赞状态失败:', error);
      return errorResponse(res, '检查点赞状态失败', 500);
    }
  }

  /**
   * 检查用户是否收藏了帖子
   */
  static async checkUserFavorite(req, res) {
    try {
      const { postId } = req.query;
      const userId = req.user.id;

      if (!postId) {
        return errorResponse(res, '帖子ID不能为空', 400);
      }

      const isFavorited = await CommunityInteraction.isFavorited(userId, parseInt(postId));
      
      return successResponse(res, '检查收藏状态成功', { isFavorited });
    } catch (error) {
      logger.error('检查收藏状态失败:', error);
      return errorResponse(res, '检查收藏状态失败', 500);
    }
  }
}

module.exports = CommunityInteractionController;
