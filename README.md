# Alcms CMS 资源管理系统

一个基于 Node.js + Express.js + PostgreSQL 构建的现代化内容管理系统，集成了完整的用户权限管理和多媒体资源管理功能。

## ✨ 核心特性

### 🔐 安全认证
- **JWT 双令牌机制**：访问令牌 + 刷新令牌
- **密码安全**：bcrypt 加盐哈希，可配置强度
- **请求频率限制**：防止暴力攻击和恶意请求
- **输入验证**：SQL 注入防护、XSS 防护
- **安全头设置**：Helmet 中间件提供多重安全防护

### 👥 用户管理
- **用户注册**：邮箱 + 用户名验证
- **用户登录**：邮箱密码认证
- **资料管理**：头像、昵称、简介修改
- **状态控制**：正常 / 封禁 / 冻结状态管理

### 🛡️ 权限控制
- **RBAC 模型**：基于角色的访问控制
- **四级角色体系**：
  - 普通用户：基础功能权限
  - VIP 用户：高级功能权限
  - 版主：内容管理权限
  - 管理员：系统管理权限
- **细粒度权限**：资源 + 动作的权限控制
- **动态权限检查**：中间件级别的权限验证

### 📄 CMS 资源管理
- **多媒体支持**：文章、视频、音频、图片、文档、软件、电子书
- **分类管理**：无限层级的树形分类结构
- **标签系统**：多标签支持，智能标签搜索和统计
- **权限控制**：VIP权限、积分消耗、下载次数限制
- **防盗链保护**：签名链接、IP验证、时效控制
- **全文搜索**：PostgreSQL GIN索引支持的高效搜索
- **统计分析**：资源访问、下载统计，热门内容分析

### 🔍 搜索功能
- **全文搜索**：标题、描述、内容智能搜索
- **高级筛选**：分类、标签、状态、价格组合筛选
- **相关度排序**：按相关度、时间、热度等多维度排序
- **搜索建议**：标签联想和热门搜索推荐

### 💬 微社区系统
- **板块管理**：无限层级板块结构，版主管理机制
- **帖子发布**：支持Markdown/HTML格式，置顶精华功能
- **楼中楼评论**：无限嵌套评论结构，@用户功能
- **互动功能**：点赞、收藏、分享、举报系统
- **社区治理**：内容审核、违规处罚、权限控制
- **全文搜索**：PostgreSQL GIN索引高性能搜索
- **实时统计**：帖子、评论、互动数据自动统计

## 🏗️ 技术架构

### 后端技术栈
- **运行环境**：Node.js (>=16.0.0)
- **Web 框架**：Express.js 4.x
- **数据库**：PostgreSQL
- **认证**：JSON Web Token (JWT)
- **密码加密**：bcrypt
- **输入验证**：express-validator
- **安全防护**：helmet, cors, express-rate-limit

