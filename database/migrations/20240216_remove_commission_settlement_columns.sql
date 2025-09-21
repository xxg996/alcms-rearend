BEGIN;

ALTER TABLE referral_commissions
  DROP COLUMN IF EXISTS settlement_method,
  DROP COLUMN IF EXISTS settlement_account;

COMMIT;
