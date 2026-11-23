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
- The house keeps 10% of the profit on a winning bet: the winner gets the
  stake back plus 90% of (stake × multiplier − stake), rounded to whole points.
- Saving the match pays out in the same database transaction. Closing,
  discarding or rematching without saving refunds every bet (after a confirm).
- Everyone starts with 1,000 points. A wallet at 0 stays at 0: only a super
  admin can add points (House tab). Players in the match can only bet on themselves.
- One bet per bettor per match. If the umpire phone removes it, that bettor
  may place a new one.
- No betting on a match with a debuff on (a mayhem or streak rule that was not
  refused, i.e. what is saved as the match's `handicap_rule`). Refusing every
  debuff opens betting; once bets are in, a refused debuff cannot be put back.
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
| `public.bet_wallets` | table | balance and past-restart count per player (row appears with the first bet) |
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

### One player per bettor, no bets under a debuff

`supabase/migrations/20261123120000_bet_one_side_no_debuffs.sql` adds
`live_matches.debuffed` (published by the umpire phone), a helper
`private.require_one_bet_side`, and replaces `publish_live_match`,
`place_live_bet` and `place_bet` so the server refuses a bet on the other
player and any bet on a debuffed live match. Applied to the hosted project on
2026-11-23, recorded as version `20261123063809`, name
`bet_one_side_no_debuffs`. The two rollbacks above remove
everything it adds (the column goes with the table, the helper with
`points_betting_down.sql`).

### Super admin: edit points, house totals

`supabase/migrations/20261123150000_super_admin_bet_wallets.sql` (2026-11-23),
purely additive. Applied to the hosted project on 2026-11-23, recorded as
version `20261123070420`, name `super_admin_bet_wallets`. The admin login has a second mode, **Super admin? Use your
password**, which takes a password of 12+ characters instead of the PIN. A
super admin session is also a normal admin session (same token). It adds a
**House** tab (ping pong, under "More" on phones) where every player's points
can be set, and which shows what the house won from lost bets, what it paid
in profit on winning bets, the net and manual edits (plus any restarts from before they were removed).

| Object | Kind | Purpose |
|---|---|---|
| `private.super_admin_config` | table | bcrypt hash of the super admin password |
| `private.super_admin_sessions` | table | super sessions (same token hash as `private.admin_sessions`) |
| `private.bet_wallet_adjustments` | table | log of every manual balance change |
| `private.set_super_admin_password` | function | SQL editor only; sets the password and signs super admins out |
| `public.create_super_admin_session` | function | login; 5 tries per address, 20 overall, per 30 minutes |
| `public.validate_super_admin_session` | function | is this token still a super session |
| `public.super_admin_set_wallet` | function | super token; sets one player's points (0–10,000,000) |
| `public.super_admin_wallet_adjustments` | function | super token; latest 200 manual edits |

Set or change the password in the Supabase SQL editor:

```sql
SELECT private.set_super_admin_password('a long password only you know');
```

Rollback: `supabase/rollbacks/20261123150000_super_admin_bet_wallets_down.sql`
(balances keep their edited values; the edit log goes). Tests:
`supabase/tests/super_admin.sql`.

### House cut on winnings

`supabase/migrations/20261123180000_house_cut_on_winnings.sql` (2026-11-23),
applied to the hosted project on 2026-11-23, recorded as version
`20261123071004`, name `house_cut_on_winnings`. It replaces `private.settle_bet_market` so a winning bet pays
`stake + round((round(stake × multiplier) − stake) × 0.9)`. Bets already paid
keep their payout until their match is edited and re-settled.
`potentialPayout()` in `src/bettingUtils.js` previews the same number.
To undo, re-run the function from `20261112120000_points_betting.sql`.

### No more restarts

`supabase/migrations/20261123190000_no_wallet_restarts.sql` (2026-11-23),
applied to the hosted project on 2026-11-23 as version `20261123071651`,
name `no_wallet_restarts`. It replaces `private.settle_bet_market` again without the restart step: a wallet
at 0 stays at 0 until a super admin adds points on the House tab. The
`bet_wallets.rebuys` column stays as a record of earlier restarts, and the
House tab still counts them. To undo, re-run the function from
`20261123180000_house_cut_on_winnings.sql`.

### One bet per match

`supabase/migrations/20261123210000_one_bet_per_match.sql` (2026-11-23),
applied to the hosted project on 2026-11-23 as version `20261123073735`
(name `one_bet_per_match`),
replaces `private.require_one_bet_side`, the check `place_bet` and
`place_live_bet` both run, so a bettor with a pending bet on a match is
refused a second one (it used to allow more bets on the same side). The bet
sheet shows "already has a bet on this match" instead of the stake chips.
To undo, re-run the function from `20261123120000_bet_one_side_no_debuffs.sql`.

### Points history

The House tab's **Points history** lists every manual points edit, newest
first: player, old → new balance, change and time, with a player filter and
20 rows at a time. `supabase/migrations/20261123200000_full_points_history.sql`
(applied to the hosted project on 2026-11-23 as version `20261123071653`, name
`full_points_history`) lets `public.super_admin_wallet_adjustments` return up
to 5,000 edits instead of 200. Past automatic restarts were never logged one
by one, so they are not in the list (the House tab still totals them).

### Payouts (cashing points in)

`supabase/migrations/20261123220000_bet_payouts.sql` (2026-11-23, applied to
the hosted project as version `20261123074227`, name `bet_payouts`) adds
`public.bet_payouts` (player, amount, balance before/after, optional note,
time; everyone can read it, realtime) and `public.super_admin_pay_out`, which
takes 1 up to the whole balance out of one wallet and logs it. Only a super
admin session can call it. Payouts are not manual edits: they do not count in
"Points added".

- House tab: **Pay out** on each player row opens a small form (quick picks
  "Winnings" = balance above 1,000, and "All"; optional note; a confirm). A
  **Cashed out** total sits with the house totals, and payouts appear in
  Points history, tagged "Payout".
- Bets tab: a **Payouts** view lists every payout for everyone, and the
  standings show "cashed out N" per player.

Rollback: `supabase/rollbacks/20261123220000_bet_payouts_down.sql` (wallets
keep their balances; the payout log goes). Tests: `supabase/tests/super_admin.sql`.

## How to remove the feature

When removing everything, run the rollbacks newest first:
`20261123220000_bet_payouts_down.sql`, then
`20261123150000_super_admin_bet_wallets_down.sql`, then the two below.

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

## Sabotage shop (removed)

Built 2026-11-17, removed on 2026-11-23 from the app and from the hosted
database (tables `sabotage_items`, `sabotages`, function `buy_sabotage` and
their three migration history rows; no purchases had been made). Its
migrations, rollback and tests were deleted from the repo; see git history
before 2026-11-23 if it is ever wanted back.
