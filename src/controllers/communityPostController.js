/**
 * 社区帖子控制器
 * 处理帖子的CRUD操作、搜索和管理功能
 */

const CommunityPost = require('../models/CommunityPost');
const CommunityBoard = require('../models/CommunityBoard');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { generateSecurePostInfoBatch } = require('../utils/downloadUtilsBatch');
const { logger } = require('../utils/logger');

class CommunityPostController {
  /**
   * 获取帖子列表
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
   * 创建帖子
   */
  static async createPost(req, res) {
    try {
      const {
        title,
        content,
        contentType = 'markdown',
        summary,
        boardId,
        tags = [],
        status = 'published'
      } = req.body;

      const authorId = req.user.id;

      // 验证必填字段
      if (!title || !content || !boardId) {
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
