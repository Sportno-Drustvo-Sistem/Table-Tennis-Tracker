-- Live score for every phone, and bets placed from any phone.
-- Purely additive on top of 20261112120000_points_betting.sql: one table and
-- three functions. Nothing existing is altered, so
-- supabase/rollbacks/20261116120000_live_match_betting_down.sql removes it all.
-- See docs/points-betting.md.
BEGIN;

-- The umpire phone publishes the state of its live match here after every
-- point. The id is the match's bet market id (the market row itself still
-- appears with the first bet). Other phones read it to show the score, and
-- place_live_bet prices bets from it, so a bettor cannot choose their odds.
CREATE TABLE public.live_matches (
    id uuid PRIMARY KEY,
    player1_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    player2_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    best_of smallint NOT NULL DEFAULT 1 CHECK (best_of IN (1,3,5)),
    games1 smallint NOT NULL DEFAULT 0 CHECK (games1 BETWEEN 0 AND 3),
    games2 smallint NOT NULL DEFAULT 0 CHECK (games2 BETWEEN 0 AND 3),
    score1 smallint NOT NULL DEFAULT 0 CHECK (score1 BETWEEN 0 AND 99),
    score2 smallint NOT NULL DEFAULT 0 CHECK (score2 BETWEEN 0 AND 99),
    sets jsonb NOT NULL DEFAULT '[]'::jsonb,
    server smallint CHECK (server IN (1,2)),
    win_probability numeric CHECK (win_probability BETWEEN 0 AND 1),
    betting_closed boolean NOT NULL DEFAULT false,
    winner_side smallint CHECK (winner_side IN (1,2)),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (player1_id <> player2_id)
);

REVOKE ALL ON TABLE public.live_matches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.live_matches TO anon, authenticated;
ALTER TABLE public.live_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY live_matches_public_read ON public.live_matches FOR SELECT TO anon, authenticated USING (true);
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.live_matches;
    END IF;
END $$;

