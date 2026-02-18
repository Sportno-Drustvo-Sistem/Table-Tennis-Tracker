-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Create Tournaments Table (if missing)
create table if not exists public.tournaments (
  id uuid not null default uuid_generate_v4 (),
  name text not null,
  format text not null default 'single_elim'::text,
  status text not null default 'active'::text,
  winner_id uuid null,
  config jsonb default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint tournaments_pkey primary key (id)
) tablespace pg_default;

-- 2. Add tournament_id to Matches Table (if missing)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'matches' and column_name = 'tournament_id') then
    alter table public.matches add column tournament_id uuid references public.tournaments(id);
  end if;
end $$;

-- 3. Create Debuffs Table
create table if not exists public.debuffs (
  id uuid not null default uuid_generate_v4 (),
  title text not null,
  description text not null,
  severity integer null default 5,
  trigger_type text not null default 'mayhem'::text,
  is_active boolean null default true,
  created_at timestamp with time zone not null default now(),
  constraint debuffs_pkey primary key (id)
) tablespace pg_default;

-- 4. Enable RLS
alter table public.debuffs enable row level security;
alter table public.tournaments enable row level security;

-- 5. Create Policies (Permissive for now as requested)

-- Debuffs
drop policy if exists "Enable read access for all users" on public.debuffs;
create policy "Enable read access for all users" on public.debuffs for select using (true);

drop policy if exists "Enable write access for all users" on public.debuffs;
create policy "Enable write access for all users" on public.debuffs for all using (true);

-- Tournaments
drop policy if exists "Enable read access for all users" on public.tournaments;
create policy "Enable read access for all users" on public.tournaments for select using (true);

drop policy if exists "Enable write access for all users" on public.tournaments;
create policy "Enable write access for all users" on public.tournaments for all using (true);
