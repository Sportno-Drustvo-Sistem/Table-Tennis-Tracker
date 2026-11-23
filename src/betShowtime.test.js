import { describe, expect, it } from 'vitest'
import { buildShowtime, diffBets, rollingTier, winTier } from './betShowtime'

const bet = (id, user_id, side, status, stake, payout, multiplier = '1.50', market_id = 'm') =>
    ({ id, user_id, side, status, stake, payout, multiplier, market_id, created_at: `2026-11-23T10:00:0${id.length}Z` })
const market = { id: 'm', player1_id: 'bor', player2_id: 'maks', status: 'settled', winner_side: 1 }

describe('diffBets', () => {
    it('finds new pending bets and bets that just settled', () => {
        const seen = new Map([['a', 'pending'], ['b', 'won']])
        const { placed, settled } = diffBets(seen, [bet('a', 'u', 1, 'won', 10, 15), bet('b', 'u', 1, 'won', 10, 15), bet('c', 'u', 1, 'pending', 10, 0)])
        expect(placed.map(b => b.id)).toEqual(['c'])
        expect(settled).toEqual(['a'])
    })
})

describe('win tiers', () => {
    it('climbs on profit or multiplier', () => {
        expect(winTier(bet('a', 'u', 1, 'won', 100, 400))).toBe(0)
        expect(winTier(bet('a', 'u', 1, 'won', 500, 1600))).toBe(1)
        expect(winTier(bet('a', 'u', 1, 'won', 100, 700, '7.00'))).toBe(2)
        expect(rollingTier(500, 2)).toBe(0)
        expect(rollingTier(1200, 2)).toBe(1)
        expect(rollingTier(3000, 1)).toBe(1)
    })
})

describe('buildShowtime', () => {
    it('reveals a match several people bet on, then the big win, then banners', () => {
        const bets = [
            bet('w1', 'cene', 1, 'won', 300, 1110, '3.70'),
            bet('l1', 'ana', 2, 'lost', 600, 0),
            bet('l2', 'eva', 2, 'lost', 100, 0),
        ]
        const wallets = [{ user_id: 'ana', balance: 50 }, { user_id: 'eva', balance: 0 }]
        const { stage, banners } = buildShowtime({ settledIds: ['w1', 'l1', 'l2'], bets, markets: [market], wallets, leaderBefore: 'ana', leaderAfter: 'cene' })
        expect(stage.map(s => s.type)).toEqual(['result', 'win'])
        expect(stage[0]).toMatchObject({ player1Id: 'bor', player2Id: 'maks', winnerSide: 1, upset: true })
        expect(stage[0].bets[0].id).toBe('w1')
        expect(stage[1].wins.map(b => b.id)).toEqual(['w1'])
        expect(banners.map(b => b.type).sort()).toEqual(['broke', 'leader', 'ouch'])
    })

    it('skips the reveal when only one person bet, and flags streaks', () => {
        const bets = [
            bet('a', 'cene', 1, 'won', 10, 15),
            bet('bb', 'cene', 1, 'won', 10, 15, '1.50', 'old1'),
            bet('ccc', 'cene', 1, 'won', 10, 15, '1.50', 'old2'),
        ]
        const { stage, banners } = buildShowtime({ settledIds: ['a'], bets, markets: [market] })
        expect(stage).toEqual([])
        expect(banners).toEqual([{ type: 'hot', id: 'hot-cene-3', userId: 'cene', value: 3 }])
    })
})
