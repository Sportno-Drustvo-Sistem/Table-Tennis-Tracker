// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

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
const winGame = name => { for (let i = 0; i < 11; i++) click(`${name}: Winner`) }

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', { getItem: () => 'off', setItem() {} })
    recordPingPongMatch.mockResolvedValue({ match: { id: 'saved' }, changes: {} })
})
afterEach(cleanup)

describe('live rally scoring', () => {
    it('requires the first server, attributes errors correctly, and undoes the score and stats', () => {
        mount(<LiveMatchModal {...props} />)
        expect(screen.queryByRole('button', { name: 'Ana: Winner' })).toBeNull()
        click('Ana Serves first')
        expect(screen.getByRole('button', { name: 'Bor: Ace' }).disabled).toBe(true)
        click('Ana: Ace'); score(1, 0)
        click('Ana: Serve fault (point to opponent)'); score(1, 1)
        expect(screen.getByRole('button', { name: 'Ana: Ace' }).disabled).toBe(true)
        click('Bor: Smash'); score(1, 2)
        click('Ana: Unforced error (point to opponent)'); score(1, 3)
        fireEvent.click(screen.getByText('Point stats & progression'))
        fireEvent.click(screen.getByText('Game 1 · Score progression'))
        expect(screen.getByRole('list', { name: 'Game 1 score progression' }).children).toHaveLength(4)
        click('Undo'); score(1, 2)
        expect(screen.getByRole('list', { name: 'Game 1 score progression' }).children).toHaveLength(3)
    })

    it('preserves histories across games, alternates first service, and undoes across a game boundary', () => {
        mount(<LiveMatchModal {...props} />)
        click('Best of 3'); click('Ana Serves first'); winGame('Ana')
        click('Start game 2'); score(0, 0)
        expect(screen.getByRole('button', { name: 'Ana: Ace' }).disabled).toBe(true)
        expect(screen.getByRole('button', { name: 'Bor: Ace' }).disabled).toBe(false)
        click('Undo'); score(10, 0)
        click('Ana: Winner'); click('Start game 2'); winGame('Ana')
        expect(screen.getByRole('button', { name: 'Save Match' })).toBeTruthy()
        fireEvent.click(screen.getByText('Point stats & progression'))
        expect(screen.getByText('Game 1 · Score progression')).toBeTruthy()
        expect(screen.getByText('Game 2 · Score progression')).toBeTruthy()
    })

    it('can undo the final point and saves every rally, including its pre-point server', async () => {
        mount(<LiveMatchModal {...props} />)
        click('Ana Serves first'); winGame('Ana')
        click('Undo final point'); score(10, 0)
        click('Ana: Smash'); click('Save Match')
        await waitFor(() => expect(recordPingPongMatch).toHaveBeenCalledOnce())
        const payload = recordPingPongMatch.mock.calls[0][1]
        expect(payload.sets[0]).toMatchObject({ s1: 11, s2: 0 })
        expect(payload.sets[0].points).toHaveLength(11)
        expect(payload.sets[0].points.map(p => p.server)).toEqual([1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2])
        expect(payload.sets[0].points.at(-1)).toEqual({ winner: 1, server: 2, type: 'smash' })
    })

    it('reopens saved progression and stats from match history without inventing legacy data', () => {
        const match = { id: 'm', player1_id: 'a', player2_id: 'b', score1: 11, score2: 0, created_at: '2026-11-16T10:00:00Z', point_history: [{ winner: 1, server: 1, type: 'ace' }] }
        mount(<Matches matches={[match, { ...match, id: 'old', point_history: null }]} users={players} />)
        expect(screen.getAllByRole('button', { name: 'Point stats for Ana vs Bor' })).toHaveLength(1)
        click('Point stats for Ana vs Bor')
        expect(screen.getAllByText('1/1 (100%)')).toHaveLength(1)
        fireEvent.click(screen.getByText('Game 1 · Score progression'))
        expect(screen.getByText('Ana · Ace')).toBeTruthy()
    })
})
