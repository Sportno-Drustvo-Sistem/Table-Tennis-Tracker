-- Live score and bets from any phone: runs after betting.sql (needs the test
-- schema, the 'valid' admin session and the four test players).
-- betting.sql leaves dave at 0 and wallets no longer restart, so top him up
-- the way a super admin would.
UPDATE public.bet_wallets SET balance = 100 WHERE user_id = (SELECT id FROM test.players WHERE n=4);
SET ROLE anon;
SELECT test.rejects($q$INSERT INTO public.live_matches(id,player1_id,player2_id) VALUES(gen_random_uuid(),gen_random_uuid(),gen_random_uuid())$q$);
SELECT test.rejects($q$UPDATE public.live_matches SET win_probability=0.01$q$);

DO $$
DECLARE
    alice uuid := (SELECT id FROM test.players WHERE n=1);
    bob uuid := (SELECT id FROM test.players WHERE n=2);
    carol uuid := (SELECT id FROM test.players WHERE n=3);
    dave uuid := (SELECT id FROM test.players WHERE n=4);
    m1 uuid := gen_random_uuid();
    m2 uuid := gen_random_uuid();
    token text;
    result jsonb;
    carol_before integer;
BEGIN
    FOREACH token IN ARRAY ARRAY['invalid','expired','revoked'] LOOP
        PERFORM test.rejects(format('SELECT public.publish_live_match(%L,%L,%L,%L,''{}'')',token,m1,alice,bob));
        PERFORM test.rejects(format('SELECT public.end_live_match(%L,%L)',token,m1));
    END LOOP;

    -- No live match, no bet.
    PERFORM test.rejects(format('SELECT public.place_live_bet(%L,%L,1,10,NULL)',m1,carol));

    result := public.publish_live_match('valid',m1,alice,bob,'{"bestOf":3,"games1":1,"games2":0,"score1":4,"score2":2,"sets":[{"s1":11,"s2":7}],"server":2,"winProbability":0.8,"bettingClosed":false}');
    PERFORM test.assert((result->>'score1')::int=4 AND (result->>'games1')::int=1 AND (result->>'server')::int=2,'live state is stored');
    PERFORM test.rejects(format('SELECT public.publish_live_match(''valid'',%L,%L,%L,''{}'')',m1,alice,carol));

    -- Odds come from the live row: 0.8 for side 1 pays 1.25x, side 2 pays 5x.
    SELECT balance INTO carol_before FROM public.bet_wallets WHERE user_id=carol;
    carol_before := coalesce(carol_before,1000);
    result := public.place_live_bet(m1,carol,2,10,5.00);
    PERFORM test.assert((result->'bet'->>'multiplier')::numeric=5.00 AND (result->'wallet'->>'balance')::int=carol_before-10,'live bet priced from the live row');
    PERFORM test.assert((result->'bet'->'snapshot'->>'score1')::int=4,'snapshot taken from the live row');
    PERFORM test.assert(EXISTS(SELECT 1 FROM public.bet_markets WHERE id=m1 AND status='open' AND player1_id=alice),'first live bet opens the market');
    PERFORM test.rejects(format('SELECT public.place_live_bet(%L,%L,1,10,2.00)',m1,dave));
    PERFORM test.rejects(format('SELECT public.place_live_bet(%L,%L,2,10,NULL)',m1,alice));
    PERFORM test.rejects(format('SELECT public.place_live_bet(%L,%L,1,0,NULL)',m1,dave));
    PERFORM public.place_live_bet(m1,dave,1,20,1.25);
    -- Carol backs side 2, so side 1 is refused for her; dave backs side 1, so side 2 is refused.
    PERFORM test.rejects(format('SELECT public.place_live_bet(%L,%L,1,10,NULL)',m1,carol));
    PERFORM test.rejects(format('SELECT public.place_live_bet(%L,%L,2,10,NULL)',m1,dave));

    -- A debuff on the match stops all betting, from any phone.
    PERFORM public.publish_live_match('valid',m1,alice,bob,'{"bestOf":3,"games1":1,"games2":0,"score1":4,"score2":2,"winProbability":0.8,"bettingClosed":false,"debuffed":true}');
    PERFORM test.assert((SELECT debuffed FROM public.live_matches WHERE id=m1),'debuff is stored');
    PERFORM test.rejects(format('SELECT public.place_live_bet(%L,%L,1,10,NULL)',m1,dave));
    PERFORM test.rejects(format('SELECT public.place_bet(''valid'',%L,%L,%L,%L,1,10,0.8)',m1,alice,bob,dave));

    -- Match point closes betting.
    PERFORM public.publish_live_match('valid',m1,alice,bob,'{"bestOf":3,"games1":1,"games2":0,"score1":10,"score2":2,"winProbability":0.98,"bettingClosed":true}');
    PERFORM test.rejects(format('SELECT public.place_live_bet(%L,%L,1,10,NULL)',m1,dave));

    -- Leaving without saving refunds the open bets and removes the live row.
    result := public.end_live_match('valid',m1);
    PERFORM test.assert(NOT EXISTS(SELECT 1 FROM public.live_matches WHERE id=m1),'live row removed');
    PERFORM test.assert((SELECT status FROM public.bet_markets WHERE id=m1)='void','open market refunded');
    PERFORM test.assert((SELECT balance FROM public.bet_wallets WHERE user_id=carol)=carol_before,'stake given back');

    -- Saving pays live bets like any other; ending afterwards changes nothing.
    PERFORM public.publish_live_match('valid',m2,alice,bob,'{"winProbability":0.5}');
    PERFORM public.place_live_bet(m2,carol,1,10,2.00);
    PERFORM public.record_pingpong_match_with_bets('valid',m2,alice,bob,'[{"s1":11,"s2":5}]');
    PERFORM public.end_live_match('valid',m2);
    PERFORM test.assert((SELECT status FROM public.bet_markets WHERE id=m2)='settled','saved market stays settled');
    PERFORM test.assert((SELECT payout FROM public.bets WHERE market_id=m2 AND user_id=carol)=19,'live bet paid, less the 10% house cut');
END $$;
RESET ROLE;

-- A phone that went quiet stops taking bets.
DO $$
DECLARE
    m uuid := gen_random_uuid();
BEGIN
    PERFORM public.publish_live_match('valid',m,(SELECT id FROM test.players WHERE n=1),(SELECT id FROM test.players WHERE n=2),'{"winProbability":0.5}');
    UPDATE public.live_matches SET updated_at=now()-interval '1 hour' WHERE id=m;
    PERFORM test.rejects(format('SELECT public.place_live_bet(%L,%L,1,10,NULL)',m,(SELECT id FROM test.players WHERE n=4)));
    PERFORM public.end_live_match('valid',m);
END $$;

DO $$ DECLARE r text; BEGIN
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
        PERFORM test.assert(has_table_privilege(r,'public.live_matches','SELECT'),'public reads live_matches '||r);
        PERFORM test.assert(NOT has_table_privilege(r,'public.live_matches','INSERT') AND NOT has_table_privilege(r,'public.live_matches','UPDATE') AND NOT has_table_privilege(r,'public.live_matches','DELETE'),'protected live_matches writes '||r);
    END LOOP;
END $$;
