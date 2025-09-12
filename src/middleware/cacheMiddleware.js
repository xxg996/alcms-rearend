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
 */
const resourceDetailCache = cacheMiddleware({
  ttl: TTL.MEDIUM, // 1小时
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous';
    return cache.generateKey('resource', 'detail', req.params.id, userId);
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
    // 拦截响应
    const originalJson = res.json;
    res.json = async function(data) {
      // 只在成功响应后清除缓存
      if (res.statusCode >= 200 && res.statusCode < 300) {
        for (const pattern of patterns) {
          try {
            const cachePattern = typeof pattern === 'function' 
              ? pattern(req, data) 
              : pattern;
            
            if (cachePattern) {
              await cache.delByPattern(cachePattern);
              logger.debug('缓存已清除', { pattern: cachePattern });
            }
          } catch (error) {
            logger.error('清除缓存失败:', error);
          }
        }
      }

      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * 资源相关缓存清除模式
 */
const clearResourceCache = clearCacheMiddleware([
  'api:resources:*',
  'resource:*',
  'stats:*'
]);

/**
 * 用户相关缓存清除模式
 */
const clearUserCache = clearCacheMiddleware([
  (req) => `user:profile:${req.user?.id || req.params.id}`,
  'stats:*'
]);

/**
 * 分类相关缓存清除模式
 */
const clearCategoryCache = clearCacheMiddleware([
  'categories:*',
  'api:resources:*'
]);

/**
 * 标签相关缓存清除模式
 */
const clearTagCache = clearCacheMiddleware([
  'tags:*',
  'api:resources:*'
]);

/**
 * 社区相关缓存清除模式
 */
const clearPostCache = clearCacheMiddleware([
  'posts:*',
  'stats:*'
]);

/**
 * 预热缓存
 * 在应用启动时预加载热门数据
 */
async function warmupCache() {
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
        logger.error('缓存预热失败', { key: task.key, error: error.message });
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