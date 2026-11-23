-- The house keeps 10% of the profit on every winning bet: a winner gets the
-- stake back plus 90% of (stake × multiplier − stake), rounded to whole points.
-- src/bettingUtils.js potentialPayout() previews the same number.
-- Only settlement changes; re-settling an edited match applies the cut too.
CREATE OR REPLACE FUNCTION private.settle_bet_market(p_market_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    m public.bet_markets;
    found_rows integer;
    sets1 integer;
    sets2 integer;
    winner smallint;
BEGIN
    SELECT * INTO m FROM public.bet_markets WHERE id = p_market_id FOR UPDATE;
    IF m.id IS NULL OR m.status = 'void' THEN RETURN; END IF;

    UPDATE public.bet_wallets w SET balance = w.balance - s.total, updated_at = now()
    FROM (SELECT user_id, sum(payout) AS total FROM public.bets
          WHERE market_id = p_market_id AND status = 'won' GROUP BY user_id) s
    WHERE w.user_id = s.user_id;
    UPDATE public.bets SET status = 'pending', payout = 0
    WHERE market_id = p_market_id AND status IN ('won','lost');

    SELECT count(*),
        count(*) FILTER (WHERE (player1_id = m.player1_id AND score1 > score2) OR (player1_id = m.player2_id AND score2 > score1)),
        count(*) FILTER (WHERE (player1_id = m.player2_id AND score1 > score2) OR (player1_id = m.player1_id AND score2 > score1))
    INTO found_rows, sets1, sets2
    FROM public.matches WHERE id = ANY(m.match_ids);

    IF cardinality(m.match_ids) > 0 AND found_rows = cardinality(m.match_ids) AND sets1 <> sets2 THEN
        winner := CASE WHEN sets1 > sets2 THEN 1 ELSE 2 END;
    END IF;

    IF winner IS NULL THEN
        -- No result to pay on (match never saved, or deleted later): stakes go back.
        UPDATE public.bet_wallets w SET balance = w.balance + s.total, updated_at = now()
        FROM (SELECT user_id, sum(stake) AS total FROM public.bets
              WHERE market_id = p_market_id AND status = 'pending' GROUP BY user_id) s
        WHERE w.user_id = s.user_id;
        UPDATE public.bets SET status = 'void', payout = 0 WHERE market_id = p_market_id AND status = 'pending';
        UPDATE public.bet_markets SET status = 'void', winner_side = NULL, settled_at = now() WHERE id = p_market_id;
    ELSE
        UPDATE public.bets
        SET status = CASE WHEN side = winner THEN 'won' ELSE 'lost' END,
            payout = CASE WHEN side = winner
                THEN stake + round((round(stake * multiplier)::integer - stake) * 9 / 10.0)::integer
                ELSE 0 END
        WHERE market_id = p_market_id AND status = 'pending';
        UPDATE public.bet_wallets w SET balance = w.balance + s.total, updated_at = now()
        FROM (SELECT user_id, sum(payout) AS total FROM public.bets
              WHERE market_id = p_market_id AND status = 'won' GROUP BY user_id) s
        WHERE w.user_id = s.user_id;
        UPDATE public.bet_markets SET status = 'settled', winner_side = winner, settled_at = now() WHERE id = p_market_id;
    END IF;

    -- Nobody stays broke: an empty wallet with nothing still riding restarts at 100.
    UPDATE public.bet_wallets w SET balance = 100, rebuys = w.rebuys + 1, updated_at = now()
    WHERE w.balance <= 0
        AND w.user_id IN (SELECT user_id FROM public.bets WHERE market_id = p_market_id)
        AND NOT EXISTS (SELECT 1 FROM public.bets b WHERE b.user_id = w.user_id AND b.status = 'pending');
END $$;
