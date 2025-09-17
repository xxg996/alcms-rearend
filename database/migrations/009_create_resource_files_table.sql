-- 创建下载资源表
-- 设计考虑：高性能、大数据量、可扩展性
-- 简化设计：用户输入URL地址，绑定到CMS帖子

BEGIN;

-- 创建下载资源文件表
CREATE TABLE IF NOT EXISTS resource_files (
    id BIGSERIAL PRIMARY KEY,

    -- 关联信息
    resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,

    -- 资源文件信息
    name VARCHAR(255) NOT NULL, -- 资源文件名称
    url VARCHAR(1000) NOT NULL, -- 下载地址

    -- 文件属性（用户可选填）
    file_size BIGINT DEFAULT 0, -- 文件大小（字节）
    file_type VARCHAR(50), -- 文件类型：video, audio, document, software, etc.
    file_extension VARCHAR(10), -- 文件扩展名：mp4, mp3, pdf, zip等

    -- 文件质量/版本信息（用于同一资源的多个版本）
    quality VARCHAR(20), -- 1080p, 720p, 480p, 高音质, 标准音质等
    version VARCHAR(50), -- v1.0, v2.1, 最新版等
    language VARCHAR(10), -- 语言版本：zh-CN, en-US等

    -- 状态管理
    is_active BOOLEAN DEFAULT TRUE, -- 是否启用
    sort_order INTEGER DEFAULT 0, -- 排序顺序

    -- 统计信息
    download_count BIGINT DEFAULT 0, -- 下载次数
    last_downloaded_at TIMESTAMP, -- 最后下载时间

    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- 软删除
    deleted_at TIMESTAMP DEFAULT NULL
);

-- 创建索引以提高查询性能
-- 主要查询索引
CREATE INDEX IF NOT EXISTS idx_resource_files_resource_id ON resource_files(resource_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resource_files_active ON resource_files(is_active) WHERE deleted_at IS NULL;

-- 复合索引优化常见查询
CREATE INDEX IF NOT EXISTS idx_resource_files_resource_active ON resource_files(resource_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resource_files_sort ON resource_files(resource_id, sort_order, is_active) WHERE deleted_at IS NULL;

-- 统计查询优化
CREATE INDEX IF NOT EXISTS idx_resource_files_download_stats ON resource_files(download_count DESC, last_downloaded_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resource_files_created ON resource_files(created_at DESC) WHERE deleted_at IS NULL;

-- 文件类型和质量查询优化
CREATE INDEX IF NOT EXISTS idx_resource_files_type_quality ON resource_files(file_type, quality) WHERE deleted_at IS NULL AND is_active = TRUE;

-- 分区表准备（如果数据量很大，可以按时间分区）
-- 注释：当数据量达到百万级别时，可以考虑按月或年分区
-- CREATE TABLE resource_files_2025_01 PARTITION OF resource_files FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_resource_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_resource_files_updated_at
    BEFORE UPDATE ON resource_files
    FOR EACH ROW
    EXECUTE FUNCTION update_resource_files_updated_at();

-- 添加约束
ALTER TABLE resource_files ADD CONSTRAINT check_positive_counts
    CHECK (download_count >= 0 AND sort_order >= 0);

ALTER TABLE resource_files ADD CONSTRAINT check_file_size
    CHECK (file_size >= 0);

-- 注意：移除了is_primary字段，不再需要主要文件唯一约束

-- 插入迁移记录
INSERT INTO schema_migrations (version, description)
VALUES ('009', '创建下载资源文件表 - 支持大数据量和高性能查询')
ON CONFLICT (version) DO NOTHING;

COMMIT;