### 项目结构
```
alcms-rearend/
├── src/                    # 源代码目录
│   ├── app.js             # 应用入口文件
│   ├── config/            # 配置文件
│   │   └── database.js    # 数据库配置
│   ├── controllers/       # 控制器层
│   │   ├── authController.js      # 用户认证
│   │   ├── userController.js      # 用户管理
│   │   ├── resourceController.js  # 📄 资源管理
│   │   ├── categoryController.js  # 📂 分类管理
│   │   ├── tagController.js       # 🏷️ 标签管理
│   │   ├── communityBoardController.js    # 💬 板块管理
│   │   ├── communityPostController.js     # 📝 帖子管理
│   │   ├── communityCommentController.js  # 💭 评论管理
│   │   └── communityInteractionController.js # 👍 互动功能
│   ├── middleware/        # 中间件
│   │   ├── auth.js        # 认证中间件
│   │   └── security.js    # 安全中间件
│   ├── models/            # 数据模型
│   │   ├── User.js        # 用户模型
│   │   ├── Resource.js    # 📄 资源模型
│   │   ├── Category.js    # 📂 分类模型
│   │   ├── Tag.js         # 🏷️ 标签模型
│   │   ├── CommunityBoard.js      # 💬 板块模型
│   │   ├── CommunityPost.js       # 📝 帖子模型
│   │   ├── CommunityComment.js    # 💭 评论模型
│   │   └── CommunityInteraction.js # 👍 互动模型
│   ├── routes/            # 路由定义
│   │   ├── auth.js        # 认证路由
│   │   ├── users.js       # 用户路由
│   │   ├── resources.js   # 📄 资源路由
│   │   ├── categories.js  # 📂 分类路由
│   │   ├── tags.js        # 🏷️ 标签路由
│   │   └── community.js   # 💬 社区路由
│   └── utils/             # 工具函数
│       ├── jwt.js         # JWT 工具
│       ├── password.js    # 密码工具
│       └── downloadUtils.js # 🔐 下载工具
├── database/              # 数据库相关
│   ├── migrations/        # 数据库迁移文件
│   │   ├── 001_create_tables.sql      # 用户权限表
│   │   ├── 002_insert_default_data.sql # 默认用户数据
│   │   ├── 003_create_cms_tables.sql   # 📄 CMS 表结构
│   │   ├── 004_insert_cms_default_data.sql # 📄 CMS 默认数据
│   │   ├── 005_create_community_tables.sql # 💬 社区表结构
│   │   └── 006_insert_community_default_data.sql # 💬 社区默认数据
│   ├── migrate.js         # 用户系统迁移
│   ├── migrate-cms.js     # 📄 CMS 系统迁移
│   └── migrate-community.js # 💬 社区系统迁移
├── scripts/               # 管理脚本
│   └── create-admin.js    # 创建管理员账户
├── postman/               # 📡 API 文档
│   ├── Alcms-Backend-API.postman_collection.json  # 用户管理 API
│   ├── Alcms-CMS-API.postman_collection.json      # 📄 CMS 管理 API
│   └── Alcms-Environment.postman_environment.json # 环境配置
├── package.json           # 项目依赖
├── .env.example          # 环境变量模板
├── test-api.js           # API 自动化测试
└── README.md             # 项目说明文档
```

## 🚀 快速开始

### 1. 环境要求
- Node.js >= 16.0.0
- PostgreSQL >= 12.0
- npm 或 yarn

### 2. 安装依赖
```bash
npm install
```

### 3. 环境配置
复制环境变量模板并填写配置：
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置以下参数：

#### 数据库配置
```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=alcms
PGUSER=your_username
PGPASSWORD=your_password
```

#### JWT 配置
```env
JWT_SECRET=your_super_secure_jwt_secret_key_here
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_key_here
JWT_REFRESH_EXPIRES_IN=7d
```

#### 服务器配置
```env
PORT=3000
NODE_ENV=development
```

#### 安全配置
```env
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. 数据库设置
确保 PostgreSQL 服务运行，并创建数据库：
```sql
CREATE DATABASE alcms;
```

执行数据库迁移：
```bash
# 1. 执行用户权限系统迁移
npm run migrate

# 2. 执行 CMS 系统迁移
npm run migrate-cms

# 3. 执行社区系统迁移
npm run migrate-community

# 4. 创建初始管理员账户
npm run create-admin
```

**迁移说明**：
- `001_create_tables.sql` - 用户、角色、权限表
- `002_insert_default_data.sql` - 默认角色和权限数据
- `003_create_cms_tables.sql` - CMS 核心表（资源、分类、标签等）
- `004_insert_cms_default_data.sql` - CMS 默认数据（资源类型、分类等）
- `005_create_community_tables.sql` - 社区核心表（板块、帖子、评论、互动等）
- `006_insert_community_default_data.sql` - 社区默认数据（板块、权限分配等）

### 5. 启动服务
```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

服务启动后，访问：
- API 服务：http://localhost:3000
- API 文档：http://localhost:3000/api
- 健康检查：http://localhost:3000/health

## 📚 CMS 功能详解

### 📄 资源管理系统

#### 资源类型支持
- **📝 文章类型** - 富文本内容，支持 Markdown
- **🎥 视频类型** - 在线播放、下载链接
- **🎵 音频类型** - 音乐、播客、有声书
- **🖼️ 图片类型** - 图片、插画、设计素材
- **📄 文档类型** - PDF、Word、PPT 等文档
- **💿 软件类型** - 应用程序、工具软件
- **📚 电子书** - EPUB、PDF 格式电子书

