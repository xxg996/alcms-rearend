/**
 * @fileoverview 资源评论控制器
 * 处理资源评论相关的HTTP请求
 */

const ResourceComment = require('../models/ResourceComment');
const { logger } = require('../utils/logger');

class ResourceCommentController {
  /**
   * @swagger
   * /api/resources/{id}/comments:
   *   post:
   *     summary: 创建资源评论
   *     tags: [资源评论]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 资源ID
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
   *                 example: "这个资源很有用，谢谢分享！"
   *               parent_id:
   *                 type: integer
   *                 description: 父评论ID（回复评论时使用）
   *                 example: 123
   *     responses:
   *       201:
   *         description: 评论创建成功
   *       400:
   *         description: 请求参数错误
   *       401:
   *         description: 未授权
   *       404:
   *         description: 资源不存在
   */
  static async createComment(req, res) {
    try {
      const { id: resourceId } = req.params;
      const { content, parent_id } = req.body;
      const userId = req.user.id;

      // 验证请求参数
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '评论内容不能为空'
        });
      }

      if (content.length > 1000) {
        return res.status(400).json({
          success: false,
          message: '评论内容不能超过1000个字符'
        });
      }

      // 创建评论
      const comment = await ResourceComment.createComment({
        resource_id: parseInt(resourceId),
        user_id: userId,
        content: content.trim(),
        parent_id: parent_id || null
      });

      // 获取完整的评论信息
      const fullComment = await ResourceComment.getCommentById(comment.id);

      logger.info('用户创建资源评论', { userId, resourceId, commentId: comment.id });

      res.status(201).json({
        success: true,
        message: '评论创建成功',
        data: fullComment
      });
    } catch (error) {
      logger.error('创建资源评论失败:', error);

      if (error.message.includes('父评论下的子评论数量不能超过999条')) {
        return res.status(400).json({
          success: false,
          message: '该评论的回复数量已达上限'
        });
      }

      if (error.message.includes('父评论不存在')) {
        return res.status(404).json({
          success: false,
          message: '父评论不存在'
        });
      }

      if (error.message.includes('子评论必须与父评论属于同一资源')) {
        return res.status(400).json({
          success: false,
          message: '子评论必须与父评论属于同一资源'
        });
      }

      if (error.message.includes('指定的资源不存在')) {
        return res.status(404).json({
          success: false,
          message: '指定的资源不存在'
        });
      }

      res.status(500).json({
        success: false,
        message: '创建评论失败'
      });
    }
  }

  /**
   * @swagger
   * /api/resources/{id}/comments:
   *   get:
   *     summary: 获取资源评论列表
   *     description: 返回资源的评论及嵌套回复；未登录用户仅看到已审核评论，登录用户可同时看到自己待审核的评论
   *     tags: [资源评论]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 资源ID
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: 页码
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: 每页数量
   *     responses:
   *       200:
   *         description: 获取成功
   *       404:
   *         description: 资源不存在
   */
  static async getResourceComments(req, res) {
    try {
      const { id: resourceId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const authUserId = req.user?.id ? parseInt(req.user.id) : null;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const result = await ResourceComment.getResourceComments(parseInt(resourceId), {
        limit: parseInt(limit),
        offset,
        approved_only: true,
        user_id: authUserId
      });

      res.json({
        success: true,
        message: '获取评论列表成功',
        data: {
          comments: result.data,
          pagination: result.pagination
        }
      });
    } catch (error) {
      logger.error('获取资源评论列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取评论列表失败'
      });
    }
  }

  /**
   * @swagger
  * /api/comments/{id}/replies:
  *   get:
  *     summary: 获取评论回复列表
  *     description: 返回指定评论的回复；未登录用户仅看到已审核回复，登录用户可同时看到自己待审核的回复
  *     tags: [资源评论]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 父评论ID
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: 页码
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *         description: 每页数量
   *     responses:
   *       200:
   *         description: 获取成功
   *       404:
   *         description: 评论不存在
   */
  static async getCommentReplies(req, res) {
    try {
      const { id: parentId } = req.params;
      const { page = 1, limit = 10 } = req.query;
      const authUserId = req.user?.id ? parseInt(req.user.id) : null;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const result = await ResourceComment.getCommentReplies(parseInt(parentId), {
        limit: parseInt(limit),
        offset,
        approved_only: true,
        user_id: authUserId
      });

      res.json({
        success: true,
        message: '获取回复列表成功',
        data: {
          replies: result.data,
          pagination: result.pagination
        }
      });
    } catch (error) {
      logger.error('获取评论回复列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取回复列表失败'
      });
    }
  }

  /**
   * @swagger
   * /api/comments/{id}:
   *   put:
   *     summary: 更新评论内容
   *     tags: [资源评论]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 评论ID
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
   *                 description: 新的评论内容
   *                 example: "更新后的评论内容"
   *     responses:
   *       200:
   *         description: 更新成功
   *       400:
   *         description: 请求参数错误
   *       401:
   *         description: 未授权
   *       403:
   *         description: 无权限修改
   *       404:
   *         description: 评论不存在
   */
  static async updateComment(req, res) {
    try {
      const { id: commentId } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      // 验证请求参数
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '评论内容不能为空'
        });
      }

      if (content.length > 1000) {
        return res.status(400).json({
          success: false,
          message: '评论内容不能超过1000个字符'
        });
      }

      const updatedComment = await ResourceComment.updateComment(
        parseInt(commentId),
        userId,
        content.trim()
      );

      logger.info('用户更新评论', { userId, commentId });

      res.json({
        success: true,
        message: '评论更新成功',
        data: updatedComment
      });
    } catch (error) {
      logger.error('更新评论失败:', error);

      if (error.message.includes('评论不存在或无权限修改')) {
        return res.status(403).json({
          success: false,
          message: '无权限修改此评论'
        });
      }

      res.status(500).json({
        success: false,
        message: '更新评论失败'
      });
    }
  }

  /**
   * @swagger
   * /api/comments/{id}:
   *   delete:
   *     summary: 删除评论
   *     tags: [资源评论]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 评论ID
   *     responses:
   *       200:
   *         description: 删除成功
   *       401:
   *         description: 未授权
   *       403:
   *         description: 无权限删除
   *       404:
   *         description: 评论不存在
   */
  static async deleteComment(req, res) {
    try {
      const { id: commentId } = req.params;
      const userId = req.user.id;
      const userRoles = req.user.roles || [];
      const isAdmin = userRoles.some(role => ['admin', 'super_admin'].includes(role.name));

      const deletedComment = await ResourceComment.deleteComment(
        parseInt(commentId),
        userId,
        isAdmin
      );

      logger.info('用户删除评论', { userId, commentId, isAdmin });

      res.json({
        success: true,
        message: '评论删除成功',
        data: deletedComment
      });
    } catch (error) {
      logger.error('删除评论失败:', error);

      if (error.message.includes('评论不存在或无权限删除')) {
        return res.status(403).json({
          success: false,
          message: '无权限删除此评论'
        });
      }

      res.status(500).json({
        success: false,
        message: '删除评论失败'
      });
    }
  }

  /**
   * @swagger
   * /api/comments/{id}/like:
   *   post:
   *     summary: 点赞评论
   *     tags: [资源评论]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 评论ID
   *     responses:
   *       200:
   *         description: 点赞成功
   *       401:
   *         description: 未授权
   *       404:
   *         description: 评论不存在
   */
  static async likeComment(req, res) {
    try {
      const { id: commentId } = req.params;
      const userId = req.user.id;

      const parsedCommentId = parseInt(commentId, 10);
      if (Number.isNaN(parsedCommentId) || parsedCommentId <= 0) {
        return res.status(400).json({
          success: false,
          message: '评论ID格式不正确'
        });
      }

      const updatedComment = await ResourceComment.likeComment(parsedCommentId, userId);

      logger.info('用户点赞评论', { userId, commentId: parsedCommentId });

      res.json({
        success: true,
        message: '点赞成功',
        data: {
          comment_id: updatedComment.id,
          like_count: updatedComment.like_count
        }
      });
    } catch (error) {
      logger.error('点赞评论失败:', error);

      if (error.code === 'ALREADY_LIKED') {
        return res.status(400).json({
          success: false,
          message: '您已赞过该评论'
        });
      }

      if (error.message.includes('评论不存在')) {
        return res.status(404).json({
          success: false,
          message: '评论不存在'
        });
      }

      res.status(500).json({
        success: false,
        message: '点赞失败'
      });
    }
  }

  /**
   * @swagger
   * /api/my/comments:
   *   get:
   *     summary: 获取我的评论列表
   *     tags: [资源评论]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: 页码
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: 每页数量
   *     responses:
   *       200:
   *         description: 获取成功
   *       401:
   *         description: 未授权
   */
  static async getMyComments(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const result = await ResourceComment.getUserComments(userId, {
        limit: parseInt(limit),
        offset
      });

      res.json({
        success: true,
        message: '获取我的评论列表成功',
        data: {
          comments: result.data,
          pagination: result.pagination
        }
      });
    } catch (error) {
      logger.error('获取用户评论列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取评论列表失败'
      });
    }
  }

  // 管理员功能

  /**
   * @swagger
   * /api/admin/comments:
   *   get:
   *     summary: 管理员获取所有评论列表
   *     tags: [管理员-资源评论]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: 页码
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: 每页数量
   *       - in: query
   *         name: resource_id
   *         schema:
   *           type: integer
   *         description: 资源ID过滤
   *       - in: query
   *         name: approved
   *         schema:
   *           type: string
   *           enum: [pending, approved, all]
   *           default: all
   *         description: 审核状态过滤
   *     responses:
   *       200:
   *         description: 获取成功
   *       401:
   *         description: 未授权
   *       403:
   *         description: 权限不足
   */
  static async getAllComments(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        resource_id: resourceIdRaw,
        approved: approvedRaw = 'all'
      } = req.query;

      const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
      const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

      let resourceId = null;
      if (resourceIdRaw !== undefined) {
        resourceId = parseInt(resourceIdRaw, 10);
        if (Number.isNaN(resourceId) || resourceId <= 0) {
          return res.status(400).json({
            success: false,
            message: 'resource_id 参数必须为正整数'
          });
        }
      }

      const approved = approvedRaw ? approvedRaw.toString().toLowerCase() : 'all';
      const allowedApproved = ['all', 'pending', 'approved'];
      if (!allowedApproved.includes(approved)) {
        return res.status(400).json({
          success: false,
          message: 'approved 参数仅支持 all、pending、approved'
        });
      }

      const result = await ResourceComment.getAdminComments({
        page: parsedPage,
        limit: parsedLimit,
        resourceId,
        approved
      });

      res.json({
        success: true,
        message: '获取评论列表成功',
        data: {
          comments: result.data,
          pagination: result.pagination
        }
      });
    } catch (error) {
      logger.error('管理员获取评论列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取评论列表失败'
      });
    }
  }

  /**
   * @swagger
   * /api/admin/comments/{id}/approve:
   *   put:
   *     summary: 管理员审核评论
   *     tags: [管理员-资源评论]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: 评论ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - approved
   *             properties:
   *               approved:
   *                 type: boolean
   *                 description: 是否通过审核
   *                 example: true
   *     responses:
   *       200:
   *         description: 审核成功
   *       401:
   *         description: 未授权
   *       403:
   *         description: 权限不足
   *       404:
   *         description: 评论不存在
   */
  static async approveComment(req, res) {
    try {
      const { id: commentId } = req.params;
      const { approved } = req.body;

      const parsedCommentId = parseInt(commentId, 10);
      if (Number.isNaN(parsedCommentId) || parsedCommentId <= 0) {
        return res.status(400).json({
          success: false,
          message: '评论ID格式不正确'
        });
      }

      if (approved === undefined || approved === null) {
        return res.status(400).json({
          success: false,
          message: '缺少 approved 参数'
        });
      }

      let approvedValue;
      if (typeof approved === 'boolean') {
        approvedValue = approved;
      } else if (typeof approved === 'string') {
        const lower = approved.trim().toLowerCase();
        if (['true', '1'].includes(lower)) {
          approvedValue = true;
        } else if (['false', '0'].includes(lower)) {
          approvedValue = false;
        }
      } else if (typeof approved === 'number') {
        if (approved === 1) {
          approvedValue = true;
        } else if (approved === 0) {
          approvedValue = false;
        }
      }

      if (approvedValue === undefined) {
        return res.status(400).json({
          success: false,
          message: 'approved 参数必须为布尔值'
        });
      }

      const updatedComment = await ResourceComment.approveComment(
        parsedCommentId,
        approvedValue
      );

      logger.info('管理员审核评论', {
        adminId: req.user.id,
        commentId: parsedCommentId,
        approved: approvedValue
      });

      res.json({
        success: true,
        message: approvedValue ? '评论审核通过' : '评论审核拒绝',
        data: updatedComment
      });
    } catch (error) {
      logger.error('管理员审核评论失败:', error);

      if (error.message.includes('评论不存在')) {
        return res.status(404).json({
          success: false,
          message: '评论不存在'
        });
      }

      res.status(500).json({
        success: false,
        message: '审核评论失败'
      });
    }
  }

  /**
   * @swagger
   * /api/admin/comments/statistics:
   *   get:
   *     summary: 获取评论统计信息
   *     tags: [管理员-资源评论]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: resource_id
   *         schema:
   *           type: integer
   *         description: 资源ID（可选）
   *     responses:
   *       200:
   *         description: 获取成功
   *       401:
   *         description: 未授权
   *       403:
   *         description: 权限不足
   */
  static async getCommentStatistics(req, res) {
    try {
      const { resource_id } = req.query;

      const statistics = await ResourceComment.getCommentStatistics(
        resource_id ? parseInt(resource_id) : null
      );

      res.json({
        success: true,
        message: '获取评论统计成功',
        data: statistics
      });
    } catch (error) {
      logger.error('获取评论统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取统计信息失败'
      });
    }
  }
}

module.exports = ResourceCommentController;
