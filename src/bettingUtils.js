// Points betting rules shared by the bet sheet and the Bets page. The database
// (supabase/migrations/*_points_betting.sql) is the authority on balances and
// payouts; the numbers here are previews and must stay in step with it.

export const STARTING_BALANCE = 0
// Wallets used to restart at 100 when they hit 0; kept to count past restarts.
export const REBUY_BALANCE = 100
export const MIN_MULTIPLIER = 1.05
export const MAX_MULTIPLIER = 10
export const STAKE_CHIPS = [10, 50, 100, 300, 500, 1000]

// Chip colours by value: [face, edge, stripe]. The 1000 chip is black and gold.
const CHIP_TONES = {
    10: ['#0284c7', '#075985'],
    50: ['#059669', '#065f46'],
    100: ['#7c3aed', '#4c1d95'],
    300: ['#db2777', '#9d174d'],
    500: ['#d97706', '#92400e'],
    1000: ['#18181b', '#000000', '#fbbf24'],
}

// CSS variables for `.bet-chip`; any stake takes the colour of the biggest chip it covers.
export const chipTone = (amount) => {
    const tier = [...STAKE_CHIPS].reverse().find(value => value <= amount) || STAKE_CHIPS[0]
    const [chip, edge, stripe = '#ffffff'] = CHIP_TONES[tier] || CHIP_TONES[10]
    return { '--chip': chip, '--chip-edge': edge, '--chip-stripe': stripe }
}

export const chipLabel = amount => (amount >= 1000 ? `${amount / 1000}K` : String(amount))

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

// The server refuses probabilities outside this range.
export const clampBetProbability = p => clamp(p, 0.01, 0.99)

// What one point pays back when the backed side wins with probability p.
export const betMultiplier = p => Math.round(clamp(1 / clampBetProbability(p), MIN_MULTIPLIER, MAX_MULTIPLIER) * 100) / 100

// The house keeps 10% of the profit on a winning bet (the stake comes back whole).
export const HOUSE_CUT = 0.1
export const potentialPayout = (stake, multiplier) => {
    const profit = Math.round(stake * multiplier) - stake
    return stake + Math.round(profit * 9 / 10)
}

// Betting stops at match point: one more point could end the match.
export const isBettingClosed = ({ score1 = 0, score2 = 0, games1 = 0, games2 = 0, bestOf = 1, gameWinner = null, matchWinner = null }) => {
    if (matchWinner) return true
    if (gameWinner) return false
    const need = Math.ceil(bestOf / 2)
    const gamePoint1 = score1 >= 10 && score1 > score2
    const gamePoint2 = score2 >= 10 && score2 > score1
    return (gamePoint1 && games1 + 1 >= need) || (gamePoint2 && games2 + 1 >= need)
}

// A bettor gets one bet per match. A bet the umpire removed (void) does not count.
export const hasPendingBet = (userId, bets = []) => bets.some(bet => bet.user_id === userId && bet.status === 'pending')

// Players in the match may only back themselves. Once a bettor has a bet, only
// its side is left (and hasPendingBet stops a second bet altogether).
export const allowedSides = (userId, player1Id, player2Id, bets = []) => {
    if (userId === player1Id) return [1]
    if (userId === player2Id) return [2]
    const backed = bets.find(bet => bet.user_id === userId && bet.status === 'pending')
    return backed ? [backed.side] : [1, 2]
}

export const walletBalance = (wallets, userId) => (
    (wallets || []).find(wallet => wallet.user_id === userId)?.balance ?? STARTING_BALANCE
)

const signed = value => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0')
export const formatPoints = signed

// Net result per bettor for settled bets: [{ userId, net }], biggest winner first.
export const netResults = (bets) => {
    const totals = new Map()
    for (const bet of bets || []) {
        if (bet.status !== 'won' && bet.status !== 'lost') continue
        totals.set(bet.user_id, (totals.get(bet.user_id) || 0) + bet.payout - bet.stake)
    }
    return [...totals].map(([userId, net]) => ({ userId, net })).sort((a, b) => b.net - a.net)
}

// "Bets · Carol +100 · Dave −50"
export const describeBetResults = (bets, usersById) => {
    const results = netResults(bets)
    if (!results.length) return ''
    return ['Bets', ...results.map(({ userId, net }) => `${usersById[userId]?.name || 'Unknown'} ${signed(net)}`)].join(' · ')
}

// Points paid out per player: Map userId -> total.
export const payoutTotalsByUser = (payouts) => {
    const totals = new Map()
    for (const payout of payouts || []) totals.set(payout.user_id, (totals.get(payout.user_id) || 0) + payout.amount)
    return totals
}

