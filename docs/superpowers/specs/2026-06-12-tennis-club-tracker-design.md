# Tennis Club Tracker Design

**Goal:** Build a new, separate tennis-only website for a club to track singles matches, players, rankings, and stats for fun, while keeping the architecture ready for authentication, private photos, admin roles, and doubles later.

**Status:** Design approved in conversation for the first version. This document lives in the existing table-tennis repo only as planning material. The actual website should be created in a new standalone repo.

---

## Decisions Already Made

- The new website must be a completely separate repo from `Table-Tennis-Tracker`.
- The site is exclusively for tennis.
- The first version uses fresh data.
- The first version supports singles only.
- Doubles should remain possible later without a major rewrite.
- The stack should stay close to the current project: React, Vite, Tailwind, Supabase, and Vitest.
- Authentication is deferred until after the first working site is set up.
- Long-term, the site should require login before viewing anything because player pictures are private.
- Long-term, admins create user accounts.
- Long-term, all authenticated users can add matches.
- Match results count immediately after submission.
- Admins can edit and delete matches.
- A temporary local admin mode is acceptable during the first build, as long as it is treated as disposable and not real security.

## Source Project Assessment

The current tracker is useful as reference code, but it should not become the production base for the tennis club site.

Useful pieces to copy or adapt:

- Tennis set validation from `src/tennisUtils.js`.
- Tennis score summaries and winner detection from `src/tennisUtils.js`.
- Live tennis scoring flow from `src/components/modals/TennisLiveMatchModal.jsx`.
- Manual match entry flow from `src/components/modals/TennisMatchModal.jsx`.
- Leaderboard and player stat ideas from the tennis components.
- Shared ELO helpers from `src/utils.js`.
- Vite, Tailwind, Supabase client, and Vitest setup patterns.

Pieces to avoid copying into the new app:

- Ping pong, padel, tournament, debuff, and Discord features.
- The multi-sport app shell.
- Hardcoded admin PIN as security.
- `localStorage` as real authorization.
- Supabase policies such as `FOR ALL USING (true) WITH CHECK (true)`.
- Public unrestricted avatar storage for real private club photos.

## V1 Product Scope

The first usable version should open directly into the tracker, not a marketing landing page.

Primary tabs:

- **Players:** List players with avatar or generated fallback, ELO, matches played, wins, losses, and win rate.
- **Leaderboard:** Sortable ranking table for ELO, wins, losses, win percentage, streak, set difference, and game difference.
- **Matches:** Match history, search by player, record match, live match, and admin correction controls.
- **Stats:** Per-player detail page with ELO history, head-to-head records, recent matches, best ELO, worst ELO, set stats, and game stats.
- **Admin:** Temporary local admin area for creating/editing players and correcting/deleting matches.

V1 should support:

- Adding tennis players.
- Editing tennis players in temporary admin mode.
- Recording completed singles matches manually.
- Scoring singles matches live, then saving the final result.
- Immediate ranking/stat updates after a match is saved.
- Admin edit/delete of matches.
- Full stat recalculation after admin corrections.
- Client-side validation for tennis scores.
- Unit tests for scoring, validation, ELO, and stat recalculation.

V1 should not include:

- Real login.
- Real account creation.
- Private real player photos.
- Doubles match entry.
- Tournaments.
- Padel or ping pong modes.
- Discord integration.
- Handicap/debuff features.

## Authentication And Safety Plan

Authentication is intentionally deferred, but the code should be shaped so it is easy to add later.

V1 temporary behavior:

- The app can be opened without login.
- Temporary admin mode may use a local toggle or simple local PIN.
- Temporary admin mode must be clearly isolated in code as a development convenience.
- Temporary admin state must not be described as secure.
- Real private player photos should not be uploaded in V1 unless authentication and private storage are implemented first.
- V1 can use generated avatar fallbacks or non-sensitive test images.

Long-term behavior:

- The whole site requires login before any data or images are shown.
- Admins create user accounts.
- Users log in with credentials created by an admin.
- Users can add matches.
- Admins can create/edit players, edit/delete matches, and manage roles.
- Every match stores who submitted it.
- Every admin edit/delete is recorded in an audit log.
- Player photos are stored in a private Supabase Storage bucket and served only to authenticated users.

Recommended later auth implementation:

- Use Supabase Auth for password sessions.
- If the club wants username/password rather than visible email/password, map usernames internally to generated local emails such as `username@tennis-club.local`.
- Keep the UI username-based while still using Supabase Auth for secure password storage and sessions.

## Data Model

The schema should be tennis-only but doubles-ready.

### `profiles`

Represents people who can log in later. In V1, this table can exist without auth user links.

Suggested columns:

- `id uuid primary key`
- `auth_user_id uuid null unique`
- `username text unique`
- `display_name text not null`
- `role text not null default 'member' check (role in ('member', 'admin'))`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `players`

