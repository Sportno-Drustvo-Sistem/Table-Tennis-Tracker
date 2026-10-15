# Execution brief: fix the webapp code-review findings

You are implementing fixes in `C:/GITHUB/Table-Tennis-Tracker`. Complete the work described below, including regression tests and database migrations. Do not stop after proposing a plan or fixing only the first few findings.

Read the accompanying [review report](C:/GITHUB/Table-Tennis-Tracker/docs/code-review-2026-10-15.md) first. It contains the evidence, original source locations, and explanations for all 16 findings. Finding numbers below refer to that report. Recheck the current code before editing: source line numbers may have changed, and database findings are conditional on the deployed grants.

## Starting state and scope

- This is a React/Vite application using Supabase, with Ping Pong, Padel, Tennis, tournament management, seasons, custom admin sessions, avatar uploads, and Discord reporting.
- The review did not modify application source. At handoff, the existing untracked `.claude/` directory was unrelated user work; preserve it and any other changes you discover.
- Inspect applicable repository instructions and `git status` before editing.
- Implement locally. Prepare migrations and deployment instructions; do not apply migrations to production, deploy services, rotate external credentials, or send Discord messages as part of local verification.
- Keep the current custom admin-session architecture unless a finding requires a focused change. Its token is not a Supabase Auth JWT and does not change the database role of the browser client.
- Preserve public viewing, archived-season immutability, sport-specific statistics, and existing match/tournament data. The current UI permits public player creation; preserve that behavior through a narrowly scoped creation path rather than silently requiring admin mode for it.
- Use new forward migrations for databases that already applied the existing migrations. Verify the full migration chain also works on a blank database. Do not solve upgrade problems only by editing historical migration files.
- Keep changes focused on these defects. Avoid an unrelated UI redesign or dependency upgrade.

## Implementation order

First address the two locally reproducible data-integrity defects: filtered deletion and tournament advancement. Then implement authorization changes together with their replacement write paths so that hardening does not disable legitimate operations. Finally fix scoring, displays, loading, and date handling. You may adjust the order to accommodate actual dependencies, but complete every numbered finding.

### A. Filtered bulk deletion — finding 5

Primary file: `src/components/Matches.jsx`.

Use the filtered match IDs for select-all, checked/indeterminate state, selection reconciliation, and the deletion payload. Use the existing Padel/Tennis implementations as references after verifying their behavior.

Acceptance checks:

- With two matches and a search matching only one, select-all and delete send only that visible match ID.
- Changing the search cannot silently leave hidden matches eligible for deletion.
- Individual selection, deselect-all, empty search results, and normal unfiltered selection still work.

### B. Double-elimination progression — finding 6

Primary files: `src/components/tournament/tournamentUtils.js`, `src/components/tournament/Tournament.jsx`, and tournament tests.

Eliminate duplicate advancement between `handleDoubleElimAdvancement` and `propagateAdvancements`/`propagateLoser`. Assign deterministic source-to-destination slots instead of filling whichever slot happens to be empty. Repeated propagation must not duplicate, displace, or erase participants.

Acceptance checks:

- In a four-player tournament, recording seed 1 beating seed 4 does not produce seed 4 versus seed 4 in the losers bracket.
- Repeated propagation leaves the bracket unchanged.
- Full four- and eight-player tournaments reach completion with valid opponents, including when ready matches are played in a different order.
- A bracket with byes, such as five players, progresses without treating an opponent who has not arrived yet as a bye.
- Existing single-elimination and group-stage behavior remains functional.

### C. Authorization and supported write paths — findings 1, 2, 3, 4, 7, 16

Primary areas: Supabase migrations; `src/adminSession.js`; `src/matchPersistence.js`; `src/App.jsx`; player/edit modals; `src/components/DebuffSettings.jsx`; `src/components/DiscordSettings.jsx`; `src/discordUtils.js`.

