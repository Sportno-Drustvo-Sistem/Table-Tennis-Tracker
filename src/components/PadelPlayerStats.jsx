import React, { useState, useMemo, useEffect } from 'react'
import { Users, Calendar } from 'lucide-react'
import DateRangePicker from './DateRangePicker'
import { getMatchWinner } from '../padelUtils'

const PadelPlayerStats = ({ users, matches, padelStats, initialPlayerId }) => {
    const [selectedPlayerId, setSelectedPlayerId] = useState(initialPlayerId || (users[0]?.id || ''))
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    useEffect(() => {
        if (initialPlayerId) setSelectedPlayerId(initialPlayerId)
    }, [initialPlayerId])

    const selectedPlayer = users.find(u => u.id === selectedPlayerId)

    // Get padel stats for selected player
    const playerPadelStats = useMemo(() => {
        return (padelStats || []).find(s => s.user_id === selectedPlayerId)
    }, [padelStats, selectedPlayerId])

    const stats = useMemo(() => {
        if (!selectedPlayerId) return null

        // Filter padel matches involving this player
        const relevantMatches = matches.filter(match => {
            const isParticipant = [
                match.team1_player1_id,
                match.team1_player2_id,
                match.team2_player1_id,
                match.team2_player2_id
            ].includes(selectedPlayerId)
            if (!isParticipant) return false

            const matchDate = new Date(match.created_at)
            const start = startDate ? new Date(startDate) : new Date('2000-01-01')
            const end = endDate ? new Date(endDate) : new Date()
            end.setHours(23, 59, 59, 999)
            return matchDate >= start && matchDate <= end
        })

        let matchWins = 0
        let matchLosses = 0
        let totalGamesWon = 0
        let totalGamesLost = 0
        let totalSetsWon = 0
        let totalSetsLost = 0

        const partnerStats = {} // Track performance with each partner
        const timeline = []

        relevantMatches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        relevantMatches.forEach(match => {
            const isTeam1 = [match.team1_player1_id, match.team1_player2_id].includes(selectedPlayerId)

            let myGames = isTeam1 ? match.score1 : match.score2
            let opponentGames = isTeam1 ? match.score2 : match.score1

            let mySets = 0
            let opponentSets = 0

            if (match.sets_data && match.sets_data.length > 0) {
                match.sets_data.forEach(s => {
                    if (isTeam1) {
                        if (s.team1Games > s.team2Games) mySets++;
                        else if (s.team2Games > s.team1Games) opponentSets++;
                    } else {
                        if (s.team2Games > s.team1Games) mySets++;
                        else if (s.team1Games > s.team2Games) opponentSets++;
                    }
                })
            } else {
                // legacy match fallback
                if (myGames > opponentGames) mySets++;
                else if (opponentGames > myGames) opponentSets++;
            }

            const winner = getMatchWinner(match)
            const isWin = (winner === 1 && isTeam1) || (winner === 2 && !isTeam1)

            // Find partner
            let partnerId
            if (isTeam1) {
                partnerId = match.team1_player1_id === selectedPlayerId
                    ? match.team1_player2_id
                    : match.team1_player1_id
            } else {
                partnerId = match.team2_player1_id === selectedPlayerId
                    ? match.team2_player2_id
                    : match.team2_player1_id
            }

            // Find opponents
            const opponentIds = isTeam1
                ? [match.team2_player1_id, match.team2_player2_id]
                : [match.team1_player1_id, match.team1_player2_id]

            if (isWin) matchWins++
            else if (winner !== 0) matchLosses++

            totalGamesWon += myGames
            totalGamesLost += opponentGames
            totalSetsWon += mySets
            totalSetsLost += opponentSets

            // Partner stats
            if (!partnerStats[partnerId]) {
                partnerStats[partnerId] = { wins: 0, losses: 0, matches: 0 }
            }
            partnerStats[partnerId].matches++
            if (isWin) partnerStats[partnerId].wins++
            else partnerStats[partnerId].losses++

            timeline.push({
                id: match.id,
                date: match.created_at,
                result: isWin ? 'W' : 'L',
                score: `${mySets}-${opponentSets}`,
                gamesScore: `${myGames}-${opponentGames}`,
                setsData: match.sets_data,
                isTeam1,
                partnerId,
                opponentIds
            })
        })

        // Calculate Streak based on Matches
        let currentStreak = 0
        let streakType = null
        for (let item of timeline) {
            if (!streakType) {
                streakType = item.result
                currentStreak = 1
            } else if (item.result === streakType) {
                currentStreak++
            } else {
                break
            }
        }

        const matchesPlayed = matchWins + matchLosses

        return {
            matchesPlayed,
            matchWins,
            matchLosses,
            totalSetsWon,
            totalSetsLost,
            totalGamesWon,
            totalGamesLost,
            matchWinRate: matchesPlayed > 0 ? (matchWins / matchesPlayed) * 100 : 0,
            setWinRate: (totalSetsWon + totalSetsLost) > 0 ? (totalSetsWon / (totalSetsWon + totalSetsLost)) * 100 : 0,
            partnerStats,
            timeline,
            streak: streakType ? `${currentStreak}${streakType}` : '-',
            streakType
        }
    }, [selectedPlayerId, matches, startDate, endDate])

    if (!selectedPlayer) return <div>Select a player</div>

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-2 border-green-500 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-4">
                    <img
                        src={selectedPlayer.avatar_url || 'https://via.placeholder.com/150'}
                        className="w-20 h-20 rounded-full border-4 border-gray-100 dark:border-gray-700 object-cover"
                        alt={selectedPlayer.name}
                    />
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{selectedPlayer.name}</h2>
                        <div className="text-green-600 dark:text-green-400 font-semibold">{stats?.matchesPlayed || 0} Padel Matches Played</div>
                    </div>
                </div>

                <div>
                    <select
                        value={selectedPlayerId}
                        onChange={e => setSelectedPlayerId(e.target.value)}
                        className="p-3 bg-gray-50 dark:bg-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-medium"
                    >
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                </div>
            </div>

            <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
            />

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                <div className="col-span-2 bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-800 flex flex-col justify-center items-center text-center">
                    <div className="text-yellow-800 dark:text-yellow-400 text-sm font-bold uppercase tracking-wider">ELO Rating</div>
                    <div className="text-5xl font-extrabold text-yellow-600 dark:text-yellow-400 mt-2">
                        {(playerPadelStats?.matches_played || 0) >= 10
                            ? playerPadelStats?.elo_rating || 1200
                            : <span className="text-2xl">Placement</span>
                        }
                    </div>
                </div>

                <div className="col-span-2 bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-800">
                    <div className="text-green-800 dark:text-green-400 text-sm font-bold uppercase tracking-wider">Matches</div>
                    <div className="flex justify-between items-end mt-2">
                        <div className="text-4xl font-extrabold text-green-600 dark:text-green-400">{stats?.matchWins}W</div>
                        <div className="text-2xl font-bold text-gray-400">{stats?.matchLosses}L</div>
                    </div>
                    <div className="text-xs font-bold text-green-600/80 dark:text-green-400/80 mt-1">{stats?.matchWinRate.toFixed(1)}% WR</div>
                </div>

                <div className="col-span-2 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                    <div className="text-blue-800 dark:text-blue-400 text-sm font-bold uppercase tracking-wider">Sets</div>
                    <div className="flex justify-between items-end mt-2">
                        <div className="text-4xl font-extrabold text-blue-600 dark:text-blue-400">{stats?.totalSetsWon}W</div>
                        <div className="text-2xl font-bold text-gray-400">{stats?.totalSetsLost}L</div>
                    </div>
                    <div className="text-xs font-bold text-blue-600/80 dark:text-blue-400/80 mt-1">{stats?.setWinRate.toFixed(1)}% WR</div>
                </div>

                <div className="col-span-2 bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-800">
                    <div className="text-purple-800 dark:text-purple-400 text-sm font-bold uppercase tracking-wider">Games</div>
                    <div className="flex justify-between items-end mt-2">
                        <div className="text-4xl font-extrabold text-purple-600 dark:text-purple-400">{stats?.totalGamesWon}W</div>
                        <div className="text-2xl font-bold text-gray-400">{stats?.totalGamesLost}L</div>
                    </div>
                    <div className="text-xs font-bold text-purple-600/80 dark:text-purple-400/80 mt-1">{stats?.totalGamesWon - stats?.totalGamesLost > 0 ? '+' : ''}{stats?.totalGamesWon - stats?.totalGamesLost} Diff</div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Partner Performance */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-4 flex items-center text-gray-900 dark:text-white"><Users className="mr-2 text-blue-500" size={20} /> Partner Synergy</h3>
                    <div className="space-y-3">
                        {Object.entries(stats?.partnerStats || {}).length === 0 && <div className="text-gray-400 dark:text-gray-500">No data in this period</div>}
                        {Object.entries(stats?.partnerStats || {})
                            .sort(([, a], [, b]) => b.matches - a.matches)
                            .map(([partnerId, record]) => {
                                const partner = users.find(u => u.id === partnerId)
                                if (!partner) return null
                                const winPct = ((record.wins / record.matches) * 100).toFixed(0)
                                return (
                                    <div key={partnerId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <div className="flex items-center">
                                            <img src={partner.avatar_url || 'https://via.placeholder.com/30'} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 object-cover mr-3" alt="" />
                                            <span className="font-bold text-gray-700 dark:text-gray-200">{partner.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono font-bold text-gray-900 dark:text-white">{record.wins}W - {record.losses}L</div>
                                            <div className={`text-xs font-bold ${Number(winPct) >= 50 ? 'text-green-600 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'}`}>{winPct}% Win Rate</div>
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                </div>

                {/* Recent Matches */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-4 flex items-center text-gray-900 dark:text-white">
                        <Calendar className="mr-2 text-green-500" size={20} />
                        Match History
                        {stats?.streakType && (
                            <span className={`ml-auto text-xs px-2 py-1 rounded-full ${stats.streakType === 'W' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                {stats.streak} Streak
                            </span>
                        )}
                    </h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {stats?.timeline.length === 0 && <div className="text-gray-400 dark:text-gray-500">No matches found</div>}
                        {stats?.timeline.map(item => {
                            const partner = users.find(u => u.id === item.partnerId)
                            const opponents = item.opponentIds.map(id => users.find(u => u.id === id)).filter(Boolean)
                            return (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                                    <span className="text-gray-500 dark:text-gray-400 font-mono w-24 whitespace-nowrap overflow-hidden text-ellipsis mr-2 text-xs">{new Date(item.date).toLocaleDateString()}</span>

                                    <div className="flex flex-col items-center flex-1 justify-center px-1">
                                        <div className="flex items-center">
                                            <span className={`font-bold mr-2 ${item.result === 'W' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{item.result}</span>
                                            <span className="font-mono font-bold text-gray-900 dark:text-white text-base">{item.score} <span className="text-xs text-gray-400 font-normal">Sets</span></span>
                                        </div>
                                        {/* Show set scores below */}
                                        {item.setsData && item.setsData.length > 0 && (
                                            <div className="flex space-x-1 mt-1 font-mono text-[10px] text-gray-500 dark:text-gray-400">
                                                {item.setsData.map((s, idx) => {
                                                    const myGames = item.isTeam1 ? s.team1Games : s.team2Games;
                                                    const oppGames = item.isTeam1 ? s.team2Games : s.team1Games;
                                                    return <span key={idx} className="bg-gray-200 dark:bg-gray-600 px-1 rounded">{myGames}-{oppGames}</span>
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end gap-2 shrink-0">
                                        <span className="text-xs text-gray-400">w/</span>
                                        <img src={partner?.avatar_url} className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 object-cover" alt="" title={partner?.name} />
                                        <span className="text-xs text-gray-400">vs</span>
                                        <div className="flex -space-x-1.5 hover:space-x-0 transition-all">
                                            {opponents.map((opp, i) => (
                                                <img key={opp.id} src={opp.avatar_url} className={`w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 object-cover border border-white dark:border-gray-800 z-[${2 - i}]`} alt="" title={opp.name} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PadelPlayerStats
