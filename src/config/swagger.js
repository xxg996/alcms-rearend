/**
 * Swagger 配置文件
 * 配置 OpenAPI 文档和 Swagger UI
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

// 从 YAML 文件加载 OpenAPI 规范
const swaggerDocument = YAML.load(path.join(__dirname, '../../docs/swagger.yaml'));

// Swagger UI 配置选项
const swaggerOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showRequestHeaders: true,
    tryItOutEnabled: true,
    requestSnippets: {
      generators: {
        curl_bash: {
          title: 'cURL (bash)',
          syntax: 'bash'
        },
        curl_powershell: {
          title: 'cURL (PowerShell)',
          syntax: 'powershell'
        },
        curl_cmd: {
          title: 'cURL (CMD)',
          syntax: 'bash'
        }
      },
      defaultExpanded: false,
      languages: ['curl_bash', 'curl_powershell', 'curl_cmd']
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #3b4151; font-size: 36px; }
    .swagger-ui .info .description { font-size: 14px; line-height: 1.6; }
    .swagger-ui .scheme-container { background: #f7f7f7; padding: 15px; border-radius: 4px; margin: 20px 0; }
    .swagger-ui .auth-wrapper { margin-top: 20px; }
    .swagger-ui .btn.authorize { background-color: #49cc90; border-color: #49cc90; }
    .swagger-ui .btn.authorize:hover { background-color: #41b883; border-color: #41b883; }
    .swagger-ui .model-box-control:focus, .swagger-ui .models-control:focus, .swagger-ui .opblock-summary-control:focus { outline: none; }
    .swagger-ui .opblock.opblock-post { border-color: #49cc90; background: rgba(73, 204, 144, 0.1); }
    .swagger-ui .opblock.opblock-post .opblock-summary { border-color: #49cc90; }
    .swagger-ui .opblock.opblock-get { border-color: #61affe; background: rgba(97, 175, 254, 0.1); }
    .swagger-ui .opblock.opblock-get .opblock-summary { border-color: #61affe; }
    .swagger-ui .opblock.opblock-delete { border-color: #f93e3e; background: rgba(249, 62, 62, 0.1); }
    .swagger-ui .opblock.opblock-delete .opblock-summary { border-color: #f93e3e; }
    .swagger-ui .opblock.opblock-put { border-color: #fca130; background: rgba(252, 161, 48, 0.1); }
    .swagger-ui .opblock.opblock-put .opblock-summary { border-color: #fca130; }
    .swagger-ui .opblock.opblock-patch { border-color: #50e3c2; background: rgba(80, 227, 194, 0.1); }
    .swagger-ui .opblock.opblock-patch .opblock-summary { border-color: #50e3c2; }
  `,
  customSiteTitle: 'Alcms API Documentation',
  customfavIcon: '/favicon.ico'
};

// 中文化配置
swaggerDocument.info.title = 'Alcms 后端 API 文档';
swaggerDocument.info.description = swaggerDocument.info.description || 'Alcms CMS 资源管理系统后端 API 文档';

// 动态更新服务器地址（基于环境变量）
const serverUrl = process.env.API_BASE_URL || 'http://localhost:3000/api';
swaggerDocument.servers = [
  {
    url: serverUrl,
    description: process.env.NODE_ENV === 'production' ? '生产环境' : '开发环境'
  }
];

module.exports = {
  swaggerDocument,
  swaggerUi,
  swaggerOptions
};