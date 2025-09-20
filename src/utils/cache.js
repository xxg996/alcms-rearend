/**
 * Redis 缓存管理器
 * 提供高性能的数据缓存解决方案
 */

const redis = require('redis');
const { logger } = require('./logger');

class CacheManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = 3600; // 默认1小时
  }

  /**
   * 初始化Redis连接
   */
  async initialize() {
    // 检查是否禁用Redis
    if (process.env.DISABLE_REDIS === 'true') {
      logger.info('⚠️ Redis已禁用，使用内存缓存模式');
      this.initMemoryFallback();
      return;
    }

    try {
      // Redis配置
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
      };

      // 创建Redis客户端，禁用自动重连
      this.client = redis.createClient({
        socket: {
          host: redisConfig.host,
          port: redisConfig.port,
          connectTimeout: 2000,
          reconnectStrategy: false // 禁用自动重连
        },
        password: redisConfig.password,
        database: redisConfig.db,
      });

      // 设置一次性错误处理
      let errorLogged = false;
      this.client.on('error', (err) => {
        if (!errorLogged) {
          logger.info('⚠️ Redis连接失败，启用内存缓存降级方案');
          errorLogged = true;
        }
        this.isConnected = false;
        
        // 确保内存缓存已初始化
        if (!this.memoryCache) {
          this.initMemoryFallback();
        }
        
        // 清理Redis客户端，避免持续重连
        if (this.client) {
          try {
            this.client.removeAllListeners();
          } catch (e) {
            // 忽略清理错误
          }
        }
      });

      this.client.on('connect', () => {
        logger.info('✅ Redis连接成功');
        this.isConnected = true;
      });

      // 设置连接超时，快速降级
      const connectPromise = Promise.race([
        this.client.connect(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 2000);
        })
      ]);

      await connectPromise;

    } catch (error) {
      this.isConnected = false;
      
      // 清理可能的Redis客户端
      if (this.client) {
        try {
          this.client.removeAllListeners();
          this.client = null;
        } catch (e) {
          // 忽略清理错误
        }
      }
      
      this.initMemoryFallback();
    }
  }

  /**
   * 内存缓存降级方案
   */
  initMemoryFallback() {
    // 避免重复初始化
    if (this.memoryCache) return;
    
    logger.info('⚠️ Redis不可用，启用内存缓存降级方案');
    this.memoryCache = new Map();
    this.memoryTTL = new Map();
    
    // 定期清理过期的内存缓存
    setInterval(() => {
      const now = Date.now();
      for (const [key, expireTime] of this.memoryTTL.entries()) {
        if (now > expireTime) {
          this.memoryCache.delete(key);
          this.memoryTTL.delete(key);
        }
      }
    }, 60000); // 每分钟清理一次
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {*} value - 缓存值
   * @param {number} ttl - 过期时间（秒）
   */
  async set(key, value, ttl = this.defaultTTL) {
    try {
      const serializedValue = JSON.stringify(value);
      
      if (this.isConnected && this.client) {
        await this.client.setEx(key, ttl, serializedValue);
      } else if (this.memoryCache) {
        // 降级到内存缓存
        this.memoryCache.set(key, serializedValue);
        this.memoryTTL.set(key, Date.now() + (ttl * 1000));
      }
      
      return true;
    } catch (error) {
      logger.error('缓存设置失败:', error);
      return false;
    }
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {*} 缓存值或null
   */
  async get(key) {
    try {
      let value = null;
      
      if (this.isConnected && this.client) {
        value = await this.client.get(key);
      } else if (this.memoryCache) {
        // 检查内存缓存
        const expireTime = this.memoryTTL.get(key);
        if (expireTime && Date.now() <= expireTime) {
          value = this.memoryCache.get(key);
        } else {
          // 过期了，清理缓存
          this.memoryCache.delete(key);
          this.memoryTTL.delete(key);
        }
      }
      
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('缓存获取失败:', error);
      return null;
    }
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  async del(key) {
    try {
      if (this.isConnected && this.client) {
        await this.client.del(key);
      } else if (this.memoryCache) {
        this.memoryCache.delete(key);
        this.memoryTTL.delete(key);
      }
      return true;
    } catch (error) {
      logger.error('缓存删除失败:', error);
      return false;
    }
  }

  /**
   * 批量删除缓存（按模式）
   * @param {string} pattern - 匹配模式
   */
  async delByPattern(pattern) {
    try {
      let deletedCount = 0;

      if (this.isConnected && this.client) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          deletedCount = await this.client.del(keys);
          logger.debug(`Redis缓存删除成功`, { pattern, deletedCount, keys: keys.slice(0, 5) });
        } else {
          logger.debug(`Redis缓存模式未匹配到键`, { pattern });
        }
      } else if (this.memoryCache) {
        // 内存缓存中匹配模式删除
        // 转换Redis模式为JavaScript正则表达式
        const regexPattern = pattern
          .replace(/\*/g, '.*')           // * 转换为 .*
          .replace(/\?/g, '.')           // ? 转换为 .
          .replace(/\[([^\]]+)\]/g, '[$1]'); // 保持字符集不变

        const regex = new RegExp(`^${regexPattern}$`);

        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            this.memoryCache.delete(key);
            this.memoryTTL.delete(key);
            deletedCount++;
          }
        }

        if (deletedCount > 0) {
          logger.debug(`内存缓存删除成功`, { pattern, deletedCount });
        } else {
          logger.debug(`内存缓存模式未匹配到键`, { pattern });
        }
      }

      return deletedCount > 0;
    } catch (error) {
      logger.error('批量删除缓存失败:', error, { pattern });
      return false;
    }
  }

  /**
   * 检查缓存是否存在
   * @param {string} key - 缓存键
   */
  async exists(key) {
    try {
      if (this.isConnected && this.client) {
        return await this.client.exists(key) === 1;
      } else if (this.memoryCache) {
        const expireTime = this.memoryTTL.get(key);
        return expireTime && Date.now() <= expireTime;
      }
      return false;
    } catch (error) {
      logger.error('检查缓存存在性失败:', error);
      return false;
    }
  }

  /**
   * 生成缓存键
   * @param {string} prefix - 前缀
   * @param {...*} parts - 键的组成部分
   */
  generateKey(prefix, ...parts) {
    // 清理特殊字符，确保HTTP头部安全
    const sanitize = (str) => {
      if (str === undefined || str === null) return '';
      return String(str)
        .replace(/[\[\]"'\s,{}]/g, '') // 移除方括号、引号、空格、逗号、花括号
        .replace(/[^\w\-._~]/g, '_')   // 将其他特殊字符替换为下划线
        .substring(0, 100);            // 限制长度
    };
    
    const cleanParts = parts
      .filter(p => p !== undefined && p !== null)
      .map(p => sanitize(p));
      
    return `${sanitize(prefix)}:${cleanParts.join(':')}`;
  }

  /**
   * 缓存装饰器 - 自动缓存函数结果
   * @param {string} keyPrefix - 缓存键前缀
   * @param {number} ttl - 过期时间
   * @param {Function} keyGenerator - 键生成函数
   */
  cacheDecorator(keyPrefix, ttl = this.defaultTTL, keyGenerator = null) {
    return (target, propertyName, descriptor) => {
      const originalMethod = descriptor.value;
      
      descriptor.value = async function(...args) {
        const cacheKey = keyGenerator 
          ? keyGenerator(...args)
          : cache.generateKey(keyPrefix, ...args);

        // 尝试从缓存获取
        const cachedResult = await cache.get(cacheKey);
        if (cachedResult !== null) {
          return cachedResult;
        }

        // 执行原始方法
        const result = await originalMethod.apply(this, args);
        
        // 缓存结果
        if (result !== null && result !== undefined) {
          await cache.set(cacheKey, result, ttl);
        }
        
        return result;
      };
      
      return descriptor;
    };
  }

  /**
   * 清空所有缓存
   */
  async flush() {
    try {
      if (this.isConnected && this.client) {
        await this.client.flushDb();
      } else if (this.memoryCache) {
        this.memoryCache.clear();
        this.memoryTTL.clear();
      }
      logger.info('✅ 缓存已清空');
      return true;
    } catch (error) {
      logger.error('清空缓存失败:', error);
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats() {
    try {
      const stats = {
        connected: this.isConnected,
        type: this.isConnected ? 'Redis' : 'Memory',
        timestamp: new Date().toISOString()
      };

      if (this.isConnected && this.client) {
        const info = await this.client.info('memory');
        stats.memoryUsage = info;
      } else if (this.memoryCache) {
        stats.cacheSize = this.memoryCache.size;
        stats.memoryEstimate = `${this.memoryCache.size} items`;
      }

      return stats;
    } catch (error) {
      logger.error('获取缓存统计失败:', error);
      return { error: error.message };
    }
  }

  /**
   * 关闭连接
   */
  async close() {
    try {
      if (this.client) {
        // 移除所有事件监听器
        this.client.removeAllListeners();
        
        if (this.isConnected) {
          await this.client.disconnect();
          logger.info('✅ Redis连接已关闭');
        }
        
        this.client = null;
      }
      
      // 清理内存缓存
      if (this.memoryCache) {
        this.memoryCache.clear();
        this.memoryTTL.clear();
      }
      
      this.isConnected = false;
    } catch (error) {
      // 静默处理关闭错误，避免无用日志
      this.client = null;
      this.isConnected = false;
    }
  }
}

// 创建全局缓存实例
const cache = new CacheManager();

// 常用的缓存TTL配置
const TTL = {
  VERY_SHORT: 300,    // 5分钟 - 用户会话数据
  SHORT: 900,         // 15分钟 - 动态内容
  MEDIUM: 3600,       // 1小时 - 资源列表
  LONG: 86400,        // 24小时 - 用户信息
  VERY_LONG: 604800,  // 7天 - 静态配置
};

module.exports = {
  cache,
  CacheManager,
  TTL
};