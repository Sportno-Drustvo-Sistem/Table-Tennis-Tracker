import React, { useState, useMemo, useEffect } from 'react'
import { Activity, Users, Calendar, TrendingUp, TrendingDown, Target } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import DateRangePicker from './DateRangePicker'
import TrophyCase from './TrophyCase'
import Achievements from './Achievements'
import { calculateEloChange, getKFactor, buildEloHistory } from '../utils'

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

        // Build global ELO history to get Max and Min ELO + chart data
        const eloData = buildEloHistory(users, matches)
        const myTimeline = eloData.playerEloTimelines[selectedPlayerId] || []

        let maxElo = 1200
        let minElo = 1200
        if (selectedPlayer?.matches_played > 0) {
            maxElo = -Infinity
            minElo = Infinity
        }

        const eloHistory = myTimeline.map(t => {
            const opp = users.find(u => u.id === t.opponentId)
            if (t.elo > maxElo) maxElo = t.elo
            if (t.elo < minElo) minElo = t.elo
            return {
                matchNum: t.matchNum,
                elo: Math.round(t.elo),
                opponent: opp ? opp.name : (t.matchNum === 0 ? 'Start' : '?'),
                change: Math.round(t.change),
                result: t.result
            }
        })

        if (maxElo === -Infinity) maxElo = 1200
        if (minElo === Infinity) minElo = 1200

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
                opponentScore,
                tournamentName: match.tournaments?.name
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
            streakType,
            streak: currentStreak,
            maxElo: Math.round(maxElo),
            minElo: Math.round(minElo),
            avgScoreDiff: (wins + losses) > 0 ? ((pointsFor - pointsAgainst) / (wins + losses)).toFixed(1) : 0,
            eloHistory
        }
    }, [selectedPlayerId, matches, startDate, endDate, users])

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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-800">
                    <div className="text-yellow-800 dark:text-yellow-400 text-sm font-bold uppercase">ELO Rating</div>
                    <div className="text-4xl font-extrabold text-yellow-600 dark:text-yellow-400">
                        {(selectedPlayer.matches_played || 0) >= 10
                            ? selectedPlayer.elo_rating
                            : <span className="text-lg">Placement ({selectedPlayer.matches_played || 0}/10)</span>
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
                    <div className="text-purple-800 dark:text-purple-400 text-sm font-bold uppercase flex items-center gap-1"><Target size={14} /> Total +/-</div>
                    <div className="text-4xl font-extrabold text-purple-600 dark:text-purple-400">{stats?.pointsDiff > 0 ? '+' : ''}{stats?.pointsDiff}</div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-xl border border-orange-100 dark:border-orange-800">
                    <div className="text-orange-800 dark:text-orange-400 text-[11px] sm:text-sm font-bold uppercase flex items-center gap-1"><Target size={14} /> Avg +/-</div>
                    <div className="text-3xl sm:text-4xl font-extrabold text-orange-600 dark:text-orange-400">{stats?.avgScoreDiff > 0 ? '+' : ''}{stats?.avgScoreDiff}</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
                    <div className="text-emerald-800 dark:text-emerald-400 text-sm font-bold uppercase flex items-center gap-1"><TrendingUp size={14} /> Max ELO</div>
                    <div className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400">{stats?.maxElo}</div>
                </div>
                <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-100 dark:border-rose-800">
                    <div className="text-rose-800 dark:text-rose-400 text-sm font-bold uppercase flex items-center gap-1"><TrendingDown size={14} /> Min ELO</div>
                    <div className="text-4xl font-extrabold text-rose-600 dark:text-rose-400">{stats?.minElo}</div>
                </div>
            </div>

            {/* ELO History Chart */}
            {stats?.eloHistory?.length > 1 && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-4 flex items-center text-gray-900 dark:text-white">
                        <Activity className="mr-2 text-blue-500" size={20} /> ELO History
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={stats.eloHistory} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                            <XAxis dataKey="matchNum" tick={{ fontSize: 11 }} label={{ value: 'Game #', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                            <ReferenceLine y={1200} stroke="#9ca3af" strokeDasharray="3 3" />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(30,30,30,0.9)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                                formatter={(value, name, props) => {
                                    const d = props.payload
                                    return [`${value} (${d.change > 0 ? '+' : ''}${d.change})`, `vs ${d.opponent} (${d.result})`]
                                }}
                                labelFormatter={(label) => `Game #${label}`}
                            />
                            <Line type="monotone" dataKey="elo" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#3b82f6' }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            <TrophyCase playerId={selectedPlayerId} />

            <Achievements playerId={selectedPlayerId} users={users} matches={matches} />

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
                                    <div className="flex flex-col w-24">
                                        <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">{new Date(item.date).toLocaleDateString()}</span>
                                        {item.tournamentName && (
                                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 truncate" title={item.tournamentName}>
                                                {item.tournamentName}
                                            </span>
                                        )}
                                    </div>
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
