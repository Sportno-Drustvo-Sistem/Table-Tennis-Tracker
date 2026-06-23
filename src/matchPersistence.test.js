import { describe, expect, it } from 'vitest'
import {
    buildPadelRecordParams,
    buildPingPongRecordParams,
    buildTennisRecordParams,
    recordPingPongMatch,
} from './matchPersistence'

describe('match persistence RPC helpers', () => {
    it('builds ping pong RPC params from one or more saved sets', () => {
        expect(buildPingPongRecordParams({
            player1Id: 'p1',
            player2Id: 'p2',
            sets: [{ s1: 11, s2: 8 }, { s1: 9, s2: 11 }],
            handicapRule: [{ type: 'streak', targetPlayerId: 'p1', trigger_value: 8 }],
            tournamentId: 't1',
        })).toEqual({
            p_player1_id: 'p1',
            p_player2_id: 'p2',
            p_sets: [{ s1: 11, s2: 8 }, { s1: 9, s2: 11 }],
            p_handicap_rule: [{ type: 'streak', targetPlayerId: 'p1', trigger_value: 8 }],
            p_tournament_id: 't1',
        })
    })

    it('builds padel RPC params with teams, match format, and set data', () => {
        expect(buildPadelRecordParams({
            team1: ['a', 'b'],
            team2: ['c', 'd'],
            score1: 13,
            score2: 9,
            matchFormat: 'best_of_3',
            setsData: [{ team1Games: 6, team2Games: 4 }, { team1Games: 7, team2Games: 5 }],
        })).toEqual({
            p_team1_player1_id: 'a',
            p_team1_player2_id: 'b',
            p_team2_player1_id: 'c',
            p_team2_player2_id: 'd',
            p_score1: 13,
            p_score2: 9,
            p_match_format: 'best_of_3',
            p_sets_data: [{ team1Games: 6, team2Games: 4 }, { team1Games: 7, team2Games: 5 }],
        })
    })

    it('builds tennis RPC params with match format and set data', () => {
        expect(buildTennisRecordParams({
            player1Id: 'p1',
            player2Id: 'p2',
            score1: 12,
            score2: 7,
            matchFormat: 'best_of_3',
            setsData: [{ player1Games: 6, player2Games: 3 }, { player1Games: 6, player2Games: 4 }],
        })).toEqual({
            p_player1_id: 'p1',
            p_player2_id: 'p2',
            p_score1: 12,
            p_score2: 7,
            p_match_format: 'best_of_3',
            p_sets_data: [{ player1Games: 6, player2Games: 3 }, { player1Games: 6, player2Games: 4 }],
        })
    })

    it('calls the ping pong record RPC and normalizes the response', async () => {
        const client = {
            rpc: async (name, params) => ({
                data: {
                    match: { id: 'm1', score1: 11, score2: 8 },
                    matches: [{ id: 'm1', score1: 11, score2: 8 }],
                    changes: { p1: 12, p2: -12 },
                },
                error: null,
                name,
                params,
            }),
        }

        const result = await recordPingPongMatch(client, {
            player1Id: 'p1',
            player2Id: 'p2',
            sets: [{ s1: 11, s2: 8 }],
            handicapRule: null,
            tournamentId: null,
        })

        expect(result).toEqual({
            match: { id: 'm1', score1: 11, score2: 8 },
            matches: [{ id: 'm1', score1: 11, score2: 8 }],
            changes: { p1: 12, p2: -12 },
        })
    })
})
