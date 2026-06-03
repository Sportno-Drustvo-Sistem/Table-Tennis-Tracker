import { supabase } from './supabaseClient'
import { calculateEloChange, getKFactor } from './utils'

export const normalizeTennisSets = (setsData = []) => {
    if (!Array.isArray(setsData)) return []
    return setsData.map(set => ({
        player1Games: Number(set.player1Games) || 0,
        player2Games: Number(set.player2Games) || 0,
        player1Tiebreak: set.player1Tiebreak === null || set.player1Tiebreak === undefined || set.player1Tiebreak === ''
            ? null
            : Number(set.player1Tiebreak),
        player2Tiebreak: set.player2Tiebreak === null || set.player2Tiebreak === undefined || set.player2Tiebreak === ''
            ? null
            : Number(set.player2Tiebreak),
    }))
}

export const getTennisScoreSummary = (match) => {
    const sets = normalizeTennisSets(match?.sets_data)
    const hasSets = sets.length > 0
    let player1Sets = 0
    let player2Sets = 0
    let player1Games = hasSets ? 0 : (Number(match?.score1) || 0)
    let player2Games = hasSets ? 0 : (Number(match?.score2) || 0)

    sets.forEach(set => {
        player1Games += set.player1Games
        player2Games += set.player2Games
        if (set.player1Games > set.player2Games) player1Sets += 1
        else if (set.player2Games > set.player1Games) player2Sets += 1
    })

    let winner = 0
    if (hasSets) {
        if (player1Sets > player2Sets) winner = 1
        else if (player2Sets > player1Sets) winner = 2
    } else if (player1Games > player2Games) winner = 1
    else if (player2Games > player1Games) winner = 2

    return {
        sets,
        hasSets,
        player1Sets,
        player2Sets,
        player1Games,
        player2Games,
        winner,
    }
}

const hasValidTiebreak = (set) => {
    const p1WonSet = set.player1Games > set.player2Games
    const winnerTb = p1WonSet ? set.player1Tiebreak : set.player2Tiebreak
    const loserTb = p1WonSet ? set.player2Tiebreak : set.player1Tiebreak

    return Number.isFinite(winnerTb)
        && Number.isFinite(loserTb)
        && winnerTb >= 7
        && winnerTb - loserTb >= 2
}

const validateTennisSet = (set) => {
    const p1 = set.player1Games
    const p2 = set.player2Games
    const high = Math.max(p1, p2)
    const low = Math.min(p1, p2)

    if (p1 === p2) return { valid: false, message: 'A tennis set cannot be saved tied.' }
    if (high < 6) return { valid: false, message: 'A tennis set winner needs at least 6 games.' }
    if (high > 7) return { valid: false, message: 'Tennis sets cannot exceed 7 games in this format.' }

    if (high === 6) {
        if (high - low < 2) return { valid: false, message: 'A 6-game set needs a 2-game lead.' }
        return { valid: true }
    }

    if (low === 5) return { valid: true }
    if (low === 6) {
        if (!hasValidTiebreak(set)) {
            return { valid: false, message: 'A 7-6 set needs a valid tiebreak score.' }
        }
        return { valid: true }
    }

    return { valid: false, message: 'A 7-game set can only end 7-5 or 7-6.' }
}

export const validateTennisSets = (setsData = [], matchFormat = 'best_of_3') => {
    const sets = normalizeTennisSets(setsData)
    const playedSets = sets.filter(set => set.player1Games > 0 || set.player2Games > 0)

    if (playedSets.length === 0) {
        return { valid: false, message: 'Enter at least one completed set score.' }
    }

    const maxSets = matchFormat === 'best_of_1' ? 1 : 3
    const requiredSetsToWin = matchFormat === 'best_of_1' ? 1 : 2
    if (playedSets.length > maxSets) {
        return { valid: false, message: `This format allows a maximum of ${maxSets} set${maxSets === 1 ? '' : 's'}.` }
    }

    for (const set of playedSets) {
        const validation = validateTennisSet(set)
        if (!validation.valid) return validation
    }

    let p1SetsWon = 0
    let p2SetsWon = 0
    for (let idx = 0; idx < playedSets.length; idx += 1) {
        const set = playedSets[idx]
        if (set.player1Games > set.player2Games) p1SetsWon += 1
        else p2SetsWon += 1

        if (idx < playedSets.length - 1 && Math.max(p1SetsWon, p2SetsWon) >= requiredSetsToWin) {
            return {
                valid: false,
                message: matchFormat === 'best_of_1'
                    ? 'A single-set match ends when a player wins 1 set.'
                    : 'A best-of-3 match ends when a player wins 2 sets.',
            }
        }
    }

    const summary = getTennisScoreSummary({ sets_data: playedSets })
    if (summary.winner === 0 || Math.max(summary.player1Sets, summary.player2Sets) !== requiredSetsToWin) {
        return { valid: false, message: 'The match needs a clear set winner.' }
    }

    return { valid: true, message: '', sets: playedSets, summary }
}

export const getTennisMatchWinner = (match) => getTennisScoreSummary(match).winner

