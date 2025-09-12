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

### 💎 VIP会员系统
- **多级VIP等级**：支持1-3级VIP，权限递增
- **灵活有效期**：支持天数VIP和永久VIP
- **卡密兑换系统**：生成和管理VIP卡密
- **自动过期处理**：定时任务自动更新过期用户状态
- **订单记录**：完整的VIP购买和使用记录

### 🎫 卡密系统
- **双类型支持**：VIP卡密和积分卡密
- **批量生成**：支持一次生成1-1000个卡密
- **状态管理**：未使用/已使用/已过期/已禁用
- **使用记录**：详细的兑换历史和统计
- **过期控制**：可设置卡密有效期

### 🎯 积分系统
- **积分获取**：签到、任务、管理员发放等多种方式
- **积分消费**：资源下载、功能解锁等
- **转账功能**：用户间积分转移（单次最多10000）
- **积分记录**：完整的积分变动历史
- **排行榜系统**：实时积分排名

### ✅ 签到系统
- **每日签到**：用户每天可签到一次获得积分
- **连续奖励**：7天、15天、30天连续签到额外奖励
- **签到统计**：个人签到历史和统计数据
- **管理功能**：签到配置管理、用户签到数据管理
- **补签功能**：管理员可为用户补签历史日期

### ⭐ 收藏系统
- **资源收藏**：用户可收藏喜欢的资源
- **收藏管理**：查看、搜索、批量管理收藏
- **收藏统计**：个人和资源的收藏统计
- **热门分析**：管理员可查看热门收藏资源

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
- **数据库**：PostgreSQL (>=12.0)
- **缓存**：Redis (>=6.0, 可选)
- **认证**：JSON Web Token (JWT)
- **密码加密**：bcrypt
- **输入验证**：express-validator
- **安全防护**：helmet, cors, express-rate-limit
- **API 文档**：Swagger/OpenAPI 3.0
- **日志系统**：Winston
- **进程管理**：PM2 集群模式
- **性能监控**：自定义中间件