#### 核心功能
```javascript
// 创建资源示例
POST /api/resources
{
  "title": "Vue3 开发指南",
  "description": "详细的Vue3开发教程",
  "categoryId": 1,
  "resourceTypeId": 1,
  "tags": ["vue3", "frontend", "tutorial"],
  "isFree": false,
  "requiredVipLevel": "vip",
  "requiredPoints": 100
}
```

### 📂 分类管理系统

#### 树形分类结构
- **无限层级** - 支持任意深度的分类嵌套
- **面包屑导航** - 自动生成分类路径
- **排序管理** - 自定义分类显示顺序
- **统计计数** - 自动统计每个分类的资源数量

### 🏷️ 标签系统

#### 智能标签功能
- **多标签关联** - 每个资源可以关联多个标签
- **智能搜索** - 支持标签名称模糊匹配
- **使用统计** - 自动计算标签使用频次
- **热门推荐** - 按使用频率推荐热门标签

#### 标签管理
```javascript
// 创建标签
POST /api/tags
{
  "name": "vue3",
  "displayName": "Vue.js 3",
  "description": "Vue.js 第三版相关内容",
  "color": "#4FC08D"
}

// 搜索标签
GET /api/tags/search/query?q=vue&limit=10
```

### 🔐 下载权限控制

#### 多层权限验证
- **用户角色** - 基于用户角色的访问控制
- **VIP 等级** - 不同 VIP 等级享受不同权限
- **积分系统** - 使用积分购买资源访问权
- **下载限制** - 限制每个资源的下载次数

#### 防盗链保护
```javascript
// 生成安全下载链接
POST /api/resources/:id/download
→ 返回签名链接，包含：
  - 时效性验证（默认1小时）
  - IP 地址验证
  - 用户身份验证
  - 下载次数限制
```

### 🔍 搜索引擎

#### 全文搜索能力
- **PostgreSQL GIN 索引** - 高性能全文搜索
- **多字段搜索** - 标题、描述、内容同时搜索
- **中文分词** - 支持中文内容精确搜索
- **相关度排序** - 智能排序搜索结果

#### 高级筛选
```javascript
// 组合条件搜索
GET /api/resources?search=vue&category=1&tags=tutorial,frontend&isFree=true&sortBy=view_count&sortOrder=DESC
```

### 📊 数据统计分析

#### 资源统计
- **总体概况** - 资源总数、类型分布、状态统计
- **访问分析** - 浏览量、下载量、点赞数统计
- **时间趋势** - 按日期统计资源创建和访问趋势
- **作者排行** - 资源贡献者排行榜

#### 热门分析
- **热门资源** - 按浏览量、下载量排序
- **热门分类** - 资源数量最多的分类
- **热门标签** - 使用频率最高的标签
- **用户活跃度** - 用户参与度统计

## 💬 微社区功能详解

### 📂 板块管理系统

#### 核心功能
- **无限层级结构** - 支持多层级板块嵌套
- **版主管理** - 每个板块可设置多个版主
- **排序控制** - 自定义板块显示顺序
- **访问统计** - 自动统计板块帖子数和活跃度

#### 预设板块
```
💬 技术交流 - 编程技术、开发经验分享
🌐 前端开发 - HTML、CSS、JavaScript、Vue、React等
🔧 后端开发 - Node.js、Python、Java、数据库等
📱 移动开发 - iOS、Android、React Native、Flutter等
🔧 运维部署 - Docker、Kubernetes、CI/CD、服务器运维
🎨 设计分享 - UI设计、UX设计、平面设计作品分享
💼 职场发展 - 求职面试、职场经验、技能提升
🛠️ 工具推荐 - 开发工具、效率工具、资源推荐
❓ 问答求助 - 技术问题求助、经验答疑
💬 水友闲聊 - 日常生活、兴趣爱好、轻松话题
```

### 📝 帖子管理系统

