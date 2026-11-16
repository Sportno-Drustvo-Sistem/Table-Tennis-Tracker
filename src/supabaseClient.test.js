import { afterEach, describe, expect, it, vi } from 'vitest'
import { recordPingPongMatch, recordPingPongMatchWithBets } from './matchPersistence'

vi.mock('./runtimeConfig', () => ({
    getRuntimeConfigValue: key => ({
        VITE_SUPABASE_URL: 'https://tracker.example',
        VITE_SUPABASE_ANON_KEY: 'public-api-key',
    })[key],
}))

afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
})

describe('PIN-authenticated Supabase client', () => {
    for (const withBets of [false, true]) {
        it(`saves ${withBets ? 'with bets' : 'without bets'} without waiting for a stalled browser auth lock`, async () => {
            // Model a browser whose Auth lock never answers after an idle tab resumes.
            const requestLock = vi.fn(() => new Promise(() => {}))
            vi.stubGlobal('window', { location: { href: 'https://tracker.example' } })
            vi.stubGlobal('document', { visibilityState: 'visible' })
            vi.stubGlobal('navigator', { locks: { request: requestLock } })
            const saved = { match: { id: 'saved-match' }, changes: { p1: 12, p2: -12 } }
            const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(saved), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            }))
            vi.stubGlobal('fetch', fetch)

            const { supabase } = await import('./supabaseClient')
            const record = withBets ? recordPingPongMatchWithBets : recordPingPongMatch
            const result = await record(supabase, {
                adminToken: 'pin-session-token', player1Id: 'p1', player2Id: 'p2',
                sets: [{ s1: 11, s2: 8 }], marketId: 'market-1',
            })

            expect(result.match.id).toBe('saved-match')
            expect(requestLock).not.toHaveBeenCalled()
            expect(fetch).toHaveBeenCalledOnce()
            const [url, options] = fetch.mock.calls[0]
            expect(url).toContain(`/rest/v1/rpc/record_pingpong_match${withBets ? '_with_bets' : ''}`)
            expect(options.headers.get('apikey')).toBe('public-api-key')
            expect(options.headers.get('Authorization')).toBe('Bearer public-api-key')
            expect(JSON.parse(options.body)).toMatchObject({
                p_admin_token: 'pin-session-token', p_sets: [{ s1: 11, s2: 8 }],
            })
        })
    }
})
