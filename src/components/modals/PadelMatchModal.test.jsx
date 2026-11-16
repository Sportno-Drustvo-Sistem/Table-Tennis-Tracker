// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PadelMatchModal from './PadelMatchModal'
import PadelMatches from '../PadelMatches'
import { recordPadelMatch } from '../../matchPersistence'

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }))
vi.mock('../../supabaseClient', () => ({ supabase: {} }))
vi.mock('../../matchPersistence', () => ({ recordPadelMatch: vi.fn() }))
vi.mock('../../contexts/useToast', () => ({ useToast: () => ({ showToast }) }))

const users = ['Alice', 'Bob', 'Cara', 'Dan', 'Eva'].map((name, i) => ({ id: `profile-${i}`, name }))
const mount = (props = {}) => {
    const onMatchSaved = vi.fn()
    const view = render(<PadelMatchModal isOpen importOnly users={users} adminToken="test-token" onClose={vi.fn()} onMatchSaved={onMatchSaved} {...props} />)
    return { ...view, onMatchSaved }
}
const upload = async (count = 2) => {
    const text = JSON.stringify({ Zapps: [{ Zapp: { Name: 'Tracker Padel', SummaryOutputs:
        ['q1', 'q2', 'q3', 'q4'].map((Id, i) => ({ Id, SummaryValue: i ? 0 : 1 + (count === 2 ? 4096 * 8 : 0) }))
    } }] })
    fireEvent.change(screen.getByLabelText('Import Suunto padel scores'), { target: { files: [{ name: 'workout.json', size: text.length, text: async () => text }] } })
    await screen.findByRole('button', { name: 'Save match 1' })
}
const assign = (ids = ['profile-0', 'profile-1', 'profile-2', 'profile-3']) => {
    ids.forEach((id, i) => fireEvent.change(screen.getByLabelText(`Player ${i + 1} profile`), { target: { value: id } }))
}

afterEach(cleanup)
beforeEach(() => { vi.clearAllMocks(); vi.mocked(recordPadelMatch).mockResolvedValue(undefined) })

describe('standalone Suunto profile assignment', () => {
    it('opens the import flow from Matches only in admin mode', () => {
        const onImportWorkout = vi.fn()
        const view = render(<PadelMatches matches={[]} users={users} isAdmin onImportWorkout={onImportWorkout} />)
        fireEvent.click(screen.getByRole('button', { name: 'Import Suunto workout' }))
        expect(onImportWorkout).toHaveBeenCalledOnce()
        view.rerender(<PadelMatches matches={[]} users={users} isAdmin={false} onImportWorkout={onImportWorkout} />)
        expect(screen.queryByRole('button', { name: 'Import Suunto workout' })).toBeNull()
    })
    it('opens without teams and waits for upload before assigning profiles', async () => {
        mount()
        expect(screen.getByRole('button', { name: 'Finish Match' }).disabled).toBe(true)
        expect(screen.queryByLabelText('Player 1 profile')).toBeNull()
        await upload()
        expect(screen.getByLabelText('Player 1 profile').value).toBe('')
        expect(screen.getByRole('button', { name: 'Save match 1' }).disabled).toBe(true)
        expect(recordPadelMatch).not.toHaveBeenCalled()
    })
    it('requires four distinct profiles and saves each match with its own watch positions', async () => {
        const { onMatchSaved } = mount()
        await upload()
        assign()
        expect([...screen.getByLabelText('Player 2 profile').options].map(option => option.value)).not.toContain('profile-0')
        fireEvent.click(screen.getByRole('button', { name: 'Save match 1' }))
        await waitFor(() => expect(onMatchSaved).toHaveBeenCalledWith({ keepOpen: true }))
        expect(recordPadelMatch.mock.calls[0][1]).toMatchObject({ team1: ['profile-0', 'profile-1'], team2: ['profile-2', 'profile-3'], setsData: [{ team1Games: 6, team2Games: 0 }] })
        expect(screen.getByRole('button', { name: 'Match 1 · Saved' }).disabled).toBe(true)
        expect(screen.getByRole('button', { name: 'Save match 2' }).disabled).toBe(true)
        assign(['profile-4', 'profile-3', 'profile-1', 'profile-0'])
        fireEvent.click(screen.getByRole('button', { name: 'Save match 2' }))
        await waitFor(() => expect(onMatchSaved).toHaveBeenCalledWith({ keepOpen: false }))
        expect(recordPadelMatch.mock.calls[1][1]).toMatchObject({ team1: ['profile-4', 'profile-3'], team2: ['profile-1', 'profile-0'], setsData: [{ team1Games: 0, team2Games: 6 }] })
    })
    it('preserves separate profile drafts when switching unsaved matches', async () => {
        mount()
        await upload()
        assign()
        fireEvent.click(screen.getByRole('button', { name: 'Match 2', exact: true }))
        expect(screen.getByLabelText('Player 1 profile').value).toBe('')
        assign(['profile-4', 'profile-3', 'profile-1', 'profile-0'])
        fireEvent.click(screen.getByRole('button', { name: 'Match 1', exact: true }))
        expect(screen.getByLabelText('Player 1 profile').value).toBe('profile-0')
        fireEvent.click(screen.getByRole('button', { name: 'Match 2', exact: true }))
        expect(screen.getByLabelText('Player 1 profile').value).toBe('profile-4')
    })
    it('keeps profile mappings and unsaved results available after a save failure', async () => {
        vi.mocked(recordPadelMatch).mockRejectedValueOnce(new Error('Save failed'))
        const { onMatchSaved } = mount()
        await upload(1)
        assign()
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        try {
            fireEvent.click(screen.getByRole('button', { name: 'Save match 1' }))
            await waitFor(() => expect(showToast).toHaveBeenCalledWith('Error saving padel match: Save failed', 'error'))
            expect(onMatchSaved).not.toHaveBeenCalled()
            expect(screen.getByLabelText('Player 1 profile').value).toBe('profile-0')
            expect(screen.getByRole('button', { name: 'Save match 1' }).disabled).toBe(false)
            fireEvent.click(screen.getByRole('button', { name: 'Save match 1' }))
            await waitFor(() => expect(onMatchSaved).toHaveBeenCalledWith({ keepOpen: false }))
        } finally { consoleError.mockRestore() }
    })
    it('retains ordinary manual match recording with preselected profiles', () => {
        mount({ importOnly: false, team1: users.slice(0, 2), team2: users.slice(2, 4) })
        expect(screen.queryByLabelText('Import Suunto padel scores')).toBeNull()
        expect(screen.getByLabelText('Player 1 profile').value).toBe('profile-0')
        expect(screen.getByRole('button', { name: 'Finish Match' }).disabled).toBe(false)
    })
})
