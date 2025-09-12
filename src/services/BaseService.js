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
}

module.exports = BaseService;