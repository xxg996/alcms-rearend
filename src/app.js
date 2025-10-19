/**
 * Alcms 后端应用主文件
 * 基于Express.js构建的用户权限管理系统
 * Source: context7-mcp on Express.js application structure best practices
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();
const { logger, shutdownLogger } = require('./utils/logger');

// JWT安全验证 - 应用启动时验证
const { validateJWTSecurity } = require('./utils/secureJwt');
validateJWTSecurity();

// 初始化缓存系统
const { cache } = require('./utils/cache');
const { warmupCache } = require('./middleware/cacheMiddleware');

cache.initialize().then(() => {
  // 缓存系统初始化成功后，预热缓存
  warmupCache();
}).catch(err => {
  logger.error('缓存系统初始化失败:', err);
});

// 初始化MinIO存储
const { initializeBuckets } = require('./config/minio');
initializeBuckets().catch(err => {
  logger.error('MinIO初始化失败:', err);
});

// 启动每日重置任务
const { startDailyResetTask, startVipExpirationTask } = require('./tasks/dailyResetTask');
const dailyResetJob = startDailyResetTask();
const vipExpirationJob = startVipExpirationTask();

// 启动Alist token定时刷新任务
const { alistTokenScheduler } = require('./services/alistTokenScheduler');
alistTokenScheduler.start();

// 导入 Swagger 配置
const { swaggerDocument, swaggerUi, swaggerOptions, swaggerDocsEnabled } = require('./config/swagger');

// 导入中间件
const { 
  securityMiddleware,
  apiLimiter,
  corsOptions,
  fallbackCorsOptions,
  corsCache,
  bodySizeLimit,
  sqlInjectionProtection,
  xssProtection
} = require('./middleware/security');
const { 
  validateJsonRequest, 
  notFoundHandler, 
  globalErrorHandler 
} = require('./middleware/errorHandler');

// 导入路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const vipRoutes = require('./routes/vip');
const cardKeyRoutes = require('./routes/cardKey');
const pointsRoutes = require('./routes/points');
const checkinRoutes = require('./routes/checkin');
const referralRoutes = require('./routes/referral');
const frontendRoutes = require('./routes/frontend');
const rolePermissionRoutes = require('./routes/admin/rolePermissions');
const permissionRoutes = require('./routes/admin/permissions');
const cacheRoutes = require('./routes/admin/cache');
const uploadRoutes = require('./routes/upload');

// 创建Express应用实例
const app = express();

// 基础安全中间件
app.use(securityMiddleware);

function resolveRequestOrigin(req, origin) {
  if (origin) {
    return origin;
  }

  const hostHeader = req.get('host');
  if (!hostHeader) {
    return null;
  }

  const forwardedProtoHeader = req.get('x-forwarded-proto');
  const forwardedProto = forwardedProtoHeader
    ? forwardedProtoHeader.split(',')[0].trim().toLowerCase()
    : null;
  const protocolCandidate = forwardedProto || (req.protocol ? req.protocol.toLowerCase() : null);

  if (protocolCandidate !== 'http' && protocolCandidate !== 'https') {
    return null;
  }

  return `${protocolCandidate}://${hostHeader}`;
}

// 动态CORS配置中间件
app.use(async (req, res, next) => {
  try {
    // 创建动态CORS中间件
    const dynamicCors = cors({
      origin: async (origin, callback) => {
        try {
          // 开发环境允许无origin请求（如Postman、移动端应用等）
          if (!origin && process.env.NODE_ENV === 'development') {
            return callback(null, true);
          }

          const resolvedOrigin = resolveRequestOrigin(req, origin);

          if (!resolvedOrigin) {
            logger.warn('CORS请求缺少有效来源', {
              origin,
              host: req.get('host'),
              forwardedProto: req.get('x-forwarded-proto'),
              method: req.method,
              url: req.originalUrl
            });
            return callback(new Error('请求缺少有效来源'));  
          }

          // 检查origin是否在白名单中
          const isAllowed = await corsCache.isOriginAllowed(resolvedOrigin);

          if (isAllowed) {
            callback(null, true);
          } else {
            logger.warn('CORS请求被拒绝', {
              origin: resolvedOrigin,
              rawOrigin: origin,
              method: req.method,
              userAgent: req.get('user-agent')?.substring(0, 100)
            });
            callback(new Error(`域名 ${resolvedOrigin} 不在CORS白名单中`));
          }
        } catch (error) {
          logger.error('CORS验证失败:', error);
          callback(new Error('CORS配置验证失败'));
        }
      },
      credentials: true, // 允许发送cookies和认证头
      optionsSuccessStatus: 200, // 兼容旧版浏览器
      maxAge: 86400 // 预检请求缓存24小时
    });

    dynamicCors(req, res, next);
  } catch (error) {
    logger.error('动态CORS中间件失败，使用fallback配置:', error);
    // 使用fallback配置
    const fallbackCors = cors(fallbackCorsOptions);
    fallbackCors(req, res, next);
  }
});

// 请求日志
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// 请求体解析中间件
app.use(express.json({ limit: bodySizeLimit }));
app.use(express.urlencoded({ extended: true, limit: bodySizeLimit }));

// JSON请求验证中间件
app.use(validateJsonRequest);

// 安全防护中间件
app.use(sqlInjectionProtection);
app.use(xssProtection);

// API访问频率限制
app.use('/api', apiLimiter);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Alcms 后端服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 用户功能API路由注册
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vip', vipRoutes);  // VIP等级和状态管理（订单查询已迁移到card-orders）
app.use('/api/card-keys', cardKeyRoutes);
app.use('/api/card-orders', require('./routes/user/cardOrders'));  // 统一的卡密兑换订单系统
app.use('/api/points', pointsRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/frontend', frontendRoutes);
app.use('/api', require('./routes/download'));

// 管理员功能API路由注册 - 角色权限管理
app.use('/api/admin/roles', rolePermissionRoutes);
app.use('/api/admin/permissions', permissionRoutes);
app.use('/api/admin/cache', cacheRoutes);
app.use('/api/admin/users', require('./routes/admin/users'));
app.use('/api/admin/vip', require('./routes/admin/vip'));
app.use('/api/admin/points', require('./routes/admin/points'));
app.use('/api/admin/card-keys', require('./routes/admin/cardKeys'));
app.use('/api/admin/checkin', require('./routes/admin/checkin'));
app.use('/api/admin/download', require('./routes/admin/download'));
app.use('/api/admin/referral', require('./routes/admin/referral'));
app.use('/api/admin/logs', require('./routes/admin/logs'));
app.use('/api/admin/system-settings', require('./routes/admin/systemSettings'));
app.use('/api/admin/alist', require('./routes/admin/alist'));
app.use('/api/admin', require('./routes/admin/resourceFiles'));

// 资源文件管理路由（支持作者权限，去除/admin前缀）
app.use('/api', require('./routes/resourceFiles'));

// 文件管理路由注册 (删除等操作)
app.use('/api/upload', uploadRoutes);

// 预签名上传路由注册 (主要上传方式)
app.use('/api/upload/presigned', require('./routes/presignedUpload'));

// CMS路由注册
app.use('/api/resources', require('./routes/resources'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api', require('./routes/resourceComments'));
app.use('/api', require('./routes/notifications'));

// CMS管理员路由注册
app.use('/api/admin/resources', require('./routes/admin/resources'));
app.use('/api/admin/categories', require('./routes/admin/categories'));
app.use('/api/admin/tags', require('./routes/admin/tags'));
app.use('/api/admin/favorites', require('./routes/admin/favorites'));

// 社区路由注册
app.use('/api/community', require('./routes/community'));
app.use('/api/admin/community', require('./routes/admin/community'));

// Alist文件管理路由注册
app.use('/api/alist', require('./routes/alist'));

if (swaggerDocsEnabled) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="alcms-api-spec.json"');
    res.json(swaggerDocument);
  });

  app.get('/api-docs.yaml', (req, res) => {
    const yamljs = require('yamljs');
    const yamlString = yamljs.stringify(swaggerDocument, 4);
    res.setHeader('Content-Type', 'text/yaml');
    res.setHeader('Content-Disposition', 'attachment; filename="alcms-api-spec.yaml"');
    res.send(yamlString);
  });
} else {
  const disabledDocsHandler = (req, res) => {
    res.status(404).json({
      success: false,
      message: '生产环境已禁用API文档访问'
    });
  };

  app.use('/api-docs', disabledDocsHandler);
  app.get('/api-docs.json', disabledDocsHandler);
  app.get('/api-docs.yaml', disabledDocsHandler);
}

// Ping 端点
app.get('/ping', (req, res) => {
  res.json({
    success: true,
    message: 'pong',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// 404处理
app.use('*', notFoundHandler);

// 全局错误处理中间件
app.use(globalErrorHandler);


// 启动服务器
const PORT = process.env.PORT || 3000;
const PORT_RETRY_LIMIT = Number(process.env.PORT_RETRY_LIMIT || 5);
const PORT_RETRY_DELAY = Number(process.env.PORT_RETRY_DELAY || 500);

let server;

const startServer = (attempt = 1) => {
  server = app.listen(PORT, () => {
    const docsInfo = swaggerDocsEnabled
      ? `API文档: http://localhost:${PORT}/api-docs`
      : 'API文档: 已禁用（设置 SWAGGER_DOCS_ENABLED=true 可启用）';

    logger.info(`
 Alcms 后端服务已启动！
 服务地址: http://localhost:${PORT}
 Ping检测: http://localhost:${PORT}/ping
 健康检查: http://localhost:${PORT}/health
 ${docsInfo}
    `);
  });

  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      server = null;
      if (attempt >= PORT_RETRY_LIMIT) {
        logger.error('端口仍被占用，已达最大重试次数，服务启动失败', { port: PORT, attempt });
        return process.exit(1);
      }

      logger.warn('端口被占用，等待释放后重试', { port: PORT, attempt });

      setTimeout(() => {
        startServer(attempt + 1);
      }, PORT_RETRY_DELAY);
      return;
    }

    server = null;
    logger.error('服务启动失败', error);
    process.exit(1);
  });
};

if (require.main === module) {
  startServer();

  let isShuttingDown = false;

  const shutdown = (signal, next) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    logger.info(`收到 ${signal} 信号，准备优雅关闭服务`);

    if (dailyResetJob) {
      try {
        dailyResetJob.stop();
      } catch (error) {
        logger.warn('停止每日任务失败:', error);
      }
    }

    const finalize = (exitCode = 0) => {
      shutdownLogger(signal);
      if (typeof next === 'function') {
        next();
      } else {
        process.exit(exitCode);
      }
    };

    setTimeout(() => {
      logger.error('服务关闭超时，强制退出');
      finalize(1);
    }, 5000).unref();

    if (server && server.listening) {
      server.close(err => {
        if (err) {
          logger.error('关闭HTTP服务器时出错:', err);
          return finalize(1);
        }

        logger.info('HTTP服务器已关闭');
        server = null;
        finalize(0);
      });
    } else {
      server = null;
      finalize(0);
    }
  };

  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, () => shutdown(signal));
  });

  process.once('SIGUSR2', () => {
    shutdown('SIGUSR2', () => {
      // 交还控制权给 nodemon，确保可以重新启动新进程
      process.kill(process.pid, 'SIGUSR2');
    });
  });
}

module.exports = app;