export const recalculateTennisStats = async () => {
    const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, avatar_url')

    if (usersError) {
        console.error('Error fetching users:', usersError)
        throw usersError
    }

    const { data: matches, error: matchesError } = await supabase
        .from('tennis_matches')
        .select('*')
        .order('created_at', { ascending: true })

    if (matchesError) {
        console.error('Error fetching tennis matches:', matchesError)
        throw matchesError
    }

    const stats = {}
    users.forEach(user => {
        stats[user.id] = {
            user_id: user.id,
            elo_rating: 1200,
            matches_played: 0,
            total_wins: 0,
        }
    })

    matches.forEach(match => {
        const p1 = match.player1_id
        const p2 = match.player2_id
        if (!stats[p1] || !stats[p2]) return

        stats[p1].matches_played += 1
        stats[p2].matches_played += 1

        const winner = getTennisMatchWinner(match)
        if (winner === 1) stats[p1].total_wins += 1
        else if (winner === 2) stats[p2].total_wins += 1

        const p1Elo = stats[p1].elo_rating
        const p2Elo = stats[p2].elo_rating
        const p1Change = calculateEloChange(p1Elo, p2Elo, match.score1, match.score2, getKFactor(stats[p1].matches_played))
        const p2Change = calculateEloChange(p2Elo, p1Elo, match.score2, match.score1, getKFactor(stats[p2].matches_played))
        stats[p1].elo_rating += p1Change
        stats[p2].elo_rating += p2Change
    })

    const upserts = Object.values(stats).map(s => ({
        user_id: s.user_id,
        elo_rating: s.elo_rating,
        matches_played: s.matches_played,
        total_wins: s.total_wins,
        is_ranked: s.matches_played >= 10,
    }))

    if (upserts.length === 0) return

    const { error: upsertError } = await supabase
        .from('tennis_stats')
        .upsert(upserts, { onConflict: 'user_id' })

    if (upsertError) {
        console.error('Error upserting tennis stats:', upsertError)
        throw upsertError
    }
}

export const applyTennisMatchResultToStats = async (match) => {
    const p1 = match.player1_id
    const p2 = match.player2_id

    const { data: currentStats, error: fetchError } = await supabase
        .from('tennis_stats')
        .select('*')
        .in('user_id', [p1, p2])

    if (fetchError) {
        console.error('Error fetching tennis stats for incremental update:', fetchError)
        throw new Error('Failed to load tennis stats for update')
    }

    const statsMap = {}
    ;[p1, p2].forEach(id => {
        const existing = currentStats?.find(s => s.user_id === id)
        statsMap[id] = existing ? { ...existing } : { user_id: id, elo_rating: 1200, matches_played: 0, total_wins: 0 }
    })

    statsMap[p1].matches_played += 1
    statsMap[p2].matches_played += 1

    const winner = getTennisMatchWinner(match)
    if (winner === 1) statsMap[p1].total_wins += 1
    else if (winner === 2) statsMap[p2].total_wins += 1

    const p1Elo = statsMap[p1].elo_rating
    const p2Elo = statsMap[p2].elo_rating
    const p1Change = calculateEloChange(p1Elo, p2Elo, match.score1, match.score2, getKFactor(statsMap[p1].matches_played))
    const p2Change = calculateEloChange(p2Elo, p1Elo, match.score2, match.score1, getKFactor(statsMap[p2].matches_played))

    statsMap[p1].elo_rating += p1Change
    statsMap[p2].elo_rating += p2Change

    const upserts = Object.values(statsMap).map(s => ({
        user_id: s.user_id,
        elo_rating: s.elo_rating,
        matches_played: s.matches_played,
        total_wins: s.total_wins,
        is_ranked: s.matches_played >= 10,
    }))

    const { error: upsertError } = await supabase
        .from('tennis_stats')
        .upsert(upserts, { onConflict: 'user_id' })

    if (upsertError) {
        console.error('Error in incremental tennis update:', upsertError)
        throw upsertError
    }

    return { [p1]: p1Change, [p2]: p2Change }
}

export const buildTennisEloHistory = (users, tennisMatches) => {
    const sortedMatches = [...tennisMatches].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const ratings = {}
    const mpc = {}
    const playerEloTimelines = {}
    const matchHistory = []

    users.forEach(user => {
        ratings[user.id] = 1200
        mpc[user.id] = 0
        playerEloTimelines[user.id] = [{ matchNum: 0, elo: 1200, opponentId: null, date: null, result: null, change: 0 }]
    })

    sortedMatches.forEach(match => {
        const p1 = match.player1_id
        const p2 = match.player2_id
        if (ratings[p1] === undefined || ratings[p2] === undefined) return

        mpc[p1] += 1
        mpc[p2] += 1

        const p1EloBefore = ratings[p1]
        const p2EloBefore = ratings[p2]
        const p1Change = calculateEloChange(p1EloBefore, p2EloBefore, match.score1, match.score2, getKFactor(mpc[p1]))
        const p2Change = calculateEloChange(p2EloBefore, p1EloBefore, match.score2, match.score1, getKFactor(mpc[p2]))

        ratings[p1] += p1Change
        ratings[p2] += p2Change

        const winner = getTennisMatchWinner(match)
        const p1Won = winner === 1
        const p2Won = winner === 2

        matchHistory.push({
            matchId: match.id,
            p1Id: p1,
            p2Id: p2,
            p1EloBefore,
            p2EloBefore,
            p1EloAfter: ratings[p1],
            p2EloAfter: ratings[p2],
            p1Change,
            p2Change,
            score1: match.score1,
            score2: match.score2,
            date: new Date(match.created_at),
            winner,
        })

        playerEloTimelines[p1].push({
            matchNum: mpc[p1],
            elo: ratings[p1],
            change: p1Change,
            opponentId: p2,
            result: p1Won ? 'W' : (winner === 0 ? 'T' : 'L'),
            date: new Date(match.created_at),
            matchId: match.id,
        })

        playerEloTimelines[p2].push({
            matchNum: mpc[p2],
            elo: ratings[p2],
            change: p2Change,
            opponentId: p1,
            result: p2Won ? 'W' : (winner === 0 ? 'T' : 'L'),
            date: new Date(match.created_at),
            matchId: match.id,
        })
    })

    return {
        currentRatings: ratings,
        matchesPlayedCount: mpc,
        playerEloTimelines,
        matchHistory,
    }
}
