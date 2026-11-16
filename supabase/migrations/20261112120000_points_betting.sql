-- Points betting on live ping pong matches (no real money).
-- Purely additive: three tables, their functions and one trigger on
-- public.matches. No existing table, function or policy is altered, so
-- supabase/rollbacks/20261112120000_points_betting_down.sql removes it all.
-- See docs/points-betting.md.
BEGIN;

CREATE TABLE public.bet_wallets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    balance integer NOT NULL DEFAULT 1000,
    rebuys integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- One market per live match. The id is chosen by the umpire phone when the
-- match screen opens; the row appears with the first bet.
CREATE TABLE public.bet_markets (
    id uuid PRIMARY KEY,
    player1_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    player2_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled','void')),
    winner_side smallint CHECK (winner_side IN (1,2)),
    match_ids uuid[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    settled_at timestamptz,
    CHECK (player1_id <> player2_id)
);

CREATE TABLE public.bets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id uuid NOT NULL REFERENCES public.bet_markets(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    side smallint NOT NULL CHECK (side IN (1,2)),
    stake integer NOT NULL CHECK (stake > 0),
    win_probability numeric NOT NULL,
    multiplier numeric(6,2) NOT NULL,
    snapshot jsonb,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','won','lost','void')),
    payout integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bets_market_id_idx ON public.bets(market_id);
CREATE INDEX bets_user_id_idx ON public.bets(user_id);
CREATE INDEX bet_markets_match_ids_idx ON public.bet_markets USING gin(match_ids);

-- Same exposure as every other table: public read, writes only through the
-- admin-session functions below.
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['bet_wallets','bet_markets','bets'] LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
        EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', t);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY betting_public_read ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bet_wallets, public.bet_markets, public.bets;
    END IF;
END $$;

-- Payout multiplier for backing a side that wins with probability p.
CREATE FUNCTION private.bet_multiplier(p numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT round(least(10, greatest(1.05, 1 / p)), 2);
$$;

-- Pays out, re-pays or refunds one market from its linked match rows. Safe to
-- run again: a previous payout is taken back first.
CREATE FUNCTION private.settle_bet_market(p_market_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    m public.bet_markets;
    found_rows integer;
    sets1 integer;
    sets2 integer;
    winner smallint;
BEGIN
    SELECT * INTO m FROM public.bet_markets WHERE id = p_market_id FOR UPDATE;
    IF m.id IS NULL OR m.status = 'void' THEN RETURN; END IF;

    UPDATE public.bet_wallets w SET balance = w.balance - s.total, updated_at = now()
    FROM (SELECT user_id, sum(payout) AS total FROM public.bets
          WHERE market_id = p_market_id AND status = 'won' GROUP BY user_id) s
    WHERE w.user_id = s.user_id;
    UPDATE public.bets SET status = 'pending', payout = 0
    WHERE market_id = p_market_id AND status IN ('won','lost');

    SELECT count(*),
        count(*) FILTER (WHERE (player1_id = m.player1_id AND score1 > score2) OR (player1_id = m.player2_id AND score2 > score1)),
        count(*) FILTER (WHERE (player1_id = m.player2_id AND score1 > score2) OR (player1_id = m.player1_id AND score2 > score1))
    INTO found_rows, sets1, sets2
    FROM public.matches WHERE id = ANY(m.match_ids);

    IF cardinality(m.match_ids) > 0 AND found_rows = cardinality(m.match_ids) AND sets1 <> sets2 THEN
        winner := CASE WHEN sets1 > sets2 THEN 1 ELSE 2 END;
    END IF;

    IF winner IS NULL THEN
        -- No result to pay on (match never saved, or deleted later): stakes go back.
        UPDATE public.bet_wallets w SET balance = w.balance + s.total, updated_at = now()
        FROM (SELECT user_id, sum(stake) AS total FROM public.bets
              WHERE market_id = p_market_id AND status = 'pending' GROUP BY user_id) s
        WHERE w.user_id = s.user_id;
        UPDATE public.bets SET status = 'void', payout = 0 WHERE market_id = p_market_id AND status = 'pending';
        UPDATE public.bet_markets SET status = 'void', winner_side = NULL, settled_at = now() WHERE id = p_market_id;
    ELSE
        UPDATE public.bets
        SET status = CASE WHEN side = winner THEN 'won' ELSE 'lost' END,
            payout = CASE WHEN side = winner THEN round(stake * multiplier)::integer ELSE 0 END
        WHERE market_id = p_market_id AND status = 'pending';
        UPDATE public.bet_wallets w SET balance = w.balance + s.total, updated_at = now()
        FROM (SELECT user_id, sum(payout) AS total FROM public.bets
              WHERE market_id = p_market_id AND status = 'won' GROUP BY user_id) s
        WHERE w.user_id = s.user_id;
        UPDATE public.bet_markets SET status = 'settled', winner_side = winner, settled_at = now() WHERE id = p_market_id;
    END IF;

    -- Nobody stays broke: an empty wallet with nothing still riding restarts at 100.
    UPDATE public.bet_wallets w SET balance = 100, rebuys = w.rebuys + 1, updated_at = now()
    WHERE w.balance <= 0
        AND w.user_id IN (SELECT user_id FROM public.bets WHERE market_id = p_market_id)
        AND NOT EXISTS (SELECT 1 FROM public.bets b WHERE b.user_id = w.user_id AND b.status = 'pending');
END $$;

CREATE FUNCTION private.bet_market_state(p_market_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT jsonb_build_object(
        'market', (SELECT to_jsonb(m) FROM public.bet_markets m WHERE m.id = p_market_id),
        'bets', coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.created_at) FROM public.bets b WHERE b.market_id = p_market_id), '[]'::jsonb),
        'wallets', coalesce((SELECT jsonb_agg(to_jsonb(w)) FROM public.bet_wallets w
            WHERE w.user_id IN (SELECT user_id FROM public.bets WHERE market_id = p_market_id)), '[]'::jsonb)
    );
$$;

-- p_win_probability is the chance, at the moment of the bet, that the backed
-- side wins. The umpire phone computes it (src/winProbability.js); the server
-- only range-checks it and derives the multiplier itself.
CREATE FUNCTION public.place_bet(
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

    INSERT INTO public.bet_wallets(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO wallet FROM public.bet_wallets WHERE user_id = p_user_id FOR UPDATE;
    IF wallet.balance < p_stake THEN RAISE EXCEPTION 'Not enough points (balance %)', wallet.balance; END IF;

    UPDATE public.bet_wallets SET balance = balance - p_stake, updated_at = now() WHERE user_id = p_user_id RETURNING * INTO wallet;
    INSERT INTO public.bets(market_id, user_id, side, stake, win_probability, multiplier, snapshot)
    VALUES (p_market_id, p_user_id, p_side, p_stake, p_win_probability, private.bet_multiplier(p_win_probability), p_snapshot)
    RETURNING * INTO bet;

    RETURN jsonb_build_object('market', to_jsonb(m), 'bet', to_jsonb(bet), 'wallet', to_jsonb(wallet));
END $$;

-- Takes back a mis-tapped bet while the match is still being played.
CREATE FUNCTION public.cancel_bet(p_admin_token text, p_bet_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    bet public.bets;
    wallet public.bet_wallets;
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM pg_advisory_xact_lock(hashtext('points_betting'));
    SELECT b.* INTO bet FROM public.bets b JOIN public.bet_markets m ON m.id = b.market_id
    WHERE b.id = p_bet_id AND b.status = 'pending' AND m.status = 'open';
    IF bet.id IS NULL THEN RAISE EXCEPTION 'This bet can no longer be removed'; END IF;
    DELETE FROM public.bets WHERE id = p_bet_id;
    UPDATE public.bet_wallets SET balance = balance + bet.stake, updated_at = now() WHERE user_id = bet.user_id RETURNING * INTO wallet;
    RETURN jsonb_build_object('deleted', bet.id, 'wallet', to_jsonb(wallet));
END $$;

-- Refunds every bet of a match that will not be saved.
CREATE FUNCTION public.void_bet_market(p_admin_token text, p_market_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM pg_advisory_xact_lock(hashtext('points_betting'));
    IF NOT EXISTS (SELECT 1 FROM public.bet_markets WHERE id = p_market_id AND status = 'open') THEN
        RAISE EXCEPTION 'No open bets for this match';
    END IF;
    -- An open market has no linked matches, so settling it refunds everything.
    PERFORM private.settle_bet_market(p_market_id);
    RETURN private.bet_market_state(p_market_id);
END $$;

-- Saves the match and pays its bets in one transaction. The existing
-- record_pingpong_match is untouched and still used when nobody bet.
CREATE FUNCTION public.record_pingpong_match_with_bets(
    p_admin_token text, p_market_id uuid, p_player1_id uuid, p_player2_id uuid,
    p_sets jsonb, p_handicap_rule jsonb DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    m public.bet_markets;
    result jsonb;
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM private.validate_pingpong_sets(p_sets);
    -- Same lock order as the match trigger below: stats first, then betting.
    PERFORM pg_advisory_xact_lock(hashtext('pingpong_stats'));
    PERFORM pg_advisory_xact_lock(hashtext('points_betting'));

    SELECT * INTO m FROM public.bet_markets WHERE id = p_market_id FOR UPDATE;
    IF m.id IS NOT NULL AND (m.status <> 'open' OR m.player1_id <> p_player1_id OR m.player2_id <> p_player2_id) THEN
        RAISE EXCEPTION 'These bets belong to another match or were already settled';
    END IF;

    result := private.record_pingpong_match_impl(p_player1_id, p_player2_id, p_sets, p_handicap_rule, NULL);

    IF m.id IS NULL THEN RETURN result; END IF;
    UPDATE public.bet_markets
    SET match_ids = ARRAY(SELECT (value ->> 'id')::uuid FROM jsonb_array_elements(result -> 'matches'))
    WHERE id = p_market_id;
    PERFORM private.settle_bet_market(p_market_id);
    RETURN result || private.bet_market_state(p_market_id);
END $$;

-- Editing a paid match's score re-pays its bets on the new result; deleting
-- any of its sets refunds them.
CREATE FUNCTION private.resettle_bets_for_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE market_id uuid;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('points_betting'));
    FOR market_id IN SELECT id FROM public.bet_markets WHERE match_ids @> ARRAY[OLD.id] AND status = 'settled' LOOP
        PERFORM private.settle_bet_market(market_id);
    END LOOP;
    RETURN NULL;
END $$;
CREATE TRIGGER resettle_bets_after_match_change
AFTER UPDATE OF score1, score2 OR DELETE ON public.matches
FOR EACH ROW EXECUTE FUNCTION private.resettle_bets_for_match();

REVOKE ALL ON FUNCTION private.bet_multiplier(numeric), private.settle_bet_market(uuid), private.bet_market_state(uuid), private.resettle_bets_for_match() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.place_bet(text,uuid,uuid,uuid,uuid,integer,integer,numeric,jsonb), public.cancel_bet(text,uuid), public.void_bet_market(text,uuid), public.record_pingpong_match_with_bets(text,uuid,uuid,uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_bet(text,uuid,uuid,uuid,uuid,integer,integer,numeric,jsonb), public.cancel_bet(text,uuid), public.void_bet_market(text,uuid), public.record_pingpong_match_with_bets(text,uuid,uuid,uuid,jsonb,jsonb) TO anon, authenticated;

COMMIT;