#### 内容格式支持
- **Markdown** - 支持GitHub Flavored Markdown语法
- **HTML** - 支持富文本HTML内容
- **代码高亮** - 自动识别和高亮代码块
- **链接预览** - 自动解析和预览外部链接

#### 帖子状态管理
```javascript
// 帖子状态流转
draft -> reviewing -> published
  ↓         ↓           ↓
deleted ← rejected    featured/pinned
```

#### 特殊功能
- **置顶帖子** - 板块内优先显示
- **精华帖子** - 高质量内容标记
- **锁定帖子** - 禁止新回复
- **软删除** - 保留数据但隐藏显示

### 💭 评论系统

#### 楼中楼结构
- **无限嵌套** - 支持任意层级的回复
- **楼层计算** - 自动生成楼层号
- **@用户功能** - 支持@特定用户回复
- **软删除** - 删除评论保留结构完整性

#### 评论管理
```javascript
// 评论树形结构示例
1楼 (主评论)
├── 1-1楼 (回复1楼)
│   ├── 1-1-1楼 (回复1-1楼)
│   └── 1-1-2楼 (回复1-1楼)
└── 1-2楼 (回复1楼)
2楼 (主评论)
```

### 👍 互动功能

#### 点赞系统
- **双向操作** - 点赞/取消点赞
- **防重复** - 同一用户对同一内容只能点赞一次
- **实时统计** - 使用数据库触发器自动更新统计
- **支持目标** - 帖子、评论均可点赞

#### 收藏功能
- **个人收藏夹** - 用户可收藏感兴趣的帖子
- **快速访问** - 提供收藏列表快速查看
- **统计计数** - 自动统计帖子收藏数量

#### 分享系统
- **多平台支持** - 微信、微博、QQ、直链分享
- **分享统计** - 记录分享次数和平台分布
- **分享链接** - 生成带统计的分享链接

### 🚨 社区治理

#### 举报系统
```javascript
// 举报类型
spam         - 垃圾信息
inappropriate - 不当内容  
harassment   - 骚扰行为
fake         - 虚假信息
other        - 其他原因
```

#### 处罚机制
- **警告** - 轻微违规警告
- **禁言** - 限制发言权限
- **禁止发帖** - 限制发帖权限
- **社区封禁** - 完全限制社区功能

#### 审核流程
```javascript
// 举报处理流程
pending -> reviewing -> resolved/rejected
```

### 🔍 搜索引擎

#### PostgreSQL全文搜索
- **GIN索引** - 高性能倒排索引
- **多字段搜索** - 标题、内容同时搜索
- **相关度排序** - 智能相关度算法
- **中文支持** - 支持中文分词搜索

#### 搜索功能
```javascript
// 搜索API示例
GET /api/community/posts/search/query?q=vue+typescript
GET /api/community/posts?search=react&board=frontend&tags=tutorial
```

## 🛠️ 管理员功能

### 批量操作
```javascript
// 批量更新资源状态
PATCH /api/resources/admin/batch-update
{
  "resourceIds": [1, 2, 3],
  "updateData": {
    "status": "published",
    "is_public": true
  }
}

// 批量创建分类
POST /api/categories/admin/batch-create
{
  "categories": [
    {"name": "frontend", "displayName": "前端开发"},
    {"name": "backend", "displayName": "后端开发"}
  ]
}
```

### 数据维护
- **标签清理** - 删除未使用的标签
- **使用次数重算** - 重新统计标签使用频次
- **分类排序** - 批量更新分类显示顺序
- **资源审核** - 管理员审核和发布资源

## 📡 API 文档

### Postman 集合
项目提供了完整的 Postman API 文档集合：

#### 📁 用户管理 API
- **文件**: `postman/Alcms-Backend-API.postman_collection.json`
- **功能**: 用户注册、登录、权限管理、角色分配

#### 📁 CMS 管理 API  
- **文件**: `postman/Alcms-CMS-API.postman_collection.json`
- **功能**: 资源管理、分类管理、标签系统、搜索功能

#### 📁 社区管理 API
- **端点**: `/api/community/*`
- **功能**: 板块管理、帖子发布、评论系统、互动功能、社区治理

#### 🔧 环境配置
- **文件**: `postman/Alcms-Environment.postman_environment.json`
- **功能**: API 基础地址、Token 自动管理

