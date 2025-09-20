-- 添加VIP用户系统和卡密系统
-- 为用户表增加VIP相关字段，创建卡密系统表

BEGIN;

-- 为用户表添加VIP相关字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vip_level INTEGER DEFAULT 0 CHECK (vip_level >= 0),
ADD COLUMN IF NOT EXISTS vip_expire_at TIMESTAMP DEFAULT NULL, -- NULL或日期为0表示无限期
ADD COLUMN IF NOT EXISTS vip_activated_at TIMESTAMP DEFAULT NULL;

-- 创建VIP等级配置表
CREATE TABLE IF NOT EXISTS vip_levels (
    id SERIAL PRIMARY KEY,
    level INTEGER UNIQUE NOT NULL CHECK (level >= 0),
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    benefits JSON DEFAULT '{}',
    price DECIMAL(10, 2) DEFAULT 0.00,
    duration_days INTEGER DEFAULT 30, -- 0表示无限期
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建卡密表
CREATE TABLE IF NOT EXISTS card_keys (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL, -- 卡密代码
    type VARCHAR(20) DEFAULT 'vip' CHECK (type IN ('vip', 'points', 'days')), -- 卡密类型
    vip_level INTEGER DEFAULT 1, -- 兑换后的VIP等级
    vip_days INTEGER DEFAULT 30, -- 兑换后VIP有效天数，0表示无限期
    points INTEGER DEFAULT 0, -- 兑换后获得的积分
    status VARCHAR(20) DEFAULT 'unused' CHECK (status IN ('unused', 'used', 'expired', 'disabled')),
    used_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- 使用该卡密的用户
    used_at TIMESTAMP DEFAULT NULL,
    expire_at TIMESTAMP DEFAULT NULL, -- 卡密本身的过期时间
    batch_id VARCHAR(50), -- 批次ID，用于批量生成管理
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- 创建者
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建VIP购买记录表
CREATE TABLE IF NOT EXISTS vip_orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vip_level INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    duration_days INTEGER NOT NULL, -- 0表示无限期
    expire_at TIMESTAMP, -- NULL表示无限期
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'expired')),
    payment_method VARCHAR(50),
    order_no VARCHAR(100) UNIQUE NOT NULL,
    card_key_code VARCHAR(50), -- 如果通过卡密兑换
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 添加更新时间触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为vip_levels表添加更新时间触发器
DROP TRIGGER IF EXISTS update_vip_levels_updated_at ON vip_levels;
CREATE TRIGGER update_vip_levels_updated_at
    BEFORE UPDATE ON vip_levels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为card_keys表添加更新时间触发器
DROP TRIGGER IF EXISTS update_card_keys_updated_at ON card_keys;
CREATE TRIGGER update_card_keys_updated_at
    BEFORE UPDATE ON card_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为vip_orders表添加更新时间触发器
DROP TRIGGER IF EXISTS update_vip_orders_updated_at ON vip_orders;
CREATE TRIGGER update_vip_orders_updated_at
    BEFORE UPDATE ON vip_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_users_vip_level ON users(vip_level);
CREATE INDEX IF NOT EXISTS idx_users_vip_expire_at ON users(vip_expire_at);
CREATE INDEX IF NOT EXISTS idx_users_is_vip ON users(is_vip);

CREATE INDEX IF NOT EXISTS idx_card_keys_code ON card_keys(code);
CREATE INDEX IF NOT EXISTS idx_card_keys_status ON card_keys(status);
CREATE INDEX IF NOT EXISTS idx_card_keys_type ON card_keys(type);
CREATE INDEX IF NOT EXISTS idx_card_keys_batch_id ON card_keys(batch_id);
CREATE INDEX IF NOT EXISTS idx_card_keys_used_by ON card_keys(used_by);

CREATE INDEX IF NOT EXISTS idx_vip_orders_user_id ON vip_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_vip_orders_status ON vip_orders(status);
CREATE INDEX IF NOT EXISTS idx_vip_orders_order_no ON vip_orders(order_no);

COMMIT;
