# Standalone Suunto padel scorer and workout import

For progress and continuation, read [the integration handoff](../SUUNTO_INTEGRATION_HANDOFF.md).

The watch project in `integrations/suunto-padel` is an independent SuuntoPlus
scorer. It needs no PingpongTracker account, selected profiles, database access,
network connection, or tracker service to score a match. SuuntoPlus still runs
inside a watch workout; it is not a separate watch operating-system application.
The workout export is the only connection to PingpongTracker.

## Player positions

| Watch position | Team | Point button |
| --- | --- | --- |
| Player 1 | Team 1 | Top |
| Player 2 | Team 1 | Top |
| Player 3 | Team 2 | Bottom |
| Player 4 | Team 2 | Bottom |

The watch shows `P1+P2 / P3+P4`. These are anonymous positions, not profile IDs.
Points belong to a doubles team; the app does not attribute each point to an
individual player or track serving order. Teams stay in this order for each
match. You can assign different people to the positions for each imported result.

## Build and use the independent watch app

1. Install the official [SuuntoPlus Editor](https://marketplace.visualstudio.com/items?itemName=Suunto.suuntoplus-editor)
   in VS Code and open `integrations/suunto-padel` directly as a folder. No web-app
   installation is needed to build or run this watch project.
2. Validate/build for display `n` (Suunto 9 Peak Pro), then deploy privately over
   USB. The generated package is `dist/ttpadel1-n.fea` within the watch project;
   it can also be loaded with **SuuntoPlus: Add SuuntoPlus Binary to Watch**.
   Keep the app private. No Store publication is needed for local deployment.
   Follow Suunto's development guidance about disabling mobile sync while
   developing a locally installed app.
3. Start a workout with Tracker Padel enabled. Top adds a point to Player 1+2;
   bottom adds a point to Player 3+4. Hold either during play to undo; the last
   eight points within the current match can be undone.
4. After a win, hold top to undo the winning point, or hold bottom to commit the
   result and start the next match without stopping the workout. Earlier committed
   matches cannot be undone. After eight completed matches, save the workout.
5. Rules remain advantage scoring, sets to six by two, seven-point tiebreak by
   two at 6–6, and best of three (or single set via watch-app settings). Golden
   point and deciding match tiebreaks are not implemented. Format applies to the
   whole workout. An unfinished final match is omitted; completed matches remain.
   The last completed match exports even if you never press next. Crash recovery
   is not implemented.
6. Save the workout and export JSON or FIT with its SuuntoPlus scoring summary.
   Editor workout JSON is the targeted JSON format. Other JSON structures need
   explicit adapters. FIT support follows the documented developer-field format.
   Real device exports have not yet been validated; check both routes with known
   scores before relying on them.

## Upload first, assign profiles afterwards

1. In PingpongTracker, enable admin mode, select Padel, and open the Matches tab.
2. Click **Import Suunto workout**, without choosing players first.
3. Upload the workout `.json` or `.fit` file (maximum 10 MB).
4. Review each match and map Player 1, 2, 3, and 4 to four distinct existing
   profiles. Player 1+2 receive the first score column; Player 3+4 receive the
   second. The swap button swaps the profile assignments between these positions,
   leaving the watch score columns in their exported order.
5. Click **Save match 1**. The importer refreshes matches/rankings and advances
   to the next unsaved result. Every result starts with unassigned profiles;
   choose its four people explicitly. Switching between unsaved results preserves
   each result's profile and score draft. Failed saves retain the draft for retry.
6. Saved results are disabled for this open window. The last save closes it.

Ordinary **Record Match** remains a separate manual flow with player selection
first. Uploading alone never writes a match. Saving uses the existing authorized
match transaction and ranking calculation; no schema or watch credentials were
added. Reimporting the same workout later can still create duplicates. Durable
cross-session duplicate protection and live database verification remain pending.

## Export contract

Watch UI version 0.3 keeps version 0.2's four summary outputs, `q1`–`q4`.
Retaining app name **Tracker Padel** and app ID **ttpadel1** preserves compatibility
with existing private installations and older exports.

| ID | Ordered results |
| --- | --- |
| `q1` | Matches 1 and 2 |
| `q2` | Matches 3 and 4 |
| `q3` | Matches 5 and 6 |
| `q4` | Matches 7 and 8 |

Each set uses a base-15 digit: 1–5 encode Team 1 wins 6–0 through 6–4; 6–7
encode 7–5 or 7–6. Add seven for Team 2 wins. A match is
`set1 + 15 * set2 + 225 * set3`, absent sets zero. Pair values are
`firstMatch + 4096 * secondMatch`. Zero marks unused slots. These integers are
below 2^24 and survive float32 exactly. Invalid outcomes, missing matches,
incomplete results, duplicate fields, and mixed protocols are rejected.
Legacy `v/a/b/c` single-match summaries are still accepted.

JSON imports require exactly one `{ Zapp: { Name: 'Tracker Padel', SummaryOutputs } }`
entry in a `Zapps` array, with `Id` and `SummaryValue` entries. Nested containers
are accepted; unrelated or ambiguous workouts are rejected.

FIT is decoded locally in the browser by the lazily loaded official Garmin SDK.
The importer checks integrity and identifies the app by the 16-byte SuuntoPlus
application ID: prefix `DE 13 D6 A8 99 C3 C1 9D` followed by ASCII `ttpadel1`.
It reads named float32 developer fields from exactly one session, not live record
channels. Other apps with identically named fields cannot supply padel scores.
Multisport sessions, missing custom summaries, or unsupported FIT decoding features
are rejected. The SDK currently rejects compressed timestamp records; a real
export using those records would need a decoder update before import can succeed.
GPS, heart rate, and other workout fields are not saved by the tracker.

## Validation and remaining checks

Synthetic binary FIT fixtures and watch scoring tests exercise the export
contract. React UI tests cover uploading without teams, four-profile mapping,
per-match drafts, ordered saves, failure/retry, and ordinary manual recording.
They mock persistence and do not establish a live database round trip.

Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check`.
Rebuild the watch package after watch changes. Test buttons/layout on the 9 Peak
Pro, inspect real JSON/FIT exports, and verify profile mapping on an appropriate
test backend before treating the integration as device-validated.

Cloud API/OAuth sync is outside this standalone file-transfer workflow.

References:

- [Suunto FIT fields and app identity](https://apizone.suunto.com/fit-description)
- [Official Garmin JavaScript FIT SDK](https://github.com/garmin/fit-javascript-sdk)
- [SuuntoPlus Editor and workout JSON](https://apizone.suunto.com/suuntoplusEditor)
- [Private local development](https://forum.suunto.com/topic/14651/how-to-get-started)
