-- Reverses supabase/migrations/20261116120000_live_match_betting.sql.
-- Removes the shared live score and betting from other phones. Bets, wallets
-- and markets stay; betting on the umpire phone keeps working.
-- Run this before 20261112120000_points_betting_down.sql when removing both.
BEGIN;

DROP FUNCTION IF EXISTS public.place_live_bet(uuid,uuid,integer,integer,numeric);
DROP FUNCTION IF EXISTS public.end_live_match(text,uuid);
DROP FUNCTION IF EXISTS public.publish_live_match(text,uuid,uuid,uuid,jsonb);
DROP TABLE IF EXISTS public.live_matches;

DO $$ BEGIN
    IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
        DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261116120000' OR name = 'live_match_betting';
    END IF;
END $$;

COMMIT;
