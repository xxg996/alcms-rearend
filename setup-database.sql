-- Alcms 数据库初始化脚本
-- 创建数据库、用户和权限设置

-- 创建数据库
CREATE DATABASE alcms;

-- 创建专用用户
CREATE USER alcms_user WITH ENCRYPTED PASSWORD 'Alcms2024!';

-- 授予数据库权限
GRANT ALL PRIVILEGES ON DATABASE alcms TO alcms_user;

-- 连接到 alcms 数据库并授予 schema 权限
\c alcms;
GRANT ALL ON SCHEMA public TO alcms_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO alcms_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO alcms_user;

-- 设置默认权限（对未来创建的表也有效）
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO alcms_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO alcms_user;

-- 显示创建结果
\l
\du
