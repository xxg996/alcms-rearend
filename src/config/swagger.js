/**
 * Swagger API 文档配置
 * 使用 swagger-jsdoc 自动扫描代码注释生成文档
 */

const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const path = require('path');

// Swagger JSDoc 配置
const resolveServerUrl = () => {
  const env = (process.env.NODE_ENV || 'development').trim().toLowerCase();

  if (env === 'production') {
    const configuredUrl = process.env.SWAGGER_SERVER_URL && process.env.SWAGGER_SERVER_URL.trim();
    return configuredUrl || 'https://api.example.com';
  }

  return 'http://localhost:3000';
};

const isSwaggerDocsEnabled = () => {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  const flag = process.env.SWAGGER_DOCS_ENABLED;
  if (typeof flag === 'string') {
    const normalized = flag.trim().toLowerCase();
    return ['true', '1', 'yes', 'on'].includes(normalized);
  }

  return false;
};

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Alcms 后端API',
    version: '1.0.0',
    description: `
# Alcms 内容管理系统 API

## 导出选项

- **JSON格式**: [/api-docs.json](/api-docs.json) - OpenAPI 3.0 JSON规范
- **YAML格式**: [/api-docs.yaml](/api-docs.yaml) - OpenAPI 3.0 YAML规范
- **服务检测**: [/ping](/ping) - 服务状态检查

    `,
  },
  servers: [
    {
      url: resolveServerUrl(),
      description: process.env.NODE_ENV === 'production' ? '生产环境' : '开发环境'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
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
      BearerAuth: []
    }
  ],
  tags: [
    {
      name: '前端调用',
      description: '前台展示所需的无鉴权接口'
    },
    {
      name: '积分商城',
      description: '积分虚拟商品用户接口'
    },
    {
      name: '积分商城管理',
      description: '积分商城管理员接口（商品配置、库存管理）'
    }
  ]
};

// swagger-jsdoc 选项配置
const swaggerOptions = {
  definition: swaggerDefinition,
  apis: [
    path.join(__dirname, '../controllers/*.js'), // Controller文件
    path.join(__dirname, '../controllers/admin/*.js'), // 管理员Controller文件
    path.join(__dirname, '../routes/*.js'),      // 路由文件
    path.join(__dirname, '../routes/admin/*.js'), // 管理员路由文件
    path.join(__dirname, '../routes/user/*.js'), // 用户路由文件
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
    tagsSorter: 'none' // 保持原始定义顺序
    // 移除 requestInterceptor 避免潜在的卡住问题
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
    
    /* 自定义导出按钮样式 */
    .custom-export-toolbar {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      gap: 10px;
      flex-direction: column;
    }
    
    .export-btn {
      background: linear-gradient(45deg, #3b82f6, #1d4ed8);
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      transition: all 0.2s ease;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
    }
    
    .export-btn:hover {
      background: linear-gradient(45deg, #1d4ed8, #1e40af);
      transform: translateY(-1px);
      box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.15);
    }
    
    .export-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
    }
    
    .export-btn::before {
      content: "📥";
      font-size: 16px;
    }
    
    .yaml-btn {
      background: linear-gradient(45deg, #10b981, #059669);
    }
    
    .yaml-btn:hover {
      background: linear-gradient(45deg, #059669, #047857);
    }
    
    .yaml-btn::before {
      content: "📋";
    }
    
    .postman-btn {
      background: linear-gradient(45deg, #f59e0b, #d97706);
    }
    
    .postman-btn:hover {
      background: linear-gradient(45deg, #d97706, #b45309);
    }
    
    .postman-btn::before {
      content: "🚀";
    }
    
    /* 添加导出提示信息 */
    .swagger-ui .info:after {
      content: "🚀 快速导出：JSON格式 → /api-docs.json | YAML格式 → /api-docs.yaml | 服务状态 → /ping";
      display: block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      margin: 25px 0;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
      text-align: center;
      border: 1px solid rgba(255,255,255,0.2);
    }
  `,
  customSiteTitle: 'Alcms API Documentation',
  customfavIcon: '/favicon.ico'
};

module.exports = {
  swaggerDocument: swaggerSpec,
  swaggerUi,
  swaggerOptions: swaggerUiOptions,
  swaggerDocsEnabled: isSwaggerDocsEnabled()
};
