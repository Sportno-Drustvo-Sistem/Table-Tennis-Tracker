import React, { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Trophy } from 'lucide-react'
import DateRangePicker from './DateRangePicker'
import { getAvatarFallback, getEloRank } from '../utils'
import { getTennisMatchWinner } from '../tennisUtils'

const getStreak = (results) => {
    let currentStreak = 0
    let streakType = null

    for (const result of results) {
        if (!streakType) {
            streakType = result
            currentStreak = 1
        } else if (result === streakType) {
            currentStreak += 1
        } else {
            break
        }
    }

    const streakValue = streakType === 'W' ? currentStreak : streakType === 'L' ? -currentStreak : 0
    return {
        streak: streakType ? `${currentStreak}${streakType}` : '-',
        streakValue,
        streakType,
    }
}

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
            ...getStreak(player.results),
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

    const championId = useMemo(() => {
        const activePlayers = sortedStats.filter(player => player.wins + player.losses > 0)
        if (activePlayers.length === 0) return null
        return activePlayers.reduce((best, player) => (player.elo_rating > best.elo_rating ? player : best), activePlayers[0]).id
    }, [sortedStats])

    const requestSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
        }))
    }

    const renderSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return <div className="w-4 h-4 ml-1 opacity-0"></div>
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={16} className="ml-1" />
            : <ArrowDown size={16} className="ml-1" />
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
                                <th className="px-6 py-4">Rank</th>
                                <th className="px-6 py-4">Player</th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none text-right" onClick={() => requestSort('elo_rating')}>
                                    <div className="flex justify-end items-center">ELO {renderSortIcon('elo_rating')}</div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none text-right" onClick={() => requestSort('wins')}>
                                    <div className="flex justify-end items-center">Wins {renderSortIcon('wins')}</div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none text-right" onClick={() => requestSort('losses')}>
                                    <div className="flex justify-end items-center">Losses {renderSortIcon('losses')}</div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none text-right" onClick={() => requestSort('winRate')}>
                                    <div className="flex justify-end items-center">Win % {renderSortIcon('winRate')}</div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none text-right" onClick={() => requestSort('streakValue')}>
                                    <div className="flex justify-end items-center">Streak {renderSortIcon('streakValue')}</div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none text-right" onClick={() => requestSort('gamesDiff')}>
                                    <div className="flex justify-end items-center">Games Diff {renderSortIcon('gamesDiff')}</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {sortedStats.map((player, index) => (
                                <tr key={player.id} className="hover:bg-emerald-50 dark:hover:bg-gray-700 transition-colors">
                                    <td className="px-6 py-4 font-bold text-gray-400 dark:text-gray-500">#{index + 1}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <img src={player.avatar_url || getAvatarFallback(player.name)} className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 object-cover mr-3" alt="" />
                                            <span className="font-bold text-gray-900 dark:text-white">{player.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end items-center gap-1.5">
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{Math.round(player.elo_rating)}</span>
                                            {(() => {
                                                const rank = getEloRank(player.elo_rating, player.id === championId)
                                                return (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: rank.color, backgroundColor: `${rank.color}22` }}>{rank.label}</span>
                                                )
                                            })()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-green-600 dark:text-green-400">{player.wins}</td>
                                    <td className="px-6 py-4 text-right font-medium text-red-500 dark:text-red-400">{player.losses}</td>
                                    <td className="px-6 py-4 text-right font-bold dark:text-gray-300">{player.winRate.toFixed(1)}%</td>
                                    <td className={`px-6 py-4 text-right font-bold ${player.streakType === 'W' ? 'text-green-600 dark:text-green-400' : (player.streakType === 'L' ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500')}`}>
                                        {player.streak}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold ${player.gamesDiff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                        {player.gamesDiff > 0 ? '+' : ''}{player.gamesDiff}
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

export default TennisLeaderboard
