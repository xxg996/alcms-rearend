/**
 * Swagger API 文档配置
 * 集成 swagger-ui-express 和 YAML 文档
 */

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

// 加载 YAML 文档
const swaggerDocument = YAML.load(path.join(__dirname, '../../docs/swagger.yaml'));

// Swagger UI 配置选项
const swaggerOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'none', // 默认折叠
    filter: true, // 启用搜索过滤
    showRequestDuration: true, // 显示请求时间
    tryItOutEnabled: true, // 启用 Try it out
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
    .swagger-ui .info .title { color: #3b82f6; }
    .swagger-ui .scheme-container { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .swagger-ui .info .description p { line-height: 1.6; }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #10b981; }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #3b82f6; }
    .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #f59e0b; }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #ef4444; }
    .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #8b5cf6; }
  `,
  customSiteTitle: 'Alcms API Documentation',
  customfavIcon: '/favicon.ico'
};

module.exports = {
  swaggerDocument,
  swaggerUi,
  swaggerOptions
};