/**
 * 专业日志系统
 * 替换console.log，提供结构化日志记录
 */

const winston = require('winston');
const path = require('path');

// 确保日志目录存在
const logDir = path.join(__dirname, '../../logs');

/**
 * 自定义日志格式
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: false }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
    
    // 添加元数据
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    // 添加错误堆栈
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

/**
 * 生产环境格式（JSON）
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * 创建日志传输器
 */
const createTransports = () => {
  const transports = [];
  
  // 控制台输出（开发环境彩色，生产环境JSON）
  transports.push(
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? productionFormat : winston.format.combine(
        winston.format.colorize(),
        customFormat
      ),
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    })
  );

  // 文件输出
  if (process.env.NODE_ENV !== 'test') {
    // 所有日志
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        format: productionFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      })
    );

    // 错误日志
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: productionFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      })
    );

    // 访问日志
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'access.log'),
        level: 'info',
        format: productionFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 10,
        tailable: true
      })
    );
  }

  return transports;
};

/**
 * 创建Winston Logger实例
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: productionFormat,
  defaultMeta: {
    service: 'alcms-backend',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: createTransports(),
  // 处理未捕获的异常
  handleExceptions: true,
  handleRejections: true,
  exitOnError: false
});

/**
 * 增强的日志类
 */
class Logger {
  constructor(context = 'System') {
    this.context = context;
    this.winston = logger;
  }

  /**
   * 创建带上下文的日志记录器
   * @param {string} context - 上下文标识
   */
  static create(context) {
    return new Logger(context);
  }

  /**
   * 添加请求上下文
   * @param {Object} req - Express请求对象
   */
  setRequestContext(req) {
    this.requestId = req.id || req.headers['x-request-id'] || `${Date.now()}-${Math.random()}`;
    this.userId = req.user?.id || 'anonymous';
    this.ip = req.ip || req.connection.remoteAddress;
    return this;
  }

  /**
   * 格式化元数据
   */
  formatMeta(meta = {}) {
    return {
      context: this.context,
      requestId: this.requestId,
      userId: this.userId,
      ip: this.ip,
      pid: process.pid,
      ...meta
    };
  }

  /**
   * 检查日志系统是否可用
   */
  _isAvailable() {
    return !isShuttingDown && this.winston && !this.winston.destroyed;
  }

  /**
   * Debug级别日志
   */
  debug(message, meta = {}) {
    if (!this._isAvailable()) return;
    try {
      this.winston.debug(message, this.formatMeta(meta));
    } catch (error) {
      // 静默忽略关闭时的错误
    }
  }

  /**
   * Info级别日志
   */
  info(message, meta = {}) {
    if (!this._isAvailable()) return;
    try {
      this.winston.info(message, this.formatMeta(meta));
    } catch (error) {
      // 静默忽略关闭时的错误
    }
  }

  /**
   * Warn级别日志
   */
  warn(message, meta = {}) {
    if (!this._isAvailable()) return;
    try {
      this.winston.warn(message, this.formatMeta(meta));
    } catch (error) {
      // 静默忽略关闭时的错误
    }
  }

  /**
   * Error级别日志
   */
  error(message, error = null, meta = {}) {
    if (!this._isAvailable()) return;
    try {
      const errorMeta = this.formatMeta({
        ...meta,
        ...(error && {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code
          }
        })
      });
      
      this.winston.error(message, errorMeta);
    } catch (err) {
      // 静默忽略关闭时的错误
    }
  }

  /**
   * Fatal级别日志（严重错误）
   */
  fatal(message, error = null, meta = {}) {
    this.error(`[FATAL] ${message}`, error, { ...meta, fatal: true });
    
    // 严重错误时，考虑发送告警
    if (process.env.NODE_ENV === 'production') {
      // 这里可以集成告警系统，如邮件、钉钉、短信等
      this.sendAlert(message, error);
    }
  }

  /**
   * 记录数据库操作
   */
  database(operation, table, duration, meta = {}) {
    this.info(`DB: ${operation} ${table}`, {
      ...meta,
      operation,
      table,
      duration: `${duration}ms`,
      type: 'database'
    });
  }

  /**
   * 记录缓存操作
   */
  cache(operation, key, hit, duration, meta = {}) {
    this.info(`Cache: ${operation} ${key}`, {
      ...meta,
      operation,
      key,
      hit,
      duration: `${duration}ms`,
      type: 'cache'
    });
  }

  /**
   * 记录API访问
   */
  api(method, path, statusCode, duration, meta = {}) {
    const level = statusCode >= 500 ? 'error' : 
                 statusCode >= 400 ? 'warn' : 'info';
    
    this.winston[level](`API: ${method} ${path}`, this.formatMeta({
      ...meta,
      method,
      path,
      statusCode,
      duration: `${duration}ms`,
      type: 'api'
    }));
  }

  /**
   * 记录性能指标
   */
  performance(operation, duration, meta = {}) {
    const level = duration > 1000 ? 'warn' : 'info'; // 超过1秒警告
    
    this.winston[level](`Performance: ${operation}`, this.formatMeta({
      ...meta,
      operation,
      duration: `${duration}ms`,
      type: 'performance'
    }));
  }

  /**
   * 记录安全事件
   */
  security(event, level = 'warn', meta = {}) {
    this.winston[level](`Security: ${event}`, this.formatMeta({
      ...meta,
      event,
      type: 'security'
    }));
  }

  /**
   * 发送告警（生产环境）
   */
  sendAlert(message, error) {
    // 这里可以集成外部告警系统
    // 例如：邮件、Slack、钉钉、短信等
    logger.error('🚨 ALERT:', message, error?.message);
  }

  /**
   * 创建子日志记录器
   */
  child(context) {
    return new Logger(`${this.context}:${context}`);
  }
}

/**
 * 全局日志实例
 */
const log = new Logger('App');

/**
 * 替换console方法（仅在需要时使用）
 */
const replaceConsole = () => {
  if (process.env.REPLACE_CONSOLE === 'true') {
    console.log = (...args) => log.info(args.join(' '));
    console.info = (...args) => log.info(args.join(' '));
    console.warn = (...args) => log.warn(args.join(' '));
    console.error = (...args) => log.error(args.join(' '));
    console.debug = (...args) => log.debug(args.join(' '));
  }
};

/**
 * 创建目录（如果不存在）
 */
const createLogDirectory = () => {
  const fs = require('fs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    log.info('日志目录已创建', { directory: logDir });
  }
};

// 初始化
createLogDirectory();
replaceConsole();

// 优雅关闭处理
let isShuttingDown = false;

/**
 * 主动关闭日志系统
 * @param {string} signal - 触发关闭的信号
 */
function shutdownLogger(signal = 'SIGTERM') {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  // 使用原生输出提示日志系统正在关闭，避免 logger 自身被提前终止
  console.log(`接收到${signal}信号，准备关闭日志系统`);

  // 给日志传输器留时间冲洗缓冲区
  setTimeout(() => {
    try {
      logger.end();
    } catch (error) {
      // 忽略关闭过程中的日志错误
    }
  }, 100);
}

module.exports = {
  logger: log,
  Logger,
  createLogger: Logger.create,
  winston: logger,
  shutdownLogger
};
