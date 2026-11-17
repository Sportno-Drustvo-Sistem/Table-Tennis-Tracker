-- Reverses supabase/migrations/20261117120000_sabotage_shop.sql and
-- 20261117130000_sabotage_menu_update.sql and
-- 20261117140000_sabotage_round_prices.sql.
-- Removes the sabotage shop and its purchase history. Points already paid to
-- debuffed players stay in their wallets; bets and live matches are untouched.
-- Run this before the live match betting and points betting rollbacks.
BEGIN;

DROP FUNCTION IF EXISTS public.buy_sabotage(uuid,uuid,uuid,text,integer,integer);
DROP TABLE IF EXISTS public.sabotages;
DROP TABLE IF EXISTS public.sabotage_items;

DO $$ BEGIN
    IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
        DELETE FROM supabase_migrations.schema_migrations WHERE version IN ('20261117120000','20261117130000','20261117140000') OR name IN ('sabotage_shop','sabotage_menu_update','sabotage_round_prices');
    END IF;
END $$;

COMMIT;
