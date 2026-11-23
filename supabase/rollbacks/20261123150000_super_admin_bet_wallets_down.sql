-- Removes the super admin login and wallet editing. Wallet balances that were
-- edited keep their current values; the edit log is deleted.
BEGIN;
DELETE FROM private.admin_sessions WHERE token_hash IN (SELECT token_hash FROM private.super_admin_sessions);
DELETE FROM private.admin_login_attempts WHERE login_key LIKE 'super:%';
DROP FUNCTION IF EXISTS public.super_admin_wallet_adjustments(text);
DROP FUNCTION IF EXISTS public.super_admin_set_wallet(text, uuid, integer);
DROP FUNCTION IF EXISTS public.validate_super_admin_session(text);
DROP FUNCTION IF EXISTS public.create_super_admin_session(text);
DROP FUNCTION IF EXISTS private.require_super_admin_session(text);
DROP FUNCTION IF EXISTS private.is_valid_super_admin_session(text);
DROP FUNCTION IF EXISTS private.set_super_admin_password(text);
DROP TABLE IF EXISTS private.bet_wallet_adjustments;
DROP TABLE IF EXISTS private.super_admin_sessions;
DROP TABLE IF EXISTS private.super_admin_config;
DO $$ BEGIN
    IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
        DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261123150000' OR name = 'super_admin_bet_wallets';
    END IF;
END $$;
COMMIT;