### 项目结构
```
alcms-rearend/
├── src/                    # 源代码目录
│   ├── app.js             # 应用入口文件
│   ├── cluster.js         # 集群模式启动文件
│   ├── config/            # 配置文件
│   │   ├── database.js    # 数据库配置
│   │   └── swagger.js     # API文档配置
│   ├── controllers/       # 控制器层
│   │   ├── authController.js      # 🔐 用户认证
│   │   ├── userController.js      # 👥 用户管理
│   │   ├── vipController.js       # 💎 VIP会员系统
│   │   ├── cardKeyController.js   # 🎫 卡密系统
│   │   ├── pointsController.js    # 🎯 积分系统
│   │   ├── checkinController.js   # ✅ 签到系统
│   │   ├── favoriteController.js  # ⭐ 收藏系统
│   │   ├── resourceController.js  # 📄 资源管理
│   │   ├── categoryController.js  # 📂 分类管理
│   │   ├── tagController.js       # 🏷️ 标签管理
│   │   ├── communityBoardController.js    # 💬 板块管理
│   │   ├── communityPostController.js     # 📝 帖子管理
│   │   ├── communityCommentController.js  # 💭 评论管理
│   │   └── communityInteractionController.js # 👍 互动功能
│   ├── middleware/        # 中间件
│   │   ├── auth.js        # 认证中间件
│   │   ├── authOptimized.js # 优化认证中间件
│   │   ├── security.js    # 安全中间件
│   │   ├── errorHandler.js # 错误处理中间件
│   │   ├── cacheMiddleware.js # 缓存中间件
│   │   ├── httpCache.js   # HTTP缓存中间件
│   │   ├── performance.js # 性能监控中间件
│   │   └── validation.js  # 输入验证中间件
│   ├── models/            # 数据模型
│   │   ├── User.js        # 👥 用户模型
│   │   ├── VIP.js         # 💎 VIP模型
│   │   ├── CardKey.js     # 🎫 卡密模型
│   │   ├── Points.js      # 🎯 积分模型
│   │   ├── Checkin.js     # ✅ 签到模型
│   │   ├── Favorite.js    # ⭐ 收藏模型
│   │   ├── Resource.js    # 📄 资源模型
│   │   ├── Category.js    # 📂 分类模型
│   │   ├── Tag.js         # 🏷️ 标签模型
│   │   ├── CommunityBoard.js      # 💬 板块模型
│   │   ├── CommunityPost.js       # 📝 帖子模型
│   │   ├── CommunityComment.js    # 💭 评论模型
│   │   └── CommunityInteraction.js # 👍 互动模型
│   ├── routes/            # 路由定义
│   │   ├── auth.js        # 🔐 认证路由
│   │   ├── users.js       # 👥 用户路由
│   │   ├── vip.js         # 💎 VIP路由
│   │   ├── cardKey.js     # 🎫 卡密路由
│   │   ├── points.js      # 🎯 积分路由
│   │   ├── checkin.js     # ✅ 签到路由
│   │   ├── favorites.js   # ⭐ 收藏路由
│   │   ├── resources.js   # 📄 资源路由
│   │   ├── categories.js  # 📂 分类路由
│   │   ├── tags.js        # 🏷️ 标签路由
│   │   └── community.js   # 💬 社区路由
│   ├── services/          # 业务逻辑层
│   │   ├── index.js       # 服务层入口
│   │   ├── BaseService.js # 基础服务类
│   │   ├── AuthService.js # 认证服务
│   │   ├── UserService.js # 用户服务
│   │   └── ResourceService.js # 资源服务
│   ├── docs/              # API文档Schema定义
│   │   └── schemas/       # Swagger Schema
│   │       ├── common.js  # 通用Schema
│   │       ├── auth.js    # 认证Schema
│   │       ├── user.js    # 用户Schema
│   │       ├── vip.js     # VIPSchema
│   │       ├── cardkey.js # 卡密Schema
│   │       ├── points.js  # 积分Schema
│   │       ├── checkin.js # 签到Schema
│   │       ├── favorite.js # 收藏Schema
│   │       ├── resource.js # 资源Schema
│   │       ├── category.js # 分类Schema
│   │       └── tag.js     # 标签Schema
│   └── utils/             # 工具函数
│       ├── jwt.js         # JWT 工具
│       ├── secureJwt.js   # 安全JWT工具
│       ├── password.js    # 密码工具
│       ├── logger.js      # 日志工具
│       ├── cache.js       # 缓存工具
│       ├── downloadUtils.js # 🔐 下载工具
│       ├── downloadUtilsBatch.js # 批量下载工具
│       ├── batchLoader.js # 批量加载器
│       ├── queryOptimizer.js # 查询优化器
│       └── responseHelper.js # 响应助手
├── database/              # 数据库相关
│   ├── migrations/        # 数据库迁移文件
│   │   ├── 001_create_tables.sql      # 用户权限表
│   │   ├── 002_insert_default_data.sql # 默认用户数据
│   │   ├── 003_create_cms_tables.sql   # 📄 CMS 表结构
│   │   ├── 004_insert_cms_default_data.sql # 📄 CMS 默认数据
│   │   ├── 005_create_community_tables.sql # 💬 社区表结构
│   │   └── 006_insert_community_default_data.sql # 💬 社区默认数据
│   ├── migrate.js         # 数据库迁移工具
│   └── setup.js           # 数据库设置工具
├── docs/                  # 文档目录
│   ├── swagger.yaml.bak2  # Swagger备份文档
│   └── swagger.yaml.bak3  # Swagger备份文档
├── scripts/               # 管理脚本
│   └── create-admin.js    # 创建管理员账户
├── postman/               # 📡 Postman API集合
│   ├── Alcms-Backend-API.postman_collection.json  # 用户管理 API
│   ├── Alcms-CMS-API.postman_collection.json      # 📄 CMS 管理 API
│   └── Alcms-Environment.postman_environment.json # 环境配置
├── package.json           # 项目依赖
├── .env.example          # 环境变量模板
├── test-api.js           # API 自动化测试
├── CLAUDE.md             # Claude AI 工作指导文档
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

**迁移说明**：
- `001_create_tables.sql` - 用户、角色、权限表
- `002_insert_default_data.sql` - 默认角色和权限数据
- `003_create_cms_tables.sql` - CMS 核心表（资源、分类、标签等）
- `004_insert_cms_default_data.sql` - CMS 默认数据（资源类型、分类等）
- `005_create_community_tables.sql` - 社区核心表（板块、帖子、评论、互动等）
- `006_insert_community_default_data.sql` - 社区默认数据（板块、权限分配等）

服务启动后，访问：
- **API 服务**：http://localhost:3000
- **API 文档**：http://localhost:3000/api-docs （Swagger UI 交互式文档）
- **API 接口列表**：http://localhost:3000/api （所有可用端点概览）
- **健康检查**：http://localhost:3000/health


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

  # 开发环境集群（2进程）
  npm run pm2:dev

  # 生产环境集群（max进程）
  npm run pm2:prod

  # 管理命令
  npm run pm2:status   # 查看状态
  npm run pm2:logs     # 查看日志  
  npm run pm2:monit    # 性能监控
  npm run pm2:restart  # 重启
  npm run pm2:stop     # 停止