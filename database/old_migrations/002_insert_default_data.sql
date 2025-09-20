-- 插入默认角色数据
INSERT INTO roles (name, display_name, description) VALUES
('user', '普通用户', '系统普通用户，具有基本功能权限'),
('vip', 'VIP用户', 'VIP用户，享有高级功能权限'),
('moderator', '版主', '版主用户，具有内容管理权限'),
('admin', '管理员', '系统管理员，具有最高权限')
ON CONFLICT (name) DO NOTHING;

-- 插入基础权限数据
INSERT INTO permissions (name, display_name, description, resource, action) VALUES
-- 用户基础权限
('user:read', '查看用户信息', '查看自己的用户信息', 'user', 'read'),
('user:update', '更新用户信息', '更新自己的用户信息', 'user', 'update'),
('profile:update', '更新个人资料', '更新头像、昵称、简介等', 'profile', 'update'),

-- VIP用户权限
('content:create_advanced', '创建高级内容', 'VIP用户创建高级内容权限', 'content', 'create_advanced'),
('feature:vip_access', '访问VIP功能', 'VIP专属功能访问权限', 'feature', 'vip_access'),

-- 版主权限
('content:moderate', '内容审核', '审核和管理用户发布的内容', 'content', 'moderate'),
('user:warn', '警告用户', '对违规用户发出警告', 'user', 'warn'),
('report:handle', '处理举报', '处理用户举报的内容或行为', 'report', 'handle'),

-- 管理员权限
('user:list', '查看用户列表', '查看所有用户信息', 'user', 'list'),
('user:ban', '封禁用户', '封禁违规用户账号', 'user', 'ban'),
('user:unban', '解封用户', '解除用户账号封禁', 'user', 'unban'),
('user:freeze', '冻结用户', '临时冻结用户账号', 'user', 'freeze'),
('user:unfreeze', '解冻用户', '解除用户账号冻结', 'user', 'unfreeze'),
('role:assign', '分配角色', '为用户分配或移除角色', 'role', 'assign'),
('permission:manage', '权限管理', '管理系统权限配置', 'permission', 'manage'),
('system:configure', '系统配置', '修改系统配置参数', 'system', 'configure')
ON CONFLICT (name) DO NOTHING;

-- 为角色分配相应权限
-- 普通用户权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'user' AND p.name IN (
    'user:read',
    'user:update', 
    'profile:update'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- VIP用户权限（继承普通用户权限，并添加VIP专属权限）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'vip' AND p.name IN (
    'user:read',
    'user:update',
    'profile:update',
    'content:create_advanced',
    'feature:vip_access'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 版主权限（继承VIP权限，并添加内容管理权限）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'moderator' AND p.name IN (
    'user:read',
    'user:update',
    'profile:update',
    'content:create_advanced',
    'feature:vip_access',
    'content:moderate',
    'user:warn',
    'report:handle'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 管理员权限（拥有所有权限）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;
