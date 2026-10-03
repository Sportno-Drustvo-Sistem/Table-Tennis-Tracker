import { buildEloHistory } from './utils'

export const filterSeasonMatches = (matches, seasonId) => seasonId === 'all'
    ? matches
    : matches.filter(match => String(match.season_id) === String(seasonId))

export const getSeasonUsers = (users, matches, snapshots, seasonId, activeSeasonId) => {
    if (String(seasonId) === String(activeSeasonId)) return users
    if (seasonId !== 'all') {
        return snapshots.filter(s => String(s.season_id) === String(seasonId)).map(s => ({
            ...users.find(u => u.id === s.user_id), ...s.player, id: s.user_id,
        }))
    }
    // All-time ELO continues through the entire history without seasonal resets.
    const history = buildEloHistory(users, matches)
    const wins = {}
    matches.forEach(m => {
        const winner = m.score1 > m.score2 ? m.player1_id : m.player2_id
        if (m.score1 !== m.score2) wins[winner] = (wins[winner] || 0) + 1
    })
    return users.map(u => ({
        ...u, elo_rating: history.currentRatings[u.id],
        matches_played: history.matchesPlayedCount[u.id],
        total_wins: wins[u.id] || 0, is_ranked: history.matchesPlayedCount[u.id] >= 10,
    }))
}

// Supabase caps a single response; fetch every page so old seasons remain complete.
export const fetchAllPingpongMatches = async (client) => {
    const matches = []
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await client.from('matches').select('*')
            .order('created_at', { ascending: false }).order('id', { ascending: false })
            .range(offset, offset + 999)
        if (error) return { data: null, error }
        matches.push(...data)
        if (data.length < 1000) return { data: matches, error: null }
    }
}
