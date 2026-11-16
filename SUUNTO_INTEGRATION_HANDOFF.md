# Suunto padel integration — handoff and progress tracker

Last updated: 2026-09-29. Read this file and [usage/export details](docs/suunto-padel.md)
when continuing; verify Git state and relevant source before relying on this snapshot.

## Current decision and objective

The user changed the architecture to an **independent watch scorer plus manual
file upload**. The watch uses anonymous Player 1, 2, 3, and 4 positions, scores
padel games/sets, and preserves up to eight matches per workout. After playing,
export workout JSON/FIT and upload to PingpongTracker. Assign the actual profiles
to each position for each match in the tracker, then review and save.

- Player 1+2 are Team 1 (top point button); Player 3+4 are Team 2 (bottom).
- No profile selection, tracker account, backend, credential, or network is needed
  on the watch. Its folder opens/builds independently in SuuntoPlus Editor.
- SuuntoPlus still operates within a watch workout; this is an independent scorer,
  not an operating-system app outside workout mode.
- Keep the watch app private. No Store publication is requested.
- After winning, start another match without stopping the workout.
- The tracker has a separate **Import Suunto workout** entry point in admin mode
  under Padel → Matches. Upload comes before profile assignment.
- JSON and FIT are supported for the documented scoring-summary contracts.
  Real device/export validation is still pending.
- Automatic Cloud API/OAuth sync is outside the chosen workflow.

## Current implementation and verification

Watch UI version **0.3** shows `P1+P2 / P3+P4`. App name `Tracker Padel`, private
app ID `ttpadel1`, and numeric v0.2 queue contract stay unchanged to preserve
compatibility. The watch folder has its own README and no dependency on web code.

The importer opens without preselected teams. Each result starts with four empty
profile slots. Four distinct existing profiles are required before saving.
Switching unsaved results retains each result's mappings and score draft. Saving
one result advances to the next and refreshes matches/rankings. Failed saves keep
the result available for retry; the final successful save closes the window.
Manual Record Match remains separate and keeps its existing selection-first flow.

FIT imports use the lazily loaded official `@garmin/fitsdk` in the browser. The
adapter verifies CRC/integrity, exact file size, the SuuntoPlus prefix and ASCII
`ttpadel1` application ID, named float32 summaries, and a single session. It
ignores other apps' identically named fields. It rejects corrupt/missing scores,
ambiguous inputs, and unsupported decoding features. Current SDK compressed
timestamp records are unsupported; actual exports must be inspected for this.
JSON continues to target the Editor's nested `Zapps`/`Zapp`/`SummaryOutputs` shape.
A different JSON shape needs an explicit adapter and tests.

| Check | Evidence | Remaining limit |
| --- | --- | --- |
| Full automated suite | 78 tests across 10 files | Synthetic watch/FIT data and mocked UI persistence |
| React import UI | Upload without teams, four slots, per-match drafts, ordered saves, retry, manual flow | No browser visual or live backend round trip |
| FIT decoder | Actual binary fixtures encoded with official Garmin SDK; identity/integrity/legacy/queue/error checks | No real Suunto export yet |
| Lint and production build | Passed | Existing Browserslist, empty vendor chunk, and bundle-size warnings |
| Official Suunto build/validation | Display n, v0.3 passed | No physical device validation |
| Compiled scoring | Eight-match queue, capacity, decoding and final-point undo passed | Watch controls/layout unverified |
| Duplicate protection | Current-window saved markers only | Repeat import/reopening can still create duplicate matches |
| Live save/rankings | Uses existing authorized recordPadelMatch transaction | Test on a suitable backend before relying on it |

## Git and artifacts

Repository: `C:\Users\maksimilijan.stajer\Ping Pong\PingpongTracker`.
Git was clean at the start of the separation work. Last existing commit:
`7e05d47 Add multi-match Suunto padel import and integration handoff` on main;
original v0.1 was `5d20e24`. This separation work is uncommitted; no push or
publication was requested/performed. Recheck status before subsequent work.
The earlier search-path migration is already in history; it was not modified here.

Relevant files:

- `integrations/suunto-padel/{README.md,manifest.json,main.js,t.html,data.json}`
- `src/suuntoPadelImport.js` — JSON decoder, shared queue decoder, FIT/file adapter
- `src/suuntoPadelImport.test.js` — watch and summary regression tests
- `src/suuntoPadelFit.test.js` — binary FIT and file-dispatch tests
- `src/components/modals/PadelMatchModal.jsx` — separate import-mode review/mapping
- `src/components/modals/PadelMatchModal.test.jsx` — React workflow regression tests
- `src/App.jsx` — separate import entry point
- `package.json` / `package-lock.json` — FIT runtime and React/jsdom test dependencies
- `docs/suunto-padel.md` — current use, player positions, export contract, limitations

