-- Tournament writes require the same server-validated admin session as match writes.
-- Browser roles retain SELECT-only access to these tables.

CREATE FUNCTION public.create_tournament(
    p_admin_token text, p_name text, p_format text, p_config jsonb
)
RETURNS public.tournaments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    created public.tournaments;
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    IF p_name IS NULL OR btrim(p_name) = '' OR length(btrim(p_name)) > 200 THEN
        RAISE EXCEPTION 'Tournament name must be 1 to 200 characters' USING ERRCODE = '22023';
    END IF;
    IF p_format NOT IN ('single_elim', 'double_elim') OR p_format IS NULL THEN
        RAISE EXCEPTION 'Invalid tournament format' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.tournaments (name, format, status, config)
    VALUES (btrim(p_name), p_format, 'active', coalesce(p_config, '{}'::jsonb))
    RETURNING * INTO created;
    RETURN created;
END;
$$;

CREATE FUNCTION public.complete_tournament(
    p_admin_token text, p_tournament_id uuid, p_winner_id uuid, p_results jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM pg_advisory_xact_lock(hashtext('pingpong_stats'));
    IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
        RAISE EXCEPTION 'Tournament results must be an array' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_winner_id) THEN
        RAISE EXCEPTION 'Winner not found' USING ERRCODE = '22023';
    END IF;
    UPDATE public.tournaments
    SET status = 'completed', winner_id = p_winner_id
    WHERE id = p_tournament_id AND status = 'active'
      AND season_id = (SELECT id FROM public.pingpong_seasons WHERE is_active);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active tournament not found' USING ERRCODE = 'P0002';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_results) AS r(user_id uuid, rank integer, round_reached text)
        WHERE r.user_id IS NULL OR r.rank IS NULL OR r.rank < 1
            OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = r.user_id)
    ) THEN
        RAISE EXCEPTION 'Invalid tournament results' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.tournament_results (tournament_id, user_id, rank, round_reached)
    SELECT p_tournament_id, r.user_id, r.rank, r.round_reached
    FROM jsonb_to_recordset(p_results) AS r(user_id uuid, rank integer, round_reached text);
END;
$$;

CREATE FUNCTION public.delete_tournament(
    p_admin_token text, p_tournament_id uuid, p_delete_matches boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM pg_advisory_xact_lock(hashtext('pingpong_stats'));
    IF NOT EXISTS (
        SELECT 1 FROM public.tournaments
        WHERE id = p_tournament_id
          AND season_id = (SELECT id FROM public.pingpong_seasons WHERE is_active)
    ) THEN
        RAISE EXCEPTION 'Current-season tournament not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_delete_matches IS TRUE THEN
        DELETE FROM public.matches WHERE tournament_id = p_tournament_id;
        PERFORM public.recalculate_pingpong_stats();
    ELSE
        UPDATE public.matches SET tournament_id = NULL WHERE tournament_id = p_tournament_id;
    END IF;
    DELETE FROM public.tournament_results WHERE tournament_id = p_tournament_id;
    DELETE FROM public.tournaments WHERE id = p_tournament_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tournament(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_tournament(text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_tournament(text, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_tournament(text, text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_tournament(text, uuid, uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_tournament(text, uuid, boolean) TO anon, authenticated;
