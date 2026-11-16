import { supabase } from './supabaseClient'
import { calculateSetEloChange, getKFactor } from './utils'

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

export const recalculateTennisStats = async (adminToken) => {
    const { error } = await supabase.rpc('admin_recalculate_tennis_stats', { p_admin_token: adminToken })
    if (error) throw error
}

export const buildTennisEloHistory = (users, tennisMatches) => {
    const sortedMatches = [...tennisMatches].sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || String(a.id).localeCompare(String(b.id)))
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
        const p1Change = calculateSetEloChange(p1EloBefore, p2EloBefore, getTennisMatchWinner(match), 1, getKFactor(mpc[p1]))
        const p2Change = calculateSetEloChange(p2EloBefore, p1EloBefore, getTennisMatchWinner(match), 2, getKFactor(mpc[p2]))

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

// totalPoints is the number already played; return the next point's server.
export const tiebreakServer = (initialServer, totalPoints) => Math.ceil(totalPoints / 2) % 2 === 0 ? initialServer : (initialServer === 1 ? 2 : 1)
