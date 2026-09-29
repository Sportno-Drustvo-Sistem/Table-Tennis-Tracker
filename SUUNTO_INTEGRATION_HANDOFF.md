# Suunto padel integration — handoff and progress tracker

Last updated: 2026-09-29. This file is the continuation record for this integration.
Update it after implementation, testing, a changed decision, or a commit. Confirm
Git state and relevant source before relying on its snapshot. Usage and encoding
details live in [docs/suunto-padel.md](docs/suunto-padel.md).

## Objective and agreed scope

Track padel points on the user's **Suunto 9 Peak Pro**, calculate games and sets,
preserve several matches within one workout, and transfer the results to
PingpongTracker's database with the correct four players and ranking updates.

- Padel only; point-by-point entry with automatic game/set scoring.
- Keep the watch app private. No SuuntoPlus Store publication is requested.
- After a win, finish that match and start another without stopping the workout.
- Preserve completed results locally; transfer them after playing. Immediate
  watch-to-database sending is outside the currently chosen approach.
- User reports that Suunto also allows JSON workout exports. Prioritize testing
  this route; do not assume FIT import or Cloud API access is required.
- User wants this file to preserve context and progress between sessions.

## Current status

**An eight-match prototype and manual JSON importer exist. Real watch/export
validation is outstanding. Automatic cloud sync is not implemented.**

| Milestone | Status | Evidence or next action |
| --- | --- | --- |
| Single-match scoring and JSON import | Committed | `5d20e24` on `main` |
| Up to eight matches per workout | Included in the commit containing this handoff | Watch source v0.2 and queue decoder |
| Separate match review and save | Included in the commit containing this handoff | Padel record modal and `keepOpen` callback |
| Automated scoring/import tests | Passed in this conversation | 58 tests across 8 test files |
| Lint and web production build | Passed in this conversation | Build has bundle-size and old Browserslist-data warnings |
| Official Suunto validation/build | Passed in this conversation | Editor 1.42.0 tools, display `n` |
| Compiled queue/capacity/undo checks | Passed in this conversation | Compiled package exercised through all eight matches |
| Physical watch controls and layout | Pending | Install v0.2 and test on the 9 Peak Pro |
| Actual JSON export compatibility | Pending — next priority | Obtain an export and inspect app summary fields |
| Live database import verification | Pending | Prior tests do not prove a live database round trip |
| Durable duplicate protection | Pending | Saved markers currently last only while modal is open |
| FIT file import | Optional, not implemented | Consider only if useful or JSON lacks the needed fields |
| Automatic Cloud API sync | Optional, not implemented | Eligibility and API credentials are unresolved |

## Git and artifact snapshot

Repository: `C:\Users\maksimilijan.stajer\Ping Pong\PingpongTracker`.
Branch at handoff: `main`. The v0.1 base commit is `5d20e24`
(`Add private Suunto padel scoring prototype and workout import`). The v0.2 work
and this handoff are included in the subsequent commit containing this file;
use `git log -1` to obtain its hash.

The later eight-match work is recorded in these files:

- `integrations/suunto-padel/main.js`
- `integrations/suunto-padel/manifest.json`
- `integrations/suunto-padel/t.html`
- `src/suuntoPadelImport.js`
- `src/suuntoPadelImport.test.js`
- `src/components/modals/PadelMatchModal.jsx`
- `src/App.jsx`
- `docs/suunto-padel.md`

This handoff and its README/documentation links are included as documentation
changes. The user requested committing everything, including the existing
migration below. No push was performed in this conversation. Recheck Git and
remote state before future publication.

**Unrelated existing work:**
`supabase/migrations/20260929120000_fix_mutable_function_search_paths.sql` was
already untracked before this integration. The user's subsequent "Commit
everything" instruction includes it in this commit. It pins function search
paths; it has not been applied to or verified against a live database here.

Generated watch package: `integrations/suunto-padel/dist/ttpadel1-n.fea`.
The v0.2 package was rebuilt and copied there after successful validation. It is
ignored by Git because `dist` directories are ignored. A fresh checkout will
need a rebuild; source files are the maintainable artifact.

## How the implementation works

