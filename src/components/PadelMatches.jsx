import React, { useState, useMemo } from 'react'
import { Edit2, Trash2, Calendar, RefreshCw, Scale, Check, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { recalculatePadelStats } from '../padelUtils'
import { calculateEloChange, getKFactor } from '../utils'

const PadelMatches = ({ matches, users, padelStats, onEditMatch, onMatchDeleted, onGenerateMatch, isAdmin }) => {
    const [loading, setLoading] = useState(false)
    const [recalculating, setRecalculating] = useState(false)
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)

    // Compute ELO ratings and changes for every padel match
    const matchEloData = useMemo(() => {
        if (!matches || !users || matches.length === 0 || users.length === 0) return {}

        // Initialize player ratings
        const ratings = {}
        const matchesPlayed = {}
        users.forEach(u => {
            ratings[u.id] = 1200
            matchesPlayed[u.id] = 0
        })

        // Process matches in chronological order
        const sortedMatches = [...matches].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
        )

        const eloMap = {}

        sortedMatches.forEach(match => {
            const t1p1 = match.team1_player1_id
            const t1p2 = match.team1_player2_id
            const t2p1 = match.team2_player1_id
            const t2p2 = match.team2_player2_id

            if ([t1p1, t1p2, t2p1, t2p2].some(id => ratings[id] === undefined)) return

                ;[t1p1, t1p2, t2p1, t2p2].forEach(pid => {
                    matchesPlayed[pid] = (matchesPlayed[pid] || 0) + 1
                })

            const team1Elo = (ratings[t1p1] + ratings[t1p2]) / 2
            const team2Elo = (ratings[t2p1] + ratings[t2p2]) / 2

            const t1Changes = {}
                ;[t1p1, t1p2].forEach(pid => {
                    const k = getKFactor(matchesPlayed[pid])
                    const change = calculateEloChange(team1Elo, team2Elo, match.score1, match.score2, k)
                    ratings[pid] += change
                    t1Changes[pid] = { elo: ratings[pid], change }
                })

            const t2Changes = {}
                ;[t2p1, t2p2].forEach(pid => {
                    const k = getKFactor(matchesPlayed[pid])
                    const change = calculateEloChange(team2Elo, team1Elo, match.score2, match.score1, k)
                    ratings[pid] += change
                    t2Changes[pid] = { elo: ratings[pid], change }
                })

            eloMap[match.id] = { t1Changes, t2Changes }
        })

        return eloMap
    }, [matches, users])

    const handleRecalculate = async () => {
        setRecalculating(true)
        try {
            await recalculatePadelStats()
            if (onMatchDeleted) onMatchDeleted()
        } catch (error) {
            console.error(error)
            alert('Error recalculating padel stats')
        } finally {
            setRecalculating(false)
        }
    }

    const handleDeleteRequest = (matchId) => {
        setConfirmDeleteId(matchId)
    }

    const handleDeleteConfirm = async (match) => {
        setLoading(true)
        setConfirmDeleteId(null)
        try {
            const { error } = await supabase.from('padel_matches').delete().eq('id', match.id)
            if (error) throw error

            await recalculatePadelStats()
            if (onMatchDeleted) onMatchDeleted()
        } catch (error) {
            alert('Error deleting match: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteCancel = () => {
        setConfirmDeleteId(null)
    }

    const getPlayerInfo = (playerId) => {
        return users.find(u => u.id === playerId) || { name: 'Unknown', avatar_url: 'https://via.placeholder.com/30' }
    }

    const EloChangeDisplay = ({ elo, change }) => {
        const isPositive = change > 0
        const changeColor = isPositive
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-500 dark:text-red-400'
        const sign = isPositive ? '+' : ''

        return (
            <div className="text-xs mt-0.5">
                <span className="text-gray-500 dark:text-gray-400">{elo}</span>
                {' '}
                <span className={changeColor}>
                    ({sign}{change})
                </span>
            </div>
        )
    }

    const TeamDisplay = ({ player1, player2, eloData, align = 'left' }) => {
        const isRight = align === 'right'
        return (
            <div className={`flex flex-col gap-1 ${isRight ? 'items-end' : 'items-start'}`}>
                {[player1, player2].map((player, i) => {
                    const playerElo = eloData?.[player.id]
                    return (
                        <div key={i} className={`flex items-center gap-2 ${isRight ? 'flex-row-reverse' : ''}`}>
                            <img src={player.avatar_url || 'https://via.placeholder.com/30'} className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 object-cover" alt={player.name} />
                            <div className={isRight ? 'text-right' : ''}>
                                <span className="font-bold text-sm text-gray-900 dark:text-white">{player.name}</span>
                                {playerElo && <EloChangeDisplay elo={playerElo.elo} change={playerElo.change} />}
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <h2 className="text-2xl font-bold flex items-center text-gray-900 dark:text-white">
                    <Calendar className="mr-2 text-green-500" /> Padel Matches
                </h2>
                <div className="flex gap-3">
                    <button
                        onClick={onGenerateMatch}
                        className="flex items-center text-sm font-bold text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors bg-green-50 dark:bg-green-900/30 px-3 py-2 rounded-lg"
                        title="Random Match Generator"
                    >
                        <RefreshCw size={16} className="mr-2" />
                        Generate Match
                    </button>
                    <button
                        onClick={handleRecalculate}
                        disabled={recalculating}
                        className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
                        title="Recalculate ELO and Stats"
                    >
                        <RefreshCw size={16} className={`mr-1 ${recalculating ? 'animate-spin' : ''}`} />
                        {recalculating ? 'Recalculating...' : 'Sync Stats'}
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {matches.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                        <div className="text-6xl mb-4">🎾</div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">No padel matches recorded yet</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">Click "New Match" to get started!</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    <th className="px-6 py-4 text-right">Team 1</th>
                                    <th className="px-6 py-4 text-center">Score</th>
                                    <th className="px-6 py-4">Team 2</th>
                                    <th className="px-6 py-4">Date Played</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {matches.map(match => {
                                    const t1p1 = getPlayerInfo(match.team1_player1_id)
                                    const t1p2 = getPlayerInfo(match.team1_player2_id)
                                    const t2p1 = getPlayerInfo(match.team2_player1_id)
                                    const t2p2 = getPlayerInfo(match.team2_player2_id)
                                    const matchDate = new Date(match.created_at)
                                    const eloData = matchEloData[match.id]

                                    return (
                                        <tr key={match.id} className="hover:bg-green-50 dark:hover:bg-gray-700 transition-colors">
                                            <td className="px-6 py-4">
                                                <TeamDisplay
                                                    player1={t1p1}
                                                    player2={t1p2}
                                                    eloData={eloData?.t1Changes}
                                                    align="right"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-center">
                                                    <div className="flex items-center justify-center space-x-2 font-mono font-bold text-xl text-gray-900 dark:text-white">
                                                        <span className={match.score1 > match.score2 ? 'text-green-600 dark:text-green-400' : ''}>{match.score1}</span>
                                                        <span className="text-gray-400">-</span>
                                                        <span className={match.score2 > match.score1 ? 'text-green-600 dark:text-green-400' : ''}>{match.score2}</span>
                                                    </div>
                                                    {match.handicap_rule && (
                                                        <div
                                                            className="mt-1 flex items-center text-amber-600 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full cursor-help"
                                                            title={`${match.handicap_rule.title}: ${match.handicap_rule.description}`}
                                                        >
                                                            <Scale size={12} className="mr-1" />
                                                            <span>Handicap</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <TeamDisplay
                                                    player1={t2p1}
                                                    player2={t2p2}
                                                    eloData={eloData?.t2Changes}
                                                    align="left"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-mono text-sm whitespace-nowrap">
                                                {matchDate.toLocaleDateString()} {matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center items-center space-x-1">
                                                    {confirmDeleteId === match.id ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Delete?</span>
                                                            <button
                                                                onClick={() => handleDeleteConfirm(match)}
                                                                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                                                                title="Confirm Delete"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                            <button
                                                                onClick={handleDeleteCancel}
                                                                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 transition-colors"
                                                                title="Cancel"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {isAdmin && (
                                                                <>
                                                                    <button
                                                                        onClick={() => onEditMatch(match)}
                                                                        className="text-gray-400 hover:text-green-600 dark:hover:text-green-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                                                        title="Edit Match"
                                                                        disabled={loading}
                                                                    >
                                                                        <Edit2 size={18} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteRequest(match.id)}
                                                                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                                                        title="Delete Match"
                                                                        disabled={loading}
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {!isAdmin && <span className="text-gray-400 dark:text-gray-600 text-xs italic">Read-only</span>}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

export default PadelMatches