Generated private package: `integrations/suunto-padel/dist/ttpadel1-n.fea`.
It was rebuilt for v0.3 and is ignored by Git; fresh checkouts need to rebuild.

## Scoring and data safeguards

- `main.js` is ES5; helper functions are expressions assigned to variables. The
  Suunto minifier dropped ordinary named helpers in earlier development. Preserve
  this convention and verify compiled code after scoring changes.
- Holding during play undoes one of the last eight points. After a win, holding
  top undoes the winning point; holding bottom commits and starts next. Prior
  committed matches are locked. A ninth match cannot overwrite the queue.
- Advantage scoring; sets to six by two; seven-point tiebreak by two at 6–6;
  single set or best of three. Golden point and deciding match tiebreaks unsupported.
- Final completed match exports without pressing next. Unfinished final match is
  omitted while preserving earlier results. Crash recovery is not implemented.
- `q1`–`q4` each contain two ordered match codes, packed below 2^24 for float32
  precision. Legacy `v/a/b/c` is also supported. See usage document for digits.
- File limit: 10 MB. Upload reads locally and does not create database records.
  User review/save uses existing admin-authorized match persistence and rankings.
  No new schema, cloud service, watch identity/profile data, or credential is added.
- The score export is team based, not individual point attribution/serving order.
  Profile assignments can differ per match; watch positions remain fixed.
- Do not commit raw personal workouts. Strip GPS, heart rate, identifiers and
  unrelated fields from any future regression fixtures.

## Next-session priorities

1. Read this file and docs; check Git. Preserve all existing changes. Commit only
   if requested. Do not publish the private watch app.
2. Install the v0.3 package on the 9 Peak Pro. Test Player 1+2 / Player 3+4 labels,
   buttons, holds, readability, win undo, next match, capacity, and mobile sync.
3. Obtain actual JSON and FIT exports with known scores. Verify custom summaries
   survive the user's export route. Inspect JSON structure and whether FIT uses
   features the SDK rejects. Add narrowly scoped adapters/fixtures if necessary;
   never assume compatibility from the extension alone.
4. Exercise the separate upload/profile review in a real browser and save against
   an appropriate test backend. Verify rankings refresh, profile order, and retry.
   Do not silently add fabricated results to production rankings.
5. If durable duplicate protection is requested, identify workout + match ordinal
   and enforce uniqueness atomically with match/ranking updates. Existing markers
   only prevent re-saving within the currently open modal.
6. Run the suite, lint, production build, whitespace checks, and watch build after
   changes; update this tracker with evidence and honest remaining limitations.

## Build commands

From the repository root:

```powershell
npm test
npm run lint
npm run build
git diff --check
```

SuuntoPlus Editor can validate/build display n and privately deploy by USB.
The current temporary SDK also provides:

```powershell
$suuntoToolsDir = '<actual @suunto-internal/suuntoplus-tools directory>'
New-Item -ItemType Directory -Path integrations/suunto-padel/dist -Force | Out-Null
node "$suuntoToolsDir/bin/build-app.js" --appID ttpadel1 --input integrations/suunto-padel --output integrations/suunto-padel/dist --displayID n
```

Temporary SDK used this session:
`$env:TEMP/suuntoplus-inspect/extension/node_modules/@suunto-internal/suuntoplus-tools`.
Compiled verification helper: `$env:TEMP/verify-standalone-padel-sdk.cjs`.
Verify these paths still exist before reuse. The official validator enforces a
100-character manifest description; a successful build alone does not check it.
Native compiler/esbuild subprocesses required sandbox escalation in this session.
Use UV for Python, per user preference.

## Session history

| Date | Change | Verification / remaining work |
| --- | --- | --- |
| 2026-09-29 | Private v0.1 committed as 5d20e24 | 52 tests, lint, web build, native compilation and compiled scoring/undo; hardware/export unverified |
| 2026-09-29 | v0.2 eight-match queue, review and handoff committed as 7e05d47 | 58 tests, lint, web build, native validation/build, compiled queue/capacity/undo; hardware/export/live saves unverified |
| 2026-09-29 | User changed scope to independent anonymous watch scorer → JSON/FIT upload → profile mapping | v0.3 labels, separate upload entry, FIT adapter and UI tests implemented; 78 tests, lint/build, official watch validation/build and compiled checks passed; real device/export/live saves remain pending; uncommitted |
