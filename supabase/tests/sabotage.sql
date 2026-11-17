-- Sabotage shop: runs after live_betting.sql (needs the test schema, the
-- 'valid' admin session and the four test players).
SET ROLE anon;
SELECT test.rejects($q$INSERT INTO public.sabotages(live_match_id,player1_id,player2_id,buyer_id,target_id,item_id,title,description,points,price,start_point,end_point) SELECT gen_random_uuid(),id,id,id,id,'half_table','x','x',1,1,0,1 FROM test.players WHERE n=1$q$);
SELECT test.rejects($q$UPDATE public.sabotage_items SET price_per_point=1$q$);

DO $$
DECLARE
    alice uuid := (SELECT id FROM test.players WHERE n=1);
    bob uuid := (SELECT id FROM test.players WHERE n=2);
    carol uuid := (SELECT id FROM test.players WHERE n=3);
    m uuid := gen_random_uuid();
    result jsonb;
    carol_before integer;
    bob_before integer;
    elo_before integer;
BEGIN
    -- No live match, no purchase.
    PERFORM test.rejects(format('SELECT public.buy_sabotage(%L,%L,%L,''half_table'',3,NULL)',m,carol,bob));

    -- 11-7 first game, 4-2 in the second: 24 points played.
    PERFORM public.publish_live_match('valid',m,alice,bob,'{"bestOf":3,"games1":1,"games2":0,"score1":4,"score2":2,"sets":[{"s1":11,"s2":7}],"winProbability":0.7}');
    INSERT INTO public.bet_wallets(user_id) VALUES (carol),(bob) ON CONFLICT (user_id) DO NOTHING;
    SELECT balance INTO carol_before FROM public.bet_wallets WHERE user_id=carol;
    SELECT balance INTO bob_before FROM public.bet_wallets WHERE user_id=bob;
    SELECT elo_rating INTO elo_before FROM public.users WHERE id=bob;

    result := public.buy_sabotage(m,carol,bob,'half_table',3,150);
    PERFORM test.assert((result->'sabotage'->>'start_point')::int=24 AND (result->'sabotage'->>'end_point')::int=27,'debuff starts at the points played so far');
    PERFORM test.assert((SELECT balance FROM public.bet_wallets WHERE user_id=carol)=carol_before-150,'buyer pays the price');
    PERFORM test.assert((SELECT balance FROM public.bet_wallets WHERE user_id=bob)=bob_before+150,'debuffed player receives the price');
    PERFORM test.assert((SELECT elo_rating FROM public.users WHERE id=bob) IS NOT DISTINCT FROM elo_before,'ELO untouched');

    -- A second debuff on the same player queues after the first.
    result := public.buy_sabotage(m,alice,bob,'forehand',2,80);
    PERFORM test.assert((result->'sabotage'->>'start_point')::int=27 AND (result->'sabotage'->>'end_point')::int=29,'debuffs queue');

    PERFORM test.rejects(format('SELECT public.buy_sabotage(%L,%L,%L,''half_table'',3,NULL)',m,bob,bob));
    PERFORM test.rejects(format('SELECT public.buy_sabotage(%L,%L,%L,''half_table'',3,NULL)',m,bob,carol));
    PERFORM test.rejects(format('SELECT public.buy_sabotage(%L,%L,%L,''half_table'',99,NULL)',m,carol,alice));
    PERFORM test.rejects(format('SELECT public.buy_sabotage(%L,%L,%L,''half_table'',3,1)',m,carol,alice));
    PERFORM test.rejects(format('SELECT public.buy_sabotage(%L,%L,%L,''nope'',1,NULL)',m,carol,alice));
    -- Items taken off the menu are not for sale.
    PERFORM test.rejects(format('SELECT public.buy_sabotage(%L,%L,%L,''underarm'',1,NULL)',m,carol,alice));
    PERFORM test.assert((SELECT count(*) FROM public.sabotage_items WHERE is_active)=9,'nine debuffs on the menu');
    -- The buyer keeps at least one point.
    UPDATE public.bet_wallets SET balance=150 WHERE user_id=carol;
    PERFORM test.rejects(format('SELECT public.buy_sabotage(%L,%L,%L,''half_table'',3,NULL)',m,carol,alice));

    -- A finished match sells nothing.
    PERFORM public.publish_live_match('valid',m,alice,bob,'{"bestOf":3,"games1":2,"games2":0,"sets":[{"s1":11,"s2":7},{"s1":11,"s2":3}],"winProbability":0.99,"winnerSide":1,"bettingClosed":true}');
    PERFORM test.rejects(format('SELECT public.buy_sabotage(%L,%L,%L,''no_serve'',1,NULL)',m,bob,alice));
    PERFORM public.end_live_match('valid',m);
    PERFORM test.assert((SELECT count(*) FROM public.sabotages WHERE live_match_id=m)=2,'purchases stay as history');
END $$;
RESET ROLE;

DO $$ DECLARE r text; t text; BEGIN
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
        FOREACH t IN ARRAY ARRAY['public.sabotages','public.sabotage_items'] LOOP
            PERFORM test.assert(has_table_privilege(r,t,'SELECT'),'public reads '||t||' '||r);
            PERFORM test.assert(NOT has_table_privilege(r,t,'INSERT') AND NOT has_table_privilege(r,t,'UPDATE') AND NOT has_table_privilege(r,t,'DELETE'),'protected '||t||' writes '||r);
        END LOOP;
    END LOOP;
END $$;
