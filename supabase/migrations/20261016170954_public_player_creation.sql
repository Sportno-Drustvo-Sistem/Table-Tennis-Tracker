-- Match the public Add Player form on existing deployments that only have the
-- older admin-token overload. Keep that overload for older admin clients.
-- This also replaces the two-argument version on fully migrated installations.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_player(p_name text, p_avatar_url text DEFAULT NULL)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    result public.users;
BEGIN
    IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 120 THEN
        RAISE EXCEPTION 'Player name must contain 1 to 120 characters';
    END IF;
    IF p_avatar_url IS NOT NULL AND (length(p_avatar_url) > 2048 OR p_avatar_url !~ '^https?://') THEN
        RAISE EXCEPTION 'Invalid avatar URL';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('pingpong_stats'));
    PERFORM pg_advisory_xact_lock(hashtext('padel_stats'));
    PERFORM pg_advisory_xact_lock(hashtext('tennis_stats'));

    INSERT INTO public.users(name, avatar_url, elo_rating, total_wins, matches_played, is_ranked)
        VALUES (btrim(p_name), p_avatar_url, 1200, 0, 0, false) RETURNING * INTO result;
    INSERT INTO public.padel_stats(user_id, elo_rating, total_wins, matches_played, is_ranked)
        VALUES (result.id, 1200, 0, 0, false);
    INSERT INTO public.tennis_stats(user_id, elo_rating, total_wins, matches_played, is_ranked)
        VALUES (result.id, 1200, 0, 0, false);
    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_player(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_player(text, text) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
