-- Super admin login and wallet edits: runs after betting.sql (needs the test
-- schema, the 'valid' admin session and the four test players).
SELECT private.set_super_admin_password('correct horse battery');
SET ROLE anon;
SELECT test.rejects($q$SELECT private.set_super_admin_password('another long password')$q$);
SELECT test.rejects($q$SELECT * FROM private.super_admin_sessions$q$);

DO $$
DECLARE
    alice uuid := (SELECT id FROM test.players WHERE n=1);
    result jsonb;
    token text;
BEGIN
    PERFORM test.assert((public.create_super_admin_session('short')->>'ok')::boolean IS FALSE,'short password refused');
    PERFORM test.assert((public.create_super_admin_session('wrong horse battery')->>'ok')::boolean IS FALSE,'wrong password refused');
    -- A plain admin session cannot edit points.
    PERFORM test.assert(NOT public.validate_super_admin_session('valid'),'admin session is not super');
    PERFORM test.rejects(format('SELECT public.super_admin_set_wallet(''valid'',%L,5)',alice));
    PERFORM test.rejects('SELECT public.super_admin_wallet_adjustments(''valid'')');

    result := public.create_super_admin_session('correct horse battery');
    PERFORM test.assert((result->>'ok')::boolean AND (result->>'super')::boolean,'right password opens a super session');
    token := result->>'token';
    PERFORM test.assert(public.validate_super_admin_session(token) AND public.validate_admin_session(token),'super session is also an admin session');

    result := public.super_admin_set_wallet(token,alice,4321);
    PERFORM test.assert((result->'wallet'->>'balance')::int=4321,'balance set');
    PERFORM test.assert((SELECT balance FROM public.bet_wallets WHERE user_id=alice)=4321,'wallet row updated');
    PERFORM test.rejects(format('SELECT public.super_admin_set_wallet(%L,%L,-1)',token,alice));
    PERFORM test.assert(jsonb_array_length(public.super_admin_wallet_adjustments(token))=1
        AND (public.super_admin_wallet_adjustments(token)->0->>'new_balance')::int=4321,'edit logged');

    -- Payouts: only a super admin, 1 up to the whole balance, logged publicly.
    PERFORM test.rejects(format('SELECT public.super_admin_pay_out(''valid'',%L,100)',alice));
    PERFORM test.rejects(format('SELECT public.super_admin_pay_out(%L,%L,0)',token,alice));
    PERFORM test.rejects(format('SELECT public.super_admin_pay_out(%L,%L,4322)',token,alice));
    result := public.super_admin_pay_out(token,alice,321,'  cash for lunch  ');
    PERFORM test.assert((result->'wallet'->>'balance')::int=4000 AND (result->'payout'->>'amount')::int=321
        AND (result->'payout'->>'balance_before')::int=4321 AND result->'payout'->>'note'='cash for lunch','payout taken from the wallet');
    PERFORM test.assert((SELECT balance FROM public.bet_wallets WHERE user_id=alice)=4000,'wallet row paid out');
    PERFORM public.super_admin_pay_out(token,alice,4000);
    PERFORM test.assert((SELECT count(*) FROM public.bet_payouts WHERE user_id=alice)=2 AND (SELECT balance FROM public.bet_wallets WHERE user_id=alice)=0,'whole balance can be paid out');
    PERFORM test.assert(jsonb_array_length(public.super_admin_wallet_adjustments(token))=1,'payouts are not manual edits');
    PERFORM test.rejects(format('INSERT INTO public.bet_payouts(user_id,amount,balance_before,balance_after) VALUES (%L,1,1,0)',alice));

    PERFORM public.revoke_admin_session(token);
    PERFORM test.assert(NOT public.validate_super_admin_session(token),'revoking the admin session ends super access');
END $$;

-- Five wrong passwords from one address lock it out, even with the right one.
DO $$
BEGIN
    FOR i IN 1..5 LOOP PERFORM public.create_super_admin_session('wrong password ' || i); END LOOP;
    PERFORM test.assert((public.create_super_admin_session('correct horse battery')->>'ok')::boolean IS FALSE,'super login throttled');
END $$;
RESET ROLE;
DELETE FROM private.admin_login_attempts WHERE login_key LIKE 'super:%';
