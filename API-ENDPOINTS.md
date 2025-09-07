# Alcms API 端点完整列表

## ⚠️ 重要提示

**所有社区API都必须包含 `/api/community` 前缀！**

❌ **错误示例**: `GET /posts/1/comments`
✅ **正确示例**: `GET /api/community/posts/1/comments`

---

## 🔐 身份验证 API

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/refresh` | 刷新令牌 |
| POST | `/api/auth/logout` | 用户登出 |
| GET | `/api/auth/profile` | 获取用户信息 |

---

## 👥 用户管理 API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/users` | 获取用户列表 |
| GET | `/api/users/:id` | 获取用户详情 |
| PUT | `/api/users/profile` | 更新个人资料 |
| PUT | `/api/users/:id/status` | 更新用户状态 |
| POST | `/api/users/:id/roles` | 分配角色 |
| DELETE | `/api/users/:id/roles` | 移除角色 |

---

## 📄 CMS 资源管理 API

### 资源管理
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/resources` | 获取资源列表 |
| POST | `/api/resources` | 创建资源 |
| GET | `/api/resources/:id` | 获取资源详情 |
| PUT | `/api/resources/:id` | 更新资源 |
| DELETE | `/api/resources/:id` | 删除资源 |
| POST | `/api/resources/:id/download` | 下载资源 |
| GET | `/api/resources/search/query` | 搜索资源 |

### 分类管理
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/categories` | 获取分类列表 |
| POST | `/api/categories` | 创建分类 |
| GET | `/api/categories/:id` | 获取分类详情 |
| PUT | `/api/categories/:id` | 更新分类 |
| DELETE | `/api/categories/:id` | 删除分类 |

