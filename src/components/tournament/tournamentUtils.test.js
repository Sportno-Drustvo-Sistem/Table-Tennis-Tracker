import { describe, it, expect } from 'vitest'
import {
    generateSingleEliminationBracket,
    generateDoubleEliminationBracket,
    seedFromGroups,
    propagateAdvancements
} from './tournamentUtils'

const mockPlayers = [
    { id: '1', name: 'Player 1', elo_rating: 1500 },
    { id: '2', name: 'Player 2', elo_rating: 1400 },
    { id: '3', name: 'Player 3', elo_rating: 1300 },
    { id: '4', name: 'Player 4', elo_rating: 1200 },
    { id: '5', name: 'Player 5', elo_rating: 1100 },
    { id: '6', name: 'Player 6', elo_rating: 1000 },
]

describe('Tournament Utils - Single Elimination', () => {
    it('creates a proper 4-player bracket where Seed 1 faces Seed 4, and Seed 2 faces Seed 3', () => {
        // Participants are assumed to be sorted by Elo descending before being passed in
        const participants = mockPlayers.slice(0, 4)

        const bracket = generateSingleEliminationBracket(participants, false, [], {}, null)
        const round1 = bracket[0]

        expect(round1.name).toBe('Semi-Finals')
        expect(round1.matches).toHaveLength(2)

        // Match 0 should be 1v4
        expect(round1.matches[0].player1.id).toBe('1')
        expect(round1.matches[0].player2.id).toBe('4')

        // Match 1 should be 2v3
        expect(round1.matches[1].player1.id).toBe('2')
        expect(round1.matches[1].player2.id).toBe('3')
    })

    it('properly distributes byes in a 5-player bracket', () => {
        const participants = mockPlayers.slice(0, 5)
        const bracket = generateSingleEliminationBracket(participants, false, [], {}, null)

        // A 5-player bracket relies on an 8-slot bracket, meaning 3 byes.
        // They should be given to the top 3 seeds (Players 1, 2, and 3). 
        const round1 = bracket[0]
        expect(round1.matches).toHaveLength(4) // 8 slots / 2

        // Let's verify who got byes
        const byes = round1.matches.filter(m => m.isBye)
        expect(byes).toHaveLength(3)

        // Seed 1, 2, and 3 should have auto-advanced, wait let's just check the winners
        const winners = byes.map(m => m.winner.id).sort()
        expect(winners).toEqual(['1', '2', '3'])
    })
})

describe('Tournament Utils - Group Stage Seeding', () => {
    it('seeds a single group correctly (flat output from 1st to last)', () => {
        const groups = [
            {
                name: 'Group A',
                standings: [
                    { player: { id: '2' }, score: 2, pointDiff: 5 }, // 2nd
                    { player: { id: '1' }, score: 3, pointDiff: 10 }, // 1st
                    { player: { id: '3' }, score: 1, pointDiff: -2 }, // 3rd
                    { player: { id: '4' }, score: 0, pointDiff: -8 }  // 4th
                ]
            }
        ]

        const seeded = seedFromGroups(groups)
        expect(seeded.length).toBe(4)
        expect(seeded[0].id).toBe('1') // 1st
        expect(seeded[1].id).toBe('2') // 2nd
        expect(seeded[2].id).toBe('3') // 3rd
        expect(seeded[3].id).toBe('4') // 4th
    })

    it('seeds two groups in an interleaved serpentine fashion', () => {
        const groups = [
            {
                name: 'Group A',
                standings: [
                    { player: { id: 'A2' }, score: 2, pointDiff: 5 },
                    { player: { id: 'A1' }, score: 3, pointDiff: 10 },
                    { player: { id: 'A3' }, score: 1, pointDiff: -2 }
                ]
            },
            {
                name: 'Group B',
                standings: [
                    { player: { id: 'B1' }, score: 3, pointDiff: 8 },
                    { player: { id: 'B2' }, score: 2, pointDiff: 4 },
                    { player: { id: 'B3' }, score: 1, pointDiff: -5 }
                ]
            }
        ]

        const seeded = seedFromGroups(groups)
        expect(seeded.length).toBe(6)

        // Since we sort internally, the order should be: A1, B1, A2, B2, A3, B3
        expect(seeded[0].id).toBe('A1')
        expect(seeded[1].id).toBe('B1')
        expect(seeded[2].id).toBe('A2')
        expect(seeded[3].id).toBe('B2')
        expect(seeded[4].id).toBe('A3')
        expect(seeded[5].id).toBe('B3')
    })
})

describe('Tournament Utils - Infinite Bye Bug Regression', () => {
    it('does not auto-advance players waiting for opponents in Double Elimination', () => {
        // Scenario: A 5-player double elimination tournament.
        // Seed 1 gets a bye in R1, they should advance to WB R2. 
        // In WB R2, they wait for the winner of 4v5. 
        // The bug was that because Seed 1 is in WB R2 waiting (so opponent is null), 
        // the code wrongly thought it was ANOTHER bye, advancing them to WB R3.

        const participants = mockPlayers.slice(0, 5) // 5 players
        const bracket = generateDoubleEliminationBracket(participants, false, [], {}, null)

        const wbR1 = bracket.find(r => r.name === 'WB Round 1')
        const wbSemi = bracket.find(r => r.name === 'WB Semi-Finals')

        // WB R1 has 4 matches (8 slots). Players 1, 2, 3 should have byes. 
        expect(wbR1.matches.filter(m => m.isBye)).toHaveLength(3)

        // WB Semi-Finals has 2 matches.
        // Match 0 should have Player 1 (auto-advanced from R1) waiting. Player 2 should be null (waiting for 4v5 winner)
        const semiMatch1 = wbSemi.matches[0]

        expect(semiMatch1.player1?.id).toBe('1')
        expect(semiMatch1.player2).toBeNull() // Opponent hasn't arrived yet
        expect(semiMatch1.winner).toBeNull() // IMPORTANT: Winner must NOT be auto-assigned!!
        expect(semiMatch1.isBye).toBeFalsy() // It's not a bye, just an unplayed match
    })
})
