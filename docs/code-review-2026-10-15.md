# Webapp code review — 15 October 2026

Reviewed the current working tree across the React application, match persistence, scoring and ratings, tournament progression, season handling, Supabase migrations, and deployment configuration. This is a review, not a patch. P1 means address urgently; P2 means fix in the normal development cycle.

## Findings

### 1. [P1] Explicitly revoke existing write privileges on protected tables

**Location:** [frontend_data_api_grants.sql:6](C:/GITHUB/Table-Tennis-Tracker/supabase/migrations/20260730102425_frontend_data_api_grants.sql:6), [baseline_core_schema.sql:47](C:/GITHUB/Table-Tennis-Tracker/supabase/migrations/20240522000000_baseline_core_schema.sql:47).

`GRANT SELECT` adds a privilege; it does not remove pre-existing INSERT, UPDATE, or DELETE grants. On Supabase projects retaining the earlier default table grants, `users`, `tournaments`, `tournament_results`, `padel_stats`, `tennis_stats`, `settings`, and `debuffs` retain permissive write policies and write privileges. Later migrations explicitly revoke writes only on the three match tables and the new season tables. The new admin RPCs consequently do not prevent direct anonymous edits to player names/ratings, tournaments, or derived statistics. This is conditional on the deployed database's existing grants; those grants were not inspected remotely.

