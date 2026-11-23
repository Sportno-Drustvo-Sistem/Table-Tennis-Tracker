-- Super admin: a second, longer password on the same login. A super admin
-- session is also a normal admin session (same token), and on top of that can
-- set anyone's betting points. Purely additive; see
-- supabase/rollbacks/20261123150000_super_admin_bet_wallets_down.sql and
-- docs/points-betting.md.
--
-- No password is set here. Set one in the SQL editor (12+ characters):
--   SELECT private.set_super_admin_password('your long password');
BEGIN;

CREATE TABLE private.super_admin_config (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    password_hash text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Same token hash as the matching row in private.admin_sessions.
CREATE TABLE private.super_admin_sessions (
    token_hash bytea PRIMARY KEY,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Every manual change to a wallet, so the house totals can tell bets from edits.
CREATE TABLE private.bet_wallet_adjustments (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    old_balance integer NOT NULL,
    new_balance integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON private.super_admin_config, private.super_admin_sessions, private.bet_wallet_adjustments FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.set_super_admin_password(p_password text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF p_password IS NULL OR length(p_password) < 12 THEN
        RAISE EXCEPTION 'The super admin password needs at least 12 characters';
    END IF;
    INSERT INTO private.super_admin_config(singleton, password_hash)
    VALUES (true, extensions.crypt(p_password, extensions.gen_salt('bf', 10)))
    ON CONFLICT (singleton) DO UPDATE SET password_hash = excluded.password_hash, updated_at = now();
    -- A new password signs every super admin out.
    DELETE FROM private.admin_sessions WHERE token_hash IN (SELECT token_hash FROM private.super_admin_sessions);
    DELETE FROM private.super_admin_sessions;
END $$;

CREATE FUNCTION private.is_valid_super_admin_session(p_token text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
    SELECT p_token IS NOT NULL
        AND private.is_valid_admin_session(p_token)
        AND EXISTS (
            SELECT 1 FROM private.super_admin_sessions
            WHERE token_hash = extensions.digest(p_token, 'sha256') AND expires_at > now()
        );
$$;

CREATE FUNCTION private.require_super_admin_session(p_token text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF NOT private.is_valid_super_admin_session(p_token) THEN
        RAISE EXCEPTION USING MESSAGE = 'Super admin session is missing or expired', ERRCODE = '42501';
    END IF;
END $$;

REVOKE ALL ON FUNCTION private.set_super_admin_password(text), private.is_valid_super_admin_session(text), private.require_super_admin_session(text) FROM PUBLIC, anon, authenticated;

-- Throttled harder than the PIN: 5 tries per address and 20 overall per
-- 30 minutes, tracked under their own keys in private.admin_login_attempts.
CREATE FUNCTION public.create_super_admin_session(p_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    key_value text := 'super:' || private.admin_login_key();
    config_hash text;
    token_value text;
    token_digest bytea;
    expiry timestamptz := now() + interval '12 hours';
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('super_admin_login'));
    INSERT INTO private.admin_login_attempts(login_key) VALUES ('super:aggregate'), (key_value) ON CONFLICT DO NOTHING;
    UPDATE private.admin_login_attempts SET failed_attempts = 0, window_started_at = now(), blocked_until = NULL
        WHERE login_key IN ('super:aggregate', key_value) AND window_started_at <= now() - interval '30 minutes'
        AND (blocked_until IS NULL OR blocked_until <= now());
    IF EXISTS (SELECT 1 FROM private.admin_login_attempts WHERE login_key IN ('super:aggregate', key_value)
        AND (blocked_until > now() OR failed_attempts >= CASE WHEN login_key = 'super:aggregate' THEN 20 ELSE 5 END)) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Too many incorrect attempts. Try again later.');
    END IF;
    SELECT password_hash INTO config_hash FROM private.super_admin_config WHERE singleton;
    IF config_hash IS NULL OR p_password IS NULL OR length(p_password) < 12 OR length(p_password) > 200
        OR extensions.crypt(p_password, config_hash) <> config_hash THEN
        UPDATE private.admin_login_attempts SET failed_attempts = failed_attempts + 1,
            blocked_until = CASE WHEN failed_attempts + 1 >= CASE WHEN login_key = 'super:aggregate' THEN 20 ELSE 5 END THEN now() + interval '30 minutes' END
            WHERE login_key IN ('super:aggregate', key_value);
        RETURN jsonb_build_object('ok', false, 'error', 'Incorrect password');
    END IF;
    DELETE FROM private.admin_sessions WHERE expires_at <= now();
    DELETE FROM private.super_admin_sessions WHERE expires_at <= now();
    DELETE FROM private.admin_login_attempts WHERE login_key = key_value;
    token_value := encode(extensions.gen_random_bytes(32), 'hex');
    token_digest := extensions.digest(token_value, 'sha256');
    INSERT INTO private.admin_sessions(token_hash, expires_at) VALUES (token_digest, expiry);
    INSERT INTO private.super_admin_sessions(token_hash, expires_at) VALUES (token_digest, expiry);
    RETURN jsonb_build_object('ok', true, 'token', token_value, 'expires_at', expiry, 'super', true);
END $$;

CREATE FUNCTION public.validate_super_admin_session(p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT private.is_valid_super_admin_session(p_token);
$$;

-- Sets one player's betting points. Creates the wallet if they never bet.
CREATE FUNCTION public.super_admin_set_wallet(p_admin_token text, p_user_id uuid, p_balance integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    old_value integer;
    wallet public.bet_wallets;
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM private.require_super_admin_session(p_admin_token);
    IF p_balance IS NULL OR p_balance < 0 OR p_balance > 10000000 THEN
        RAISE EXCEPTION 'Points must be between 0 and 10,000,000';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN RAISE EXCEPTION 'Player not found'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext('points_betting'));
    INSERT INTO public.bet_wallets(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
    SELECT balance INTO old_value FROM public.bet_wallets WHERE user_id = p_user_id FOR UPDATE;
    UPDATE public.bet_wallets SET balance = p_balance, updated_at = now() WHERE user_id = p_user_id RETURNING * INTO wallet;
    IF old_value <> p_balance THEN
        INSERT INTO private.bet_wallet_adjustments(user_id, old_balance, new_balance) VALUES (p_user_id, old_value, p_balance);
    END IF;
    RETURN jsonb_build_object('wallet', to_jsonb(wallet));
END $$;

CREATE FUNCTION public.super_admin_wallet_adjustments(p_admin_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM private.require_super_admin_session(p_admin_token);
    RETURN coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC)
        FROM (SELECT * FROM private.bet_wallet_adjustments ORDER BY created_at DESC LIMIT 200) a), '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.create_super_admin_session(text), public.validate_super_admin_session(text),
    public.super_admin_set_wallet(text, uuid, integer), public.super_admin_wallet_adjustments(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_super_admin_session(text), public.validate_super_admin_session(text),
    public.super_admin_set_wallet(text, uuid, integer), public.super_admin_wallet_adjustments(text) TO anon, authenticated;

COMMIT;
