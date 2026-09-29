-- Route match deletion through admin-session-checked RPCs. Frontend roles have
-- SELECT only on match tables, so direct PostgREST DELETE requests are denied.

CREATE OR REPLACE FUNCTION public.delete_pingpong_matches(
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

    DELETE FROM public.matches
    WHERE id = ANY(coalesce(p_match_ids, ARRAY[]::uuid[]));
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    PERFORM public.recalculate_pingpong_stats();
    RETURN deleted_count;
END;
$$;

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

    DELETE FROM public.tennis_matches
    WHERE id = ANY(coalesce(p_match_ids, ARRAY[]::uuid[]));
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    PERFORM public.recalculate_tennis_stats();
    RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_pingpong_matches(text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_padel_matches(text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_tennis_matches(text, uuid[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.delete_pingpong_matches(text, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_padel_matches(text, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_tennis_matches(text, uuid[]) TO anon, authenticated;
