import React, { useState, useMemo } from 'react'
import { ArrowUp, ArrowDown, Trophy } from 'lucide-react'
import DateRangePicker from './DateRangePicker'

const Leaderboard = ({ users, matches }) => {
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [sortConfig, setSortConfig] = useState({ key: 'wins', direction: 'desc' })

    const stats = useMemo(() => {
        // 1. Filter matches by date
        const filteredMatches = matches.filter(match => {
            const matchDate = new Date(match.created_at)
            const start = startDate ? new Date(startDate) : new Date('2000-01-01')
            const end = endDate ? new Date(endDate) : new Date()
            // Set end date to end of day
            end.setHours(23, 59, 59, 999)
            return matchDate >= start && matchDate <= end
        })

        // 2. Calculate stats
        const playerStats = {}

        // Initialize
        users.forEach(user => {
            playerStats[user.id] = {
                ...user,
                wins: 0,
                losses: 0,
                totalGames: 0,
                pointsFor: 0,
                pointsAgainst: 0,
                scoreDiff: 0
            }
        })

        // Tally
        filteredMatches.forEach(match => {
            const p1 = playerStats[match.player1_id]
            const p2 = playerStats[match.player2_id]

            if (p1 && p2) {
                // Points
                p1.pointsFor += match.score1
                p1.pointsAgainst += match.score2
                p2.pointsFor += match.score2
                p2.pointsAgainst += match.score1

                // Games
                p1.totalGames += 1
                p2.totalGames += 1

                // Win/Loss
                if (match.score1 > match.score2) {
                    p1.wins += 1
                    p2.losses += 1
                } else {
                    p2.wins += 1
                    p1.losses += 1
                }
            }
        })

        // Finalize
        return Object.values(playerStats).map(p => ({
            ...p,
            winRate: p.totalGames > 0 ? (p.wins / p.totalGames) * 100 : 0,
            scoreDiff: p.pointsFor - p.pointsAgainst
        }))

    }, [users, matches, startDate, endDate])

    const sortedStats = useMemo(() => {
        const sorted = [...stats]
        sorted.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? -1 : 1
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? 1 : -1
            }
            return 0
        })
        return sorted
    }, [stats, sortConfig])

    const requestSort = (key) => {
        let direction = 'desc'
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc'
        }
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
                <h2 className="text-2xl font-bold flex items-center">
                    <Trophy className="mr-2 text-yellow-500" /> Leaderboard
                </h2>
            </div>

            <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
            />

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <th className="px-6 py-4">Rank</th>
                                <th className="px-6 py-4">Player</th>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors select-none text-right"
                                    onClick={() => requestSort('wins')}
                                >
                                    <div className="flex justify-end items-center">Wins <SortIcon column="wins" /></div>
                                </th>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors select-none text-right"
                                    onClick={() => requestSort('losses')}
                                >
                                    <div className="flex justify-end items-center">Losses <SortIcon column="losses" /></div>
                                </th>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors select-none text-right"
                                    onClick={() => requestSort('winRate')}
                                >
                                    <div className="flex justify-end items-center">Win % <SortIcon column="winRate" /></div>
                                </th>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors select-none text-right"
                                    onClick={() => requestSort('scoreDiff')}
                                >
                                    <div className="flex justify-end items-center">Score Diff <SortIcon column="scoreDiff" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sortedStats.map((player, index) => (
                                <tr key={player.id} className="hover:bg-blue-50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-gray-400">#{index + 1}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <img src={player.avatar_url || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full bg-gray-200 object-cover mr-3" alt="" />
                                            <span className="font-bold text-gray-900">{player.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-green-600">{player.wins}</td>
                                    <td className="px-6 py-4 text-right font-medium text-red-500">{player.losses}</td>
                                    <td className="px-6 py-4 text-right font-bold ">{player.winRate.toFixed(1)}%</td>
                                    <td className={`px-6 py-4 text-right font-bold ${player.scoreDiff > 0 ? 'text-green-600' : 'text-red-500'}`}>
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

export default Leaderboard
