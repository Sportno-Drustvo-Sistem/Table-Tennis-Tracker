import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./supabaseClient', () => ({ supabase: {} }))

import BetSheet from './components/BetSheet'
import BetsView from './components/BetsView'
import HouseView, { EditHistory } from './components/HouseView'
import Matches from './components/Matches'
import { ToastContextValue } from './contexts/ToastContextValue'

const users = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bor' }, { id: 'c', name: 'Cene' }]
const wallets = [{ id: 'w1', user_id: 'c', balance: 900, rebuys: 0 }]
const market = { id: 'k', player1_id: 'a', player2_id: 'b', status: 'open' }
const pending = { id: 'b1', market_id: 'k', user_id: 'c', side: 1, stake: 100, multiplier: '1.43', status: 'pending', payout: 0, created_at: '2026-11-12T10:00:00Z' }
const render = node => renderToStaticMarkup(
    <ToastContextValue.Provider value={{ showToast() {}, showConfirm() {} }}>{node}</ToastContextValue.Provider>
)

describe('betting screens render', () => {
    it('shows both multipliers, every bettor with a balance and the bets placed', () => {
        const html = render(<BetSheet isOpen onClose={() => {}} marketId="k" player1={users[0]} player2={users[1]} users={users} wallets={wallets} bets={[pending]} prob1={0.7} closed={false} adminToken="t" />)
        expect(html).toContain('1.43×')
        expect(html).toContain('3.33×')
        expect(html).toContain('>900<')
        expect(html).toContain('>1000<')
        expect(html).toContain('>139<')
        expect(html).toContain('1 bet · 100 points riding')
        expect(html).toContain('Remove Cene bet')
        expect(html).toContain('Who is betting?')
    })

    it('hides the form once betting is closed and renders nothing when shut', () => {
        const html = render(<BetSheet isOpen onClose={() => {}} marketId="k" player1={users[0]} player2={users[1]} users={users} wallets={wallets} bets={[]} prob1={0.9} closed adminToken="t" />)
        expect(html).toContain('Betting is closed at match point.')
        expect(html).not.toContain('Who is betting?')
        expect(render(<BetSheet isOpen={false} users={users} wallets={[]} bets={[]} />)).toBe('')
    })

    it('lists live bets, balances and settled results on the Bets page', () => {
        const settled = { ...pending, id: 'b2', market_id: 'k2', status: 'won', payout: 143, snapshot: { bestOf: 1, score1: 5, score2: 3 } }
        const page = tab => render(<BetsView users={users} wallets={wallets} markets={[market, { ...market, id: 'k2', status: 'settled', winner_side: 1 }]} bets={[pending, settled]} isAdmin adminToken="t" initialTab={tab} />)
        const html = page('standings') + page('history')
        expect(page('standings')).not.toContain('beat Bor')
        expect(page('awards')).toContain('Jackpot')
        expect(page('awards')).toContain('Won +43 with one bet')
        expect(html).toContain('Ana vs Bor')
        expect(html).toContain('Refund all')
        expect(html).toContain('1 bet · 100 points riding')
        expect(html).toContain('>Ana</span> beat Bor')
        expect(html).toContain('at 5–3')
        expect(html).toContain('+43')
        expect(html).not.toContain('No bets yet')
    })

    it('shows payouts to everyone on the Bets page', () => {
        const payouts = [{ id: 'p1', user_id: 'c', amount: 500, balance_before: 1500, balance_after: 1000, note: 'lunch', created_at: '2026-11-23T10:00:00Z' }]
        const page = tab => render(<BetsView users={users} wallets={wallets} markets={[]} bets={[pending]} payouts={payouts} initialTab={tab} />)
        expect(page('payouts')).toContain('500 points cashed out in 1 payout')
        expect(page('payouts')).toContain('lunch')
        expect(page('standings')).toContain('cashed out 500')
        expect(render(<BetsView users={users} wallets={wallets} markets={[]} bets={[]} initialTab="payouts" />)).toContain('No payouts yet')
    })

    it('shows the live score and lets any phone bet on it', () => {
        const live = { id: 'k', player1_id: 'a', player2_id: 'b', best_of: 3, games1: 1, games2: 0, score1: 7, score2: 4, sets: [{ s1: 11, s2: 9 }], server: 2, win_probability: 0.8, betting_closed: false, winner_side: null, updated_at: new Date().toISOString() }
        const html = render(<BetsView users={users} wallets={wallets} markets={[market]} bets={[pending]} liveMatches={[live]} initialTab="standings" />)
        expect(html).toContain('Ana 7, Bor 4, games 1-0')
        expect(html).toContain('Games 1–0 · best of 3')
        expect(html).toContain('Serving')
        expect(html).toContain('80%')
        expect(html).toContain('Place a bet')
        expect(html).toContain('Bet from any phone')
        // The open market belongs to the live match, so it is not shown twice.
        expect(html).not.toContain('Bets waiting')

        const closed = render(<BetsView users={users} wallets={wallets} markets={[]} bets={[]} liveMatches={[{ ...live, betting_closed: true }]} />)
        expect(closed).toContain('Betting closed')
        expect(closed).toContain('Match point · betting closed')

        // A phone that went quiet long ago no longer shows as live.
        const stale = render(<BetsView users={users} wallets={wallets} markets={[market]} bets={[pending]} liveMatches={[{ ...live, updated_at: '2026-01-01T00:00:00Z' }]} isAdmin adminToken="t" />)
        expect(stale).not.toContain('Place a bet')
        expect(stale).toContain('Bets waiting')
        expect(stale).toContain('Refund all')
    })

    it('a bet sheet on another phone shows the score and cannot remove bets', () => {
        const html = render(<BetSheet isOpen remote onClose={() => {}} marketId="k" player1={users[0]} player2={users[1]} users={users} wallets={wallets} bets={[pending]} prob1={0.7} closed={false} scoreboard={<div>SCOREBOARD</div>} />)
        expect(html).toContain('SCOREBOARD')
        expect(html).toContain('Odds move with every point')
        expect(html).not.toContain('Remove Cene bet')
        expect(html).toContain('Who is betting?')
    })

    it('marks a match in the history with its bets, once per match', () => {
        const matches = [
            { id: 'm2', player1_id: 'a', player2_id: 'b', score1: 11, score2: 8, created_at: '2026-11-12T10:20:00Z' },
            { id: 'm1', player1_id: 'a', player2_id: 'b', score1: 11, score2: 6, created_at: '2026-11-12T10:20:00Z' },
            { id: 'm0', player1_id: 'a', player2_id: 'c', score1: 11, score2: 6, created_at: '2026-11-11T10:20:00Z' },
        ]
        const markets = [{ ...market, status: 'settled', winner_side: 1, match_ids: ['m1', 'm2'] }]
        const bets = [{ ...pending, status: 'won', payout: 143 }, { ...pending, id: 'b3', user_id: 'b', side: 2, stake: 50, status: 'lost' }, { ...pending, id: 'b4', status: 'void' }]
        const html = render(<Matches matches={matches} users={users} betMarkets={markets} bets={bets} />)
        expect(html.match(/Show bets/g)).toHaveLength(1)
        expect(html).toContain('2 bets, 150 points')
        expect(render(<Matches matches={matches} users={users} />)).not.toContain('Show bets')
    })
})

