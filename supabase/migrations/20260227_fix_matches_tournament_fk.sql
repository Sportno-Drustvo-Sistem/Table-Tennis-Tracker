-- Fix foreign key constraint on matches.tournament_id to allow tournament deletion
-- Changes from default RESTRICT to SET NULL, so deleting a tournament
-- will set tournament_id to NULL on associated matches (keeping them intact).
ALTER TABLE public.matches
DROP CONSTRAINT IF EXISTS matches_tournament_id_fkey;

ALTER TABLE public.matches ADD CONSTRAINT matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments (id) ON DELETE SET NULL;