# Points betting

Points-only betting on live ping pong matches (no real money, no tournaments,
no padel or tennis). Built 2026-11-12. This file records how it was built so
the feature can be removed cleanly.

## What it does

- In a **live ping pong match** (not tournament matches) the admin phone shows a
  **Bets** button. The bookie picks a player, the side they back and a stake.
- Odds come from the live win probability (`src/winProbability.js`), so they
  move with every point. Multiplier = 1 ÷ win probability, limited to 1.05×–10×,
  and locked on each bet when it is placed.
- Bets can be placed before the first point and between points. Betting closes
  at match point. The match format cannot be changed once a bet exists.
- Saving the match pays out in the same database transaction. Closing,
  discarding or rematching without saving refunds every bet (after a confirm).
- Everyone starts with 1,000 points. A wallet at 0 with nothing riding restarts
  at 100. Players in the match can only bet on themselves.
- Editing a paid match's score re-pays its bets; deleting it refunds them.
- The **Bets** tab (ping pong) shows balances, bets on the match in play and
  recent results. Admins can refund an orphaned open market there.

## Database

One migration, **purely additive**: it creates new objects and alters nothing
that existed before.

`supabase/migrations/20261112120000_points_betting.sql`

Applied to the hosted "Table Tennis Tracker" Supabase project on 2026-11-12,
where it is recorded as version `20261112132310`, name `points_betting`.

| Object | Kind | Purpose |
|---|---|---|
| `public.bet_wallets` | table | balance and restart count per player (row appears with the first bet) |
| `public.bet_markets` | table | one per live match with bets: players, status, winner, linked match rows |
| `public.bets` | table | bettor, side, stake, win probability, multiplier, score snapshot, payout, status |
| `public.place_bet` | function | admin token; creates the market on the first bet, checks balance and rules |
| `public.cancel_bet` | function | admin token; removes a pending bet and refunds it |
| `public.void_bet_market` | function | admin token; refunds every bet of an open market |
| `public.record_pingpong_match_with_bets` | function | admin token; saves the match via the existing private implementation, then settles |
| `private.settle_bet_market` | function | pays, re-pays or refunds one market from its match rows |
| `private.bet_market_state` | function | returns market, bets and wallets as JSON |
| `private.bet_multiplier` | function | multiplier from a probability |
| `private.resettle_bets_for_match` | trigger function | re-settles when a linked match changes |
| `resettle_bets_after_match_change` | trigger on `public.matches` | fires after a score update or a delete |

The three tables are public-read (RLS select policy, `SELECT` grant) and added
to the `supabase_realtime` publication when it exists. `record_pingpong_match`
and every other existing function are untouched.

The win probability is computed on the umpire phone and sent with the bet; the
server range-checks it (0.01–0.99) and derives the multiplier itself.

## How to remove the feature

1. **Database.** Run `supabase/rollbacks/20261112120000_points_betting_down.sql`
   in the Supabase SQL editor. It drops the trigger, the eight functions and the
   three tables, and removes the migration's row from
   `supabase_migrations.schema_migrations`. **All betting data is deleted.**
   Matches, players and ELO are not touched.
2. **App.** Nothing has to change straight away: the app detects that the
   betting tables are missing and hides the Bets tab and the Bets button.
3. **Code** (optional, to delete it for good):
   - Delete `src/bettingUtils.js`, `src/bettingUtils.test.js`,
     `src/betPersistence.js`, `src/bettingViews.test.jsx`,
     `src/components/BetSheet.jsx`, `src/components/BetsView.jsx`,
     `supabase/tests/betting.sql`, the migration, the rollback and this file.
   - `src/appData.js`: remove the `betWallets`, `betMarkets` and `bets` sources
     and initial arrays (and `OPTIONAL_REALTIME_TABLES` if nothing else is optional).
   - `src/useAppData.js`: remove the `onBetsChanged` effect, the `betting`
     merge in `onMatchRecorded`, the optional realtime channel and `bettingReady`.
   - `src/matchPersistence.js`: remove `buildPingPongBetRecordParams`,
     `recordPingPongMatchWithBets` and the `betting` field of the response.
   - `src/components/modals/LiveMatchModal.jsx`: remove the `betting` prop,
     `marketId`, `betSheetOpen`, `matchBets`, `refundBetsThen`, the Bets button
     and `<BetSheet>`; `handleSave` goes back to calling `recordPingPongMatch`.
   - `src/App.jsx`: remove the `bets` nav item, `liveBetting`, `<BetsView>`
     and the `betting` prop on `<LiveMatchModal>`.
   - `scripts/test-database.mjs`: remove the betting block before the final
     status line.

To bring it back after a rollback, apply the migration again.

## Tests

- `npm test`: `bettingUtils.test.js` (multiplier, cutoff, leaderboard),
  `bettingViews.test.jsx` (both screens render), `matchPersistence.test.js`
  (save-with-bets call).
- `npm run test:db` (needs Docker): runs `supabase/tests/betting.sql` against a
  disposable database, then runs the rollback, checks that no betting object is
  left and that plain match saving still works, and re-applies the migration.
