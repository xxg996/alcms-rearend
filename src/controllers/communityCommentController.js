/**
 * 社区评论控制器
 * 处理评论的CRUD操作和楼中楼功能
 */

const CommunityComment = require('../models/CommunityComment');
const CommunityPost = require('../models/CommunityPost');
const { successResponse, errorResponse } = require('../utils/responseHelper');

class CommunityCommentController {
  /**
   * 获取帖子的评论列表
   */
  static async getCommentsByPostId(req, res) {
    try {
      const { postId } = req.params;
      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'ASC'
      } = req.query;

      const userId = req.user?.id;

      // 验证帖子是否存在
      const post = await CommunityPost.findById(parseInt(postId));
      if (!post) {
        return errorResponse(res, '帖子不存在', 404);
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder,
        userId
      };

      const result = await CommunityComment.findByPostId(parseInt(postId), options);
      
      return successResponse(res, '获取评论列表成功', result);
    } catch (error) {
      console.error('获取评论列表失败:', error);
      return errorResponse(res, '获取评论列表失败', 500);
    }
  }

  /**
   * 获取评论详情
   */
  static async getCommentById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const comment = await CommunityComment.findById(parseInt(id), userId);
      
      if (!comment) {
        return errorResponse(res, '评论不存在', 404);
      }

      return successResponse(res, '获取评论详情成功', comment);
    } catch (error) {
      console.error('获取评论详情失败:', error);
      return errorResponse(res, '获取评论详情失败', 500);
    }
  }

  /**
   * 创建评论
   */
  static async createComment(req, res) {
    try {
      const {
        content,
        postId,
        parentId,
        replyToUserId
      } = req.body;

      const authorId = req.user.id;

      // 验证必填字段
      if (!content || !postId) {
        return errorResponse(res, '内容和帖子ID不能为空', 400);
      }

      // 验证帖子是否存在
      const post = await CommunityPost.findById(postId);
      if (!post) {
        return errorResponse(res, '帖子不存在', 404);
      }

      // 检查帖子是否被锁定
      if (post.is_locked) {
        return errorResponse(res, '该帖子已被锁定，无法评论', 400);
      }

      // 如果是回复评论，验证父评论是否存在
      if (parentId) {
        const parentComment = await CommunityComment.findById(parentId);
        if (!parentComment) {
          return errorResponse(res, '父评论不存在', 404);
        }
        if (parentComment.post_id !== postId) {
          return errorResponse(res, '父评论不属于该帖子', 400);
        }
      }

      const commentData = {
        content,
        authorId,
        postId,
        parentId: parentId || null,
        replyToUserId: replyToUserId || null
      };

      const newComment = await CommunityComment.create(commentData);
      
      return successResponse(res, '创建评论成功', newComment, 201);
    } catch (error) {
      console.error('创建评论失败:', error);
      return errorResponse(res, '创建评论失败', 500);
    }
  }

  /**
   * 更新评论
   */
  static async updateComment(req, res) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      if (!content) {
        return errorResponse(res, '评论内容不能为空', 400);
      }

      // 获取原评论信息
      const originalComment = await CommunityComment.findById(parseInt(id));
      if (!originalComment) {
        return errorResponse(res, '评论不存在', 404);
      }

      // 权限检查：只有作者可以编辑自己的评论
      if (originalComment.author_id !== userId) {
        return errorResponse(res, '只能编辑自己的评论', 403);
      }

      const updatedComment = await CommunityComment.update(parseInt(id), { content });
      
      return successResponse(res, '更新评论成功', updatedComment);
    } catch (error) {
      console.error('更新评论失败:', error);
      return errorResponse(res, '更新评论失败', 500);
    }
  }

  /**
   * 删除评论
   */
  static async deleteComment(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      // 获取评论信息
      const comment = await CommunityComment.findById(parseInt(id));
      if (!comment) {
        return errorResponse(res, '评论不存在', 404);
      }

      // 权限检查：作者可以删除自己的评论，管理员可以删除任意评论
      const hasPermission = req.user.permissions.includes('community.comment.delete_any') || 
                           comment.author_id === userId;
      
      if (!hasPermission) {
        return errorResponse(res, '没有权限删除该评论', 403);
      }

      const success = await CommunityComment.delete(parseInt(id), reason, userId);
      
      if (!success) {
        return errorResponse(res, '删除评论失败', 500);
      }

      return successResponse(res, '删除评论成功');
    } catch (error) {
      console.error('删除评论失败:', error);
      return errorResponse(res, '删除评论失败', 500);
    }
  }

  /**
   * 获取用户的评论列表
   */
  static async getUserComments(req, res) {
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

      const result = await CommunityComment.findByUserId(parseInt(userId), options);
      
      return successResponse(res, '获取用户评论成功', result);
    } catch (error) {
      console.error('获取用户评论失败:', error);
      return errorResponse(res, '获取用户评论失败', 500);
    }
  }

  /**
   * 获取评论的子评论数量
   */
  static async getChildrenCount(req, res) {
    try {
      const { id } = req.params;
      
      const count = await CommunityComment.getChildrenCount(parseInt(id));
      
      return successResponse(res, '获取子评论数量成功', { count });
    } catch (error) {
      console.error('获取子评论数量失败:', error);
      return errorResponse(res, '获取子评论数量失败', 500);
    }
  }

  /**
   * 获取热门评论
   */
  static async getHotComments(req, res) {
    try {
      const { postId } = req.params;
      const { limit = 5 } = req.query;

      // 验证帖子是否存在
      const post = await CommunityPost.findById(parseInt(postId));
      if (!post) {
        return errorResponse(res, '帖子不存在', 404);
      }

      const comments = await CommunityComment.getHotComments(parseInt(postId), parseInt(limit));
      
      return successResponse(res, '获取热门评论成功', comments);
    } catch (error) {
      console.error('获取热门评论失败:', error);
      return errorResponse(res, '获取热门评论失败', 500);
    }
  }

  /**
   * 获取用户评论统计
   */
  static async getUserCommentStats(req, res) {
    try {
      const { userId } = req.params;
      
      const stats = await CommunityComment.getUserStats(parseInt(userId));
      
      return successResponse(res, '获取用户评论统计成功', stats);
    } catch (error) {
      console.error('获取用户评论统计失败:', error);
      return errorResponse(res, '获取用户评论统计失败', 500);
    }
  }

  /**
   * 批量删除评论（管理员功能）
   */
  static async batchDeleteComments(req, res) {
    try {
      const { commentIds, reason } = req.body;
      const userId = req.user.id;
      
      if (!Array.isArray(commentIds) || commentIds.length === 0) {
        return errorResponse(res, '评论ID列表不能为空', 400);
      }

      const results = [];
      const errors = [];

      for (const commentId of commentIds) {
        try {
          const success = await CommunityComment.delete(commentId, reason, userId);
          if (success) {
            results.push(commentId);
          } else {
            errors.push(`评论 ID ${commentId}: 删除失败`);
          }
        } catch (error) {
          errors.push(`评论 ID ${commentId}: ${error.message}`);
        }
      }

      const result = {
        deleted: results,
        deletedCount: results.length,
        totalCount: commentIds.length,
        errors
      };

      if (results.length > 0) {
        return successResponse(res, `成功删除 ${results.length} 条评论`, result);
      } else {
        return errorResponse(res, '所有评论删除失败', 400, result);
      }
    } catch (error) {
      console.error('批量删除评论失败:', error);
      return errorResponse(res, '批量删除评论失败', 500);
    }
  }
}

module.exports = CommunityCommentController;
