import { describe, expect, it } from 'vitest'
import { RECENT_WINDOW_MS, generatePairing, getCandidateWeights, getRecentMatches, getRestingPlayers, pickWeighted } from './matchGenerator'

const now = Date.parse('2026-10-22T18:00:00Z')
const at = hoursAgo => new Date(now - hoursAgo * 60 * 60 * 1000).toISOString()
const match = (p1, p2, hoursAgo) => ({ id: `${p1}${p2}${hoursAgo}`, player1_id: p1, player2_id: p2, created_at: at(hoursAgo) })
const players = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id.toUpperCase() }))
// Deterministic rolls, consumed in order.
const rolls = (...values) => () => values.shift()

describe('recent matches', () => {
    it('ignores games outside the session window', () => {
        const recent = match('a', 'b', 1)
        const old = match('c', 'd', RECENT_WINDOW_MS / 3600000 + 1)
        expect(getRecentMatches([recent, old], now)).toEqual([recent])
    })
    it('caps at the last 10 games', () => {
        const many = Array.from({ length: 12 }, (_, i) => match('a', 'b', i * 0.1))
        expect(getRecentMatches(many, now)).toHaveLength(10)
    })
})

describe('resting players', () => {
    it('rests whoever played both of the last 2 games', () => {
        expect(getRestingPlayers([match('a', 'b', 1), match('a', 'c', 2)])).toEqual(['a'])
        expect(getRestingPlayers([match('a', 'b', 1), match('b', 'a', 2)])).toEqual(['a', 'b'])
        expect(getRestingPlayers([match('a', 'b', 1), match('c', 'd', 2)])).toEqual([])
        expect(getRestingPlayers([match('a', 'b', 1)])).toEqual([])
    })
    it('lets yesterday\'s players back in', () => {
        expect(getRestingPlayers(getRecentMatches([match('a', 'b', 20), match('a', 'b', 21)], now))).toEqual([])
    })
})

describe('weights', () => {
    it('favours players with fewer recent games', () => {
        const weights = getCandidateWeights(players, [match('a', 'b', 1), match('a', 'c', 2)])
        expect(weights.map(w => w.weight)).toEqual([1 / 3, 1 / 2, 1 / 2, 1])
    })
    it('picks by cumulative weight', () => {
        const items = [{ weight: 1 }, { weight: 3 }]
        expect(pickWeighted(items, () => 0.2)).toBe(items[0])
        expect(pickWeighted(items, () => 0.3)).toBe(items[1])
    })
})

describe('pairing', () => {
    it('needs two candidates', () => {
        expect(generatePairing(players.slice(0, 1), [])).toBeNull()
    })
    it('never pairs a player with themself', () => {
        for (let i = 0; i < 50; i++) {
            const [p1, p2] = generatePairing(players, [])
            expect(p1.id).not.toBe(p2.id)
        }
    })
    it('makes an immediate rematch less likely', () => {
        // a vs b just played; with a drawn first, b's weight 0.5 drops to 0.1 against c and d at 1 each.
        const recent = [match('a', 'b', 1)]
        const [, p2] = generatePairing(players, recent, { random: rolls(0, 0.1 / 2.1 + 0.01) })
        expect(p2.id).toBe('c')
        const [, rematch] = generatePairing(players, recent, { random: rolls(0, 0.1 / 2.1 - 0.01) })
        expect(rematch.id).toBe('b')
    })
    it('skips the pairing just shown on retry when possible', () => {
        const [p1, p2] = generatePairing(players.slice(0, 3), [], { avoidPair: ['a', 'b'], random: rolls(0, 0) })
        expect([p1.id, p2.id]).toEqual(['a', 'c'])
        const [q1, q2] = generatePairing(players.slice(0, 2), [], { avoidPair: ['a', 'b'], random: rolls(0, 0) })
        expect([q1.id, q2.id]).toEqual(['a', 'b'])
    })
})
