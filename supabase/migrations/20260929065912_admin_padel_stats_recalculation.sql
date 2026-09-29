-- Allow authenticated app administrators to rebuild derived padel ratings.
-- Browser clients cannot write directly to padel_stats.
CREATE OR REPLACE FUNCTION public.admin_recalculate_padel_stats(p_admin_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM public.recalculate_padel_stats();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_recalculate_padel_stats(text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recalculate_padel_stats(text)
    TO anon, authenticated;
