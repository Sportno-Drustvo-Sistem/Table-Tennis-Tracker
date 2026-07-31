-- Atomic match recording RPCs.
-- These functions insert match rows and recalculate aggregate stats in one transaction.

CREATE OR REPLACE FUNCTION public.app_calculate_elo_change(
    p_rating_a numeric,
    p_rating_b numeric,
    p_score_a integer,
    p_score_b integer
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    expected_a numeric;
    actual_a numeric;
    multiplier numeric;
BEGIN
    expected_a := 1 / (1 + power(10::numeric, (p_rating_b - p_rating_a) / 400));
    actual_a := CASE WHEN p_score_a > p_score_b THEN 1 ELSE 0 END;
    multiplier := ln(abs(p_score_a - p_score_b) + 1);
    RETURN round(32 * multiplier * (actual_a - expected_a))::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_streak_bonus(
    p_handicap_rule jsonb,
    p_target_player_id uuid,
    p_won boolean
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    rule_item jsonb;
    bonus integer := 0;
    rule_set jsonb;
BEGIN
    IF p_handicap_rule IS NULL OR NOT p_won THEN
        RETURN 0;
    END IF;

    rule_set := CASE
        WHEN jsonb_typeof(p_handicap_rule) = 'array' THEN p_handicap_rule
        ELSE jsonb_build_array(p_handicap_rule)
    END;

    FOR rule_item IN SELECT value FROM jsonb_array_elements(rule_set)
    LOOP
        IF rule_item ->> 'type' = 'streak'
            AND rule_item ->> 'targetPlayerId' = p_target_player_id::text
        THEN
            bonus := bonus + (2 * coalesce(nullif(rule_item ->> 'trigger_value', '')::integer, 0));
        END IF;
    END LOOP;

    RETURN bonus;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_padel_winner(
    p_score1 integer,
    p_score2 integer,
    p_sets_data jsonb
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    set_item jsonb;
    team1_sets integer := 0;
    team2_sets integer := 0;
    team1_games integer;
    team2_games integer;
BEGIN
    IF p_sets_data IS NOT NULL
        AND jsonb_typeof(p_sets_data) = 'array'
        AND jsonb_array_length(p_sets_data) > 0
    THEN
        FOR set_item IN SELECT value FROM jsonb_array_elements(p_sets_data)
        LOOP
            team1_games := coalesce(nullif(set_item ->> 'team1Games', '')::integer, 0);
            team2_games := coalesce(nullif(set_item ->> 'team2Games', '')::integer, 0);
            IF team1_games > team2_games THEN
                team1_sets := team1_sets + 1;
            ELSIF team2_games > team1_games THEN
                team2_sets := team2_sets + 1;
            END IF;
        END LOOP;

        IF team1_sets > team2_sets THEN
            RETURN 1;
        ELSIF team2_sets > team1_sets THEN
            RETURN 2;
        END IF;
        RETURN 0;
    END IF;

    IF p_score1 > p_score2 THEN
        RETURN 1;
    ELSIF p_score2 > p_score1 THEN
        RETURN 2;
    END IF;
    RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_tennis_winner(
    p_score1 integer,
    p_score2 integer,
    p_sets_data jsonb
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    set_item jsonb;
    player1_sets integer := 0;
    player2_sets integer := 0;
    player1_games integer;
    player2_games integer;
BEGIN
    IF p_sets_data IS NOT NULL
        AND jsonb_typeof(p_sets_data) = 'array'
        AND jsonb_array_length(p_sets_data) > 0
    THEN
        FOR set_item IN SELECT value FROM jsonb_array_elements(p_sets_data)
        LOOP
            player1_games := coalesce(nullif(set_item ->> 'player1Games', '')::integer, 0);
            player2_games := coalesce(nullif(set_item ->> 'player2Games', '')::integer, 0);
            IF player1_games > player2_games THEN
                player1_sets := player1_sets + 1;
            ELSIF player2_games > player1_games THEN
                player2_sets := player2_sets + 1;
            END IF;
        END LOOP;

        IF player1_sets > player2_sets THEN
            RETURN 1;
        ELSIF player2_sets > player1_sets THEN
            RETURN 2;
        END IF;
        RETURN 0;
    END IF;

    IF p_score1 > p_score2 THEN
        RETURN 1;
    ELSIF p_score2 > p_score1 THEN
        RETURN 2;
    END IF;
    RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_pingpong_stats()
RETURNS void
LANGUAGE plpgsql
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
        FROM public.matches
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

CREATE OR REPLACE FUNCTION public.recalculate_padel_stats()
RETURNS void
LANGUAGE plpgsql
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

        team1_elo := (t1p1_elo + t1p2_elo) / 2.0;
        team2_elo := (t2p1_elo + t2p2_elo) / 2.0;
        t1p1_change := public.app_calculate_elo_change(team1_elo, team2_elo, match_row.score1, match_row.score2);
        t1p2_change := public.app_calculate_elo_change(team1_elo, team2_elo, match_row.score1, match_row.score2);
        t2p1_change := public.app_calculate_elo_change(team2_elo, team1_elo, match_row.score2, match_row.score1);
        t2p2_change := public.app_calculate_elo_change(team2_elo, team1_elo, match_row.score2, match_row.score1);
        winner := public.app_padel_winner(match_row.score1, match_row.score2, match_row.sets_data);

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
AS $$
DECLARE
    match_row record;
    p1_elo integer;
    p2_elo integer;
    p1_change integer;
    p2_change integer;
    winner integer;
BEGIN
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

        p1_change := public.app_calculate_elo_change(p1_elo, p2_elo, match_row.score1, match_row.score2);
        p2_change := public.app_calculate_elo_change(p2_elo, p1_elo, match_row.score2, match_row.score1);
        winner := public.app_tennis_winner(match_row.score1, match_row.score2, match_row.sets_data);

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

CREATE OR REPLACE FUNCTION public.record_pingpong_match(
    p_player1_id uuid,
    p_player2_id uuid,
    p_sets jsonb,
    p_handicap_rule jsonb DEFAULT NULL,
    p_tournament_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    set_item jsonb;
    saved_match public.matches%ROWTYPE;
    saved_matches jsonb := '[]'::jsonb;
    old_p1_elo integer;
    old_p2_elo integer;
    new_p1_elo integer;
    new_p2_elo integer;
BEGIN
    IF p_player1_id = p_player2_id THEN
        RAISE EXCEPTION 'A player cannot play against themselves';
    END IF;

    IF p_sets IS NULL OR jsonb_typeof(p_sets) <> 'array' OR jsonb_array_length(p_sets) = 0 THEN
        RAISE EXCEPTION 'At least one set is required';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('pingpong_stats'));

    SELECT coalesce(elo_rating, 1200) INTO old_p1_elo FROM public.users WHERE id = p_player1_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Player 1 not found'; END IF;
    SELECT coalesce(elo_rating, 1200) INTO old_p2_elo FROM public.users WHERE id = p_player2_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Player 2 not found'; END IF;

    FOR set_item IN SELECT value FROM jsonb_array_elements(p_sets)
    LOOP
        INSERT INTO public.matches (player1_id, player2_id, score1, score2, handicap_rule, tournament_id)
        VALUES (
            p_player1_id,
            p_player2_id,
            coalesce(nullif(set_item ->> 's1', '')::integer, 0),
            coalesce(nullif(set_item ->> 's2', '')::integer, 0),
            p_handicap_rule,
            p_tournament_id
        )
        RETURNING * INTO saved_match;

        saved_matches := saved_matches || jsonb_build_array(to_jsonb(saved_match));
    END LOOP;

    PERFORM public.recalculate_pingpong_stats();

    SELECT coalesce(elo_rating, 1200) INTO new_p1_elo FROM public.users WHERE id = p_player1_id;
    SELECT coalesce(elo_rating, 1200) INTO new_p2_elo FROM public.users WHERE id = p_player2_id;

    RETURN jsonb_build_object(
        'match', to_jsonb(saved_match),
        'matches', saved_matches,
        'changes', jsonb_build_object(
            p_player1_id::text, new_p1_elo - old_p1_elo,
            p_player2_id::text, new_p2_elo - old_p2_elo
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_padel_match(
    p_team1_player1_id uuid,
    p_team1_player2_id uuid,
    p_team2_player1_id uuid,
    p_team2_player2_id uuid,
    p_score1 integer,
    p_score2 integer,
    p_match_format text DEFAULT 'best_of_3',
    p_sets_data jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    saved_match public.padel_matches%ROWTYPE;
    old_elos jsonb := '{}'::jsonb;
    new_elo integer;
    player_id uuid;
    player_ids uuid[] := ARRAY[p_team1_player1_id, p_team1_player2_id, p_team2_player1_id, p_team2_player2_id];
    changes jsonb := '{}'::jsonb;
BEGIN
    IF (SELECT count(DISTINCT x) FROM unnest(player_ids) AS ids(x)) <> 4 THEN
        RAISE EXCEPTION 'Padel matches require four distinct players';
    END IF;

    IF (SELECT count(DISTINCT id) FROM public.users WHERE id = ANY(player_ids)) <> 4 THEN
        RAISE EXCEPTION 'One or more padel players were not found';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('padel_stats'));

    FOREACH player_id IN ARRAY player_ids
    LOOP
        old_elos := old_elos || jsonb_build_object(
            player_id::text,
            coalesce((SELECT elo_rating FROM public.padel_stats WHERE user_id = player_id), 1200)
        );
    END LOOP;

    INSERT INTO public.padel_matches (
        team1_player1_id,
        team1_player2_id,
        team2_player1_id,
        team2_player2_id,
        score1,
        score2,
        match_format,
        sets_data
    )
    VALUES (
        p_team1_player1_id,
        p_team1_player2_id,
        p_team2_player1_id,
        p_team2_player2_id,
        p_score1,
        p_score2,
        p_match_format,
        coalesce(p_sets_data, '[]'::jsonb)
    )
    RETURNING * INTO saved_match;

    PERFORM public.recalculate_padel_stats();

    FOREACH player_id IN ARRAY player_ids
    LOOP
        SELECT coalesce(elo_rating, 1200) INTO new_elo FROM public.padel_stats WHERE user_id = player_id;
        changes := changes || jsonb_build_object(player_id::text, new_elo - (old_elos ->> player_id::text)::integer);
    END LOOP;

    RETURN jsonb_build_object(
        'match', to_jsonb(saved_match),
        'matches', jsonb_build_array(to_jsonb(saved_match)),
        'changes', changes
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_tennis_match(
    p_player1_id uuid,
    p_player2_id uuid,
    p_score1 integer,
    p_score2 integer,
    p_match_format text DEFAULT 'best_of_3',
    p_sets_data jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    saved_match public.tennis_matches%ROWTYPE;
    old_p1_elo integer;
    old_p2_elo integer;
    new_p1_elo integer;
    new_p2_elo integer;
BEGIN
    IF p_player1_id = p_player2_id THEN
        RAISE EXCEPTION 'A player cannot play against themselves';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('tennis_stats'));

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_player1_id) THEN
        RAISE EXCEPTION 'Player 1 not found';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_player2_id) THEN
        RAISE EXCEPTION 'Player 2 not found';
    END IF;

    old_p1_elo := coalesce((SELECT elo_rating FROM public.tennis_stats WHERE user_id = p_player1_id), 1200);
    old_p2_elo := coalesce((SELECT elo_rating FROM public.tennis_stats WHERE user_id = p_player2_id), 1200);

    INSERT INTO public.tennis_matches (player1_id, player2_id, score1, score2, match_format, sets_data)
    VALUES (
        p_player1_id,
        p_player2_id,
        p_score1,
        p_score2,
        p_match_format,
        coalesce(p_sets_data, '[]'::jsonb)
    )
    RETURNING * INTO saved_match;

    PERFORM public.recalculate_tennis_stats();

    SELECT coalesce(elo_rating, 1200) INTO new_p1_elo FROM public.tennis_stats WHERE user_id = p_player1_id;
    SELECT coalesce(elo_rating, 1200) INTO new_p2_elo FROM public.tennis_stats WHERE user_id = p_player2_id;

    RETURN jsonb_build_object(
        'match', to_jsonb(saved_match),
        'matches', jsonb_build_array(to_jsonb(saved_match)),
        'changes', jsonb_build_object(
            p_player1_id::text, new_p1_elo - old_p1_elo,
            p_player2_id::text, new_p2_elo - old_p2_elo
        )
    );
END;
$$;
