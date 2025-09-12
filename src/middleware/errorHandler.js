const { logger } = require('../utils/logger');
/**
 * 统一错误处理中间件
 * 处理各种类型的错误并返回标准化的响应
 */

/**
 * 请求验证中间件
 * 验证请求体是否为有效的JSON
 */
const validateJsonRequest = (req, res, next) => {
  // 只对有请求体的请求进行验证
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    // 检查Content-Type
    const contentType = req.get('Content-Type');
    if (contentType && !contentType.includes('application/json')) {
      return res.status(400).json({
        success: false,
        message: '请求头Content-Type必须为application/json',
        error: 'Invalid Content-Type'
      });
    }
  }
  
  next();
};

/**
 * 404错误处理
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的端点不存在',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

/**
 * 全局错误处理中间件
 */
const globalErrorHandler = (err, req, res, next) => {
  // 记录错误日志
  logger.error('全局错误:', err);

  // JWT相关错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: '无效的访问令牌',
      error: 'Invalid JWT token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: '访问令牌已过期',
      error: 'JWT token expired'
    });
  }

  // JSON解析错误
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: '请求数据格式错误，请检查JSON格式是否正确',
      error: 'Invalid JSON format',
      details: err.message
    });
  }

  // 请求体过大错误
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: '请求数据过大',
      error: 'Request entity too large'
    });
  }

  // 数据库错误
  if (err.code === '23505') { // PostgreSQL唯一约束违反
    return res.status(409).json({
      success: false,
      message: '数据已存在，请检查重复字段',
      error: 'Duplicate entry'
    });
  }

  if (err.code === '23503') { // PostgreSQL外键约束违反
    return res.status(400).json({
      success: false,
      message: '关联数据不存在',
      error: 'Foreign key constraint violation'
    });
  }

  if (err.code === '23514') { // PostgreSQL检查约束违反
    return res.status(400).json({
      success: false,
      message: '数据不符合约束条件',
      error: 'Check constraint violation'
    });
  }

  // 验证错误
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: '输入验证失败',
      error: 'Validation failed',
      details: err.errors
    });
  }

  // 权限错误
  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return res.status(401).json({
      success: false,
      message: '未授权访问',
      error: 'Unauthorized'
    });
  }

  if (err.status === 403) {
    return res.status(403).json({
      success: false,
      message: '权限不足',
      error: 'Forbidden'
    });
  }

  // 请求参数错误
  if (err.status === 400) {
    return res.status(400).json({
      success: false,
      message: err.message || '请求参数错误',
      error: 'Bad Request'
    });
  }

  // 资源不存在错误
  if (err.status === 404) {
    return res.status(404).json({
      success: false,
      message: err.message || '请求的资源不存在',
      error: 'Not Found'
    });
  }

  // 服务器内部错误
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? '服务器内部错误' 
    : err.message || '服务器内部错误';

  res.status(statusCode).json({
    success: false,
    message,
    error: 'Internal Server Error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== 'production' && {
      stack: err.stack,
      details: err
    })
  });
};

/**
 * 异步错误捕获包装器
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 创建自定义错误
 */
class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

module.exports = {
  validateJsonRequest,
  notFoundHandler,
  globalErrorHandler,
  asyncHandler,
  ApiError
};
