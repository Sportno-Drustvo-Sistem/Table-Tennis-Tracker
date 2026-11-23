// What the Bets tab puts on show when bets land or settle while someone is
// watching: full-screen moments (a match result, a big win) and small banners
// (a bet placed, a streak, a new leader, a bust). Pure, so it can be tested;
// useBetShowtime feeds it and BetsView plays it.
import { betStreaks, buildBettingLeaderboard, isBigWin } from './bettingUtils'

// Slot-style win tiers, smallest first. A win reaches a tier on profit or on
// the multiplier it landed at.
export const WIN_TIERS = [
    { id: 'big', title: 'Big win', profit: 0, multiplier: 0 },
    { id: 'mega', title: 'Mega win', profit: 1000, multiplier: 4 },
    { id: 'epic', title: 'Epic win', profit: 2500, multiplier: 6 },
]
const tierIndex = (profit, multiplier = 0) => WIN_TIERS.reduce((best, tier, index) =>
    (profit >= tier.profit || (tier.multiplier && multiplier >= tier.multiplier) ? index : best), 0)
export const winTier = bet => tierIndex(bet.payout - bet.stake, Number(bet.multiplier))
// The tier shown while the counter rolls up: it climbs with the number and
// lands on the win's own tier.
export const rollingTier = (shown, finalIndex) => Math.min(finalIndex, tierIndex(shown))

export const BAD_BEAT_STAKE = 500
export const STREAK_SHOWN = 3
export const UPSET_MULTIPLIER = 2.2

const profit = bet => bet.payout - bet.stake
const isPaid = bet => bet.status === 'won' || bet.status === 'lost'

// Bet ids that are new since `seen` (id -> status) and ids that left pending.
export const diffBets = (seen, bets = []) => {
    const placed = []
    const settled = []
    for (const bet of bets) {
        const before = seen.get(bet.id)
        if (before === undefined && bet.status === 'pending') placed.push(bet)
        else if (before === 'pending' && isPaid(bet)) settled.push(bet.id)
    }
    return { placed, settled }
}

// The player on top of the betting leaderboard, if anyone has bet yet.
export const bettingLeader = (users, wallets, bets) =>
    buildBettingLeaderboard(users, wallets, bets).find(row => row.hasBet)?.user.id ?? null

// Everything to show for a batch of bets that just settled.
// Returns { stage: [...full-screen moments in order], banners: [...] }.
export const buildShowtime = ({ settledIds, bets = [], markets = [], wallets = [], leaderBefore = null, leaderAfter = null }) => {
    const ids = new Set(settledIds)
    const settled = bets.filter(bet => ids.has(bet.id) && isPaid(bet))
    const stage = []
    const banners = []
    if (settled.length === 0) return { stage, banners }

    // One reveal per match that more than one person had money on.
    const marketIds = [...new Set(settled.map(bet => bet.market_id))]
    for (const marketId of marketIds) {
        const paid = bets.filter(bet => bet.market_id === marketId && isPaid(bet))
        if (new Set(paid.map(bet => bet.user_id)).size < 2) continue
        const market = markets.find(item => item.id === marketId)
        const sample = paid[0]
        const winnerSide = market?.winner_side === 1 || market?.winner_side === 2
            ? market.winner_side
            : sample.status === 'won' ? sample.side : 3 - sample.side
        const winningOdds = Math.max(0, ...paid.filter(bet => bet.side === winnerSide).map(bet => Number(bet.multiplier) || 0))
        stage.push({
            type: 'result',
            id: `result-${marketId}`,
            marketId,
            player1Id: market?.player1_id,
            player2Id: market?.player2_id,
            winnerSide,
            upset: winningOdds >= UPSET_MULTIPLIER,
            bets: [...paid].sort((a, b) => profit(b) - profit(a)),
        })
    }

    const wins = settled.filter(isBigWin).sort((a, b) => profit(b) - profit(a))
    if (wins.length) stage.push({ type: 'win', id: `win-${wins.map(bet => bet.id).join()}`, wins, tier: winTier(wins[0]) })

    const balance = new Map(wallets.map(wallet => [wallet.user_id, wallet.balance]))
    for (const bet of settled) {
        if (bet.status !== 'lost') continue
        if (balance.get(bet.user_id) === 0) banners.push({ type: 'broke', id: `broke-${bet.id}`, userId: bet.user_id, value: bet.stake })
        else if (bet.stake >= BAD_BEAT_STAKE) banners.push({ type: 'ouch', id: `ouch-${bet.id}`, userId: bet.user_id, value: bet.stake })
    }
    const streaks = betStreaks(bets)
    for (const userId of new Set(settled.map(bet => bet.user_id))) {
        const run = streaks.get(userId) || 0
        if (run >= STREAK_SHOWN) banners.push({ type: 'hot', id: `hot-${userId}-${run}`, userId, value: run })
        else if (run <= -STREAK_SHOWN) banners.push({ type: 'cold', id: `cold-${userId}-${run}`, userId, value: -run })
    }
    if (leaderAfter && leaderBefore && leaderAfter !== leaderBefore) banners.push({ type: 'leader', id: `leader-${leaderAfter}`, userId: leaderAfter })
    return { stage, banners }
}
