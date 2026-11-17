-- Sabotage prices end in 0, and Backhand only costs the same as Forehand only.
-- Removed with the rest of the shop by
-- supabase/rollbacks/20261117120000_sabotage_shop_down.sql.
BEGIN;

UPDATE public.sabotage_items SET price_per_point = 50 WHERE id = 'half_table';
UPDATE public.sabotage_items SET price_per_point = 40 WHERE id = 'backhand';

COMMIT;
