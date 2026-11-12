import { describe, expect, it } from 'vitest'
import {
    estimatePointProbability,
    fitPointStrengths,
    gameWinProbability,
    liveWinProbability,
    matchWinProbability,
    pointProbabilityFromGameProbability,
} from './winProbability'

// Deterministic generator so simulations give the same numbers every run.
const rng = (seed) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
}

const playGame = (p, random, a = 0, b = 0) => {
    while (!((a >= 11 || b >= 11) && Math.abs(a - b) >= 2)) {
        if (random() < p) a++
        else b++
    }
    return [a, b]
}

describe('gameWinProbability', () => {
    it('is even for evenly matched players and mirrors between sides', () => {
        expect(gameWinProbability(0.5)).toBeCloseTo(0.5, 10)
        expect(gameWinProbability(0.5, 7, 7)).toBeCloseTo(0.5, 10)
        expect(gameWinProbability(0.57, 4, 8)).toBeCloseTo(1 - gameWinProbability(0.43, 8, 4), 10)
    })

    it('handles finished games, game points and deuce', () => {
        expect(gameWinProbability(0.5, 11, 9)).toBe(1)
        expect(gameWinProbability(0.5, 9, 11)).toBe(0)
        expect(gameWinProbability(0.5, 11, 10)).toBeCloseTo(0.75, 10)
        expect(gameWinProbability(0.5, 10, 9)).toBeCloseTo(0.75, 10)
        expect(gameWinProbability(0.6, 10, 10)).toBeCloseTo(0.36 / 0.52, 10)
        expect(gameWinProbability(0.6, 14, 14)).toBeCloseTo(0.36 / 0.52, 10)
        expect(gameWinProbability(0.6, 15, 14)).toBeCloseTo(0.6 + 0.4 * 0.36 / 0.52, 10)
    })

    it('matches simulated games', () => {
        const random = rng(7)
        for (const [p, a, b] of [[0.55, 0, 0], [0.45, 6, 3], [0.6, 2, 8]]) {
            let wins = 0
            const runs = 40000
            for (let i = 0; i < runs; i++) {
                const [x, y] = playGame(p, random, a, b)
                if (x > y) wins++
            }
            expect(gameWinProbability(p, a, b)).toBeCloseTo(wins / runs, 2)
        }
    })

    it('never goes down when the player scores', () => {
        for (let a = 0; a < 13; a++) for (let b = 0; b < 13; b++) {
            if ((a >= 11 || b >= 11) && Math.abs(a - b) >= 2) continue
            expect(gameWinProbability(0.48, a + 1, b)).toBeGreaterThanOrEqual(gameWinProbability(0.48, a, b))
            expect(gameWinProbability(0.48, a, b + 1)).toBeLessThanOrEqual(gameWinProbability(0.48, a, b))
        }
    })
})

describe('matchWinProbability', () => {
    it('equals the game probability for a single game', () => {
        expect(matchWinProbability(0.56, { bestOf: 1, score1: 3, score2: 5 })).toBeCloseTo(gameWinProbability(0.56, 3, 5), 10)
    })

    it('combines games in a best of three', () => {
        const g = gameWinProbability(0.55)
        expect(matchWinProbability(0.55, { bestOf: 3 })).toBeCloseTo(g * g * (3 - 2 * g), 10)
        expect(matchWinProbability(0.55, { bestOf: 3, games1: 1, games2: 1 })).toBeCloseTo(g, 10)
        expect(matchWinProbability(0.55, { bestOf: 5, games1: 3, games2: 1 })).toBe(1)
        expect(matchWinProbability(0.55, { bestOf: 5, games1: 0, games2: 3 })).toBe(0)
    })
})

describe('pointProbabilityFromGameProbability', () => {
    it('inverts the game probability', () => {
        for (const g of [0.1, 0.5, 0.76, 0.95]) {
            expect(gameWinProbability(pointProbabilityFromGameProbability(g))).toBeCloseTo(g, 6)
        }
    })
})

