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

// Every successful save is announced so the app can merge the returned rows
// into its cached history instead of refetching it, whichever screen saved.
const recordedListeners = new Set()

export const onMatchRecorded = (listener) => {
    recordedListeners.add(listener)
    return () => recordedListeners.delete(listener)
}

const callRecordRpc = async (client, sport, functionName, params) => {
    if (functionName === 'record_pingpong_match' && (!params.p_sets?.length || params.p_sets.some(s => !validPingPongScores(s.s1, s.s2)))) throw new Error('Invalid Ping Pong scores')
    const { data, error } = await client.rpc(functionName, params)
    if (error) throw error
    const result = normalizeRecordResponse(data)
    recordedListeners.forEach(listener => {
        try { listener({ sport, ...result }) } catch (listenerError) { console.error(listenerError) }
    })
    return result
}

export const recordPingPongMatch = (client, payload) => (
    callRecordRpc(client, 'pingpong', 'record_pingpong_match', buildPingPongRecordParams(payload))
)

export const recordPadelMatch = (client, payload) => (
    callRecordRpc(client, 'padel', 'record_padel_match', buildPadelRecordParams(payload))
)

export const recordTennisMatch = (client, payload) => (
    callRecordRpc(client, 'tennis', 'record_tennis_match', buildTennisRecordParams(payload))
)

const formatChange = change => (change > 0 ? `+${change}` : String(change))

// "Match saved · Alice +12 · Bob -12" (padel lists each team once).
export const describeRecordedMatch = ({ sport, match, changes }, usersById) => {
    if (!match) return 'Match saved'
    const name = id => usersById[id]?.name || 'Unknown'
    const sides = sport === 'padel'
        ? [[match.team1_player1_id, match.team1_player2_id], [match.team2_player1_id, match.team2_player2_id]]
        : [[match.player1_id], [match.player2_id]]
    const parts = sides.map(ids => {
        const change = changes?.[ids[0]]
        const label = ids.map(name).join(' & ')
        return Number.isFinite(change) ? `${label} ${formatChange(Math.round(change))}` : label
    })
    return ['Match saved', ...parts].join(' · ')
}
