import { describe, expect, it } from 'vitest'
import { getGameFirstServer, getPointServer, scoreProgression } from './pingPongPoints'

describe('ping pong point tracking', () => {
    it('rotates service in pairs, then singles at deuce, and alternates the first server per game', () => {
        expect([0, 1, 2, 3, 4].map(n => getPointServer(1, n, 0))).toEqual([1, 1, 2, 2, 1])
        expect([[10, 9], [10, 10], [11, 10], [11, 11], [11, 12]].map(([a, b]) => getPointServer(2, a, b))).toEqual([1, 2, 1, 2, 1])
        expect([0, 1, 2, 3, 4].map(n => getGameFirstServer(1, n))).toEqual([1, 2, 1, 2, 1])
        expect(getPointServer(null, 0, 0)).toBeNull()
    })

    it('derives progression from the stored point winners only', () => {
        const points = [1, 1, 2, 2]
        expect(scoreProgression(points).map(p => [p.winner, p.score1, p.score2])).toEqual([
            [1, 1, 0], [1, 2, 0], [2, 2, 1], [2, 2, 2],
        ])
    })

    it('can read previously saved point objects during rollout', () => {
        expect(scoreProgression([{ winner: 1, server: 1, type: 'ace' }])).toMatchObject([
            { winner: 1, score1: 1, score2: 0 },
        ])
    })
})