### 标签管理
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/tags` | 获取标签列表 |
| POST | `/api/tags` | 创建标签 |
| GET | `/api/tags/:id` | 获取标签详情 |
| PUT | `/api/tags/:id` | 更新标签 |
| DELETE | `/api/tags/:id` | 删除标签 |

---

## 💬 社区管理 API

### 🏠 板块管理
| 方法 | 端点 | 说明 | 权限要求 |
|------|------|------|----------|
| GET | `/api/community/boards` | 获取板块列表 | 无 |
| GET | `/api/community/boards/:id` | 获取板块详情 | 无 |
| GET | `/api/community/boards/search/query` | 搜索板块 | 无 |
| GET | `/api/community/boards/:id/stats` | 获取板块统计 | 无 |
| POST | `/api/community/boards` | 创建板块 | 管理员 |
| PUT | `/api/community/boards/:id` | 更新板块 | 管理员 |
| DELETE | `/api/community/boards/:id` | 删除板块 | 管理员 |
| PATCH | `/api/community/boards/batch/sort` | 批量排序板块 | 管理员 |
| POST | `/api/community/boards/:id/moderators` | 添加版主 | 管理员 |
| DELETE | `/api/community/boards/:id/moderators` | 移除版主 | 管理员 |

### 📝 帖子管理
| 方法 | 端点 | 说明 | 权限要求 |
|------|------|------|----------|
| GET | `/api/community/posts` | 获取帖子列表 | 无 |
| GET | `/api/community/posts/:id` | 获取帖子详情 | 无 |
| GET | `/api/community/posts/search/query` | 搜索帖子 | 无 |
| GET | `/api/community/posts/hot/list` | 获取热门帖子 | 无 |
| GET | `/api/community/posts/user/:userId` | 获取用户帖子 | 无 |
| GET | `/api/community/posts/user/:userId/stats` | 用户帖子统计 | 无 |
| POST | `/api/community/posts` | 创建帖子 | 登录用户 |
| PUT | `/api/community/posts/:id` | 更新帖子 | 作者/管理员 |
| DELETE | `/api/community/posts/:id` | 删除帖子 | 作者/管理员 |
| PATCH | `/api/community/posts/:id/pin` | 置顶帖子 | 版主/管理员 |
| PATCH | `/api/community/posts/:id/feature` | 设置精华帖 | 版主/管理员 |
| PATCH | `/api/community/posts/:id/lock` | 锁定帖子 | 版主/管理员 |
| PATCH | `/api/community/posts/batch/update` | 批量更新帖子 | 管理员 |

### 💭 评论管理
| 方法 | 端点 | 说明 | 权限要求 |
|------|------|------|----------|
| GET | `/api/community/posts/:postId/comments` | 获取帖子评论 | 无 |
| GET | `/api/community/comments/:id` | 获取评论详情 | 无 |
| GET | `/api/community/posts/:postId/comments/hot` | 获取热门评论 | 无 |
| GET | `/api/community/comments/user/:userId` | 获取用户评论 | 无 |
| GET | `/api/community/comments/user/:userId/stats` | 用户评论统计 | 无 |
| GET | `/api/community/comments/:id/children/count` | 获取子评论数量 | 无 |
| POST | `/api/community/comments` | 创建评论 | 登录用户 |
| PUT | `/api/community/comments/:id` | 更新评论 | 作者 |
| DELETE | `/api/community/comments/:id` | 删除评论 | 作者/管理员 |
| DELETE | `/api/community/comments/batch/delete` | 批量删除评论 | 管理员 |

### 👍 互动功能
| 方法 | 端点 | 说明 | 权限要求 |
|------|------|------|----------|
| POST | `/api/community/interactions/like` | 点赞/取消点赞 | 登录用户 |
| POST | `/api/community/interactions/favorite` | 收藏/取消收藏 | 登录用户 |
| POST | `/api/community/interactions/share` | 分享帖子 | 登录用户 |
| POST | `/api/community/interactions/report` | 举报内容 | 登录用户 |
| GET | `/api/community/interactions/likes/user/:userId` | 获取用户点赞列表 | 无 |
| GET | `/api/community/interactions/favorites/user/:userId` | 获取用户收藏列表 | 无 |
| GET | `/api/community/interactions/stats/user/:userId` | 获取用户互动统计 | 无 |
| GET | `/api/community/interactions/like/check` | 检查点赞状态 | 登录用户 |
| GET | `/api/community/interactions/favorite/check` | 检查收藏状态 | 登录用户 |

### 🛡️ 管理功能
| 方法 | 端点 | 说明 | 权限要求 |
|------|------|------|----------|
| GET | `/api/community/admin/reports` | 获取举报列表 | 管理员 |
| PATCH | `/api/community/admin/reports/:id` | 处理举报 | 管理员 |

---

## 🔧 常见错误解决

### 404 错误：请求的端点不存在

❌ **错误原因**: 缺少正确的URL前缀

**常见错误示例**:
```
GET /posts/1/comments          → 404 错误
GET /interactions/like         → 404 错误  
PATCH /posts/1/pin            → 404 错误
```

✅ **正确示例**:
```
GET /api/community/posts/1/comments           → ✓ 正确
POST /api/community/interactions/like         → ✓ 正确
PATCH /api/community/posts/1/pin             → ✓ 正确
```

### API 测试工具配置

#### Postman 配置
```
Environment Variables:
- baseUrl: http://localhost:3000
- communityBaseUrl: {{baseUrl}}/api/community

Request URL Examples:
- {{communityBaseUrl}}/boards
- {{communityBaseUrl}}/posts
- {{communityBaseUrl}}/interactions/like
```

#### Apifox 配置
```
Base URL: http://localhost:3000/api/community

Request Examples:
- GET /boards
- POST /posts  
- POST /interactions/like
```

#### cURL 配置
```bash
# 设置基础URL变量
export BASE_URL="http://localhost:3000/api/community"

# 使用示例
curl -X GET "$BASE_URL/boards"
curl -X POST "$BASE_URL/posts" -H "Authorization: Bearer $TOKEN"
```

---

## 🚀 快速测试

### 1. 测试API连通性
```bash
curl http://localhost:3000/api
curl http://localhost:3000/api/community/boards
```

### 2. 登录获取Token
```bash
curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@alcms.com","password":"admin123"}'
```

### 3. 测试社区功能
```bash
# 使用获取的Token
export TOKEN="your_access_token_here"

# 测试社区API
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/community/posts"
```

---

## 📖 更多信息

- **完整API文档**: 查看 `postman/` 目录下的 Postman 集合
- **快速测试**: 导入 `Community-Quick-Test.postman_collection.json`
- **详细说明**: 参考 `postman/README-API.md`

**记住：所有社区API都以 `/api/community` 开头！** 🎯