describe('liveWinProbability', () => {
    it('starts near the fixed-probability answer and reacts to the score', () => {
        const start = liveWinProbability({ pointProb: 0.5, bestOf: 3 })
        expect(start).toBeCloseTo(0.5, 6)
        const ahead = liveWinProbability({ pointProb: 0.5, bestOf: 3, score1: 6, score2: 2, points1: 6, points2: 2 })
        const behind = liveWinProbability({ pointProb: 0.5, bestOf: 3, score1: 2, score2: 6, points1: 2, points2: 6 })
        expect(ahead).toBeGreaterThan(0.6)
        expect(ahead + behind).toBeCloseTo(1, 6)
    })

    it('is less sure than a fixed probability, because form on the day is uncertain', () => {
        const fixed = matchWinProbability(0.56, { bestOf: 1 })
        const live = liveWinProbability({ pointProb: 0.56, bestOf: 1 })
        expect(live).toBeLessThan(fixed)
        expect(live).toBeGreaterThan(0.5)
    })

    it('lets points won in earlier games carry into the next one', () => {
        const level = liveWinProbability({ pointProb: 0.5, bestOf: 3, games1: 1, games2: 1 })
        const dominant = liveWinProbability({ pointProb: 0.5, bestOf: 3, games1: 1, games2: 1, points1: 20, points2: 13 })
        expect(level).toBeCloseTo(0.5, 6)
        expect(dominant).toBeGreaterThan(level)
    })

    it('reaches certainty only when the match is decided', () => {
        expect(liveWinProbability({ pointProb: 0.3, bestOf: 1, score1: 11, score2: 5 })).toBe(1)
        const matchPoint = liveWinProbability({ pointProb: 0.5, bestOf: 1, score1: 10, score2: 4, points1: 10, points2: 4 })
        expect(matchPoint).toBeGreaterThan(0.97)
        expect(matchPoint).toBeLessThan(1)
    })
})

describe('fitting from match history', () => {
    const now = Date.parse('2026-06-01T00:00:00Z')
    const history = (pairs, seed = 3) => {
        const random = rng(seed)
        const matches = []
        let t = now - 60 * 86400000
        for (let round = 0; round < 40; round++) {
            for (const [a, b, p] of pairs) {
                const [score1, score2] = playGame(p, random)
                matches.push({ id: `m${matches.length}`, player1_id: a, player2_id: b, score1, score2, created_at: new Date(t += 600000).toISOString() })
            }
        }
        return matches
    }

    it('recovers who is stronger and by roughly how much', () => {
        const matches = history([['ana', 'bor', 0.58], ['bor', 'cene', 0.58], ['ana', 'cene', 0.66]])
        const { strengths } = fitPointStrengths(matches, { now })
        expect(strengths.ana).toBeGreaterThan(strengths.bor)
        expect(strengths.bor).toBeGreaterThan(strengths.cene)
        const { pointProb, hasHistory, pairGames } = estimatePointProbability(matches, 'ana', 'bor', { now })
        expect(hasHistory).toBe(true)
        expect(pairGames).toBe(40)
        expect(pointProb).toBeGreaterThan(0.54)
        expect(pointProb).toBeLessThan(0.62)
    })

    it('is symmetric and does not depend on who was listed first', () => {
        const matches = history([['ana', 'bor', 0.6], ['cene', 'ana', 0.45]])
        const ab = estimatePointProbability(matches, 'ana', 'bor', { now }).pointProb
        const ba = estimatePointProbability(matches, 'bor', 'ana', { now }).pointProb
        expect(ab + ba).toBeCloseTo(1, 8)
    })

    it('stays neutral without usable history', () => {
        expect(estimatePointProbability([], 'ana', 'bor', { now })).toEqual({ pointProb: 0.5, hasHistory: false, pairGames: 0 })
        const junk = [{ player1_id: 'ana', player2_id: 'bor', score1: null, score2: 0, created_at: 'x' }]
        expect(estimatePointProbability(junk, 'ana', 'bor', { now }).hasHistory).toBe(false)
        const oneSided = history([['ana', 'bor', 0.6]])
        expect(estimatePointProbability(oneSided, 'ana', 'newcomer', { now }).hasHistory).toBe(false)
    })
})
