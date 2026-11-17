import { describe, expect, it } from 'vitest'
import { canAffordSabotage, livePointsPlayed, pendingSabotages, sabotagePrice, sabotageStatus, sabotageStats } from './sabotageUtils'

const sabotage = (id, start, points, extra = {}) => ({
    id, live_match_id: 'm', target_id: 'bob', buyer_id: 'carol', price: points * 30,
    start_point: start, end_point: start + points, points, created_at: '2026-11-17T10:00:00Z', ...extra,
})

describe('sabotage utils', () => {
    it('counts points across finished games and the current one', () => {
        expect(livePointsPlayed({ score1: 4, score2: 2, sets: [{ s1: 11, s2: 7 }] })).toBe(24)
        expect(livePointsPlayed({ score1: 0, score2: 0, sets: null })).toBe(0)
        expect(livePointsPlayed(null)).toBe(0)
    })

    it('runs a debuff from its start point for its number of points', () => {
        const s = sabotage('a', 24, 3)
        expect(sabotageStatus(s, 23)).toEqual({ state: 'queued', left: 3, startsIn: 1 })
        expect(sabotageStatus(s, 24)).toEqual({ state: 'active', left: 3, startsIn: 0 })
        expect(sabotageStatus(s, 26)).toEqual({ state: 'active', left: 1, startsIn: 0 })
        expect(sabotageStatus(s, 27).state).toBe('done')
    })

    it('lists only unfinished debuffs of one match, current first', () => {
        const list = [sabotage('later', 27, 2), sabotage('now', 24, 3), sabotage('old', 10, 2), sabotage('other', 24, 3, { live_match_id: 'x' })]
        expect(pendingSabotages(list, 'm', 25).map(s => [s.id, s.status.state])).toEqual([['now', 'active'], ['later', 'queued']])
    })

    it('prices per point and keeps the buyer above zero', () => {
        expect(sabotagePrice({ price_per_point: 30 }, 3)).toBe(90)
        expect(sabotagePrice(null, 3)).toBe(0)
        expect(canAffordSabotage(91, 90)).toBe(true)
        expect(canAffordSabotage(90, 90)).toBe(false)
        expect(canAffordSabotage(100, 0)).toBe(false)
    })

    it('finds the biggest spender and the most paid victim', () => {
        const list = [sabotage('a', 0, 3), sabotage('b', 0, 1, { buyer_id: 'alice', target_id: 'carol', price: 200 })]
        expect(sabotageStats(list)).toEqual({ saboteur: ['alice', 200], victim: ['carol', 200] })
        expect(sabotageStats([])).toEqual({ saboteur: null, victim: null })
    })
})
