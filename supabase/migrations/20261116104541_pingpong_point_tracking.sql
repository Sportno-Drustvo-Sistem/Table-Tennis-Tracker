-- Rally data is optional for legacy/manual matches. The existing table's RLS
-- and read-only frontend grants cover this column; writes use the admin RPC.
BEGIN;

ALTER TABLE public.matches ADD COLUMN point_history jsonb;

CREATE FUNCTION private.validate_pingpong_points(p_points jsonb, p_score1 integer, p_score2 integer)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
    point jsonb;
    a integer := 0;
    b integer := 0;
    first_server integer;
    expected_server integer;
BEGIN
    IF p_points IS NULL OR jsonb_typeof(p_points) <> 'array' THEN
        RAISE EXCEPTION 'Rally history must be an array';
    END IF;
    IF jsonb_array_length(p_points) = 0 OR jsonb_array_length(p_points) <> p_score1::bigint + p_score2::bigint THEN
        RAISE EXCEPTION 'Rally count does not match the score';
    END IF;
    FOR point IN SELECT value FROM jsonb_array_elements(p_points) LOOP
        IF greatest(a,b) >= 11 AND abs(a-b) >= 2 THEN
            RAISE EXCEPTION 'Rallies cannot follow a completed game';
        END IF;
        IF jsonb_typeof(point) IS DISTINCT FROM 'object'
            OR point->'winner' IS NULL OR point->'winner' NOT IN ('1'::jsonb,'2'::jsonb)
            OR point->'server' IS NULL OR point->'server' NOT IN ('1'::jsonb,'2'::jsonb)
            OR point->>'type' IS NULL OR point->>'type' NOT IN ('winner','smash','ace','forced_error','unforced_error','serve_fault','other') THEN
            RAISE EXCEPTION 'Invalid rally outcome';
        END IF;
        first_server := coalesce(first_server, (point->>'server')::integer);
        expected_server := CASE WHEN (CASE WHEN a>=10 AND b>=10 THEN a+b ELSE (a+b)/2 END)%2=0 THEN first_server ELSE 3-first_server END;
        IF (point->>'server')::integer <> expected_server THEN
            RAISE EXCEPTION 'Rally server does not follow service order';
        END IF;
        IF (point->>'type'='ace' AND point->'winner'<>point->'server')
            OR (point->>'type'='serve_fault' AND point->'winner'=point->'server') THEN
            RAISE EXCEPTION 'Invalid service outcome';
        END IF;
        IF point->>'winner'='1' THEN a:=a+1; ELSE b:=b+1; END IF;
    END LOOP;
    IF a<>p_score1 OR b<>p_score2 OR greatest(a,b)<11 OR abs(a-b)<2 THEN
        RAISE EXCEPTION 'Rallies do not describe the completed game';
    END IF;
END $$;

CREATE FUNCTION private.guard_pingpong_point_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF TG_OP='UPDATE' THEN
        IF (NEW.score1,NEW.score2,NEW.player1_id,NEW.player2_id)
            IS DISTINCT FROM (OLD.score1,OLD.score2,OLD.player1_id,OLD.player2_id) THEN
            NEW.point_history := NULL;
        END IF;
    END IF;
    IF NEW.point_history IS NOT NULL THEN
        PERFORM private.validate_pingpong_points(NEW.point_history,NEW.score1,NEW.score2);
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER guard_pingpong_point_history BEFORE INSERT OR UPDATE OF point_history,score1,score2,player1_id,player2_id
    ON public.matches FOR EACH ROW EXECUTE FUNCTION private.guard_pingpong_point_history();

-- Reuse the existing atomic score/Elo/tournament/bet paths, then attach rallies
-- before committing. Failure anywhere rolls back matches, ratings and payouts.
CREATE FUNCTION public.record_pingpong_match_with_points(
    p_admin_token text, p_player1_id uuid, p_player2_id uuid, p_sets jsonb,
    p_handicap_rule jsonb DEFAULT NULL, p_tournament_id uuid DEFAULT NULL, p_market_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    item jsonb;
    result jsonb;
    saved public.matches%ROWTYPE;
    saved_matches jsonb := '[]'::jsonb;
    i integer := 0;
BEGIN
    PERFORM private.require_admin_session(p_admin_token);
    PERFORM private.validate_pingpong_sets(p_sets);
    FOR item IN SELECT value FROM jsonb_array_elements(p_sets) LOOP
        PERFORM private.validate_pingpong_points(item->'points',(item->>'s1')::integer,(item->>'s2')::integer);
    END LOOP;
    IF p_market_id IS NOT NULL THEN
        IF p_tournament_id IS NOT NULL THEN RAISE EXCEPTION 'Tournament betting is not supported'; END IF;
        result := public.record_pingpong_match_with_bets(p_admin_token,p_market_id,p_player1_id,p_player2_id,p_sets,p_handicap_rule);
    ELSE
        result := public.record_pingpong_match(p_admin_token,p_player1_id,p_player2_id,p_sets,p_handicap_rule,p_tournament_id);
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_sets) LOOP
        UPDATE public.matches SET point_history=item->'points'
            WHERE id=(result->'matches'->i->>'id')::uuid RETURNING * INTO STRICT saved;
        saved_matches := saved_matches || jsonb_build_array(to_jsonb(saved));
        i := i+1;
    END LOOP;
    RETURN result || jsonb_build_object('match',to_jsonb(saved),'matches',saved_matches);
END $$;

REVOKE ALL ON FUNCTION private.validate_pingpong_points(jsonb,integer,integer), private.guard_pingpong_point_history() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_pingpong_match_with_points(text,uuid,uuid,jsonb,jsonb,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_pingpong_match_with_points(text,uuid,uuid,jsonb,jsonb,uuid,uuid) TO anon,authenticated;

COMMIT;
