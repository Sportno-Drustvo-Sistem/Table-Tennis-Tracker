-- Points betting: runs after remediation.sql (needs its test schema, the
-- 'valid' admin session and the four test players).
SET ROLE anon;
SELECT test.rejects($q$INSERT INTO public.bets(market_id,user_id,side,stake,win_probability,multiplier) VALUES(gen_random_uuid(),gen_random_uuid(),1,1,0.5,2)$q$);
SELECT test.rejects($q$UPDATE public.bet_wallets SET balance=999999$q$);
SELECT test.rejects($q$SELECT private.settle_bet_market(gen_random_uuid())$q$);

DO $$
DECLARE
    alice uuid := (SELECT id FROM test.players WHERE n=1);
    bob uuid := (SELECT id FROM test.players WHERE n=2);
    carol uuid := (SELECT id FROM test.players WHERE n=3);
    dave uuid := (SELECT id FROM test.players WHERE n=4);
    m1 uuid := gen_random_uuid();
    m2 uuid := gen_random_uuid();
    m3 uuid := gen_random_uuid();
    m4 uuid := gen_random_uuid();
    token text;
    result jsonb;
    extra uuid;
    saved uuid;
    matches_before integer;
BEGIN
    FOREACH token IN ARRAY ARRAY['invalid','expired','revoked'] LOOP
        PERFORM test.rejects(format('SELECT public.place_bet(%L,%L,%L,%L,%L,1,10,0.5)',token,m1,alice,bob,carol));
        PERFORM test.rejects(format('SELECT public.void_bet_market(%L,%L)',token,m1));
        PERFORM test.rejects(format('SELECT public.record_pingpong_match_with_bets(%L,%L,%L,%L,''[{"s1":11,"s2":5}]'')',token,m1,alice,bob));
    END LOOP;
    PERFORM test.assert(NOT EXISTS(SELECT 1 FROM public.bet_markets),'rejected bets create no market');

    -- Placing: wallet starts at 1000, multiplier comes from the probability.
    result := public.place_bet('valid',m1,alice,bob,carol,1,100,0.5,'{"score1":3,"score2":2}');
    PERFORM test.assert((result->'wallet'->>'balance')::int=900 AND (result->'bet'->>'multiplier')::numeric=2.00,'stake leaves the wallet at 2.00x');
    result := public.place_bet('valid',m1,alice,bob,dave,2,50,0.25);
    PERFORM test.assert((result->'bet'->>'multiplier')::numeric=4.00,'underdog pays 4.00x');
    PERFORM test.assert((public.place_bet('valid',m4,alice,bob,carol,1,1,0.99)->'bet'->>'multiplier')::numeric=1.05 AND (public.place_bet('valid',m4,alice,bob,carol,2,1,0.05)->'bet'->>'multiplier')::numeric=10,'multiplier is clamped');
    PERFORM public.void_bet_market('valid',m4);
    m4 := gen_random_uuid();

    PERFORM test.rejects(format('SELECT public.place_bet(''valid'',%L,%L,%L,%L,2,10,0.5)',m1,alice,bob,alice));
    PERFORM test.rejects(format('SELECT public.place_bet(''valid'',%L,%L,%L,%L,1,10,0.5)',m1,alice,bob,bob));
    PERFORM test.rejects(format('SELECT public.place_bet(''valid'',%L,%L,%L,%L,2,951,0.5)',m1,alice,bob,dave));
    PERFORM test.rejects(format('SELECT public.place_bet(''valid'',%L,%L,%L,%L,2,0,0.5)',m1,alice,bob,dave));
    PERFORM test.rejects(format('SELECT public.place_bet(''valid'',%L,%L,%L,%L,3,10,0.5)',m1,alice,bob,dave));
    PERFORM test.rejects(format('SELECT public.place_bet(''valid'',%L,%L,%L,%L,2,10,0.999)',m1,alice,bob,dave));
    PERFORM test.rejects(format('SELECT public.place_bet(''valid'',%L,%L,%L,%L,2,10,0.5)',m1,bob,alice,dave));
    PERFORM test.rejects(format('SELECT public.place_bet(''valid'',%L,%L,%L,%L,2,10,0.5)',gen_random_uuid(),alice,alice,dave));

    -- Removing a bet gives the stake back.
    extra := (public.place_bet('valid',m1,alice,bob,dave,2,10,0.5)->'bet'->>'id')::uuid;
    PERFORM test.assert((public.cancel_bet('valid',extra)->'wallet'->>'balance')::int=950,'cancel refunds the stake');
    PERFORM test.rejects(format('SELECT public.cancel_bet(''valid'',%L)',extra));

    -- A failed save changes neither matches nor bets.
    matches_before := (SELECT count(*) FROM public.matches);
    PERFORM test.rejects(format('SELECT public.record_pingpong_match_with_bets(''valid'',%L,%L,%L,''[{"s1":11,"s2":11}]'')',m1,alice,bob));
    PERFORM test.rejects(format('SELECT public.record_pingpong_match_with_bets(''valid'',%L,%L,%L,''[{"s1":11,"s2":5}]'')',m1,bob,alice));
    PERFORM test.assert(matches_before=(SELECT count(*) FROM public.matches) AND (SELECT status FROM public.bet_markets WHERE id=m1)='open','failed save leaves the market open');

    -- Saving pays the winner's backers in the same call.
    result := public.record_pingpong_match_with_bets('valid',m1,alice,bob,'[{"s1":11,"s2":5}]');
    saved := (result->'match'->>'id')::uuid;
    PERFORM test.assert(result->'market'->>'status'='settled' AND (result->'market'->>'winner_side')::int=1 AND jsonb_array_length(result->'bets')=2,'save returns the settled market');
    PERFORM test.assert((SELECT balance FROM public.bet_wallets WHERE user_id=carol)=1100 AND (SELECT balance FROM public.bet_wallets WHERE user_id=dave)=950,'winner paid, loser not');
    PERFORM test.rejects(format('SELECT public.place_bet(''valid'',%L,%L,%L,%L,1,10,0.5)',m1,alice,bob,carol));
    PERFORM test.rejects(format('SELECT public.void_bet_market(''valid'',%L)',m1));
    PERFORM test.rejects(format('SELECT public.record_pingpong_match_with_bets(''valid'',%L,%L,%L,''[{"s1":11,"s2":5}]'')',m1,alice,bob));

    -- Flipping the score moves the payout to the other side.
    PERFORM public.update_pingpong_match('valid',saved,5,11);
    PERFORM test.assert((SELECT balance FROM public.bet_wallets WHERE user_id=carol)=900 AND (SELECT balance FROM public.bet_wallets WHERE user_id=dave)=1150 AND (SELECT winner_side FROM public.bet_markets WHERE id=m1)=2,'edited result re-pays bets');

    -- Deleting the match refunds everyone.
    PERFORM public.delete_pingpong_matches('valid',ARRAY[saved]);
    PERFORM test.assert((SELECT balance FROM public.bet_wallets WHERE user_id=carol)=1000 AND (SELECT balance FROM public.bet_wallets WHERE user_id=dave)=1000 AND (SELECT status FROM public.bet_markets WHERE id=m1)='void' AND NOT EXISTS(SELECT 1 FROM public.bets WHERE market_id=m1 AND status<>'void'),'deleted match refunds bets');

    -- Abandoned match: everything goes back.
    PERFORM public.place_bet('valid',m2,alice,bob,carol,1,300,0.6);
    PERFORM public.place_bet('valid',m2,alice,bob,alice,1,200,0.6);
    result := public.void_bet_market('valid',m2);
    PERFORM test.assert(result->'market'->>'status'='void' AND (SELECT balance FROM public.bet_wallets WHERE user_id=carol)=1000 AND (SELECT balance FROM public.bet_wallets WHERE user_id=alice)=1000,'void refunds every bet');

    -- Best of three is decided on sets, and a broke bettor restarts at 100.
    PERFORM public.place_bet('valid',m3,alice,bob,dave,2,1000,0.5);
    PERFORM public.place_bet('valid',m3,alice,bob,carol,1,100,0.8);
    result := public.record_pingpong_match_with_bets('valid',m3,alice,bob,'[{"s1":11,"s2":5},{"s1":5,"s2":11},{"s1":11,"s2":7}]');
    PERFORM test.assert((result->'market'->>'winner_side')::int=1 AND jsonb_array_length(result->'matches')=3,'best of three settles on sets won');
    PERFORM test.assert((SELECT balance FROM public.bet_wallets WHERE user_id=carol)=1025,'1.25x payout');
    PERFORM test.assert((SELECT balance=100 AND rebuys=1 FROM public.bet_wallets WHERE user_id=dave),'empty wallet restarts at 100');

    -- Without any bets the wrapper behaves like a plain save.
    result := public.record_pingpong_match_with_bets('valid',m4,alice,bob,'[{"s1":11,"s2":9}]');
    PERFORM test.assert(result ? 'match' AND NOT result ? 'market' AND NOT EXISTS(SELECT 1 FROM public.bet_markets WHERE id=m4),'no bets, no market');
END $$;
RESET ROLE;

DO $$ DECLARE r text; t text; BEGIN
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
        FOREACH t IN ARRAY ARRAY['bet_wallets','bet_markets','bets'] LOOP
            PERFORM test.assert(has_table_privilege(r,'public.'||t,'SELECT'),'public reads '||r||' '||t);
            PERFORM test.assert(NOT has_table_privilege(r,'public.'||t,'INSERT') AND NOT has_table_privilege(r,'public.'||t,'UPDATE') AND NOT has_table_privilege(r,'public.'||t,'DELETE') AND NOT has_table_privilege(r,'public.'||t,'TRUNCATE'),'protected writes '||r||' '||t);
        END LOOP;
    END LOOP;
END $$;
