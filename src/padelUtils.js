import { supabase } from './supabaseClient'
import { getKFactor, calculateSetEloChange } from './utils'

/**
 * Determine the winner of a padel match by sets won, or games won if no sets exist.
 * Returns 1 for Team 1, 2 for Team 2, 0 for Tie.
 */
export const normalizePadelSets = (setsData = []) => {
    if (!Array.isArray(setsData)) return []
    return setsData.map(set => ({
        team1Games: Number(set.team1Games) || 0,
        team2Games: Number(set.team2Games) || 0,
    }))
}

export const getPadelScoreSummary = (match) => {
    const sets = normalizePadelSets(match?.sets_data)
    const hasSets = sets.length > 0
    let team1Sets = 0
    let team2Sets = 0
    let team1Games = hasSets ? 0 : (Number(match?.score1) || 0)
    let team2Games = hasSets ? 0 : (Number(match?.score2) || 0)

    sets.forEach(set => {
        team1Games += set.team1Games
        team2Games += set.team2Games
        if (set.team1Games > set.team2Games) team1Sets += 1
        else if (set.team2Games > set.team1Games) team2Sets += 1
    })

    let winner = 0
    if (hasSets) {
        if (team1Sets > team2Sets) winner = 1
        else if (team2Sets > team1Sets) winner = 2
    } else if (team1Games > team2Games) winner = 1
    else if (team2Games > team1Games) winner = 2

    return {
        sets,
        hasSets,
        team1Sets,
        team2Sets,
        team1Games,
        team2Games,
        winner,
    }
}

export const validatePadelSets = (setsData = []) => {
    const sets = normalizePadelSets(setsData)
    if (sets.some(set => [set.team1Games, set.team2Games].some(value => !Number.isInteger(value) || value < 0))) {
        return { valid: false, message: 'Enter non-negative whole-number set scores.' }
    }
    const playedSets = sets.filter(set => set.team1Games > 0 || set.team2Games > 0)

    if (playedSets.length === 0) {
        return { valid: false, message: 'Enter at least one completed set score.' }
    }

    if (playedSets.some(set => set.team1Games === set.team2Games)) {
        return { valid: false, message: 'Each saved set needs a clear winner.' }
    }

    const summary = getPadelScoreSummary({ sets_data: playedSets })
    if (summary.winner === 0) {
        return { valid: false, message: 'The match needs a clear set winner.' }
    }

    return { valid: true, message: '', sets: playedSets, summary }
}

export const getMatchWinner = (match) => {
    return getPadelScoreSummary(match).winner
}

export const recalculatePadelStats = async (adminToken) => {
    const { error } = await supabase.rpc('admin_recalculate_padel_stats', { p_admin_token: adminToken })
    if (error) throw error
}

export const buildPadelEloHistory = (users, padelMatches) => {
    const sortedMatches = [...padelMatches].sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || String(a.id).localeCompare(String(b.id)))
    const ratings = {}
    const mpc = {}
    const playerEloTimelines = {}
    const matchHistory = []

    users.forEach(u => {
        ratings[u.id] = 1200
        mpc[u.id] = 0
        playerEloTimelines[u.id] = [{ matchNum: 0, elo: 1200, opponentId: null, date: null, result: null, change: 0 }]
    })

    sortedMatches.forEach(m => {
        const t1p1 = m.team1_player1_id
        const t1p2 = m.team1_player2_id
        const t2p1 = m.team2_player1_id
        const t2p2 = m.team2_player2_id

        if (!ratings[t1p1] || !ratings[t1p2] || !ratings[t2p1] || !ratings[t2p2]) return

            ;[t1p1, t1p2, t2p1, t2p2].forEach(pid => {
                mpc[pid] = (mpc[pid] || 0) + 1
            })

        const t1EloBefore = (ratings[t1p1] + ratings[t1p2]) / 2
        const t2EloBefore = (ratings[t2p1] + ratings[t2p2]) / 2

        const c1_t1p1 = calculateSetEloChange(t1EloBefore, t2EloBefore, getMatchWinner(m), 1, getKFactor(mpc[t1p1]))
        const c1_t1p2 = calculateSetEloChange(t1EloBefore, t2EloBefore, getMatchWinner(m), 1, getKFactor(mpc[t1p2]))

        const c2_t2p1 = calculateSetEloChange(t2EloBefore, t1EloBefore, getMatchWinner(m), 2, getKFactor(mpc[t2p1]))
        const c2_t2p2 = calculateSetEloChange(t2EloBefore, t1EloBefore, getMatchWinner(m), 2, getKFactor(mpc[t2p2]))

        ratings[t1p1] += c1_t1p1
        ratings[t1p2] += c1_t1p2
        ratings[t2p1] += c2_t2p1
        ratings[t2p2] += c2_t2p2

        const winner = getMatchWinner(m)

        matchHistory.push({
            matchId: m.id,
            t1Ids: [t1p1, t1p2],
            t2Ids: [t2p1, t2p2],
            t1EloBefore,
            t2EloBefore,
            date: new Date(m.created_at),
            winner
        })

        const t1Won = winner === 1
        const t2Won = winner === 2

            ;[t1p1, t1p2].forEach(pid => {
                playerEloTimelines[pid].push({
                    matchNum: mpc[pid],
                    elo: ratings[pid],
                    change: pid === t1p1 ? c1_t1p1 : c1_t1p2,
                    opponentId: `${t2p1},${t2p2}`,
                    result: t1Won ? 'W' : (winner === 0 ? 'T' : 'L'),
                    date: new Date(m.created_at),
                    matchId: m.id
                })
            })

            ;[t2p1, t2p2].forEach(pid => {
                playerEloTimelines[pid].push({
                    matchNum: mpc[pid],
                    elo: ratings[pid],
                    change: pid === t2p1 ? c2_t2p1 : c2_t2p2,
                    opponentId: `${t1p1},${t1p2}`,
                    result: t2Won ? 'W' : (winner === 0 ? 'T' : 'L'),
                    date: new Date(m.created_at),
                    matchId: m.id
                })
            })
    })

    return {
        currentRatings: ratings,
        matchesPlayedCount: mpc,
        playerEloTimelines,
        matchHistory
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
        const winnerNum = getMatchWinner(match)
        let winnerSet = null;
        if (winnerNum === 1) winnerSet = mT1;
        else if (winnerNum === 2) winnerSet = new Set([match.team2_player1_id, match.team2_player2_id]);

        if (!winnerSet) continue;

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