1. **Finding 1: explicitly enforce table permissions.** Revoke unwanted existing INSERT/UPDATE/DELETE privileges and remove permissive write policies on protected tables. Cover users, tournaments, tournament results, sport statistics, settings, and debuffs. `GRANT SELECT` alone does not revoke legacy privileges. Audit existing RPCs as well as table access so no alternate write path bypasses authorization.
2. **Finding 16: preserve player creation and settings management.** Implement an explicit, narrow public player-creation path that only accepts intended profile fields and initializes statistics on the server. It must not permit callers to choose ratings, wins, or other protected state. Provide admin-validated settings/debuff mutation paths and update the frontend callers. Fresh installations must not depend on implicit platform grants.
3. **Finding 7: restore Padel/Tennis editing.** Add admin-validated RPCs for editing matches, validate the payload, and update scores plus derived statistics in one transaction. Pass `adminToken` through App and both modals. Keep direct browser writes to match/statistics tables denied. Coordinate recalculation with the existing sport-specific locking convention. Supply the Padel editor's required player data while updating the wiring.
4. **Finding 2: privatize the Discord webhook.** Remove the credential from anonymously readable settings and move sending behind an admin-authorized server endpoint. Keep service credentials server-side. Provide configuration/status and update behavior without returning the stored webhook secret to public readers. If migrating an existing configured URL, preserve it privately and remove its public copy atomically. Implement the endpoint and frontend integration, not just a placeholder. Document required runtime secrets and deployment steps, including operator rotation of an already-exposed webhook. Mock outbound Discord requests in tests.
5. **Finding 3: protect existing avatar objects.** Remove anonymous UPDATE/DELETE access to other players' objects. Preserve public avatar display and optional avatar creation through an appropriately scoped flow. For the current public Add Player flow, use create-only unique object paths or a narrow upload authorization rather than broad overwrite rights. Admin avatar replacement must continue to work. Custom admin tokens need explicit server validation; do not assume Storage RLS recognizes them automatically.
6. **Finding 4: repair the PIN throttle.** User-Agent changes must not create fresh attempt quotas. Verify which client-address information the deployment actually trusts, normalize that identity, and implement an independent aggregate limit. Do not trust arbitrary forwarded headers without a defined proxy boundary. Preserve expiration/revocation behavior and test throttle state transitions locally without attacking a live endpoint.

Acceptance checks:

- Test both a fresh database without implicit grants and an upgrade fixture containing legacy write grants.
- Anonymous and ordinary authenticated clients cannot directly modify protected tables or overwrite/delete existing avatars.
- Valid custom admin sessions can perform intended mutations; missing, invalid, revoked, and expired sessions cannot.
- Public reads and narrow player creation still work, including the first player on an empty database.
- New player payloads cannot inject ratings or win counts.
- Both sport edit flows persist valid changes and rebuild statistics atomically; validation failures leave both unchanged.
- The webhook cannot be read through public table access or an unguarded endpoint. Sending requires admin validation.
- Changing User-Agent does not reset the throttle, and concurrent attempts cannot trivially exceed the intended limit.

### D. Correct set-based outcomes and rating calculations — findings 8 and 9

Primary files: the SQL recalculation functions currently defined in `20260623090000_atomic_match_recording.sql`, `src/utils.js`, `src/padelUtils.js`, `src/tennisUtils.js`, `src/components/PadelLeaderboard.jsx`, and `src/discordUtils.js`.

Make the actual Tennis/Padel match outcome depend on sets won when set data exists. Separate that outcome from any margin-of-victory weighting instead of letting total games decide who won. Choose and document a consistent weighting for these sports, with a positive weight even when game totals tie. Keep SQL persistence and JavaScript history replay consistent, including rounding and chronological ordering. Preserve sensible behavior for legacy rows without set data, and avoid changing Ping Pong's scoring unintentionally.

Use the existing set-winner helpers consistently in the Padel leaderboard and Discord summaries, including wins, losses, and streaks. Prepare a controlled recalculation path for affected historical ratings, and document how an operator applies it; preserve match records and archived Ping Pong snapshots.

Acceptance checks:

- A 6–4, 0–6, 6–4 win is a two-set victory despite a 12–14 game total. At equal starting ratings the winner gains ELO and the loser loses it.
- A legitimate set victory with equal total games also receives the correct outcome and a nonzero rating adjustment at equal ratings.
- Padel cards, profiles, leaderboard, match history, and report agree on the winner.
- SQL recalculation and frontend history produce matching results for the same fixtures.
- Legacy matches without set data retain the documented fallback behavior.

### E. Padel set transition — finding 10

Primary file: `src/components/modals/PadelLiveMatchModal.jsx`.

Represent the transition after a completed set explicitly and block both click and keyboard scoring during it. Manage the reset timer so it cannot modify a reset, closed, or replacement match. Preserve the intended undo behavior and serve state.

Acceptance checks:

- Winning the first set 6–0 and scoring again during the 1.8-second pause cannot append a second set or finish the match.
- After the transition, the next set starts once at 0–0.
- Resetting or closing before the timer fires does not later mutate the active match.
- Use fake timers to verify the transition and cleanup.

### F. Ping Pong score validation — finding 11

Primary files: `src/components/modals/MatchModal.jsx` and the match-recording SQL implementation.

Reject blank, null, nonfinite, negative, fractional, and tied scores at the appropriate boundaries. Validate every supplied set on the server before committing any match rows or statistical changes. Do not silently coerce invalid input to zero. Enforce at least the same non-negative integer/clear-winner invariants as the edit RPC; preserve intentionally supported casual scoring formats unless product requirements say otherwise.

Acceptance checks:

