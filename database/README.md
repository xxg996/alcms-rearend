# ALCMS 数据库安装指南

## 快速安装

### 1. 准备环境

确保你已经安装了 PostgreSQL (推荐版本 13+)：

```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib

# macOS (使用 Homebrew)
brew install postgresql

# 启动 PostgreSQL 服务
sudo service postgresql start  # Linux
brew services start postgresql  # macOS
```

### 2. 创建数据库和用户

```sql
-- 连接到 PostgreSQL
sudo -u postgres psql

-- 创建数据库
CREATE DATABASE alcms;

-- 创建用户 (请修改密码)
CREATE USER alcms_user WITH PASSWORD 'your_secure_password';

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE alcms TO alcms_user;

-- 退出
\q
```

### 3. 执行安装脚本

```bash
# 进入项目目录
cd /path/to/alcms-rearend

# 执行安装脚本
psql postgresql://alcms_user:your_secure_password@localhost:5432/alcms -f database/install.sql
```

### 4. 配置应用程序

更新你的环境配置文件 (`.env`) 中的数据库连接信息：

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=alcms
DB_USER=alcms_user
DB_PASSWORD=your_secure_password
```

## 数据库结构说明

### 核心模块

- **用户管理**: `users`, `roles`, `permissions`, `user_roles`, `role_permissions`
- **资源管理**: `resources`, `resource_types`, `resource_files`, `categories`, `tags`
- **社区系统**: `community_*` 系列表
- **积分VIP**: `vip_*`, `points_*`, `user_points` 系列表
- **行为跟踪**: `download_records`, `daily_purchases`, `user_favorites` 等

### 重要特性

1. **优化的删除策略**
   - `resources` 表使用硬删除，提高性能
   - 历史记录表保留 `resource_id` 用于数据分析
   - 社区内容使用软删除，可恢复

2. **完整的权限系统**
   - 基于角色的权限控制 (RBAC)
   - 细粒度权限管理
   - 默认三种角色：管理员、版主、普通用户

3. **性能优化**
   - 合理的索引设计
   - 触发器自动维护统计数据
   - 缓存友好的结构设计

## 默认数据

安装后会自动创建以下默认数据：

### 默认角色
- `admin` - 管理员 (拥有所有权限)
- `moderator` - 版主 (内容管理权限)
- `user` - 普通用户 (基础功能权限)

### 默认资源类型
- 文章、视频、音频、文档、图片、软件

### 默认分类
- 科技、教育、娱乐、商业、健康、生活

### 默认社区版块
- 综合讨论、技术交流、资源分享、意见反馈、新手指导

### 默认VIP等级
- 月度VIP (29.90元/30天)
- 季度VIP (79.90元/90天)
- 年度VIP (299.90元/365天)

## 管理员账户创建

安装完成后，你需要创建第一个管理员账户。可以通过应用程序的注册功能创建用户，然后手动分配管理员角色：

```sql
-- 假设新创建的用户ID为1，分配管理员角色
INSERT INTO user_roles (user_id, role_id)
VALUES (1, (SELECT id FROM roles WHERE name = 'admin'));
```

## 迁移说明

如果你是从旧版本升级，请注意：

1. **旧文件备份**: 所有旧的 SQL 文件已移动到 `old_migrations/` 目录
2. **数据迁移**: 如果需要保留现有数据，请在执行新安装前备份数据库
3. **配置更新**: 检查并更新应用程序配置以适应新的数据库结构

## 常见问题

### Q: 安装失败怎么办？
A: 检查 PostgreSQL 版本是否兼容，确保用户权限正确，查看错误日志。

### Q: 如何备份数据库？
A: 使用 `pg_dump` 命令：
```bash
pg_dump postgresql://alcms_user:password@localhost:5432/alcms > backup.sql
```

### Q: 如何重置数据库？
A:
```sql
DROP DATABASE alcms;
CREATE DATABASE alcms;
-- 然后重新执行安装脚本
```

### Q: 如何查看数据库版本？
A:
```sql
SELECT version, description, executed_at
FROM schema_migrations
ORDER BY executed_at DESC;
```

## 技术支持

如遇到问题，请检查：
1. PostgreSQL 服务是否正常运行
2. 用户权限是否正确配置
3. 网络连接是否正常
4. 应用程序日志中的错误信息

---

**ALCMS v1.0.0** - Advanced Learning Content Management System