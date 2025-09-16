/**
 * Alcms 后端应用主文件
 * 基于Express.js构建的用户权限管理系统
 * Source: context7-mcp on Express.js application structure best practices
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();
const { logger } = require('./utils/logger');

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

// 导入 Swagger 配置
const { swaggerDocument, swaggerUi, swaggerOptions } = require('./config/swagger');

// 导入中间件
const { 
  securityMiddleware, 
  apiLimiter, 
  corsOptions, 
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
const rolePermissionRoutes = require('./routes/admin/rolePermissions');
const uploadRoutes = require('./routes/upload');

// 创建Express应用实例
const app = express();

// 基础安全中间件
app.use(securityMiddleware);

// CORS配置
app.use(cors(corsOptions));

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
app.use('/api/vip', vipRoutes);
app.use('/api/card-keys', cardKeyRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/checkin', checkinRoutes);

// 管理员功能API路由注册
app.use('/api/admin/roles', rolePermissionRoutes);
app.use('/api/admin/users', require('./routes/admin/users'));
app.use('/api/admin/vip', require('./routes/admin/vip'));
app.use('/api/admin/points', require('./routes/admin/points'));
app.use('/api/admin/card-keys', require('./routes/admin/cardKeys'));
app.use('/api/admin/checkin', require('./routes/admin/checkin'));

// 文件管理路由注册 (删除等操作)
app.use('/api/upload', uploadRoutes);

// 预签名上传路由注册 (主要上传方式)
app.use('/api/upload/presigned', require('./routes/presignedUpload'));

// CMS路由注册
app.use('/api/resources', require('./routes/resources'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/favorites', require('./routes/favorites'));

// CMS管理员路由注册
app.use('/api/admin/resources', require('./routes/admin/resources'));
app.use('/api/admin/categories', require('./routes/admin/categories'));
app.use('/api/admin/tags', require('./routes/admin/tags'));
app.use('/api/admin/favorites', require('./routes/admin/favorites'));

// 社区路由注册
app.use('/api/community', require('./routes/community'));
app.use('/api/admin/community', require('./routes/admin/community'));

// Swagger API 文档
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

// Swagger JSON 导出
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="alcms-api-spec.json"');
  res.json(swaggerDocument);
});

// Swagger YAML 导出
app.get('/api-docs.yaml', (req, res) => {
  const yamljs = require('yamljs');
  const yamlString = yamljs.stringify(swaggerDocument, 4);
  res.setHeader('Content-Type', 'text/yaml');
  res.setHeader('Content-Disposition', 'attachment; filename="alcms-api-spec.yaml"');
  res.send(yamlString);
});

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

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`
 Alcms 后端服务已启动！
 服务地址: http://localhost:${PORT}
 Ping检测: http://localhost:${PORT}/ping
 健康检查: http://localhost:${PORT}/health
 API文档: http://localhost:${PORT}/api-docs
    `);
  });
}

module.exports = app;
