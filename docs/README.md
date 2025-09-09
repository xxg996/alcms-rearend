# Alcms API 文档

Alcms 后端系统现已支持现代化的 OpenAPI/Swagger 文档格式，提供交互式 API 文档界面。

## 📚 文档访问

### Swagger UI 交互式文档
- **访问地址**: http://localhost:3000/api-docs
- **功能特性**:
  - 交互式 API 测试
  - 详细的请求/响应示例
  - JWT 认证支持
  - 实时 API 调用测试
  - 多种代码示例生成（cURL、JavaScript等）

### 传统 JSON API 概览
- **访问地址**: http://localhost:3000/api
- **包含内容**:
  - API 端点列表
  - 功能特性概览
  - 文档链接导航

## 🔧 文档结构

```
docs/
├── swagger.yaml           # OpenAPI 3.0 规范文件
└── README.md             # 文档说明文件

src/config/
└── swagger.js            # Swagger 配置文件
```

## 🎯 API 模块覆盖

### ✅ 已完整文档化
- **认证系统** (`/auth/*`)
  - 用户注册、登录、令牌刷新、登出
  - JWT 双令牌机制说明
- **用户管理** (`/users/*`)
  - 用户资料管理
  - 管理员用户操作（创建、删除、冻结/解冻）
  - 角色权限管理
  - 用户统计信息

### 📝 基础文档化
- **资源管理** (`/resources/*`)
  - 基本 CRUD 操作
  - 搜索功能
- **分类管理** (`/categories/*`)
  - 分类树形结构
- **标签管理** (`/tags/*`)
  - 标签搜索和管理
- **社区功能** (`/community/*`)
  - 板块、帖子、评论管理

## 🔐 认证说明

Swagger UI 支持 JWT Bearer Token 认证：

1. 使用 `/auth/login` 端点登录获取 token
2. 点击 Swagger UI 右上角 "Authorize" 按钮
3. 输入 `Bearer <your-token>` 格式的认证信息
4. 即可测试需要认证的 API 端点

## 🚀 使用建议

1. **开发阶段**: 优先使用 Swagger UI 进行 API 测试和调试
2. **生产环境**: 可以通过环境变量控制是否启用 Swagger UI
3. **API 集成**: 使用 OpenAPI 规范文件生成客户端 SDK

## 📋 待改进

- 扩展 CMS 和社区模块的详细文档
- 添加更多请求/响应示例
- 完善错误码说明
- 添加 API 变更日志

## 🔗 相关链接

- [OpenAPI 3.0 规范](https://spec.openapis.org/oas/v3.0.3)
- [Swagger UI 文档](https://swagger.io/tools/swagger-ui/)
- [Postman 集合](../postman/)