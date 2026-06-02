import { describe, expect, it } from 'vitest'
import { getTennisScoreSummary, validateTennisSets } from './tennisUtils'

describe('tennis score helpers', () => {
    it('detects a best-of-3 winner by sets instead of total games', () => {
        const match = {
            sets_data: [
                { player1Games: 6, player2Games: 0 },
                { player1Games: 6, player2Games: 7, player1Tiebreak: 5, player2Tiebreak: 7 },
                { player1Games: 0, player2Games: 6 },
            ],
        }

        expect(getTennisScoreSummary(match)).toMatchObject({
            player1Sets: 1,
            player2Sets: 2,
            player1Games: 12,
            player2Games: 13,
            winner: 2,
        })
    })

    it('accepts normal, 7-5, and tiebreak sets', () => {
        const validation = validateTennisSets([
            { player1Games: 6, player2Games: 4 },
            { player1Games: 5, player2Games: 7 },
            { player1Games: 7, player2Games: 6, player1Tiebreak: 7, player2Tiebreak: 4 },
        ])

        expect(validation).toMatchObject({
            valid: true,
            summary: {
                player1Sets: 2,
                player2Sets: 1,
                winner: 1,
            },
        })
    })

    it('rejects tied sets and 7-6 sets without tiebreak details', () => {
        expect(validateTennisSets([{ player1Games: 6, player2Games: 6 }])).toMatchObject({
            valid: false,
            message: 'A tennis set cannot be saved tied.',
        })

        expect(validateTennisSets([{ player1Games: 7, player2Games: 6 }])).toMatchObject({
            valid: false,
            message: 'A 7-6 set needs a valid tiebreak score.',
        })
    })
})
