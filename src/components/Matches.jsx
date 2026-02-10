import React, { useState } from 'react'
import { Edit2, Trash2, Calendar, RefreshCw, Scale } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { recalculatePlayerStats } from '../utils'

const Matches = ({ matches, users, onEditMatch, onMatchDeleted, onGenerateMatch }) => {
    const [loading, setLoading] = useState(false)
    const [recalculating, setRecalculating] = useState(false)

    const handleRecalculate = async () => {
        if (!window.confirm('Recalculate all player stats (ELO, wins, etc.) based on match history?')) return

        setRecalculating(true)
        try {
            await recalculatePlayerStats()
            if (onMatchDeleted) onMatchDeleted() // Triggers data refresh
            alert('Stats recalculated successfully!')
        } catch (error) {
            console.error(error)
            alert('Error recalculating stats')
        } finally {
            setRecalculating(false)
        }
    }

    const handleDelete = async (match) => {
        if (!window.confirm('Are you sure you want to delete this match? This will recalculate win counts.')) return

        setLoading(true)
        try {
            const { error } = await supabase.from('matches').delete().eq('id', match.id)
            if (error) throw error

            // Recalculate stats
            await recalculatePlayerStats()

            // Notify parent to refresh data
            if (onMatchDeleted) onMatchDeleted()

        } catch (error) {
            alert('Error deleting match: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    // Get player info for a match
    const getPlayerInfo = (playerId) => {
        return users.find(u => u.id === playerId) || { name: 'Unknown', avatar_url: 'https://via.placeholder.com/30' }
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
                                    <th className="px-6 py-4">Date Played</th>
                                    <th className="px-6 py-4 text-right">Player 1</th>
                                    <th className="px-6 py-4 text-center">Score</th>
                                    <th className="px-6 py-4">Player 2</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {matches.map(match => {
                                    const player1 = getPlayerInfo(match.player1_id)
                                    const player2 = getPlayerInfo(match.player2_id)
                                    const matchDate = new Date(match.created_at)

                                    return (
                                        <tr key={match.id} className="hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors">
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-mono text-sm">
                                                {matchDate.toLocaleDateString()} {matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end space-x-3">
                                                    <span className={`font-bold ${match.score1 > match.score2 ? 'text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                                        {player1.name}
                                                    </span>
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
                                                    <span className={`font-bold ${match.score2 > match.score1 ? 'text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                                        {player2.name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center space-x-1">
                                                    <button
                                                        onClick={() => onEditMatch(match)}
                                                        className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-2"
                                                        title="Edit Match"
                                                        disabled={loading}
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(match)}
                                                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-2"
                                                        title="Delete Match"
                                                        disabled={loading}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
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
