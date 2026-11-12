// Live win probability for table tennis. Pure maths, no I/O: it runs in the
// browser on every point, so there is nothing to host besides the static app.
//
// 1. Before the match, each player's point-winning strength is fitted from the
//    recorded game scores (a Bradley-Terry model on points, recent games
//    weighted more), with a small extra adjustment for this exact pairing.
// 2. During the match, the points played so far update that estimate (a Beta
//    prior worth PRIOR_POINTS points), so a player on a hot day gains ground.
// 3. The chance of winning from the current score is then exact: every way the
//    rest of the game and match can unfold is summed, averaged over what the
//    point probability might be.

// Tuned by walk-forward backtest on ~1,000 recorded games (each game predicted
// from only the games before it): log loss 0.523 vs 0.538 for the plain Elo
// expectation, 76.6% vs 74.8% of winners called.
export const MODEL_DEFAULTS = {
    halfLifeDays: 180,  // a game this old counts half as much as one today
    ridge: 8,           // pull towards "average player" for thinly sampled players
    pairRidge: 60,      // pull towards "no matchup effect" for thinly sampled pairings
    priorPoints: 100,   // how many live points it takes to match the pre-match estimate
}

const DAY_MS = 86400000
const sigmoid = x => 1 / (1 + Math.exp(-x))
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

// Chance of winning a game to `target` (win by two) from a-b, when each point is
// won independently with probability p.
export const gameWinProbability = (p, a = 0, b = 0, target = 11) => {
    if (a >= target && a - b >= 2) return 1
    if (b >= target && b - a >= 2) return 0
    const q = 1 - p
    const deuce = p * p + q * q === 0 ? 0.5 : (p * p) / (p * p + q * q)
    const edge = target - 1
    if (a >= edge && b >= edge) {
        if (a === b) return deuce
        return a > b ? p + q * deuce : p * deuce
    }
    // row[j] = win chance at (i, j); sweep i downwards from the deuce corner.
    let next = null
    for (let i = edge; i >= a; i--) {
        const row = new Array(edge + 1)
        for (let j = edge; j >= b; j--) {
            if (i === edge && j === edge) { row[j] = deuce; continue }
            const ifWon = i === edge ? 1 : next[j]
            const ifLost = j === edge ? 0 : row[j + 1]
            row[j] = p * ifWon + q * ifLost
        }
        next = row
    }
    return next[b]
}

// Chance of winning the match from the given state (games won plus the score of
// the game in progress), for a fixed point probability p.
export const matchWinProbability = (p, { games1 = 0, games2 = 0, bestOf = 1, score1 = 0, score2 = 0, target = 11 } = {}) => {
    const need = Math.ceil(bestOf / 2)
    if (games1 >= need) return 1
    if (games2 >= need) return 0
    const freshGame = gameWinProbability(p, 0, 0, target)
    const fromGames = (g1, g2) => {
        if (g1 >= need) return 1
        if (g2 >= need) return 0
        return freshGame * fromGames(g1 + 1, g2) + (1 - freshGame) * fromGames(g1, g2 + 1)
    }
    const current = gameWinProbability(p, score1, score2, target)
    return current * fromGames(games1 + 1, games2) + (1 - current) * fromGames(games1, games2 + 1)
}

// Point probability that makes a single game come out at the given win chance
// (used to turn an Elo expectation into a per-point number when there is no history).
export const pointProbabilityFromGameProbability = (gameProb, target = 11) => {
    let lo = 0, hi = 1
    for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2
        if (gameWinProbability(mid, 0, 0, target) < gameProb) lo = mid
        else hi = mid
    }
    return (lo + hi) / 2
}

const solveLinear = (A, b) => {
    const n = b.length
    const M = A.map((row, i) => [...row, b[i]])
    for (let col = 0; col < n; col++) {
        let pivot = col
        for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r
        ;[M[col], M[pivot]] = [M[pivot], M[col]]
        const d = M[col][col]
        if (Math.abs(d) < 1e-12) continue
        for (let r = col + 1; r < n; r++) {
            const f = M[r][col] / d
            if (f === 0) continue
            for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
        }
    }
    const x = new Array(n).fill(0)
    for (let r = n - 1; r >= 0; r--) {
        let s = M[r][n]
        for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c]
        x[r] = Math.abs(M[r][r]) < 1e-12 ? 0 : s / M[r][r]
    }
    return x
}

