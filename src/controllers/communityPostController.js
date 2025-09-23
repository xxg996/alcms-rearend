/**
 * 社区帖子控制器
 * 处理帖子的CRUD操作、搜索和管理功能
 * @swagger
 * tags:
 *   name: Community-Posts
 *   description: 社区帖子管理相关API
 */

const CommunityPost = require('../models/CommunityPost');
const CommunityBoard = require('../models/CommunityBoard');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { generateSecurePostInfoBatch } = require('../utils/downloadUtilsBatch');
const { logger } = require('../utils/logger');

class CommunityPostController {
  /**
   * @swagger
   * /api/community/posts:
   *   get:
   *     summary: 获取帖子列表
   *     description: 获取社区帖子列表，支持分页、筛选和搜索
   *     tags: [Community-Posts]
   *     parameters:
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
   *         name: boardId
   *         schema:
   *           type: integer
   *         description: 板块ID筛选
   *       - in: query
   *         name: authorId
   *         schema:
   *           type: integer
   *         description: 作者ID筛选
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [published, draft, hidden]
   *           default: published
   *         description: 帖子状态
   *       - in: query
   *         name: isPinned
   *         schema:
   *           type: boolean
   *         description: 是否置顶
   *       - in: query
   *         name: isFeatured
   *         schema:
   *           type: boolean
   *         description: 是否精华
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [created_at, last_reply_time, reply_count, like_count]
   *           default: last_reply_time
   *         description: 排序字段
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [ASC, DESC]
   *           default: DESC
   *         description: 排序方向
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: 搜索关键词
   *       - in: query
   *         name: tags
   *         schema:
   *           type: string
   *         description: 标签筛选
   *     responses:
   *       200:
   *         description: 获取帖子列表成功
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
   *                         posts:
   *                           type: array
   *                           items:
   *                             $ref: '#/components/schemas/CommunityPost'
   *                         pagination:
   *                           $ref: '#/components/schemas/Pagination'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async getPosts(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        boardId,
        authorId,
        status = 'published',
        isPinned,
        isFeatured,
        sortBy = 'last_reply_time',
        sortOrder = 'DESC',
        search,
        tags
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        boardId: boardId ? parseInt(boardId) : undefined,
        authorId: authorId ? parseInt(authorId) : undefined,
        status,
        isPinned: isPinned !== undefined ? isPinned === 'true' : undefined,
        isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
        sortBy,
        sortOrder,
        search,
        tags: tags ? tags.split(',') : undefined
      };

      const result = await CommunityPost.findAll(options);
      
      // 批量生成帖子安全信息，解决N+1查询问题
      if (result.posts && result.posts.length > 0) {
        result.posts = await generateSecurePostInfoBatch(
          result.posts, 
          req.user?.id
        );
      }
      
      return successResponse(res, '获取帖子列表成功', result);
    } catch (error) {
      logger.error('获取帖子列表失败:', error);
      return errorResponse(res, '获取帖子列表失败', 500);
    }
  }

  /**
   * 获取帖子详情
   */
  static async getPostById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const post = await CommunityPost.findById(parseInt(id), { 
        includeContent: true, 
        userId 
      });
      
      if (!post) {
        return errorResponse(res, '帖子不存在', 404);
      }

      // 增加浏览数（异步执行，不等待结果）
      CommunityPost.incrementViewCount(parseInt(id)).catch(console.error);

