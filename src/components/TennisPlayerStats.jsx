import React, { useMemo, useState } from 'react'
import { Activity, Calendar, Users } from 'lucide-react'
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import DateRangePicker from './DateRangePicker'
import TrophyCase from './TrophyCase'
import { buildTennisEloHistory, getTennisMatchWinner, getTennisScoreSummary } from '../tennisUtils'
import { getAvatarFallback, getEloRank } from '../utils'

const TennisPlayerStats = ({ users, matches, tennisStats, initialPlayerId }) => {
    const [selectedPlayerId, setSelectedPlayerId] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const activePlayerId = selectedPlayerId || initialPlayerId || (users[0]?.id || '')

    const selectedPlayer = users.find(user => user.id === activePlayerId)
    const playerTennisStats = useMemo(() => {
        return (tennisStats || []).find(stat => stat.user_id === activePlayerId)
    }, [activePlayerId, tennisStats])

    const eloData = useMemo(() => buildTennisEloHistory(users, matches), [matches, users])

    const stats = useMemo(() => {
        if (!activePlayerId) return null

        const relevantMatches = matches.filter(match => {
            const isParticipant = match.player1_id === activePlayerId || match.player2_id === activePlayerId
            if (!isParticipant) return false

            const matchDate = new Date(match.created_at)
            const start = startDate ? new Date(startDate) : new Date('2000-01-01')
            const end = endDate ? new Date(endDate) : new Date()
            end.setHours(23, 59, 59, 999)
            return matchDate >= start && matchDate <= end
        })

        let matchWins = 0
        let matchLosses = 0
        let totalSetsWon = 0
        let totalSetsLost = 0
        let totalGamesWon = 0
        let totalGamesLost = 0
        const headToHead = {}
        const timeline = []

        let maxElo = 1200
        let minElo = 1200
        if (selectedPlayer) {
            maxElo = -Infinity
            minElo = Infinity
        }

        const myTimeline = eloData.playerEloTimelines[activePlayerId] || []
        const eloHistory = myTimeline.map(point => {
            const opponent = users.find(user => user.id === point.opponentId)
            if (point.elo > maxElo) maxElo = point.elo
            if (point.elo < minElo) minElo = point.elo
            return {
                matchNum: point.matchNum,
                elo: Math.round(point.elo),
                opponent: point.matchNum === 0 ? 'Start' : (opponent ? opponent.name : '?'),
                change: Math.round(point.change),
                result: point.result,
            }
        })
        if (maxElo === -Infinity) maxElo = 1200
        if (minElo === Infinity) minElo = 1200

        relevantMatches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        relevantMatches.forEach(match => {
            const isP1 = match.player1_id === activePlayerId
            const opponentId = isP1 ? match.player2_id : match.player1_id
            const summary = getTennisScoreSummary(match)
            const winner = getTennisMatchWinner(match)
            const isWin = (winner === 1 && isP1) || (winner === 2 && !isP1)
            const mySets = isP1 ? summary.player1Sets : summary.player2Sets
            const opponentSets = isP1 ? summary.player2Sets : summary.player1Sets
            const myGames = isP1 ? summary.player1Games : summary.player2Games
            const opponentGames = isP1 ? summary.player2Games : summary.player1Games

            if (isWin) matchWins += 1
            else if (winner !== 0) matchLosses += 1

            totalSetsWon += mySets
            totalSetsLost += opponentSets
            totalGamesWon += myGames
            totalGamesLost += opponentGames

            if (!headToHead[opponentId]) {
                headToHead[opponentId] = { wins: 0, losses: 0, matches: 0 }
            }
            headToHead[opponentId].matches += 1
            if (isWin) headToHead[opponentId].wins += 1
            else headToHead[opponentId].losses += 1

            timeline.push({
                id: match.id,
                date: match.created_at,
                result: isWin ? 'W' : 'L',
                score: `${mySets}-${opponentSets}`,
                gamesScore: `${myGames}-${opponentGames}`,
                setsData: summary.sets,
                isP1,
                opponentId,
            })
        })

        let currentStreak = 0
        let streakType = null
        for (const item of timeline) {
            if (!streakType) {
                streakType = item.result
                currentStreak = 1
            } else if (item.result === streakType) {
                currentStreak += 1
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
            gamesDiff: totalGamesWon - totalGamesLost,
            headToHead,
            timeline,
            streak: streakType ? `${currentStreak}${streakType}` : '-',
            streakType,
            eloHistory,
            maxElo: Math.round(maxElo),
            minElo: Math.round(minElo),
        }
    }, [activePlayerId, eloData, endDate, matches, selectedPlayer, startDate, users])

    if (!users.length) {
        return <div className="text-center py-20 text-gray-500 dark:text-gray-400">No players available.</div>
    }
    if (!selectedPlayer) return <div>Select a player</div>

    const elo = Math.round(playerTennisStats?.elo_rating || 1200)
    const playerRank = getEloRank(elo)

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-2 border-emerald-500 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-4">
                    <img
                        src={selectedPlayer.avatar_url || getAvatarFallback(selectedPlayer.name)}
                        className="w-20 h-20 rounded-full border-4 border-gray-100 dark:border-gray-700 object-cover"
                        alt={selectedPlayer.name}
                    />
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{selectedPlayer.name}</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{stats?.matchesPlayed || 0} Tennis Matches Played</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: playerRank.color, backgroundColor: `${playerRank.color}22` }}>{playerRank.label}</span>
                        </div>
                    </div>
                </div>

                <div>
                    <select
                        value={activePlayerId}
                        onChange={event => setSelectedPlayerId(event.target.value)}
                        className="p-3 bg-gray-50 dark:bg-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                    >
                        {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                </div>
            </div>

            <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
            />

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                <div className="col-span-2 bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-800 flex flex-col justify-center items-center text-center">
                    <div className="text-yellow-800 dark:text-yellow-400 text-sm font-bold uppercase tracking-wider">ELO Rating</div>
                    <div className="text-5xl font-extrabold text-yellow-600 dark:text-yellow-400 mt-2">{elo}</div>
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
                    <div className="text-xs font-bold text-purple-600/80 dark:text-purple-400/80 mt-1">{stats?.gamesDiff > 0 ? '+' : ''}{stats?.gamesDiff} Diff</div>
                </div>

                <div className="col-span-2 bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
                    <div className="text-emerald-800 dark:text-emerald-400 text-sm font-bold uppercase tracking-wider">Max ELO</div>
                    <div className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">{stats?.maxElo}</div>
                </div>

                <div className="col-span-2 bg-rose-50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-100 dark:border-rose-800">
                    <div className="text-rose-800 dark:text-rose-400 text-sm font-bold uppercase tracking-wider">Min ELO</div>
                    <div className="text-4xl font-extrabold text-rose-600 dark:text-rose-400 mt-2">{stats?.minElo}</div>
                </div>
            </div>

            {stats?.eloHistory?.length > 1 && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-4 flex items-center text-gray-900 dark:text-white">
                        <Activity className="mr-2 text-blue-500" size={20} /> ELO History
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={stats.eloHistory} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                            <XAxis dataKey="matchNum" tick={{ fontSize: 11 }} label={{ value: 'Match #', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                            <ReferenceLine y={1200} stroke="#9ca3af" strokeDasharray="3 3" />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(30,30,30,0.9)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                                formatter={(value, name, props) => {
                                    const point = props.payload
                                    return [`${value} (${point.change > 0 ? '+' : ''}${point.change})`, `vs ${point.opponent} (${point.result})`]
                                }}
                                labelFormatter={label => `Match #${label}`}
                            />
                            <Line type="monotone" dataKey="elo" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#10b981' }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            <TrophyCase playerId={activePlayerId} />

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-4 flex items-center text-gray-900 dark:text-white"><Users className="mr-2 text-blue-500" size={20} /> Head to Head</h3>
                    <div className="space-y-3">
                        {Object.entries(stats?.headToHead || {}).length === 0 && <div className="text-gray-400 dark:text-gray-500">No data in this period</div>}
                        {Object.entries(stats?.headToHead || {})
                            .sort(([, a], [, b]) => b.matches - a.matches)
                            .map(([opponentId, record]) => {
                                const opponent = users.find(user => user.id === opponentId)
                                if (!opponent) return null
                                const winPct = ((record.wins / record.matches) * 100).toFixed(0)
                                return (
                                    <div key={opponentId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <div className="flex items-center">
                                            <img src={opponent.avatar_url || getAvatarFallback(opponent.name)} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 object-cover mr-3" alt="" />
                                            <span className="font-bold text-gray-700 dark:text-gray-200">{opponent.name}</span>
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

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-4 flex items-center text-gray-900 dark:text-white">
                        <Calendar className="mr-2 text-emerald-500" size={20} />
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
                            const opponent = users.find(user => user.id === item.opponentId)
                            return (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                                    <span className="text-gray-500 dark:text-gray-400 font-mono w-24 whitespace-nowrap overflow-hidden text-ellipsis mr-2 text-xs">{new Date(item.date).toLocaleDateString()}</span>

                                    <div className="flex flex-col items-center flex-1 justify-center px-1">
                                        <div className="flex items-center">
                                            <span className={`font-bold mr-2 ${item.result === 'W' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{item.result}</span>
                                            <span className="font-mono font-bold text-gray-900 dark:text-white text-base">
                                                {item.score} <span className="text-xs text-gray-400 font-normal">Sets</span>
                                            </span>
                                        </div>
                                        {item.setsData && item.setsData.length > 0 && (
                                            <div className="flex space-x-1 mt-1 font-mono text-[10px] text-gray-500 dark:text-gray-400">
                                                {item.setsData.map((set, idx) => {
                                                    const myGames = item.isP1 ? set.player1Games : set.player2Games
                                                    const oppGames = item.isP1 ? set.player2Games : set.player1Games
                                                    return <span key={idx} className="bg-gray-200 dark:bg-gray-600 px-1 rounded">{myGames}-{oppGames}</span>
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end w-32 truncate">
                                        <span className="text-gray-600 dark:text-gray-300 mr-2 truncate">{opponent?.name}</span>
                                        <img src={opponent?.avatar_url || getAvatarFallback(opponent?.name || '?')} className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 object-cover" alt="" />
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

export default TennisPlayerStats
