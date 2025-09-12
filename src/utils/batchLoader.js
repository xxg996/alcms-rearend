/**
 * 批量查询加载器
 * 解决N+1查询问题，提供高效的数据预加载
 */

const { logger } = require('./logger');

class BatchLoader {
  constructor() {
    this.loaders = new Map();
  }

  /**
   * 创建数据加载器
   * @param {string} name - 加载器名称
   * @param {Function} batchFn - 批量加载函数
   * @param {Object} options - 选项
   */
  createLoader(name, batchFn, options = {}) {
    const loader = {
      name,
      batchFn,
      cache: new Map(),
      pending: new Map(),
      options: {
        maxBatchSize: 100,
        cacheTimeout: 300000, // 5分钟
        ...options
      }
    };
    
    this.loaders.set(name, loader);
    return loader;
  }

  /**
   * 批量加载数据
   * @param {string} loaderName - 加载器名称
   * @param {*} key - 查询键
   * @returns {Promise} 数据
   */
  async load(loaderName, key) {
    const loader = this.loaders.get(loaderName);
    if (!loader) {
      throw new Error(`加载器 ${loaderName} 不存在`);
    }

    // 检查缓存
    const cacheKey = this.getCacheKey(key);
    const cached = loader.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < loader.options.cacheTimeout) {
      return cached.data;
    }

    // 检查是否已有相同的请求正在处理
    if (loader.pending.has(cacheKey)) {
      return loader.pending.get(cacheKey);
    }

    // 创建Promise并加入待处理队列
    const promise = new Promise((resolve, reject) => {
      // 延迟执行，收集同一批次的请求
      process.nextTick(() => {
        this.processBatch(loader, key, resolve, reject);
      });
    });

    loader.pending.set(cacheKey, promise);
    return promise;
  }

  /**
   * 批量加载多个键
   * @param {string} loaderName - 加载器名称
   * @param {Array} keys - 查询键数组
   * @returns {Promise<Array>} 数据数组
   */
  async loadMany(loaderName, keys) {
    const promises = keys.map(key => this.load(loaderName, key));
    return Promise.all(promises);
  }

  /**
   * 处理批次请求
   */
  async processBatch(loader, key, resolve, reject) {
    try {
      // 收集当前批次的所有键
      const batchKeys = [key];
      const batchResolvers = [{ resolve, reject, key }];

      // 检查是否有其他待处理的键
      for (const [cacheKey, promise] of loader.pending.entries()) {
        if (promise !== loader.pending.get(this.getCacheKey(key)) && 
            batchKeys.length < loader.options.maxBatchSize) {
          
          const originalKey = this.getOriginalKey(cacheKey);
          batchKeys.push(originalKey);
          
          // 获取resolver信息（需要修改Promise结构）
          batchResolvers.push({
            key: originalKey,
            cacheKey,
            promise
          });
        }
      }

      // 执行批量查询
      const results = await loader.batchFn(batchKeys);
      const now = Date.now();

      // 缓存结果并解析Promise
      for (let i = 0; i < batchKeys.length; i++) {
        const resultKey = batchKeys[i];
        const cacheKey = this.getCacheKey(resultKey);
        const data = results[i];

        // 缓存结果
        loader.cache.set(cacheKey, {
          data,
          timestamp: now
        });

        // 移除待处理状态
        loader.pending.delete(cacheKey);

        // 解析对应的Promise
        if (i === 0) {
          resolve(data);
        }
      }

    } catch (error) {
      logger.error('批量加载失败:', error);
      loader.pending.delete(this.getCacheKey(key));
      reject(error);
    }
  }

  /**
   * 清除缓存
   * @param {string} loaderName - 加载器名称
   * @param {*} key - 可选，特定键
   */
  clearCache(loaderName, key = null) {
    const loader = this.loaders.get(loaderName);
    if (!loader) return;

    if (key) {
      const cacheKey = this.getCacheKey(key);
      loader.cache.delete(cacheKey);
    } else {
      loader.cache.clear();
    }
  }

  /**
   * 生成缓存键
   */
  getCacheKey(key) {
    if (typeof key === 'object') {
      return JSON.stringify(key);
    }
    return String(key);
  }

  /**
   * 从缓存键获取原始键
   */
  getOriginalKey(cacheKey) {
    try {
      return JSON.parse(cacheKey);
    } catch {
      return cacheKey;
    }
  }

  /**
   * 获取加载器统计
   */
  getStats(loaderName) {
    const loader = this.loaders.get(loaderName);
    if (!loader) return null;

    return {
      name: loader.name,
      cacheSize: loader.cache.size,
      pendingSize: loader.pending.size,
      maxBatchSize: loader.options.maxBatchSize
    };
  }
}

