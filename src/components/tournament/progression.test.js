import { describe, it, expect, vi } from 'vitest'
import { generateDoubleEliminationBracket, propagateAdvancements, handleDoubleElimAdvancement, checkTournamentComplete, getTournamentFinalMatch } from './tournamentUtils'

const players = n => Array.from({ length: n }, (_, i) => ({ id: String(i + 1) }))
const propagate = rounds => propagateAdvancements(rounds, false, [], {}, null)
describe('double elimination result propagation', () => {
    it('drops seed 4 once into its assigned slot', () => {
        const rounds = generateDoubleEliminationBracket(players(4), false, [], {}, null)
        const match = rounds[0].matches[0]
        match.winner = match.player1
        handleDoubleElimAdvancement({ rounds }, 0, 0, match.winner, match.player2, [], {}, null)
        propagate(rounds)
        const lb = rounds.find(r => r.bracket === 'losers').matches[0]
        expect(lb.player1.id).toBe('4')
        expect(lb.player2).toBeNull()
        expect(lb.winner).toBeNull()
        const before = JSON.stringify(rounds)
        propagate(rounds)
        expect(JSON.stringify(rounds)).toBe(before)
    })
    for (const count of [2, 4, 5, 8, 13]) for (const reverse of [false, true]) {
        it(`completes ${count} players, reverse order ${reverse}`, () => {
            const rounds = generateDoubleEliminationBracket(players(count), false, [], {}, null)
            const losses = new Map()
            let played = 0
            while (played < count * 3) {
                const ready = rounds.flatMap(r => r.matches).filter(m => m.player1 && m.player2 && !m.winner)
                if (!ready.length) break
                const match = reverse ? ready.at(-1) : ready[0]
                expect(match.player1.id).not.toBe(match.player2.id)
                match.winner = played % 2 ? match.player2 : match.player1
                const loser = match.winner.id === match.player1.id ? match.player2 : match.player1
                losses.set(loser.id, (losses.get(loser.id) || 0) + 1)
                propagate(rounds)
                const before = JSON.stringify(rounds)
                propagate(rounds)
                expect(JSON.stringify(rounds)).toBe(before)
                played++
            }
            const final = getTournamentFinalMatch({ rounds })
            expect(final.winner).toBeTruthy()
            expect(played).toBe(2 * count - (rounds.some(r => r.bracket === 'grand_final_reset') ? 1 : 2))
            for (const player of players(count)) {
                if (player.id === final.winner.id) expect(losses.get(player.id) || 0).toBeLessThan(2)
                else expect(losses.get(player.id)).toBe(2)
            }
        })
    }
})

const playToFinal = (count = 4) => {
    const tournament = {
        format: 'double_elim', status: 'active',
        rounds: generateDoubleEliminationBracket(players(count), false, [], {}, null)
    }
    for (const round of tournament.rounds) {
        if (round.bracket === 'grand_final') break
        for (const match of round.matches) {
            if (match.winner || match.isBye) continue
            expect(match.player1).toBeTruthy()
            expect(match.player2).toBeTruthy()
            match.winner = match.player1
            propagate(tournament.rounds)
        }
    }
    return tournament
}

const advance = tournament => handleDoubleElimAdvancement(tournament, 0, 0, null, null, [], {}, null)

describe('double elimination finals reset', () => {
    it('crowns the undefeated finalist after a single final win', () => {
        const tournament = playToFinal()
        const final = getTournamentFinalMatch(tournament)
        expect(checkTournamentComplete(tournament)).toBe(false)
        final.winner = final.player1
        expect(advance(tournament)).toBe(true)
        expect(tournament.status).toBe('completed')
        expect(getTournamentFinalMatch(tournament).winner.id).toBe(final.player1.id)
        expect(tournament.rounds.some(r => r.bracket === 'grand_final_reset')).toBe(false)
    })

    for (const count of [2, 3, 4, 5, 8, 13, 16]) for (const winnerSlot of ['player1', 'player2']) {
        it(`requires a deciding game for ${count} players, with ${winnerSlot} winning the reset`, () => {
            let tournament = playToFinal(count)
            const final = getTournamentFinalMatch(tournament)
            final.score1 = 8
            final.score2 = 11
            final.dbMatchId = 'first-final-result'
            final.winner = final.player2

            // A saved bracket without a reset must never be considered complete.
            expect(checkTournamentComplete(tournament)).toBe(false)
            expect(advance(tournament)).toBe(false)
            expect(tournament.status).toBe('active')
            const reset = getTournamentFinalMatch(tournament)
            expect(reset.id).toBe('grand_final_reset')
            expect(reset.player1.id).toBe(final.player1.id)
            expect(reset.player2.id).toBe(final.player2.id)
            expect(reset.winner).toBeNull()
            expect(reset.score1).toBeNull()
            expect(reset.score2).toBeNull()
            expect(reset.dbMatchId).toBeUndefined()
            expect(final.dbMatchId).toBe('first-final-result')

            // Repeating propagation and restoring local storage preserve one reset.
            const saved = JSON.stringify(tournament)
            expect(advance(tournament)).toBe(false)
            expect(JSON.stringify(tournament)).toBe(saved)
            tournament = JSON.parse(saved)
            const restoredReset = getTournamentFinalMatch(tournament)
            restoredReset.winner = restoredReset[winnerSlot]
            expect(advance(tournament)).toBe(true)
            expect(tournament.status).toBe('completed')
            const decidingFinal = getTournamentFinalMatch(tournament)
            expect(decidingFinal.winner.id).toBe(final[winnerSlot].id)
            const runnerUp = decidingFinal.winner.id === decidingFinal.player1.id ? decidingFinal.player2 : decidingFinal.player1
            expect(runnerUp.id).toBe(final[winnerSlot === 'player1' ? 'player2' : 'player1'].id)
            expect(tournament.rounds.filter(r => r.bracket === 'grand_final_reset')).toHaveLength(1)
        })
    }

    it('assigns fresh Mayhem debuffs to the reset only once', () => {
        const tournament = playToFinal()
        const final = getTournamentFinalMatch(tournament)
        final.winner = final.player2
        final.debuffs = { old: true }
        const assign = vi.fn(match => ({ ...match, debuffs: { fresh: true } }))
        propagateAdvancements(tournament.rounds, true, [], {}, assign)
        expect(getTournamentFinalMatch(tournament).debuffs).toEqual({ fresh: true })
        propagateAdvancements(tournament.rounds, true, [], {}, assign)
        expect(assign).toHaveBeenCalledTimes(1)
    })
})
