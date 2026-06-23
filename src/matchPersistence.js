export const buildPingPongRecordParams = ({ player1Id, player2Id, sets, handicapRule = null, tournamentId = null }) => ({
    p_player1_id: player1Id,
    p_player2_id: player2Id,
    p_sets: sets,
    p_handicap_rule: handicapRule,
    p_tournament_id: tournamentId,
})

export const buildPadelRecordParams = ({ team1, team2, score1, score2, matchFormat = 'best_of_3', setsData = [] }) => ({
    p_team1_player1_id: team1[0],
    p_team1_player2_id: team1[1],
    p_team2_player1_id: team2[0],
    p_team2_player2_id: team2[1],
    p_score1: score1,
    p_score2: score2,
    p_match_format: matchFormat,
    p_sets_data: setsData,
})

export const buildTennisRecordParams = ({ player1Id, player2Id, score1, score2, matchFormat = 'best_of_3', setsData = [] }) => ({
    p_player1_id: player1Id,
    p_player2_id: player2Id,
    p_score1: score1,
    p_score2: score2,
    p_match_format: matchFormat,
    p_sets_data: setsData,
})

const normalizeRecordResponse = (data) => ({
    match: data?.match || null,
    matches: data?.matches || (data?.match ? [data.match] : []),
    changes: data?.changes || {},
})

const callRecordRpc = async (client, functionName, params) => {
    const { data, error } = await client.rpc(functionName, params)
    if (error) throw error
    return normalizeRecordResponse(data)
}

export const recordPingPongMatch = (client, payload) => (
    callRecordRpc(client, 'record_pingpong_match', buildPingPongRecordParams(payload))
)

export const recordPadelMatch = (client, payload) => (
    callRecordRpc(client, 'record_padel_match', buildPadelRecordParams(payload))
)

export const recordTennisMatch = (client, payload) => (
    callRecordRpc(client, 'record_tennis_match', buildTennisRecordParams(payload))
)
