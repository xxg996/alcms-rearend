-- 添加每日下载次数限制功能
-- 为用户表和VIP等级表添加每日下载限制相关字段

BEGIN;

-- 为用户表添加每日下载相关字段
ALTER TABLE users
ADD COLUMN IF NOT EXISTS daily_download_limit INTEGER DEFAULT 10 CHECK (daily_download_limit >= 0), -- 每日下载限制次数
ADD COLUMN IF NOT EXISTS daily_downloads_used INTEGER DEFAULT 0 CHECK (daily_downloads_used >= 0), -- 今日已使用下载次数
ADD COLUMN IF NOT EXISTS last_download_reset_date DATE DEFAULT CURRENT_DATE; -- 上次重置下载次数的日期

-- 为VIP等级配置表添加每日下载限制字段
ALTER TABLE vip_levels
ADD COLUMN IF NOT EXISTS daily_download_limit INTEGER DEFAULT 50 CHECK (daily_download_limit >= 0); -- VIP等级的每日下载限制

-- 更新现有VIP等级的默认下载限制（如果数据存在）
UPDATE vip_levels SET
    daily_download_limit = CASE
        WHEN level = 1 THEN 100    -- VIP1: 100次/天
        WHEN level = 2 THEN 200    -- VIP2: 200次/天
        WHEN level = 3 THEN 500    -- VIP3: 500次/天
        ELSE 50                    -- 其他等级: 50次/天
    END
WHERE daily_download_limit IS NULL;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_users_download_reset_date ON users(last_download_reset_date);
CREATE INDEX IF NOT EXISTS idx_download_records_user_date ON download_records(user_id, downloaded_at);

-- 插入迁移记录
INSERT INTO schema_migrations (version, description)
VALUES ('008', '添加每日下载次数限制功能')
ON CONFLICT (version) DO NOTHING;

COMMIT;