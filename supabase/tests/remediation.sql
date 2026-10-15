CREATE SCHEMA test;
GRANT USAGE ON SCHEMA test TO anon,authenticated,service_role;
CREATE FUNCTION test.assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
    IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',message; END IF;
END $$;
CREATE FUNCTION test.rejects(statement text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE rejected boolean:=false;
BEGIN
    BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN rejected:=true; END;
    IF NOT rejected THEN RAISE EXCEPTION 'Unexpectedly allowed: %',statement; END IF;
END $$;
CREATE TABLE test.players(n integer PRIMARY KEY,id uuid);
CREATE TABLE test.recorded(sport text PRIMARY KEY,id uuid);
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA test TO anon,authenticated;

-- Known test-only sessions; production sessions/secrets are never touched.
INSERT INTO private.admin_sessions(token_hash,expires_at) VALUES
(extensions.digest('valid','sha256'),now()+interval '1 hour'),
(extensions.digest('expired','sha256'),now()-interval '1 hour'),
(extensions.digest('revoked','sha256'),now()+interval '1 hour');
SET ROLE anon;
SELECT public.revoke_admin_session('revoked');
SELECT test.assert(public.validate_admin_session('valid'),'valid session');
SELECT test.assert(NOT public.validate_admin_session('expired') AND NOT public.validate_admin_session('revoked') AND NOT public.validate_admin_session('invalid') AND NOT public.validate_admin_session(NULL),'invalid/expired/revoked/missing sessions');
-- Fresh case starts with zero users; first public creation needs no implicit grant.
INSERT INTO test.players SELECT 1,id FROM public.create_player('Alice',NULL);
INSERT INTO test.players SELECT 2,id FROM public.create_player('Bob',NULL);
INSERT INTO test.players SELECT 3,id FROM public.create_player('Carol',NULL);
INSERT INTO test.players SELECT 4,id FROM public.create_player('Dave',NULL);
SELECT test.assert((SELECT count(*)=4 AND min(elo_rating)=1200 AND max(total_wins)=0 FROM public.users WHERE id IN(SELECT id FROM test.players)),'server initializes player stats');
SELECT test.assert((SELECT count(*)=4 FROM public.padel_stats WHERE user_id IN(SELECT id FROM test.players)),'padel initialized');
SELECT test.rejects($q$SELECT public.create_player(p_name=>'Injected',p_avatar_url=>NULL,p_elo_rating=>9999)$q$);
SELECT test.rejects($q$INSERT INTO public.users(name,elo_rating) VALUES('Injected',9999)$q$);
SELECT test.rejects($q$UPDATE public.users SET elo_rating=9999$q$);
SELECT test.rejects($q$DELETE FROM public.tournaments$q$);
SELECT test.rejects($q$SELECT public.recalculate_padel_stats()$q$);
SELECT test.rejects($q$SELECT public.recalculate_tennis_stats()$q$);
SELECT test.rejects($q$SELECT public.recalculate_pingpong_stats()$q$);
SELECT test.rejects($q$SELECT public.discord_delivery_url('valid')$q$);
SELECT test.assert(NOT EXISTS(SELECT 1 FROM public.settings WHERE key='discord_webhook_url'),'webhook removed from public settings');
SELECT test.rejects($q$SELECT * FROM private.discord_config$q$);
-- Check every guarded mutation with each invalid session state.
DO $$ DECLARE token text; p uuid:=(SELECT id FROM test.players WHERE n=1); m uuid:=gen_random_uuid(); BEGIN
    FOREACH token IN ARRAY ARRAY[NULL,'invalid','expired','revoked'] LOOP
        PERFORM test.rejects(format('SELECT public.update_player(%L,%L,''Changed'',NULL)',token,p));
        PERFORM test.rejects(format('SELECT public.admin_discord_config(%L,''status'')',token));
        PERFORM test.rejects(format('SELECT public.admin_discord_config(%L,''update'','''')',token));
        PERFORM test.rejects(format('SELECT public.save_debuff(%L,NULL,''{}'')',token));
        PERFORM test.rejects(format('SELECT public.delete_debuff(%L,%L)',token,m));
        PERFORM test.rejects(format('SELECT public.update_padel_match(%L,%L,6,0,''best_of_1'',''[]'')',token,m));
        PERFORM test.rejects(format('SELECT public.update_tennis_match(%L,%L,6,0,''best_of_1'',''[]'')',token,m));
        PERFORM test.rejects(format('SELECT public.admin_recalculate_padel_stats(%L)',token));
        PERFORM test.rejects(format('SELECT public.admin_recalculate_tennis_stats(%L)',token));
        PERFORM test.rejects(format('SELECT public.delete_padel_matches(%L,ARRAY[]::uuid[])',token));
        PERFORM test.rejects(format('SELECT public.delete_tennis_matches(%L,ARRAY[]::uuid[])',token));
        PERFORM test.rejects(format('SELECT public.record_pingpong_match(%L,%L,%L,''[{"s1":11,"s2":8}]'')',token,p,m));
        PERFORM test.rejects(format('SELECT public.record_tennis_match(%L,%L,%L,6,0,''best_of_1'',''[]'')',token,p,m));
        PERFORM test.rejects(format('SELECT public.record_padel_match(%L,%L,%L,%L,%L,6,0,''best_of_1'',''[]'')',token,p,m,p,m));
    END LOOP;
END $$;
SELECT public.update_player('valid',(SELECT id FROM test.players WHERE n=1),'Alice Updated',NULL);
SELECT public.save_debuff('valid',NULL,'{"title":"Test","description":"Test rule","severity":5,"trigger_types":["mayhem"],"is_active":true}');
SELECT public.save_debuff('valid',(SELECT id FROM public.debuffs WHERE title='Test'),' {"title":"Updated Test","description":"Updated rule","severity":6,"trigger_types":["mayhem"],"is_active":false}');
SELECT public.delete_debuff('valid',(SELECT id FROM public.debuffs WHERE title='Updated Test'));
SELECT test.assert(public.admin_discord_config('valid','update','https://discord.com/api/webhooks/123/test-token')='{"configured":true}'::jsonb,'admin configuration');
SELECT test.assert(public.admin_discord_config('valid','status')='{"configured":true}'::jsonb,'status only');

-- Create-only avatars; raw table checks simulate Storage RLS. Real Storage HTTP
-- upsert/mime behavior still needs the documented local Supabase smoke test.
INSERT INTO storage.objects(bucket_id,name) VALUES('avatars','create/00000000-0000-0000-0000-000000000001.png');
SELECT test.rejects($q$INSERT INTO storage.objects(bucket_id,name) VALUES('avatars','create/00000000-0000-0000-0000-000000000001.png')$q$);
WITH changed AS (UPDATE storage.objects SET name='replaced.png' WHERE bucket_id='avatars' RETURNING *) SELECT test.assert(count(*)=0,'avatar update denied') FROM changed;
WITH removed AS (DELETE FROM storage.objects WHERE bucket_id='avatars' RETURNING *) SELECT test.assert(count(*)=0,'avatar delete denied') FROM removed;
SELECT test.rejects($q$INSERT INTO storage.objects(bucket_id,name) VALUES('avatars','arbitrary.png')$q$);

-- Actual match creation and transactional edits under a valid opaque token.
INSERT INTO test.recorded SELECT 'padel',(public.record_padel_match('valid',a.id,b.id,c.id,d.id,12,14,'best_of_3','[{"team1Games":6,"team2Games":4},{"team1Games":0,"team2Games":6},{"team1Games":6,"team2Games":4}]')->'match'->>'id')::uuid FROM test.players a,test.players b,test.players c,test.players d WHERE a.n=1 AND b.n=2 AND c.n=3 AND d.n=4;
INSERT INTO test.recorded SELECT 'tennis',(public.record_tennis_match('valid',a.id,b.id,12,14,'best_of_3','[{"player1Games":6,"player2Games":4},{"player1Games":0,"player2Games":6},{"player1Games":6,"player2Games":4}]')->'match'->>'id')::uuid FROM test.players a,test.players b WHERE a.n=1 AND b.n=2;
SELECT test.assert((SELECT elo_rating=1216 AND total_wins=1 FROM public.tennis_stats WHERE user_id=(SELECT id FROM test.players WHERE n=1)),'SQL set winner gains ELO');
SELECT test.assert((SELECT elo_rating=1216 AND total_wins=1 FROM public.padel_stats WHERE user_id=(SELECT id FROM test.players WHERE n=1)),'SQL padel winner gains ELO');
SELECT public.update_tennis_match('valid',(SELECT id FROM test.recorded WHERE sport='tennis'),8,12,'best_of_3','[{"player1Games":4,"player2Games":6},{"player1Games":4,"player2Games":6}]');
SELECT public.update_padel_match('valid',(SELECT id FROM test.recorded WHERE sport='padel'),8,12,'best_of_3','[{"team1Games":4,"team2Games":6},{"team1Games":4,"team2Games":6}]');
SELECT test.assert((SELECT elo_rating=1184 AND total_wins=0 FROM public.tennis_stats WHERE user_id=(SELECT id FROM test.players WHERE n=1)),'tennis edit rebuild');
SELECT test.assert((SELECT elo_rating=1184 AND total_wins=0 FROM public.padel_stats WHERE user_id=(SELECT id FROM test.players WHERE n=1)),'padel edit rebuild');
DO $$ DECLARE before_stats jsonb; before_matches jsonb; bad jsonb; a uuid:=(SELECT id FROM test.players WHERE n=1); b uuid:=(SELECT id FROM test.players WHERE n=2); BEGIN
    SELECT jsonb_agg(to_jsonb(s) ORDER BY user_id) INTO before_stats FROM public.tennis_stats s;
    SELECT jsonb_agg(to_jsonb(m) ORDER BY id) INTO before_matches FROM public.tennis_matches m;
    PERFORM test.rejects(format('SELECT public.update_tennis_match(''valid'',%L,0,0,''best_of_3'',''[{"player1Games":0,"player2Games":0}]'')',(SELECT id FROM test.recorded WHERE sport='tennis')));
    PERFORM test.assert(before_stats=(SELECT jsonb_agg(to_jsonb(s) ORDER BY user_id) FROM public.tennis_stats s),'failed tennis edit retains stats');
    PERFORM test.assert(before_matches=(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.tennis_matches m),'failed tennis edit retains match');
    SELECT jsonb_agg(to_jsonb(s) ORDER BY user_id) INTO before_stats FROM public.padel_stats s;
    SELECT jsonb_agg(to_jsonb(m) ORDER BY id) INTO before_matches FROM public.padel_matches m;
    PERFORM test.rejects(format('SELECT public.update_padel_match(''valid'',%L,6,-1,''best_of_1'',''[]'')',(SELECT id FROM test.recorded WHERE sport='padel')));
    PERFORM test.assert(before_stats=(SELECT jsonb_agg(to_jsonb(s) ORDER BY user_id) FROM public.padel_stats s),'failed padel edit retains stats');
    PERFORM test.assert(before_matches=(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.padel_matches m),'failed padel edit retains match');
    SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]') INTO before_matches FROM public.matches m;
    SELECT jsonb_agg(to_jsonb(u) ORDER BY id) INTO before_stats FROM public.users u;
    FOR bad IN SELECT value FROM jsonb_array_elements('[{"s1":null,"s2":0},{"s1":"","s2":0},{"s1":-1,"s2":3},{"s1":1.5,"s2":2},{"s1":3,"s2":3},{"s1":"NaN","s2":0},{"s1":"Infinity","s2":0},{}]') LOOP
        PERFORM test.rejects(format('SELECT public.record_pingpong_match(''valid'',%L,%L,%L::jsonb)',a,b,jsonb_build_array(jsonb_build_object('s1',11,'s2',8),bad)));
    END LOOP;
    PERFORM test.assert(before_matches=(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]') FROM public.matches m),'invalid multi-set RPC creates no partial matches');
    PERFORM test.assert(before_stats=(SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM public.users u),'invalid RPC leaves player stats unchanged');
END $$;
SELECT public.record_pingpong_match('valid',(SELECT id FROM test.players WHERE n=1),(SELECT id FROM test.players WHERE n=2),'[{"s1":11,"s2":8}]');
-- Restore the canonical counterexample and an equal-games set win for JS parity.
SELECT public.update_tennis_match('valid',(SELECT id FROM test.recorded WHERE sport='tennis'),12,14,'best_of_3','[{"player1Games":6,"player2Games":4},{"player1Games":0,"player2Games":6},{"player1Games":6,"player2Games":4}]');
SELECT public.update_padel_match('valid',(SELECT id FROM test.recorded WHERE sport='padel'),14,14,'best_of_3','[{"team1Games":6,"team2Games":4},{"team1Games":2,"team2Games":6},{"team1Games":6,"team2Games":4}]');
RESET ROLE;
-- Every protected table explicitly denies legacy direct grants to both roles.
DO $$ DECLARE r text; t text; BEGIN
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
        FOREACH t IN ARRAY ARRAY['users','matches','tournaments','tournament_results','padel_matches','tennis_matches','padel_stats','tennis_stats','settings','debuffs','pingpong_seasons','pingpong_season_snapshots'] LOOP
            PERFORM test.assert(has_table_privilege(r,'public.'||t,'SELECT'),'public reads '||r||' '||t);
            PERFORM test.assert(NOT has_table_privilege(r,'public.'||t,'INSERT') AND NOT has_table_privilege(r,'public.'||t,'UPDATE') AND NOT has_table_privilege(r,'public.'||t,'DELETE') AND NOT has_table_privilege(r,'public.'||t,'TRUNCATE'),'protected writes '||r||' '||t);
        END LOOP;
    END LOOP;
END $$;
SET ROLE authenticated;
SELECT test.rejects($q$UPDATE public.users SET total_wins=999$q$);
SELECT test.rejects($q$INSERT INTO public.settings(key,value) VALUES('discord_webhook_url','secret')$q$);
SELECT test.rejects($q$SELECT public.update_player(NULL,(SELECT id FROM test.players LIMIT 1),'Changed',NULL)$q$);
WITH changed AS (UPDATE storage.objects SET name='replaced.png' RETURNING *) SELECT test.assert(count(*)=0,'authenticated avatar update denied') FROM changed;
WITH removed AS (DELETE FROM storage.objects RETURNING *) SELECT test.assert(count(*)=0,'authenticated avatar delete denied') FROM removed;
RESET ROLE;
SET ROLE service_role;
SELECT test.rejects($q$SELECT public.discord_delivery_url('expired')$q$);
SELECT test.assert(public.discord_delivery_url('valid')='https://discord.com/api/webhooks/123/test-token','service delivery requires valid custom token');
RESET ROLE;

-- PIN transitions: headers must not reset quotas. bcrypt uses test-only low cost.
UPDATE private.admin_config SET pin_hash=extensions.crypt('654321',extensions.gen_salt('bf',4));
TRUNCATE private.admin_login_attempts;
SET ROLE anon;
DO $$ DECLARE i integer; result jsonb; BEGIN
    FOR i IN 1..8 LOOP
        PERFORM set_config('request.headers',jsonb_build_object('user-agent','changed-'||i,'x-forwarded-for','192.0.2.'||i)::text,true);
        result:=public.create_admin_session('000000');
        PERFORM test.assert(NOT (result->>'ok')::boolean,'bad PIN rejected');
    END LOOP;
    result:=public.create_admin_session('654321');
    PERFORM test.assert(result->>'error' LIKE 'Too many%','correct PIN blocked during lockout');
END $$;
RESET ROLE;
SELECT test.assert((SELECT failed_attempts=5 FROM private.admin_login_attempts WHERE login_key=private.admin_login_key()),'changed UA/forwarded IP does not reset peer quota');
UPDATE private.admin_login_attempts SET window_started_at=now()-interval '31 minutes',blocked_until=now()-interval '1 minute';
SET ROLE anon;
SELECT test.assert((public.create_admin_session('654321')->>'ok')::boolean,'quota expires');
RESET ROLE;
TRUNCATE private.admin_login_attempts;
INSERT INTO private.admin_login_attempts(login_key,failed_attempts) VALUES('aggregate',30);
SET ROLE anon;
SELECT test.assert(public.create_admin_session('654321')->>'error' LIKE 'Too many%','independent aggregate limit');
RESET ROLE;

-- Audit every exposed definer function from this chain for a session guard;
-- explicitly narrow public creation and session lifecycle APIs are exceptions.
SELECT test.assert(NOT EXISTS(
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND p.proname NOT IN ('create_player','create_admin_session','validate_admin_session','revoke_admin_session')
      AND pg_get_functiondef(p.oid) NOT LIKE '%private.require_admin_session%'
),'no alternate unguarded public definer write RPC');
