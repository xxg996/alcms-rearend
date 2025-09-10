-- 添加积分系统和签到系统
-- 为用户表增加积分字段，创建积分记录和签到相关表

BEGIN;

-- 为用户表添加积分字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0 CHECK (points >= 0),
ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0 CHECK (total_points >= 0);

-- 创建积分记录表
CREATE TABLE IF NOT EXISTS points_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('earn', 'spend', 'admin_adjust')), -- 获得/消费/管理员调整
    amount INTEGER NOT NULL, -- 积分数量（正数为获得，负数为消费）
    source VARCHAR(50) NOT NULL, -- 来源：checkin, card_key, admin, purchase, reward等
    description TEXT, -- 积分变更描述
    related_id INTEGER DEFAULT NULL, -- 关联记录ID（如订单ID、签到ID等）
    related_type VARCHAR(50) DEFAULT NULL, -- 关联类型（如order, checkin, card_key等）
    balance_before INTEGER NOT NULL, -- 变更前余额
    balance_after INTEGER NOT NULL, -- 变更后余额
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建签到配置表
CREATE TABLE IF NOT EXISTS checkin_configs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- 配置名称
    description TEXT, -- 配置描述
    daily_points INTEGER DEFAULT 10 CHECK (daily_points >= 0), -- 每日签到获得积分
    consecutive_bonus JSON DEFAULT '{}', -- 连续签到奖励配置 {days: points}
    monthly_reset BOOLEAN DEFAULT TRUE, -- 是否每月重置连续天数
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建用户签到记录表
CREATE TABLE IF NOT EXISTS user_checkins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL, -- 签到日期
    points_earned INTEGER DEFAULT 0, -- 本次签到获得的积分
    consecutive_days INTEGER DEFAULT 1, -- 连续签到天数
    is_bonus BOOLEAN DEFAULT FALSE, -- 是否获得连续签到奖励
    bonus_points INTEGER DEFAULT 0, -- 连续签到奖励积分
    config_id INTEGER REFERENCES checkin_configs(id) ON DELETE SET NULL, -- 使用的配置
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, checkin_date) -- 每个用户每天只能签到一次
);

-- 创建积分商品/兑换表（可选功能）
CREATE TABLE IF NOT EXISTS points_products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'virtual' CHECK (type IN ('virtual', 'physical', 'service')), -- 商品类型
    points_cost INTEGER NOT NULL CHECK (points_cost > 0), -- 积分成本
    stock INTEGER DEFAULT -1, -- 库存数量，-1表示无限
    is_active BOOLEAN DEFAULT TRUE,
    image_url VARCHAR(500),
    details JSON DEFAULT '{}', -- 商品详情JSON
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建积分兑换记录表
CREATE TABLE IF NOT EXISTS points_exchanges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES points_products(id) ON DELETE RESTRICT,
    points_cost INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    total_points INTEGER NOT NULL, -- 总积分消费
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'failed')),
    exchange_data JSON DEFAULT '{}', -- 兑换相关数据
    processed_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 添加更新时间触发器
-- 为checkin_configs表添加更新时间触发器
DROP TRIGGER IF EXISTS update_checkin_configs_updated_at ON checkin_configs;
CREATE TRIGGER update_checkin_configs_updated_at
    BEFORE UPDATE ON checkin_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为points_products表添加更新时间触发器
DROP TRIGGER IF EXISTS update_points_products_updated_at ON points_products;
CREATE TRIGGER update_points_products_updated_at
    BEFORE UPDATE ON points_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为points_exchanges表添加更新时间触发器
DROP TRIGGER IF EXISTS update_points_exchanges_updated_at ON points_exchanges;
CREATE TRIGGER update_points_exchanges_updated_at
    BEFORE UPDATE ON points_exchanges
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_users_points ON users(points);
CREATE INDEX IF NOT EXISTS idx_users_total_points ON users(total_points);

CREATE INDEX IF NOT EXISTS idx_points_records_user_id ON points_records(user_id);
CREATE INDEX IF NOT EXISTS idx_points_records_type ON points_records(type);
CREATE INDEX IF NOT EXISTS idx_points_records_source ON points_records(source);
CREATE INDEX IF NOT EXISTS idx_points_records_created_at ON points_records(created_at);
CREATE INDEX IF NOT EXISTS idx_points_records_related ON points_records(related_type, related_id);

CREATE INDEX IF NOT EXISTS idx_user_checkins_user_id ON user_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_checkins_date ON user_checkins(checkin_date);
CREATE INDEX IF NOT EXISTS idx_user_checkins_user_date ON user_checkins(user_id, checkin_date);

CREATE INDEX IF NOT EXISTS idx_points_products_active ON points_products(is_active);
CREATE INDEX IF NOT EXISTS idx_points_products_type ON points_products(type);
CREATE INDEX IF NOT EXISTS idx_points_products_cost ON points_products(points_cost);

CREATE INDEX IF NOT EXISTS idx_points_exchanges_user_id ON points_exchanges(user_id);
CREATE INDEX IF NOT EXISTS idx_points_exchanges_product_id ON points_exchanges(product_id);
CREATE INDEX IF NOT EXISTS idx_points_exchanges_status ON points_exchanges(status);

COMMIT;
