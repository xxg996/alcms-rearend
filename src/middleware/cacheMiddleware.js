/**
 * 缓存中间件
 * 为API接口提供智能缓存功能
 */

const { cache, TTL } = require('../utils/cache');
const { logger } = require('../utils/logger');

/**
 * 通用缓存中间件
 * @param {Object} options - 缓存选项
 * @param {number} options.ttl - 缓存时间（秒）
 * @param {Function} options.keyGenerator - 缓存键生成函数
 * @param {Function} options.condition - 缓存条件检查函数
 * @param {Array} options.methods - 允许缓存的HTTP方法
 */
function cacheMiddleware(options = {}) {
  const {
    ttl = TTL.MEDIUM,
    keyGenerator = defaultKeyGenerator,
    condition = defaultCondition,
    methods = ['GET'],
    skipCache = false
  } = options;

  return async (req, res, next) => {
    // 检查是否在开发模式下禁用缓存
    if (process.env.DISABLE_CACHE === 'true') {
      logger.debug('缓存已禁用 (DISABLE_CACHE=true)', { path: req.path });
      return next();
    }

    // 检查是否应该使用缓存
    if (skipCache || !methods.includes(req.method) || !condition(req)) {
      return next();
    }

    try {
      const cacheKey = keyGenerator(req);
      
      // 尝试从缓存获取数据
      const cachedData = await cache.get(cacheKey);
      
      if (cachedData !== null) {
        // 缓存命中
        logger.debug('缓存命中', { key: cacheKey, path: req.path });
        
        res.set({
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey
        });
        
        return res.json(cachedData);
      }

      // 缓存未命中，拦截响应
      const originalJson = res.json;
      res.json = function(data) {
        // 只缓存成功响应
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // 异步缓存，不阻塞响应
          setImmediate(async () => {
            try {
              await cache.set(cacheKey, data, ttl);
              logger.debug('数据已缓存', { key: cacheKey, ttl });
            } catch (error) {
              logger.error('缓存设置失败:', error);
            }
          });
        }

        res.set({
          'X-Cache': 'MISS',
          'X-Cache-Key': cacheKey
        });

        return originalJson.call(this, data);
      };

      next();

    } catch (error) {
      logger.error('缓存中间件错误:', error);
      // 缓存错误不应影响正常流程
      next();
    }
  };
}

/**
 * 默认缓存键生成器
 */
function defaultKeyGenerator(req) {
  const userId = req.user?.id || 'anonymous';
  const path = req.route?.path || req.path;
  const query = JSON.stringify(req.query);
  return cache.generateKey('api', path, userId, query);
}

/**
 * 默认缓存条件
 */
function defaultCondition(req) {
  // 不缓存包含敏感参数的请求
  const sensitiveParams = ['password', 'token', 'secret'];
  const queryString = JSON.stringify(req.query).toLowerCase();
  
  return !sensitiveParams.some(param => queryString.includes(param));
}

/**
 * 资源列表缓存中间件
 */
const resourceListCache = cacheMiddleware({
  ttl: TTL.SHORT, // 15分钟
  keyGenerator: (req) => {
    const { page, limit, categoryId, resourceTypeId, authorId, status, search, tags, sortBy, sortOrder } = req.query;
    const userId = req.user?.id || 'anonymous';
    return cache.generateKey('resources', 'list', userId, page, limit, categoryId, resourceTypeId, authorId, status, search, tags, sortBy, sortOrder);
  },
  condition: (req) => {
    // 只缓存公开资源列表
    return !req.query.includeAll && !req.query.authorId;
  }
});

/**
 * 资源详情缓存中间件
 * 注意：包含用户下载状态等动态数据，不适合缓存
 */
const resourceDetailCache = cacheMiddleware({
  ttl: TTL.MEDIUM, // 1小时
  keyGenerator: (req) => {
    // 只缓存匿名用户的资源详情（不包含用户相关动态数据）
    return cache.generateKey('resource', 'detail', req.params.id, 'anonymous');
  },
  condition: (req) => {
    // 只为匿名用户缓存，已登录用户的响应包含动态数据，不应缓存
    return !req.user;
  }
});

/**
 * 用户信息缓存中间件
 */
const userInfoCache = cacheMiddleware({
  ttl: TTL.LONG, // 24小时
  keyGenerator: (req) => {
    return cache.generateKey('user', 'profile', req.user.id);
  },
  condition: (req) => {
    // 只有获取自己信息时才缓存
    return req.params.id === req.user?.id?.toString();
  }
});

/**
 * 分类列表缓存中间件
 */
const categoryListCache = cacheMiddleware({
  ttl: TTL.VERY_LONG, // 7天
  keyGenerator: (req) => {
    const { includeInactive, tree } = req.query;
    return cache.generateKey('categories', 'list', includeInactive, tree);
  }
});

/**
 * 标签列表缓存中间件
 */
const tagListCache = cacheMiddleware({
  ttl: TTL.LONG, // 24小时
  keyGenerator: (req) => {
    const { page, limit, search } = req.query;
    return cache.generateKey('tags', 'list', page, limit, search);
  }
});

/**
 * 社区帖子列表缓存中间件
 */
const postListCache = cacheMiddleware({
  ttl: TTL.SHORT, // 15分钟
  keyGenerator: (req) => {
    const { board_id, page, limit, status, sortBy, sortOrder, search, tags } = req.query;
    const userId = req.user?.id || 'anonymous';
    return cache.generateKey('posts', 'list', board_id, userId, page, limit, status, sortBy, sortOrder, search, tags);
  }
});