// 创建全局实例
const batchLoader = new BatchLoader();

/**
 * 资源相关的批量加载器
 */

// 批量加载资源标签
batchLoader.createLoader('resource_tags', async (resourceIds) => {
  const { query } = require('../config/database');
  
  if (resourceIds.length === 0) return [];
  
  const result = await query(`
    SELECT 
      rt.resource_id,
      t.id,
      t.name,
      t.display_name,
      t.color
    FROM resource_tags rt
    JOIN tags t ON rt.tag_id = t.id
    WHERE rt.resource_id = ANY($1)
    ORDER BY rt.resource_id, t.name
  `, [resourceIds]);
  
  // 按资源ID分组
  const tagsByResource = {};
  resourceIds.forEach(id => {
    tagsByResource[id] = [];
  });
  
  result.rows.forEach(row => {
    tagsByResource[row.resource_id].push({
      id: row.id,
      name: row.name,
      display_name: row.display_name,
      color: row.color
    });
  });
  
  return resourceIds.map(id => tagsByResource[id] || []);
});

// 批量加载用户信息
batchLoader.createLoader('users', async (userIds) => {
  const { query } = require('../config/database');
  
  if (userIds.length === 0) return [];
  
  const result = await query(`
    SELECT 
      id, username, nickname, email, avatar_url, 
      status, created_at, updated_at
    FROM users 
    WHERE id = ANY($1)
  `, [userIds]);
  
  // 创建用户映射
  const userMap = {};
  result.rows.forEach(user => {
    userMap[user.id] = user;
  });
  
  return userIds.map(id => userMap[id] || null);
});

// 批量加载分类信息
batchLoader.createLoader('categories', async (categoryIds) => {
  const { query } = require('../config/database');
  
  if (categoryIds.length === 0) return [];
  
  const result = await query(`
    SELECT 
      id, name, display_name, description, icon_url, color
    FROM categories 
    WHERE id = ANY($1)
  `, [categoryIds]);
  
  const categoryMap = {};
  result.rows.forEach(category => {
    categoryMap[category.id] = category;
  });
  
  return categoryIds.map(id => categoryMap[id] || null);
});

// 批量加载下载权限信息
batchLoader.createLoader('download_permissions', async (permissionKeys) => {
  const { validateDownloadPermission } = require('./downloadUtils');
  
  // permissionKeys 是 {userId, resource} 对象数组
  const results = await Promise.all(
    permissionKeys.map(async ({ userId, resource }) => {
      try {
        return await validateDownloadPermission(userId, resource);
      } catch (error) {
        logger.error('批量权限检查失败:', error);
        return { allowed: false, reason: '权限检查失败' };
      }
    })
  );
  
  return results;
});

/**
 * 社区相关批量加载器
 */

// 批量加载帖子评论数
batchLoader.createLoader('post_comment_counts', async (postIds) => {
  const { query } = require('../config/database');
  
  if (postIds.length === 0) return [];
  
  const result = await query(`
    SELECT 
      post_id,
      COUNT(*) as comment_count
    FROM community_comments
    WHERE post_id = ANY($1) AND deleted_at IS NULL
    GROUP BY post_id
  `, [postIds]);
  
  const countMap = {};
  result.rows.forEach(row => {
    countMap[row.post_id] = parseInt(row.comment_count);
  });
  
  return postIds.map(id => countMap[id] || 0);
});

// 批量加载用户互动状态
batchLoader.createLoader('user_interactions', async (interactionKeys) => {
  const { query } = require('../config/database');
  
  if (interactionKeys.length === 0) return [];
  
  // interactionKeys 是 {userId, targetId, targetType} 对象数组
  const conditions = interactionKeys.map((_, index) => 
    `(user_id = $${index * 3 + 1} AND target_id = $${index * 3 + 2} AND target_type = $${index * 3 + 3})`
  ).join(' OR ');
  
  const params = interactionKeys.flatMap(k => [k.userId, k.targetId, k.targetType]);
  
  const result = await query(`
    SELECT user_id, target_id, target_type, interaction_type
    FROM community_interactions
    WHERE ${conditions}
  `, params);
  
  // 创建交互映射
  const interactionMap = {};
  result.rows.forEach(row => {
    const key = `${row.user_id}-${row.target_id}-${row.target_type}`;
    interactionMap[key] = row.interaction_type;
  });
  
  return interactionKeys.map(k => {
    const key = `${k.userId}-${k.targetId}-${k.targetType}`;
    return interactionMap[key] || null;
  });
});

module.exports = {
  batchLoader,
  BatchLoader
};