      return successResponse(res, '获取帖子详情成功', post);
    } catch (error) {
      logger.error('获取帖子详情失败:', error);
      return errorResponse(res, '获取帖子详情失败', 500);
    }
  }

  /**
   * @swagger
   * /api/community/posts:
   *   post:
   *     summary: 创建帖子
   *     description: 创建新的社区帖子
   *     tags: [Community-Posts]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreatePostRequest'
   *           example:
   *             board_id: 1
   *             title: "Node.js学习心得分享"
   *             content: "最近在学习Node.js，想和大家分享一下心得..."
   *             content_type: "markdown"
   *             tags: ["nodejs", "javascript", "学习"]
   *             status: "published"
   *     responses:
   *       201:
   *         description: 创建帖子成功
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/CommunityPost'
   *       400:
   *         description: 请求参数错误
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               success: false
   *               message: "标题、内容和板块不能为空"
   *               timestamp: "2025-09-23T13:58:56.589Z"
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         description: 板块不存在
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  static async createPost(req, res) {
    try {
      const body = req.body || {};

      const rawTitle = body.title;
      const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';

      const rawContent = body.content;
      const content = typeof rawContent === 'string' ? rawContent.trim() : '';

      const boardIdRaw = body.board_id ?? body.boardId;
      const boardId = boardIdRaw !== undefined && boardIdRaw !== null
        ? parseInt(boardIdRaw, 10)
        : NaN;

      const rawContentType = body.content_type ?? body.contentType ?? 'markdown';
      const contentType = typeof rawContentType === 'string'
        ? rawContentType.toLowerCase()
        : 'markdown';

      const summary = typeof body.summary === 'string' ? body.summary : null;

      const rawTags = Array.isArray(body.tags) ? body.tags : [];
      const tags = rawTags
        .map(tag => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(tag => tag.length > 0);

      const rawStatus = body.status ?? 'published';
      const status = typeof rawStatus === 'string'
        ? rawStatus.toLowerCase()
        : 'published';

      const authorId = req.user.id;

      // 验证必填字段
      if (!title || !content || !Number.isInteger(boardId) || boardId <= 0) {
        return errorResponse(res, '标题、内容和板块不能为空', 400);
      }

      // 验证板块是否存在
      const board = await CommunityBoard.findById(boardId);
      if (!board) {
        return errorResponse(res, '板块不存在', 404);
      }

      // 检查是否为激活板块
      if (!board.is_active) {
        return errorResponse(res, '该板块已停用', 400);
      }

      const postData = {
        title,
        content,
        contentType,
        summary,
        authorId,
        boardId,
        tags,
        status
      };

      const newPost = await CommunityPost.create(postData);
      
      return successResponse(res, '创建帖子成功', newPost, 201);
    } catch (error) {
      logger.error('创建帖子失败:', error);
      return errorResponse(res, '创建帖子失败', 500);
    }
  }

  /**
   * 更新帖子
   */
  static async updatePost(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const userId = req.user.id;

      // 获取原帖子信息
      const originalPost = await CommunityPost.findById(parseInt(id));
      if (!originalPost) {
        return errorResponse(res, '帖子不存在', 404);
      }

      // 权限检查：只有作者或管理员可以编辑
      const hasPermission = req.user.permissions.includes('community.post.edit_any') || 
                           originalPost.author_id === userId;
      
      if (!hasPermission) {
        return errorResponse(res, '没有权限编辑该帖子', 403);
      }

      const updatedPost = await CommunityPost.update(parseInt(id), updateData);
      
      return successResponse(res, '更新帖子成功', updatedPost);
    } catch (error) {
      logger.error('更新帖子失败:', error);
      return errorResponse(res, '更新帖子失败', 500);
    }
  }

  /**
   * 删除帖子
   */
  static async deletePost(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // 获取帖子信息
      const post = await CommunityPost.findById(parseInt(id));
      if (!post) {
        return errorResponse(res, '帖子不存在', 404);
      }

      // 权限检查：只有作者或管理员可以删除
      const hasPermission = req.user.permissions.includes('community.post.delete_any') || 
                           post.author_id === userId;
      
      if (!hasPermission) {
        return errorResponse(res, '没有权限删除该帖子', 403);
      }

      const success = await CommunityPost.delete(parseInt(id));
      
      if (!success) {
        return errorResponse(res, '删除帖子失败', 500);
      }

      return successResponse(res, '删除帖子成功');
    } catch (error) {
      logger.error('删除帖子失败:', error);
      return errorResponse(res, '删除帖子失败', 500);
    }
  }

  /**
   * 搜索帖子
   */
  static async searchPosts(req, res) {
    try {
      const { 
        q: keyword, 
        page = 1, 
        limit = 20, 
        boardId 
      } = req.query;
      
      if (!keyword) {
        return errorResponse(res, '搜索关键词不能为空', 400);
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        boardId: boardId ? parseInt(boardId) : undefined
      };

      const result = await CommunityPost.search(keyword, options);
      
      return successResponse(res, '搜索帖子成功', result);
    } catch (error) {
      logger.error('搜索帖子失败:', error);
      return errorResponse(res, '搜索帖子失败', 500);
    }
  }

  /**
   * 获取热门帖子
   */
  static async getHotPosts(req, res) {
    try {
      const { 
        limit = 10, 
        boardId, 
        days = 7 
      } = req.query;

      const options = {
        limit: parseInt(limit),
        boardId: boardId ? parseInt(boardId) : undefined,
        days: parseInt(days)
      };

      const posts = await CommunityPost.getHotPosts(options);
      
      return successResponse(res, '获取热门帖子成功', posts);
    } catch (error) {
      logger.error('获取热门帖子失败:', error);
      return errorResponse(res, '获取热门帖子失败', 500);
    }
  }

  /**
   * 置顶帖子
   */
  static async pinPost(req, res) {
    try {
      const { id } = req.params;
      const { isPinned = true } = req.body;

      const updatedPost = await CommunityPost.update(parseInt(id), { isPinned });
      
      if (!updatedPost) {
        return errorResponse(res, '帖子不存在', 404);
      }

      const action = isPinned ? '置顶' : '取消置顶';
      return successResponse(res, `${action}帖子成功`, updatedPost);
    } catch (error) {
      logger.error('置顶帖子失败:', error);
      return errorResponse(res, '置顶帖子失败', 500);
    }
  }

  /**
   * 设置精华帖
   */
  static async featurePost(req, res) {
    try {
      const { id } = req.params;
      const { isFeatured = true } = req.body;

      const updatedPost = await CommunityPost.update(parseInt(id), { isFeatured });
      
      if (!updatedPost) {
        return errorResponse(res, '帖子不存在', 404);
      }

      const action = isFeatured ? '设置精华' : '取消精华';
      return successResponse(res, `${action}成功`, updatedPost);
    } catch (error) {
      logger.error('设置精华帖失败:', error);
      return errorResponse(res, '设置精华帖失败', 500);
    }
  }

  /**
   * 锁定帖子
   */
  static async lockPost(req, res) {
    try {
      const { id } = req.params;
      const { isLocked = true } = req.body;

      const updatedPost = await CommunityPost.update(parseInt(id), { isLocked });
      
      if (!updatedPost) {
        return errorResponse(res, '帖子不存在', 404);
      }

      const action = isLocked ? '锁定' : '解锁';
      return successResponse(res, `${action}帖子成功`, updatedPost);
    } catch (error) {
      logger.error('锁定帖子失败:', error);
      return errorResponse(res, '锁定帖子失败', 500);
    }
  }

  /**
   * 获取用户的帖子列表
   */
  static async getUserPosts(req, res) {
    try {
      const { userId } = req.params;
      const {
        page = 1,
        limit = 20,
        status = 'published'
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        authorId: parseInt(userId),
        status
      };

      const result = await CommunityPost.findAll(options);
      
      return successResponse(res, '获取用户帖子成功', result);
    } catch (error) {
      logger.error('获取用户帖子失败:', error);
      return errorResponse(res, '获取用户帖子失败', 500);
    }
  }

  /**
   * 获取用户帖子统计
   */
  static async getUserPostStats(req, res) {
    try {
      const { userId } = req.params;
      
      const stats = await CommunityPost.getUserStats(parseInt(userId));
      
      return successResponse(res, '获取用户帖子统计成功', stats);
    } catch (error) {
      logger.error('获取用户帖子统计失败:', error);
      return errorResponse(res, '获取用户帖子统计失败', 500);
    }
  }

  /**
   * 批量更新帖子状态
   */
  static async batchUpdatePosts(req, res) {
    try {
      const { postIds, updateData } = req.body;
      
      if (!Array.isArray(postIds) || postIds.length === 0) {
        return errorResponse(res, '帖子ID列表不能为空', 400);
      }

      if (!updateData) {
        return errorResponse(res, '更新数据不能为空', 400);
      }

      const results = [];
      const errors = [];

      for (const postId of postIds) {
        try {
          const updatedPost = await CommunityPost.update(postId, updateData);
          if (updatedPost) {
            results.push(updatedPost);
          } else {
            errors.push(`帖子 ID ${postId}: 不存在`);
          }
        } catch (error) {
          errors.push(`帖子 ID ${postId}: ${error.message}`);
        }
      }

      const result = {
        updated: results,
        updatedCount: results.length,
        totalCount: postIds.length,
        errors
      };

      if (results.length > 0) {
        return successResponse(res, `成功更新 ${results.length} 个帖子`, result);
      } else {
        return errorResponse(res, '所有帖子更新失败', 400, result);
      }
    } catch (error) {
      logger.error('批量更新帖子失败:', error);
      return errorResponse(res, '批量更新帖子失败', 500);
    }
  }
}

module.exports = CommunityPostController;
