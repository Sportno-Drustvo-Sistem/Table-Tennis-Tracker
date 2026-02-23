-- Create Tournament Results Table
create table
    if not exists public.tournament_results (
        id uuid not null default uuid_generate_v4 (),
        tournament_id uuid not null references public.tournaments (id) on delete cascade,
        user_id uuid not null references public.users (id) on delete cascade,
        rank integer not null,
        round_reached text,
        created_at timestamp
        with
            time zone not null default now (),
            constraint tournament_results_pkey primary key (id)
    ) tablespace pg_default;

-- Enable RLS
alter table public.tournament_results enable row level security;

-- Policies (Permissive, matching existing patterns)
drop policy if exists "Enable read access for all users" on public.tournament_results;

create policy "Enable read access for all users" on public.tournament_results for
select
    using (true);

drop policy if exists "Enable write access for all users" on public.tournament_results;

create policy "Enable write access for all users" on public.tournament_results for all using (true);