**Fix:** Add a forward migration that explicitly revokes unwanted privileges and removes permissive write policies on every protected table, then provide the authorized write paths needed by the UI. Test allowed and denied operations as `anon` and `authenticated`. [Supabase documents the legacy default grants and the distinction between grants and RLS](https://supabase.com/docs/guides/api/securing-your-api).

### 2. [P1] Keep the Discord webhook credential out of publicly readable settings

**Location:** [create_settings_table.sql:13](C:/GITHUB/Table-Tennis-Tracker/supabase/migrations/20240523020000_create_settings_table.sql:13), [discordUtils.js:200](C:/GITHUB/Table-Tennis-Tracker/src/discordUtils.js:200).

The settings policy allows every row to be read, and the grants migration explicitly grants SELECT to `anon`. Once configured, `discord_webhook_url` is therefore readable without an admin session. Hiding the Settings tab does not protect the token embedded in the URL. Possession of that URL lets a caller post through the webhook; Discord also exposes token-based webhook modification/deletion without additional authentication. [Discord webhook documentation](https://docs.discord.com/developers/resources/webhook).

**Fix:** Store the URL in a private backend location and perform sending through an admin-authorized server endpoint. Rotate a webhook that has already been exposed by these policies.

### 3. [P1] Remove anonymous overwrite and deletion access to avatars

**Location:** [baseline_core_schema.sql:88](C:/GITHUB/Table-Tennis-Tracker/supabase/migrations/20240522000000_baseline_core_schema.sql:88).

The Storage UPDATE and DELETE policies check only that `bucket_id = 'avatars'`; neither ownership nor an admin identity is required. Anyone able to call the public Storage API can replace or remove another player's avatar using its path, which is already exposed in the public player profile. This bypasses the admin-protected `update_player` RPC without changing the profile row at all.

**Fix:** Restrict object mutations through a server-authorized upload/delete flow or a suitable authenticated ownership policy. Retain public reads if desired; public reads do not require public mutation rights.

### 4. [P1] Do not include a caller-controlled User-Agent in the PIN throttle identity

**Location:** [admin_match_saving.sql:67](C:/GITHUB/Table-Tennis-Tracker/supabase/migrations/20260730105128_admin_match_saving.sql:67).

The login-attempt key hashes the address together with `user-agent`. A caller can change that header to obtain a fresh attempt counter from the same address, bypassing the five-attempt/15-minute lockout. The protected credential is only six numeric digits, so the application throttle is an important part of its protection. No brute-force requests were made during this review.

**Fix:** Enforce throttling using a trusted, normalized client identity independently of user-controlled headers, with an additional aggregate limit. Changing User-Agent must not reset the applicable limit.

### 5. [P1] Limit Ping Pong bulk selection and deletion to the filtered rows

**Location:** [Matches.jsx:27](C:/GITHUB/Table-Tennis-Tracker/src/components/Matches.jsx:27).

The table renders `filteredMatches`, but its header checkbox fills `selectedIds` from all `matches`. Reproduction: search for Alice so only her match is visible, click the header checkbox, then confirm deletion. The deletion RPC receives both the visible match and unrelated hidden matches. Padel and Tennis already use filtered IDs, but Ping Pong does not.

**Fix:** Derive selection, checkbox state, and deletion scope consistently from filtered IDs, and reconcile selection when the filter changes. An isolated local probe confirmed the hidden ID reaches the RPC.

### 6. [P1] Make double-elimination loser advancement idempotent

**Location:** [tournamentUtils.js:249](C:/GITHUB/Table-Tennis-Tracker/src/components/tournament/tournamentUtils.js:249).

`handleDoubleElimAdvancement` inserts the losing player, then `propagateAdvancements` calls `propagateLoser` for the same result. `propagateLoser` tests only whether each destination slot is empty, not whether the loser already occupies the other slot. In a four-player tournament, recording seed 1 beating seed 4 immediately produces a losers-bracket match of seed 4 versus seed 4. The recording RPC rejects that self-match, so the bracket cannot progress normally.

**Fix:** Use deterministic source-to-destination slots and one idempotent propagation path. Test full tournaments, including results entered in different orders, rather than generation alone. This exact four-player reproduction was executed locally.

### 7. [P2] Route Padel and Tennis edits through authorized RPCs

**Location:** [PadelEditMatchModal.jsx:86](C:/GITHUB/Table-Tennis-Tracker/src/components/modals/PadelEditMatchModal.jsx:86), [TennisEditMatchModal.jsx:41](C:/GITHUB/Table-Tennis-Tracker/src/components/modals/TennisEditMatchModal.jsx:41).

Both edit modals still call `.from(...).update(...)` directly, but `20260730105128_admin_match_saving.sql` revokes writes and leaves SELECT-only access on both tables. These edits fail even when the UI is in admin mode; a custom admin token does not change the Supabase client's database role. Neither modal receives/passes a token to an edit RPC.

**Fix:** Add admin-validated update RPCs that update scores and rebuild statistics atomically, and pass the token through both modals. Do not restore anonymous table writes to make the UI work.

### 8. [P2] Base Tennis and Padel ELO outcomes on sets won

**Location:** [atomic_match_recording.sql:328](C:/GITHUB/Table-Tennis-Tracker/supabase/migrations/20260623090000_atomic_match_recording.sql:328), with the equivalent Padel calculation at line 261; [tennisUtils.js:282](C:/GITHUB/Table-Tennis-Tracker/src/tennisUtils.js:282).

The backend correctly derives match wins from sets, but passes total games into `app_calculate_elo_change`, which decides the winner by comparing those totals. A valid 6–4, 0–6, 6–4 winner has won two sets while losing the game total 12–14. Starting at equal 1200 ratings, the current formula takes 18 ELO from that match winner and rewards the loser. The frontend history calculations repeat the same mistake.

**Fix:** Separate the actual match result from the chosen margin-of-victory measure, use the set winner consistently in SQL and JavaScript, and rebuild affected ratings. The score-validation and rating example was executed locally.

### 9. [P2] Use the set winner in the Padel leaderboard and Discord report

**Location:** [PadelLeaderboard.jsx:66](C:/GITHUB/Table-Tennis-Tracker/src/components/PadelLeaderboard.jsx:66), [discordUtils.js:155](C:/GITHUB/Table-Tennis-Tracker/src/discordUtils.js:155).

These displays still infer match wins from `score1 > score2`, although the stored scores are total games and the app has `getPadelScoreSummary`/`getMatchWinner` for set-based outcomes. A team winning 6–4, 0–6, 6–4 is shown as losing in the leaderboard and report, while its profile and backend win counter correctly record a win. Equal game totals can also make the leaderboard count a loss for both teams.

**Fix:** Reuse the existing set-winner helper for wins, losses, streaks, and report summaries. Keep total games only for game-specific statistics.

### 10. [P2] Block scoring while a completed Padel set is transitioning

**Location:** [PadelLiveMatchModal.jsx:426](C:/GITHUB/Table-Tennis-Tracker/src/components/modals/PadelLiveMatchModal.jsx:426).

After a non-final set is won, its winning points and game totals remain active for 1.8 seconds. `scorePoint` guards only `matchWinner`, so another click before the timer fires scores against the completed set. Reproduction: win the first set 6–0 in best-of-three, then click once more during the pause. The component records a second set of 7–0 and declares the match finished after only 25 points. The current Padel validation accepts that data.

**Fix:** Add an explicit set-transition state that blocks both click and keyboard scoring, and cancel pending transitions on reset/unmount. This sequence was reproduced with the component's actual scoring handlers in an isolated hook harness.

### 11. [P2] Reject blank, tied, and negative Ping Pong scores before recording

**Location:** [MatchModal.jsx:54](C:/GITHUB/Table-Tennis-Tracker/src/components/modals/MatchModal.jsx:54), [atomic_match_recording.sql:398](C:/GITHUB/Table-Tennis-Tracker/supabase/migrations/20260623090000_atomic_match_recording.sql:398).

The manual save handler validates players only. Clicking Finish Match without entering a score produces `NaN` for the empty field, which serializes as null; the recording SQL turns it into zero and accepts a 0–0 match. Ties and negative values are also not rejected by this recording function. A tied tournament result advances player 2, whereas the database counts no winner, leaving inconsistent standings.

**Fix:** Validate finite, non-negative integer scores and a clear winner in both the UI and the RPC. The edit RPC already rejects tied/negative scores; recording should enforce at least the same invariant. The untouched-form payload was reproduced locally; the SQL behavior was inspected statically.

### 12. [P2] Recover player selection after asynchronous data loading

**Location:** [PlayerStats.jsx:10](C:/GITHUB/Table-Tennis-Tracker/src/components/PlayerStats.jsx:10), [PadelPlayerStats.jsx:11](C:/GITHUB/Table-Tennis-Tracker/src/components/PadelPlayerStats.jsx:11).

Reloading with the persisted Stats tab active mounts the component while `users` is empty, initializing `selectedPlayerId` to an empty string. Loading users later does not update that state, and the effect only watches `initialPlayerId`. The early return displays “Select a player” before rendering the selector, so the page cannot recover without navigating away. Switching to an archived season that lacks the selected player creates a similar dead end.

**Fix:** Derive a valid fallback from current users or reconcile the selection whenever the available users change. Keep a usable selector in empty/invalid-selection states. The empty-to-populated users sequence was reproduced locally.

### 13. [P2] Paginate Padel and Tennis history before deriving statistics

**Location:** [App.jsx:210](C:/GITHUB/Table-Tennis-Tracker/src/App.jsx:210).

Both sports request one response with `.limit(2000)`. The effective result is capped by that limit and any lower server-side response cap, while all-time win counts and rating histories are computed from the returned subset. Once the cap is exceeded, older matches disappear, displayed totals disagree with stored lifetime statistics, and ELO charts replay the newest subset from 1200. Ping Pong already has a pagination helper to avoid this issue.

**Fix:** Fetch every required page with stable ordering, or move the relevant aggregate/history calculations to the server. A larger single-request limit is not a complete fix.

### 14. [P2] Rotate the Tennis server within a tiebreak

**Location:** [TennisLiveMatchModal.jsx:112](C:/GITHUB/Table-Tennis-Tracker/src/components/modals/TennisLiveMatchModal.jsx:112).

During a tiebreak, every non-winning point takes the early return without updating `server`. The only server change occurs after a whole game is won, so the UI labels the same player as serving throughout the tiebreak. The live scorer should switch after the first point and then every two points, while maintaining the correct next-set server.

**Fix:** Track the initial tiebreak server and derive the current server from tiebreak point count. A local scoring sequence through 6–6 confirmed the server does not change after the first tiebreak point.

### 15. [P2] Parse date-filter boundaries as local calendar dates

**Location:** [Leaderboard.jsx:22](C:/GITHUB/Table-Tennis-Tracker/src/components/Leaderboard.jsx:22); the same pattern appears in the other leaderboards and player-stat components.

`DateRangePicker` supplies local `YYYY-MM-DD` strings, but `new Date(startDate)` interprets them as UTC midnight. The end boundary then uses local `setHours`, mixing two time bases. In Europe/Ljubljana on 15 October, Today starts at 02:00 local and excludes a match at 01:00. In time zones west of UTC, the end can land on the previous local day.

**Fix:** Construct both boundaries from local year/month/day components, with an exclusive next-day end boundary. The Ljubljana example was executed locally.

### 16. [P2] Provide an explicit player-creation path for fresh databases

**Location:** [AddUserModal.jsx:38](C:/GITHUB/Table-Tennis-Tracker/src/components/modals/AddUserModal.jsx:38), [frontend_data_api_grants.sql:6](C:/GITHUB/Table-Tennis-Tracker/supabase/migrations/20260730102425_frontend_data_api_grants.sql:6).

On a fresh project without automatic write grants, the migration set grants only SELECT on `users`, but Add Player directly inserts into that table. There is no creation RPC and no explicit INSERT grant, so the documented fresh-instance smoke test fails at the first player. The same grant dependency affects direct settings/debuff writes. Existing legacy grants can mask this functional issue while causing finding 1.

**Fix:** Explicitly define the intended creation permission and provide a narrow creation RPC or grant/policy for it. Add authorized settings/debuff write paths rather than relying on platform defaults. [Supabase's documentation explains the transition away from automatic grants](https://supabase.com/docs/guides/api/securing-your-api).

## Validation and limits

- `npm run lint`: passed.
- `npm run build`: passed; emitted a large-chunk warning and an empty vendor-chunk warning.
- `npm test`: all 37 tests across 8 files passed. The initial run could not rename temporary files in the sandbox TEMP directory; rerunning with TEMP/TMP under the workspace succeeded.
- Eight isolated reproduction probes passed: duplicate tournament participant, ELO loss for a set winner, premature Padel completion, fixed Tennis tiebreak server, Stats hydration dead end, blank score payload, hidden match IDs in bulk deletion, and local-date exclusion. The script is in `.tmp/review-probes.mjs` and does not make network requests or modify application data.
- The hook harness exercises extracted component logic with mocked state and external dependencies; it is not a browser end-to-end test.
- No production database mutations, webhook sends, or login attacks were performed. Actual deployed grants and migration state remain unverified. Database behavior was reviewed from SQL; a local PostgreSQL integration run was unavailable because the Docker daemon was not running.
- Existing migration tests mainly assert SQL text fragments. They do not execute the migrations or verify database authorization, and the tournament tests cover generation rather than complete result progression. Passing tests therefore do not establish that the affected flows work.

Application source files were not changed. This report and an ignored local reproduction script were added for the review.