/**
 * 统计信息缓存中间件
 */
const statsCache = cacheMiddleware({
  ttl: TTL.MEDIUM, // 1小时
  keyGenerator: (req) => {
    return cache.generateKey('stats', req.route.path);
  }
});

/**
 * 清除缓存中间件
 * 在数据更新后自动清除相关缓存
 */
function clearCacheMiddleware(patterns) {
  return async (req, res, next) => {
    // 检查是否在开发模式下禁用缓存
    if (process.env.DISABLE_CACHE === 'true') {
      logger.debug('缓存清理已禁用 (DISABLE_CACHE=true)', { path: req.path });
      return next();
    }

    // 拦截响应，同时保存原始方法
    const originalJson = res.json;
    const originalSend = res.send;
    const originalEnd = res.end;

    // 清理缓存的通用方法
    const clearCaches = async () => {
      // 只在成功响应后清除缓存
      if (res.statusCode >= 200 && res.statusCode < 300) {
        for (const pattern of patterns) {
          try {
            const cachePattern = typeof pattern === 'function'
              ? pattern(req, res.locals.responseData)
              : pattern;

            if (cachePattern) {
              const deleted = await cache.delByPattern(cachePattern);
              if (deleted) {
                logger.debug('缓存已清除', { pattern: cachePattern, path: req.path });
              } else {
                logger.warn('缓存清除失败', { pattern: cachePattern, path: req.path });
              }
            }
          } catch (error) {
            logger.error('清除缓存失败:', error, { pattern, path: req.path });
          }
        }
      }
    };

    // 重写json方法
    res.json = async function(data) {
      res.locals.responseData = data;
      await clearCaches();
      return originalJson.call(this, data);
    };

    // 重写send方法
    res.send = async function(data) {
      res.locals.responseData = data;
      await clearCaches();
      return originalSend.call(this, data);
    };

    // 重写end方法
    res.end = async function(data) {
      if (data) res.locals.responseData = data;
      await clearCaches();
      return originalEnd.call(this, data);
    };

    next();
  };
}

/**
 * 资源相关缓存清除模式
 */
const clearResourceCache = clearCacheMiddleware([
  'resources:*',
  'api:*resources*',
  'resource:*',
  'stats:*'
]);

/**
 * 用户相关缓存清除模式
 */
const clearUserCache = clearCacheMiddleware([
  (req) => `user:*:${req.user?.id || req.params.id || '*'}`,
  (req) => `api:*user*`,
  'stats:*'
]);

/**
 * 分类相关缓存清除模式
 */
const clearCategoryCache = clearCacheMiddleware([
  'categories:*',    // 包括 categories:tree:*, categories:list:*
  'category:*',      // 单个分类详情缓存
  'api:*categories*', // API层缓存
  'resources:*',     // 分类变更会影响资源列表
  'stats:*'          // 统计数据缓存
]);

/**
 * 标签相关缓存清除模式
 */
const clearTagCache = clearCacheMiddleware([
  'tags:*',
  'tag:*',
  'api:*tags*',
  'resources:*',  // 标签变更会影响资源列表
  'stats:*'
]);

/**
 * 社区相关缓存清除模式
 */
const clearPostCache = clearCacheMiddleware([
  'posts:*',
  'post:*',
  'api:*posts*',
  'stats:*'
]);

/**
 * 预热缓存
 * 在应用启动时预加载热门数据
 */
async function warmupCache() {
  // 检查是否在开发模式下禁用缓存
  if (process.env.DISABLE_CACHE === 'true') {
    logger.info('缓存预热已跳过 (DISABLE_CACHE=true)');
    return;
  }

  logger.info('开始预热缓存...');

  try {
    const warmupTasks = [
      // 预热分类列表
      {
        key: cache.generateKey('categories', 'list', 'false', 'false'),
        fetcher: async () => {
          const Category = require('../models/Category');
          return await Category.findAll({ includeInactive: false });
        },
        ttl: TTL.VERY_LONG
      },

      // 预热热门资源
      {
        key: cache.generateKey('resources', 'list', 'anonymous', '1', '20', '', 'published', '', '', 'view_count', 'desc'),
        fetcher: async () => {
          const Resource = require('../models/Resource');
          return await Resource.findAll({
            page: 1,
            limit: 20,
            status: 'published',
            sortBy: 'view_count',
            sortOrder: 'desc'
          });
        },
        ttl: TTL.SHORT
      }
    ];

    await Promise.all(warmupTasks.map(async (task) => {
      try {
        const data = await task.fetcher();
        await cache.set(task.key, data, task.ttl);
        logger.debug('缓存预热成功', { key: task.key });
      } catch (error) {
        logger.error('缓存预热失败', error, { key: task.key });
      }
    }));

    logger.info('缓存预热完成');
  } catch (error) {
    logger.error('缓存预热失败:', error);
  }
}

module.exports = {
  cacheMiddleware,
  resourceListCache,
  resourceDetailCache,
  userInfoCache,
  categoryListCache,
  tagListCache,
  postListCache,
  statsCache,
  clearResourceCache,
  clearUserCache,
  clearCategoryCache,
  clearTagCache,
  clearPostCache,
  warmupCache
};