/**
 * Swagger API 文档配置
 * 使用 swagger-jsdoc 自动扫描代码注释生成文档
 */

const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const path = require('path');

// Swagger JSDoc 配置
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Alcms 后端API',
    version: '1.0.0',
    description: `
# Alcms 内容管理系统 API

完整的后端API服务，支持用户管理、内容管理、VIP系统等功能。

## 功能特性

### 🔐 认证与权限
- JWT认证系统
- RBAC权限控制  
- 用户状态管理（正常/封禁/冻结）
- 角色管理（普通用户/VIP/版主/管理员）
- 密码安全（bcrypt加密）

### 📝 内容管理系统
- 多媒体资源支持（文章/视频/音频/图片/文档/软件/电子书）
- 分类管理（树形结构）
- 标签系统（多标签支持）
- 下载权限控制（VIP/积分/次数限制）
- 防盗链保护（签名链接）
- 全文搜索
- 资源统计分析

### 💎 VIP会员系统
- VIP等级管理（支持无限期VIP）
- 卡密生成与兑换系统
- 批量卡密管理
- VIP订单记录与统计

### 🎯 积分系统
- 积分获得与消费记录
- 积分转账功能
- 积分排行榜
- 每日签到系统
- 连续签到奖励
- 签到配置管理

## 使用说明

1. **认证**: 大部分API需要在Header中携带 \`Authorization: Bearer {token}\`
2. **权限**: 部分API需要特定角色或权限
3. **分页**: 列表接口支持 \`page\` 和 \`limit\` 参数
4. **响应格式**: 统一返回 \`{success, message, data}\` 格式

## 环境要求

- Node.js >= 16.0.0
- PostgreSQL >= 12.0
- Redis >= 6.0 (可选)
    `,
    contact: {
      name: 'API支持',
      email: 'support@example.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: process.env.NODE_ENV === 'production' 
        ? 'https://api.example.com' 
        : `http://localhost:${process.env.PORT || 3000}`,
      description: process.env.NODE_ENV === 'production' ? '生产环境' : '开发环境'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT访问令牌，请先登录获取token，然后在请求头中添加：Authorization: Bearer {token}\n\n测试账号：\n- 邮箱：5553621@qq.com\n- 密码：5553621\n\n登录后复制返回的accessToken到这里进行API测试'
      }
    },
    responses: {
      UnauthorizedError: {
        description: '未授权 - Token无效或已过期',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: '未授权访问' }
              }
            }
          }
        }
      },
      ForbiddenError: {
        description: '禁止访问 - 权限不足',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: '权限不足' }
              }
            }
          }
        }
      },
      ValidationError: {
        description: '请求参数验证失败',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: '输入验证失败' },
                errors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: { type: 'string' },
                      message: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      ServerError: {
        description: '服务器内部错误',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: '服务器内部错误' }
              }
            }
          }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ]
};

// swagger-jsdoc 选项配置
const swaggerOptions = {
  definition: swaggerDefinition,
  apis: [
    path.join(__dirname, '../controllers/*.js'), // Controller文件
    path.join(__dirname, '../routes/*.js'),      // 路由文件
    path.join(__dirname, '../docs/schemas/*.js') // 数据模型定义
  ]
};

// 生成 Swagger 规范
const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Swagger UI 配置选项
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'none', // 默认折叠
    filter: true, // 启用搜索过滤
    showRequestDuration: true, // 显示请求时间
    tryItOutEnabled: true, // 启用 Try it out
    persistAuthorization: true, // 保持认证状态
    requestInterceptor: (req) => {
      // 自动添加 Bearer token 前缀
      if (req.headers.Authorization && !req.headers.Authorization.startsWith('Bearer ')) {
        req.headers.Authorization = `Bearer ${req.headers.Authorization}`;
      }
      return req;
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { 
      color: #3b82f6; 
      font-size: 36px;
      font-weight: bold;
    }
    .swagger-ui .info .description { 
      font-size: 14px; 
      line-height: 1.6;
    }
    .swagger-ui .info .description h1 {
      color: #1f2937;
      font-size: 24px;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    .swagger-ui .info .description h2 {
      color: #374151;
      font-size: 18px;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    .swagger-ui .info .description h3 {
      color: #4b5563;
      font-size: 16px;
      margin-top: 15px;
      margin-bottom: 8px;
    }
    .swagger-ui .scheme-container { 
      background: #f8fafc; 
      padding: 20px; 
      border-radius: 8px; 
      margin: 20px 0;
      border: 1px solid #e5e7eb;
    }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { 
      background: #10b981; 
    }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { 
      background: #3b82f6; 
    }
    .swagger-ui .opblock.opblock-put .opblock-summary-method { 
      background: #f59e0b; 
    }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { 
      background: #ef4444; 
    }
    .swagger-ui .opblock.opblock-patch .opblock-summary-method { 
      background: #8b5cf6; 
    }
    .swagger-ui .opblock-tag {
      font-size: 18px;
      font-weight: bold;
      color: #1f2937;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .swagger-ui .opblock-summary {
      padding: 10px 15px;
    }
    .swagger-ui .opblock-description-wrapper {
      padding: 15px;
      background: #f9fafb;
    }
  `,
  customSiteTitle: 'Alcms API Documentation',
  customfavIcon: '/favicon.ico'
};

module.exports = {
  swaggerDocument: swaggerSpec,
  swaggerUi,
  swaggerOptions: swaggerUiOptions
};