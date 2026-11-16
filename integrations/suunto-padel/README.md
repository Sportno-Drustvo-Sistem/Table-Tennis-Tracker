# Independent Suunto padel scorer

Open this folder directly in SuuntoPlus Editor. The watch app can be built and
used independently of the PingpongTracker web app. It has no profile/account,
backend, or network dependency. It runs inside a Suunto watch workout.

- Player 1+2: top button adds their team's point.
- Player 3+4: bottom button adds their team's point.
- Hold during play: undo. After winning: hold top to undo; hold bottom for next.
- Up to eight complete matches per workout; save/export afterwards.
- App name `Tracker Padel`, private app ID `ttpadel1`, display `n` for 9 Peak Pro.
- Version 0.3 changes player labels; the compact score export stays compatible.

The watch does not need to know who played. Import the workout JSON/FIT into
PingpongTracker and assign the four positions to profiles for each match.
See [usage and export contract](../../docs/suunto-padel.md) for build/deploy steps,
import instructions, and device/export validation still required.
