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

    // 2. Fetch all matches ordered by date (Optimization: Select only needed columns)
    const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('player1_id, player2_id, score1, score2, created_at')
        .order('created_at', { ascending: true })

    if (matchesError) {
        console.error('Error fetching matches:', matchesError)
        return
    }

    // 3. Initialize player stats
    // We keep a separate map for calculated stats to compare against original
    const calculatedStats = {}
    users.forEach(user => {
        calculatedStats[user.id] = {
            id: user.id,
            name: user.name,
            avatar_url: user.avatar_url,
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
        if (!calculatedStats[p1Id] || !calculatedStats[p2Id]) return

        const p1 = calculatedStats[p1Id]
        const p2 = calculatedStats[p2Id]

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
    // Optimization: Only update users whose stats have CHANGED
    const updates = []

    users.forEach(originalUser => {
        const calculated = calculatedStats[originalUser.id]
        if (!calculated) return

        const isRanked = calculated.matches_played >= 10

        // Check for differences
        if (
            originalUser.elo_rating !== calculated.elo_rating ||
            originalUser.matches_played !== calculated.matches_played ||
            originalUser.total_wins !== calculated.total_wins ||
            originalUser.is_ranked !== isRanked
        ) {
            updates.push({
                id: calculated.id,
                name: calculated.name,
                avatar_url: calculated.avatar_url,
                elo_rating: calculated.elo_rating,
                matches_played: calculated.matches_played,
                total_wins: calculated.total_wins,
                is_ranked: isRanked
            })
        }
    })

    if (updates.length === 0) {
        console.log('No stats updates needed.')
        return
    }

    const { error: updateError } = await supabase
        .from('users')
        .upsert(updates)

    if (updateError) {
        console.error('Error updating player stats:', updateError)
        throw updateError
    }
}
