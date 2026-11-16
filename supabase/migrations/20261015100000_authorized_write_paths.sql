-- Forward remediation for existing projects and fresh installs. Apply atomically.
BEGIN;

-- Privileges and RLS are independent gates. Remove legacy ALL/write policies and
-- grants (including PUBLIC), then explicitly expose public reads.
DO $$
DECLARE t text; p record;
BEGIN
    FOREACH t IN ARRAY ARRAY['users','matches','padel_matches','tennis_matches','tournaments','tournament_results','padel_stats','tennis_stats','settings','debuffs','pingpong_seasons','pingpong_season_snapshots'] LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
        EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', t);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND cmd <> 'SELECT' LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
        END LOOP;
        EXECUTE format('CREATE POLICY remediation_public_read ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
    END LOOP;
END $$;

-- These internal recalculators mutate protected state. Only guarded wrappers may
-- invoke them. Existing invoker functions and trigger routines are not APIs.
REVOKE ALL ON FUNCTION public.recalculate_pingpong_stats(), public.recalculate_padel_stats(), public.recalculate_tennis_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE FUNCTION public.create_player(p_name text, p_avatar_url text DEFAULT NULL)
RETURNS public.users LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result public.users;
BEGIN
    IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Player name must contain 1 to 120 characters'; END IF;
    IF p_avatar_url IS NOT NULL AND (length(p_avatar_url) > 2048 OR p_avatar_url !~ '^https?://') THEN RAISE EXCEPTION 'Invalid avatar URL'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext('pingpong_stats'));
    PERFORM pg_advisory_xact_lock(hashtext('padel_stats'));
    PERFORM pg_advisory_xact_lock(hashtext('tennis_stats'));
    INSERT INTO public.users(name, avatar_url, elo_rating, total_wins, matches_played, is_ranked)
        VALUES (btrim(p_name), p_avatar_url, 1200, 0, 0, false) RETURNING * INTO result;
    INSERT INTO public.padel_stats(user_id, elo_rating, total_wins, matches_played, is_ranked) VALUES(result.id,1200,0,0,false);
    INSERT INTO public.tennis_stats(user_id, elo_rating, total_wins, matches_played, is_ranked) VALUES(result.id,1200,0,0,false);
    RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.create_player(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_player(text,text) TO anon, authenticated;

CREATE FUNCTION public.save_debuff(p_admin_token text, p_id uuid, p_debuff jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE types text[]; v public.debuffs;
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    IF jsonb_typeof(p_debuff) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid debuff'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_debuff) k WHERE k NOT IN ('title','description','severity','trigger_types','trigger_type','trigger_value','is_active')) THEN RAISE EXCEPTION 'Unknown debuff field'; END IF;
    v := jsonb_populate_record(NULL::public.debuffs, p_debuff);
    types := v.trigger_types;
    IF v.title IS NULL OR btrim(v.title) = '' OR length(v.title) > 120 OR v.description IS NULL OR btrim(v.description) = '' OR length(v.description) > 2000
        OR v.severity IS NULL OR v.severity NOT BETWEEN 1 AND 10 OR v.is_active IS NULL
        OR types IS NULL OR cardinality(types) = 0 OR NOT types <@ ARRAY['mayhem','streak_loss']::text[]
        OR array_position(types, NULL) IS NOT NULL
        OR ('streak_loss' = ANY(types) AND (v.trigger_value IS NULL OR v.trigger_value < 1)) THEN RAISE EXCEPTION 'Invalid debuff fields'; END IF;
    IF p_id IS NULL THEN
        INSERT INTO public.debuffs(title,description,severity,trigger_types,trigger_type,trigger_value,is_active)
        VALUES(btrim(v.title),v.description,v.severity,types,types[1],v.trigger_value,v.is_active);
    ELSE
        UPDATE public.debuffs SET title=btrim(v.title),description=v.description,severity=v.severity,trigger_types=types,trigger_type=types[1],trigger_value=v.trigger_value,is_active=v.is_active WHERE id=p_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Debuff not found'; END IF;
    END IF;
END $$;
CREATE FUNCTION public.delete_debuff(p_admin_token text, p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    DELETE FROM public.debuffs WHERE id=p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Debuff not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_debuff(text,uuid,jsonb), public.delete_debuff(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_debuff(text,uuid,jsonb), public.delete_debuff(text,uuid) TO anon, authenticated;

-- Custom sessions do not authenticate Storage requests. Both public creation
-- and admin replacement upload NEW unique paths; only update_player can attach
-- a replacement to an existing profile. No browser can overwrite/delete objects.
DO $$ BEGIN
    IF to_regclass('storage.objects') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Enable public insert for avatars" ON storage.objects;
        DROP POLICY IF EXISTS "Enable public update for avatars" ON storage.objects;
        DROP POLICY IF EXISTS "Enable public delete for avatars" ON storage.objects;
        CREATE POLICY "Create unique avatars" ON storage.objects FOR INSERT TO anon, authenticated
            WITH CHECK (bucket_id='avatars' AND name ~ '^create/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|gif|avif)$');
        CREATE POLICY "Avatar creation boundary" ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated
            WITH CHECK (bucket_id <> 'avatars' OR name ~ '^create/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|gif|avif)$');
        CREATE POLICY "No browser avatar replacement" ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated
            USING (bucket_id <> 'avatars') WITH CHECK (bucket_id <> 'avatars');
        CREATE POLICY "No browser avatar deletion" ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (bucket_id <> 'avatars');
    END IF;
END $$;

-- No verified, non-spoofable client-address header boundary is configured in this
-- app. Use the database peer, never request.headers. Pool peers may be shared;
-- this deliberately conservative quota is supplemented by an independent global
-- quota. A future proxy identity requires documented header stripping/signing.
CREATE OR REPLACE FUNCTION private.admin_login_key()
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
    SELECT 'peer:' || coalesce(host(inet_client_addr()), 'local');
$$;
CREATE OR REPLACE FUNCTION public.create_admin_session(p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    key_value text := private.admin_login_key();
    config_hash text;
    token_value text;
    expiry timestamptz := now() + interval '12 hours';
BEGIN
    -- Serialize including the first attempt, before rows exist. Limits cannot be
    -- exceeded by concurrent calls or by rolling back an exception response.
    PERFORM pg_advisory_xact_lock(hashtext('admin_login'));
    INSERT INTO private.admin_login_attempts(login_key) VALUES ('aggregate'),(key_value) ON CONFLICT DO NOTHING;
    UPDATE private.admin_login_attempts SET failed_attempts=0,window_started_at=now(),blocked_until=NULL
        WHERE login_key IN ('aggregate',key_value) AND window_started_at <= now() - interval '15 minutes'
        AND (blocked_until IS NULL OR blocked_until <= now());
    IF EXISTS (SELECT 1 FROM private.admin_login_attempts WHERE login_key IN ('aggregate',key_value)
        AND (blocked_until > now() OR failed_attempts >= CASE WHEN login_key='aggregate' THEN 30 ELSE 5 END)) THEN
        RETURN jsonb_build_object('ok',false,'error','Too many incorrect attempts. Try again later.');
    END IF;
    SELECT pin_hash INTO config_hash FROM private.admin_config WHERE singleton;
    IF config_hash IS NULL OR p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' OR extensions.crypt(p_pin,config_hash) <> config_hash THEN
        UPDATE private.admin_login_attempts SET failed_attempts=failed_attempts+1,
            blocked_until=CASE WHEN failed_attempts+1 >= CASE WHEN login_key='aggregate' THEN 30 ELSE 5 END THEN now()+interval '15 minutes' END
            WHERE login_key IN ('aggregate',key_value);
        RETURN jsonb_build_object('ok',false,'error','Incorrect admin PIN');
    END IF;
    DELETE FROM private.admin_sessions WHERE expires_at <= now();
    DELETE FROM private.admin_login_attempts WHERE login_key=key_value;
    token_value := encode(extensions.gen_random_bytes(32),'hex');
    INSERT INTO private.admin_sessions(token_hash,expires_at) VALUES(extensions.digest(token_value,'sha256'),expiry);
    RETURN jsonb_build_object('ok',true,'token',token_value,'expires_at',expiry);
END $$;

-- Preserve an existing webhook privately and remove its public copy in this
-- transaction. Even administrators get configuration status, never the secret.
CREATE TABLE private.discord_config(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), webhook_url text NOT NULL);
REVOKE ALL ON private.discord_config FROM PUBLIC, anon, authenticated;
INSERT INTO private.discord_config(singleton,webhook_url)
    SELECT true,value FROM public.settings WHERE key='discord_webhook_url' AND value <> '';
DELETE FROM public.settings WHERE key='discord_webhook_url';
-- Reserve the key so future accidental writes cannot re-expose a URL.
ALTER TABLE public.settings ADD CONSTRAINT no_public_discord_secret CHECK(key <> 'discord_webhook_url');

CREATE FUNCTION public.admin_discord_config(p_admin_token text, p_action text, p_url text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    IF p_action = 'update' THEN
        IF p_url IS NULL OR (p_url <> '' AND p_url !~ '^https://discord\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$') OR length(p_url)>2048 THEN RAISE EXCEPTION 'Invalid Discord webhook URL'; END IF;
        IF p_url = '' THEN DELETE FROM private.discord_config;
        ELSE INSERT INTO private.discord_config(singleton,webhook_url) VALUES(true,p_url) ON CONFLICT(singleton) DO UPDATE SET webhook_url=excluded.webhook_url; END IF;
    ELSIF p_action <> 'status' OR p_action IS NULL THEN RAISE EXCEPTION 'Invalid action'; END IF;
    RETURN jsonb_build_object('configured',EXISTS(SELECT 1 FROM private.discord_config));
END $$;
-- Only the Edge Function's service role can retrieve a delivery URL, and it
-- must STILL supply a valid custom admin session for every send.
CREATE FUNCTION public.discord_delivery_url(p_admin_token text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    RETURN (SELECT webhook_url FROM private.discord_config WHERE singleton);
END $$;
REVOKE ALL ON FUNCTION public.admin_discord_config(text,text,text), public.discord_delivery_url(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_discord_config(text,text,text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.discord_delivery_url(text) TO service_role;

COMMIT;