- `main.js` is an ES5 SuuntoPlus script. Callbacks use native event IDs; helpers
  are **function expressions assigned to variables**. The Suunto minifier dropped
  ordinary named helper functions during initial development. Preserve this
  convention and test the compiled package, not just the uncompiled source.
- Top/bottom clicks add points to Team 1/2. During play, holding either undoes.
  After a win, holding top undoes the winning point; holding bottom commits the
  result in memory and starts the next match. Eight points of undo are retained
  only within the current match. Committed earlier matches cannot be undone.
- Default rules: advantage scoring, sets to six by two, seven-point tiebreak by
  two at 6–6, best of three. Single-set format is configurable for the workout.
  Golden point and deciding match tiebreaks are not implemented.
- A workout stores at most eight complete matches. At capacity it shows
  `SAVE WORKOUT` and refuses a ninth. The last complete match exports even if
  next was never pressed. An unfinished last match is omitted without losing
  earlier results. Watch/app crash recovery is not implemented.
- Four summary fields `q1`–`q4` store two results each. Legal set outcomes use
  base-15 digits; each match fits in 12 bits. Pair values stay below 2^24, exactly
  representable in Suunto's float32 export fields. See the usage document for
  the exact contract. The legacy `v/a/b/c` single-match export is still accepted.
- `parseSuuntoPadelWorkoutMatches(text)` returns ordered match objects with
  `matchFormat` and `setsData`. It expects exactly one `Tracker Padel` entry in a
  `Zapps` array, wrapped as `{ Zapp: { Name, SummaryOutputs } }`; summary entries
  use `Id` and `SummaryValue`. It finds this header inside nested JSON containers.
  **A differently structured JSON export needs an explicit adapter and tests.**
- `parseSuuntoPadelWorkout(text)` remains a single-match compatibility wrapper
  and rejects multi-match exports instead of discarding results.
- File size is limited to 10 MB. Corrupt fields, gaps, extra sets, incomplete
  results, mixed protocols, and ambiguous multi-workout files are rejected.
- The record modal lets the user review scores and assign four players per
  result. Draft selections survive switching among unsaved results. Saving one
  advances to the next; saved results are disabled in the current modal session.
- `handlePadelMatchSaved({ keepOpen })` refreshes data after each save and closes
  only after the final result. Failed saves remain available to retry.
- Saving reuses `recordPadelMatch` → `record_padel_match` with existing admin
  authorization. No new schema, cloud service, or watch credential was added.
  Repeat imports or reopening the modal can still produce duplicates.

## Next-session work, in order

1. Read this file and the usage document; run `git status --short`. Preserve all
   existing changes, including the unrelated migration.
2. Test the watch package if the device is available. Check buttons, long-press
   behavior, screen readability, multiple matches, final-point undo, capacity,
   and whether a locally installed app remains available after normal syncing.
3. Get a real JSON export through the user's available Suunto export route.
   Confirm where it comes from (mobile app, another Suunto interface, or Editor),
   its shape, and whether `Tracker Padel` and all four queue fields survive.
   The user has reported JSON availability; this conversation has not examined
   a real export. Do not equate all JSON export formats or claim compatibility
   solely because their file extension is `.json`.
4. If the existing parser matches, verify decoding against known watch scores.
   Otherwise add a narrowly scoped adapter and regression fixtures. Remove
   personal identifiers, GPS, heart rate, and unrelated data from committed
   fixtures. Do not commit a raw personal workout.
5. Exercise the review UI and authorized database saving with different players
   across matches. Verify the modal stays open, rankings refresh correctly, and
   failures preserve unsaved results. Use test data and an appropriate backend;
   do not silently add fabricated matches to production rankings.
6. Address duplicate protection before describing import as robust across
   sessions/retries: identify the workout and match ordinal, and enforce
   uniqueness with the save transaction if the backend is changed.
7. Run appropriate checks, rebuild the watch package after watch-source changes,
   and update this tracker with evidence and remaining gaps. Create a scoped
   commit when requested. Do not publish the private watch app.

## Validation and build notes

From the repository root:

```powershell
npm test
npm run lint
npm run build
git diff --check
```

