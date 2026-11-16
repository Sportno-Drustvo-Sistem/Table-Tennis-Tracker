-- Archive the existing league and open Season 2 atomically. No match is deleted.
SELECT pg_advisory_xact_lock(hashtext('pingpong_stats'));
LOCK TABLE public.matches, public.users, public.tournaments IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE public.pingpong_seasons (
    id integer PRIMARY KEY,
    name text NOT NULL UNIQUE,
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    is_active boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX pingpong_one_active_season ON public.pingpong_seasons (is_active) WHERE is_active;
INSERT INTO public.pingpong_seasons (id, name, started_at, ended_at, is_active)
VALUES (1, 'Season 1', coalesce((SELECT min(created_at) FROM public.matches), now()), now(), false),
       (2, 'Season 2', now(), NULL, true);

CREATE TABLE public.pingpong_season_snapshots (
    season_id integer NOT NULL REFERENCES public.pingpong_seasons(id),
    user_id uuid NOT NULL,
    player jsonb NOT NULL,
    PRIMARY KEY (season_id, user_id)
);
-- Preserve the exact final standings, including player identity, before resetting.
INSERT INTO public.pingpong_season_snapshots (season_id, user_id, player)
SELECT 1, id, to_jsonb(u) FROM public.users u;

ALTER TABLE public.pingpong_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pingpong_season_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pingpong_seasons, public.pingpong_season_snapshots FROM anon, authenticated;
GRANT SELECT ON public.pingpong_seasons, public.pingpong_season_snapshots TO anon, authenticated;
CREATE POLICY "Public season history" ON public.pingpong_seasons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public season standings" ON public.pingpong_season_snapshots FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.matches ADD COLUMN season_id integer REFERENCES public.pingpong_seasons(id);
UPDATE public.matches SET season_id = 1;
ALTER TABLE public.matches ALTER COLUMN season_id SET NOT NULL;
CREATE INDEX matches_season_history_idx ON public.matches (season_id, created_at, id);
ALTER TABLE public.tournaments ADD COLUMN season_id integer REFERENCES public.pingpong_seasons(id);
UPDATE public.tournaments SET season_id = 1;
ALTER TABLE public.tournaments ALTER COLUMN season_id SET NOT NULL;

CREATE FUNCTION public.assign_pingpong_season()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('pingpong_stats'));
    SELECT id INTO STRICT NEW.season_id FROM public.pingpong_seasons WHERE is_active;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_pingpong_season() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER assign_match_season BEFORE INSERT ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.assign_pingpong_season();
CREATE TRIGGER assign_tournament_season BEFORE INSERT ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.assign_pingpong_season();

CREATE FUNCTION public.protect_pingpong_archive()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('pingpong_stats'));
    IF NOT EXISTS (SELECT 1 FROM public.pingpong_seasons WHERE id = OLD.season_id AND is_active) THEN
        RAISE EXCEPTION 'Archived season matches cannot be changed';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.season_id IS DISTINCT FROM OLD.season_id THEN
        RAISE EXCEPTION 'A match cannot be moved to another season';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_pingpong_archive() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_match_archive BEFORE UPDATE OR DELETE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.protect_pingpong_archive();

CREATE OR REPLACE FUNCTION public.recalculate_pingpong_stats()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    match_row record;
    p1_elo integer;
    p2_elo integer;
    p1_change integer;
    p2_change integer;
    p1_bonus integer;
    p2_bonus integer;
BEGIN
    DROP TABLE IF EXISTS pg_temp._pingpong_stat_recalc;
    CREATE TEMP TABLE _pingpong_stat_recalc ON COMMIT DROP AS
        SELECT id AS user_id, 1200::integer AS elo_rating, 0::integer AS matches_played, 0::integer AS total_wins
        FROM public.users;

    FOR match_row IN
        SELECT id, player1_id, player2_id, score1, score2, handicap_rule, created_at
        FROM public.matches WHERE season_id = (SELECT id FROM public.pingpong_seasons WHERE is_active)
        ORDER BY created_at ASC, id ASC
    LOOP
        SELECT elo_rating INTO p1_elo FROM pg_temp._pingpong_stat_recalc WHERE user_id = match_row.player1_id;
        IF NOT FOUND THEN
            CONTINUE;
        END IF;

        SELECT elo_rating INTO p2_elo FROM pg_temp._pingpong_stat_recalc WHERE user_id = match_row.player2_id;
        IF NOT FOUND THEN
            CONTINUE;
        END IF;

        p1_change := public.app_calculate_elo_change(p1_elo, p2_elo, match_row.score1, match_row.score2);
        p2_change := public.app_calculate_elo_change(p2_elo, p1_elo, match_row.score2, match_row.score1);
        p1_bonus := public.app_streak_bonus(match_row.handicap_rule, match_row.player1_id, match_row.score1 > match_row.score2);
        p2_bonus := public.app_streak_bonus(match_row.handicap_rule, match_row.player2_id, match_row.score2 > match_row.score1);

        UPDATE pg_temp._pingpong_stat_recalc
        SET
            elo_rating = elo_rating + p1_change + p1_bonus,
            matches_played = matches_played + 1,
            total_wins = total_wins + CASE WHEN match_row.score1 > match_row.score2 THEN 1 ELSE 0 END
        WHERE user_id = match_row.player1_id;

        UPDATE pg_temp._pingpong_stat_recalc
        SET
            elo_rating = elo_rating + p2_change + p2_bonus,
            matches_played = matches_played + 1,
            total_wins = total_wins + CASE WHEN match_row.score2 > match_row.score1 THEN 1 ELSE 0 END
        WHERE user_id = match_row.player2_id;
    END LOOP;

    UPDATE public.users u
    SET
        elo_rating = s.elo_rating,
        matches_played = s.matches_played,
        total_wins = s.total_wins,
        is_ranked = s.matches_played >= 10
    FROM pg_temp._pingpong_stat_recalc s
    WHERE u.id = s.user_id;
END;
$$;

-- The existing recording/deletion RPCs now recalculate only the active season.
SELECT public.recalculate_pingpong_stats();

CREATE FUNCTION public.refresh_pingpong_stats(p_admin_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM pg_advisory_xact_lock(hashtext('pingpong_stats'));
    PERFORM public.recalculate_pingpong_stats();
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_pingpong_stats(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_pingpong_stats(text) TO anon, authenticated;

CREATE FUNCTION public.update_pingpong_match(p_admin_token text, p_match_id uuid, p_score1 integer, p_score2 integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM pg_advisory_xact_lock(hashtext('pingpong_stats'));
    IF p_score1 IS NULL OR p_score2 IS NULL OR p_score1 < 0 OR p_score2 < 0 OR p_score1 = p_score2 THEN
        RAISE EXCEPTION 'Enter non-negative scores with a winner';
    END IF;
    UPDATE public.matches SET score1 = p_score1, score2 = p_score2 WHERE id = p_match_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
    PERFORM public.recalculate_pingpong_stats();
END;
$$;
REVOKE ALL ON FUNCTION public.update_pingpong_match(text, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_pingpong_match(text, uuid, integer, integer) TO anon, authenticated;
