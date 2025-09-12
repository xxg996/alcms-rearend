# 📦 数据库安装指南

## 🚀 快速开始

### 完整安装（推荐新项目）
```bash
npm run install
```

### 选择性安装

| 命令 | 说明 | 包含模块 |
|------|------|----------|
| `npm run install:basic` | 基础安装 | 用户系统、权限管理 |
| `npm run install:cms` | CMS模块 | 内容管理、资源管理 |
| `npm run install:community` | 社区模块 | 帖子、评论、互动 |
| `npm run install:vip` | VIP系统 | 会员、积分、签到 |
| `npm run install:help` | 查看帮助 | 显示所有可用选项 |

## 📋 安装前准备

1. **配置数据库连接**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件中的数据库配置
   ```

2. **确保PostgreSQL运行**
   ```bash
   # macOS
   brew services start postgresql
   
   # Linux
   sudo systemctl start postgresql
   ```

## 🔧 高级用法

### 命令行直接调用
```bash
# 完整安装
node database/setup.js full

# 基础安装  
node database/setup.js basic

# 查看帮助
node database/setup.js --help
```

### 模块化安装
```bash
# 先安装基础模块
npm run install:basic

# 再根据需要添加其他模块
npm run install:cms
npm run install:community
npm run install:vip
```

## 🗃️ 迁移文件说明

| 文件 | 说明 | 依赖 |
|------|------|------|
| `001_create_tables.sql` | 核心用户表和权限表 | - |
| `002_insert_default_data.sql` | 默认用户和权限数据 | 001 |
| `003_create_cms_tables.sql` | CMS内容管理表 | 001 |
| `004_insert_cms_default_data.sql` | CMS默认数据 | 003 |
| `005_create_community_tables.sql` | 社区功能表 | 001 |
| `006_insert_community_default_data.sql` | 社区默认数据 | 005 |
| `007_add_vip_card_system.sql` | VIP和卡密系统 | 001 |
| `008_add_points_checkin_system.sql` | 积分和签到系统 | 007 |
| `009_add_vip_points_permissions.sql` | VIP积分权限设置 | 007,008 |

## ⚠️ 注意事项

- **首次安装建议使用完整安装**：`npm run install`
- **生产环境请先备份数据库**
- **确保.env文件配置正确**
- **执行前会自动检查数据库连接和迁移文件**

## 🆘 故障排除

### 连接失败
```bash
# 检查数据库服务状态
pg_isready -h localhost -p 5432

# 检查配置文件
cat .env | grep PG
```

### 权限问题
```bash
# 确保数据库用户有创建表权限
psql -U your_user -d your_database -c "SELECT current_user, session_user;"
```