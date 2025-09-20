-- 创建每日购买记录表
-- 记录用户每日购买的资源，12点重置

-- 创建每日购买记录表
CREATE TABLE IF NOT EXISTS daily_purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    points_cost INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- 确保同一用户同一天同一资源只能有一条购买记录
    UNIQUE(user_id, resource_id, purchase_date)
);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_daily_purchases_user_date ON daily_purchases(user_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_daily_purchases_resource_date ON daily_purchases(resource_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_daily_purchases_date ON daily_purchases(purchase_date);

-- 注释
COMMENT ON TABLE daily_purchases IS '每日购买记录表，记录用户每日用积分购买的资源';
COMMENT ON COLUMN daily_purchases.user_id IS '用户ID';
COMMENT ON COLUMN daily_purchases.resource_id IS '资源ID';
COMMENT ON COLUMN daily_purchases.purchase_date IS '购买日期';
COMMENT ON COLUMN daily_purchases.points_cost IS '消耗的积分数';
COMMENT ON COLUMN daily_purchases.created_at IS '购买时间';