-- 为resources表添加软删除支持
-- 保留重要的历史记录，只删除关联数据

BEGIN;

-- 1. 为resources表添加软删除字段
ALTER TABLE resources ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);

-- 2. 创建软删除相关索引
CREATE INDEX IF NOT EXISTS idx_resources_deleted_at ON resources(deleted_at);
CREATE INDEX IF NOT EXISTS idx_resources_not_deleted ON resources(id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resources_public_active ON resources(is_public, status, deleted_at) WHERE deleted_at IS NULL;

-- 3. 创建查询活跃资源的视图（可选）
CREATE OR REPLACE VIEW active_resources AS
SELECT * FROM resources WHERE deleted_at IS NULL;

-- 4. 添加注释
COMMENT ON COLUMN resources.deleted_at IS '软删除时间，NULL表示未删除';
COMMENT ON COLUMN resources.deleted_by IS '执行删除操作的用户ID';

-- 插入迁移记录
INSERT INTO schema_migrations (version, description)
VALUES ('012', '为resources表添加软删除支持，保留历史数据')
ON CONFLICT (version) DO NOTHING;

COMMIT;