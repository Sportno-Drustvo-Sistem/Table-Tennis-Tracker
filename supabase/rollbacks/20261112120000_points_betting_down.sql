-- Reverses supabase/migrations/20261112120000_points_betting.sql.
-- Deletes ALL betting data (wallets, markets, bets). Matches, players and ELO
-- are not touched. Deliberately kept outside supabase/migrations so the CLI
-- never applies it by itself. See docs/points-betting.md.
BEGIN;

DROP TRIGGER IF EXISTS resettle_bets_after_match_change ON public.matches;

DROP FUNCTION IF EXISTS public.record_pingpong_match_with_bets(text,uuid,uuid,uuid,jsonb,jsonb);
DROP FUNCTION IF EXISTS public.void_bet_market(text,uuid);
DROP FUNCTION IF EXISTS public.cancel_bet(text,uuid);
DROP FUNCTION IF EXISTS public.place_bet(text,uuid,uuid,uuid,uuid,integer,integer,numeric,jsonb);
DROP FUNCTION IF EXISTS private.resettle_bets_for_match();
DROP FUNCTION IF EXISTS private.bet_market_state(uuid);
DROP FUNCTION IF EXISTS private.settle_bet_market(uuid);
DROP FUNCTION IF EXISTS private.bet_multiplier(numeric);

-- Dropping a table also removes it from the realtime publication, its
-- policies, grants and indexes.
DROP TABLE IF EXISTS public.bets;
DROP TABLE IF EXISTS public.bet_markets;
DROP TABLE IF EXISTS public.bet_wallets;

-- Forget the migration so it can be applied again later. Matched by name too:
-- the hosted project recorded it as version 20261112132310.
DO $$ BEGIN
    IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
        DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261112120000' OR name = 'points_betting';
    END IF;
END $$;

COMMIT;
