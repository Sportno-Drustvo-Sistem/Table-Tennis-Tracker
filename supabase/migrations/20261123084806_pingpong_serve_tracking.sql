-- Each game in a best-of gets its own timestamp for chronological stats.
ALTER TABLE public.matches ALTER COLUMN created_at SET DEFAULT clock_timestamp();

-- Preserve winner-only histories and validate service order for annotated games.
CREATE OR REPLACE FUNCTION private.validate_pingpong_points(p_points jsonb, p_score1 integer, p_score2 integer)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
    point jsonb;
    winner jsonb;
    server jsonb;
    tracks_serve boolean;
    first_server jsonb;
    expected_server jsonb;
    service_turn integer;
    a integer := 0;
    b integer := 0;
BEGIN
    IF p_points IS NULL OR jsonb_typeof(p_points) <> 'array' THEN
        RAISE EXCEPTION 'Point history must be an array';
    END IF;
    IF jsonb_array_length(p_points) = 0 OR jsonb_array_length(p_points) <> p_score1::bigint + p_score2::bigint THEN
        RAISE EXCEPTION 'Point count does not match the score';
    END IF;
    tracks_serve := jsonb_typeof(p_points->0) = 'object';

    FOR point IN SELECT value FROM jsonb_array_elements(p_points) LOOP
        IF greatest(a,b) >= 11 AND abs(a-b) >= 2 THEN
            RAISE EXCEPTION 'Points cannot follow a completed game';
        END IF;

        winner := point;
        IF tracks_serve THEN
            winner := point->'winner';
            server := point->'server';
            IF server IS NULL OR server NOT IN ('1'::jsonb, '2'::jsonb) THEN
                RAISE EXCEPTION 'Each tracked point must identify its server';
            END IF;
            first_server := coalesce(first_server, server);
            service_turn := CASE WHEN a >= 10 AND b >= 10 THEN a + b ELSE (a + b) / 2 END;
            expected_server := CASE WHEN service_turn % 2 = 0 THEN first_server
                                    WHEN first_server = '1'::jsonb THEN '2'::jsonb ELSE '1'::jsonb END;
            IF server <> expected_server THEN
                RAISE EXCEPTION 'Point server does not follow service order';
            END IF;
        END IF;

        IF winner IS NULL OR winner NOT IN ('1'::jsonb, '2'::jsonb) THEN
            RAISE EXCEPTION 'Each point must identify its winner';
        END IF;
        IF winner = '1'::jsonb THEN a := a + 1; ELSE b := b + 1; END IF;
    END LOOP;
    IF a <> p_score1 OR b <> p_score2 OR greatest(a,b) < 11 OR abs(a-b) < 2 THEN
        RAISE EXCEPTION 'Points do not describe a completed game';
    END IF;
END $$;
