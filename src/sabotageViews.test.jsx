import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./supabaseClient', () => ({ supabase: {} }))

import SabotageView, { SabotageSheet } from './components/SabotageShop'
import { ToastContextValue } from './contexts/ToastContextValue'

const users = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bor' }, { id: 'c', name: 'Cene' }]
const wallets = [{ id: 'w1', user_id: 'c', balance: 900, rebuys: 0 }]
const items = [{ id: 'half_table', title: 'Half table', description: 'One half only.', price_per_point: 30, max_points: 5 }]
const live = { id: 'm', player1_id: 'a', player2_id: 'b', best_of: 1, games1: 0, games2: 0, score1: 2, score2: 1, sets: [], server: 1, win_probability: 0.6, updated_at: new Date().toISOString() }
const bought = { id: 's1', live_match_id: 'm', buyer_id: 'c', target_id: 'b', item_id: 'half_table', title: 'Half table', description: 'One half only.', points: 3, price: 90, start_point: 2, end_point: 5, created_at: '2026-11-17T10:00:00Z' }
const render = node => renderToStaticMarkup(
    <ToastContextValue.Provider value={{ showToast() {}, showConfirm() {} }}>{node}</ToastContextValue.Provider>
)

describe('sabotage screens render', () => {
    it('shows the live match, the running debuff, the menu and the history', () => {
        const html = render(<SabotageView users={users} wallets={wallets} items={items} sabotages={[bought]} liveMatches={[live]} />)
        expect(html).toContain('Buy a debuff')
        expect(html).toContain('Bor: Half table')
        expect(html).toContain('points left')
        expect(html).toContain('per point · up to 5')
        expect(html).toContain('Recent sabotage')
        expect(html).toContain('Top saboteur')
    })

    it('says when nothing is live', () => {
        const html = render(<SabotageView users={users} wallets={wallets} items={items} sabotages={[]} liveMatches={[]} />)
        expect(html).toContain('No match is live right now')
        expect(html).toContain('Nobody has been sabotaged yet.')
    })

    it('lists payers with balances, both players and the debuffs for sale', () => {
        const html = render(<SabotageSheet live={live} users={users} wallets={wallets} items={items} onClose={() => {}} />)
        expect(html).toContain('Who is paying?')
        expect(html).toContain('>900<')
        expect(html).toContain('Who gets it?')
        expect(html).toContain('30/pt')
        expect(html).toContain('3 points')
    })
})
