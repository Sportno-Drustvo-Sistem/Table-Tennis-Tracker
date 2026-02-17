import { supabase } from './supabaseClient'

export const getKFactor = (matchesPlayed) => {
    // Standard K-Factor for everyone to prevent wild swings
    return 32
}

export const calculateExpectedScore = (ratingA, ratingB) => {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

export const calculateEloChange = (ratingA, ratingB, scoreA, scoreB, kFactor) => {
    const expectedScoreA = calculateExpectedScore(ratingA, ratingB)
    const actualScoreA = scoreA > scoreB ? 1 : 0

    const scoreDiff = Math.abs(scoreA - scoreB)
    const multiplier = Math.log(scoreDiff + 1)

    return Math.round(kFactor * multiplier * (actualScoreA - expectedScoreA))
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
        // Dynamic K-Factor
        const k1 = getKFactor(p1.matches_played)
        const k2 = getKFactor(p2.matches_played)

        const p1Rating = p1.elo_rating
        const p2Rating = p2.elo_rating

        const p1Change = calculateEloChange(p1Rating, p2Rating, match.score1, match.score2, k1)
        const p2Change = calculateEloChange(p2Rating, p1Rating, match.score2, match.score1, k2)

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

export const getHeadToHeadStreak = (player1Id, player2Id, matches) => {
    // Filter matches between these two players
    const h2hMatches = matches.filter(m =>
        (m.player1_id === player1Id && m.player2_id === player2Id) ||
        (m.player1_id === player2Id && m.player2_id === player1Id)
    ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // Newest first

    if (h2hMatches.length === 0) return { streak: 0, winnerId: null }

    let streak = 0
    let currentWinnerId = null

    for (const match of h2hMatches) {
        const winnerId = match.score1 > match.score2 ? match.player1_id : match.player2_id

        if (currentWinnerId === null) {
            currentWinnerId = winnerId
            streak = 1
        } else if (winnerId === currentWinnerId) {
            streak++
        } else {
            break // Streak broken
        }
    }

    return { streak, winnerId: currentWinnerId }
}

export const getHandicapRule = (streak, winnerName, loserName) => {
    if (streak >= 16) {
        return {
            title: '🔥 UNSTOPPABLE FORCE HANDICAP 🔥',
            description: `Since ${winnerName} has won ${streak} games in a row, they must play with their NON-DOMINANT hand whenever leading by more than 1 point!`,
            severity: 'critical'
        }
    }

    if (streak >= 8) {
        const rules = [
            `Loss Streak Handicap: ${loserName} serves 3 times, ${winnerName} serves 1 time.`,
            `Alternating Serves: ${winnerName} must alternate between forehand and backhand serves.`,
            `Mandatory Backhand Serve: ${winnerName} must only serve using backhand.`,
            `Point Headstart: ${loserName} starts the match with a 2-0 lead.`,
            `No Spin Serves: ${winnerName} cannot use spin on serves.`
        ]
        // Use a pseudo-random selection based on names and streak so it doesn't flicker wildly on re-renders, 
        // or just random is fine. Let's do random but stable per "session" if possible, 
        // but for now simple random is okay as it adds variety. 
        // Actually, let's pick based on a simple has so it stays consistent for the same match-up/moment? 
        // No, user asked for "random", let's just pick one.
        const randomIndex = Math.floor(Math.random() * rules.length)

        return {
            title: '⚖️ BALANCING THE SCALES',
            description: rules[randomIndex],
            severity: 'high'
        }
    }

    return null
}
