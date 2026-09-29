-- Require a short-lived, server-validated admin session for every new match.
-- The configured PIN is stored as a bcrypt hash; session tokens are stored as
-- SHA-256 hashes in a schema that is not exposed through the Data API.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE private.admin_config (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    pin_hash text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE private.admin_sessions (
    token_hash bytea PRIMARY KEY,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_sessions_expires_at_idx
    ON private.admin_sessions (expires_at);

CREATE TABLE private.admin_login_attempts (
    login_key text PRIMARY KEY,
    failed_attempts integer NOT NULL DEFAULT 0,
    window_started_at timestamptz NOT NULL DEFAULT now(),
    blocked_until timestamptz
);

REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;

INSERT INTO private.admin_config (singleton, pin_hash)
VALUES (true, '$2a$12$L4lqcQ6JAukHKcToST3IJOZgftjN89F.k5xvTNpXuxjyCaYM0iYoC')
ON CONFLICT (singleton) DO UPDATE
SET
    pin_hash = EXCLUDED.pin_hash,
    updated_at = now();

CREATE OR REPLACE FUNCTION private.admin_login_key()
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    request_headers jsonb;
    address text;
    user_agent text;
BEGIN
    BEGIN
        request_headers := coalesce(
            nullif(current_setting('request.headers', true), ''),
            '{}'
        )::jsonb;
    EXCEPTION
        WHEN OTHERS THEN
            request_headers := '{}'::jsonb;
    END;

    address := coalesce(
        request_headers ->> 'x-forwarded-for',
        request_headers ->> 'x-real-ip',
        'unknown'
    );
    user_agent := coalesce(request_headers ->> 'user-agent', 'unknown');

    RETURN encode(
        extensions.digest(address || '|' || user_agent, 'sha256'),
        'hex'
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.is_valid_admin_session(p_token text)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT p_token IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM private.admin_sessions
            WHERE token_hash = extensions.digest(p_token, 'sha256')
              AND expires_at > now()
        );
$$;

CREATE OR REPLACE FUNCTION private.require_admin_session(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF NOT private.is_valid_admin_session(p_token) THEN
        RAISE EXCEPTION USING
            MESSAGE = 'Admin session is missing or expired',
            ERRCODE = '42501';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.admin_login_key() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_valid_admin_session(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.require_admin_session(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_admin_session(p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    login_key_value text := private.admin_login_key();
    config_hash text;
    attempt_row private.admin_login_attempts%ROWTYPE;
    session_token text;
    session_expires_at timestamptz := now() + interval '12 hours';
BEGIN
    DELETE FROM private.admin_sessions
    WHERE expires_at <= now();

    SELECT *
    INTO attempt_row
    FROM private.admin_login_attempts
    WHERE login_key = login_key_value
    FOR UPDATE;

    IF FOUND
        AND attempt_row.blocked_until IS NOT NULL
        AND attempt_row.blocked_until > now()
    THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Too many incorrect attempts. Try again later.'
        );
    END IF;

    SELECT pin_hash
    INTO config_hash
    FROM private.admin_config
    WHERE singleton = true;

    IF config_hash IS NULL
        OR p_pin IS NULL
        OR p_pin !~ '^[0-9]{6}$'
        OR extensions.crypt(p_pin, config_hash) <> config_hash
    THEN
        INSERT INTO private.admin_login_attempts (
            login_key,
            failed_attempts,
            window_started_at,
            blocked_until
        )
        VALUES (login_key_value, 1, now(), NULL)
        ON CONFLICT (login_key) DO UPDATE
        SET
            failed_attempts = CASE
                WHEN private.admin_login_attempts.window_started_at < now() - interval '15 minutes'
                    THEN 1
                ELSE private.admin_login_attempts.failed_attempts + 1
            END,
            window_started_at = CASE
                WHEN private.admin_login_attempts.window_started_at < now() - interval '15 minutes'
                    THEN now()
                ELSE private.admin_login_attempts.window_started_at
            END,
            blocked_until = CASE
                WHEN (
                    CASE
                        WHEN private.admin_login_attempts.window_started_at < now() - interval '15 minutes'
                            THEN 1
                        ELSE private.admin_login_attempts.failed_attempts + 1
                    END
                ) >= 5
                    THEN now() + interval '15 minutes'
                ELSE NULL
            END;

        RETURN jsonb_build_object('ok', false, 'error', 'Incorrect admin PIN');
    END IF;

    DELETE FROM private.admin_login_attempts
    WHERE login_key = login_key_value;

    session_token := encode(extensions.gen_random_bytes(32), 'hex');

    INSERT INTO private.admin_sessions (token_hash, expires_at)
    VALUES (
        extensions.digest(session_token, 'sha256'),
        session_expires_at
    );

    RETURN jsonb_build_object(
        'ok', true,
        'token', session_token,
        'expires_at', session_expires_at
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_admin_session(p_token text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT private.is_valid_admin_session(p_token);
$$;

CREATE OR REPLACE FUNCTION public.revoke_admin_session(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    DELETE FROM private.admin_sessions
    WHERE token_hash = extensions.digest(p_token, 'sha256');
$$;

REVOKE ALL ON FUNCTION public.create_admin_session(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_admin_session(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_admin_session(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_admin_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_admin_session(text) TO anon, authenticated;

-- Move the existing write implementations out of the exposed schema. The new
-- public wrappers below are the only match-recording functions exposed to the
-- frontend and require a valid admin session before invoking these routines.
ALTER FUNCTION public.record_pingpong_match(uuid, uuid, jsonb, jsonb, uuid)
    SET SCHEMA private;
ALTER FUNCTION private.record_pingpong_match(uuid, uuid, jsonb, jsonb, uuid)
    RENAME TO record_pingpong_match_impl;

ALTER FUNCTION public.record_padel_match(uuid, uuid, uuid, uuid, integer, integer, text, jsonb)
    SET SCHEMA private;
ALTER FUNCTION private.record_padel_match(uuid, uuid, uuid, uuid, integer, integer, text, jsonb)
    RENAME TO record_padel_match_impl;

ALTER FUNCTION public.record_tennis_match(uuid, uuid, integer, integer, text, jsonb)
    SET SCHEMA private;
ALTER FUNCTION private.record_tennis_match(uuid, uuid, integer, integer, text, jsonb)
    RENAME TO record_tennis_match_impl;

ALTER FUNCTION private.record_pingpong_match_impl(uuid, uuid, jsonb, jsonb, uuid)
    SET search_path = '';
ALTER FUNCTION private.record_padel_match_impl(uuid, uuid, uuid, uuid, integer, integer, text, jsonb)
    SET search_path = '';
ALTER FUNCTION private.record_tennis_match_impl(uuid, uuid, integer, integer, text, jsonb)
    SET search_path = '';

REVOKE ALL ON FUNCTION private.record_pingpong_match_impl(uuid, uuid, jsonb, jsonb, uuid)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.record_padel_match_impl(uuid, uuid, uuid, uuid, integer, integer, text, jsonb)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.record_tennis_match_impl(uuid, uuid, integer, integer, text, jsonb)
    FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.record_pingpong_match(
    p_admin_token text,
    p_player1_id uuid,
    p_player2_id uuid,
    p_sets jsonb,
    p_handicap_rule jsonb DEFAULT NULL,
    p_tournament_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    RETURN private.record_pingpong_match_impl(
        p_player1_id,
        p_player2_id,
        p_sets,
        p_handicap_rule,
        p_tournament_id
    );
END;
$$;

CREATE FUNCTION public.record_padel_match(
    p_admin_token text,
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
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    RETURN private.record_padel_match_impl(
        p_team1_player1_id,
        p_team1_player2_id,
        p_team2_player1_id,
        p_team2_player2_id,
        p_score1,
        p_score2,
        p_match_format,
        p_sets_data
    );
END;
$$;

CREATE FUNCTION public.record_tennis_match(
    p_admin_token text,
    p_player1_id uuid,
    p_player2_id uuid,
    p_score1 integer,
    p_score2 integer,
    p_match_format text DEFAULT 'best_of_3',
    p_sets_data jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    RETURN private.record_tennis_match_impl(
        p_player1_id,
        p_player2_id,
        p_score1,
        p_score2,
        p_match_format,
        p_sets_data
    );
END;
$$;

REVOKE ALL ON FUNCTION public.record_pingpong_match(text, uuid, uuid, jsonb, jsonb, uuid)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_padel_match(text, uuid, uuid, uuid, uuid, integer, integer, text, jsonb)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_tennis_match(text, uuid, uuid, integer, integer, text, jsonb)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_pingpong_match(text, uuid, uuid, jsonb, jsonb, uuid)
    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_padel_match(text, uuid, uuid, uuid, uuid, integer, integer, text, jsonb)
    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_tennis_match(text, uuid, uuid, integer, integer, text, jsonb)
    TO anon, authenticated;

-- Keep match history readable, but make all direct writes impossible for the
-- frontend roles. New rows can only be created through the guarded RPCs.
REVOKE ALL ON TABLE public.matches, public.padel_matches, public.tennis_matches
    FROM anon, authenticated;
GRANT SELECT ON TABLE public.matches, public.padel_matches, public.tennis_matches
    TO anon, authenticated;

DROP POLICY IF EXISTS "Enable write access for all users" ON public.matches;
DROP POLICY IF EXISTS "Allow all for padel_matches" ON public.padel_matches;
DROP POLICY IF EXISTS "Allow all for tennis_matches" ON public.tennis_matches;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.matches;
CREATE POLICY "Enable read access for all users"
    ON public.matches
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Enable read access for all users"
    ON public.padel_matches
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Enable read access for all users"
    ON public.tennis_matches
    FOR SELECT
    TO anon, authenticated
    USING (true);
