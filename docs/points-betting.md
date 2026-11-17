# Points betting

Points-only betting on live ping pong matches (no real money, no tournaments,
no padel or tennis). Built 2026-11-12. This file records how it was built so
the feature can be removed cleanly.

## What it does

- In a **live ping pong match** (not tournament matches) the admin phone shows a
  **Bets** button. The bookie picks a player, the side they back and a stake.
- **Any phone can bet too** (added 2026-11-16). The umpire phone shares its
  score after every point; the **Bets** tab on every phone shows the live score
  (games, points, server, win probability) and a **Place a bet** button. That
  phone remembers who bet from it last. No PIN is needed: the server prices the
  bet from the shared score, never from the phone, and refuses it if a point
  moved the odds since the bettor looked. Only the umpire phone can remove bets.
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
- The **Bets** tab (ping pong, in the phone's bottom bar) shows who bet what
  on the match in play, a podium and standings with streaks, awards (jackpot,
  long shot, oracle, ...) and recently paid matches. Admins can refund an orphaned open market
  there.
- The ping pong **match history** marks matches that had bets; tapping the
  marker lists who bet, how much, on whom and what it paid.

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

### Live score and bets from any phone

Second migration, also **purely additive**:
`supabase/migrations/20261116120000_live_match_betting.sql`.

Applied to the hosted "Table Tennis Tracker" Supabase project on 2026-11-16,
where it is recorded as version `20261116061437`, name `live_match_betting`.

| Object | Kind | Purpose |
|---|---|---|
| `public.live_matches` | table | one row per match being scored: players, games, score, sets, server, win probability, betting closed, winner. Id = the bet market id |
| `public.publish_live_match` | function | admin token; the umpire phone upserts its state after every point and every 4 minutes |
| `public.end_live_match` | function | admin token; removes the row when the umpire leaves the match and refunds bets still open on it |
| `public.place_live_bet` | function | **no admin token**; prices the bet from the live row, refuses it at match point or when the row is over 20 minutes old |

`live_matches` is public-read and in the realtime publication like the other
betting tables. Rows older than 6 hours are cleaned up on the next publish.
When this table is missing the app falls back to umpire-phone-only betting.

## How to remove the feature

0. **Live score and bets from any phone only.** Run
   `supabase/rollbacks/20261116120000_live_match_betting_down.sql`. Bets,
   wallets and markets are kept; the app goes back to umpire-phone betting.
   When removing everything, run this one first.

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
     `src/components/MatchBets.jsx`,
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
   - `src/App.jsx`: remove the `bets` nav item, `liveBetting`, `<BetsView>`,
     the `betting` prop on `<LiveMatchModal>` and the `betMarkets`/`bets` props
     on `<Matches>`.
   - `src/components/Matches.jsx`: remove the `betMarkets`/`bets` props,
     `openBetsId`, `matchBets`, the bets button under the score and the
     expanded bets row.
   - `scripts/test-database.mjs`: remove the betting block before the final
     status line.

To bring it back after a rollback, apply the migration again.

## Tests

- `npm test`: `bettingUtils.test.js` (multiplier, cutoff, leaderboard),
  `bettingViews.test.jsx` (both screens render), `matchPersistence.test.js`
  (save-with-bets call).
- `npm run test:db` (needs Docker): runs `supabase/tests/betting.sql` and
  `supabase/tests/live_betting.sql` against a disposable database, then runs
  both rollbacks, checks that no betting object is
  left and that plain match saving still works, and re-applies the migration.

## Sabotage shop

Built 2026-11-17. Spend betting points to put a debuff on a player in a live
ping pong match for a number of points, e.g. "Half table for the next 3
points". **The price goes straight to the debuffed player's wallet** (a
transfer, so no points are created). Debuffs are display only: match saving,
results and ELO ignore them.

- **Sabotage** tab (ping pong, under "More") and a "Sabotage a player" button on
  the live match card in the Bets tab. Any phone can buy, no PIN, like live bets.
- The umpire phone shows the running debuff and the queue above the score.
- Price = price per point × points (1 to the item's max). The buyer must keep
  at least 1 point, and cannot debuff themselves.
- Points are counted across the whole match. A second debuff on the same player
  queues after the first; at most 10 points can be lined up per player.
- No refunds: discarding the match does not give the points back.

Migration `supabase/migrations/20261117120000_sabotage_shop.sql`, purely
additive. Applied to the hosted "Table Tennis Tracker" Supabase project on
2026-11-17, where it is recorded as version `20261117102910`, name
`sabotage_shop`.

| Object | Kind | Purpose |
|---|---|---|
| `public.sabotage_items` | table | the menu: title, description, price per point, max points, active flag |
| `public.sabotages` | table | every purchase: match, buyer, target, debuff, points, price, start and end point |
| `public.buy_sabotage` | function | **no admin token**; checks the live row, prices from the menu, moves the points |

Menu update `supabase/migrations/20261117130000_sabotage_menu_update.sql`
(2026-11-17): prices up about 1.5×, Granny serve and Pillow fight switched off
(kept for history), Backhand only, Choke grip, No serve and Hand behind back
added. Current menu, per point: Half table 45, Forehand only 40, Backhand only
50, Wrong hand 90, Choke grip 60, No serve 40, Long distance 50, Statue 70,
Hand behind back 30. Prices can be changed in `sabotage_items` directly.
Applied to the hosted project on 2026-11-17 as version `20261117103513`, name
`sabotage_menu_update`.

To remove it, run `supabase/rollbacks/20261117120000_sabotage_shop_down.sql`
(before the other two rollbacks). The app hides the tab when the tables are
missing. Code: `src/sabotageUtils.js`, `src/components/SabotageShop.jsx`, the
`sabotageItems`/`sabotages` sources in `src/appData.js`, `sabotageReady` in
`src/useAppData.js`, `buySabotage` in `src/betPersistence.js`, and the
`sabotage` bits in `src/App.jsx`, `BetsView.jsx` and `LiveMatchModal.jsx`.
Tests: `src/sabotageUtils.test.js`, `src/sabotageViews.test.jsx`,
`supabase/tests/sabotage.sql`.
