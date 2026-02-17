import React, { useState, useMemo } from 'react'
import { ArrowUp, ArrowDown, Trophy } from 'lucide-react'
import DateRangePicker from './DateRangePicker'

const PadelLeaderboard = ({ users, matches, padelStats }) => {
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [sortConfig, setSortConfig] = useState({ key: 'elo_rating', direction: 'desc' })

    // Build a lookup map: userId -> padel stats
    const padelStatsMap = useMemo(() => {
        const map = {}
            ; (padelStats || []).forEach(s => {
                map[s.user_id] = s
            })
        return map
    }, [padelStats])

    const stats = useMemo(() => {
        // 1. Filter matches by date
        const filteredMatches = matches.filter(match => {
            const matchDate = new Date(match.created_at)
            const start = startDate ? new Date(startDate) : new Date('2000-01-01')
            const end = endDate ? new Date(endDate) : new Date()
            end.setHours(23, 59, 59, 999)
            return matchDate >= start && matchDate <= end
        })

        // Sort matches newest first for streak calculation
        filteredMatches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        // 2. Calculate stats per player
        const playerStats = {}
        users.forEach(user => {
            const ps = padelStatsMap[user.id]
            playerStats[user.id] = {
                ...user,
                padel_elo: ps?.elo_rating || 1200,
                padel_matches_played: ps?.matches_played || 0,
                padel_is_ranked: ps?.is_ranked || false,
                wins: 0,
                losses: 0,
                totalGames: 0,
                pointsFor: 0,
                pointsAgainst: 0,
                results: []
            }
        })

        // Tally from filtered matches
        filteredMatches.forEach(match => {
            const t1 = [match.team1_player1_id, match.team1_player2_id]
            const t2 = [match.team2_player1_id, match.team2_player2_id]
            const allPlayers = [...t1, ...t2]

            // Skip if any player missing
            if (allPlayers.some(id => !playerStats[id])) return

            // Update per-player stats
            t1.forEach(pid => {
                const p = playerStats[pid]
                p.pointsFor += match.score1
                p.pointsAgainst += match.score2
                p.totalGames += 1
                if (match.score1 > match.score2) {
                    p.wins += 1
                    p.results.push('W')
                } else {
                    p.losses += 1
                    p.results.push('L')
                }
            })

            t2.forEach(pid => {
                const p = playerStats[pid]
                p.pointsFor += match.score2
                p.pointsAgainst += match.score1
                p.totalGames += 1
                if (match.score2 > match.score1) {
                    p.wins += 1
                    p.results.push('W')
                } else {
                    p.losses += 1
                    p.results.push('L')
                }
            })
        })

        // Finalize
        return Object.values(playerStats).map(p => {
            let currentStreak = 0
            let streakType = null

            for (let result of p.results) {
                if (!streakType) {
                    streakType = result
                    currentStreak = 1
                } else if (result === streakType) {
                    currentStreak++
                } else {
                    break
                }
            }

            const streakValue = streakType === 'W' ? currentStreak : (streakType === 'L' ? -currentStreak : 0)

            return {
                ...p,
                elo_rating: p.padel_elo,
                matches_played: p.padel_matches_played,
                is_ranked: p.padel_is_ranked,
                winRate: p.totalGames > 0 ? (p.wins / p.totalGames) * 100 : 0,
                scoreDiff: p.pointsFor - p.pointsAgainst,
                streak: streakType ? `${currentStreak}${streakType}` : '-',
                streakValue,
                streakType
            }
        })

    }, [users, matches, padelStatsMap, startDate, endDate])

    const sortedStats = useMemo(() => {
        const sorted = [...stats]
        sorted.sort((a, b) => {
            if (sortConfig.key === 'elo_rating') {
                const aRanked = (a.matches_played || 0) >= 10
                const bRanked = (b.matches_played || 0) >= 10
                if (aRanked && !bRanked) return -1
                if (!aRanked && bRanked) return 1
            }
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })
        return sorted
    }, [stats, sortConfig])

    const requestSort = (key) => {
        let direction = 'desc'
        if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc'
        setSortConfig({ key, direction })
    }

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <div className="w-4 h-4 ml-1 opacity-0"></div>
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={16} className="ml-1" />
            : <ArrowDown size={16} className="ml-1" />
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <h2 className="text-2xl font-bold flex items-center text-gray-900 dark:text-white">
                    <Trophy className="mr-2 text-green-500" /> Padel Leaderboard
                </h2>
            </div>

            <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
            />

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                <th className="px-6 py-4">Rank</th>
                                <th className="px-6 py-4">Player</th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none text-right" onClick={() => requestSort('elo_rating')}>
                                    <div className="flex justify-end items-center">ELO <SortIcon column="elo_rating" /></div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none text-right" onClick={() => requestSort('wins')}>
                                    <div className="flex justify-end items-center">Wins <SortIcon column="wins" /></div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none text-right" onClick={() => requestSort('losses')}>
                                    <div className="flex justify-end items-center">Losses <SortIcon column="losses" /></div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none text-right" onClick={() => requestSort('winRate')}>
                                    <div className="flex justify-end items-center">Win % <SortIcon column="winRate" /></div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none text-right" onClick={() => requestSort('streakValue')}>
                                    <div className="flex justify-end items-center">Streak <SortIcon column="streakValue" /></div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none text-right" onClick={() => requestSort('scoreDiff')}>
                                    <div className="flex justify-end items-center">Score Diff <SortIcon column="scoreDiff" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {sortedStats.map((player, index) => (
                                <tr key={player.id} className="hover:bg-green-50 dark:hover:bg-gray-700 transition-colors">
                                    <td className="px-6 py-4 font-bold text-gray-400 dark:text-gray-500">#{index + 1}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <img src={player.avatar_url || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 object-cover mr-3" alt="" />
                                            <span className="font-bold text-gray-900 dark:text-white">{player.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-green-600 dark:text-green-400">
                                        {(player.matches_played || 0) >= 10
                                            ? player.elo_rating
                                            : <span className="text-xs text-gray-400 font-normal">Placement ({player.matches_played || 0}/10)</span>
                                        }
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-green-600 dark:text-green-400">{player.wins}</td>
                                    <td className="px-6 py-4 text-right font-medium text-red-500 dark:text-red-400">{player.losses}</td>
                                    <td className="px-6 py-4 text-right font-bold dark:text-gray-300">{player.winRate.toFixed(1)}%</td>
                                    <td className={`px-6 py-4 text-right font-bold ${player.streakType === 'W' ? 'text-green-600 dark:text-green-400' : (player.streakType === 'L' ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500')}`}>
                                        {player.streak}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold ${player.scoreDiff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                        {player.scoreDiff > 0 ? '+' : ''}{player.scoreDiff}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default PadelLeaderboard
