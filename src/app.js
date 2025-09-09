/**
 * Alcms 后端应用主文件
 * 基于Express.js构建的用户权限管理系统
 * Source: context7-mcp on Express.js application structure best practices
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

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

// 导入路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');

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

// API路由注册
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// CMS路由注册
app.use('/api/resources', require('./routes/resources'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/tags', require('./routes/tags'));

// 社区路由注册
app.use('/api/community', require('./routes/community'));

// Swagger API 文档
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

// API文档根路径
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Alcms 后端 API',
    version: '1.0.0',
    description: '基于Node.js、Express.js、PostgreSQL构建的用户权限管理系统',
    documentation: {
      swagger: '/api-docs',
      postman: {
        user_management: '/postman/Alcms-Backend-API.postman_collection.json',
        cms_management: '/postman/Alcms-CMS-API.postman_collection.json',
        environment: '/postman/Alcms-Environment.postman_environment.json'
      }
    },
    endpoints: {
      authentication: {
        'POST /api/auth/register': '用户注册',
        'POST /api/auth/login': '用户登录',
        'POST /api/auth/refresh': '刷新访问令牌',
        'POST /api/auth/logout': '用户登出',
        'GET /api/auth/profile': '获取当前用户信息'
      },
      users: {
        'PUT /api/users/profile': '更新用户资料',
        'POST /api/users': '创建用户（管理员）',
        'GET /api/users': '获取用户列表（管理员）',
        'GET /api/users/stats': '获取用户统计（管理员）',
        'GET /api/users/:userId': '获取指定用户信息',
        'DELETE /api/users/:userId': '删除用户（管理员）',
        'PUT /api/users/:userId/status': '更新用户状态（管理员）',
        'PATCH /api/users/:userId/freeze': '冻结/解冻用户（管理员）',
        'POST /api/users/:userId/roles': '分配用户角色（管理员）',
        'DELETE /api/users/:userId/roles': '移除用户角色（管理员）'
      },
      cms: {
        resources: {
          'GET /api/resources': '获取资源列表',
          'GET /api/resources/:id': '获取资源详情',
          'POST /api/resources': '创建资源',
          'PUT /api/resources/:id': '更新资源',
          'DELETE /api/resources/:id': '删除资源',
          'POST /api/resources/:id/download': '下载资源',
          'GET /api/resources/search/query': '搜索资源',
          'GET /api/resources/stats/overview': '资源统计'
        },
        categories: {
          'GET /api/categories': '获取分类列表',
          'GET /api/categories/:id': '获取分类详情',
          'POST /api/categories': '创建分类',
          'PUT /api/categories/:id': '更新分类',
          'DELETE /api/categories/:id': '删除分类',
          'GET /api/categories/popular/list': '热门分类'
        },
        tags: {
          'GET /api/tags': '获取标签列表',
          'GET /api/tags/:id': '获取标签详情',
          'POST /api/tags': '创建标签',
          'PUT /api/tags/:id': '更新标签',
          'DELETE /api/tags/:id': '删除标签',
          'GET /api/tags/search/query': '搜索标签',
          'GET /api/tags/popular/list': '热门标签'
        }
      },
      community: {
        boards: {
          'GET /api/community/boards': '获取板块列表',
          'POST /api/community/boards': '创建板块',
          'GET /api/community/boards/:id': '获取板块详情',
          'PUT /api/community/boards/:id': '更新板块',
          'DELETE /api/community/boards/:id': '删除板块'
        },
        posts: {
          'GET /api/community/posts': '获取帖子列表',
          'POST /api/community/posts': '创建帖子',
          'GET /api/community/posts/:id': '获取帖子详情',
          'PUT /api/community/posts/:id': '更新帖子',
          'DELETE /api/community/posts/:id': '删除帖子',
          'PATCH /api/community/posts/:id/pin': '置顶帖子',
          'PATCH /api/community/posts/:id/feature': '设置精华帖',
          'PATCH /api/community/posts/:id/lock': '锁定帖子'
        },
        comments: {
          'GET /api/community/posts/:postId/comments': '获取帖子评论',
          'POST /api/community/comments': '创建评论',
          'GET /api/community/comments/:id': '获取评论详情',
          'PUT /api/community/comments/:id': '更新评论',
          'DELETE /api/community/comments/:id': '删除评论'
        },
        interactions: {
          'POST /api/community/interactions/like': '点赞/取消点赞',
          'POST /api/community/interactions/favorite': '收藏/取消收藏',
          'POST /api/community/interactions/share': '分享帖子',
          'POST /api/community/interactions/report': '举报内容',
          'GET /api/community/interactions/like/check': '检查点赞状态',
          'GET /api/community/interactions/favorite/check': '检查收藏状态'
        }
      }
    },
    features: [
      'JWT认证系统',
      'RBAC权限控制',
      '用户状态管理（正常/封禁/冻结）',
      '角色管理（普通用户/VIP/版主/管理员）',
      '密码安全（bcrypt加密）',
      '请求频率限制',
      '输入验证与防护',
      'SQL注入防护',
      'XSS防护',
      'CMS资源管理系统',
      '多媒体资源支持（文章/视频/音频/图片/文档/软件/电子书）',
      '分类管理（树形结构）',
      '标签系统（多标签支持）',
      '下载权限控制（VIP/积分/次数限制）',
      '防盗链保护（签名链接）',
      '全文搜索',
      '资源统计分析'
    ]
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的端点不存在',
    path: req.originalUrl,
    method: req.method
  });
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('全局错误:', err);

  // 如果响应已经发送，则交给默认错误处理器
  if (res.headersSent) {
    return next(err);
  }

  // JWT错误处理
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: '无效的访问令牌'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: '访问令牌已过期'
    });
  }

  // 数据库错误处理
  if (err.code === '23505') { // PostgreSQL唯一约束违反
    return res.status(409).json({
      success: false,
      message: '数据已存在'
    });
  }

  // 验证错误处理
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: err.errors
    });
  }

  // 默认错误响应
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? '服务器内部错误' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
🚀 Alcms 后端服务已启动！
📍 服务地址: http://localhost:${PORT}
📚 API端点: http://localhost:${PORT}/api
🔍 健康检查: http://localhost:${PORT}/health
    `);
  });
}

module.exports = app;
