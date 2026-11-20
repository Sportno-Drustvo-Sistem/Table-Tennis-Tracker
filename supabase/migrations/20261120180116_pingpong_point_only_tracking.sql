-- Keep the point sequence while discarding outcome and serve annotations.
BEGIN;

ALTER TABLE public.matches DISABLE TRIGGER guard_pingpong_point_history;
UPDATE public.matches AS m
SET point_history = (
    SELECT jsonb_agg(
        CASE WHEN jsonb_typeof(item.value) = 'object' THEN item.value->'winner' ELSE item.value END
        ORDER BY item.ordinality
    ) AS points
    FROM jsonb_array_elements(m.point_history) WITH ORDINALITY AS item(value, ordinality)
)
WHERE jsonb_typeof(m.point_history) = 'array'
  AND jsonb_array_length(m.point_history) > 0
  AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(m.point_history) AS item(value)
      WHERE jsonb_typeof(item.value) = 'object'
  );
ALTER TABLE public.matches ENABLE TRIGGER guard_pingpong_point_history;

CREATE OR REPLACE FUNCTION private.validate_pingpong_points(p_points jsonb, p_score1 integer, p_score2 integer)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
    point jsonb;
    a integer := 0;
    b integer := 0;
BEGIN
    IF p_points IS NULL OR jsonb_typeof(p_points) <> 'array' THEN
        RAISE EXCEPTION 'Point history must be an array';
    END IF;
    IF jsonb_array_length(p_points) = 0 OR jsonb_array_length(p_points) <> p_score1::bigint + p_score2::bigint THEN
        RAISE EXCEPTION 'Point count does not match the score';
    END IF;
    FOR point IN SELECT value FROM jsonb_array_elements(p_points) LOOP
        IF greatest(a,b) >= 11 AND abs(a-b) >= 2 THEN
            RAISE EXCEPTION 'Points cannot follow a completed game';
        END IF;
        IF jsonb_typeof(point) IS DISTINCT FROM 'number' OR point NOT IN ('1'::jsonb,'2'::jsonb) THEN
            RAISE EXCEPTION 'Each point must identify its winner';
        END IF;
        IF point = '1'::jsonb THEN a := a + 1; ELSE b := b + 1; END IF;
    END LOOP;
    IF a <> p_score1 OR b <> p_score2 OR greatest(a,b) < 11 OR abs(a-b) < 2 THEN
        RAISE EXCEPTION 'Points do not describe a completed game';
    END IF;
END $$;

COMMIT;
