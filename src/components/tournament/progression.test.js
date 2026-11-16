import { describe, it, expect } from 'vitest'
import { generateDoubleEliminationBracket, propagateAdvancements, handleDoubleElimAdvancement } from './tournamentUtils'

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
            let played = 0
            while (played < count * 3) {
                const ready = rounds.flatMap(r => r.matches).filter(m => m.player1 && m.player2 && !m.winner)
                if (!ready.length) break
                const match = reverse ? ready.at(-1) : ready[0]
                expect(match.player1.id).not.toBe(match.player2.id)
                match.winner = played % 2 ? match.player2 : match.player1
                propagate(rounds)
                const before = JSON.stringify(rounds)
                propagate(rounds)
                expect(JSON.stringify(rounds)).toBe(before)
                played++
            }
            expect(rounds.at(-1).matches[0].winner).toBeTruthy()
            expect(played).toBe(2 * count - 2)
        })
    }
})
