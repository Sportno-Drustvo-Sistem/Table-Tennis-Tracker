import { supabase } from './supabaseClient'
import { getKFactor, calculateExpectedScore, calculateEloChange } from './utils'

/**
 * Ensure a padel_stats row exists for a given user.
 * If no row exists, insert one with default values.
 */
export const ensurePadelStats = async (userId) => {
    const { data } = await supabase
        .from('padel_stats')
        .select('id')
        .eq('user_id', userId)
        .single()

    if (!data) {
        await supabase.from('padel_stats').insert({ user_id: userId })
    }
}

/**
 * Recalculate all padel stats from scratch (same approach as ping pong).
 * Each player has individual ELO. For the match calculation:
 * - Team ELO = average of both teammates' current ELO
 * - ELO change is computed for each player using team ELO vs opposing team ELO
 */
export const recalculatePadelStats = async () => {
    // 1. Fetch all users
    const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, avatar_url')

    if (usersError) {
        console.error('Error fetching users:', usersError)
        return
    }

    // 2. Fetch all padel matches ordered by date
    const { data: matches, error: matchesError } = await supabase
        .from('padel_matches')
        .select('*')
        .order('created_at', { ascending: true })

    if (matchesError) {
        console.error('Error fetching padel matches:', matchesError)
        return
    }

    // 3. Initialize per-player padel stats
    const stats = {}
    users.forEach(user => {
        stats[user.id] = {
            user_id: user.id,
            elo_rating: 1200,
            matches_played: 0,
            total_wins: 0
        }
    })

    // 4. Process matches chronologically
    matches.forEach(match => {
        const t1p1 = match.team1_player1_id
        const t1p2 = match.team1_player2_id
        const t2p1 = match.team2_player1_id
        const t2p2 = match.team2_player2_id

        // Skip if any player doesn't exist
        if (!stats[t1p1] || !stats[t1p2] || !stats[t2p1] || !stats[t2p2]) return

            // Update matches played
            ;[t1p1, t1p2, t2p1, t2p2].forEach(pid => {
                stats[pid].matches_played += 1
            })

        // Update wins
        if (match.score1 > match.score2) {
            stats[t1p1].total_wins += 1
            stats[t1p2].total_wins += 1
        } else if (match.score2 > match.score1) {
            stats[t2p1].total_wins += 1
            stats[t2p2].total_wins += 1
        }

        // Calculate ELO: team ELO = average of both players
        const team1Elo = (stats[t1p1].elo_rating + stats[t1p2].elo_rating) / 2
        const team2Elo = (stats[t2p1].elo_rating + stats[t2p2].elo_rating) / 2

            // Each player gets the same ELO change based on team performance
            ;[t1p1, t1p2].forEach(pid => {
                const k = getKFactor(stats[pid].matches_played)
                const change = calculateEloChange(team1Elo, team2Elo, match.score1, match.score2, k)
                stats[pid].elo_rating += change
            })

            ;[t2p1, t2p2].forEach(pid => {
                const k = getKFactor(stats[pid].matches_played)
                const change = calculateEloChange(team2Elo, team1Elo, match.score2, match.score1, k)
                stats[pid].elo_rating += change
            })
    })

    // 5. Upsert stats into padel_stats
    const upserts = Object.values(stats)
        .filter(s => s.matches_played > 0 || true) // Include all users
        .map(s => ({
            user_id: s.user_id,
            elo_rating: s.elo_rating,
            matches_played: s.matches_played,
            total_wins: s.total_wins,
            is_ranked: s.matches_played >= 10
        }))

    if (upserts.length > 0) {
        const { error: upsertError } = await supabase
            .from('padel_stats')
            .upsert(upserts, { onConflict: 'user_id' })

        if (upsertError) {
            console.error('Error upserting padel stats:', upsertError)
            throw upsertError
        }
    }
}

/**
 * Get head-to-head streak between two teams in padel.
 * A "team" is identified by a Set of two player IDs (order doesn't matter).
 */
export const getPadelTeamStreak = (team1Ids, team2Ids, matches) => {
    const t1Set = new Set(team1Ids)
    const t2Set = new Set(team2Ids)

    const sameTeam = (matchTeam, targetSet) => {
        const matchSet = new Set(matchTeam)
        return matchSet.size === targetSet.size && [...targetSet].every(id => matchSet.has(id))
    }

    // Filter matches between these exact two teams (in either order)
    const h2hMatches = matches.filter(m => {
        const mT1 = [m.team1_player1_id, m.team1_player2_id]
        const mT2 = [m.team2_player1_id, m.team2_player2_id]

        return (sameTeam(mT1, t1Set) && sameTeam(mT2, t2Set)) ||
            (sameTeam(mT1, t2Set) && sameTeam(mT2, t1Set))
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    if (h2hMatches.length === 0) return { streak: 0, winnerTeamIds: null }

    let streak = 0
    let currentWinnerKey = null

    for (const match of h2hMatches) {
        const mT1 = new Set([match.team1_player1_id, match.team1_player2_id])
        const winnerSet = match.score1 > match.score2 ? mT1 : new Set([match.team2_player1_id, match.team2_player2_id])
        const winnerKey = [...winnerSet].sort().join(',')

        if (currentWinnerKey === null) {
            currentWinnerKey = winnerKey
            streak = 1
        } else if (winnerKey === currentWinnerKey) {
            streak++
        } else {
            break
        }
    }

    return { streak, winnerTeamIds: currentWinnerKey ? currentWinnerKey.split(',') : null }
}
