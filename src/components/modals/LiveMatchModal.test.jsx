// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.hoisted(() => {
    window.speechSynthesis = { getVoices: () => [{ lang: 'en-US', name: 'Test' }], speak() {}, cancel() {} }
    window.AudioContext = class { state = 'running' }
    globalThis.SpeechSynthesisUtterance = class {}
    globalThis.Audio = class { play() { return Promise.resolve() } }
})
vi.mock('../../supabaseClient', () => ({ supabase: {} }))
vi.mock('../../utils', async importOriginal => ({ ...await importOriginal(), getActiveDebuffs: async () => [] }))
vi.mock('../../adminSession', () => ({ checkAdminSession: vi.fn() }))
vi.mock('../../matchPersistence', () => ({ recordPingPongMatch: vi.fn(), recordPingPongMatchWithBets: vi.fn() }))
vi.mock('../KeepAwake', () => ({ default: () => null }))

import LiveMatchModal from './LiveMatchModal'
import { ToastContextValue } from '../../contexts/ToastContextValue'
import { recordPingPongMatch } from '../../matchPersistence'
import Matches from '../Matches'

const players = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bor' }]
const props = { isOpen: true, player1: players[0], player2: players[1], matches: [], adminToken: 'token', onClose: vi.fn(), onMatchSaved: vi.fn() }
const showToast = vi.fn()
const mount = node => render(<ToastContextValue.Provider value={{ showToast, showConfirm: vi.fn() }}>{node}</ToastContextValue.Provider>)
const click = name => fireEvent.click(screen.getByRole('button', { name }))
const score = (a, b) => expect(screen.getByRole('group', { name: `Score: Ana ${a}, Bor ${b}` })).toBeTruthy()
const winGame = name => { for (let i = 0; i < 11; i++) click(`${name}: award point`) }
const isServing = name => expect(within(screen.getByRole('button', { name: `${name}: award point` })).getByText('Serving')).toBeTruthy()

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', { getItem: () => 'off', setItem() {} })
    recordPingPongMatch.mockResolvedValue({ match: { id: 'saved' }, changes: {} })
})
afterEach(cleanup)

describe('live point scoring', () => {
    it('requires the first server and restores the previous server when undoing a point', () => {
        mount(<LiveMatchModal {...props} />)
        expect(screen.queryByRole('button', { name: 'Ana: award point' })).toBeNull()
        click('Ana Serves first')
        click('Ana: award point'); score(1, 0)
        click('Bor: award point'); score(1, 1)
        click('Bor: award point'); score(1, 2)
        click('Ana: award point'); score(2, 2)
        isServing('Ana')
        click('Undo'); score(1, 2)
        isServing('Bor')
    })

    it('preserves histories across games, alternates first service, and undoes across a game boundary', async () => {
        mount(<LiveMatchModal {...props} />)
        click('Best of 3'); click('Ana Serves first'); winGame('Ana')
        click('Start game 2'); score(0, 0)
        isServing('Bor')
        click('Undo'); score(10, 0)
        click('Ana: award point'); click('Start game 2'); winGame('Ana')
        click('Save Match')
        await waitFor(() => expect(recordPingPongMatch).toHaveBeenCalledOnce())
        const { sets } = recordPingPongMatch.mock.calls[0][1]
        expect(sets.map(set => set.points.length)).toEqual([11, 11])
        expect(sets.map(set => set.points[0].server)).toEqual([1, 2])
    })

    it('can undo the final point and saves every winner and server', async () => {
        mount(<LiveMatchModal {...props} />)
        click('Ana Serves first'); winGame('Ana')
        click('Undo final point'); score(10, 0)
        click('Ana: award point'); click('Save Match')
        await waitFor(() => expect(recordPingPongMatch).toHaveBeenCalledOnce())
        const payload = recordPingPongMatch.mock.calls[0][1]
        expect(payload.sets[0]).toMatchObject({ s1: 11, s2: 0 })
        expect(payload.sets[0].points).toHaveLength(11)
        expect(payload.sets[0].points).toEqual([1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2].map(server => ({ winner: 1, server })))
    })

    it('reopens saved point progression from match history without inventing legacy data', () => {
        const match = { id: 'm', player1_id: 'a', player2_id: 'b', score1: 11, score2: 0, created_at: '2026-11-16T10:00:00Z', point_history: [1] }
        const annotated = { ...match, id: 'a', point_history: [{ winner: 1, server: 2 }] }
        mount(<Matches matches={[match, annotated, { ...match, id: 'old', point_history: null }]} users={players} />)
        const buttons = screen.getAllByRole('button', { name: 'Point-by-point history for Ana vs Bor' })
        expect(buttons).toHaveLength(2)
        fireEvent.click(buttons[0])
        fireEvent.click(screen.getByText('Game 1 · Score progression'))
        expect(screen.getByText('Point to Ana')).toBeTruthy()
        expect(screen.queryByText(/served/)).toBeNull()
        fireEvent.click(buttons[1])
        expect(screen.getByText(/Bor served/)).toBeTruthy()
    })
})