describe('house screen renders', () => {
    it('shows what the house won and paid, and an editable balance per player', () => {
        const settled = [
            { id: 'l1', market_id: 'k', user_id: 'a', side: 2, stake: 200, multiplier: '2.00', status: 'lost', payout: 0, created_at: '2026-11-12T10:00:00Z' },
            { id: 'w1', market_id: 'k', user_id: 'c', side: 1, stake: 100, multiplier: '1.50', status: 'won', payout: 150, created_at: '2026-11-12T10:01:00Z' },
        ]
        const html = render(<HouseView users={users} wallets={wallets} bets={settled} adminToken="t" />)
        expect(html).toContain('Won from losses')
        expect(html).toContain('+200')
        expect(html).toContain('−50')
        expect(html).toContain('+150')
        expect(html).toContain('aria-label="Points for Cene"')
        expect(html).toContain('value="900"')
        expect(html).toContain('value="1000"')
        expect(html).toContain('aria-label="Add 1,000 points for Cene"')
        expect(html).toContain('+1,000')
        expect(html).toContain('Points history')
        expect(html).toContain('No point edits or payouts yet')
    })

    it('lists every point edit, newest first, with a running count', () => {
        const usersById = Object.fromEntries(users.map(user => [user.id, user]))
        const adjustments = Array.from({ length: 25 }, (_, i) => ({
            id: 25 - i, user_id: i % 2 ? 'a' : 'c', old_balance: 0, new_balance: 100 + i, created_at: '2026-11-23T10:00:00Z',
        }))
        const html = renderToStaticMarkup(<EditHistory adjustments={adjustments} users={users} usersById={usersById} />)
        expect(html).toContain('25 edits')
        expect(html).toContain('0 → 100')
        expect(html).toContain('All players')
        expect(html).toContain('Show 5 more')
        expect(html).not.toContain('0 → 124')
    })

    it('mixes payouts into the points history and totals them', () => {
        const usersById = Object.fromEntries(users.map(user => [user.id, user]))
        const adjustments = [{ id: 1, user_id: 'c', old_balance: 0, new_balance: 1000, created_at: '2026-11-23T09:00:00Z' }]
        const payouts = [{ id: 'p1', user_id: 'a', amount: 400, balance_before: 1400, balance_after: 1000, note: 'cash', created_at: '2026-11-23T11:00:00Z' }]
        const html = renderToStaticMarkup(<EditHistory adjustments={adjustments} payouts={payouts} users={users} usersById={usersById} />)
        expect(html).toContain('1 edit · net +1000 points · 1 payout · 400 paid out')
        expect(html).toContain('Payout')
        expect(html).toContain('1,400 → 1,000')
        expect(html.indexOf('>Ana<')).toBeLessThan(html.indexOf('>Cene<'))
        const house = render(<HouseView users={users} wallets={wallets} bets={[]} payouts={payouts} adminToken="t" />)
        expect(house).toContain('Cashed out')
        expect(house).toContain('aria-label="Pay out points for Cene"')
    })
})
