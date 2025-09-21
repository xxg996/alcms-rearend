BEGIN;

-- 更新状态约束为新集合
ALTER TABLE referral_commissions
  DROP CONSTRAINT IF EXISTS referral_commissions_status_check,
  ADD CONSTRAINT referral_commissions_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'no_include'));

-- 将历史 paid 状态改为 no_include
UPDATE referral_commissions
SET status = 'no_include'
WHERE status = 'paid';

COMMIT;
