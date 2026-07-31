-- Expose app tables to the Supabase Data API frontend roles.
-- RLS policies still decide which rows are accessible.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE
    public.users,
    public.matches,
    public.tournaments,
    public.debuffs,
    public.settings,
    public.padel_matches,
    public.padel_stats,
    public.tennis_matches,
    public.tennis_stats,
    public.tournament_results
TO anon, authenticated;
