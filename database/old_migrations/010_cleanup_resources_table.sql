-- 清理 resources 表，删除无用字段
-- 移除文件相关字段，这些功能已迁移到 resource_files 表

-- 删除无用的字段
ALTER TABLE resources
DROP COLUMN IF EXISTS required_vip_level,
DROP COLUMN IF EXISTS download_limit,
DROP COLUMN IF EXISTS file_url,
DROP COLUMN IF EXISTS file_size,
DROP COLUMN IF EXISTS file_mime_type,
DROP COLUMN IF EXISTS duration,
DROP COLUMN IF EXISTS external_url,
DROP COLUMN IF EXISTS download_url;

-- 注释说明：
-- required_vip_level: VIP 等级控制已移至业务层处理
-- download_limit: 下载限制已移至用户层面的日限制系统
-- file_url, file_size, file_mime_type, duration: 文件信息已迁移到 resource_files 表
-- external_url, download_url: 下载链接已迁移到 resource_files 表统一管理