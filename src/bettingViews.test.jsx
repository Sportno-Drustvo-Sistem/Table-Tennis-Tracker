import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./supabaseClient', () => ({ supabase: {} }))

import BetSheet from './components/BetSheet'
import BetsView from './components/BetsView'
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
        expect(html).toContain('>143<')
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
        const html = render(<BetsView users={users} wallets={wallets} markets={[market, { ...market, id: 'k2', status: 'settled', winner_side: 1 }]} bets={[pending, settled]} isAdmin adminToken="t" />)
        expect(html).toContain('Ana vs Bor')
        expect(html).toContain('Refund all')
        expect(html).toContain('1 bet · 100 points riding')
        expect(html).toContain('>Ana</span> beat Bor')
        expect(html).toContain('at 5–3')
        expect(html).toContain('+43')
        expect(html).toContain('No bets yet')
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
