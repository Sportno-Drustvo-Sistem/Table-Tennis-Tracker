import React, { useState, useMemo } from 'react'
import { Edit2, Trash2, Calendar, RefreshCw, Scale, Check, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { recalculatePlayerStats, calculateEloChange, getKFactor } from '../utils'

const Matches = ({ matches, users, onEditMatch, onMatchDeleted, onGenerateMatch, isAdmin }) => {
    const [loading, setLoading] = useState(false)
    const [recalculating, setRecalculating] = useState(false)
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)

    // Compute ELO ratings and changes for every match
    const matchEloData = useMemo(() => {
        if (!matches || !users || matches.length === 0 || users.length === 0) return {}

        // Initialize player ratings
        const ratings = {}
        const matchesPlayed = {}
        users.forEach(u => {
            ratings[u.id] = 1200
            matchesPlayed[u.id] = 0
        })

        // Process matches in chronological order (oldest first)
        const sortedMatches = [...matches].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
        )

        const eloMap = {} // matchId -> { p1Elo, p1Change, p2Elo, p2Change }

        sortedMatches.forEach(match => {
            const p1Id = match.player1_id
            const p2Id = match.player2_id

            if (ratings[p1Id] === undefined || ratings[p2Id] === undefined) return

            matchesPlayed[p1Id] = (matchesPlayed[p1Id] || 0) + 1
            matchesPlayed[p2Id] = (matchesPlayed[p2Id] || 0) + 1

            const k1 = getKFactor(matchesPlayed[p1Id])
            const k2 = getKFactor(matchesPlayed[p2Id])

            const p1Change = calculateEloChange(ratings[p1Id], ratings[p2Id], match.score1, match.score2, k1)
            const p2Change = calculateEloChange(ratings[p2Id], ratings[p1Id], match.score2, match.score1, k2)

            ratings[p1Id] += p1Change
            ratings[p2Id] += p2Change

            eloMap[match.id] = {
                p1Elo: ratings[p1Id],
                p1Change,
                p2Elo: ratings[p2Id],
                p2Change,
            }
        })

        return eloMap
    }, [matches, users])

    const handleRecalculate = async () => {
        setRecalculating(true)
        try {
            await recalculatePlayerStats()
            if (onMatchDeleted) onMatchDeleted()
        } catch (error) {
            console.error(error)
            alert('Error recalculating stats')
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
            const { error } = await supabase.from('matches').delete().eq('id', match.id)
            if (error) throw error

            await recalculatePlayerStats()

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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <h2 className="text-2xl font-bold flex items-center text-gray-900 dark:text-white">
                    <Calendar className="mr-2 text-blue-500" /> Matches
                </h2>
                <div className="flex gap-3">
                    <button
                        onClick={onGenerateMatch}
                        className="flex items-center text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg"
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
                        <div className="text-6xl mb-4">🏓</div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">No matches recorded yet</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">Click "New Match" to get started!</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    <th className="px-6 py-4 text-right">Player 1</th>
                                    <th className="px-6 py-4 text-center">Score</th>
                                    <th className="px-6 py-4">Player 2</th>
                                    <th className="px-6 py-4">Date Played</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {matches.map(match => {
                                    const player1 = getPlayerInfo(match.player1_id)
                                    const player2 = getPlayerInfo(match.player2_id)
                                    const matchDate = new Date(match.created_at)
                                    const eloData = matchEloData[match.id]

                                    return (
                                        <tr key={match.id} className="hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end space-x-3">
                                                    <div className="text-right">
                                                        <span className={`font-bold ${match.score1 > match.score2 ? 'text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                                            {player1.name}
                                                        </span>
                                                        {eloData && (
                                                            <EloChangeDisplay elo={eloData.p1Elo} change={eloData.p1Change} />
                                                        )}
                                                    </div>
                                                    <img src={player1.avatar_url} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 object-cover" alt={player1.name} />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-center">
                                                    <div className="flex items-center justify-center space-x-2 font-mono font-bold text-xl text-gray-900 dark:text-white">
                                                        <span>{match.score1}</span>
                                                        <span className="text-gray-400">-</span>
                                                        <span>{match.score2}</span>
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
                                                <div className="flex items-center space-x-3">
                                                    <img src={player2.avatar_url} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 object-cover" alt={player2.name} />
                                                    <div>
                                                        <span className={`font-bold ${match.score2 > match.score1 ? 'text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                                            {player2.name}
                                                        </span>
                                                        {eloData && (
                                                            <EloChangeDisplay elo={eloData.p2Elo} change={eloData.p2Change} />
                                                        )}
                                                    </div>
                                                </div>
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
                                                                        className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
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

export default Matches
