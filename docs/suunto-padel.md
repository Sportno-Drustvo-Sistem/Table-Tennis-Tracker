# Suunto 9 Peak Pro padel prototype

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
   It passes the official project validator and compiles for display `n` (9 Peak
   Pro); scoring and undo were also checked in the compiled JavaScript. Hardware
   controls, screen layout, and a real exported workout still need verification.
3. Connect the watch by USB, then use the editor's deploy command. Follow Suunto's
   guidance on temporarily disabling mobile syncing while developing so it does
   not remove a locally deployed app. This can remain a private app: neither
   Store submission nor public distribution is needed for local deployment.
   The generated `dist/ttpadel1-n.fea` package can alternatively be loaded with
   **SuuntoPlus: Add SuuntoPlus Binary to Watch**. Generated binaries are ignored
   by Git; the source is the maintainable version.
4. Choose the app within a workout. Top button adds a point to Team 1; bottom
   button adds one to Team 2. Hold either button to undo the most recent point.
   Up to eight points can be undone, including a game, set, or match-winning point.
5. Default is best of three with advantage scoring, sets to six by two, and a
   seven-point tiebreak by two at 6–6. Single-set matches are configurable in app
   settings. Golden point and deciding match tiebreaks are not supported.
6. After the match, stop and save the workout. One padel match per workout.
   Additional scoring taps are ignored once a winner is recorded; undo remains
   available before saving. No score recovery after a watch/app crash is provided.
7. Export the saved workout as JSON from the editor's watch workout view. In
   PingpongTracker, select the four players, open **Record Padel Match**, and
   import that JSON. Review team order and scores, then finish the match.
   Team assignment happens in the web app; player IDs are not stored on the watch.

Manual import requires admin mode, like ordinary match recording. It loads scores
for review and never writes automatically. Repeat imports can create duplicate
matches if saved again; import each workout only once. FIT exports from the mobile
app cannot be loaded into this JSON importer.

## Export contract

Four numeric summary outputs fit within Suunto's documented practical summary
limits. All values are small integers exactly representable by float32:

| ID | Value |
| --- | --- |
| `v` | `1000 + format * 100 + winner * 10 + completedSetCount` |
| `a` | First set: `team1Games * 10 + team2Games` |
| `b` | Second set, or zero if absent |
| `c` | Third set, or zero if absent |

`format` is 1 or 3; `winner` is 0 (unfinished), 1, or 2. For example,
`v=1322, a=46, b=46, c=0` means Team 2 won a best-of-three match 6–4, 6–4.
The importer only accepts the `Tracker Padel` Zapp header and rejects incomplete
matches, invalid scores, extra sets, unknown versions, and ambiguous multi-workout
exports. The four summary fields must survive an actual watch export before this
prototype can be considered device-validated.

## Automatic sync follow-up

The supported architecture is watch → Suunto mobile sync → Suunto Cloud API →
backend importer → existing match-recording transaction. It is a post-workout
sync, not a direct watch-to-Supabase connection.

Production work needs Suunto developer API access, OAuth client credentials,
account linking, backend token storage/refresh, and a real workout export. Build
a FIT adapter for this summary contract, verify its app identity using the FIT
developer-data identifier, and tie each imported workout to a four-player team
assignment. Cloud retries need database-enforced uniqueness for the Suunto account
and workout ID, with import recording and match/ranking updates in one transaction.
Use a scoped integration authorization path; never place the database service key
or the existing admin token in the watch app. Workouts with incomplete scoring or
missing team assignments should wait for review rather than affect rankings.

Sources:

- [Sports apps, supported watches and cloud export](https://apizone.suunto.com/suuntoplus-sports-apps)
- [Editor, simulator and workout JSON export](https://apizone.suunto.com/suuntoplusEditor)
- [FIT developer fields and session summary outputs](https://apizone.suunto.com/fit-description)
- [Cloud API account authorization](https://apizone.suunto.com/how-to-start)
- [Development access and publishing](https://apizone.suunto.com/suuntoplus)