Last full suite: **58 passed**. The Suunto test file has 25 tests, including
exhaustive decoding of all 1,484 legal single-set/best-of-three outcomes and
checks for exact float32 round trips. These are synthetic tests, not device data.
Tests warn about missing Supabase environment configuration; no live database
verification was performed. The full 58-test suite, lint, and production build
were rerun successfully before the requested commit. Git whitespace checks
also passed. The build retains its existing Browserslist and chunk-size warnings.

Use the official VS Code SuuntoPlus Editor to validate/build for display `n`,
then deploy privately or load the `.fea` using its binary-to-watch command.
The development tools downloaded in this conversation also exposed this CLI:

```powershell
# Set this to the actual installed/extracted package directory; do not assume
# the previous session's temporary SDK files still exist.
$suuntoToolsDir = '<path to @suunto-internal/suuntoplus-tools>'
New-Item -ItemType Directory -Path integrations/suunto-padel/dist -Force | Out-Null
node "$suuntoToolsDir/bin/build-app.js" --appID ttpadel1 --input integrations/suunto-padel --output integrations/suunto-padel/dist --displayID n
```

The prior extracted SDK was under
`$env:TEMP/suuntoplus-inspect/extension/node_modules/@suunto-internal/suuntoplus-tools`.
The compiled-package verification helper was `$env:TEMP/verify-padel-sdk.cjs`.
Both are temporary, untracked aids, not durable project dependencies. Native
compiler/esbuild subprocesses required sandbox escalation in this environment.
For Python work, follow the user's preference for UV rather than pip.

## Cloud access findings and optional future route

Official pages checked on 2026-09-29 distinguish local watch development from
Cloud API access. Private local deployment does not require Store submission.
The published Cloud API policy excludes personal use and targets services for
an audience; solo-developer eligibility without a company was not confirmed.
The current application mentions local community concepts. Ask Suunto honestly
about eligibility if pursuing this route; do not assume access is guaranteed.

Automatic sync would need account linking, OAuth credentials, secure server-side
token refresh/storage, workout notifications/fetching, a data adapter, player
assignment, and durable per-workout/per-match duplicate protection. None of those
cloud components exists yet. Do not put admin or service-role credentials on the
watch. Treat cloud sync as optional while validating the API-free JSON path.

- [SuuntoPlus development guide](https://forum.suunto.com/topic/14651/how-to-get-started)
- [Editor and workout JSON export](https://apizone.suunto.com/suuntoplusEditor)
- [SuuntoPlus export fields](https://apizone.suunto.com/fit-description)
- [Cloud eligibility FAQ](https://apizone.suunto.com/faq)
- [Partner application](https://survey.alchemer.eu/s3/90553908/PARTNER-Become-a-Suunto-Partner)
- [Partner questions](https://survey.alchemer.eu/s3/90553911/Partner-Questions)

## Copy-ready continuation prompt

> Continue the private Suunto 9 Peak Pro padel integration in this repository.
> Read SUUNTO_INTEGRATION_HANDOFF.md and docs/suunto-padel.md first, then verify
> Git state. Preserve the existing eight-match implementation and unrelated
> migration. Prioritize real JSON-export compatibility and device validation;
> the user says Suunto supports JSON exports. Do not assume Cloud API access or
> FIT support is required. Complete available work, distinguish synthetic tests
> from hardware/live database verification, and update the handoff with progress.

## Session log

| Date | Change | Verification / remaining work |
| --- | --- | --- |
| 2026-09-29 | Private v0.1 prototype committed as `5d20e24` | 52 tests, lint, web build, native compilation and compiled scoring/undo passed; hardware/export unverified |
| 2026-09-29 | v0.2 eight-match queue and individual review implemented, not committed | 58 tests, lint, web build, native validation/build and compiled queue checks passed; actual export, UI interaction and live saving unverified |
| 2026-09-29 | User confirmed interest in API-free JSON transfer; this handoff created | Next: inspect a real JSON export, preserve context, and update this tracker after subsequent work |
| 2026-09-29 | User requested committing everything; v0.2, handoff and existing search-path migration included | Full suite: 58 passed; lint, production build and whitespace checks passed; hardware/export/live database gaps remain |
