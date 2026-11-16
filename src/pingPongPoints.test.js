import { describe, expect, it } from 'vitest'
import { createPoint, getGameFirstServer, getPointServer, scoreProgression, summarizePoints, summarizePlayerPoints, formatPointRate } from './pingPongPoints'

describe('ping pong rally tracking', () => {
    it('rotates service in pairs, then singles at deuce, and alternates the first server per game', () => {
        expect([0, 1, 2, 3, 4].map(n => getPointServer(1, n, 0))).toEqual([1, 1, 2, 2, 1])
        expect([[10, 9], [10, 10], [11, 10], [11, 11], [11, 12]].map(([a, b]) => getPointServer(2, a, b))).toEqual([1, 2, 1, 2, 1])
        expect([0, 1, 2, 3, 4].map(n => getGameFirstServer(1, n))).toEqual([1, 2, 1, 2, 1])
        expect(getPointServer(null, 0, 0)).toBeNull()
    })

    it('attributes errors to the loser and enforces who can ace or fault', () => {
        expect(createPoint(1, 'unforced_error', 2)).toEqual({ winner: 2, server: 2, type: 'unforced_error' })
        expect(createPoint(2, 'forced_error', 1)?.winner).toBe(1)
        expect(createPoint(1, 'serve_fault', 1)?.winner).toBe(2)
        expect(createPoint(1, 'ace', 1)?.winner).toBe(1)
        for (const type of ['ace', 'serve_fault']) expect(createPoint(2, type, 1)).toBeNull()
        expect(createPoint(1, 'unknown', 1)).toBeNull()
        expect(createPoint(1, 'winner', null)).toBeNull()
    })

    it('derives progression and serving/receiving percentages from the same rallies', () => {
        const points = [createPoint(1, 'ace', 1), createPoint(1, 'serve_fault', 1), createPoint(2, 'smash', 2), createPoint(2, 'unforced_error', 2)]
        expect(scoreProgression(points).map(p => [p.score1, p.score2])).toEqual([[1, 0], [1, 1], [1, 2], [2, 2]])
        const p1 = summarizePoints(points, 1), p2 = summarizePoints(points, 2)
        expect([p1.serveWon, p1.servePlayed, p1.receiveWon, p1.receivePlayed]).toEqual([1, 2, 1, 2])
        expect([p1.types.ace, p1.types.serve_fault, p1.types.unforced_error]).toEqual([1, 1, 0])
        expect([p2.types.smash, p2.types.unforced_error, p2.pointsWon]).toEqual([1, 1, 2])
        expect(formatPointRate(1, 2)).toBe('1/2 (50%)')
        expect(formatPointRate(0, 0)).toBe('—')
        expect(summarizePoints(points.slice(0, -1), 1).receiveWon).toBe(0)
    })

    it('aggregates by player ID across both sides and excludes untracked games', () => {
        const matches = [
            { player1_id: 'a', player2_id: 'b', point_history: [createPoint(1, 'ace', 1)] },
            { player1_id: 'b', player2_id: 'a', point_history: [createPoint(2, 'smash', 1)] },
            { player1_id: 'a', player2_id: 'b', score1: 11, score2: 5 },
            { player1_id: 'c', player2_id: 'b', point_history: [createPoint(1, 'ace', 1)] },
        ]
        expect(summarizePlayerPoints(matches, 'a')).toMatchObject({ trackedGames: 2, pointsPlayed: 2, pointsWon: 2, serveWon: 1, receiveWon: 1, types: { ace: 1, smash: 1 } })
    })
})
