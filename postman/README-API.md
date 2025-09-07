# Alcms API 文档使用指南

## 📚 Postman 集合说明

### 🔗 API 集合列表

| 集合名称 | 文件名 | 功能说明 |
|---------|-------|----------|
| **用户管理 API** | `Alcms-Backend-API.postman_collection.json` | 用户注册、登录、权限管理 |
| **CMS 管理 API** | `Alcms-CMS-API.postman_collection.json` | 资源管理、分类标签系统 |
| **社区管理 API** | `Alcms-Community-API.postman_collection.json` | 板块、帖子、评论、互动功能 |
| **快速测试集合** | `Community-Quick-Test.postman_collection.json` | 社区功能快速验证测试 |
| **环境配置** | `Alcms-Environment.postman_environment.json` | API 地址和Token管理 |

---

## 🚀 快速开始

### 1. 导入 Postman 集合

1. 打开 Postman 应用
2. 点击 **Import** 按钮
3. 选择 **File** 选项卡
4. 依次导入以下文件：
   - `Alcms-Environment.postman_environment.json` (环境配置)
   - `Alcms-Backend-API.postman_collection.json` (用户管理)
   - `Alcms-CMS-API.postman_collection.json` (CMS功能)
   - `Alcms-Community-API.postman_collection.json` (社区功能)
   - `Community-Quick-Test.postman_collection.json` (快速测试)

### 2. 配置环境变量

1. 在 Postman 右上角选择 **Alcms Environment**
2. 点击环境名称旁边的 **👁️** 图标
3. 确认以下变量设置：
   ```
   baseUrl: http://localhost:3000
   accessToken: (登录后自动填充)
   communityBaseUrl: {{baseUrl}}/api/community
   ```

### 3. 启动服务器

```bash
# 确保数据库迁移已完成
npm run migrate
npm run migrate-cms
npm run migrate-community

# 启动开发服务器
npm run dev
```

---

## 🔐 身份验证流程

### 获取访问令牌

1. **展开** `Alcms Backend API` → `🔐 身份验证`
2. **运行** `用户登录` 请求
3. **默认管理员账户**：
   ```json
   {
     "email": "admin@alcms.com",
     "password": "admin123"
   }
   ```
4. **Token 自动保存**：登录成功后，`accessToken` 会自动保存到环境变量

### 使用 Token

大部分需要权限的请求会自动使用 `{{accessToken}}`，无需手动设置。

---

## 💬 社区 API 功能测试

### 🎯 快速验证 (推荐)

使用 `Community Quick Test` 集合：

1. **选择集合**：`Community Quick Test`
2. **点击 Runner**：右键集合 → `Run collection`
3. **运行流程**：自动执行完整的社区功能测试
4. **查看结果**：所有测试应该都通过 ✅

### 📋 手动测试流程

#### 第一步：板块管理
```
1. 获取板块列表     → 查看所有社区板块
2. 获取板块详情     → 查看特定板块信息  
3. 搜索板块        → 测试板块搜索功能
4. 创建板块        → 测试板块创建 (需管理员权限)
```

#### 第二步：帖子管理
```
1. 获取帖子列表     → 查看社区帖子
2. 创建帖子        → 发布新帖子
3. 获取帖子详情     → 查看帖子内容
4. 搜索帖子        → 测试全文搜索
5. 置顶/精华帖     → 测试帖子管理功能
```

#### 第三步：评论系统
```
1. 创建评论        → 发表主评论
2. 回复评论        → 楼中楼回复
3. 获取评论列表     → 查看帖子评论
4. 更新评论        → 修改评论内容
```

#### 第四步：互动功能
```
1. 点赞帖子/评论    → 测试点赞功能
2. 收藏帖子        → 测试收藏功能
3. 分享帖子        → 测试分享功能
4. 举报内容        → 测试举报功能
5. 检查互动状态     → 查看用户互动状态
```

---

## 🛡️ 权限说明

### 角色权限对应

| 角色 | 权限范围 |
|------|----------|
| **普通用户** | 发帖、评论、点赞、收藏、分享、举报 |
| **VIP用户** | 普通用户权限 + 优先显示 |
| **版主** | VIP权限 + 帖子管理、评论管理、用户处罚 |
| **管理员** | 所有权限 + 板块管理、系统配置 |

### 权限验证测试

```bash
# 测试无权限访问 (应返回401)
GET /api/community/boards (不带Token)

# 测试权限不足 (应返回403)  
POST /api/community/boards (普通用户Token)

# 测试正确权限 (应返回200)
POST /api/community/boards (管理员Token)
```

---

## 📊 API 响应格式

### 成功响应
```json
{
  "success": true,
  "message": "操作成功",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    // 返回数据
  }
}
```

### 错误响应
```json
{
  "success": false,
  "message": "错误描述",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 分页响应
```json
{
  "success": true,
  "data": {
    "data": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

## 🔧 调试技巧

### 1. 查看请求详情
- **Console 日志**：每个请求都会输出响应时间和状态
- **Response 检查**：确认返回数据格式和内容
- **Headers 验证**：检查 Token 是否正确传递

### 2. 常见问题排查

#### 401 Unauthorized
```
原因：Token 缺失或无效
解决：重新登录获取新 Token
```

#### 403 Forbidden  
```
原因：权限不足
解决：使用具有相应权限的账户
```

#### 404 Not Found
```
原因：资源不存在或 URL 错误
解决：检查资源ID和URL路径
```

#### 500 Internal Server Error
```
原因：服务器内部错误
解决：检查服务器日志和数据库连接
```

### 3. 性能监控

集合中包含自动化的性能检查：
- ✅ 响应时间 < 5秒
- ✅ 状态码验证
- ✅ 响应格式检查

---

## 📈 测试覆盖率

### 社区 API 测试覆盖

| 功能模块 | 测试用例数 | 覆盖率 |
|---------|-----------|-------|
| **板块管理** | 9个请求 | 100% |
| **帖子管理** | 11个请求 | 100% |
| **评论系统** | 8个请求 | 100% |
| **互动功能** | 9个请求 | 100% |
| **管理功能** | 4个请求 | 100% |
| **统计数据** | 4个请求 | 100% |

### 自动化测试

`Community Quick Test` 集合提供：
- ✅ 端到端用户流程测试
- ✅ 数据依赖关系验证
- ✅ 自动清理测试数据
- ✅ 完整的功能覆盖

---

## 🚀 生产环境配置

### 环境变量调整

生产环境使用时，修改环境变量：

```json
{
  "baseUrl": "https://your-production-domain.com",
  "communityBaseUrl": "https://your-production-domain.com/api/community"
}
```

### SSL 证书配置

在 Postman 设置中：
1. `Settings` → `Certificates`
2. 添加客户端证书（如需要）
3. 启用 SSL 证书验证

---

## 📞 技术支持

### API 状态检查
```bash
# 健康检查
GET {{baseUrl}}/health

# API 文档根路径  
GET {{baseUrl}}/api
```

### 数据重置

如需重置测试数据：
```bash
# 重新运行迁移
npm run migrate-community

# 重新创建管理员
npm run create-admin
```

---

**完整的 Alcms 社区 API 已准备就绪！🎉**

通过 Postman 集合，你可以：
- 🔍 **全面测试** 所有社区功能
- 🚀 **快速验证** API 接口正确性  
- 📊 **监控性能** 和响应时间
- 🛡️ **验证权限** 控制机制
- 💻 **集成开发** 和调试流程
