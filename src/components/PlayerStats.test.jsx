// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import PlayerStats from './PlayerStats'

vi.mock('../supabaseClient', () => ({ supabase: {} }))
vi.mock('../utils', async importOriginal => ({ ...await importOriginal(), getActiveDebuffs: async () => [] }))
vi.mock('./TrophyCase', () => ({ default: () => null }))
vi.mock('recharts', async importOriginal => ({ ...await importOriginal(), ResponsiveContainer: () => null }))

afterEach(cleanup)

it('uses all seasons for the best streak and current deuce rate while filtering serve results', async () => {
    const users = [{ id: 'a', name: 'Ana', elo_rating: 1200 }, { id: 'b', name: 'Bor', elo_rating: 1200 }]
    const debuff = { title: 'One Hand', targetPlayerId: 'a' }
    const wins = Array.from({ length: 5 }, (_, i) => ({
        id: `win-${i}`, created_at: `2020-01-0${i + 1}T12:00:00.123001Z`, season_id: 1,
        player1_id: 'a', player2_id: 'b', score1: 12, score2: 10,
        handicap_rule: i === 0 ? [debuff, debuff] : null,
    }))
    const loss = {
        id: 'loss', created_at: '2020-01-05T12:00:00.123002Z', season_id: 2,
        player1_id: 'a', player2_id: 'b', score1: 10, score2: 12,
        point_history: [{ winner: 2, server: 1 }, { winner: 1, server: 2 }],
    }
    render(<PlayerStats users={users} matches={[loss]} allTimeMatches={[loss, ...wins]} seasonId={2} initialPlayerId="a" />)
    await waitFor(() => expect(screen.getByText('All-Time Achievements')).toBeTruthy())
    expect(screen.getByText('Best streak · 5')).toBeTruthy()
    expect(screen.getByText('83.3% (5/6)')).toBeTruthy()
    expect(screen.getByText('80%+ win rate in deuce games (min 5)')).toBeTruthy()
    expect(screen.getByText('0 of 1 tracked points won')).toBeTruthy()
    expect(screen.getByText('1 of 1 tracked points won')).toBeTruthy()
    expect(screen.queryByText('One Hand Master')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByText('No serve data for this period.')).toBeTruthy()
    expect(screen.getByText('Best streak · 5')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Debuff Wins' }))
    expect(screen.getByText('One Hand Master')).toBeTruthy()
    expect(screen.getByText('1 win')).toBeTruthy()
    expect(screen.queryByText('On Fire')).toBeNull()
})