const weightedGames = (matches, now, halfLifeDays) => {
    const games = []
    for (const m of matches || []) {
        const s1 = Number(m.score1), s2 = Number(m.score2)
        if (!Number.isFinite(s1) || !Number.isFinite(s2) || s1 + s2 <= 0 || !m.player1_id || !m.player2_id) continue
        const ageDays = Math.max(0, (now - Date.parse(m.created_at)) / DAY_MS) || 0
        games.push({ a: m.player1_id, b: m.player2_id, s1, s2, w: Math.pow(0.5, ageDays / halfLifeDays) })
    }
    return games
}

// Fits one strength per player so that P(A wins a point vs B) = sigmoid(sA - sB).
export const fitPointStrengths = (matches, options = {}) => {
    const { halfLifeDays, ridge } = { ...MODEL_DEFAULTS, ...options }
    const now = options.now ?? Date.now()
    const games = weightedGames(matches, now, halfLifeDays)
    const ids = [...new Set(games.flatMap(g => [g.a, g.b]))]
    const index = new Map(ids.map((id, i) => [id, i]))
    const n = ids.length
    let theta = new Array(n).fill(0)

    for (let iter = 0; iter < 25 && n > 0; iter++) {
        const grad = theta.map(t => -ridge * t)
        const hess = Array.from({ length: n }, (_, i) => { const row = new Array(n).fill(0); row[i] = ridge; return row })
        for (const g of games) {
            const i = index.get(g.a), j = index.get(g.b)
            const p = sigmoid(theta[i] - theta[j])
            const total = g.s1 + g.s2
            const r = g.w * (g.s1 - total * p)
            const v = g.w * total * p * (1 - p)
            grad[i] += r; grad[j] -= r
            hess[i][i] += v; hess[j][j] += v
            hess[i][j] -= v; hess[j][i] -= v
        }
        const step = solveLinear(hess, grad)
        let biggest = 0
        theta = theta.map((t, i) => { const s = clamp(step[i], -1, 1); biggest = Math.max(biggest, Math.abs(s)); return t + s })
        if (biggest < 1e-7) break
    }

    return { strengths: Object.fromEntries(ids.map((id, i) => [id, theta[i]])), games }
}

// Pre-match chance that player 1 wins a point against player 2.
// `fit` can be passed in to reuse one fit across many pairings.
export const estimatePointProbability = (matches, player1Id, player2Id, options = {}) => {
    const { pairRidge } = { ...MODEL_DEFAULTS, ...options }
    const fit = options.fit || fitPointStrengths(matches, options)
    const base = (fit.strengths[player1Id] || 0) - (fit.strengths[player2Id] || 0)

    // Matchup adjustment: how far this pairing's own results sit from what the
    // general strengths predict, shrunk hard because pairings are small samples.
    let delta = 0
    const pairGames = fit.games.filter(g => (g.a === player1Id && g.b === player2Id) || (g.a === player2Id && g.b === player1Id))
    if (pairGames.length > 0) {
        for (let iter = 0; iter < 20; iter++) {
            const p = sigmoid(base + delta)
            let grad = -pairRidge * delta, hess = pairRidge
            for (const g of pairGames) {
                const won = g.a === player1Id ? g.s1 : g.s2
                const total = g.s1 + g.s2
                grad += g.w * (won - total * p)
                hess += g.w * total * p * (1 - p)
            }
            const step = grad / hess
            delta += step
            if (Math.abs(step) < 1e-9) break
        }
    }

    const known = id => fit.strengths[id] !== undefined
    return {
        pointProb: sigmoid(base + delta),
        hasHistory: known(player1Id) && known(player2Id),
        pairGames: pairGames.length,
    }
}

const GRID = 200

// Chance that player 1 wins the match from the current state.
// pointProb is the pre-match estimate; points1/points2 are the points each
// player has won in this match so far (all games), which sharpen it as play goes on.
export const liveWinProbability = ({ pointProb, points1 = 0, points2 = 0, priorPoints = MODEL_DEFAULTS.priorPoints, ...state }) => {
    const p0 = clamp(pointProb, 0.02, 0.98)
    const alpha = p0 * priorPoints + points1
    const beta = (1 - p0) * priorPoints + points2
    const logs = new Array(GRID)
    let peak = -Infinity
    for (let i = 0; i < GRID; i++) {
        const x = (i + 0.5) / GRID
        logs[i] = (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x)
        if (logs[i] > peak) peak = logs[i]
    }
    let total = 0, win = 0
    for (let i = 0; i < GRID; i++) {
        const weight = Math.exp(logs[i] - peak)
        if (weight < 1e-12) continue
        total += weight
        win += weight * matchWinProbability((i + 0.5) / GRID, state)
    }
    return win / total
}
