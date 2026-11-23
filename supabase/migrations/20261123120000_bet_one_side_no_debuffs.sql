-- Two betting rules, on top of 20261112120000_points_betting.sql and
-- 20261116120000_live_match_betting.sql:
-- 1. A bettor backs one player per match: once they have a bet on one side,
--    bets on the other side are refused (more on the same side are fine).
-- 2. No bets on a match played under a debuff. The umpire phone knows which
--    debuffs were accepted (the same ones that go into the match's
--    handicap_rule and its Elo bonus) and publishes `debuffed` with the score.
-- The rollbacks of those two migrations drop everything changed here.
BEGIN;

ALTER TABLE public.live_matches ADD COLUMN debuffed boolean NOT NULL DEFAULT false;

-- p_state: { bestOf, games1, games2, score1, score2, sets: [{s1,s2}], server,
-- winProbability (player 1 wins), bettingClosed, winnerSide, debuffed }.
CREATE OR REPLACE FUNCTION public.publish_live_match(
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

    INSERT INTO public.live_matches AS l (id, player1_id, player2_id, best_of, games1, games2, score1, score2, sets, server, win_probability, betting_closed, winner_side, debuffed, updated_at)
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
        coalesce((p_state ->> 'debuffed')::boolean, false),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        best_of = excluded.best_of, games1 = excluded.games1, games2 = excluded.games2,
        score1 = excluded.score1, score2 = excluded.score2, sets = excluded.sets,
        server = excluded.server, win_probability = excluded.win_probability,
        betting_closed = excluded.betting_closed, winner_side = excluded.winner_side,
        debuffed = excluded.debuffed,
        updated_at = now()
    RETURNING * INTO row_out;
    RETURN to_jsonb(row_out);
END $$;

-- Refuses a bet on the side opposite one the bettor already backs in this market.
CREATE OR REPLACE FUNCTION private.require_one_bet_side(p_market_id uuid, p_user_id uuid, p_side integer)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.bets WHERE market_id = p_market_id AND user_id = p_user_id AND status = 'pending' AND side <> p_side) THEN
        RAISE EXCEPTION 'You can only back one player per match';
    END IF;
END $$;
REVOKE ALL ON FUNCTION private.require_one_bet_side(uuid,uuid,integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.place_live_bet(
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
    IF live.debuffed THEN RAISE EXCEPTION 'No betting on a match with a debuff'; END IF;
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
    PERFORM private.require_one_bet_side(p_market_id, p_user_id, p_side);

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

CREATE OR REPLACE FUNCTION public.place_bet(
    p_admin_token text, p_market_id uuid, p_player1_id uuid, p_player2_id uuid,
    p_user_id uuid, p_side integer, p_stake integer, p_win_probability numeric,
    p_snapshot jsonb DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    m public.bet_markets;
    wallet public.bet_wallets;
    bet public.bets;
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    IF p_market_id IS NULL THEN RAISE EXCEPTION 'Missing bet market'; END IF;
    IF p_side IS NULL OR p_side NOT IN (1,2) THEN RAISE EXCEPTION 'Pick a side to bet on'; END IF;
    IF p_stake IS NULL OR p_stake < 1 THEN RAISE EXCEPTION 'Stake must be at least 1 point'; END IF;
    IF p_win_probability IS NULL OR p_win_probability < 0.01 OR p_win_probability > 0.99 THEN RAISE EXCEPTION 'Invalid win probability'; END IF;
    IF p_snapshot IS NOT NULL AND (jsonb_typeof(p_snapshot) <> 'object' OR length(p_snapshot::text) > 500) THEN RAISE EXCEPTION 'Invalid score snapshot'; END IF;

    PERFORM pg_advisory_xact_lock(hashtext('points_betting'));

    -- live_matches is gone after the live betting rollback; umpire bets still work then.
    IF to_regclass('public.live_matches') IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.live_matches WHERE id = p_market_id AND debuffed) THEN
            RAISE EXCEPTION 'No betting on a match with a debuff';
        END IF;
    END IF;

    SELECT * INTO m FROM public.bet_markets WHERE id = p_market_id FOR UPDATE;
    IF m.id IS NULL THEN
        IF p_player1_id = p_player2_id OR (SELECT count(*) FROM public.users WHERE id IN (p_player1_id, p_player2_id)) <> 2 THEN
            RAISE EXCEPTION 'Match players not found';
        END IF;
        INSERT INTO public.bet_markets(id, player1_id, player2_id) VALUES (p_market_id, p_player1_id, p_player2_id) RETURNING * INTO m;
    ELSIF m.status <> 'open' THEN RAISE EXCEPTION 'Betting is closed for this match';
    ELSIF m.player1_id <> p_player1_id OR m.player2_id <> p_player2_id THEN RAISE EXCEPTION 'Bet market belongs to another match';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN RAISE EXCEPTION 'Player not found'; END IF;
    IF (p_user_id = m.player1_id AND p_side <> 1) OR (p_user_id = m.player2_id AND p_side <> 2) THEN
        RAISE EXCEPTION 'Players in the match can only bet on themselves';
    END IF;
    PERFORM private.require_one_bet_side(p_market_id, p_user_id, p_side);

    INSERT INTO public.bet_wallets(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO wallet FROM public.bet_wallets WHERE user_id = p_user_id FOR UPDATE;
    IF wallet.balance < p_stake THEN RAISE EXCEPTION 'Not enough points (balance %)', wallet.balance; END IF;

    UPDATE public.bet_wallets SET balance = balance - p_stake, updated_at = now() WHERE user_id = p_user_id RETURNING * INTO wallet;
    INSERT INTO public.bets(market_id, user_id, side, stake, win_probability, multiplier, snapshot)
    VALUES (p_market_id, p_user_id, p_side, p_stake, p_win_probability, private.bet_multiplier(p_win_probability), p_snapshot)
    RETURNING * INTO bet;

    RETURN jsonb_build_object('market', to_jsonb(m), 'bet', to_jsonb(bet), 'wallet', to_jsonb(wallet));
END $$;

COMMIT;
