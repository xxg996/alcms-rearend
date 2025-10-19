/**
 * CORS 配置缓存管理器
 * 提供高效的CORS白名单缓存机制，避免频繁查询数据库
 */

const SystemSetting = require('../models/SystemSetting');
const { logger } = require('./logger');

class CorsCache {
  constructor() {
    this.cache = null;
    this.lastUpdated = null;
    this.cacheExpireMs = 5 * 60 * 1000; // 5分钟缓存过期
    this.refreshInProgress = false;
  }

  /**
   * 获取CORS配置（带缓存）
   */
  async getCorsConfig() {
    try {
      // 如果缓存有效，直接返回
      if (this.isCacheValid()) {
        return this.cache;
      }

      // 如果正在刷新缓存，等待完成
      if (this.refreshInProgress) {
        return this.waitForRefresh();
      }

      // 刷新缓存
      return await this.refreshCache();
    } catch (error) {
      logger.error('获取CORS配置失败:', error);

      // 如果有旧缓存，返回旧缓存
      if (this.cache) {
        logger.warn('使用过期的CORS缓存配置');
        return this.cache;
      }

      // 返回默认配置
      return this.getDefaultConfig();
    }
  }

  /**
   * 检查缓存是否有效
   */
  isCacheValid() {
    if (!this.cache || !this.lastUpdated) {
      return false;
    }

    const now = Date.now();
    return (now - this.lastUpdated) < this.cacheExpireMs;
  }

  /**
   * 刷新缓存
   */
  async refreshCache() {
    this.refreshInProgress = true;

    try {
      logger.info('刷新CORS配置缓存...');

      const config = await SystemSetting.getCorsConfig();

      this.cache = {
        ...config,
        // 添加一些元数据
        _meta: {
          cachedAt: Date.now(),
          source: 'database'
        }
      };

      this.lastUpdated = Date.now();

      logger.info('CORS配置缓存已更新', {
        allowedOriginsCount: config.allowed_origins.length,
        origins: config.allowed_origins.slice(0, 3) // 只记录前3个域名
      });

      return this.cache;
    } finally {
      this.refreshInProgress = false;
    }
  }

  /**
   * 等待刷新完成
   */
  async waitForRefresh() {
    let attempts = 0;
    const maxAttempts = 50; // 最多等待5秒

    while (this.refreshInProgress && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    return this.cache || this.getDefaultConfig();
  }

  /**
   * 强制刷新缓存
   */
  async forceRefresh() {
    this.cache = null;
    this.lastUpdated = null;
    return await this.refreshCache();
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache = null;
    this.lastUpdated = null;
    logger.info('CORS配置缓存已清除');
  }

  /**
   * 获取默认配置（作为fallback）
   */
  getDefaultConfig() {
    return {
      allowed_origins: process.env.NODE_ENV === 'production'
        ? []
        : ['http://localhost:3000', 'http://localhost:3001'],
      _meta: {
        cachedAt: Date.now(),
        source: 'default'
      }
    };
  }

  /**
   * 检查指定域名是否在白名单中
   */
  async isOriginAllowed(origin) {
    if (!origin) {
      // 开发环境允许无origin请求（如Postman、移动端等）
      return process.env.NODE_ENV === 'development';
    }

    const parseOrigin = (value) => {
      if (!value || typeof value !== 'string') {
        return null;
      }

      try {
        const url = new URL(value);
        const protocol = url.protocol.replace(/:$/u, '').toLowerCase();

        if (protocol !== 'http' && protocol !== 'https') {
          return null;
        }

        return {
          type: 'origin',
          protocol,
          host: url.hostname.toLowerCase(),
          port: url.port ? url.port : null
        };
      } catch {
        const hostPattern = /^([a-z0-9.-]+)$/u;
        if (hostPattern.test(value)) {
          return {
            type: 'host',
            host: value.toLowerCase()
          };
        }

        return null;
      }
    };

    const defaultPort = (protocol) => (protocol === 'https' ? '443' : '80');

    const matches = (entryValue, requestInfo) => {
      const entryInfo = parseOrigin(entryValue);
      if (!entryInfo || !requestInfo) {
        return false;
      }

      if (entryInfo.type === 'host') {
        return entryInfo.host === requestInfo.host;
      }

      if (entryInfo.type === 'origin') {
        if (entryInfo.protocol !== requestInfo.protocol) {
          return false;
        }

        if (entryInfo.host !== requestInfo.host) {
          return false;
        }

        const entryPort = entryInfo.port || defaultPort(entryInfo.protocol);
        const requestPort = requestInfo.port || defaultPort(requestInfo.protocol);

        return entryPort === requestPort;
      }

      return false;
    };

    const requestInfo = parseOrigin(origin);
    if (!requestInfo) {
      return false;
    }

    const config = await this.getCorsConfig();
    return config.allowed_origins.some((item) => matches(item, requestInfo));
  }

  /**
   * 获取缓存状态信息
   */
  getCacheStatus() {
    return {
      hasCache: !!this.cache,
      lastUpdated: this.lastUpdated,
      isValid: this.isCacheValid(),
      refreshInProgress: this.refreshInProgress,
      cacheExpireMs: this.cacheExpireMs,
      allowedOriginsCount: this.cache?.allowed_origins?.length || 0
    };
  }

  /**
   * 设置缓存过期时间
   */
  setCacheExpireTime(ms) {
    this.cacheExpireMs = ms;
    logger.info(`CORS缓存过期时间已设置为 ${ms}ms`);
  }
}

// 创建单例实例
const corsCache = new CorsCache();

module.exports = corsCache;