// One row per player: balance plus what their settled bets did. Players who
// have bet come first, richest on top.
export const buildBettingLeaderboard = (users, wallets, bets, payouts = []) => {
    const walletByUser = new Map((wallets || []).map(wallet => [wallet.user_id, wallet]))
    const cashedOut = payoutTotalsByUser(payouts)
    const stats = new Map()
    const streaks = betStreaks(bets)
    for (const bet of bets || []) {
        const row = stats.get(bet.user_id) || { won: 0, lost: 0, profit: 0, biggestWin: 0, pending: 0 }
        if (bet.status === 'won') {
            row.won++
            row.profit += bet.payout - bet.stake
            row.biggestWin = Math.max(row.biggestWin, bet.payout - bet.stake)
        } else if (bet.status === 'lost') {
            row.lost++
            row.profit -= bet.stake
        } else if (bet.status === 'pending') row.pending += bet.stake
        stats.set(bet.user_id, row)
    }
    return (users || []).map(user => {
        const wallet = walletByUser.get(user.id)
        const row = stats.get(user.id) || { won: 0, lost: 0, profit: 0, biggestWin: 0, pending: 0 }
        return { user, balance: wallet?.balance ?? STARTING_BALANCE, rebuys: wallet?.rebuys || 0, cashedOut: cashedOut.get(user.id) || 0, hasBet: stats.has(user.id), streak: streaks.get(user.id) || 0, ...row }
    }).sort((a, b) => (b.hasBet - a.hasBet) || (b.balance - a.balance) || a.user.name.localeCompare(b.user.name))
}

// Points staked on each side: { 1, 2, total, count }. Refunded bets do not count.
export const poolTotals = (bets) => {
    const pool = { 1: 0, 2: 0, total: 0, count: 0 }
    for (const bet of bets || []) {
        if (bet.status === 'void') continue
        pool[bet.side] += bet.stake
        pool.total += bet.stake
        pool.count++
    }
    return pool
}

export const groupBetsByMarket = (bets) => {
    const groups = new Map()
    for (const bet of bets || []) {
        if (!groups.has(bet.market_id)) groups.set(bet.market_id, [])
        groups.get(bet.market_id).push(bet)
    }
    return groups
}

// The score a bet was placed at: "5–3", or "5–3 (1–0)" with games in a longer match.
export const describeSnapshot = (snapshot) => {
    if (!snapshot || !Number.isFinite(snapshot.score1) || !Number.isFinite(snapshot.score2)) return ''
    const points = `${snapshot.score1}–${snapshot.score2}`
    return snapshot.bestOf > 1 ? `${points} (${snapshot.games1 ?? 0}–${snapshot.games2 ?? 0})` : points
}

// Paid bets for the match history: match row id -> { market, bets }. A match of
// several games is several rows; only the first one listed carries the bets.
export const betsByMatchId = (matches, markets, bets) => {
    const marketByMatch = new Map()
    for (const market of markets || []) {
        if (market.status !== 'settled') continue
        for (const matchId of market.match_ids || []) marketByMatch.set(matchId, market)
    }
    const result = new Map()
    if (!marketByMatch.size) return result
    const betsByMarket = groupBetsByMarket(bets)
    const shown = new Set()
    for (const match of matches || []) {
        const market = marketByMatch.get(match.id)
        if (!market || shown.has(market.id)) continue
        shown.add(market.id)
        const paid = (betsByMarket.get(market.id) || []).filter(bet => bet.status === 'won' || bet.status === 'lost')
        if (paid.length) result.set(match.id, { market, bets: paid })
    }
    return result
}

const isPaid = bet => bet.status === 'won' || bet.status === 'lost'
const newestFirst = bets => [...(bets || [])].sort((a, b) => {
    const [left, right] = [a.created_at || '', b.created_at || '']
    return left < right ? 1 : left > right ? -1 : 0
})

// Current run of paid bets per bettor: +3 is three wins in a row, -2 two losses.
export const betStreaks = (bets) => {
    const streaks = new Map()
    const ended = new Set()
    for (const bet of newestFirst(bets)) {
        if (!isPaid(bet) || ended.has(bet.user_id)) continue
        const sign = bet.status === 'won' ? 1 : -1
        const current = streaks.get(bet.user_id) || 0
        if (current && Math.sign(current) !== sign) ended.add(bet.user_id)
        else streaks.set(bet.user_id, current + sign)
    }
    return streaks
}

