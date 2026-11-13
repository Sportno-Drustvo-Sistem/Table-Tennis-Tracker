// Points betting rules shared by the bet sheet and the Bets page. The database
// (supabase/migrations/*_points_betting.sql) is the authority on balances and
// payouts; the numbers here are previews and must stay in step with it.

export const STARTING_BALANCE = 1000
export const REBUY_BALANCE = 100
export const MIN_MULTIPLIER = 1.05
export const MAX_MULTIPLIER = 10
export const STAKE_CHIPS = [10, 50, 100, 250]

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

// The server refuses probabilities outside this range.
export const clampBetProbability = p => clamp(p, 0.01, 0.99)

// What one point pays back when the backed side wins with probability p.
export const betMultiplier = p => Math.round(clamp(1 / clampBetProbability(p), MIN_MULTIPLIER, MAX_MULTIPLIER) * 100) / 100

export const potentialPayout = (stake, multiplier) => Math.round(stake * multiplier)

// Betting stops at match point: one more point could end the match.
export const isBettingClosed = ({ score1 = 0, score2 = 0, games1 = 0, games2 = 0, bestOf = 1, gameWinner = null, matchWinner = null }) => {
    if (matchWinner) return true
    if (gameWinner) return false
    const need = Math.ceil(bestOf / 2)
    const gamePoint1 = score1 >= 10 && score1 > score2
    const gamePoint2 = score2 >= 10 && score2 > score1
    return (gamePoint1 && games1 + 1 >= need) || (gamePoint2 && games2 + 1 >= need)
}

// Players in the match may only back themselves.
export const allowedSides = (userId, player1Id, player2Id) => (
    userId === player1Id ? [1] : userId === player2Id ? [2] : [1, 2]
)

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

// One row per player: balance plus what their settled bets did. Players who
// have bet come first, richest on top.
export const buildBettingLeaderboard = (users, wallets, bets) => {
    const walletByUser = new Map((wallets || []).map(wallet => [wallet.user_id, wallet]))
    const stats = new Map()
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
        return { user, balance: wallet?.balance ?? STARTING_BALANCE, rebuys: wallet?.rebuys || 0, hasBet: Boolean(wallet), ...row }
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
