import { describe, expect, it } from 'vitest'
import { getPadelScoreSummary, validatePadelSets } from './padelUtils'

describe('padel score helpers', () => {
    it('uses set wins, not total games, to determine a multi-set winner', () => {
        const match = {
            score1: 17,
            score2: 18,
            sets_data: [
                { team1Games: 6, team2Games: 0 },
                { team1Games: 5, team2Games: 7 },
                { team1Games: 6, team2Games: 11 },
            ],
        }

        expect(getPadelScoreSummary(match)).toMatchObject({
            team1Sets: 1,
            team2Sets: 2,
            team1Games: 17,
            team2Games: 18,
            winner: 2,
        })
    })

    it('rejects empty and tied set scores before saving', () => {
        expect(validatePadelSets([{ team1Games: 0, team2Games: 0 }])).toEqual({
            valid: false,
            message: 'Enter at least one completed set score.',
        })

        expect(validatePadelSets([{ team1Games: 6, team2Games: 6 }])).toEqual({
            valid: false,
            message: 'Each saved set needs a clear winner.',
        })
    })
})
