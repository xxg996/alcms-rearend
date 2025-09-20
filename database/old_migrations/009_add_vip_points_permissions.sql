-- 添加VIP、卡密、积分、签到系统的权限
-- 为新功能模块添加相应的权限控制

BEGIN;

-- 插入VIP系统相关权限
INSERT INTO permissions (name, display_name, description, resource, action) VALUES
-- VIP等级管理权限
('vip.level.create', '创建VIP等级', '创建新的VIP等级配置', 'vip_level', 'create'),
('vip.level.read', '查看VIP等级', '查看VIP等级配置信息', 'vip_level', 'read'),
('vip.level.update', '更新VIP等级', '修改VIP等级配置', 'vip_level', 'update'),
('vip.level.delete', '删除VIP等级', '删除VIP等级配置', 'vip_level', 'delete'),

-- VIP用户管理权限
('vip.user.read', '查看用户VIP信息', '查看用户的VIP状态和信息', 'vip_user', 'read'),
('vip.user.set', '设置用户VIP', '为用户设置VIP等级和时长', 'vip_user', 'set'),
('vip.user.extend', '延长用户VIP', '延长用户VIP有效期', 'vip_user', 'extend'),
('vip.user.cancel', '取消用户VIP', '取消用户的VIP状态', 'vip_user', 'cancel'),

-- VIP订单管理权限
('vip.order.read', '查看VIP订单', '查看VIP购买和订单记录', 'vip_order', 'read'),
('vip.order.update', '更新VIP订单', '更新VIP订单状态', 'vip_order', 'update'),

-- 卡密系统相关权限
('card_key.generate', '生成卡密', '生成单个或批量卡密', 'card_key', 'generate'),
('card_key.read', '查看卡密', '查看卡密信息和列表', 'card_key', 'read'),
('card_key.update', '更新卡密', '更新卡密状态', 'card_key', 'update'),
('card_key.delete', '删除卡密', '删除卡密或批次', 'card_key', 'delete'),
('card_key.redeem', '兑换卡密', '用户兑换卡密功能', 'card_key', 'redeem'),
('card_key.statistics', '卡密统计', '查看卡密使用统计', 'card_key', 'statistics'),

-- 积分系统相关权限
('points.read', '查看积分信息', '查看用户积分余额和记录', 'points', 'read'),
('points.transfer', '积分转账', '向其他用户转账积分', 'points', 'transfer'),
('points.adjust', '调整积分', '管理员调整用户积分', 'points', 'adjust'),
('points.grant', '发放积分', '批量发放积分给用户', 'points', 'grant'),
('points.statistics', '积分统计', '查看积分系统统计数据', 'points', 'statistics'),

-- 签到系统相关权限
('checkin.check', '执行签到', '用户每日签到功能', 'checkin', 'check'),
('checkin.read', '查看签到信息', '查看签到记录和统计', 'checkin', 'read'),
('checkin.config.create', '创建签到配置', '创建签到奖励配置', 'checkin_config', 'create'),
('checkin.config.read', '查看签到配置', '查看签到配置信息', 'checkin_config', 'read'),
('checkin.config.update', '更新签到配置', '修改签到奖励配置', 'checkin_config', 'update'),
('checkin.config.delete', '删除签到配置', '删除签到配置', 'checkin_config', 'delete'),
('checkin.makeup', '补签功能', '管理员为用户补签', 'checkin', 'makeup'),
('checkin.reset', '重置签到数据', '重置用户签到记录', 'checkin', 'reset'),
('checkin.statistics', '签到统计', '查看签到系统统计数据', 'checkin', 'statistics')

ON CONFLICT (name) DO NOTHING;

-- 为管理员角色分配所有新权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
AND p.name IN (
    'vip.level.create', 'vip.level.read', 'vip.level.update', 'vip.level.delete',
    'vip.user.read', 'vip.user.set', 'vip.user.extend', 'vip.user.cancel',
    'vip.order.read', 'vip.order.update',
    'card_key.generate', 'card_key.read', 'card_key.update', 'card_key.delete',
    'card_key.statistics',
    'points.read', 'points.adjust', 'points.grant', 'points.statistics',
    'checkin.read', 'checkin.config.create', 'checkin.config.read',
    'checkin.config.update', 'checkin.config.delete', 'checkin.makeup',
    'checkin.reset', 'checkin.statistics'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 为普通用户角色分配基础权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'user'
AND p.name IN (
    'card_key.redeem',
    'points.read', 'points.transfer',
    'checkin.check', 'checkin.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 为VIP用户角色分配VIP相关权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'vip'
AND p.name IN (
    'card_key.redeem',
    'points.read', 'points.transfer',
    'checkin.check', 'checkin.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 为版主角色分配部分管理权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'moderator'
AND p.name IN (
    'vip.level.read', 'vip.user.read', 'vip.order.read',
    'card_key.read', 'card_key.statistics',
    'points.read', 'points.statistics',
    'checkin.read', 'checkin.config.read', 'checkin.statistics'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
