-- The House tab lists the whole points history, not just the latest 200 edits
-- (capped at 5,000 so the call stays small). Same checks as before.
CREATE OR REPLACE FUNCTION public.super_admin_wallet_adjustments(p_admin_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM private.require_super_admin_session(p_admin_token);
    RETURN coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC, a.id DESC)
        FROM (SELECT * FROM private.bet_wallet_adjustments ORDER BY created_at DESC, id DESC LIMIT 5000) a), '[]'::jsonb);
END $$;
