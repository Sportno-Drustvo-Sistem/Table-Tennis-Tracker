-- Runs after live_betting.sql using its admin sessions and test players.
RESET ROLE;
CREATE FUNCTION test.points(winners integer[])
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE winner integer; points jsonb:='[]';
BEGIN
    FOREACH winner IN ARRAY winners LOOP
        points:=points||jsonb_build_array(winner);
    END LOOP;
    RETURN points;
END $$;
SET ROLE anon;
DO $$
DECLARE
    alice uuid:=(SELECT id FROM test.players WHERE n=1);
    bob uuid:=(SELECT id FROM test.players WHERE n=2);
    carol uuid:=(SELECT id FROM test.players WHERE n=3);
    points jsonb:=test.points(array_fill(1,ARRAY[11]));
    deuce jsonb:=test.points(ARRAY[1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,1]);
    sets jsonb;
    result jsonb;
    saved uuid;
    market uuid:=gen_random_uuid();
    before_count integer;
    bad jsonb;
    token text;
BEGIN
    sets:=jsonb_build_array(jsonb_build_object('s1',11,'s2',0,'points',points));
    before_count:=(SELECT count(*) FROM public.matches);
    FOREACH token IN ARRAY ARRAY['invalid','expired','revoked'] LOOP
        PERFORM test.rejects(format('SELECT public.record_pingpong_match_with_points(%L,%L,%L,%L)',token,alice,bob,sets));
    END LOOP;
    PERFORM test.rejects(format('UPDATE public.matches SET point_history=%L',points));
    FOREACH bad IN ARRAY ARRAY[
        'null'::jsonb,'[]'::jsonb,'{}'::jsonb,
        '[3]'::jsonb,
        '["1"]'::jsonb,
        '[null]'::jsonb,
        points || '[3]'::jsonb,
        points #- '{0}',
        test.points(array_fill(1,ARRAY[12]))
    ] LOOP
        PERFORM test.rejects(format('SELECT public.record_pingpong_match_with_points(''valid'',%L,%L,%L)',alice,bob,jsonb_build_array(jsonb_build_object('s1',11,'s2',0,'points',bad))));
    END LOOP;
    PERFORM test.rejects(format('SELECT public.record_pingpong_match_with_points(''valid'',%L,%L,%L)',alice,bob,'[{"s1":11,"s2":0}]'));
    PERFORM test.rejects(format('SELECT public.record_pingpong_match_with_points(''valid'',%L,%L,%L)',alice,bob,jsonb_build_array(jsonb_build_object('s1',12,'s2',0,'points',test.points(array_fill(1,ARRAY[12]))))));
    PERFORM test.assert(before_count=(SELECT count(*) FROM public.matches),'rejected point histories created no games');

    -- Both sets keep only their ordered point winners, including deuce.
    result:=public.record_pingpong_match_with_points('valid',alice,bob,sets||jsonb_build_array(jsonb_build_object('s1',12,'s2',10,'points',deuce)));
    PERFORM test.assert(result->'matches'->0->'point_history'=points AND result->'matches'->1->'point_history'=deuce,'returned games preserve points in set order');
    PERFORM test.assert(result->'match'->'point_history'=deuce,'last saved match includes point history');
    saved:=(result->'matches'->0->>'id')::uuid;
    PERFORM test.assert((SELECT point_history=points FROM public.matches WHERE id=saved),'point history persisted');
    PERFORM public.update_pingpong_match('valid',saved,11,0);
    PERFORM test.assert((SELECT point_history=points FROM public.matches WHERE id=saved),'unchanged score preserves history');
    PERFORM public.update_pingpong_match('valid',saved,11,1);
    PERFORM test.assert((SELECT point_history IS NULL FROM public.matches WHERE id=saved),'score correction clears stale history');

    -- Invalid point histories must not record a score, settle bets or pay a wallet.
    PERFORM public.place_bet('valid',market,alice,bob,carol,1,10,0.5);
    before_count:=(SELECT count(*) FROM public.matches);
    PERFORM test.rejects(format('SELECT public.record_pingpong_match_with_points(''valid'',%L,%L,%L,NULL,NULL,%L)',alice,bob,'[{"s1":11,"s2":0,"points":[]}]',market));
    PERFORM test.assert(before_count=(SELECT count(*) FROM public.matches) AND (SELECT status='open' FROM public.bet_markets WHERE id=market),'bad history leaves score and bets unchanged');
    result:=public.record_pingpong_match_with_points('valid',alice,bob,sets,NULL,NULL,market);
    PERFORM test.assert(result->'match'->'point_history'=points AND result->'market'->>'status'='settled','points and bets saved atomically');

    result:=public.record_pingpong_match('valid',alice,bob,'[{"s1":11,"s2":3}]');
    PERFORM test.assert(result->'match'->'point_history'='null'::jsonb,'manual score entry remains untracked');
END $$;
RESET ROLE;
