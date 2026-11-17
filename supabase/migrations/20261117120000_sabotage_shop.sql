-- Sabotage shop: spend betting points to put a debuff on a player in a live
-- ping pong match for a number of points ("play to one half of the table for
-- the next 3 points"). The points go straight to the debuffed player's wallet.
-- Debuffs are only shown on the scoreboards: match saving, results and ELO are
-- untouched.
-- Purely additive on top of 20261116120000_live_match_betting.sql: two tables
-- and one function, so supabase/rollbacks/20261117120000_sabotage_shop_down.sql
-- removes it all. See docs/points-betting.md.
BEGIN;

-- What the shop sells. Price is per point the debuff lasts.
CREATE TABLE public.sabotage_items (
    id text PRIMARY KEY,
    title text NOT NULL,
    description text NOT NULL,
    price_per_point integer NOT NULL CHECK (price_per_point > 0),
    max_points smallint NOT NULL DEFAULT 5 CHECK (max_points BETWEEN 1 AND 11),
    sort_order smallint NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true
);

INSERT INTO public.sabotage_items (id, title, description, price_per_point, max_points, sort_order) VALUES
    ('half_table',   'Half table',     'Every return must land on one half of the table (the opponent calls which).', 30, 5, 1),
    ('forehand',     'Forehand only',  'No backhand shots at all.',                                                  25, 5, 2),
    ('wrong_hand',   'Wrong hand',     'Play with the non-dominant hand.',                                           60, 3, 3),
    ('no_smash',     'Pillow fight',   'Soft returns only: no smashes, no loops.',                                   20, 5, 4),
    ('step_back',    'Long distance',  'Stay two steps behind the end line.',                                        35, 5, 5),
    ('underarm',     'Granny serve',   'Serve underarm from below the waist.',                                       10, 5, 6),
    ('stand_still',  'Statue',         'Feet stay planted: no stepping while the ball is in play.',                  45, 3, 7);

-- One row per purchase. live_match_id is the live match (and bet market) id;
-- it is not a foreign key because live rows are removed when the match ends,
-- and the purchase stays as history. Points are counted across the whole
-- match: the debuff is on from start_point (points played when it starts)
-- until end_point.
CREATE TABLE public.sabotages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    live_match_id uuid NOT NULL,
    player1_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    player2_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    buyer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    item_id text NOT NULL REFERENCES public.sabotage_items(id),
    title text NOT NULL,
    description text NOT NULL,
    points smallint NOT NULL CHECK (points > 0),
    price integer NOT NULL CHECK (price > 0),
    start_point integer NOT NULL CHECK (start_point >= 0),
    end_point integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (buyer_id <> target_id),
    CHECK (end_point = start_point + points)
);
CREATE INDEX sabotages_live_match_id_idx ON public.sabotages(live_match_id);

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['sabotage_items','sabotages'] LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
        EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', t);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY sabotage_public_read ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sabotages;
    END IF;
END $$;

-- A purchase from any phone, no admin PIN, like place_live_bet. The price
-- comes from the shop table; p_expected_price is what the buyer saw. A debuff
-- on a player who already has one queues after it. The buyer keeps at least
-- one point, so nobody is left with an empty wallet that never restarts.
CREATE FUNCTION public.buy_sabotage(
    p_live_match_id uuid, p_buyer_id uuid, p_target_id uuid, p_item_id text, p_points integer, p_expected_price integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    live public.live_matches;
    item public.sabotage_items;
    buyer_wallet public.bet_wallets;
    target_wallet public.bet_wallets;
    s public.sabotages;
    played integer;
    starts integer;
    cost integer;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('points_betting'));

    SELECT * INTO live FROM public.live_matches WHERE id = p_live_match_id;
    IF live.id IS NULL OR live.updated_at < now() - interval '20 minutes' THEN RAISE EXCEPTION 'This match is not live any more'; END IF;
    IF live.winner_side IS NOT NULL THEN RAISE EXCEPTION 'This match is over'; END IF;

    IF p_target_id IS NULL OR p_target_id NOT IN (live.player1_id, live.player2_id) THEN RAISE EXCEPTION 'Pick a player in this match'; END IF;
    IF p_buyer_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_buyer_id) THEN RAISE EXCEPTION 'Player not found'; END IF;
    IF p_buyer_id = p_target_id THEN RAISE EXCEPTION 'You cannot debuff yourself'; END IF;

    SELECT * INTO item FROM public.sabotage_items WHERE id = p_item_id AND is_active;
    IF item.id IS NULL THEN RAISE EXCEPTION 'That debuff is not for sale'; END IF;
    IF p_points IS NULL OR p_points < 1 OR p_points > item.max_points THEN RAISE EXCEPTION 'Pick 1 to % points', item.max_points; END IF;
    cost := item.price_per_point * p_points;
    IF p_expected_price IS NOT NULL AND p_expected_price <> cost THEN RAISE EXCEPTION 'The price changed to %, try again', cost; END IF;

    played := live.score1 + live.score2 + coalesce((
        SELECT sum(coalesce((set_row ->> 's1')::integer, 0) + coalesce((set_row ->> 's2')::integer, 0))
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(live.sets) = 'array' THEN live.sets ELSE '[]'::jsonb END) AS set_row
    ), 0);
    starts := greatest(played, coalesce((
        SELECT max(end_point) FROM public.sabotages WHERE live_match_id = live.id AND target_id = p_target_id
    ), 0));
    IF starts - played >= 10 THEN RAISE EXCEPTION 'That player already has 10 points of debuffs lined up'; END IF;

    INSERT INTO public.bet_wallets(user_id) VALUES (p_buyer_id), (p_target_id) ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO buyer_wallet FROM public.bet_wallets WHERE user_id = p_buyer_id FOR UPDATE;
    IF buyer_wallet.balance <= cost THEN RAISE EXCEPTION 'Not enough points (balance %, keep at least 1)', buyer_wallet.balance; END IF;

    UPDATE public.bet_wallets SET balance = balance - cost, updated_at = now() WHERE user_id = p_buyer_id RETURNING * INTO buyer_wallet;
    UPDATE public.bet_wallets SET balance = balance + cost, updated_at = now() WHERE user_id = p_target_id RETURNING * INTO target_wallet;

    INSERT INTO public.sabotages(live_match_id, player1_id, player2_id, buyer_id, target_id, item_id, title, description, points, price, start_point, end_point)
    VALUES (live.id, live.player1_id, live.player2_id, p_buyer_id, p_target_id, item.id, item.title, item.description, p_points, cost, starts, starts + p_points)
    RETURNING * INTO s;

    RETURN jsonb_build_object('sabotage', to_jsonb(s), 'wallets', jsonb_build_array(to_jsonb(buyer_wallet), to_jsonb(target_wallet)));
END $$;

REVOKE ALL ON FUNCTION public.buy_sabotage(uuid,uuid,uuid,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buy_sabotage(uuid,uuid,uuid,text,integer,integer) TO anon, authenticated;

COMMIT;