// Headline numbers for the Bets page.
export const bettingTotals = (bets) => {
    const paid = (bets || []).filter(isPaid)
    return {
        count: paid.length,
        wagered: paid.reduce((sum, bet) => sum + bet.stake, 0),
        biggestWin: paid.reduce((best, bet) => Math.max(best, bet.payout - bet.stake), 0),
    }
}

const ORACLE_MIN_BETS = 3
const LONG_SHOT_MULTIPLIER = 2

// Bragging rights: [{ id, userId, value, total? }]. An award nobody has earned is left out.
export const buildBettingAwards = (bets) => {
    const best = (list, score) => list.reduce((top, item) => (top === null || score(item) > score(top) ? item : top), null)
    const awards = []
    const add = (id, bet, value, extra) => { if (bet) awards.push({ id, userId: bet.user_id, value, ...extra }) }
    const paid = (bets || []).filter(isPaid)
    const wins = paid.filter(bet => bet.status === 'won')
    const net = bet => bet.payout - bet.stake

    const roller = best((bets || []).filter(bet => bet.status !== 'void'), bet => bet.stake)
    add('highRoller', roller, roller?.stake)
    const jackpot = best(wins, net)
    add('jackpot', jackpot, jackpot && net(jackpot))
    const longShot = best(wins.filter(bet => Number(bet.multiplier) >= LONG_SHOT_MULTIPLIER), bet => Number(bet.multiplier))
    add('longShot', longShot, Number(longShot?.multiplier))

    const records = new Map()
    for (const bet of paid) {
        const record = records.get(bet.user_id) || { user_id: bet.user_id, won: 0, total: 0 }
        record.total++
        if (bet.status === 'won') record.won++
        records.set(bet.user_id, record)
    }
    const oracle = best([...records.values()].filter(record => record.total >= ORACLE_MIN_BETS && record.won > 0), record => record.won / record.total + record.total / 1e6)
    add('oracle', oracle, oracle?.won, { total: oracle?.total })

    const streaks = [...betStreaks(bets)].map(([user_id, run]) => ({ user_id, run }))
    const hot = best(streaks.filter(streak => streak.run >= 2), streak => streak.run)
    add('hot', hot, hot?.run)
    const cold = best(streaks.filter(streak => streak.run <= -2), streak => -streak.run)
    add('cold', cold, cold && -cold.run)

    const ouch = best(paid.filter(bet => bet.status === 'lost'), bet => bet.stake)
    add('ouch', ouch, ouch?.stake)
    return awards
}

// How long a live match stays on other phones after the umpire phone's last
// update (it re-sends every 4 minutes). The server stops taking bets at the
// same age.
export const LIVE_FRESH_MS = 20 * 60 * 1000

export const isLiveFresh = (live, now) => Boolean(live?.updated_at) && now - Date.parse(live.updated_at) < LIVE_FRESH_MS

// Other phones may bet until match point, only once the odds are known, and
// never on a match played under a debuff.
export const liveBettingOpen = live => Boolean(live) && !live.debuffed && !live.betting_closed && !live.winner_side && live.win_probability != null

// What the bank made and paid. `collected` is every stake lost; `paidOut` is
// the profit on winning bets (the payout minus the bettor's own stake back);
// `restarts` is points once handed to broke wallets (no longer happens). `adjusted` is the net of
// manual edits (positive = points given to players). `cashedOut` is points
// paid out of wallets to players cashing in.
export const houseTotals = (bets, wallets = [], adjustments = [], payouts = []) => {
    const all = bets || []
    const lost = all.filter(bet => bet.status === 'lost')
    const won = all.filter(bet => bet.status === 'won')
    const collected = lost.reduce((sum, bet) => sum + bet.stake, 0)
    const paidOut = won.reduce((sum, bet) => sum + bet.payout - bet.stake, 0)
    const restartCount = (wallets || []).reduce((sum, wallet) => sum + (wallet.rebuys || 0), 0)
    const adjusted = (adjustments || []).reduce((sum, row) => sum + row.new_balance - row.old_balance, 0)
    return {
        collected,
        paidOut,
        net: collected - paidOut,
        lostBets: lost.length,
        wonBets: won.length,
        restartCount,
        restarts: restartCount * REBUY_BALANCE,
        adjusted,
        cashedOut: (payouts || []).reduce((sum, payout) => sum + payout.amount, 0),
        payoutCount: (payouts || []).length,
        riding: all.filter(bet => bet.status === 'pending').reduce((sum, bet) => sum + bet.stake, 0),
    }
}