### 使用方法
1. **导入 Postman 集合**
   ```bash
   # 导入以下文件到 Postman
   - Alcms-CMS-API.postman_collection.json
   - Alcms-Environment.postman_environment.json
   ```

2. **快速测试流程**
   ```
   管理员登录 → 获取分类树 → 创建资源 → 搜索测试 → 查看统计
   ```

3. **自动化测试**
   ```bash
   npm run test-api  # 运行完整的 API 自动化测试
   ```

## 🎯 NPM 脚本命令

| 命令 | 功能 | 说明 |
|------|------|------|
| `npm start` | 启动生产服务 | 使用 Node.js 直接运行 |
| `npm run dev` | 启动开发服务 | 使用 nodemon 自动重启 |
| `npm run migrate` | 用户系统迁移 | 创建用户、角色、权限表 |
| `npm run migrate-cms` | CMS 系统迁移 | 创建资源、分类、标签表 |
| `npm run migrate-community` | 社区系统迁移 | 创建板块、帖子、评论、互动表 |
| `npm run create-admin` | 创建管理员 | 创建初始管理员账户 |
| `npm run test-api` | API 自动化测试 | 测试所有 API 端点 |

## 🔧 开发指南

### 添加新的资源类型
1. **更新数据库**
   ```sql
   INSERT INTO resource_types (name, display_name, description) 
   VALUES ('new_type', '新类型', '新资源类型描述');
   ```

2. **更新控制器**
   - 在 `resourceController.js` 中添加特定类型的处理逻辑
   - 实现类型特有的验证和处理

3. **更新前端**
   - 添加对应的上传和展示组件
   - 更新 Postman 测试用例

### 扩展权限系统
1. **添加新权限**
   ```sql
   INSERT INTO permissions (name, display_name, description, resource, action) 
   VALUES ('new_permission', '新权限', '新权限描述', 'resource_name', 'action_type');
   ```

2. **分配给角色**
   ```sql
   INSERT INTO role_permissions (role_id, permission_id) 
   VALUES (role_id, permission_id);
   ```

3. **更新中间件**
   - 在 `auth.js` 中添加权限检查逻辑

### 扩展社区功能
1. **添加新板块**
   ```javascript
   POST /api/community/boards
   {
     "name": "new_board",
     "displayName": "新板块",
     "description": "板块描述"
   }
   ```

2. **自定义互动类型**
   - 扩展 `community_likes` 表的 `target_type` 字段
   - 在 `CommunityInteraction` 模型中添加新的互动逻辑

3. **增强搜索功能**
   - 优化PostgreSQL全文搜索配置
   - 添加自定义分词器
   - 实现搜索结果高亮

## ⚡ 性能优化

### 数据库优化
- **索引策略** - 为搜索字段和外键创建适当索引
- **查询优化** - 使用 JOIN 减少 N+1 查询问题
- **分页查询** - 大数据量时使用分页避免内存溢出

### 缓存策略
- **分类树缓存** - 分类结构相对稳定，适合缓存
- **热门标签缓存** - 热门标签列表可以缓存
- **用户权限缓存** - 减少重复的权限查询

### 搜索优化
- **GIN 索引** - PostgreSQL 全文搜索索引
- **搜索建议** - 缓存热门搜索词
- **结果缓存** - 缓存常见搜索结果

---

## 🎉 项目特色

### 🔥 现代化架构
- **RESTful API** 设计规范
- **JWT 双令牌** 安全机制
- **RBAC 权限模型** 灵活控制
- **PostgreSQL** 关系型数据库

### 🚀 开箱即用
- **完整 Postman 文档** - 无需额外文档
- **自动化测试脚本** - 一键验证所有功能
- **Docker 支持** - 容器化部署
- **生产就绪** - 安全配置和错误处理

### 📈 可扩展性
- **模块化设计** - 松耦合架构
- **插件化权限** - 易于扩展新权限
- **类型化资源** - 支持任意资源类型
- **国际化友好** - 多语言支持基础

**立即开始使用 Alcms CMS 系统，构建您的内容管理平台！** 🚀
