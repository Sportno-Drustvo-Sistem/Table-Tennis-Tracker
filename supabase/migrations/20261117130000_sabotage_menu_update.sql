-- Sabotage shop menu, second version: prices up about 1.5x (rounded), Granny
-- serve and Pillow fight taken off the menu, four new debuffs. Old items are
-- switched off rather than deleted so past purchases keep their item.
-- Removed with the rest of the shop by
-- supabase/rollbacks/20261117120000_sabotage_shop_down.sql.
BEGIN;

UPDATE public.sabotage_items SET is_active = false WHERE id IN ('underarm', 'no_smash');

UPDATE public.sabotage_items AS i SET price_per_point = v.price, sort_order = v.sort_order
FROM (VALUES
    ('half_table',  45, 1),
    ('forehand',    40, 2),
    ('wrong_hand',  90, 4),
    ('step_back',   50, 7),
    ('stand_still', 70, 8)
) AS v(id, price, sort_order)
WHERE i.id = v.id;

INSERT INTO public.sabotage_items (id, title, description, price_per_point, max_points, sort_order) VALUES
    ('backhand',       'Backhand only',    'No forehand shots at all.',                              50, 5, 3),
    ('choke_grip',     'Choke grip',       'Hold the paddle by the blade, not the handle.',          60, 3, 5),
    ('no_serve',       'No serve',         'The opponent serves every point while this is on.',      40, 5, 6),
    ('hand_behind',    'Hand behind back', 'Free hand stays behind the back for the whole rally.',   30, 5, 9)
ON CONFLICT (id) DO UPDATE SET
    title = excluded.title, description = excluded.description, price_per_point = excluded.price_per_point,
    max_points = excluded.max_points, sort_order = excluded.sort_order, is_active = true;

COMMIT;
