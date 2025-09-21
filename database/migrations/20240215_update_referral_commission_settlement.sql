BEGIN;

-- 扩展佣金记录状态
ALTER TABLE referral_commissions
  ADD COLUMN IF NOT EXISTS settlement_method VARCHAR(20),
  ADD COLUMN IF NOT EXISTS settlement_account VARCHAR(255),
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ALTER COLUMN status SET DEFAULT 'pending';

-- 更新状态检查约束
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'referral_commissions'::regclass
    AND conname LIKE 'referral_commissions_status_check%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE referral_commissions DROP CONSTRAINT %I', constraint_name);
  END IF;

  EXECUTE 'ALTER TABLE referral_commissions
    ADD CONSTRAINT referral_commissions_status_check
    CHECK (status IN (''pending'', ''approved'', ''rejected'', ''paid''))';
END$$;

-- 更新 event_type 约束以防丢失（幂等处理）
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'referral_commissions'::regclass
    AND conname LIKE 'referral_commissions_event_type_check%';

  IF constraint_name IS NULL THEN
    EXECUTE 'ALTER TABLE referral_commissions
      ADD CONSTRAINT referral_commissions_event_type_check
      CHECK (event_type IN (''first_recharge'', ''renewal''))';
  END IF;
END$$;

-- 为历史数据设置 settled_at（已付款）
UPDATE referral_commissions
SET settled_at = COALESCE(settled_at, created_at), status = 'paid'
WHERE status = 'paid';

-- 新增提现方式配置表
CREATE TABLE IF NOT EXISTS referral_payout_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    method VARCHAR(20) NOT NULL CHECK (method IN ('alipay', 'usdt')),
    account VARCHAR(255) NOT NULL,
    account_name VARCHAR(100),
    extra JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_referral_payout_settings_user ON referral_payout_settings(user_id);

CREATE TABLE IF NOT EXISTS referral_payout_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    method VARCHAR(20) NOT NULL CHECK (method IN ('alipay', 'usdt')),
    account VARCHAR(255) NOT NULL,
    account_name VARCHAR(100),
    extra JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    requested_notes TEXT,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id),
    paid_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_referral_payout_requests_user ON referral_payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_payout_requests_status ON referral_payout_requests(status);

COMMIT;
