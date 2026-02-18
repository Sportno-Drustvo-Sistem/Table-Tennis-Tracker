-- Create debuffs table
create table public.debuffs (
  id uuid not null default uuid_generate_v4 (),
  title text not null,
  description text not null,
  severity integer null default 5,
  trigger_type text not null default 'mayhem'::text,
  is_active boolean null default true,
  created_at timestamp with time zone not null default now(),
  constraint debuffs_pkey primary key (id)
) tablespace pg_default;

-- Add config column to tournaments if not exists
alter table public.tournaments 
add column if not exists config jsonb default '{}'::jsonb;

-- Add RLS policies (optional but recommended)
-- Enable RLS
alter table public.debuffs enable row level security;

-- Allow read access to everyone
create policy "Enable read access for all users"
on public.debuffs
as permissive
for select
to public
using (true);

-- Allow write access to authenticated users (or just everyone for this app context if auth is simple/non-existent for admins)
-- Assuming simple app where we trust the client for now or have basic auth
create policy "Enable write access for all users"
on public.debuffs
as permissive
for all
to public
using (true);
