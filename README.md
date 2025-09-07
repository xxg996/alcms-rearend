# Alcms 后端管理系统
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
│   │   ├── authController.js
│   │   └── userController.js
│   ├── middleware/        # 中间件
│   │   ├── auth.js        # 认证中间件
│   │   └── security.js    # 安全中间件
│   ├── models/            # 数据模型
│   │   └── User.js        # 用户模型
│   ├── routes/            # 路由定义
│   │   ├── auth.js        # 认证路由
│   │   └── users.js       # 用户路由
│   └── utils/             # 工具函数
│       ├── jwt.js         # JWT 工具
│       └── password.js    # 密码工具
├── database/              # 数据库相关
│   ├── migrations/        # 数据库迁移文件
│   │   ├── 001_create_tables.sql
│   │   └── 002_insert_default_data.sql
│   └── migrate.js         # 迁移执行脚本
├── package.json           # 项目依赖
├── .env.example          # 环境变量模板
└── .gitignore            # Git 忽略文件
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
npm run migrate
```

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
