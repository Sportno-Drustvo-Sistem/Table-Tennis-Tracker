-- Runs after live_betting.sql using its admin sessions and test players.
RESET ROLE;
CREATE FUNCTION test.rallies(winners integer[], first_server integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE a integer:=0; b integer:=0; winner integer; server integer; points jsonb:='[]';
BEGIN
    FOREACH winner IN ARRAY winners LOOP
        server:=CASE WHEN (CASE WHEN a>=10 AND b>=10 THEN a+b ELSE (a+b)/2 END)%2=0 THEN first_server ELSE 3-first_server END;
        points:=points||jsonb_build_array(jsonb_build_object('winner',winner,'server',server,'type','winner'));
        IF winner=1 THEN a:=a+1; ELSE b:=b+1; END IF;
    END LOOP;
    RETURN points;
END $$;
SET ROLE anon;
DO $$
DECLARE
    alice uuid:=(SELECT id FROM test.players WHERE n=1);
    bob uuid:=(SELECT id FROM test.players WHERE n=2);
    carol uuid:=(SELECT id FROM test.players WHERE n=3);
    points jsonb:=test.rallies(array_fill(1,ARRAY[11]));
    deuce jsonb:=test.rallies(ARRAY[1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,1],2);
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
        jsonb_set(points,'{0,winner}','3'),
        jsonb_set(points,'{0,server}','"1"'),
        jsonb_set(points,'{2,server}','1'),
        jsonb_set(points,'{0,type}','"invalid"'),
        points #- '{0,type}',
        jsonb_set(points,'{2,type}','"ace"'),
        jsonb_set(points,'{0,type}','"serve_fault"')
    ] LOOP
        PERFORM test.rejects(format('SELECT public.record_pingpong_match_with_points(''valid'',%L,%L,%L)',alice,bob,jsonb_build_array(jsonb_build_object('s1',11,'s2',0,'points',bad))));
    END LOOP;
    PERFORM test.rejects(format('SELECT public.record_pingpong_match_with_points(''valid'',%L,%L,%L)',alice,bob,'[{"s1":11,"s2":0}]'));
    PERFORM test.rejects(format('SELECT public.record_pingpong_match_with_points(''valid'',%L,%L,%L)',alice,bob,jsonb_build_array(jsonb_build_object('s1',12,'s2',0,'points',test.rallies(array_fill(1,ARRAY[12]))))));
    PERFORM test.assert(before_count=(SELECT count(*) FROM public.matches),'rejected rally saves created no games');

    -- Both sets keep their own full history, including deuce and reversed service.
    result:=public.record_pingpong_match_with_points('valid',alice,bob,sets||jsonb_build_array(jsonb_build_object('s1',12,'s2',10,'points',deuce)));
    PERFORM test.assert(result->'matches'->0->'point_history'=points AND result->'matches'->1->'point_history'=deuce,'returned games preserve rallies in set order');
    PERFORM test.assert(result->'match'->'point_history'=deuce,'last saved match includes rallies');
    saved:=(result->'matches'->0->>'id')::uuid;
    PERFORM test.assert((SELECT point_history=points FROM public.matches WHERE id=saved),'history persisted');
    PERFORM public.update_pingpong_match('valid',saved,11,0);
    PERFORM test.assert((SELECT point_history=points FROM public.matches WHERE id=saved),'unchanged score preserves history');
    PERFORM public.update_pingpong_match('valid',saved,11,1);
    PERFORM test.assert((SELECT point_history IS NULL FROM public.matches WHERE id=saved),'score correction clears stale history');

    -- Invalid rallies must not record a score, settle bets or pay a wallet.
    PERFORM public.place_bet('valid',market,alice,bob,carol,1,10,0.5);
    before_count:=(SELECT count(*) FROM public.matches);
    PERFORM test.rejects(format('SELECT public.record_pingpong_match_with_points(''valid'',%L,%L,%L,NULL,NULL,%L)',alice,bob,'[{"s1":11,"s2":0,"points":[]}]',market));
    PERFORM test.assert(before_count=(SELECT count(*) FROM public.matches) AND (SELECT status='open' FROM public.bet_markets WHERE id=market),'bad history leaves score and bets unchanged');
    result:=public.record_pingpong_match_with_points('valid',alice,bob,sets,NULL,NULL,market);
    PERFORM test.assert(result->'match'->'point_history'=points AND result->'market'->>'status'='settled','rallies and bets saved atomically');

    result:=public.record_pingpong_match('valid',alice,bob,'[{"s1":11,"s2":3}]');
    PERFORM test.assert(result->'match'->'point_history'='null'::jsonb,'manual score entry remains untracked');
END $$;
RESET ROLE;
