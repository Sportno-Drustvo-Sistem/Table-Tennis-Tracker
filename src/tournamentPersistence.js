const callAdmin = async (client, name, adminToken, params) => {
    if (!adminToken) throw new Error('Admin session is missing or expired')
    const { data, error } = await client.rpc(name, { p_admin_token: adminToken, ...params })
    if (error) throw error
    return data
}

export const createTournament = (client, adminToken, { name, format, config }) =>
    callAdmin(client, 'create_tournament', adminToken, { p_name: name, p_format: format, p_config: config })

export const completeTournament = (client, adminToken, tournamentId, winnerId, results) =>
    callAdmin(client, 'complete_tournament', adminToken, {
        p_tournament_id: tournamentId, p_winner_id: winnerId, p_results: results,
    })

export const deleteTournament = (client, adminToken, tournamentId, deleteMatches) =>
    callAdmin(client, 'delete_tournament', adminToken, {
        p_tournament_id: tournamentId, p_delete_matches: deleteMatches,
    })
