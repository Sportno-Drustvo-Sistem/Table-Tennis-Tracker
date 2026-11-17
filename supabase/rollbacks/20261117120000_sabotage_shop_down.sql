-- Reverses supabase/migrations/20261117120000_sabotage_shop.sql.
-- Removes the sabotage shop and its purchase history. Points already paid to
-- debuffed players stay in their wallets; bets and live matches are untouched.
-- Run this before the live match betting and points betting rollbacks.
BEGIN;

DROP FUNCTION IF EXISTS public.buy_sabotage(uuid,uuid,uuid,text,integer,integer);
DROP TABLE IF EXISTS public.sabotages;
DROP TABLE IF EXISTS public.sabotage_items;

DO $$ BEGIN
    IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
        DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261117120000' OR name = 'sabotage_shop';
    END IF;
END $$;

COMMIT;
