import { describe, expect, it, vi } from 'vitest'
import { filterSeasonMatches, getSeasonUsers, fetchAllPingpongMatches } from './seasonUtils'

const users = [{ id: 'a', name: 'A', elo_rating: 1200, total_wins: 0, matches_played: 0 }, { id: 'b', name: 'B', elo_rating: 1200, total_wins: 0, matches_played: 0 }]
const matches = [
    { id: '1', season_id: 1, player1_id: 'a', player2_id: 'b', score1: 11, score2: 7, created_at: '2026-09-01' },
    { id: '2', season_id: 2, player1_id: 'b', player2_id: 'a', score1: 11, score2: 9, created_at: '2026-10-04' },
]

describe('ping pong season scopes', () => {
    it('isolates new season games while retaining all history', () => {
        expect(filterSeasonMatches(matches, '2')).toEqual([matches[1]])
        expect(filterSeasonMatches(matches, '1')).toEqual([matches[0]])
        expect(filterSeasonMatches(matches, 'all')).toBe(matches)
    })
    it('keeps live ratings reset and archived standings exact', () => {
        const snapshots = [{ season_id: 1, user_id: 'a', player: { ...users[0], elo_rating: 1700, total_wins: 50, matches_played: 70 } }]
        expect(getSeasonUsers(users, matches, snapshots, '2', 2)).toBe(users)
        expect(getSeasonUsers(users, matches, snapshots, '1', 2)[0]).toMatchObject({ elo_rating: 1700, total_wins: 50, matches_played: 70 })
    })
    it('combines every season for all-time wins and continuous ratings', () => {
        const stats = getSeasonUsers(users, matches, [], 'all', 2)
        expect(stats.map(u => u.matches_played)).toEqual([2, 2])
        expect(stats.map(u => u.total_wins)).toEqual([1, 1])
        expect(stats[0].elo_rating).not.toBe(1200)
    })
    it('loads history beyond the API row cap and propagates errors', async () => {
        const range = vi.fn().mockResolvedValueOnce({ data: Array(1000).fill(matches[0]), error: null }).mockResolvedValueOnce({ data: [matches[1]], error: null })
        const query = { select: () => query, order: () => query, range }
        const client = { from: () => query }
        expect((await fetchAllPingpongMatches(client)).data).toHaveLength(1001)
        expect(range).toHaveBeenLastCalledWith(1000, 1999)
        range.mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
        expect((await fetchAllPingpongMatches(client)).error.message).toBe('offline')
    })
})
