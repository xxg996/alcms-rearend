-- 新增邀请与佣金系统相关结构
-- 请在执行前备份关键数据

BEGIN;

-- 用户表新增邀请与佣金字段
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS inviter_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS commission_balance DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_commission_earned DECIMAL(12,2) DEFAULT 0;

-- 保证推荐码唯一
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_referral_code_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);
  END IF;
END $$;

-- 用户邀请关系表
CREATE TABLE IF NOT EXISTS user_referrals (
    id SERIAL PRIMARY KEY,
    inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(invitee_id),
    UNIQUE(inviter_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_user_referrals_inviter ON user_referrals(inviter_id);

-- 系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id)
);

-- 默认佣金配置
INSERT INTO system_settings (key, value, description)
VALUES (
  'referral_commission',
  '{"enabled": true, "first_rate": 0.10, "renewal_rate": 0.00, "card_type_rates": {"points": 0.10}}',
  '邀请分佣配置'
)
ON CONFLICT (key) DO NOTHING;

-- 佣金记录表
CREATE TABLE IF NOT EXISTS referral_commissions (
    id SERIAL PRIMARY KEY,
    inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES vip_orders(id) ON DELETE CASCADE,
    order_amount DECIMAL(12,2) NOT NULL,
    commission_amount DECIMAL(12,2) NOT NULL,
    commission_rate DECIMAL(6,4) NOT NULL,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('first_recharge', 'renewal')),
    status VARCHAR(20) DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_commissions_order_id_key'
  ) THEN
    ALTER TABLE referral_commissions
      ADD CONSTRAINT referral_commissions_order_id_key UNIQUE (order_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_referral_commissions_inviter ON referral_commissions(inviter_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_invitee ON referral_commissions(invitee_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_order ON referral_commissions(order_id);

-- 邀请人索引
CREATE INDEX IF NOT EXISTS idx_users_inviter_id ON users(inviter_id);

-- 权限配置
INSERT INTO permissions (name, display_name, description, resource, action)
VALUES
  ('referral:commission:read', '查看邀请佣金配置', '查看邀请佣金开关与比例', 'referral', 'read'),
  ('referral:commission:update', '更新邀请佣金配置', '调整邀请佣金启用状态与比例', 'referral', 'update')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('referral:commission:read', 'referral:commission:update')
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
