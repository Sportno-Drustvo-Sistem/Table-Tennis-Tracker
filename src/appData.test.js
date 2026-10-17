import { describe, expect, it } from 'vitest'
import { DATA_SOURCES, combineChanges, createInitialData, dataReducer, mergeRows, realtimeChange } from './appData'

const match = (id, created_at, extra = {}) => ({ id, created_at, player1_id: 'a', player2_id: 'b', score1: 11, score2: 5, ...extra })
const newest = DATA_SOURCES.matches.order

describe('cached dataset merging', () => {
    const history = [match('m3', '2026-10-16T10:00:00+00:00'), match('m2', '2026-10-15T10:00:00+00:00'), match('m1', '2026-10-14T10:00:00+00:00')]

    it('adds saved matches in history order, including same-timestamp sets', () => {
        const sets = [match('s-a', '2026-10-17T09:00:00.123456+00:00'), match('s-b', '2026-10-17T09:00:00.123456+00:00')]
        const merged = mergeRows(history, { upserts: sets }, newest)
        expect(merged.map(m => m.id)).toEqual(['s-b', 's-a', 'm3', 'm2', 'm1'])
        expect(history.map(m => m.id)).toEqual(['m3', 'm2', 'm1'])
    })

    it('is idempotent, so a realtime echo of a local save changes nothing', () => {
        const saved = match('m4', '2026-10-17T10:00:00+00:00')
        const once = mergeRows(history, { upserts: [saved] }, newest)
        expect(mergeRows(once, { upserts: [saved] }, newest)).toEqual(once)
    })

    it('updates rows in place and removes deleted ids, delete winning in one batch', () => {
        const merged = mergeRows(history, { upserts: [{ id: 'm2', score1: 3 }, match('gone', '2026-10-18T00:00:00+00:00')], deletes: ['m3', 'gone'] }, newest)
        expect(merged.map(m => [m.id, m.score1])).toEqual([['m2', 3], ['m1', 11]])
        expect(merged[0].created_at).toBe('2026-10-15T10:00:00+00:00')
    })

    it('returns the same array when nothing changed', () => {
        expect(mergeRows(history, {}, newest)).toBe(history)
    })

    it('re-sorts players when wins change', () => {
        const users = [{ id: 'a', total_wins: 5 }, { id: 'b', total_wins: 4 }]
        expect(mergeRows(users, { upserts: [{ id: 'b', total_wins: 6 }] }, DATA_SOURCES.users.order).map(u => u.id)).toEqual(['b', 'a'])
    })
})

describe('data reducer', () => {
    it('tracks loads and failures per dataset and merges changes', () => {
        let state = dataReducer(createInitialData(), { type: 'failed', key: 'matches' })
        expect(state.failed.matches).toBe(true)
        state = dataReducer(state, { type: 'loaded', key: 'matches', data: [match('m1', '2026-10-14T10:00:00+00:00')] })
        expect([state.loaded.matches, state.failed.matches]).toEqual([true, false])
        const users = state.users
        state = dataReducer(state, { type: 'changed', changes: { matches: { upserts: [match('m2', '2026-10-15T10:00:00+00:00')] } } })
        expect(state.matches.map(m => m.id)).toEqual(['m2', 'm1'])
        expect(state.users).toBe(users)
    })
})

describe('realtime payloads', () => {
    it('maps inserts, updates and deletes to their dataset', () => {
        expect(realtimeChange({ table: 'padel_stats', eventType: 'UPDATE', new: { id: 's1', elo_rating: 1210 } }))
            .toEqual({ key: 'padelStats', upserts: [{ id: 's1', elo_rating: 1210 }] })
        expect(realtimeChange({ table: 'tennis_matches', eventType: 'DELETE', old: { id: 't1' } }))
            .toEqual({ key: 'tennisMatches', deletes: ['t1'] })
        expect(realtimeChange({ table: 'tournaments', eventType: 'INSERT', new: { id: 'x' } })).toBeNull()
    })

    it('asks for a reload when a payload cannot be applied', () => {
        expect(realtimeChange({ table: 'matches', eventType: 'INSERT', new: { id: 'm1' }, errors: ['Error 413: Payload Too Large'] }))
            .toEqual({ key: 'matches', reload: true })
        expect(realtimeChange({ table: 'users', eventType: 'DELETE', old: {} })).toEqual({ key: 'users', reload: true })
    })

    it('combines a burst of changes into one merge per dataset', () => {
        expect(combineChanges([
            { key: 'users', upserts: [{ id: 'a' }] },
            { key: 'matches', deletes: ['m1'] },
            { key: 'users', upserts: [{ id: 'b' }] },
        ])).toEqual({
            users: { upserts: [{ id: 'a' }, { id: 'b' }], deletes: [] },
            matches: { upserts: [], deletes: ['m1'] },
        })
    })
})
