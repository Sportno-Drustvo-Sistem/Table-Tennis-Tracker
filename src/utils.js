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




export const generateTournamentName = () => {
    const adjectives = ['Grand', 'Epic', 'Royal', 'Ultimate', 'Hyper', 'Super', 'Mega', 'Iron', 'Golden', 'Silver', 'Crystal', 'Neon', 'Thunder', 'Lightning', 'Storm', 'Blazing', 'Frozen', 'Savage', 'Wild', 'Prime']
    const nouns = ['Smash', 'Slam', 'Cup', 'Open', 'Clash', 'Battle', 'War', 'Showdown', 'Series', 'Circuit', 'Tour', 'Masters', 'Challenge', 'Rally', 'Spin', 'Drive', 'Net', 'Paddle', 'Arena']
    const years = [new Date().getFullYear()]

    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const noun = nouns[Math.floor(Math.random() * nouns.length)]

    return `${adj} ${noun} ${years[0]}`
}

// Fetches all active debuffs (both mayhem and streak types)
export const getActiveDebuffs = async () => {
    const { data, error } = await supabase
        .from('debuffs')
        .select('*')
        .eq('is_active', true)

    if (error) {
        console.error('Error fetching debuffs:', error)
        return []
    }
    return data
}

export const getRandomDebuff = (debuffs, playerElo) => {
    // Filter for Mayhem type only
    const mayhemDebuffs = debuffs.filter(d => d.trigger_type === 'mayhem')

    if (!mayhemDebuffs || mayhemDebuffs.length === 0) return null

    // 1. Sort debuffs by severity (asc)
    const sortedDebuffs = [...mayhemDebuffs].sort((a, b) => a.severity - b.severity)

    // 2. Calculate Power-Curve Weights
    // Formula: Weight = Severity ^ Exponent
    // Exponent is positive for High Elo (favors high severity)
    // Exponent is negative for Low Elo (favors low severity)

    // Pivot Point: 1100 Elo. 
    // < 1100: Negative exponent (Low severity preferred)
    // = 1100: Flat exponent (Equal chance)
    // > 1100: Positive exponent (High severity preferred)

    // Scale: Each 400 points adds +1 to exponent.
    // 1500 Elo -> Exponent +1. (Severity 10 is 10x more likely than Sev 1)
    // 1900 Elo -> Exponent +2. (Severity 10 is 100x more likely than Sev 1)
    // 700 Elo -> Exponent -1. (Severity 1 is 10x more likely than Sev 10)

    const elo = Math.max(0, playerElo || 1200) // Default to 1200 if missing
    const pivotElo = 1100
    const scaleFactor = 400
    const exponent = (elo - pivotElo) / scaleFactor

    const weights = sortedDebuffs.map(d => {
        // Ensure severity is at least 1 to avoid math issues, though DB should enforce logic
        const sev = Math.max(1, d.severity || 1)

        // Calculate weight
        const weight = Math.pow(sev, exponent)

        return weight
    })

    // 3. Weighted Random Selection
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)
    let random = Math.random() * totalWeight

    for (let i = 0; i < sortedDebuffs.length; i++) {
        random -= weights[i]
        if (random <= 0) {
            return sortedDebuffs[i]
        }
    }

    return sortedDebuffs[sortedDebuffs.length - 1]
}

// Updated to use DB Debuffs if provided, else fall back to legacy (though legacy should be migrated)
// Now accepts 'allDebuffs' as a 4th argument which is the list of active debuffs from DB
export const getHandicapRule = (streak, winnerName, loserName, allDebuffs = []) => {
    // Filter debuffs by type 'streak_loss'
    const streakDebuffs = allDebuffs.filter(d => d.trigger_type === 'streak_loss')

    // Find rules matching the streak threshold
    // We want the highest threshold that is <= streak.
    // e.g. if streak is 17, and we have rules for 8 and 16. match 16.

    // Group by trigger_value
    const applicableDebuffs = streakDebuffs.filter(d => (d.trigger_value || 0) <= streak)

    if (applicableDebuffs.length === 0) return null

    // Find max trigger value among applicable
    const maxTrigger = Math.max(...applicableDebuffs.map(d => d.trigger_value || 0))

    // Filter to only those with the max trigger (so we don't pick a "streak 8" rule when we are on "streak 16")
    const candidates = applicableDebuffs.filter(d => (d.trigger_value || 0) === maxTrigger)

    if (candidates.length === 0) return null

    const randomRule = candidates[Math.floor(Math.random() * candidates.length)]

    // Format the description with names (replace placeholders if we had them, 
    // but legacy format was dynamic string. 
    // For DB migration, we saved static strings but with generic phrasing like "Player" or "Opponent".
    // We might want to replace "Player" with winnerName and "Opponent" with loserName if we standardise it.
    // For now, let's just return the static DB text. Users can edit it to be generic. 
    // However, the prompt implies "I want to select debuffs from the lose streak severities".
    // Let's just return the object.

    return {
        title: randomRule.title,
        description: randomRule.description,
        severity: randomRule.severity >= 9 ? 'critical' : 'high', // Map numeric to legacy string for UI color if needed, or update UI to use number
        // DB stores severity as int, MatchModal expects string 'critical'/'high' for color sometimes?
        // Actually MatchModal checks `rule.type` mostly. 
        // But for streak rules color: 
        // In MatchModal: severity === 'critical' ? 'bg-red-500' : 'bg-orange-500'
        // Let's keep compatibility.
        original_severity: randomRule.severity
    }
}
