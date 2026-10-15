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

// Keyset pagination tolerates server response caps below the requested page size.
// Stop only on an empty page; failures discard the partial result.
export const fetchAllMatches = async (client, table, { select = '*', start, end } = {}) => {
    const matches = []
    let cursor = null
    try {
        for (;;) {
            let query = client.from(table).select(select)
                .order('created_at', { ascending: false }).order('id', { ascending: false })
            if (start) query = query.gte('created_at', start.toISOString())
            if (end) query = query.lt('created_at', end.toISOString())
            if (cursor) query = query.or('created_at.lt.' + cursor.created_at + ',and(created_at.eq.' + cursor.created_at + ',id.lt.' + cursor.id + ')')
            const { data, error } = await query.range(0, 999)
            if (error) return { data: null, error }
            if (!Array.isArray(data)) throw new Error('Incomplete match history response')
            if (!data.length) return { data: matches, error: null }
            const next = data[data.length - 1]
            if (!next.id || !next.created_at || (cursor && next.id === cursor.id)) throw new Error('Match history cursor did not advance')
            matches.push(...data)
            cursor = next
        }
    } catch (error) { return { data: null, error } }
}

export const fetchAllPingpongMatches = client => fetchAllMatches(client, 'matches')
