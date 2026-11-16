-- Forward scoring fixes; never rewrite matches or archived Ping Pong snapshots.
BEGIN;
CREATE FUNCTION public.app_set_elo_change(p_rating_a numeric, p_rating_b numeric, p_winner integer, p_side integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT CASE WHEN p_winner = 0 THEN 0 ELSE round(32 * (
        CASE WHEN p_winner = p_side THEN 1 ELSE 0 END -
        1 / (1 + power(10::numeric, (p_rating_b - p_rating_a) / 400))
    ))::integer END;
$$;
-- Match weight is always 1 for set sports; legacy rows use game winner at that
-- same weight. No total-game margin can reverse or zero a legitimate set win.
CREATE OR REPLACE FUNCTION public.recalculate_padel_stats()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    match_row record;
    t1p1_elo integer;
    t1p2_elo integer;
    t2p1_elo integer;
    t2p2_elo integer;
    team1_elo numeric;
    team2_elo numeric;
    t1p1_change integer;
    t1p2_change integer;
    t2p1_change integer;
    t2p2_change integer;
    winner integer;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('padel_stats'));
    DROP TABLE IF EXISTS pg_temp._padel_stat_recalc;
    CREATE TEMP TABLE _padel_stat_recalc ON COMMIT DROP AS
        SELECT id AS user_id, 1200::integer AS elo_rating, 0::integer AS matches_played, 0::integer AS total_wins
        FROM public.users;

    FOR match_row IN
        SELECT *
        FROM public.padel_matches
        ORDER BY created_at ASC, id ASC
    LOOP
        SELECT elo_rating INTO t1p1_elo FROM pg_temp._padel_stat_recalc WHERE user_id = match_row.team1_player1_id;
        IF NOT FOUND THEN CONTINUE; END IF;
        SELECT elo_rating INTO t1p2_elo FROM pg_temp._padel_stat_recalc WHERE user_id = match_row.team1_player2_id;
        IF NOT FOUND THEN CONTINUE; END IF;
        SELECT elo_rating INTO t2p1_elo FROM pg_temp._padel_stat_recalc WHERE user_id = match_row.team2_player1_id;
        IF NOT FOUND THEN CONTINUE; END IF;
        SELECT elo_rating INTO t2p2_elo FROM pg_temp._padel_stat_recalc WHERE user_id = match_row.team2_player2_id;
        IF NOT FOUND THEN CONTINUE; END IF;

        winner := public.app_padel_winner(match_row.score1, match_row.score2, match_row.sets_data);
        team1_elo := (t1p1_elo + t1p2_elo) / 2.0;
        team2_elo := (t2p1_elo + t2p2_elo) / 2.0;
        t1p1_change := public.app_set_elo_change(team1_elo, team2_elo, winner, 1);
        t1p2_change := public.app_set_elo_change(team1_elo, team2_elo, winner, 1);
        t2p1_change := public.app_set_elo_change(team2_elo, team1_elo, winner, 2);
        t2p2_change := public.app_set_elo_change(team2_elo, team1_elo, winner, 2);


        UPDATE pg_temp._padel_stat_recalc
        SET
            elo_rating = elo_rating + CASE user_id
                WHEN match_row.team1_player1_id THEN t1p1_change
                WHEN match_row.team1_player2_id THEN t1p2_change
                WHEN match_row.team2_player1_id THEN t2p1_change
                WHEN match_row.team2_player2_id THEN t2p2_change
                ELSE 0
            END,
            matches_played = matches_played + 1,
            total_wins = total_wins + CASE
                WHEN winner = 1 AND user_id IN (match_row.team1_player1_id, match_row.team1_player2_id) THEN 1
                WHEN winner = 2 AND user_id IN (match_row.team2_player1_id, match_row.team2_player2_id) THEN 1
                ELSE 0
            END
        WHERE user_id IN (
            match_row.team1_player1_id,
            match_row.team1_player2_id,
            match_row.team2_player1_id,
            match_row.team2_player2_id
        );
    END LOOP;

    INSERT INTO public.padel_stats (user_id, elo_rating, matches_played, total_wins, is_ranked)
    SELECT user_id, elo_rating, matches_played, total_wins, matches_played >= 10
    FROM pg_temp._padel_stat_recalc
    ON CONFLICT (user_id) DO UPDATE SET
        elo_rating = EXCLUDED.elo_rating,
        matches_played = EXCLUDED.matches_played,
        total_wins = EXCLUDED.total_wins,
        is_ranked = EXCLUDED.is_ranked;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_tennis_stats()
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
    winner integer;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('tennis_stats'));
    DROP TABLE IF EXISTS pg_temp._tennis_stat_recalc;
    CREATE TEMP TABLE _tennis_stat_recalc ON COMMIT DROP AS
        SELECT id AS user_id, 1200::integer AS elo_rating, 0::integer AS matches_played, 0::integer AS total_wins
        FROM public.users;

    FOR match_row IN
        SELECT *
        FROM public.tennis_matches
        ORDER BY created_at ASC, id ASC
    LOOP
        SELECT elo_rating INTO p1_elo FROM pg_temp._tennis_stat_recalc WHERE user_id = match_row.player1_id;
        IF NOT FOUND THEN CONTINUE; END IF;
        SELECT elo_rating INTO p2_elo FROM pg_temp._tennis_stat_recalc WHERE user_id = match_row.player2_id;
        IF NOT FOUND THEN CONTINUE; END IF;

        winner := public.app_tennis_winner(match_row.score1, match_row.score2, match_row.sets_data);
        p1_change := public.app_set_elo_change(p1_elo, p2_elo, winner, 1);
        p2_change := public.app_set_elo_change(p2_elo, p1_elo, winner, 2);


        UPDATE pg_temp._tennis_stat_recalc
        SET
            elo_rating = elo_rating + p1_change,
            matches_played = matches_played + 1,
            total_wins = total_wins + CASE WHEN winner = 1 THEN 1 ELSE 0 END
        WHERE user_id = match_row.player1_id;

        UPDATE pg_temp._tennis_stat_recalc
        SET
            elo_rating = elo_rating + p2_change,
            matches_played = matches_played + 1,
            total_wins = total_wins + CASE WHEN winner = 2 THEN 1 ELSE 0 END
        WHERE user_id = match_row.player2_id;
    END LOOP;

    INSERT INTO public.tennis_stats (user_id, elo_rating, matches_played, total_wins, is_ranked)
    SELECT user_id, elo_rating, matches_played, total_wins, matches_played >= 10
    FROM pg_temp._tennis_stat_recalc
    ON CONFLICT (user_id) DO UPDATE SET
        elo_rating = EXCLUDED.elo_rating,
        matches_played = EXCLUDED.matches_played,
        total_wins = EXCLUDED.total_wins,
        is_ranked = EXCLUDED.is_ranked;
