-- Baseline schema for fresh Supabase projects.
-- Later migrations add sport-specific tables, settings, debuffs, and RPCs.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.users (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    avatar_url TEXT,
    total_wins INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.tournaments (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'single_elim'::TEXT,
    status TEXT NOT NULL DEFAULT 'active'::TEXT,
    winner_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    config JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tournaments_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.matches (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    player1_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    player2_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    score1 INTEGER NOT NULL DEFAULT 0,
    score2 INTEGER NOT NULL DEFAULT 0,
    handicap_rule JSONB,
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT matches_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
CREATE POLICY "Enable read access for all users" ON public.users FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Enable write access for all users" ON public.users;
CREATE POLICY "Enable write access for all users" ON public.users FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Enable read access for all users" ON public.matches;
CREATE POLICY "Enable read access for all users" ON public.matches FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Enable write access for all users" ON public.matches;
CREATE POLICY "Enable write access for all users" ON public.matches FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Enable read access for all users" ON public.tournaments;
CREATE POLICY "Enable read access for all users" ON public.tournaments FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Enable write access for all users" ON public.tournaments;
CREATE POLICY "Enable write access for all users" ON public.tournaments FOR ALL USING (TRUE) WITH CHECK (TRUE);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'storage'
          AND table_name = 'buckets'
    ) THEN
        EXECUTE 'INSERT INTO storage.buckets (id, name, public)
                 VALUES (''avatars'', ''avatars'', TRUE)
                 ON CONFLICT (id) DO NOTHING';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'storage'
          AND table_name = 'objects'
    ) THEN
        EXECUTE 'DROP POLICY IF EXISTS "Enable public read for avatars" ON storage.objects';
        EXECUTE 'CREATE POLICY "Enable public read for avatars" ON storage.objects
                 FOR SELECT USING (bucket_id = ''avatars'')';

        EXECUTE 'DROP POLICY IF EXISTS "Enable public insert for avatars" ON storage.objects';
        EXECUTE 'CREATE POLICY "Enable public insert for avatars" ON storage.objects
                 FOR INSERT WITH CHECK (bucket_id = ''avatars'')';

        EXECUTE 'DROP POLICY IF EXISTS "Enable public update for avatars" ON storage.objects';
        EXECUTE 'CREATE POLICY "Enable public update for avatars" ON storage.objects
                 FOR UPDATE USING (bucket_id = ''avatars'') WITH CHECK (bucket_id = ''avatars'')';

        EXECUTE 'DROP POLICY IF EXISTS "Enable public delete for avatars" ON storage.objects';
        EXECUTE 'CREATE POLICY "Enable public delete for avatars" ON storage.objects
                 FOR DELETE USING (bucket_id = ''avatars'')';
    END IF;
END $$;
