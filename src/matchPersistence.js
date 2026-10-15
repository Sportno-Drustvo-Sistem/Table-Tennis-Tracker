export const validPingPongScores = (a, b) => [a, b].every(value =>
    value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number.isInteger(Number(value)) && Number(value) >= 0
) && Number(a) !== Number(b)

const requireAdminToken = (adminToken) => {
    if (!adminToken) {
        throw new Error('Admin mode is required to save matches')
    }
    return adminToken
}

export const buildPingPongRecordParams = ({ adminToken, player1Id, player2Id, sets, handicapRule = null, tournamentId = null }) => ({
    p_admin_token: requireAdminToken(adminToken),
    p_player1_id: player1Id,
    p_player2_id: player2Id,
    p_sets: sets,
    p_handicap_rule: handicapRule,
    p_tournament_id: tournamentId,
})

export const buildPadelRecordParams = ({ adminToken, team1, team2, score1, score2, matchFormat = 'best_of_3', setsData = [] }) => ({
    p_admin_token: requireAdminToken(adminToken),
    p_team1_player1_id: team1[0],
    p_team1_player2_id: team1[1],
    p_team2_player1_id: team2[0],
    p_team2_player2_id: team2[1],
    p_score1: score1,
    p_score2: score2,
    p_match_format: matchFormat,
    p_sets_data: setsData,
})

export const buildTennisRecordParams = ({ adminToken, player1Id, player2Id, score1, score2, matchFormat = 'best_of_3', setsData = [] }) => ({
    p_admin_token: requireAdminToken(adminToken),
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
    if (functionName === 'record_pingpong_match' && (!params.p_sets?.length || params.p_sets.some(s => !validPingPongScores(s.s1, s.s2)))) throw new Error('Invalid Ping Pong scores')
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
