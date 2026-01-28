import React, { useState, useMemo, useEffect } from 'react'
import { Activity, Users, Calendar } from 'lucide-react'
import DateRangePicker from './DateRangePicker'

const PlayerStats = ({ users, matches, initialPlayerId }) => {
    const [selectedPlayerId, setSelectedPlayerId] = useState(initialPlayerId || (users[0]?.id || ''))
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    useEffect(() => {
        if (initialPlayerId) setSelectedPlayerId(initialPlayerId)
    }, [initialPlayerId])

    const selectedPlayer = users.find(u => u.id === selectedPlayerId)

    const stats = useMemo(() => {
        if (!selectedPlayerId) return null

        // 1. Filter matches involving player and within date range
        const relevantMatches = matches.filter(match => {
            const isParticipant = match.player1_id === selectedPlayerId || match.player2_id === selectedPlayerId
            if (!isParticipant) return false

            const matchDate = new Date(match.created_at)
            const start = startDate ? new Date(startDate) : new Date('2000-01-01')
            const end = endDate ? new Date(endDate) : new Date()
            end.setHours(23, 59, 59, 999)
            return matchDate >= start && matchDate <= end
        })

        // 2. Calculate stats
        let wins = 0
        let losses = 0
        let pointsFor = 0
        let pointsAgainst = 0
        const headToHead = {}
        const timeline = []

        relevantMatches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // Sort latest first

        relevantMatches.forEach(match => {
            const isP1 = match.player1_id === selectedPlayerId
            const opponentId = isP1 ? match.player2_id : match.player1_id
            const myScore = isP1 ? match.score1 : match.score2
            const opponentScore = isP1 ? match.score2 : match.score1

            const isWin = myScore > opponentScore

            // Totals
            if (isWin) wins++
            else losses++
            pointsFor += myScore
            pointsAgainst += opponentScore

            // Head to Head
            if (!headToHead[opponentId]) {
                headToHead[opponentId] = { wins: 0, losses: 0, matches: 0 }
            }
            headToHead[opponentId].matches++
            if (isWin) headToHead[opponentId].wins++
            else headToHead[opponentId].losses++

            // Timeline (simplified)
            timeline.push({
                id: match.id,
                date: match.created_at,
                result: isWin ? 'W' : 'L',
                score: `${myScore}-${opponentScore}`,
                opponentId,
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
            headToHead,
            timeline,
            streak: streakType ? `${currentStreak}${streakType}` : '-',
            streakType
        }
    }, [selectedPlayerId, matches, startDate, endDate])

    if (!selectedPlayer) return <div>Select a player</div>

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-2 border-blue-500 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-4">
                    <img
                        src={selectedPlayer.avatar_url || 'https://via.placeholder.com/150'}
                        className="w-20 h-20 rounded-full border-4 border-gray-100 dark:border-gray-700 object-cover"
                        alt={selectedPlayer.name}
                    />
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{selectedPlayer.name}</h2>
                        <div className="text-blue-600 dark:text-blue-400 font-semibold">{stats?.total || 0} Games Played</div>
                    </div>
                </div>

                <div>
                    <select
                        value={selectedPlayerId}
                        onChange={e => setSelectedPlayerId(e.target.value)}
                        className="p-3 bg-gray-50 dark:bg-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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

                {/* Head to Head */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-4 flex items-center text-gray-900 dark:text-white"><Users className="mr-2" size={20} /> Head to Head</h3>
                    <div className="space-y-3">
                        {Object.entries(stats?.headToHead || {}).length === 0 && <div className="text-gray-400 dark:text-gray-500">No data in this period</div>}
                        {Object.entries(stats?.headToHead || {})
                            .sort(([, a], [, b]) => b.matches - a.matches)
                            .map(([oppId, record]) => {
                                const opponent = users.find(u => u.id === oppId)
                                if (!opponent) return null
                                const winPct = ((record.wins / record.matches) * 100).toFixed(0)
                                return (
                                    <div key={oppId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <div className="flex items-center">
                                            <img src={opponent.avatar_url || 'https://via.placeholder.com/30'} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 object-cover mr-3" alt="" />
                                            <span className="font-bold text-gray-700 dark:text-gray-200">{opponent.name}</span>
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
                            const opponent = users.find(u => u.id === item.opponentId)
                            return (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                                    <span className="text-gray-500 dark:text-gray-400 font-mono w-24">{new Date(item.date).toLocaleDateString()}</span>
                                    <div className="flex items-center flex-1 justify-center px-2">
                                        <span className={`font-bold mr-2 ${item.result === 'W' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{item.result}</span>
                                        <span className="font-mono font-bold text-gray-900 dark:text-white">{item.score}</span>
                                    </div>
                                    <div className="flex items-center justify-end w-32 truncate">
                                        <span className="text-gray-600 dark:text-gray-300 mr-2 truncate">{opponent?.name}</span>
                                        <img src={opponent?.avatar_url} className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 object-cover" alt="" />
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

export default PlayerStats
