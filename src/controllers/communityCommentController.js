/**
 * 社区评论控制器
 * 处理评论的CRUD操作和楼中楼功能
 * @swagger
 * tags:
 *   name: 社区评论管理相关
 *   description: 社区评论管理相关API
 */

const CommunityComment = require('../models/CommunityComment');
const CommunityPost = require('../models/CommunityPost');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { logger } = require('../utils/logger');

class CommunityCommentController {
  /**
   * @swagger
   * /api/community/posts/{postId}/comments:
   *   get:
   *     summary: 获取帖子的评论列表
   *     description: 获取指定帖子的所有评论，支持分页和排序
   *     tags: [社区评论管理相关]
   *     parameters:
   *       - in: path
   *         name: postId
   *         required: true
   *         schema:
   *           type: integer
   *         description: 帖子ID
   *         example: 1
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: 页码
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: 每页数量
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [created_at, like_count]
   *           default: created_at
   *         description: 排序字段
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [ASC, DESC]
   *           default: ASC
   *         description: 排序方向
   *       - in: query
   *         name: includeChildren
   *         schema:
   *           type: boolean
   *           default: true
   *         description: 是否包含子评论
   *     responses:
   *       200:
   *         description: 获取评论列表成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: object
   *                       properties:
   *                         comments:
   *                           type: array
   *                           items:
   *                             $ref: '#/components/schemas/CommunityComment'
   *                         pagination:
   *                           $ref: '#/components/schemas/Pagination'
   *       404:
   *         description: 帖子不存在
   *       500:
   *         $ref: '#/components/responses/ServerError'
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
      logger.error('获取评论列表失败:', error);
      return errorResponse(res, '获取评论列表失败', 500);
    }
  }

  /**
   * @swagger
   * /api/community/comments/{id}:
   *   get:
   *     summary: 获取评论详情
   *     description: 根据ID获取指定评论的详细信息
   *     tags: [社区评论管理相关]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 评论ID
   *         example: 1
   *     responses:
   *       200:
   *         description: 获取评论详情成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/CommunityComment'
   *       404:
   *         description: 评论不存在
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "评论不存在"
   *       500:
   *         $ref: '#/components/responses/ServerError'
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
      logger.error('获取评论详情失败:', error);
      return errorResponse(res, '获取评论详情失败', 500);
    }
  }

  /**
   * @swagger
   * /api/community/comments:
   *   post:
   *     summary: 创建评论
   *     description: 创建新的评论或回复
   *     tags: [社区评论管理相关]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateCommentRequest'
   *           examples:
   *             comment:
   *               summary: 创建评论
   *               value:
   *                 post_id: 1
   *                 content: "很有用的分享，谢谢作者！"
   *                 content_type: "text"
   *             reply:
   *               summary: 回复评论
   *               value:
   *                 post_id: 1
   *                 parent_id: 5
   *                 content: "我也有同样的想法"
   *                 content_type: "text"
   *     responses:
   *       201:
   *         description: 创建评论成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/CommunityComment'
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         description: 帖子不存在或父评论不存在
   *       500:
   *         $ref: '#/components/responses/ServerError'
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
      logger.error('创建评论失败:', error);
      return errorResponse(res, '创建评论失败', 500);
    }
  }

  /**
   * @swagger
   * /api/community/comments/{id}:
   *   put:
   *     summary: 更新评论
   *     description: 更新指定ID的评论内容，只有评论作者或有相应权限的管理员可以操作
   *     tags: [社区评论管理相关]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 评论ID
   *         example: 1
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - content
   *             properties:
   *               content:
   *                 type: string
   *                 description: 评论内容
   *                 minLength: 1
   *                 maxLength: 2000
   *           example:
   *             content: "更新后的评论内容"
   *     responses:
   *       200:
   *         description: 更新评论成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/CommunityComment'
   *       400:
   *         description: 评论内容不能为空
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "评论内容不能为空"
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         description: 没有权限编辑该评论
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "没有权限编辑该评论"
   *       404:
   *         description: 评论不存在
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "评论不存在"
   *       500:
   *         $ref: '#/components/responses/ServerError'
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
      logger.error('更新评论失败:', error);
      return errorResponse(res, '更新评论失败', 500);
    }
  }

  /**
   * @swagger
   * /api/community/comments/{id}:
   *   delete:
   *     summary: 删除评论
   *     description: 删除指定ID的评论，只有评论作者或有相应权限的管理员可以操作
   *     tags: [社区评论管理相关]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 评论ID
   *         example: 1
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               reason:
   *                 type: string
   *                 description: 删除原因（可选，管理员删除时可提供）
   *                 maxLength: 200
   *           example:
   *             reason: "违反社区规定"
   *     responses:
   *       200:
   *         description: 删除评论成功
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *             example:
   *               success: true
   *               message: "删除评论成功"
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         description: 没有权限删除该评论
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "没有权限删除该评论"
   *       404:
   *         description: 评论不存在
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "评论不存在"
   *       500:
   *         $ref: '#/components/responses/ServerError'
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
      logger.error('删除评论失败:', error);
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
      logger.error('获取用户评论失败:', error);
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
      logger.error('获取子评论数量失败:', error);
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
      logger.error('获取热门评论失败:', error);
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
      logger.error('获取用户评论统计失败:', error);
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
      logger.error('批量删除评论失败:', error);
      return errorResponse(res, '批量删除评论失败', 500);
    }
  }
}

module.exports = CommunityCommentController;
