-- Removes payouts. Wallets keep their balances after payouts; the payout log goes.
BEGIN;
DROP FUNCTION IF EXISTS public.super_admin_pay_out(text, uuid, integer, text);
DROP TABLE IF EXISTS public.bet_payouts;
DO $$ BEGIN
    IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
        DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261123220000' OR name = 'bet_payouts';
    END IF;
END $$;
COMMIT;
