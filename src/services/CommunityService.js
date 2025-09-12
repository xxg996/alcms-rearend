/**
 * 社区业务逻辑服务
 * 处理社区相关的所有业务操作（帖子、评论、互动、版块）
 */

const BaseService = require('./BaseService');
const CommunityPost = require('../models/CommunityPost');
const CommunityComment = require('../models/CommunityComment');
const CommunityInteraction = require('../models/CommunityInteraction');
const CommunityBoard = require('../models/CommunityBoard');
const User = require('../models/User');

class CommunityService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 创建帖子
   */
  async createPost(postData, authorId) {
    return this.withPerformanceMonitoring('createPost', async () => {
      try {
        this.validateRequired({ authorId }, ['authorId']);
        this.validateRequired(postData, ['title', 'content', 'board_id']);

        const { title, content, board_id, type = 'text', tags, images } = postData;

        // 验证版块是否存在
        const board = await CommunityBoard.findById(board_id);
        if (!board) {
          throw new Error('版块不存在');
        }

        // 验证用户是否有发帖权限
        await this.checkPostPermission(authorId, board_id);

        const newPost = await this.executeInTransaction(async (client) => {
          const post = await CommunityPost.create({
            title,
            content,
            type,
            board_id,
            author_id: authorId,
            images: images ? JSON.stringify(images) : null,
            status: 'published',
            created_at: new Date(),
            updated_at: new Date()
          }, client);

          // 处理标签
          if (tags && tags.length > 0) {
            await this.associatePostTags(post.id, tags, client);
          }

          // 更新版块统计
          await CommunityBoard.incrementPostCount(board_id, client);

          return post;
        });

        this.log('info', '社区帖子创建成功', { 
          postId: newPost.id, 
          authorId, 
          board_id 
        });

        return this.formatSuccessResponse(newPost, '帖子发布成功');

      } catch (error) {
        this.handleError(error, 'createPost');
      }
    });
  }

  /**
   * 获取帖子列表
   */
  async getPostList(filters = {}, pagination = {}) {
    return this.withPerformanceMonitoring('getPostList', async () => {
      try {
        const { page, limit, offset } = this.normalizePaginationParams(
          pagination.page,
          pagination.limit
        );

        const normalizedFilters = this.normalizePostFilters(filters);
        
        const cacheKey = this.generatePostListCacheKey(normalizedFilters, page, limit);

        return await this.getCached(cacheKey, async () => {
          const [posts, totalCount] = await Promise.all([
            CommunityPost.findByFilters({ ...normalizedFilters, limit, offset }),
            CommunityPost.countByFilters(normalizedFilters)
          ]);

          // 获取作者信息
          const authorIds = [...new Set(posts.map(p => p.author_id))];
          const authors = await User.findByIds(authorIds);
          const authorMap = authors.reduce((acc, author) => {
            acc[author.id] = {
              id: author.id,
              username: author.username,
              nickname: author.nickname,
              avatar_url: author.avatar_url
            };
            return acc;
          }, {});

          // 组合帖子和作者信息
          const enrichedPosts = posts.map(post => ({
            ...post,
            author: authorMap[post.author_id] || null,
            images: post.images ? JSON.parse(post.images) : []
          }));

          return this.formatPaginatedResponse(
            enrichedPosts,
            { page, limit },
            totalCount
          );
        }, 300);

      } catch (error) {
        this.handleError(error, 'getPostList');
      }
    });
  }

  /**
   * 获取帖子详情
   */
  async getPostById(postId, userId = null) {
    return this.withPerformanceMonitoring('getPostById', async () => {
      try {
        this.validateRequired({ postId }, ['postId']);

        const post = await CommunityPost.findById(postId);
        if (!post) {
          throw new Error('帖子不存在');
        }

        // 获取作者信息
        const author = await User.findById(post.author_id);

        // 获取用户互动状态
        let userInteraction = null;
        if (userId) {
          userInteraction = await CommunityInteraction.findByUserAndPost(userId, postId);
        }

        // 增加浏览次数（异步执行）
        this.incrementViewCount(postId).catch(err =>
          this.log('warn', '更新帖子浏览次数失败', { postId, error: err.message })
        );

        const enrichedPost = {
          ...post,
          author: author ? {
            id: author.id,
            username: author.username,
            nickname: author.nickname,
            avatar_url: author.avatar_url
          } : null,
          images: post.images ? JSON.parse(post.images) : [],
          user_interaction: userInteraction ? {
            liked: userInteraction.liked,
            disliked: userInteraction.disliked,
            favorited: userInteraction.favorited
          } : null
        };

        return this.formatSuccessResponse(enrichedPost, '获取帖子详情成功');

      } catch (error) {
        this.handleError(error, 'getPostById');
      }
    });
  }

  /**
   * 创建评论
   */
  async createComment(commentData, authorId) {
    return this.withPerformanceMonitoring('createComment', async () => {
      try {
        this.validateRequired({ authorId }, ['authorId']);
        this.validateRequired(commentData, ['post_id', 'content']);

        const { post_id, content, parent_id = null, reply_to_user_id = null } = commentData;

        // 验证帖子是否存在
        const post = await CommunityPost.findById(post_id);
        if (!post) {
          throw new Error('帖子不存在');
        }

        // 验证父评论
        if (parent_id) {
          const parentComment = await CommunityComment.findById(parent_id);
          if (!parentComment || parentComment.post_id !== post_id) {
            throw new Error('父评论不存在或不属于该帖子');
          }
        }

        const newComment = await this.executeInTransaction(async (client) => {
          const comment = await CommunityComment.create({
            post_id,
            author_id: authorId,
            content,
            parent_id,
            reply_to_user_id,
            status: 'published',
            created_at: new Date(),
            updated_at: new Date()
          }, client);

          // 更新帖子评论数
          await CommunityPost.incrementCommentCount(post_id, client);

          return comment;
        });

        this.log('info', '评论创建成功', { 
          commentId: newComment.id, 
          postId: post_id,
          authorId 
        });

        return this.formatSuccessResponse(newComment, '评论发布成功');

      } catch (error) {
        this.handleError(error, 'createComment');
      }
    });
  }

  /**
   * 获取评论列表
   */
  async getCommentList(postId, pagination = {}) {
    return this.withPerformanceMonitoring('getCommentList', async () => {
      try {
        this.validateRequired({ postId }, ['postId']);

        const { page, limit, offset } = this.normalizePaginationParams(
          pagination.page,
          pagination.limit
        );

        const cacheKey = `community:comments:${postId}:${page}:${limit}`;

        return await this.getCached(cacheKey, async () => {
          const [comments, totalCount] = await Promise.all([
            CommunityComment.findByPostId(postId, { limit, offset }),
            CommunityComment.countByPostId(postId)
          ]);

          // 获取作者信息
          const authorIds = [...new Set(comments.map(c => c.author_id))];
          const authors = await User.findByIds(authorIds);
          const authorMap = authors.reduce((acc, author) => {
            acc[author.id] = {
              id: author.id,
              username: author.username,
              nickname: author.nickname,
              avatar_url: author.avatar_url
            };
            return acc;
          }, {});

          // 组合评论和作者信息
          const enrichedComments = comments.map(comment => ({
            ...comment,
            author: authorMap[comment.author_id] || null
          }));

          return this.formatPaginatedResponse(
            enrichedComments,
            { page, limit },
            totalCount
          );
        }, 180);

      } catch (error) {
        this.handleError(error, 'getCommentList');
      }
    });
  }

  /**
   * 点赞/取消点赞
   */
  async toggleLike(postId, userId) {
    return this.withPerformanceMonitoring('toggleLike', async () => {
      try {
        this.validateRequired({ postId, userId }, ['postId', 'userId']);

        const post = await CommunityPost.findById(postId);
        if (!post) {
          throw new Error('帖子不存在');
        }

        const result = await this.executeInTransaction(async (client) => {
          let interaction = await CommunityInteraction.findByUserAndPost(userId, postId);

          if (!interaction) {
            // 创建新的互动记录
            interaction = await CommunityInteraction.create({
              user_id: userId,
              post_id: postId,
              liked: true,
              disliked: false,
              created_at: new Date(),
              updated_at: new Date()
            }, client);

            // 增加帖子点赞数
            await CommunityPost.incrementLikeCount(postId, client);

            return { action: 'liked', interaction };
          } else {
            if (interaction.liked) {
              // 取消点赞
              await CommunityInteraction.updateById(interaction.id, {
                liked: false,
                updated_at: new Date()
              }, client);

              // 减少帖子点赞数
              await CommunityPost.decrementLikeCount(postId, client);

              return { action: 'unliked', interaction };
            } else {
              // 点赞（如果之前踩过，先取消踩）
              const updateData = {
                liked: true,
                updated_at: new Date()
              };

              if (interaction.disliked) {
                updateData.disliked = false;
                await CommunityPost.decrementDislikeCount(postId, client);
              }

              await CommunityInteraction.updateById(interaction.id, updateData, client);
              await CommunityPost.incrementLikeCount(postId, client);

              return { action: 'liked', interaction };
            }
          }
        });

        this.log('info', '帖子点赞操作成功', { 
          postId, 
          userId, 
          action: result.action 
        });

        return this.formatSuccessResponse(result, `${result.action === 'liked' ? '点赞' : '取消点赞'}成功`);

      } catch (error) {
        this.handleError(error, 'toggleLike');
      }
    });
  }

  /**
   * 获取版块列表
   */
  async getBoardList(filters = {}) {
    return this.withPerformanceMonitoring('getBoardList', async () => {
      try {
        const cacheKey = `community:boards:${JSON.stringify(filters)}`;

        return await this.getCached(cacheKey, async () => {
          const boards = await CommunityBoard.findByFilters(filters);
          
          return this.formatSuccessResponse(boards, '获取版块列表成功');
        }, 600);

      } catch (error) {
        this.handleError(error, 'getBoardList');
      }
    });
  }

  /**
   * 获取热门帖子
   */
  async getHotPosts(limit = 20, timeRange = '7d') {
    return this.withPerformanceMonitoring('getHotPosts', async () => {
      try {
        const cacheKey = `community:hot_posts:${timeRange}:${limit}`;

        return await this.getCached(cacheKey, async () => {
          const posts = await CommunityPost.findHotPosts(limit, timeRange);
          
          // 获取作者信息
          const authorIds = [...new Set(posts.map(p => p.author_id))];
          const authors = await User.findByIds(authorIds);
          const authorMap = authors.reduce((acc, author) => {
            acc[author.id] = {
              id: author.id,
              username: author.username,
              nickname: author.nickname,
              avatar_url: author.avatar_url
            };
            return acc;
          }, {});

          const enrichedPosts = posts.map(post => ({
            ...post,
            author: authorMap[post.author_id] || null,
            images: post.images ? JSON.parse(post.images) : []
          }));

          return this.formatSuccessResponse(enrichedPosts, '获取热门帖子成功');
        }, 600);

      } catch (error) {
        this.handleError(error, 'getHotPosts');
      }
    });
  }

  /**
   * 检查发帖权限
   */
  async checkPostPermission(userId, boardId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    if (user.status !== 'active') {
      throw new Error('账户状态异常，无法发帖');
    }

    // 可以在这里添加更多权限检查逻辑
    return true;
  }

  /**
   * 关联帖子标签
   */
  async associatePostTags(postId, tags, client) {
    // 这里可以实现帖子标签关联逻辑
    this.log('info', '帖子标签关联', { postId, tags });
  }

  /**
   * 标准化帖子过滤参数
   */
  normalizePostFilters(filters) {
    const {
      board_id,
      author_id,
      type,
      status = 'published',
      search,
      start_date,
      end_date,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = filters;

    return {
      board_id: board_id ? parseInt(board_id) : undefined,
      author_id: author_id ? parseInt(author_id) : undefined,
      type,
      status,
      search,
      start_date,
      end_date,
      sort_by,
      sort_order
    };
  }

  /**
   * 生成帖子列表缓存键
   */
  generatePostListCacheKey(filters, page, limit) {
    const filterStr = Object.entries(filters)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}:${value}`)
      .join(':');
    
    return `community:posts:${page}:${limit}:${filterStr}`;
  }

  /**
   * 增加浏览次数
   */
  async incrementViewCount(postId) {
    try {
      await CommunityPost.incrementViewCount(postId);
    } catch (error) {
      this.log('error', '增加帖子浏览次数失败', { postId, error: error.message });
    }
  }

  /**
   * 删除帖子
   */
  async deletePost(postId, userId, isAdmin = false) {
    return this.withPerformanceMonitoring('deletePost', async () => {
      try {
        this.validateRequired({ postId, userId }, ['postId', 'userId']);

        const post = await CommunityPost.findById(postId);
        if (!post) {
          throw new Error('帖子不存在');
        }

        // 权限检查：只有作者或管理员可以删除
        if (post.author_id !== userId && !isAdmin) {
          throw new Error('没有权限删除此帖子');
        }

        await this.executeInTransaction(async (client) => {
          // 删除帖子相关的评论
          await CommunityComment.deleteByPostId(postId, client);
          
          // 删除帖子相关的互动记录
          await CommunityInteraction.deleteByPostId(postId, client);
          
          // 删除帖子
          await CommunityPost.deleteById(postId, client);

          // 更新版块统计
          await CommunityBoard.decrementPostCount(post.board_id, client);
        });

        this.log('info', '帖子删除成功', { postId, userId });

        return this.formatSuccessResponse(null, '帖子删除成功');

      } catch (error) {
        this.handleError(error, 'deletePost');
      }
    });
  }
}

module.exports = new CommunityService();