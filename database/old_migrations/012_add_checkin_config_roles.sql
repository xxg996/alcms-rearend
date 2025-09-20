-- 为签到配置添加角色绑定功能
-- 创建签到配置-角色关联表

-- 创建签到配置角色关联表
CREATE TABLE IF NOT EXISTS checkin_config_roles (
  id SERIAL PRIMARY KEY,
  checkin_config_id INTEGER NOT NULL REFERENCES checkin_configs(id) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(checkin_config_id, role_name)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_checkin_config_roles_config_id ON checkin_config_roles(checkin_config_id);
CREATE INDEX IF NOT EXISTS idx_checkin_config_roles_role_name ON checkin_config_roles(role_name);

-- 添加注释
COMMENT ON TABLE checkin_config_roles IS '签到配置角色关联表';
COMMENT ON COLUMN checkin_config_roles.id IS '主键ID';
COMMENT ON COLUMN checkin_config_roles.checkin_config_id IS '签到配置ID';
COMMENT ON COLUMN checkin_config_roles.role_name IS '角色名称';
COMMENT ON COLUMN checkin_config_roles.created_at IS '创建时间';
COMMENT ON COLUMN checkin_config_roles.created_by IS '创建者ID';

-- 为现有的活跃配置添加默认角色绑定（可选）
-- INSERT INTO checkin_config_roles (checkin_config_id, role_name, created_by)
-- SELECT id, 'user', NULL FROM checkin_configs WHERE is_active = true;