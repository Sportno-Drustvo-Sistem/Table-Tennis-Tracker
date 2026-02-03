import { supabase } from './supabaseClient'

const K_FACTOR = 32

const calculateExpectedScore = (ratingA, ratingB) => {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

const calculateEloChange = (ratingA, ratingB, scoreA, scoreB) => {
    const expectedScoreA = calculateExpectedScore(ratingA, ratingB)
    const actualScoreA = scoreA > scoreB ? 1 : 0

    const scoreDiff = Math.abs(scoreA - scoreB)
    const multiplier = Math.log(scoreDiff + 1)

    return Math.round(K_FACTOR * multiplier * (actualScoreA - expectedScoreA))
}

export const recalculatePlayerStats = async () => {
    // 1. Fetch all users
    const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')

    if (usersError) {
        console.error('Error fetching users:', usersError)
        return
    }

    // 2. Fetch all matches ordered by date
    const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .order('created_at', { ascending: true })

    if (matchesError) {
        console.error('Error fetching matches:', matchesError)
        return
    }

    // 3. Initialize player stats
    const playerStats = {}
    users.forEach(user => {
        playerStats[user.id] = {
            ...user, // Keep existing user data
            elo_rating: 1200,
            matches_played: 0,
            total_wins: 0
        }
    })

    // 4. Process matches
    matches.forEach(match => {
        const p1Id = match.player1_id
        const p2Id = match.player2_id

        // Skip if player doesn't exist (e.g. deleted user)
        if (!playerStats[p1Id] || !playerStats[p2Id]) return

        const p1 = playerStats[p1Id]
        const p2 = playerStats[p2Id]

        // Update matches played
        p1.matches_played += 1
        p2.matches_played += 1

        // Update wins
        if (match.score1 > match.score2) {
            p1.total_wins += 1
        } else if (match.score2 > match.score1) {
            p2.total_wins += 1
        }

        // Calculate ELO Change
        const p1Rating = p1.elo_rating
        const p2Rating = p2.elo_rating

        const p1Change = calculateEloChange(p1Rating, p2Rating, match.score1, match.score2)
        const p2Change = calculateEloChange(p2Rating, p1Rating, match.score2, match.score1)

        p1.elo_rating += p1Change
        p2.elo_rating += p2Change
    })

    // 5. Update users in Supabase
    // Using upsert with only stats fields to update existing users without overwriting other data
    const updates = Object.values(playerStats).map(p => ({
        id: p.id,
        elo_rating: p.elo_rating,
        matches_played: p.matches_played,
        total_wins: p.total_wins,
        is_ranked: p.matches_played >= 10
    }))

    const { error: updateError } = await supabase
        .from('users')
        .upsert(updates)

    if (updateError) {
        console.error('Error updating player stats:', updateError)
    }
}
