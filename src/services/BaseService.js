/**
 * Service基类
 * 提供通用的业务逻辑处理方法和错误处理
 */

const { logger } = require('../utils/logger');
const { cache } = require('../utils/cache');

class BaseService {
  constructor() {
    this.serviceName = this.constructor.name;
  }

  /**
   * 标准化错误处理
   */
  handleError(error, operation = 'unknown') {
    const errorMsg = `${this.serviceName}.${operation} 执行失败: ${error.message}`;
    logger.error(errorMsg, {
      service: this.serviceName,
      operation,
      error: error.stack
    });
    
    // 根据错误类型返回标准化错误
    if (error.code === '23505') { // PostgreSQL唯一约束违反
      throw new Error('数据已存在，请检查唯一性约束');
    } else if (error.code === '23503') { // 外键约束违反
      throw new Error('关联数据不存在，请检查数据完整性');
    } else if (error.code === '23514') { // 检查约束违反
      throw new Error('数据不符合约束条件');
    }
    
    throw error;
  }

  /**
   * 标准化成功响应
   */
  formatSuccessResponse(data = null, message = '操作成功') {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 标准化错误响应
   */
  formatErrorResponse(message = '操作失败', details = null) {
    return {
      success: false,
      message,
      details,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 参数验证
   */
  validateRequired(params, requiredFields) {
    const missing = requiredFields.filter(field => 
      params[field] === undefined || params[field] === null || params[field] === ''
    );
    
    if (missing.length > 0) {
      throw new Error(`缺少必需参数: ${missing.join(', ')}`);
    }
  }

  /**
   * 分页参数验证和标准化
   */
  normalizePaginationParams(page = 1, limit = 20) {
    const normalizedPage = Math.max(1, parseInt(page) || 1);
    const normalizedLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const offset = (normalizedPage - 1) * normalizedLimit;

    return {
      page: normalizedPage,
      limit: normalizedLimit,
      offset
    };
  }

  /**
   * 生成标准化分页响应
   */
  formatPaginatedResponse(items, pagination, totalCount) {
    return {
      success: true,
      data: {
        items,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / pagination.limit),
          hasNext: pagination.page * pagination.limit < totalCount,
          hasPrev: pagination.page > 1
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 缓存辅助方法
   */
  async getCached(key, fallback, ttl = 300) {
    try {
      const cached = await cache.get(key);
      if (cached) {
        logger.debug(`缓存命中: ${key}`, { service: this.serviceName });
        return cached;
      }

      const result = await fallback();
      await cache.set(key, result, ttl);
      logger.debug(`数据已缓存: ${key}`, { service: this.serviceName, ttl });
      return result;
    } catch (error) {
      this.handleError(error, 'getCached');
    }
  }

  /**
   * 清除相关缓存
   */
  async clearCache(pattern) {
    try {
      await cache.delete(pattern);
      logger.debug(`缓存已清除: ${pattern}`, { service: this.serviceName });
    } catch (error) {
      logger.warn(`清除缓存失败: ${pattern}`, error.message);
    }
  }

  /**
   * 事务辅助方法
   */
  async executeInTransaction(callback) {
    const { transaction } = require('../config/database');
    
    try {
      const result = await transaction(callback);
      logger.info(`事务执行成功`, { service: this.serviceName });
      return result;
    } catch (error) {
      logger.error(`事务执行失败`, { 
        service: this.serviceName, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 日志记录辅助方法
   */
  log(level, message, data = {}) {
    logger[level](message, {
      service: this.serviceName,
      ...data
    });
  }

  /**
   * 性能监控装饰器
   */
  async withPerformanceMonitoring(operation, callback) {
    const start = Date.now();
    try {
      const result = await callback();
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        logger.warn(`慢操作检测`, {
          service: this.serviceName,
          operation,
          duration: `${duration}ms`
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`操作失败`, {
        service: this.serviceName,
        operation,
        duration: `${duration}ms`,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 权限检查辅助方法
   */
  checkPermission(user, requiredPermission) {
    if (!user) {
      throw new Error('用户未认证');
    }

    if (user.role === 'admin') {
      return true; // 管理员拥有所有权限
    }

    if (user.permissions && user.permissions.includes(requiredPermission)) {
      return true;
    }

    throw new Error('权限不足');
  }

  /**
   * 数据脱敏
   */
  sanitizeData(data, sensitiveFields = ['password', 'secret', 'key']) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '***';
      }
    });

    return sanitized;
  }

  /**
   * 批量操作辅助方法
   */
  async batchProcess(items, processor, options = {}) {
    const {
      batchSize = 10,
      maxRetries = 3,
      retryDelay = 1000,
      continueOnError = true
    } = options;

    const results = [];
    const errors = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map(async (item, index) => {
        let attempts = 0;
        let lastError;

        while (attempts < maxRetries) {
          try {
            const result = await processor(item, i + index);
            return { success: true, item, result, index: i + index };
          } catch (error) {
            lastError = error;
            attempts++;
            
            if (attempts < maxRetries) {
              await this.delay(retryDelay * attempts);
            }
          }
        }

        return { success: false, item, error: lastError, index: i + index };
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        if (result.success) {
          results.push(result);
        } else {
          errors.push(result);
          if (!continueOnError) {
            throw new Error(`批量处理失败: ${result.error.message}`);
          }
        }
      }
    }

    return { results, errors };
  }

  /**
   * 延迟工具方法
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 重试机制
   */
  async retry(operation, options = {}) {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      backoffMultiplier = 2,
      retryCondition = () => true
    } = options;

    let attempts = 0;
    let delay = retryDelay;

    while (attempts < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        attempts++;
        
        if (attempts >= maxRetries || !retryCondition(error)) {
          throw error;
        }

        this.log('warn', `操作失败，${delay}ms后重试 (${attempts}/${maxRetries})`, {
          service: this.serviceName,
          error: error.message
        });

        await this.delay(delay);
        delay *= backoffMultiplier;
      }
    }
  }

  /**
   * 限流器
   */
  createRateLimiter(maxRequests, windowMs) {
    const requests = [];
    
    return async (operation) => {
      const now = Date.now();
      
      // 清理过期请求
      while (requests.length > 0 && requests[0] < now - windowMs) {
        requests.shift();
      }

      if (requests.length >= maxRequests) {
        throw new Error('请求频率过高，请稍后重试');
      }

      requests.push(now);
      return await operation();
    };
  }

  /**
   * 数据验证装饰器
   */
  validateSchema(schema) {
    return (target, propertyName, descriptor) => {
      const method = descriptor.value;

      descriptor.value = async function(...args) {
        const [data] = args;
        
        try {
          // 这里可以集成joi、yup等验证库
          this.validateWithSchema(data, schema);
          return await method.apply(this, args);
        } catch (error) {
          throw new Error(`数据验证失败: ${error.message}`);
        }
      };
    };
  }

  /**
   * 简单的数据验证
   */
  validateWithSchema(data, schema) {
    for (const [key, rules] of Object.entries(schema)) {
      const value = data[key];
      
      if (rules.required && (value === undefined || value === null || value === '')) {
        throw new Error(`字段 ${key} 是必需的`);
      }

      if (value !== undefined && value !== null) {
        if (rules.type && typeof value !== rules.type) {
          throw new Error(`字段 ${key} 类型错误，期望 ${rules.type}`);
        }

        if (rules.min && value < rules.min) {
          throw new Error(`字段 ${key} 不能小于 ${rules.min}`);
        }

        if (rules.max && value > rules.max) {
          throw new Error(`字段 ${key} 不能大于 ${rules.max}`);
        }

        if (rules.minLength && value.length < rules.minLength) {
          throw new Error(`字段 ${key} 长度不能少于 ${rules.minLength} 个字符`);
        }

        if (rules.maxLength && value.length > rules.maxLength) {
          throw new Error(`字段 ${key} 长度不能超过 ${rules.maxLength} 个字符`);
        }

        if (rules.pattern && !rules.pattern.test(value)) {
          throw new Error(`字段 ${key} 格式不正确`);
        }
      }
    }
  }

  /**
   * 数据转换工具
   */
  transformData(data, transformMap) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const transformed = {};
    
    for (const [key, value] of Object.entries(data)) {
      const transformer = transformMap[key];
      
      if (transformer && typeof transformer === 'function') {
        transformed[key] = transformer(value);
      } else {
        transformed[key] = value;
      }
    }

    return transformed;
  }

  /**
   * 分布式锁（基于缓存实现）
   */
  async withLock(lockKey, operation, timeout = 30000) {
    const lockValue = `${Date.now()}_${Math.random()}`;
    const acquired = await cache.setIfNotExists(lockKey, lockValue, timeout / 1000);
    
    if (!acquired) {
      throw new Error('获取锁失败，请稍后重试');
    }

    try {
      return await operation();
    } finally {
      // 确保只删除自己的锁
      const currentValue = await cache.get(lockKey);
      if (currentValue === lockValue) {
        await cache.delete(lockKey);
      }
    }
  }

  /**
   * 服务健康检查
   */
  async healthCheck() {
    const checks = [];

    try {
      // 检查数据库连接
      const { pool } = require('../config/database');
      const dbCheck = await pool.query('SELECT 1');
      checks.push({
        name: 'database',
        status: 'healthy',
        message: 'Database connection successful'
      });
    } catch (error) {
      checks.push({
        name: 'database',
        status: 'unhealthy',
        message: error.message
      });
    }

    try {
      // 检查缓存连接
      await cache.set('health_check', 'ok', 1);
      await cache.get('health_check');
      checks.push({
        name: 'cache',
        status: 'healthy',
        message: 'Cache connection successful'
      });
    } catch (error) {
      checks.push({
        name: 'cache',
        status: 'unhealthy',
        message: error.message
      });
    }

    const overallStatus = checks.every(check => check.status === 'healthy') ? 'healthy' : 'unhealthy';

    return {
      service: this.serviceName,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks
    };
  }

  /**
   * 生成唯一ID
   */
  generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
  }

  /**
   * 格式化金额
   */
  formatCurrency(amount, currency = 'CNY') {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency
    }).format(amount);
  }

  /**
   * 格式化日期
   */
  formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hour)
      .replace('mm', minute)
      .replace('ss', second);
  }

  /**
   * 深度合并对象
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * 清理方法（用于优雅关闭）
   */
  cleanup() {
    this.log('info', '服务清理完成', { service: this.serviceName });
  }
}

module.exports = BaseService;