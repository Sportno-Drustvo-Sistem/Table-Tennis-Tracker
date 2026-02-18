import { supabase } from '../../supabaseClient'
import TournamentSetup from './TournamentSetup'
import BracketView from './BracketView'
import MatchModal from '../modals/MatchModal'
import { Trophy, RefreshCw, X, ShieldAlert } from 'lucide-react'
import { getActiveDebuffs, getRandomDebuff } from '../../utils'

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
    const [cachedDebuffs, setCachedDebuffs] = useState([])

    // Match Execution State
    const [selectedMatchId, setSelectedMatchId] = useState(null)

    // Local Persistence Key
    const STORAGE_KEY = 'pingpong_active_tournament'

    useEffect(() => {
        // Check local storage for active tournament state first
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                // Validate essential structure to prevent crashes from stale data
                const isValid = parsed &&
                    parsed.rounds &&
                    Array.isArray(parsed.rounds) &&
                    parsed.rounds.every(r => r.matches && Array.isArray(r.matches))

                if (isValid) {
                    setActiveTournament(parsed)
                    // Ensure we have debuffs cached if needed
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

    // Helper to assign debuffs to a match
    const assignDebuffsToMatch = (match, debuffsPool, usersMap) => {
        if (!debuffsPool || debuffsPool.length === 0) return match

        const p1 = match.player1
        const p2 = match.player2

        if (p1 && p2) {
            // Find full user objects to get Elo
            const u1 = usersMap[p1.id] || p1
            const u2 = usersMap[p2.id] || p2

            const p1Elo = u1.elo_rating || 1200
            const p2Elo = u2.elo_rating || 1200

            // Assign debuffs
            const d1 = getRandomDebuff(debuffsPool, p1Elo)
            const d2 = getRandomDebuff(debuffsPool, p2Elo)

            match.debuffs = {
                [p1.id]: d1,
                [p2.id]: d2
            }
        }
        return match
    }

    const handleStartTournament = async ({ name, playerIds, format, useSwissSeeding, mayhemMode }) => {
        // 0. Fetch debuffs
        // Always fetch to ensure we have them for streaks/mayhem
        const debuffsPool = await getActiveDebuffs()
        setCachedDebuffs(debuffsPool)

        // 1. Create Tournament in DB
        const { data: tourneyData, error: tourneyError } = await supabase
            .from('tournaments')
            .insert({
                name,
                format,
                status: 'active',
                config: { mayhemMode, useSwissSeeding }
            })
            .select()
            .single()

        if (tourneyError) {
            alert('Error starting tournament: ' + tourneyError.message)
            return
        }

        const tournamentId = tourneyData.id

        // 2. Setup Initial Bracket
        const participants = shuffle(users.filter(u => playerIds.includes(u.id)))

        // User Map for Elo lookup
        const usersMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {})

        // Simple Single Elim Logic for now
        let rounds = generateSingleEliminationBracket(participants, mayhemMode, debuffsPool, usersMap)

        const newTournament = {
            id: tournamentId,
            name,
            format,
            players: participants,
            rounds,
            status: 'active',
            winner: null,
            config: { mayhemMode, useSwissSeeding }
        }

        setActiveTournament(newTournament)
    }

    const generateSingleEliminationBracket = (participants, mayhemMode, debuffsPool, usersMap) => {
        const count = participants.length
        let size = 2;
        while (size < count) size *= 2;

        const filledParticipants = [...participants]
        while (filledParticipants.length < size) {
            filledParticipants.push(null) // Bye slot
        }

        // Round 1
        const matches = []
        for (let i = 0; i < size; i += 2) {
            const p1 = filledParticipants[i]
            const p2 = filledParticipants[i + 1]

            let match = {
                id: `r1_m${i / 2}`,
                player1: p1,
                player2: p2,
                score1: null,
                score2: null,
                winner: (!p1 && p2) ? p2 : ((p1 && !p2) ? p1 : null), // Auto-advance byes
                isBye: !p1 || !p2
            }

            // Assign Debuffs if Mayhem Mode
            if (mayhemMode && !match.isBye && !match.winner) {
                match = assignDebuffsToMatch(match, debuffsPool, usersMap)
            }

            matches.push(match)
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
                    player1: null,
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

        if (activeTournament && activeTournament.rounds) {
            activeTournament.rounds.forEach((r, rIdx) => {
                const m = r.matches.find(m => m.id === matchId)
                if (m) {
                    match = m
                    roundIndex = rIdx
                }
            })
        }

        if (match && match.player1 && match.player2 && !match.winner) {
            setSelectedMatchId({ matchId, roundIndex })
        }
    }

    const handleMatchSaved = async () => {
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
        if (!dbMatch.tournament_id) {
            await supabase.from('matches').update({ tournament_id: newTournament.id }).eq('id', dbMatch.id)
        }

        // Use cached debuffs or fetch if missing (though we should have them)
        let debuffsPool = cachedDebuffs
        if (!debuffsPool || debuffsPool.length === 0) {
            debuffsPool = await getActiveDebuffs()
            setCachedDebuffs(debuffsPool)
        }
        const usersMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {})

        // Propagate to next round
        const nextRoundIdx = roundIdx + 1
        if (nextRoundIdx < newTournament.rounds.length) {
            const nextMatchIdx = Math.floor(matchIndex / 2)
            const isPlayer1Slot = matchIndex % 2 === 0

            const nextRound = newTournament.rounds[nextRoundIdx]
            const nextMatch = nextRound.matches[nextMatchIdx]

            if (isPlayer1Slot) nextMatch.player1 = winner
            else nextMatch.player2 = winner

            // Check if both players are now ready in the next match
            if (nextMatch.player1 && nextMatch.player2 && newTournament.config?.mayhemMode) {
                // Calculate debuffs for the new matchup
                const p1 = nextMatch.player1
                const p2 = nextMatch.player2
                // Note: assignDebuffsToMatch mutates the object, which is fine here since we cloned the tournament state via spread? 
                // Actually we only shallow cloned tournament, rounds array is same ref? 
                // We should be careful. React state immutability.
                // Ideally we deep clone, but for this simple app lets just mutate the deep objects as we are calling setActiveTournament with new reference for top object.
                assignDebuffsToMatch(nextMatch, debuffsPool, usersMap)
            }

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
    let modalDebuffs = null
    if (selectedMatchId) {
        const r = activeTournament.rounds[selectedMatchId.roundIndex]
        const m = r.matches.find(m => m.id === selectedMatchId.matchId)
        if (m) {
            modalPlayer1 = m.player1
            modalPlayer2 = m.player2
            modalDebuffs = m.debuffs
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
                    rounds={activeTournament.rounds || []}
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
                    debuffs={modalDebuffs}
                />
            )}
        </div>
    )
}

export default Tournament
