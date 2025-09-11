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

// API路由注册
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vip', vipRoutes);
app.use('/api/card-keys', cardKeyRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/checkin', checkinRoutes);

// CMS路由注册
app.use('/api/resources', require('./routes/resources'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/favorites', require('./routes/favorites'));

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
      },
      vip: {
        levels: {
          'GET /api/vip/levels': '获取VIP等级配置',
          'GET /api/vip/levels/:level': '获取指定VIP等级',
          'POST /api/vip/levels': '创建VIP等级（管理员）',
          'PUT /api/vip/levels/:level': '更新VIP等级（管理员）',
          'DELETE /api/vip/levels/:level': '删除VIP等级（管理员）'
        },
        user: {
          'GET /api/vip/my-info': '获取我的VIP信息',
          'GET /api/vip/my-orders': '获取我的订单历史',
          'GET /api/vip/orders/:orderId': '获取订单详情',
          'GET /api/vip/users/:userId/info': '获取用户VIP信息（管理员）',
          'POST /api/vip/users/:userId/set': '设置用户VIP（管理员）',
          'POST /api/vip/users/:userId/extend': '延长用户VIP（管理员）',
          'DELETE /api/vip/users/:userId/cancel': '取消用户VIP（管理员）'
        },
        system: {
          'POST /api/vip/system/update-expired': '更新过期VIP用户（系统）'
        }
      },
      cardKeys: {
        user: {
          'POST /api/card-keys/redeem': '兑换卡密',
          'GET /api/card-keys/info/:code': '查询卡密信息'
        },
        admin: {
          'POST /api/card-keys/generate/single': '生成单个卡密（管理员）',
          'POST /api/card-keys/generate/batch': '批量生成卡密（管理员）',
          'GET /api/card-keys/list': '获取卡密列表（管理员）',
          'GET /api/card-keys/statistics': '获取卡密统计（管理员）',
          'GET /api/card-keys/batches': '获取批次列表（管理员）',
          'GET /api/card-keys/batches/:batchId': '获取批次详情（管理员）',
          'PUT /api/card-keys/:cardId/status': '更新卡密状态（管理员）',
          'DELETE /api/card-keys/:cardId': '删除卡密（超级管理员）',
          'DELETE /api/card-keys/batches/:batchId': '删除批次（超级管理员）'
        }
      },
      points: {
        user: {
          'GET /api/points/my-info': '获取我的积分信息',
          'GET /api/points/my-records': '获取我的积分记录',
          'GET /api/points/my-rank': '获取我的积分排名',
          'POST /api/points/transfer': '积分转账'
        },
        public: {
          'GET /api/points/leaderboard': '获取积分排行榜'
        },
        admin: {
          'GET /api/points/users/:userId/info': '获取用户积分信息（管理员）',
          'GET /api/points/users/:userId/records': '获取用户积分记录（管理员）',
          'POST /api/points/users/:userId/adjust': '调整用户积分（管理员）',
          'POST /api/points/batch/grant': '批量发放积分（管理员）',
          'GET /api/points/statistics': '获取积分统计（管理员）'
        }
      },
      checkin: {
        user: {
          'POST /api/checkin/check': '执行签到',
          'GET /api/checkin/my-status': '获取我的签到状态',
          'GET /api/checkin/my-history': '获取我的签到历史'
        },
        public: {
          'GET /api/checkin/leaderboard': '获取签到排行榜'
        },
        admin: {
          'GET /api/checkin/configs': '获取签到配置（管理员）',
          'POST /api/checkin/configs': '创建签到配置（管理员）',
          'PUT /api/checkin/configs/:configId': '更新签到配置（管理员）',
          'GET /api/checkin/users/:userId/info': '获取用户签到信息（管理员）',
          'GET /api/checkin/users/:userId/history': '获取用户签到历史（管理员）',
          'POST /api/checkin/users/:userId/makeup': '补签功能（管理员）',
          'DELETE /api/checkin/users/:userId/reset': '重置用户签到数据（超级管理员）',
          'GET /api/checkin/statistics': '获取签到统计（管理员）'
        }
      },
      favorites: {
        user: {
          'POST /api/favorites/resources/:resourceId/toggle': '切换资源收藏状态',
          'GET /api/favorites/resources/:resourceId/status': '检查资源收藏状态',
          'POST /api/favorites/resources/batch-check': '批量检查收藏状态',
          'GET /api/favorites/my-favorites': '获取我的收藏列表',
          'GET /api/favorites/my-stats': '获取我的收藏统计',
          'DELETE /api/favorites/batch-remove': '批量取消收藏'
        },
        public: {
          'GET /api/favorites/resources/:resourceId/stats': '获取资源收藏统计'
        },
        admin: {
          'GET /api/favorites/admin/popular': '获取热门收藏资源（管理员）'
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
      '资源统计分析',
      'VIP会员系统',
      'VIP等级管理（支持无限期VIP）',
      '卡密生成与兑换系统',
      '批量卡密管理',
      'VIP订单记录与统计',
      '用户积分系统',
      '积分获得与消费记录',
      '积分转账功能',
      '积分排行榜',
      '每日签到系统',
      '连续签到奖励',
      '签到配置管理',
      '签到统计与排行'
    ]
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
    console.log(`
🚀 Alcms 后端服务已启动！
📍 服务地址: http://localhost:${PORT}
📚 API端点: http://localhost:${PORT}/api
🔍 健康检查: http://localhost:${PORT}/health
    `);
  });
}

module.exports = app;