- Clicking Finish Match with untouched fields does not record 0–0 or advance a tournament.
- Direct RPC calls with invalid sets are rejected even if the UI validation is bypassed.
- A multi-set payload containing an invalid set creates no partial records.
- Valid manual and live matches still save.

### G. Stats selection after loading — finding 12

Primary files: `src/components/PlayerStats.jsx` and `src/components/PadelPlayerStats.jsx`.

Keep the selected player valid as users arrive or the season changes. Preserve a user-selected player while it remains available, use a valid fallback when needed, and render a usable empty/selection state.

Acceptance checks:

- Reload on the persisted Stats tab with initially empty users, then resolve the fetch: a valid profile becomes visible without navigating away.
- Switching to a season without the selected player does not strand the screen before its selector.
- A genuinely empty player list has an appropriate empty state.

### H. Complete Padel and Tennis history — finding 13

Primary files: `src/App.jsx`, `src/seasonUtils.js`, and the sport history consumers.

Replace the single `.limit(2000)` queries with complete pagination using stable ordering, or an equivalent server aggregation/history approach. Account for the server's actual page cap, not just a larger client limit. Surface failed/incomplete loads without presenting truncated history as complete.

Acceptance checks:

- Fixtures spanning more than one response page, including over 2000 matches, load all required rows exactly once.
- Equal timestamps have a deterministic tie-breaker.
- All-time totals and history agree with stored statistics after loading.
- A failed intermediate page does not silently become a successful partial history.

### I. Tennis tiebreak serving — finding 14

Primary file: `src/components/modals/TennisLiveMatchModal.jsx`.

Track or derive the tiebreak server from its initial server and the total tiebreak point count. Preserve correct next-set serving and undo/reset state.

Acceptance checks:

- For an initial server A, point servers follow A, B, B, A, A, B, B, and so on.
- Both initial-server choices and an extended tiebreak work.
- Undo restores the correct server; next-set serving follows the tiebreak rules.

### J. Local date filters — finding 15

Primary areas: `src/components/DateRangePicker.jsx`, all three leaderboards, and all three player-stat components.

Parse calendar-date inputs as local dates and consistently use local start-of-day and exclusive next-day end boundaries. Prefer a shared helper. Avoid adding a fixed 24 hours across daylight-saving transitions.

Acceptance checks:

- Today includes a match at 01:00 in Europe/Ljubljana on 2026-10-15.
- Selected-day boundaries work in a timezone west of UTC.
- Both daylight-saving transition days, end-of-day inclusion, and exclusion of the following day's midnight are correct.
- All filter consumers use the same boundary semantics.

## Verification guidance

At review time, `npm test` passed 37 tests across 8 files; `npm run lint` and `npm run build` passed. The build emitted large-chunk and empty vendor-chunk warnings. Existing migration tests largely inspect SQL strings and are not substitutes for executing migrations or checking authorization.

An optional local script at `C:/GITHUB/Table-Tennis-Tracker/.tmp/review-probes.mjs` reproduces eight findings with extracted logic and mocks. It is ignored by Git and may be absent in a fresh checkout. Its assertions confirm the OLD BUGGY behavior: do not treat a passing run as success after remediation. Convert useful reproductions into durable regression tests that assert correct behavior. The script is not a browser or database integration test.

On this Windows workspace, the initial Vitest run failed with EPERM while renaming files in the sandbox temporary directory. This workaround succeeded:

```powershell
New-Item -ItemType Directory -Force .tmp/test-temp | Out-Null
$env:TEMP = (Resolve-Path .tmp/test-temp).Path
$env:TMP = $env:TEMP
npm test
```

Use a disposable local/test database for migration, role-permission, and transactional checks. The Docker executable was available during review, but its daemon was not running. Recheck available infrastructure. If database execution remains unavailable, complete implementation and executable integration tests, document the exact unverified checks, and do not claim that source inspection proves deployment safety.

Run targeted regression tests as fixes are made, then the full test suite, lint, and production build. Exercise the changed UI flows with component or browser tests where practical, especially bulk selection, async Stats loading, score editing, and timed live scoring. Test external sends with mocks.

## Completion and handoff

Create a completion note mapping all 16 finding numbers to changed files, regression tests, and status. Distinguish implemented-and-verified work from deployment steps and checks that could not run. If a finding is no longer applicable, document evidence rather than silently skipping it.

Deliver the code, forward migrations, regression tests, and any backend endpoint required by the fixes. Update fresh-instance/deployment documentation for new permissions, runtime configuration, webhook migration/rotation, and historical rating recalculation. Provide exact commands or steps for pending operator actions.

Finish with a concise summary of fixes, actual test results, material remaining limitations, and the migration/deployment order. Do not describe all findings as resolved if a necessary frontend path, server endpoint, migration, or verification is still missing.