-- p_state: { bestOf, games1, games2, score1, score2, sets: [{s1,s2}], server,
-- winProbability (player 1 wins), bettingClosed, winnerSide }.
CREATE FUNCTION public.publish_live_match(
    p_admin_token text, p_id uuid, p_player1_id uuid, p_player2_id uuid, p_state jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    existing public.live_matches;
    row_out public.live_matches;
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    IF p_id IS NULL THEN RAISE EXCEPTION 'Missing live match id'; END IF;
    IF p_state IS NULL OR jsonb_typeof(p_state) <> 'object' OR length(p_state::text) > 2000 THEN RAISE EXCEPTION 'Invalid live match state'; END IF;
    IF jsonb_typeof(coalesce(p_state -> 'sets', '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Invalid live match sets'; END IF;

    SELECT * INTO existing FROM public.live_matches WHERE id = p_id FOR UPDATE;
    IF existing.id IS NOT NULL AND (existing.player1_id <> p_player1_id OR existing.player2_id <> p_player2_id) THEN
        RAISE EXCEPTION 'Live match belongs to other players';
    END IF;

    -- Matches whose phone went quiet long ago are forgotten.
    DELETE FROM public.live_matches WHERE updated_at < now() - interval '6 hours';

    INSERT INTO public.live_matches AS l (id, player1_id, player2_id, best_of, games1, games2, score1, score2, sets, server, win_probability, betting_closed, winner_side, updated_at)
    VALUES (
        p_id, p_player1_id, p_player2_id,
        coalesce((p_state ->> 'bestOf')::smallint, 1),
        coalesce((p_state ->> 'games1')::smallint, 0),
        coalesce((p_state ->> 'games2')::smallint, 0),
        coalesce((p_state ->> 'score1')::smallint, 0),
        coalesce((p_state ->> 'score2')::smallint, 0),
        coalesce(p_state -> 'sets', '[]'::jsonb),
        (p_state ->> 'server')::smallint,
        round((p_state ->> 'winProbability')::numeric, 4),
        coalesce((p_state ->> 'bettingClosed')::boolean, false),
        (p_state ->> 'winnerSide')::smallint,
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        best_of = excluded.best_of, games1 = excluded.games1, games2 = excluded.games2,
        score1 = excluded.score1, score2 = excluded.score2, sets = excluded.sets,
        server = excluded.server, win_probability = excluded.win_probability,
        betting_closed = excluded.betting_closed, winner_side = excluded.winner_side,
        updated_at = now()
    RETURNING * INTO row_out;
    RETURN to_jsonb(row_out);
END $$;

-- The umpire left the match screen (saved, discarded or rematch). Bets still
-- open on it are refunded, as void_bet_market does.
CREATE FUNCTION public.end_live_match(p_admin_token text, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM pg_advisory_xact_lock(hashtext('points_betting'));
    DELETE FROM public.live_matches WHERE id = p_id;
    IF EXISTS (SELECT 1 FROM public.bet_markets WHERE id = p_id AND status = 'open') THEN
        -- An open market has no linked matches, so settling it refunds everything.
        PERFORM private.settle_bet_market(p_id);
    END IF;
    RETURN jsonb_build_object('deleted', p_id) || private.bet_market_state(p_id);
END $$;

-- A bet from any phone, no admin PIN. The odds come from the live match row,
-- not from the caller; p_expected_multiplier is what the bettor saw, and the
-- bet is refused if a point has moved the odds since.
CREATE FUNCTION public.place_live_bet(
    p_market_id uuid, p_user_id uuid, p_side integer, p_stake integer, p_expected_multiplier numeric
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    live public.live_matches;
    m public.bet_markets;
    wallet public.bet_wallets;
    bet public.bets;
    probability numeric;
    multiplier numeric;
BEGIN
    IF p_side IS NULL OR p_side NOT IN (1,2) THEN RAISE EXCEPTION 'Pick a side to bet on'; END IF;
    IF p_stake IS NULL OR p_stake < 1 THEN RAISE EXCEPTION 'Stake must be at least 1 point'; END IF;

    PERFORM pg_advisory_xact_lock(hashtext('points_betting'));

    SELECT * INTO live FROM public.live_matches WHERE id = p_market_id;
    IF live.id IS NULL OR live.updated_at < now() - interval '20 minutes' THEN RAISE EXCEPTION 'This match is not live any more'; END IF;
    IF live.betting_closed OR live.winner_side IS NOT NULL THEN RAISE EXCEPTION 'Betting is closed for this match'; END IF;
    IF live.win_probability IS NULL THEN RAISE EXCEPTION 'Odds are not ready yet'; END IF;

    probability := least(0.99, greatest(0.01, CASE WHEN p_side = 1 THEN live.win_probability ELSE 1 - live.win_probability END));
    multiplier := private.bet_multiplier(probability);
    IF p_expected_multiplier IS NOT NULL AND abs(p_expected_multiplier - multiplier) > 0.011 THEN
        RAISE EXCEPTION 'Odds changed to %×, try again', multiplier;
    END IF;

    SELECT * INTO m FROM public.bet_markets WHERE id = p_market_id FOR UPDATE;
    IF m.id IS NULL THEN
        INSERT INTO public.bet_markets(id, player1_id, player2_id) VALUES (p_market_id, live.player1_id, live.player2_id) RETURNING * INTO m;
    ELSIF m.status <> 'open' THEN RAISE EXCEPTION 'Betting is closed for this match';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN RAISE EXCEPTION 'Player not found'; END IF;
    IF (p_user_id = m.player1_id AND p_side <> 1) OR (p_user_id = m.player2_id AND p_side <> 2) THEN
        RAISE EXCEPTION 'Players in the match can only bet on themselves';
    END IF;

    INSERT INTO public.bet_wallets(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO wallet FROM public.bet_wallets WHERE user_id = p_user_id FOR UPDATE;
    IF wallet.balance < p_stake THEN RAISE EXCEPTION 'Not enough points (balance %)', wallet.balance; END IF;

    UPDATE public.bet_wallets SET balance = balance - p_stake, updated_at = now() WHERE user_id = p_user_id RETURNING * INTO wallet;
    INSERT INTO public.bets(market_id, user_id, side, stake, win_probability, multiplier, snapshot)
    VALUES (p_market_id, p_user_id, p_side, p_stake, probability, multiplier,
        jsonb_build_object('bestOf', live.best_of, 'games1', live.games1, 'games2', live.games2, 'score1', live.score1, 'score2', live.score2))
    RETURNING * INTO bet;

    RETURN jsonb_build_object('market', to_jsonb(m), 'bet', to_jsonb(bet), 'wallet', to_jsonb(wallet));
END $$;

REVOKE ALL ON FUNCTION public.publish_live_match(text,uuid,uuid,uuid,jsonb), public.end_live_match(text,uuid), public.place_live_bet(uuid,uuid,integer,integer,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_live_match(text,uuid,uuid,uuid,jsonb), public.end_live_match(text,uuid), public.place_live_bet(uuid,uuid,integer,integer,numeric) TO anon, authenticated;

COMMIT;
