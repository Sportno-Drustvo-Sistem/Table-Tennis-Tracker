-- One bet per bettor per match (it was one side per match, any number of bets).
-- place_bet and place_live_bet both call this check under the market row lock,
-- so replacing it covers both. A removed (void) bet does not count, so after
-- the umpire removes a bet that bettor may bet again. p_side is unused now but
-- kept so the callers do not change.
CREATE OR REPLACE FUNCTION private.require_one_bet_side(p_market_id uuid, p_user_id uuid, p_side integer)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.bets WHERE market_id = p_market_id AND user_id = p_user_id AND status = 'pending') THEN
        RAISE EXCEPTION 'You already have a bet on this match';
    END IF;
END $$;
REVOKE ALL ON FUNCTION private.require_one_bet_side(uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
