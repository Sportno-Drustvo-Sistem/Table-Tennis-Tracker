import { describe, expect, it } from 'vitest'
import {
    allowedSides,
    betMultiplier,
    buildBettingLeaderboard,
    describeBetResults,
    isBettingClosed,
    netResults,
    potentialPayout,
    walletBalance,
} from './bettingUtils'

describe('betMultiplier', () => {
    it('is one over the win probability, to two decimals', () => {
        expect(betMultiplier(0.5)).toBe(2)
        expect(betMultiplier(0.25)).toBe(4)
        expect(betMultiplier(0.7)).toBe(1.43)
        expect(betMultiplier(0.8)).toBe(1.25)
    })

    it('stays between 1.05x and 10x', () => {
        expect(betMultiplier(0.99)).toBe(1.05)
        expect(betMultiplier(1)).toBe(1.05)
        expect(betMultiplier(0.05)).toBe(10)
        expect(betMultiplier(0)).toBe(10)
    })

    it('rounds payouts to whole points', () => {
        expect(potentialPayout(100, 1.43)).toBe(143)
        expect(potentialPayout(15, 1.05)).toBe(16)
    })
})

describe('isBettingClosed', () => {
    it('closes at match point and when the match is over', () => {
        expect(isBettingClosed({ score1: 10, score2: 8, bestOf: 1 })).toBe(true)
        expect(isBettingClosed({ score1: 11, score2: 12, bestOf: 1 })).toBe(true)
        expect(isBettingClosed({ score1: 3, score2: 2, bestOf: 1, matchWinner: 1 })).toBe(true)
        expect(isBettingClosed({ score1: 10, score2: 4, games1: 1, games2: 0, bestOf: 3 })).toBe(true)
    })

    it('stays open otherwise, including game point that cannot end the match', () => {
        expect(isBettingClosed({})).toBe(false)
        expect(isBettingClosed({ score1: 9, score2: 9, bestOf: 1 })).toBe(false)
        expect(isBettingClosed({ score1: 10, score2: 10, bestOf: 1 })).toBe(false)
        expect(isBettingClosed({ score1: 10, score2: 4, games1: 0, games2: 1, bestOf: 3 })).toBe(false)
        expect(isBettingClosed({ score1: 11, score2: 4, games1: 1, games2: 1, bestOf: 5, gameWinner: 1 })).toBe(false)
    })
})

describe('bettors', () => {
    it('lets players in the match back only themselves', () => {
        expect(allowedSides('a', 'a', 'b')).toEqual([1])
        expect(allowedSides('b', 'a', 'b')).toEqual([2])
        expect(allowedSides('c', 'a', 'b')).toEqual([1, 2])
    })

    it('treats a missing wallet as the starting balance', () => {
        expect(walletBalance([{ user_id: 'a', balance: 40 }], 'a')).toBe(40)
        expect(walletBalance([], 'a')).toBe(1000)
    })
})

describe('results', () => {
    const users = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bor' }, { id: 'c', name: 'Cene' }]
    const bets = [
        { user_id: 'a', status: 'won', stake: 100, payout: 250 },
        { user_id: 'a', status: 'lost', stake: 30, payout: 0 },
        { user_id: 'b', status: 'lost', stake: 50, payout: 0 },
        { user_id: 'b', status: 'pending', stake: 20, payout: 0 },
        { user_id: 'b', status: 'void', stake: 500, payout: 0 },
    ]

    it('nets settled bets per bettor', () => {
        expect(netResults(bets)).toEqual([{ userId: 'a', net: 120 }, { userId: 'b', net: -50 }])
        expect(describeBetResults(bets, { a: users[0], b: users[1] })).toBe('Bets · Ana +120 · Bor −50')
        expect(describeBetResults([], {})).toBe('')
    })

    it('ranks bettors by balance ahead of players who never bet', () => {
        const wallets = [{ user_id: 'a', balance: 1120, rebuys: 0 }, { user_id: 'b', balance: 930, rebuys: 1 }]
        const board = buildBettingLeaderboard(users, wallets, bets)
        expect(board.map(row => row.user.id)).toEqual(['a', 'b', 'c'])
        expect(board[0]).toMatchObject({ balance: 1120, won: 1, lost: 1, profit: 120, biggestWin: 150 })
        expect(board[1]).toMatchObject({ balance: 930, rebuys: 1, profit: -50, pending: 20 })
        expect(board[2]).toMatchObject({ balance: 1000, hasBet: false })
    })
})
