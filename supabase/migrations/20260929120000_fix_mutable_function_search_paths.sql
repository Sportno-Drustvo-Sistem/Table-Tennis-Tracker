-- Pin helper and recalculation functions to an empty search_path so object
-- resolution cannot be changed by caller-controlled schemas.
ALTER FUNCTION public.recalculate_pingpong_stats()
    SET search_path = '';
ALTER FUNCTION public.recalculate_padel_stats()
    SET search_path = '';
ALTER FUNCTION public.recalculate_tennis_stats()
    SET search_path = '';

ALTER FUNCTION public.app_calculate_elo_change(numeric, numeric, integer, integer)
    SET search_path = '';
ALTER FUNCTION public.app_streak_bonus(jsonb, uuid, boolean)
    SET search_path = '';
ALTER FUNCTION public.app_padel_winner(integer, integer, jsonb)
    SET search_path = '';
ALTER FUNCTION public.app_tennis_winner(integer, integer, jsonb)
    SET search_path = '';
