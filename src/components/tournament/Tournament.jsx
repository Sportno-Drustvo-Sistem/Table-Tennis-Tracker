import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabaseClient'
import TournamentSetup from './TournamentSetup'
import BracketView from './BracketView'
import MatchModal from '../modals/MatchModal'
import { Trophy, RefreshCw, X, ShieldAlert } from 'lucide-react'

// Helper to shuffle array
const shuffle = (array) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

const Tournament = ({ users, isAdmin, matches: globalMatches, fetchData }) => {
    // State
    const [activeTournament, setActiveTournament] = useState(null) // { id, name, rounds, players, status }
    const [loading, setLoading] = useState(true)

    // Match Execution State
    const [selectedMatchId, setSelectedMatchId] = useState(null)

    // Local Persistence Key
    const STORAGE_KEY = 'pingpong_active_tournament'

    useEffect(() => {
        // Check local storage for active tournament state first
        // In a real expanded version, we'd fetch "active" tournament from DB.
        // However, to keep it simple and responsive as requested, we sync local state mainly 
        // and rely on DB only for history.
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            try {
                setActiveTournament(JSON.parse(saved))
            } catch (e) {
                console.error("Failed to parse saved tournament", e)
            }
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (activeTournament) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(activeTournament))
        } else {
            // Don't clear immediately if null to avoid flicker if we change logic, 
            // but for now strict sync is fine.
            // localStorage.removeItem(STORAGE_KEY) 
        }
    }, [activeTournament])

    const handleStartTournament = async ({ name, playerIds, format, useSwissSeeding }) => {
        // 1. Create Tournament in DB
        const { data: tourneyData, error: tourneyError } = await supabase
            .from('tournaments')
            .insert({ name, format, status: 'active' })
            .select()
            .single()

        if (tourneyError) {
            alert('Error starting tournament: ' + tourneyError.message)
            return
        }

        const tournamentId = tourneyData.id

        // 2. Setup Initial Bracket
        const participants = shuffle(users.filter(u => playerIds.includes(u.id)))

        // Simple Single Elim Logic for now (Expand for Double/Swiss later or next step loops)
        let rounds = generateSingleEliminationBracket(participants)

        const newTournament = {
            id: tournamentId,
            name,
            format,
            players: participants,
            rounds,
            status: 'active',
            winner: null
        }

        setActiveTournament(newTournament)
    }

    const generateSingleEliminationBracket = (participants) => {
        // Needs to be power of 2 size usually, or handle byes.
        // For MVP we enforce 4, 8, 16 in UI or handle simple byes if not.
        // Let's assume we pad with "Bye" users if needed or just valid power of 2 for simplicity 1st pass.
        // Actually, let's pad closely.

        const count = participants.length
        let size = 2;
        while (size < count) size *= 2;

        const filledParticipants = [...participants]
        while (filledParticipants.length < size) {
            filledParticipants.push(null) // Bye slot (though we might want distinct Bye object)
        }

        // Round 1
        const matches = []
        for (let i = 0; i < size; i += 2) {
            const p1 = filledParticipants[i]
            const p2 = filledParticipants[i + 1]
            matches.push({
                id: `r1_m${i / 2}`,
                player1: p1,
                player2: p2,
                score1: null,
                score2: null,
                winner: (!p1 && p2) ? p2 : ((p1 && !p2) ? p1 : null), // Auto-advance byes
                isBye: !p1 || !p2
            })
        }

        // Subsequent Rounds
        const allRounds = [{ name: 'Round 1', matches }]
        let currentSize = matches.length
        let roundNum = 2

        while (currentSize > 1) {
            const nextMatches = []
            for (let i = 0; i < currentSize; i += 2) {
                nextMatches.push({
                    id: `r${roundNum}_m${i / 2}`,
                    player1: null, // Will be filled by winners
                    player2: null,
                    score1: null,
                    score2: null,
                    winner: null
                })
            }
            allRounds.push({ name: currentSize === 2 ? 'Grand Final' : (currentSize === 4 ? 'Semi-Finals' : `Round ${roundNum}`), matches: nextMatches })
            currentSize /= 2
            roundNum++
        }

        return allRounds
    }

    const handleMatchClick = (matchId) => {
        if (!isAdmin) return

        // Find match
        let match = null
        let roundIndex = -1

        activeTournament.rounds.forEach((r, rIdx) => {
            const m = r.matches.find(m => m.id === matchId)
            if (m) {
                match = m
                roundIndex = rIdx
            }
        })

        if (match && match.player1 && match.player2 && !match.winner) {
            setSelectedMatchId({ matchId, roundIndex })
        }
    }

    const handleMatchSaved = async () => {
        // Fetch the latest match from DB (or we trust the local modal save for now... 
        // but we need the outcome to update bracket).
        // Actually, MatchModal calls onMatchSaved after saving to DB.
        // We need to know WHO won.
        // To avoid complex fetching, we can pass a callback to MatchModal or just refetch global matches?
        // Better: We query the last match added for these 2 players or rely on what we know.
        // Simplest: We won't use the standard MatchModal directly without modification or wrapper
        // because we need to know the result immediately to update local bracket state.

        // WAIT. The standard MatchModal saves to Supabase `matches`.
        // We need that ID to link to tournament? Or we pass tournament_id to MatchModal?
        // Existing MatchModal doesn't know about tournaments.
        // We might need to Modify MatchModal or wrap the save logic.

        // For now, let's assume `fetchData` is called by MatchModal, we update global matches.
        // We also need to update the LOCAL bracket correctly.
        // Let's cheat a bit: We will use a specialized handling here or intercept the save.

        // Actually, standard MatchModal takes `onMatchSaved`. We can query the DB for the match 
        // that was just created (timestamp desc limit 1) to get the score.

        const { data: latestMatch } = await supabase
            .from('matches')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (latestMatch) {
            // Update bracket
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

        // Determine winner based on DB match
        const p1Id = match.player1.id
        const p2Id = match.player2.id

        // Verify DB match matches our players (sanity check)
        if ((dbMatch.player1_id !== p1Id && dbMatch.player1_id !== p2Id)) return

        const winnerId = dbMatch.score1 > dbMatch.score2 ? dbMatch.player1_id : dbMatch.player2_id
        const winner = winnerId === p1Id ? match.player1 : match.player2

        // Update this match
        match.score1 = dbMatch.player1_id === p1Id ? dbMatch.score1 : dbMatch.score2
        match.score2 = dbMatch.player2_id === p1Id ? dbMatch.score2 : dbMatch.score1
        match.winner = winner
        match.dbMatchId = dbMatch.id // Link persistence

        // If needed, update Supabase match with tournament_id if not already done
        // (Ideally we'd pass tournament_id to the creation, but MatchModal doesn't have it yet.
        // We can patch it here.)
        if (!dbMatch.tournament_id) {
            await supabase.from('matches').update({ tournament_id: newTournament.id }).eq('id', dbMatch.id)
        }

        // Propagate to next round
        const nextRoundIdx = roundIdx + 1
        if (nextRoundIdx < newTournament.rounds.length) {
            // Calculate destination match index. 
            // R1 M0 -> R2 M0 (P1 slot)
            // R1 M1 -> R2 M0 (P2 slot)
            // R1 M2 -> R2 M1 (P1 slot)
            // ...
            const nextMatchIdx = Math.floor(matchIndex / 2)
            const isPlayer1Slot = matchIndex % 2 === 0

            const nextRound = newTournament.rounds[nextRoundIdx]
            const nextMatch = nextRound.matches[nextMatchIdx]

            if (isPlayer1Slot) nextMatch.player1 = winner
            else nextMatch.player2 = winner
        } else {
            // Tournament Over! Champion found.
            newTournament.status = 'completed'
            newTournament.winner = winner
            finishTournament(newTournament)
        }

        setActiveTournament(newTournament)
    }

    const finishTournament = async (tournament) => {
        // 1. Update Tournament Status
        await supabase
            .from('tournaments')
            .update({ status: 'completed', winner_id: tournament.winner.id })
            .eq('id', tournament.id)

        // 2. Generate Results entries
        // Flatten bracket to find ranks
        // Winner = Rank 1
        // Loser of Final = Rank 2
        // Losers of Semi = Rank 3-4 (or shared 3rd)
        // Losers of QF = Rank 5-8
        const results = []

        const totalRounds = tournament.rounds.length

        // Helper to find round loser
        const processRoundLosers = (roundIndex, rank) => {
            const round = tournament.rounds[roundIndex]
            round.matches.forEach(m => {
                if (m.winner && m.player1 && m.player2) {
                    const loser = m.winner.id === m.player1.id ? m.player2 : m.player1
                    results.push({
                        tournament_id: tournament.id,
                        user_id: loser.id,
                        rank: rank,
                        round_reached: round.name
                    })
                }
            })
        }

        // Add Winner
        results.push({
            tournament_id: tournament.id,
            user_id: tournament.winner.id,
            rank: 1,
            round_reached: 'Winner'
        })

        // Add Losers backwards
        // Final Round (Last index)
        processRoundLosers(totalRounds - 1, 2)

        // Semi Finals
        if (totalRounds >= 2) processRoundLosers(totalRounds - 2, 3) // Shared 3rd

        // Quarter Finals
        if (totalRounds >= 3) processRoundLosers(totalRounds - 3, 5) // Shared 5th

        // Ro16
        if (totalRounds >= 4) processRoundLosers(totalRounds - 4, 9) // Shared 9th

        if (results.length > 0) {
            const { error } = await supabase.from('tournament_results').insert(results)
            if (error) console.error("Error saving results", error)
        }

        // Clear local storage after small delay or manual close? 
        // Actually keep it so they can see the result.
        alert(`Tournament Complete! ${tournament.winner.name} is the champion!`)
    }

    const handleCloseTournament = () => {
        if (confirm("Are you sure you want to close this tournament view? Active tournament data will be cleared from this view (but history remains in DB).")) {
            setActiveTournament(null)
            localStorage.removeItem(STORAGE_KEY)
        }
    }

    // --- Render ---

    if (!activeTournament) {
        return <TournamentSetup users={users} onStart={handleStartTournament} isAdmin={isAdmin} />
    }

    // Find selected match info for Modal
    let modalPlayer1 = null
    let modalPlayer2 = null
    if (selectedMatchId) {
        const r = activeTournament.rounds[selectedMatchId.roundIndex]
        const m = r.matches.find(m => m.id === selectedMatchId.matchId)
        if (m) {
            modalPlayer1 = m.player1
            modalPlayer2 = m.player2
        }
    }

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
                        {activeTournament.status === 'active' ? '🔴 Live' : '🏁 Completed'} • {activeTournament.format === 'double_elim' ? 'Double Elimination' : 'Single Elimination'}
                    </div>
                </div>

                {isAdmin && (
                    <button
                        onClick={handleCloseTournament}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center"
                    >
                        <X size={20} className="mr-1" /> Close
                    </button>
                )}
            </div>

            {/* Bracket Area */}
            <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden relative">
                <BracketView
                    rounds={activeTournament.rounds}
                    onMatchClick={handleMatchClick}
                    readOnly={!isAdmin || activeTournament.status === 'completed'}
                    champion={activeTournament.winner}
                />
            </div>

            {/* Match Modal */}
            {modalPlayer1 && modalPlayer2 && (
                <MatchModal
                    isOpen={!!selectedMatchId}
                    onClose={() => setSelectedMatchId(null)}
                    player1={modalPlayer1}
                    player2={modalPlayer2}
                    onMatchSaved={handleMatchSaved}
                    matches={globalMatches} // Passed for H2H history context inside modal
                    tournamentId={activeTournament.id}
                />
            )}
        </div>
    )
}

export default Tournament
