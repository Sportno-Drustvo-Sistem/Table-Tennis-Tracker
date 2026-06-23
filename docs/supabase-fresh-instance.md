# Fresh Supabase Instance Setup

Use this when moving the app to a new Supabase account or project.

## 1. Create the project

1. Create a new Supabase project.
2. Copy the project URL and anon public key from Project Settings > API.
3. Keep the service role key private. Do not put it in frontend env files or Docker runtime config.

## 2. Apply schema migrations

Install and authenticate the Supabase CLI, then link this repo to the new project:

```bash
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

The migration set is intended to bootstrap a blank project, including:

- core `users`, `matches`, and `tournaments` tables
- ping pong, padel, and tennis tables
- settings, debuffs, tournament results, and stat recalculation functions
- atomic match-recording RPCs
- public `avatars` storage bucket and object policies when Supabase Storage is available

## 3. Configure the app

For local development, create `.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

For Docker, provide these values at container runtime:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

The Docker image writes these values into `public/runtime-config.js` at startup.

## 4. Migrate existing data

Have the current project admin export table data and storage objects from the old project, then import them into the new project after `supabase db push` succeeds.

Coordinate before applying this migration directory to an existing linked Supabase project. Some old migration files were renamed to use unique Supabase migration versions for fresh-project compatibility, so an existing project may need migration-history repair instead of a direct `db push`.

## 5. Smoke test

After the app is pointed at the new project:

1. Create a player.
2. Upload or change an avatar.
3. Record one ping pong, padel, and tennis match.
4. Confirm the match row and player stats update together.