END;
$$;

CREATE FUNCTION private.valid_score(p_value jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT CASE WHEN jsonb_typeof(p_value) = 'number' THEN
        (p_value::text)::numeric BETWEEN 0 AND 2147483647 AND trunc((p_value::text)::numeric) = (p_value::text)::numeric
        ELSE false END;
$$;
CREATE FUNCTION private.validate_pingpong_sets(p_sets jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE s jsonb;
BEGIN
    IF p_sets IS NULL OR jsonb_typeof(p_sets) <> 'array' OR jsonb_array_length(p_sets) = 0 THEN RAISE EXCEPTION 'At least one set is required'; END IF;
    FOR s IN SELECT value FROM jsonb_array_elements(p_sets) LOOP
        IF NOT private.valid_score(s->'s1') OR NOT private.valid_score(s->'s2') OR (s->>'s1')::numeric = (s->>'s2')::numeric THEN RAISE EXCEPTION 'Enter non-negative integer scores with a winner for every set'; END IF;
    END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.record_pingpong_match(p_admin_token text,p_player1_id uuid,p_player2_id uuid,p_sets jsonb,p_handicap_rule jsonb DEFAULT NULL,p_tournament_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM private.validate_pingpong_sets(p_sets);
    RETURN private.record_pingpong_match_impl(p_player1_id,p_player2_id,p_sets,p_handicap_rule,p_tournament_id);
END $$;

CREATE FUNCTION private.validate_racket_score(p_sport text,p_score1 integer,p_score2 integer,p_format text,p_sets jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE s jsonb; a integer; b integer; total_a integer:=0; total_b integer:=0; wins_a integer:=0; wins_b integer:=0; max_sets integer; needed integer; high integer; low integer;
BEGIN
    IF p_format IS NULL OR p_format NOT IN ('best_of_1','best_of_3','best_of_5') OR (p_sport='tennis' AND p_format='best_of_5') THEN RAISE EXCEPTION 'Invalid match format'; END IF;
    IF p_score1 IS NULL OR p_score2 IS NULL OR p_score1<0 OR p_score2<0 THEN RAISE EXCEPTION 'Invalid scores'; END IF;
    IF p_sets IS NULL OR jsonb_typeof(p_sets)<>'array' THEN RAISE EXCEPTION 'Invalid sets'; END IF;
    -- Legacy game-only records remain editable using the explicit empty array.
    IF jsonb_array_length(p_sets)=0 THEN
        IF p_score1=p_score2 THEN RAISE EXCEPTION 'A winner is required'; END IF;
        RETURN;
    END IF;
    max_sets := CASE p_format WHEN 'best_of_1' THEN 1 WHEN 'best_of_3' THEN 3 ELSE 5 END;
    needed := (max_sets+1)/2;
    IF jsonb_array_length(p_sets)>max_sets THEN RAISE EXCEPTION 'Too many sets'; END IF;
    FOR s IN SELECT value FROM jsonb_array_elements(p_sets) LOOP
        IF NOT private.valid_score(s->(CASE p_sport WHEN 'padel' THEN 'team1Games' ELSE 'player1Games' END)) OR NOT private.valid_score(s->(CASE p_sport WHEN 'padel' THEN 'team2Games' ELSE 'player2Games' END)) THEN RAISE EXCEPTION 'Invalid set scores'; END IF;
        a := (s->>(CASE p_sport WHEN 'padel' THEN 'team1Games' ELSE 'player1Games' END))::numeric::integer;
        b := (s->>(CASE p_sport WHEN 'padel' THEN 'team2Games' ELSE 'player2Games' END))::numeric::integer;
        IF a=b OR wins_a>=needed OR wins_b>=needed THEN RAISE EXCEPTION 'Set needs a winner and cannot follow a completed match'; END IF;
        IF p_sport='tennis' THEN
            high:=greatest(a,b); low:=least(a,b);
            IF NOT ((high=6 AND low<=4) OR (high=7 AND low IN (5,6))) THEN RAISE EXCEPTION 'Invalid completed tennis set'; END IF;
            IF (low=6 AND high=7) OR s->>'player1Tiebreak' IS NOT NULL OR s->>'player2Tiebreak' IS NOT NULL THEN
                IF NOT private.valid_score(s->'player1Tiebreak') OR NOT private.valid_score(s->'player2Tiebreak') OR low<>6 OR high<>7 THEN RAISE EXCEPTION 'Invalid tiebreak'; END IF;
                IF greatest((s->>'player1Tiebreak')::integer,(s->>'player2Tiebreak')::integer)<7 OR abs((s->>'player1Tiebreak')::integer-(s->>'player2Tiebreak')::integer)<2
                    OR ((s->>'player1Tiebreak')::integer > (s->>'player2Tiebreak')::integer) <> (a>b) THEN RAISE EXCEPTION 'Invalid tiebreak winner'; END IF;
            END IF;
        END IF;
        total_a:=total_a+a; total_b:=total_b+b;
        IF a>b THEN wins_a:=wins_a+1; ELSE wins_b:=wins_b+1; END IF;
    END LOOP;
    IF total_a<>p_score1 OR total_b<>p_score2 OR wins_a=wins_b OR (p_sport='tennis' AND greatest(wins_a,wins_b)<>needed) THEN RAISE EXCEPTION 'Scores do not describe a completed match'; END IF;
END $$;
CREATE FUNCTION public.update_padel_match(p_admin_token text,p_match_id uuid,p_score1 integer,p_score2 integer,p_match_format text,p_sets_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM private.validate_racket_score('padel',p_score1,p_score2,p_match_format,p_sets_data);
    PERFORM pg_advisory_xact_lock(hashtext('padel_stats'));
    UPDATE public.padel_matches SET score1=p_score1,score2=p_score2,match_format=p_match_format,sets_data=p_sets_data WHERE id=p_match_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
    PERFORM public.recalculate_padel_stats();
END $$;
REVOKE ALL ON FUNCTION public.update_padel_match(text,uuid,integer,integer,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_padel_match(text,uuid,integer,integer,text,jsonb) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.admin_recalculate_padel_stats(p_admin_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM pg_advisory_xact_lock(hashtext('padel_stats'));
    PERFORM public.recalculate_padel_stats();
END $$;
REVOKE ALL ON FUNCTION public.admin_recalculate_padel_stats(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recalculate_padel_stats(text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.record_padel_match(p_admin_token text,p_team1_player1_id uuid,p_team1_player2_id uuid,p_team2_player1_id uuid,p_team2_player2_id uuid,p_score1 integer,p_score2 integer,p_match_format text DEFAULT 'best_of_3',p_sets_data jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM private.validate_racket_score('padel',p_score1,p_score2,p_match_format,p_sets_data);
    RETURN private.record_padel_match_impl(p_team1_player1_id,p_team1_player2_id,p_team2_player1_id,p_team2_player2_id,p_score1,p_score2,p_match_format,p_sets_data);
END $$;
CREATE FUNCTION public.update_tennis_match(p_admin_token text,p_match_id uuid,p_score1 integer,p_score2 integer,p_match_format text,p_sets_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM private.validate_racket_score('tennis',p_score1,p_score2,p_match_format,p_sets_data);
    PERFORM pg_advisory_xact_lock(hashtext('tennis_stats'));
    UPDATE public.tennis_matches SET score1=p_score1,score2=p_score2,match_format=p_match_format,sets_data=p_sets_data WHERE id=p_match_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
    PERFORM public.recalculate_tennis_stats();
END $$;
REVOKE ALL ON FUNCTION public.update_tennis_match(text,uuid,integer,integer,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_tennis_match(text,uuid,integer,integer,text,jsonb) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.admin_recalculate_tennis_stats(p_admin_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM pg_advisory_xact_lock(hashtext('tennis_stats'));
    PERFORM public.recalculate_tennis_stats();
END $$;
REVOKE ALL ON FUNCTION public.admin_recalculate_tennis_stats(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recalculate_tennis_stats(text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.record_tennis_match(p_admin_token text,p_player1_id uuid,p_player2_id uuid,p_score1 integer,p_score2 integer,p_match_format text DEFAULT 'best_of_3',p_sets_data jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM private.validate_racket_score('tennis',p_score1,p_score2,p_match_format,p_sets_data);
    RETURN private.record_tennis_match_impl(p_player1_id,p_player2_id,p_score1,p_score2,p_match_format,p_sets_data);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated;
-- Operator-controlled rebuild: use the guarded admin_recalculate_* RPCs after
-- backup/review. Installing this migration alone does not rewrite ratings.
CREATE OR REPLACE FUNCTION public.delete_padel_matches(
    p_admin_token text,
    p_match_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    deleted_count integer;
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM pg_advisory_xact_lock(hashtext('padel_stats'));

    DELETE FROM public.padel_matches
    WHERE id = ANY(coalesce(p_match_ids, ARRAY[]::uuid[]));
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    PERFORM public.recalculate_padel_stats();
    RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_tennis_matches(
    p_admin_token text,
    p_match_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    deleted_count integer;
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM pg_advisory_xact_lock(hashtext('tennis_stats'));

    DELETE FROM public.tennis_matches
    WHERE id = ANY(coalesce(p_match_ids, ARRAY[]::uuid[]));
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    PERFORM public.recalculate_tennis_stats();
    RETURN deleted_count;
END;
$$;

COMMIT;
