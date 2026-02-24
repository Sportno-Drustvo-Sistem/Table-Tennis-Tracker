import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import TournamentSetup from './TournamentSetup'
import BracketView from './BracketView'
import MatchModal from '../modals/MatchModal'
import { Trophy, RefreshCw, X, AlertTriangle } from 'lucide-react'
import { getActiveDebuffs, getRandomDebuff } from '../../utils'
import { useToast } from '../../contexts/ToastContext' // Added import for useToast
import {
    shuffle,
    generateSingleEliminationBracket,
    generateDoubleEliminationBracket,
    generateSwissRound,
    initSwissStandings,
    getSwissRoundCount,
    seedFromSwiss
} from './tournamentUtils'

const Tournament = ({ users, isAdmin, matches: globalMatches, fetchData }) => {
    const { showToast, showConfirm } = useToast() // Added useToast hook
    const [activeTournament, setActiveTournament] = useState(null)
    const [loading, setLoading] = useState(true)
    const [cachedDebuffs, setCachedDebuffs] = useState([])
    const [selectedMatchId, setSelectedMatchId] = useState(null)

    const STORAGE_KEY = 'pingpong_active_tournament'

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                const isValid = parsed && (
                    (parsed.phase === 'swiss' && parsed.swiss) ||
                    (parsed.rounds && Array.isArray(parsed.rounds) &&
                        parsed.rounds.every(r => r.matches && Array.isArray(r.matches)))
                )
                if (isValid) {
                    setActiveTournament(parsed)
                    getActiveDebuffs().then(setCachedDebuffs)
                } else {
                    console.warn("Invalid saved tournament data, clearing.")
                    localStorage.removeItem(STORAGE_KEY)
                }
            } catch (e) {
                console.error("Failed to parse saved tournament", e)
                localStorage.removeItem(STORAGE_KEY)
            }
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (activeTournament) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(activeTournament))
        }
    }, [activeTournament])

    // ─── Debuff Helper ─────────────────────────────

    const assignDebuffsToMatch = (match, debuffsPool, usersMap) => {
        if (!debuffsPool || debuffsPool.length === 0) return match
        const p1 = match.player1
        const p2 = match.player2
        if (p1 && p2) {
            const u1 = usersMap[p1.id] || p1
            const u2 = usersMap[p2.id] || p2
            const d1 = getRandomDebuff(debuffsPool, u1.elo_rating || 1200)
            const d2 = getRandomDebuff(debuffsPool, u2.elo_rating || 1200)
            match.debuffs = { [p1.id]: d1, [p2.id]: d2 }
        }
        return match
    }

    // ─── Start Tournament ──────────────────────────

    const handleStartTournament = async ({ name, playerIds, format, useSwissSeeding, mayhemMode }) => {
        const debuffsPool = await getActiveDebuffs()
        setCachedDebuffs(debuffsPool)

        const { data: tourneyData, error: tourneyError } = await supabase
            .from('tournaments')
            .insert({ name, format, status: 'active', config: { mayhemMode, useSwissSeeding } })
            .select().single()

        if (tourneyError) { showToast('Error starting tournament: ' + tourneyError.message, 'error'); return }

        const tournamentId = tourneyData.id
        const participants = shuffle(users.filter(u => playerIds.includes(u.id)))
        const usersMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {})

        if (useSwissSeeding) {
            // Start Swiss phase
            const standings = initSwissStandings(participants)
            const totalRounds = getSwissRoundCount(participants.length)
            const { pairings, byePlayerId } = generateSwissRound(standings, [], participants)

            // Grant bye
            if (byePlayerId) {
                const s = standings.find(s => s.playerId === byePlayerId)
                if (s) { s.score += 1; s.hadBye = true }
            }

            setActiveTournament({
                id: tournamentId, name, format, players: participants,
                phase: 'swiss', status: 'active', winner: null,
                config: { mayhemMode, useSwissSeeding },
                swiss: {
                    standings, roundHistory: [], currentRound: 1, totalRounds,
                    currentPairings: pairings, byePlayerId,
                    completedMatches: []
                }
            })
        } else {
            // Go directly to bracket
            let rounds
            if (format === 'double_elim') {
                rounds = generateDoubleEliminationBracket(participants, mayhemMode, debuffsPool, usersMap, assignDebuffsToMatch)
            } else {
                rounds = generateSingleEliminationBracket(participants, mayhemMode, debuffsPool, usersMap, assignDebuffsToMatch)
            }
            setActiveTournament({
                id: tournamentId, name, format, players: participants,
                rounds, phase: 'bracket', status: 'active', winner: null,
                config: { mayhemMode, useSwissSeeding }
            })
        }
    }

    // ─── Swiss Match Click ─────────────────────────

    const handleSwissMatchClick = (pairing) => {
        if (!isAdmin) return
        const p1 = activeTournament.players.find(p => p.id === pairing.player1Id)
        const p2 = activeTournament.players.find(p => p.id === pairing.player2Id)
        if (p1 && p2) {
            setSelectedMatchId({ type: 'swiss', pairing, player1: p1, player2: p2 })
        }
    }

    // ─── Swiss Match Saved ─────────────────────────

    const handleSwissMatchSaved = async () => {
        const { data: latestMatch } = await supabase
            .from('matches').select('*')
            .order('created_at', { ascending: false }).limit(1).single()

        if (!latestMatch) { setSelectedMatchId(null); return }

        // Link to tournament
        if (!latestMatch.tournament_id) {
            await supabase.from('matches').update({ tournament_id: activeTournament.id }).eq('id', latestMatch.id)
        }

        const t = { ...activeTournament }
        const swiss = { ...t.swiss }
        const standings = [...swiss.standings]

        const pairing = selectedMatchId.pairing
        const p1Idx = standings.findIndex(s => s.playerId === pairing.player1Id)
        const p2Idx = standings.findIndex(s => s.playerId === pairing.player2Id)

        if (p1Idx !== -1 && p2Idx !== -1) {
            const s1isP1 = latestMatch.player1_id === pairing.player1Id
            const s1Score = s1isP1 ? latestMatch.score1 : latestMatch.score2
            const s2Score = s1isP1 ? latestMatch.score2 : latestMatch.score1

            standings[p1Idx] = { ...standings[p1Idx], matchesPlayed: standings[p1Idx].matchesPlayed + 1, pointsFor: standings[p1Idx].pointsFor + s1Score, pointsAgainst: standings[p1Idx].pointsAgainst + s2Score, pointDiff: standings[p1Idx].pointDiff + s1Score - s2Score }
            standings[p2Idx] = { ...standings[p2Idx], matchesPlayed: standings[p2Idx].matchesPlayed + 1, pointsFor: standings[p2Idx].pointsFor + s2Score, pointsAgainst: standings[p2Idx].pointsAgainst + s1Score, pointDiff: standings[p2Idx].pointDiff + s2Score - s1Score }

            if (s1Score > s2Score) standings[p1Idx].score += 1
            else standings[p2Idx].score += 1
        }

        // Mark this pairing as completed
        const completedMatches = [...(swiss.completedMatches || []), { player1Id: pairing.player1Id, player2Id: pairing.player2Id, matchId: latestMatch.id }]

        // Check if all pairings in this round are done
        const allDone = swiss.currentPairings.every(p =>
            completedMatches.some(c =>
                (c.player1Id === p.player1Id && c.player2Id === p.player2Id) ||
                (c.player1Id === p.player2Id && c.player2Id === p.player1Id)
            )
        )

        swiss.standings = standings
        swiss.completedMatches = completedMatches

        if (allDone) {
            // Round complete
            const roundRecord = swiss.currentPairings.map(p => ({ player1Id: p.player1Id, player2Id: p.player2Id }))
            const roundHistory = [...swiss.roundHistory, roundRecord]
            swiss.roundHistory = roundHistory

            if (swiss.currentRound >= swiss.totalRounds) {
                // Swiss complete → transition to bracket
                const seeded = seedFromSwiss(standings)
                const usersMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {})
                let debuffsPool = cachedDebuffs
                if (!debuffsPool || debuffsPool.length === 0) {
                    debuffsPool = await getActiveDebuffs()
                    setCachedDebuffs(debuffsPool)
                }

                let rounds
                if (t.format === 'double_elim') {
                    rounds = generateDoubleEliminationBracket(seeded, t.config?.mayhemMode, debuffsPool, usersMap, assignDebuffsToMatch)
                } else {
                    rounds = generateSingleEliminationBracket(seeded, t.config?.mayhemMode, debuffsPool, usersMap, assignDebuffsToMatch)
                }

                t.rounds = rounds
                t.phase = 'bracket'
                t.swiss = { ...swiss, completed: true }
            } else {
                // Generate next Swiss round
                swiss.currentRound += 1
                swiss.completedMatches = []
                const { pairings, byePlayerId } = generateSwissRound(standings, swiss.roundHistory, t.players)
                swiss.currentPairings = pairings
                swiss.byePlayerId = byePlayerId

                if (byePlayerId) {
                    const byeIdx = standings.findIndex(s => s.playerId === byePlayerId)
                    if (byeIdx !== -1 && !standings[byeIdx].hadBye) {
                        standings[byeIdx] = { ...standings[byeIdx], score: standings[byeIdx].score + 1, hadBye: true }
                    }
                }
            }
        }

        t.swiss = swiss
        setActiveTournament(t)
        setSelectedMatchId(null)
        if (fetchData) fetchData()
    }

    // ─── Bracket Match Click ───────────────────────

    const handleMatchClick = (matchId) => {
        if (!isAdmin) return
        let match = null, roundIndex = -1
        if (activeTournament?.rounds) {
            activeTournament.rounds.forEach((r, rIdx) => {
                const m = r.matches.find(m => m.id === matchId)
                if (m) { match = m; roundIndex = rIdx }
            })
        }
        if (match && match.player1 && match.player2 && !match.winner) {
            setSelectedMatchId({ type: 'bracket', matchId, roundIndex })
        }
    }

    // ─── Bracket Match Saved ───────────────────────

    const handleMatchSaved = async () => {
        const { data: latestMatch } = await supabase
            .from('matches').select('*')
            .order('created_at', { ascending: false }).limit(1).single()

        if (latestMatch) {
            updateBracketWithResult(selectedMatchId.roundIndex, selectedMatchId.matchId, latestMatch)
        }
        setSelectedMatchId(null)
        if (fetchData) fetchData()
    }

    const updateBracketWithResult = async (roundIdx, matchId, dbMatch) => {
        const newTournament = { ...activeTournament }
        const round = newTournament.rounds[roundIdx]
        const matchIndex = round.matches.findIndex(m => m.id === matchId)
        if (matchIndex === -1) return

        const match = round.matches[matchIndex]
        const p1Id = match.player1.id
        const p2Id = match.player2.id

        if (dbMatch.player1_id !== p1Id && dbMatch.player1_id !== p2Id) return

        const winnerId = dbMatch.score1 > dbMatch.score2 ? dbMatch.player1_id : dbMatch.player2_id
        const loserId = winnerId === p1Id ? p2Id : p1Id
        const winner = winnerId === p1Id ? match.player1 : match.player2
        const loser = winnerId === p1Id ? match.player2 : match.player1

        match.score1 = dbMatch.player1_id === p1Id ? dbMatch.score1 : dbMatch.score2
        match.score2 = dbMatch.player1_id === p1Id ? dbMatch.score2 : dbMatch.score1
        match.winner = winner
        match.dbMatchId = dbMatch.id

        if (!dbMatch.tournament_id) {
            await supabase.from('matches').update({ tournament_id: newTournament.id }).eq('id', dbMatch.id)
        }

        let debuffsPool = cachedDebuffs
        if (!debuffsPool || debuffsPool.length === 0) {
            debuffsPool = await getActiveDebuffs()
            setCachedDebuffs(debuffsPool)
        }
        const usersMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {})

        const format = newTournament.format

        if (format === 'double_elim') {
            handleDoubleElimAdvancement(newTournament, roundIdx, matchIndex, winner, loser, debuffsPool, usersMap)
        } else {
            handleSingleElimAdvancement(newTournament, roundIdx, matchIndex, match, winner, loser, debuffsPool, usersMap)
        }

        setActiveTournament(newTournament)
    }

    const handleSingleElimAdvancement = (tournament, roundIdx, matchIndex, match, winner, loser, debuffsPool, usersMap) => {
        const rounds = tournament.rounds
        // Find the 3rd place match round and the grand final round
        const thirdPlaceRoundIdx = rounds.findIndex(r => r.name === '3rd Place Match')
        const grandFinalRoundIdx = rounds.findIndex(r => r.name === 'Grand Final')

        // Check if this is the semi-finals
        const isSemiFinal = rounds[roundIdx]?.name === 'Semi-Finals'

        if (match.isThirdPlace) {
            // 3rd place match completed — don't propagate further
            // Check if Grand Final is also done
            checkTournamentComplete(tournament)
            return
        }

        if (isSemiFinal && thirdPlaceRoundIdx !== -1) {
            // Feed loser into 3rd place match
            const thirdMatch = rounds[thirdPlaceRoundIdx].matches[0]
            if (!thirdMatch.player1) thirdMatch.player1 = loser
            else if (!thirdMatch.player2) thirdMatch.player2 = loser

            if (thirdMatch.player1 && thirdMatch.player2 && tournament.config?.mayhemMode) {
                assignDebuffsToMatch(thirdMatch, debuffsPool, usersMap)
            }
        }

        if (roundIdx === grandFinalRoundIdx) {
            if (rounds[grandFinalRoundIdx]?.matches[0]?.winner) {
                checkTournamentComplete(tournament)
            }
            return
        }

        // Normal advancement to next round (skip 3rd place match round)
        let nextRoundIdx = roundIdx + 1
        if (nextRoundIdx < rounds.length && rounds[nextRoundIdx].name === '3rd Place Match') {
            // Grand Final is before 3rd place in array, find it
            nextRoundIdx = grandFinalRoundIdx
        }

        if (nextRoundIdx !== -1 && nextRoundIdx < rounds.length && !rounds[nextRoundIdx].matches[0]?.isThirdPlace) {
            const nextMatchIdx = Math.floor(matchIndex / 2)
            const isP1Slot = matchIndex % 2 === 0
            const nextMatch = rounds[nextRoundIdx].matches[nextMatchIdx]
            if (nextMatch) {
                if (isP1Slot) nextMatch.player1 = winner
                else nextMatch.player2 = winner

                if (nextMatch.player1 && nextMatch.player2 && tournament.config?.mayhemMode) {
                    assignDebuffsToMatch(nextMatch, debuffsPool, usersMap)
                }
            }
        }

        // Check if tournament is complete (Grand Final done)
        if (rounds[grandFinalRoundIdx]?.matches[0]?.winner) {
            checkTournamentComplete(tournament)
        }
    }

    const handleDoubleElimAdvancement = (tournament, roundIdx, matchIndex, winner, loser, debuffsPool, usersMap) => {
        const rounds = tournament.rounds
        const currentRound = rounds[roundIdx]

        if (currentRound.bracket === 'grand_final') {
            tournament.status = 'completed'
            tournament.winner = winner
            finishTournament(tournament)
            return
        }

        // Calculate WB-relative round index for feedsFrom matching
        const wbRounds = rounds.filter(r => r.bracket === 'winners')
        const wbRelativeIdx = wbRounds.indexOf(currentRound)
        const isWBFinal = currentRound.name === 'WB Final'

        if (currentRound.bracket === 'winners') {
            if (isWBFinal) {
                // WB Final: winner → Grand Final, loser → LB Final
                const gf = rounds.find(r => r.bracket === 'grand_final')
                if (gf) gf.matches[0].player1 = winner

                const lbFinal = rounds.find(r => r.name === 'LB Final')
                if (lbFinal) {
                    const lbMatch = lbFinal.matches[0]
                    if (!lbMatch.player1) lbMatch.player1 = loser
                    else lbMatch.player2 = loser
                }
            } else {
                // Normal WB round: advance winner to next WB round
                const nextWBIdx = roundIdx + 1
                if (nextWBIdx < rounds.length && rounds[nextWBIdx].bracket === 'winners') {
                    const nextMatch = rounds[nextWBIdx].matches[Math.floor(matchIndex / 2)]
                    if (nextMatch) {
                        if (matchIndex % 2 === 0) nextMatch.player1 = winner
                        else nextMatch.player2 = winner
                    }
                }

                // Send loser to matching LB round (using WB-relative index for feedsFrom)
                const lbRound = rounds.find(r =>
                    r.bracket === 'losers' && r.matches.some(m =>
                        (m.feedsFrom?.type === 'wb_losers' && m.feedsFrom.wbRound === wbRelativeIdx) ||
                        (m.feedsFrom?.type === 'wb_drop' && m.feedsFrom.wbRound === wbRelativeIdx)
                    )
                )

                if (lbRound) {
                    const isDrop = lbRound.matches[0].feedsFrom?.type === 'wb_drop'
                    const reverse = lbRound.matches[0].feedsFrom?.reverse
                    const wbSize = currentRound.matches.length

                    let targetMatchIdx
                    if (isDrop) {
                        targetMatchIdx = reverse ? wbSize - 1 - matchIndex : matchIndex
                    } else {
                        targetMatchIdx = Math.floor(matchIndex / 2)
                        if (reverse) targetMatchIdx = (wbSize / 2) - 1 - targetMatchIdx
                    }

                    const lbMatch = lbRound.matches[targetMatchIdx]
                    if (lbMatch) {
                        if (!lbMatch.player1) lbMatch.player1 = loser
                        else lbMatch.player2 = loser
                    }
                }
            }
        }

        if (currentRound.bracket === 'losers') {
            // Advance winner in losers bracket
            const lbRounds = rounds.filter(r => r.bracket === 'losers')
            const lbIdx = lbRounds.indexOf(currentRound)

            if (currentRound.name === 'LB Final') {
                // LB Final winner → Grand Final player2
                const gf = rounds.find(r => r.bracket === 'grand_final')
                if (gf) gf.matches[0].player2 = winner
            } else if (lbIdx < lbRounds.length - 1) {
                const nextLBRound = lbRounds[lbIdx + 1]
                const nextMatch = nextLBRound.matches.find(m => !m.player1 || !m.player2)
                if (nextMatch) {
                    if (!nextMatch.player1) nextMatch.player1 = winner
                    else nextMatch.player2 = winner
                }
            }
        }

        // Assign debuffs to newly filled matches
        rounds.forEach(r => {
            r.matches.forEach(m => {
                if (m.player1 && m.player2 && !m.winner && !m.debuffs && tournament.config?.mayhemMode) {
                    assignDebuffsToMatch(m, debuffsPool, usersMap)
                }
            })
        })
    }

    const checkTournamentComplete = (tournament) => {
        const rounds = tournament.rounds
        const grandFinal = rounds.find(r => r.name === 'Grand Final')
        const thirdPlace = rounds.find(r => r.name === '3rd Place Match')

        const gfDone = grandFinal?.matches[0]?.winner
        const tpDone = !thirdPlace || thirdPlace?.matches[0]?.winner

        if (gfDone && tpDone) {
            tournament.status = 'completed'
            tournament.winner = grandFinal.matches[0].winner
            finishTournament(tournament)
        }
    }

    // ─── Finish Tournament ─────────────────────────

    const finishTournament = async (tournament) => {
        await supabase.from('tournaments')
            .update({ status: 'completed', winner_id: tournament.winner.id })
            .eq('id', tournament.id)

        const results = []
        const rounds = tournament.rounds
        const format = tournament.format

        // Winner
        results.push({ tournament_id: tournament.id, user_id: tournament.winner.id, rank: 1, round_reached: 'Winner' })

        if (format === 'double_elim') {
            // Runner-up = Grand Final loser
            const gf = rounds.find(r => r.bracket === 'grand_final')?.matches[0]
            if (gf?.winner && gf.player1 && gf.player2) {
                const runnerUp = gf.winner.id === gf.player1.id ? gf.player2 : gf.player1
                results.push({ tournament_id: tournament.id, user_id: runnerUp.id, rank: 2, round_reached: 'Grand Final' })
            }
            // 3rd = LB Final loser
            const lbFinal = rounds.find(r => r.name === 'LB Final')?.matches[0]
            if (lbFinal?.winner && lbFinal.player1 && lbFinal.player2) {
                const third = lbFinal.winner.id === lbFinal.player1.id ? lbFinal.player2 : lbFinal.player1
                results.push({ tournament_id: tournament.id, user_id: third.id, rank: 3, round_reached: 'LB Final' })
            }
        } else {
            // Single elim: use actual placement match results
            const gf = rounds.find(r => r.name === 'Grand Final')?.matches[0]
            if (gf?.winner && gf.player1 && gf.player2) {
                const runnerUp = gf.winner.id === gf.player1.id ? gf.player2 : gf.player1
                results.push({ tournament_id: tournament.id, user_id: runnerUp.id, rank: 2, round_reached: 'Grand Final' })
            }
            const tp = rounds.find(r => r.name === '3rd Place Match')?.matches[0]
            if (tp?.winner && tp.player1 && tp.player2) {
                results.push({ tournament_id: tournament.id, user_id: tp.winner.id, rank: 3, round_reached: '3rd Place Match' })
                const fourth = tp.winner.id === tp.player1.id ? tp.player2 : tp.player1
                results.push({ tournament_id: tournament.id, user_id: fourth.id, rank: 4, round_reached: '3rd Place Match' })
            }

            // Remaining losers from earlier rounds
            const totalRounds = rounds.length
            const semis = rounds.find(r => r.name === 'Semi-Finals')
            if (semis) {
                // 5th-8th from QF losers etc. already captured by earlier round losers
                const semiIdx = rounds.indexOf(semis)
                for (let i = semiIdx - 1; i >= 0; i--) {
                    const round = rounds[i]
                    if (round.name === '3rd Place Match') continue
                    let rank = 5
                    if (i === semiIdx - 1) rank = 5 // QF losers
                    else if (i === semiIdx - 2) rank = 9
                    else rank = Math.pow(2, totalRounds - i - 1) + 1

                    round.matches.forEach(m => {
                        if (m.winner && m.player1 && m.player2 && !m.isBye) {
                            const mLoser = m.winner.id === m.player1.id ? m.player2 : m.player1
                            if (!results.some(r => r.user_id === mLoser.id)) {
                                results.push({ tournament_id: tournament.id, user_id: mLoser.id, rank, round_reached: round.name })
                            }
                        }
                    })
                }
            }
        }

        if (results.length > 0) {
            const { error } = await supabase.from('tournament_results').insert(results)
            if (error) console.error("Error saving results", error)
        }

        showToast(`🏆 Tournament Complete! ${tournament.winner.name} is the champion!`, 'success') // Replaced alert
    }

    const handleCloseTournament = () => {
        showConfirm("Are you sure you want to cancel this tournament? Active tournament data will be cleared and no results will be saved.", () => {
            setActiveTournament(null)
            localStorage.removeItem(STORAGE_KEY)
        })
    }

    const handleManuallyFinishTournament = () => {
        showConfirm("Are you sure you want to finish the tournament early? Results will be saved based on current progress.", () => {
            const t = { ...activeTournament }
            t.status = 'completed'

            if (!t.winner) {
                if (t.phase === 'swiss') {
                    const sorted = [...t.swiss.standings].sort((a, b) => b.score !== a.score ? b.score - a.score : b.pointDiff - a.pointDiff)
                    t.winner = sorted[0]?.player || t.players[0]
                } else {
                    const gf = t.rounds.find(r => r.bracket === 'grand_final' || r.name === 'Grand Final')
                    t.winner = gf?.matches[0]?.winner || t.players[0]
                }
            }

            finishTournament(t)
            setActiveTournament(t)
        })
    }

    // ─── Render ────────────────────────────────────

    if (!activeTournament) {
        return <TournamentSetup users={users} onStart={handleStartTournament} isAdmin={isAdmin} />
    }

    // Find selected match info for Modal
    let modalPlayer1 = null, modalPlayer2 = null, modalDebuffs = null
    if (selectedMatchId?.type === 'swiss') {
        modalPlayer1 = selectedMatchId.player1
        modalPlayer2 = selectedMatchId.player2
    } else if (selectedMatchId?.type === 'bracket') {
        const r = activeTournament.rounds[selectedMatchId.roundIndex]
        const m = r?.matches.find(m => m.id === selectedMatchId.matchId)
        if (m) {
            modalPlayer1 = m.player1
            modalPlayer2 = m.player2
            modalDebuffs = m.debuffs
        }
    }

    const formatLabel = activeTournament.format === 'double_elim' ? 'Double Elimination' : 'Single Elimination'
    const phaseLabel = activeTournament.phase === 'swiss' ? ' • Swiss Stage' : ''

    return (
        <div className="flex flex-col h-full min-h-[600px]">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                        <Trophy className="mr-2 text-yellow-500" />
                        {activeTournament.name}
                    </h2>
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">
                        {activeTournament.status === 'active' ? '🔴 Live' : '🏁 Completed'} • {formatLabel}{phaseLabel}
                    </div>
                </div>
                {isAdmin && (
                    <div className="flex gap-2">
                        {activeTournament.status === 'active' && (
                            <button onClick={handleManuallyFinishTournament} className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors flex items-center font-bold">
                                <Trophy size={18} className="mr-1" /> Finish
                            </button>
                        )}
                        <button onClick={handleCloseTournament} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center">
                            <X size={20} className="mr-1" /> {activeTournament.status === 'active' ? 'Cancel' : 'Exit View'}
                        </button>
                    </div>
                )}
            </div>

            {/* Swiss Phase */}
            {activeTournament.phase === 'swiss' && activeTournament.swiss && (
                <div className="space-y-6 mb-6">
                    {/* Swiss Standings */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">
                            Swiss Standings — Round {activeTournament.swiss.currentRound}/{activeTournament.swiss.totalRounds}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <th className="text-left p-2 font-bold text-gray-500 dark:text-gray-400">#</th>
                                        <th className="text-left p-2 font-bold text-gray-500 dark:text-gray-400">Player</th>
                                        <th className="text-center p-2 font-bold text-gray-500 dark:text-gray-400">W</th>
                                        <th className="text-center p-2 font-bold text-gray-500 dark:text-gray-400">PF</th>
                                        <th className="text-center p-2 font-bold text-gray-500 dark:text-gray-400">PA</th>
                                        <th className="text-center p-2 font-bold text-gray-500 dark:text-gray-400">Diff</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...activeTournament.swiss.standings]
                                        .sort((a, b) => b.score !== a.score ? b.score - a.score : b.pointDiff - a.pointDiff)
                                        .map((s, idx) => (
                                            <tr key={s.playerId} className="border-b border-gray-100 dark:border-gray-800">
                                                <td className="p-2 font-mono text-gray-400">{idx + 1}</td>
                                                <td className="p-2 font-bold text-gray-900 dark:text-white">{s.playerName}{s.hadBye ? ' 🔄' : ''}</td>
                                                <td className="p-2 text-center font-bold text-green-600 dark:text-green-400">{s.score}</td>
                                                <td className="p-2 text-center text-gray-600 dark:text-gray-300">{s.pointsFor}</td>
                                                <td className="p-2 text-center text-gray-600 dark:text-gray-300">{s.pointsAgainst}</td>
                                                <td className={`p - 2 text - center font - bold ${s.pointDiff > 0 ? 'text-green-600' : s.pointDiff < 0 ? 'text-red-500' : 'text-gray-400'} `}>{s.pointDiff > 0 ? '+' : ''}{s.pointDiff}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Current Pairings */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">Round {activeTournament.swiss.currentRound} Pairings</h3>
                        <div className="space-y-3">
                            {activeTournament.swiss.currentPairings.map((pairing, idx) => {
                                const p1 = activeTournament.players.find(p => p.id === pairing.player1Id)
                                const p2 = activeTournament.players.find(p => p.id === pairing.player2Id)
                                const isDone = (activeTournament.swiss.completedMatches || []).some(c =>
                                    (c.player1Id === pairing.player1Id && c.player2Id === pairing.player2Id) ||
                                    (c.player1Id === pairing.player2Id && c.player2Id === pairing.player1Id)
                                )
                                return (
                                    <div key={idx}
                                        onClick={() => !isDone && handleSwissMatchClick(pairing)}
                                        className={`flex items - center justify - between p - 4 rounded - lg border transition - all ${isDone
                                            ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-900/10'
                                            : isAdmin ? 'border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-400 hover:shadow-md' : 'border-gray-200 dark:border-gray-700'
                                            } `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                                {p1?.avatar_url && <img src={p1.avatar_url} className="w-full h-full object-cover" alt="" />}
                                            </div>
                                            <span className="font-bold text-gray-900 dark:text-white">{p1?.name}</span>
                                        </div>
                                        <span className="text-gray-400 font-bold">VS</span>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-gray-900 dark:text-white">{p2?.name}</span>
                                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                                {p2?.avatar_url && <img src={p2.avatar_url} className="w-full h-full object-cover" alt="" />}
                                            </div>
                                        </div>
                                        {isDone && <span className="text-green-500 font-bold text-sm">✓</span>}
                                    </div>
                                )
                            })}
                            {activeTournament.swiss.byePlayerId && (
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
                                    🔄 <strong>{activeTournament.players.find(p => p.id === activeTournament.swiss.byePlayerId)?.name}</strong> receives a bye this round
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Bracket Phase */}
            {activeTournament.phase === 'bracket' && (
                <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden relative">
                    {(() => {
                        try {
                            if (!activeTournament.rounds || !Array.isArray(activeTournament.rounds)) {
                                throw new Error("Missing rounds data")
                            }
                            return (
                                <BracketView
                                    rounds={activeTournament.rounds}
                                    onMatchClick={handleMatchClick}
                                    readOnly={!isAdmin || activeTournament.status === 'completed'}
                                    champion={activeTournament.winner}
                                    format={activeTournament.format}
                                />
                            )
                        } catch (err) {
                            console.error("Render Error in Tournament:", err)
                            return (
                                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-red-500">
                                    <AlertTriangle size={48} className="mb-4" />
                                    <h3 className="text-xl font-bold mb-2">Tournament Data Error</h3>
                                    <p className="mb-6">The tournament data seems to be corrupted.</p>
                                    <button onClick={() => { localStorage.removeItem(STORAGE_KEY); setActiveTournament(null) }}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold">
                                        Reset Tournament Data
                                    </button>
                                </div>
                            )
                        }
                    })()}
                </div>
            )}

            {/* Match Modal */}
            {modalPlayer1 && modalPlayer2 && (
                <MatchModal
                    isOpen={!!selectedMatchId}
                    onClose={() => setSelectedMatchId(null)}
                    player1={modalPlayer1}
                    player2={modalPlayer2}
                    onMatchSaved={selectedMatchId?.type === 'swiss' ? handleSwissMatchSaved : handleMatchSaved}
                    matches={globalMatches}
                    tournamentId={activeTournament.id}
                    debuffs={modalDebuffs}
                />
            )}
        </div>
    )
}

export default Tournament
