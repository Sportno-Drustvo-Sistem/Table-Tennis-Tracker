-- Targeted smoke test for an existing Supabase project. All test rows roll back.
BEGIN;
SET LOCAL ROLE anon;
DO $$
DECLARE
    player public.users;
    rejected boolean;
    role_name text;
    table_name text;
BEGIN
    player := public.create_player(p_name => '  __add_player_smoke__  ', p_avatar_url => NULL);
    IF player.name <> '__add_player_smoke__' OR player.avatar_url IS NOT NULL
        OR player.elo_rating IS DISTINCT FROM 1200 OR player.total_wins IS DISTINCT FROM 0
        OR player.matches_played IS DISTINCT FROM 0 OR player.is_ranked IS DISTINCT FROM false THEN
        RAISE EXCEPTION 'Incorrect player defaults';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.padel_stats WHERE user_id = player.id AND elo_rating = 1200 AND total_wins = 0 AND matches_played = 0 AND is_ranked = false)
        OR NOT EXISTS (SELECT 1 FROM public.tennis_stats WHERE user_id = player.id AND elo_rating = 1200 AND total_wins = 0 AND matches_played = 0 AND is_ranked = false) THEN
        RAISE EXCEPTION 'Sport statistics were not initialized';
    END IF;

    player := public.create_player(p_name => '__add_player_avatar_smoke__', p_avatar_url => 'https://example.com/avatar.png');
    IF player.avatar_url <> 'https://example.com/avatar.png' THEN
        RAISE EXCEPTION 'Avatar was not attached';
    END IF;
    -- The optional second argument must also work when omitted.
    PERFORM public.create_player(p_name => '__add_player_default_smoke__');

    rejected := false;
    BEGIN PERFORM public.create_player(p_name => '   ');
    EXCEPTION WHEN raise_exception THEN rejected := true; END;
    IF NOT rejected THEN RAISE EXCEPTION 'Blank name accepted'; END IF;
    rejected := false;
    BEGIN PERFORM public.create_player(p_name => repeat('a', 121));
    EXCEPTION WHEN raise_exception THEN rejected := true; END;
    IF NOT rejected THEN RAISE EXCEPTION 'Overlong name accepted'; END IF;
    rejected := false;
    BEGIN PERFORM public.create_player(p_name => 'Invalid avatar', p_avatar_url => 'javascript:alert(1)');
    EXCEPTION WHEN raise_exception THEN rejected := true; END;
    IF NOT rejected THEN RAISE EXCEPTION 'Invalid avatar accepted'; END IF;
    rejected := false;
    BEGIN EXECUTE $q$SELECT public.create_player(p_name => 'Injected', p_avatar_url => NULL, p_elo_rating => 9999)$q$;
    EXCEPTION WHEN undefined_function THEN rejected := true; END;
    IF NOT rejected THEN RAISE EXCEPTION 'Custom rating accepted'; END IF;

    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF NOT has_function_privilege(role_name, 'public.create_player(text,text)', 'EXECUTE') THEN
            RAISE EXCEPTION 'Creation unavailable for %', role_name;
        END IF;
        FOREACH table_name IN ARRAY ARRAY['users', 'padel_stats', 'tennis_stats'] LOOP
            IF has_table_privilege(role_name, 'public.' || table_name, 'INSERT')
                OR has_table_privilege(role_name, 'public.' || table_name, 'UPDATE')
                OR has_table_privilege(role_name, 'public.' || table_name, 'DELETE') THEN
                RAISE EXCEPTION 'Direct table writes allowed for % on %', role_name, table_name;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;
SET LOCAL ROLE authenticated;
SELECT (public.create_player(p_name => '__add_player_authenticated_smoke__')).name;
ROLLBACK;
