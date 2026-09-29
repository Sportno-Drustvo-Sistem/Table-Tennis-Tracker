# Suunto 9 Peak Pro padel prototype

For current progress, decisions, validation evidence, and cross-session
continuation, read [the integration handoff](../SUUNTO_INTEGRATION_HANDOFF.md).
The user reports JSON workout export is available; verifying that export's
structure and custom scoring fields is the next priority. This document's
Editor export instructions describe the format the existing importer targets.

This repository contains a SuuntoPlus sports app source project at
`integrations/suunto-padel` and a manual workout JSON import in **Record Padel Match**.
Automatic cloud sync and FIT-file import are not implemented yet. No database
migration or new credential is required for the manual import: saving uses the
existing admin-authorized `record_padel_match` RPC and its ranking calculations.

## Build and use the watch app

1. Install the official [SuuntoPlus Editor](https://marketplace.visualstudio.com/items?itemName=Suunto.suuntoplus-editor)
   in VS Code, and open `integrations/suunto-padel` as a folder.
2. Build the app and test it in the editor's simulator with the 9 Peak Pro display.
   The source follows the Editor 1.42.0 button example and reference documentation.
   The package is built for display `n` (9 Peak Pro). Hardware
   controls, screen layout, and a real exported workout still need verification.
3. Connect the watch by USB, then use the editor's deploy command. Follow Suunto's
   guidance on temporarily disabling mobile syncing while developing so it does
   not remove a locally deployed app. This can remain a private app: neither
   Store submission nor public distribution is needed for local deployment.
   The generated `dist/ttpadel1-n.fea` package can alternatively be loaded with
   **SuuntoPlus: Add SuuntoPlus Binary to Watch**. Generated binaries are ignored
   by Git; the source is the maintainable version.
4. Choose the app within a workout. Top button adds a point to Team 1; bottom
   button adds one to Team 2. During scoring, hold either button to undo the most
   recent point. Up to eight points can be undone within the current match.
   After a win, **hold top to undo** the winning point or **hold bottom to finish
   the match and start the next**. Starting the next match locks the previous
   result and clears undo history. The workout keeps recording.
5. Default is best of three with advantage scoring, sets to six by two, and a
   seven-point tiebreak by two at 6–6. Single-set matches are configurable in app
   settings. Golden point and deciding match tiebreaks are not supported.
6. Track up to **eight matches per workout**. After the eighth match, the watch
   shows **SAVE WORKOUT** and refuses to start a ninth rather than overwrite
   results. Stop and save the workout when finished. The final completed match
   is included even if you don't press next. An unfinished final match is omitted;
   earlier completed matches are preserved. No score recovery after a watch/app
   crash is provided. Match format applies throughout the workout.
7. Export the saved workout as JSON from the editor's watch workout view. In
   PingpongTracker, select the four players, open **Record Padel Match**, and
   import that JSON. Review team order and scores, then **Save match 1**. The window
   stays open and advances to the next unsaved match, refreshing rankings after
   each save. Review or change the four players for every match; selections carry
   forward as a starting point. Match buttons allow switching between unsaved
   results and preserve their score and player drafts. Successfully saved results
   are marked and disabled. After the last save the window closes.
   Team assignment happens in the web app; player IDs are not stored on the watch.

Manual import requires admin mode, like ordinary match recording. It loads scores
for review and never writes automatically. Repeat imports can create duplicate
matches if saved again. Saved markers only last while this window is open: finish
reviewing before closing it and avoid re-saving already imported results. Failed
saves remain available for retry. FIT exports from the mobile app cannot be loaded
into this JSON importer. Automatic cloud sending is still a separate follow-up.

## Export contract

Version 0.2 uses four numeric summary outputs, `q1` through `q4`, each holding two
matches in chronological order. This avoids depending on once-per-second logging
to preserve a result before a rapid restart. All values are integers below 2^24
and exactly representable by float32, as used by Suunto's FIT export.

| ID | Contents |
| --- | --- |
| `q1` | Matches 1 and 2 |
| `q2` | Matches 3 and 4 |
| `q3` | Matches 5 and 6 |
| `q4` | Matches 7 and 8 |

Each set is one base-15 digit: 1–5 mean Team 1 wins 6–0 through 6–4; 6 and 7
mean Team 1 wins 7–5 or 7–6. Add seven for a Team 2 win. A match code is
`set1 + 15 * set2 + 225 * set3`, with absent sets zero. A single set implies
`best_of_1`; two or three sets imply `best_of_3` and must have a valid deciding
set. Pair fields contain `firstMatch + 4096 * secondMatch`. Zero means an unused
slot. Gaps, malformed fields, incomplete matches, and extra sets are rejected.

The importer continues to accept version 0.1's `v/a/b/c` single-match summaries.
It only accepts the `Tracker Padel` Zapp header and rejects ambiguous multi-workout
exports. The four summary fields must survive an actual watch export before this
prototype can be considered device-validated. Human-readable match counts and
scores appear in the web importer after decoding the compact summary.

## Automatic sync follow-up

The supported architecture is watch → Suunto mobile sync → Suunto Cloud API →
backend importer → existing match-recording transaction. It is a post-workout
sync, not a direct watch-to-Supabase connection.

Production work needs Suunto developer API access, OAuth client credentials,
account linking, backend token storage/refresh, and a real workout export. Build
a FIT adapter for this summary contract, verify its app identity using the FIT
developer-data identifier, and tie each imported workout to a four-player team
assignment. Cloud retries need database-enforced uniqueness for the Suunto account
and workout ID plus match ordinal, with import recording and match/ranking updates
in one transaction.
Use a scoped integration authorization path; never place the database service key
or the existing admin token in the watch app. Workouts with incomplete scoring or
missing team assignments should wait for review rather than affect rankings.

Sources:

- [Sports apps, supported watches and cloud export](https://apizone.suunto.com/suuntoplus-sports-apps)
- [Editor, simulator and workout JSON export](https://apizone.suunto.com/suuntoplusEditor)
- [FIT developer fields and session summary outputs](https://apizone.suunto.com/fit-description)
- [Cloud API account authorization](https://apizone.suunto.com/how-to-start)
- [Development access and publishing](https://apizone.suunto.com/suuntoplus)
