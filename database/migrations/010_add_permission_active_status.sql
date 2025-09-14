-- 为权限表添加is_active字段，支持权限的启用/禁用
-- 为角色表添加is_active字段，支持角色的启用/禁用

BEGIN;

-- 为权限表添加is_active字段
ALTER TABLE permissions 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 为角色表添加is_active字段和updated_at字段
ALTER TABLE roles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 为权限表添加updated_at字段
ALTER TABLE permissions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 为角色表创建更新时间触发器
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 为权限表创建更新时间触发器
CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建权限状态索引
CREATE INDEX IF NOT EXISTS idx_permissions_is_active ON permissions(is_active);
CREATE INDEX IF NOT EXISTS idx_roles_is_active ON roles(is_active);

-- 为permissions表添加资源和操作的复合索引
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);

COMMIT;