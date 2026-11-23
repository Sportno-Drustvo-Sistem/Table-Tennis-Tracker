-- Payouts: a super admin takes points out of a player's wallet when they cash
-- them in (for real money, outside the app). Every payout is a public row, so
-- the Bets tab can show it to everyone; only a super admin can make one.
-- Rollback: supabase/rollbacks/20261123220000_bet_payouts_down.sql.
BEGIN;

CREATE TABLE public.bet_payouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount integer NOT NULL CHECK (amount > 0),
    balance_before integer NOT NULL,
    balance_after integer NOT NULL CHECK (balance_after >= 0),
    note text CHECK (note IS NULL OR length(note) <= 200),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bet_payouts_user_idx ON public.bet_payouts(user_id, created_at DESC);

REVOKE ALL ON TABLE public.bet_payouts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.bet_payouts TO anon, authenticated;
ALTER TABLE public.bet_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY betting_public_read ON public.bet_payouts FOR SELECT TO anon, authenticated USING (true);
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bet_payouts;
    END IF;
END $$;

-- Takes p_amount points out of one wallet (1 up to the whole balance).
CREATE FUNCTION public.super_admin_pay_out(p_admin_token text, p_user_id uuid, p_amount integer, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    wallet public.bet_wallets;
    payout public.bet_payouts;
    old_value integer;
    clean_note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM private.require_super_admin_session(p_admin_token);
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN RAISE EXCEPTION 'Player not found'; END IF;
    IF clean_note IS NOT NULL AND length(clean_note) > 200 THEN RAISE EXCEPTION 'Keep the note under 200 characters'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext('points_betting'));
    INSERT INTO public.bet_wallets(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
    SELECT balance INTO old_value FROM public.bet_wallets WHERE user_id = p_user_id FOR UPDATE;
    IF p_amount IS NULL OR p_amount < 1 OR p_amount > old_value THEN
        RAISE EXCEPTION 'Pay out between 1 and % points', old_value;
    END IF;
    UPDATE public.bet_wallets SET balance = old_value - p_amount, updated_at = now()
        WHERE user_id = p_user_id RETURNING * INTO wallet;
    INSERT INTO public.bet_payouts(user_id, amount, balance_before, balance_after, note)
        VALUES (p_user_id, p_amount, old_value, wallet.balance, clean_note) RETURNING * INTO payout;
    RETURN jsonb_build_object('wallet', to_jsonb(wallet), 'payout', to_jsonb(payout));
END $$;

REVOKE ALL ON FUNCTION public.super_admin_pay_out(text, uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_pay_out(text, uuid, integer, text) TO anon, authenticated;

COMMIT;
