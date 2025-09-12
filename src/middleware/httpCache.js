/**
 * HTTP 缓存中间件
 * 实现 ETag、Last-Modified 和响应缓存
 */

const crypto = require('crypto');
const cacheManager = require('../utils/cache');
const { logger } = require('../utils/logger');

/**
 * 生成 ETag
 * @param {string} content - 内容
 * @returns {string} ETag 值
 */
const generateETag = (content) => {
  return crypto
    .createHash('md5')
    .update(content)
    .digest('hex');
};

/**
 * HTTP 缓存中间件
 * @param {Object} options - 配置选项
 */
const httpCache = (options = {}) => {
  const {
    ttl = 300, // 默认缓存 5 分钟
    cacheKey = null, // 自定义缓存键生成函数
    condition = () => true, // 缓存条件函数
    varyBy = ['authorization'], // Vary 头字段
    private: isPrivate = false // 是否为私有缓存
  } = options;

  return async (req, res, next) => {
    // 检查是否应该缓存
    if (!condition(req)) {
      return next();
    }

    // 只缓存 GET 请求
    if (req.method !== 'GET') {
      return next();
    }

    // 生成缓存键
    const key = cacheKey 
      ? cacheKey(req)
      : `http:${req.originalUrl}:${req.user?.id || 'anonymous'}`;

    // 尝试从缓存获取
    const cached = await cacheManager.get(key);

    if (cached) {
      // 检查 If-None-Match (ETag)
      const etag = generateETag(JSON.stringify(cached.data));
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }

      // 检查 If-Modified-Since
      if (req.headers['if-modified-since']) {
        const ifModifiedSince = new Date(req.headers['if-modified-since']);
        const lastModified = new Date(cached.lastModified);
        if (ifModifiedSince >= lastModified) {
          return res.status(304).end();
        }
      }

      // 设置缓存头
      res.set({
        'ETag': etag,
        'Last-Modified': cached.lastModified,
        'Cache-Control': isPrivate 
          ? `private, max-age=${ttl}`
          : `public, max-age=${ttl}`,
        'Vary': varyBy.join(', ')
      });

      return res.status(cached.statusCode || 200).json(cached.data);
    }

    // 保存原始的 res.json 方法
    const originalJson = res.json.bind(res);

    // 重写 res.json 以缓存响应
    res.json = function(data) {
      // 只缓存成功的响应
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cacheData = {
          data,
          statusCode: res.statusCode,
          lastModified: new Date().toISOString()
        };

        // 异步缓存，不阻塞响应
        setImmediate(() => {
          cacheManager.set(key, cacheData, ttl).catch(err => {
            logger.error('HTTP cache set error:', err);
          });
        });

        // 设置缓存头
        const etag = generateETag(JSON.stringify(data));
        res.set({
          'ETag': etag,
          'Last-Modified': cacheData.lastModified,
          'Cache-Control': isPrivate 
            ? `private, max-age=${ttl}`
            : `public, max-age=${ttl}`,
          'Vary': varyBy.join(', ')
        });
      }

      return originalJson(data);
    };

    next();
  };
};

/**
 * 条件缓存中间件
 * 根据请求特征决定是否缓存
 */
const conditionalCache = (ttl = 300) => {
  return httpCache({
    ttl,
    condition: (req) => {
      // 不缓存带有特定查询参数的请求
      if (req.query.nocache || req.query.refresh) {
        return false;
      }
      
      // 不缓存管理员请求
      if (req.user?.roles?.some(r => r.name === 'admin')) {
        return false;
      }

      return true;
    }
  });
};

/**
 * 静态数据缓存
 * 用于缓存不常变化的数据
 */
const staticCache = (ttl = 3600) => {
  return httpCache({
    ttl,
    private: false,
    varyBy: ['accept-language', 'accept-encoding']
  });
};

/**
 * 用户特定缓存
 * 缓存用户相关的数据
 */
const userCache = (ttl = 300) => {
  return httpCache({
    ttl,
    private: true,
    cacheKey: (req) => {
      const userId = req.user?.id || 'anonymous';
      const queryString = new URLSearchParams(req.query).toString();
      return `user:${userId}:${req.path}:${queryString}`;
    }
  });
};

/**
 * 清除缓存中间件
 * 用于在数据更新后清除相关缓存
 */
const clearCache = (patterns = []) => {
  return async (req, res, next) => {
    // 保存原始的 res.json 方法
    const originalJson = res.json.bind(res);

    // 重写 res.json 以在成功响应后清除缓存
    res.json = async function(data) {
      // 只在成功的修改操作后清除缓存
      if (res.statusCode >= 200 && res.statusCode < 300 && 
          ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        
        // 异步清除缓存
        setImmediate(async () => {
          try {
            for (const pattern of patterns) {
              if (typeof pattern === 'function') {
                const key = pattern(req);
                await cacheManager.clearPattern(key);
              } else {
                await cacheManager.clearPattern(pattern);
              }
            }
          } catch (error) {
            logger.error('Clear cache error:', error);
          }
        });
      }

      return originalJson(data);
    };

    next();
  };
};

/**
 * 预热缓存
 * 在应用启动时预加载热门数据
 */
const warmupCache = async (routes) => {
  logger.info('开始预热缓存...');
  
  for (const route of routes) {
    try {
      const { path, fetcher, ttl = 3600 } = route;
      const data = await fetcher();
      const key = `http:${path}:anonymous`;
      await cacheManager.set(key, {
        data,
        statusCode: 200,
        lastModified: new Date().toISOString()
      }, ttl);
      logger.info(`缓存预热成功: ${path}`);
    } catch (error) {
      logger.error(`缓存预热失败: ${route.path}`, error);
    }
  }
  
  logger.info('缓存预热完成');
};

module.exports = {
  httpCache,
  conditionalCache,
  staticCache,
  userCache,
  clearCache,
  warmupCache,
  generateETag
};