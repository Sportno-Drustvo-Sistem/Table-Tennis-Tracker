import React, { useMemo, useState } from 'react'
import { Activity, BarChart2, Trophy, User } from 'lucide-react'
import { buildTennisEloHistory, getTennisMatchWinner, getTennisScoreSummary } from '../tennisUtils'
import { getAvatarFallback, getEloRank } from '../utils'

const TennisPlayerStats = ({ users, matches, tennisStats, initialPlayerId }) => {
    const [selectedPlayerId, setSelectedPlayerId] = useState(initialPlayerId || users[0]?.id || '')

    const tennisStatsMap = useMemo(() => {
        const map = {}
        ;(tennisStats || []).forEach(s => { map[s.user_id] = s })
        return map
    }, [tennisStats])

    const selectedPlayer = users.find(user => user.id === selectedPlayerId)
    const selectedStats = tennisStatsMap[selectedPlayerId]
    const eloData = useMemo(() => buildTennisEloHistory(users, matches), [matches, users])

    const playerSummary = useMemo(() => {
        if (!selectedPlayerId) return null
        const playerMatches = matches.filter(match => match.player1_id === selectedPlayerId || match.player2_id === selectedPlayerId)
        let wins = 0
        let losses = 0
        let gamesFor = 0
        let gamesAgainst = 0
        const recent = []

        playerMatches.forEach(match => {
            const isP1 = match.player1_id === selectedPlayerId
            const winner = getTennisMatchWinner(match)
            const summary = getTennisScoreSummary(match)
            const playerWon = (isP1 && winner === 1) || (!isP1 && winner === 2)
            if (playerWon) wins += 1
            else losses += 1
            gamesFor += isP1 ? summary.player1Games : summary.player2Games
            gamesAgainst += isP1 ? summary.player2Games : summary.player1Games
            recent.push(playerWon ? 'W' : 'L')
        })

        const timeline = eloData.playerEloTimelines[selectedPlayerId] || []
        const eloValues = timeline.map(point => point.elo)

        return {
            matchesPlayed: playerMatches.length,
            wins,
            losses,
            winRate: playerMatches.length ? (wins / playerMatches.length) * 100 : 0,
            gamesFor,
            gamesAgainst,
            gamesDiff: gamesFor - gamesAgainst,
            recent: recent.slice(0, 8),
            maxElo: eloValues.length ? Math.max(...eloValues) : 1200,
            minElo: eloValues.length ? Math.min(...eloValues) : 1200,
        }
    }, [eloData.playerEloTimelines, matches, selectedPlayerId])

    if (!users.length) {
        return <div className="text-center py-20 text-gray-500 dark:text-gray-400">No players available.</div>
    }

    const elo = Math.round(selectedStats?.elo_rating || 1200)
    const rank = getEloRank(elo)

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="text-2xl font-bold flex items-center text-gray-900 dark:text-white">
                    <BarChart2 className="mr-2 text-emerald-500" /> Tennis Stats
                </h2>
                <select
                    value={selectedPlayerId}
                    onChange={event => setSelectedPlayerId(event.target.value)}
                    className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                >
                    {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
            </div>

            {selectedPlayer && playerSummary && (
                <>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex items-center gap-4">
                        <img src={selectedPlayer.avatar_url || getAvatarFallback(selectedPlayer.name)} alt={selectedPlayer.name} className="w-20 h-20 rounded-full object-cover bg-gray-200" />
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedPlayer.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{elo}</span>
                                <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ color: rank.color, backgroundColor: `${rank.color}22` }}>{rank.label}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard icon={<Trophy />} label="Wins" value={playerSummary.wins} />
                        <StatCard icon={<User />} label="Matches" value={playerSummary.matchesPlayed} />
                        <StatCard icon={<Activity />} label="Win Rate" value={`${playerSummary.winRate.toFixed(1)}%`} />
                        <StatCard icon={<BarChart2 />} label="Games +/-" value={playerSummary.gamesDiff} />
                        <StatCard icon={<BarChart2 />} label="Peak ELO" value={Math.round(playerSummary.maxElo)} />
                        <StatCard icon={<BarChart2 />} label="Low ELO" value={Math.round(playerSummary.minElo)} />
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Recent Form</h3>
                        <div className="flex gap-2">
                            {playerSummary.recent.length ? playerSummary.recent.map((result, idx) => (
                                <span key={idx} className={`w-8 h-8 rounded-full text-sm flex items-center justify-center font-bold ${result === 'W' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                                    {result}
                                </span>
                            )) : <span className="text-gray-500 dark:text-gray-400">No tennis matches yet.</span>}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

const StatCard = ({ icon, label, value }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="text-emerald-500 mb-2">{icon}</div>
        <div className="text-2xl font-black text-gray-900 dark:text-white">{value}</div>
        <div className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400">{label}</div>
    </div>
)

export default TennisPlayerStats