Represents tennis competitors shown in the tracker. For this club, a player will usually map to a profile later, but keeping this separate leaves room for guest players or inactive accounts.

Suggested columns:

- `id uuid primary key`
- `profile_id uuid null references profiles(id)`
- `display_name text not null`
- `avatar_path text null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `matches`

Represents one tennis match. Singles in V1, doubles later.

Suggested columns:

- `id uuid primary key`
- `match_type text not null default 'singles' check (match_type in ('singles', 'doubles'))`
- `format text not null default 'best_of_3' check (format in ('best_of_1', 'best_of_3'))`
- `sets_data jsonb not null default '[]'::jsonb`
- `winner_side smallint not null check (winner_side in (1, 2))`
- `side1_sets smallint not null default 0`
- `side2_sets smallint not null default 0`
- `side1_games smallint not null default 0`
- `side2_games smallint not null default 0`
- `played_at timestamptz not null default now()`
- `created_by_profile_id uuid null references profiles(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `match_participants`

Allows the app to support singles now and doubles later.

Suggested columns:

- `id uuid primary key`
- `match_id uuid not null references matches(id) on delete cascade`
- `player_id uuid not null references players(id)`
- `side smallint not null check (side in (1, 2))`
- `position smallint not null check (position in (1, 2))`
- `unique(match_id, side, position)`
- `unique(match_id, player_id)`

For V1 singles:

- Each match has exactly two participants.
- Side 1 has one player at position 1.
- Side 2 has one player at position 1.

For future doubles:

- Each match has exactly four participants.
- Each side has position 1 and position 2.

### `player_stats`

Stores cached current stats so leaderboards are fast.

Suggested columns:

- `player_id uuid primary key references players(id) on delete cascade`
- `elo_rating integer not null default 1200`
- `matches_played integer not null default 0`
- `wins integer not null default 0`
- `losses integer not null default 0`
- `sets_won integer not null default 0`
- `sets_lost integer not null default 0`
- `games_won integer not null default 0`
- `games_lost integer not null default 0`
- `is_ranked boolean not null default false`
- `updated_at timestamptz not null default now()`

### `match_audit_log`

Used once admin edits/deletes are active. It can exist in V1 even if `actor_profile_id` is null until auth is added.

Suggested columns:

- `id uuid primary key`
- `match_id uuid null`
- `action text not null check (action in ('create', 'update', 'delete', 'recalculate'))`
- `actor_profile_id uuid null references profiles(id)`
- `before_data jsonb null`
- `after_data jsonb null`
- `created_at timestamptz not null default now()`

## Scoring Rules

V1 supports normal set scoring:

- Best of 1 means first player to 1 valid set wins.
- Best of 3 means first player to 2 valid sets wins.
- A set can end 6-0, 6-1, 6-2, 6-3, 6-4, 7-5, or 7-6.
- A 7-6 set requires tiebreak points.
- Tiebreak winner must have at least 7 points and a 2-point lead.
- A match cannot be saved tied.
- A best-of-3 match must stop once one side has won 2 sets.

Client-side validation should prevent obvious invalid input, but later server/database validation must be added before trusting member-submitted production data.

## Ranking And Stats

Use a simple ELO model for V1:

- Every player starts at 1200.
- K-factor starts flat at 32, matching the current project.
- ELO updates after each saved match.
- The actual result is match win/loss.
- The score-difference multiplier can reuse the current project approach initially, but should be isolated in a single ranking module so it can be changed later.
- A player becomes ranked after 10 matches.

Stats should be recalculable from match history. Match history is the source of truth; `player_stats` is a cache.

Required stat outputs:

- Current ELO.
- Matches played.
- Wins and losses.
- Win rate.
- Current streak.
- Sets won/lost.
- Games won/lost.
- Set difference.
- Game difference.
- ELO timeline.
- Head-to-head records.
- Recent match history.

## Frontend Structure

The new repo should use focused feature folders rather than a large multi-sport `App.jsx`.

Suggested structure:

```text
src/
  app/
    App.jsx
    routes.js
  components/
    layout/
    ui/
  features/
    admin/
    leaderboard/
    matches/
    players/
    stats/
  lib/
    supabaseClient.js
    tennisScoring.js
    elo.js
    stats.js
    avatar.js
  test/
```

Important boundaries:

- `tennisScoring.js` contains pure tennis validation and score summary functions.
- `elo.js` contains pure rating functions.
- `stats.js` recalculates stats from players and matches.
- Supabase read/write functions live near the feature that uses them or in a small data-access layer.
- UI components should call data helpers, not duplicate scoring/stat rules.

## Visual Direction

The UI should feel like a practical club tool, not a marketing site.

Design principles:

- First screen is the tracker.
- Dense but readable layout.
- Mobile-friendly tabs and tables.
- No landing page hero.
- Use tennis-focused accents, but avoid making the whole app one green palette.
- Keep controls familiar: icon buttons for edit/delete/sync, segmented controls for match format, inputs for set scores, tabs for main views.
- Avoid nested cards and oversized headings inside tool surfaces.
- Keep text and buttons responsive so labels do not overflow on mobile.

## Supabase Safety Direction

V1 may use permissive local development rules while auth is deferred, but the schema should be written so stricter rules can replace them cleanly.

Target production policies after auth:

- Authenticated users can read active players, matches, participants, stats, and their own profile.
- Authenticated users can create matches.
- Authenticated users cannot directly update cached stats.
- Admins can create/update players.
- Admins can update/delete matches.
- Admins can manage roles.
- Audit logs are insert-only from trusted code and readable by admins.
- Private avatar storage allows authenticated reads only.
- Avatar writes are admin-only or restricted to the player owner, depending on final club preference.

Avoid in production:

- Anonymous read access to private club data.
- Anonymous write access.
- Client-controlled admin state.
- Public buckets for private player photos.
- Client-side-only authorization.

## Implementation Phases

### Phase 1: New Repo And App Shell

- Create a new Vite React repo.
- Add Tailwind, Supabase client, Vitest, ESLint, and Lucide.
- Build the tennis-only app shell with Players, Leaderboard, Matches, Stats, and Admin tabs.
- Add temporary local admin mode with clear naming that marks it as temporary.

### Phase 2: Pure Tennis Logic

- Copy and clean tennis scoring utilities.
- Add unit tests for valid and invalid tennis sets.
- Add ELO helpers.
- Add stat recalculation helpers.
- Add tests for winner detection, stat summaries, ELO, and recalculation.

### Phase 3: Supabase Schema

- Create fresh tennis-only migrations.
- Add profiles, players, matches, match_participants, player_stats, and match_audit_log.
- Add indexes for leaderboard and match history.
- Add temporary no-auth development policies that allow anonymous reads and the writes needed for player setup, match creation, stat updates, match edits, and match deletes while V1 has no login.
- Label those temporary policies in the migration as not production-safe and not private-photo-safe.
- Document which policies must change before production/private photos.

### Phase 4: Player Management

- Build player list and player cards.
- Build admin create/edit player modals.
- Use generated avatars or non-sensitive placeholder images for V1.

### Phase 5: Match Recording

- Build manual singles match entry.
- Build live singles scoring.
- Save matches with participants.
- Recalculate or increment stats after save.
- Show success/error toasts.

### Phase 6: Leaderboard And Stats

- Build sortable leaderboard.
- Build player stats view.
- Build ELO chart.
- Build head-to-head and recent-match sections.
- Add match search/filter.

### Phase 7: Admin Corrections

- Add admin match edit/delete.
- Recalculate stats after corrections.
- Record audit log entries where possible.
- Add bulk destructive actions only if needed later.

### Phase 8: Auth And Private Photos

- Add Supabase Auth.
- Add username-to-internal-email mapping if the club wants username/password login.
- Require login before rendering the app.
- Replace temporary admin mode with role-based authorization.
- Lock down RLS policies.
- Move real player photos to private storage.
- Add signed/private avatar loading.

### Phase 9: Doubles

- Extend match creation to `match_type = 'doubles'`.
- Require two participants per side.
- Decide whether doubles has separate ratings or shared ratings.
- Add doubles-specific leaderboard/stats only after the scoring and ranking rules are agreed.

## Testing Strategy

Use Vitest for pure logic and targeted component tests.

Required unit tests:

- Tennis set validation accepts 6-0 through 6-4.
- Tennis set validation accepts 7-5.
- Tennis set validation accepts 7-6 with valid tiebreak.
- Tennis set validation rejects tied sets.
- Tennis set validation rejects 6-5.
- Tennis set validation rejects 7-6 without valid tiebreak.
- Best-of-3 validation rejects extra sets after a player has already won 2 sets.
- Winner detection returns side 1, side 2, or no winner correctly.
- Stat recalculation produces expected wins, losses, sets, games, and ELO.
- Admin edit/delete recalculation restores consistent stats.

Manual verification:

- Create players.
- Record a manual match.
- Record a live match.
- Confirm leaderboard updates.
- Confirm player stats update.
- Edit a match as temporary admin.
- Delete a match as temporary admin.
- Confirm stats recalculate after edits/deletes.
- Confirm mobile layout is usable.

## Open Later Decisions

These are intentionally not needed for V1:

- Exact new repo name.
- Whether usernames map to generated local emails or a fully custom auth system.
- Whether users can upload their own avatars or only admins can manage photos.
- Whether doubles uses the same rating as singles or separate ratings.
- Whether member-submitted matches should eventually allow opponent confirmation.
- Whether to add tournaments after the basic club tracker works.

## Recommended Next Step

Create a detailed implementation plan for the new repo after this design is reviewed. The implementation plan should be task-by-task, test-first where practical, and should specify exact files to create in the new repo.
