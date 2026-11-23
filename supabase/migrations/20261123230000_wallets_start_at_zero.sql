-- New betting wallets start at 0 points instead of 1,000 (beta over, 2026-11-23).
-- Points now only arrive through a super admin edit on the House tab.
-- To undo: ALTER TABLE public.bet_wallets ALTER COLUMN balance SET DEFAULT 1000;
ALTER TABLE public.bet_wallets ALTER COLUMN balance SET DEFAULT 0;
