import React, { useState, useMemo, useEffect } from 'react'
import { Activity, Users, Calendar } from 'lucide-react'
import DateRangePicker from './DateRangePicker'

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

        let wins = 0
        let losses = 0
        let pointsFor = 0
        let pointsAgainst = 0
        const partnerStats = {} // Track performance with each partner
        const timeline = []

        relevantMatches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        relevantMatches.forEach(match => {
            const isTeam1 = [match.team1_player1_id, match.team1_player2_id].includes(selectedPlayerId)
            const myScore = isTeam1 ? match.score1 : match.score2
            const opponentScore = isTeam1 ? match.score2 : match.score1
            const isWin = myScore > opponentScore

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

            if (isWin) wins++
            else losses++
            pointsFor += myScore
            pointsAgainst += opponentScore

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
                score: `${myScore}-${opponentScore}`,
                partnerId,
                opponentIds,
                myScore,
                opponentScore
            })
        })

        // Calculate Streak
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

        return {
            wins,
            losses,
            total: wins + losses,
            winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
            pointsDiff: pointsFor - pointsAgainst,
            avgPoints: (wins + losses) > 0 ? (pointsFor / (wins + losses)).toFixed(1) : 0,
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
                        <div className="text-green-600 dark:text-green-400 font-semibold">{stats?.total || 0} Padel Games Played</div>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-800">
                    <div className="text-yellow-800 dark:text-yellow-400 text-sm font-bold uppercase">Padel ELO</div>
                    <div className="text-4xl font-extrabold text-yellow-600 dark:text-yellow-400">
                        {(playerPadelStats?.matches_played || 0) >= 10
                            ? playerPadelStats?.elo_rating || 1200
                            : <span className="text-lg">Placement ({playerPadelStats?.matches_played || 0}/10)</span>
                        }
                    </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-800">
                    <div className="text-green-800 dark:text-green-400 text-sm font-bold uppercase">Wins</div>
                    <div className="text-4xl font-extrabold text-green-600 dark:text-green-400">{stats?.wins}</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-800">
                    <div className="text-red-800 dark:text-red-400 text-sm font-bold uppercase">Losses</div>
                    <div className="text-4xl font-extrabold text-red-600 dark:text-red-400">{stats?.losses}</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                    <div className="text-blue-800 dark:text-blue-400 text-sm font-bold uppercase">Win Rate</div>
                    <div className="text-4xl font-extrabold text-blue-600 dark:text-blue-400">{stats?.winRate.toFixed(1)}%</div>
                </div>
                <div className={`p-4 rounded-xl border ${stats?.streakType === 'W' ? 'bg-green-100 border-green-200 dark:bg-green-900/20 dark:border-green-800' : (stats?.streakType === 'L' ? 'bg-red-100 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700')}`}>
                    <div className={`${stats?.streakType === 'W' ? 'text-green-800 dark:text-green-400' : (stats?.streakType === 'L' ? 'text-red-800 dark:text-red-400' : 'text-gray-800 dark:text-gray-400')} text-sm font-bold uppercase`}>Streak</div>
                    <div className={`text-4xl font-extrabold ${stats?.streakType === 'W' ? 'text-green-600 dark:text-green-400' : (stats?.streakType === 'L' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400')}`}>{stats?.streak}</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-800">
                    <div className="text-purple-800 dark:text-purple-400 text-sm font-bold uppercase">Point Diff</div>
                    <div className="text-4xl font-extrabold text-purple-600 dark:text-purple-400">{stats?.pointsDiff > 0 ? '+' : ''}{stats?.pointsDiff}</div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Partner Performance */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-4 flex items-center text-gray-900 dark:text-white"><Users className="mr-2" size={20} /> Partner Performance</h3>
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
                                            <div className={`text-xs font-bold ${Number(winPct) > 50 ? 'text-green-600 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'}`}>{winPct}% Win Rate</div>
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                </div>

                {/* Recent Matches */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-4 flex items-center text-gray-900 dark:text-white"><Calendar className="mr-2" size={20} /> Recent Matches</h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {stats?.timeline.length === 0 && <div className="text-gray-400 dark:text-gray-500">No matches found</div>}
                        {stats?.timeline.map(item => {
                            const partner = users.find(u => u.id === item.partnerId)
                            const opponents = item.opponentIds.map(id => users.find(u => u.id === id)).filter(Boolean)
                            return (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                                    <span className="text-gray-500 dark:text-gray-400 font-mono w-24">{new Date(item.date).toLocaleDateString()}</span>
                                    <div className="flex items-center flex-1 justify-center px-2">
                                        <span className={`font-bold mr-2 ${item.result === 'W' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{item.result}</span>
                                        <span className="font-mono font-bold text-gray-900 dark:text-white">{item.score}</span>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 truncate">
                                        <span className="text-xs text-gray-400">w/</span>
                                        <img src={partner?.avatar_url} className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 object-cover" alt="" />
                                        <span className="text-xs text-gray-400">vs</span>
                                        <div className="flex -space-x-1">
                                            {opponents.map(opp => (
                                                <img key={opp.id} src={opp.avatar_url} className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 object-cover border border-white dark:border-gray-800" alt="" />
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
