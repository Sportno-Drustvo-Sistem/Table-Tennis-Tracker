import React, { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Trophy } from 'lucide-react'
import DateRangePicker from './DateRangePicker'
import { getAvatarFallback, getEloRank } from '../utils'
import { getTennisMatchWinner } from '../tennisUtils'

const TennisLeaderboard = ({ users, matches, tennisStats }) => {
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [sortConfig, setSortConfig] = useState({ key: 'elo_rating', direction: 'desc' })

    const tennisStatsMap = useMemo(() => {
        const map = {}
        ;(tennisStats || []).forEach(s => { map[s.user_id] = s })
        return map
    }, [tennisStats])

    const stats = useMemo(() => {
        const start = startDate ? new Date(startDate) : new Date('2000-01-01')
        const end = endDate ? new Date(endDate) : new Date()
        end.setHours(23, 59, 59, 999)
        const filteredMatches = [...matches]
            .filter(match => {
                const matchDate = new Date(match.created_at)
                return matchDate >= start && matchDate <= end
            })
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        const playerStats = {}
        users.forEach(user => {
            const ts = tennisStatsMap[user.id]
            playerStats[user.id] = {
                ...user,
                elo_rating: ts?.elo_rating || 1200,
                matches_played: ts?.matches_played || 0,
                is_ranked: ts?.is_ranked || false,
                wins: 0,
                losses: 0,
                gamesFor: 0,
                gamesAgainst: 0,
                results: [],
            }
        })

        filteredMatches.forEach(match => {
            const p1 = playerStats[match.player1_id]
            const p2 = playerStats[match.player2_id]
            if (!p1 || !p2) return

            const winner = getTennisMatchWinner(match)
            p1.gamesFor += match.score1
            p1.gamesAgainst += match.score2
            p2.gamesFor += match.score2
            p2.gamesAgainst += match.score1

            if (winner === 1) {
                p1.wins += 1
                p2.losses += 1
                p1.results.push('W')
                p2.results.push('L')
            } else if (winner === 2) {
                p2.wins += 1
                p1.losses += 1
                p2.results.push('W')
                p1.results.push('L')
            }
        })

        return Object.values(playerStats).map(player => ({
            ...player,
            gamesDiff: player.gamesFor - player.gamesAgainst,
            winRate: player.wins + player.losses > 0 ? (player.wins / (player.wins + player.losses)) * 100 : 0,
        }))
    }, [endDate, matches, startDate, tennisStatsMap, users])

    const sortedStats = useMemo(() => {
        return [...stats].sort((a, b) => {
            if (sortConfig.key === 'elo_rating') {
                const aActive = a.wins + a.losses > 0
                const bActive = b.wins + b.losses > 0
                if (!aActive && bActive) return 1
                if (!bActive && aActive) return -1
            }

            const aValue = a[sortConfig.key]
            const bValue = b[sortConfig.key]
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })
    }, [sortConfig, stats])

    const requestSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
        }))
    }

    const renderSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return null
        return sortConfig.direction === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <h2 className="text-2xl font-bold flex items-center text-gray-900 dark:text-white">
                    <Trophy className="mr-2 text-emerald-500" /> Tennis Leaderboard
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
                                <th className="px-4 py-4">#</th>
                                <th className="px-4 py-4">Player</th>
                                <th className="px-4 py-4 cursor-pointer" onClick={() => requestSort('elo_rating')}>ELO {renderSortIcon('elo_rating')}</th>
                                <th className="px-4 py-4 cursor-pointer" onClick={() => requestSort('wins')}>W {renderSortIcon('wins')}</th>
                                <th className="px-4 py-4 cursor-pointer" onClick={() => requestSort('losses')}>L {renderSortIcon('losses')}</th>
                                <th className="px-4 py-4 cursor-pointer" onClick={() => requestSort('winRate')}>Win % {renderSortIcon('winRate')}</th>
                                <th className="px-4 py-4 hidden sm:table-cell">Form</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {sortedStats.map((player, index) => {
                                const rank = getEloRank(player.elo_rating)
                                return (
                                    <tr key={player.id} className="hover:bg-emerald-50 dark:hover:bg-gray-700 transition-colors">
                                        <td className="px-4 py-4 font-bold text-gray-500 dark:text-gray-400">{index + 1}</td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <img src={player.avatar_url || getAvatarFallback(player.name)} alt={player.name} className="w-9 h-9 rounded-full object-cover bg-gray-200" />
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white">{player.name}</div>
                                                    <div className="text-xs" style={{ color: rank.color }}>{rank.label}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">{Math.round(player.elo_rating)}</td>
                                        <td className="px-4 py-4 text-green-600 dark:text-green-400 font-bold">{player.wins}</td>
                                        <td className="px-4 py-4 text-red-500 dark:text-red-400 font-bold">{player.losses}</td>
                                        <td className="px-4 py-4 font-mono">{player.winRate.toFixed(1)}%</td>
                                        <td className="px-4 py-4 hidden sm:table-cell">
                                            <div className="flex gap-1">
                                                {player.results.slice(0, 5).map((result, idx) => (
                                                    <span key={idx} className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${result === 'W' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                                                        {result}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default TennisLeaderboard
