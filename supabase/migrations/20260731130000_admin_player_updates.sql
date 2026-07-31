-- Keep the users table read-only through the Data API while allowing an
-- administrator with a valid short-lived session to edit a player.

CREATE FUNCTION public.update_player(
    p_admin_token text,
    p_user_id uuid,
    p_name text,
    p_avatar_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);

    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RAISE EXCEPTION USING
            MESSAGE = 'Player name is required',
            ERRCODE = '22023';
    END IF;

    UPDATE public.users
    SET
        name = btrim(p_name),
        avatar_url = p_avatar_url
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            MESSAGE = 'Player not found',
            ERRCODE = 'P0002';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_player(text, uuid, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_player(text, uuid, text, text)
    TO anon, authenticated;
