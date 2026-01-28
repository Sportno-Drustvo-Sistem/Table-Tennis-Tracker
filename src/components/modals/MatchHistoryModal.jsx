import React, { useState, useEffect, useCallback } from 'react'
import { X, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { recalculateWins } from '../../utils'

const MatchHistoryModal = ({ isOpen, onClose, onEditMatch, onMatchDeleted }) => {
    const [matches, setMatches] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchMatches = useCallback(async () => {
        setLoading(true)
        // Fetch matches with player info
        const { data, error } = await supabase
            .from('matches')
            .select(`
        *,
        player1:users!player1_id(name, avatar_url),
        player2:users!player2_id(name, avatar_url)
      `)
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) console.error('Error fetching matches:', error)
        else setMatches(data || [])

        setLoading(false)
    }, [])

    useEffect(() => {
        if (isOpen) fetchMatches()
    }, [isOpen, fetchMatches])

    const handleDelete = async (match) => {
        if (!window.confirm('Are you sure you want to delete this match? This will recalculate win counts.')) return

        try {
            const { error } = await supabase.from('matches').delete().eq('id', match.id)
            if (error) throw error

            // Recalculate wins
            await recalculateWins(match.player1_id)
            await recalculateWins(match.player2_id)

            // Update local UI
            setMatches(prev => prev.filter(m => m.id !== match.id))

            // Notify parent to refresh leaderboard
            if (onMatchDeleted) onMatchDeleted()

        } catch (error) {
            alert('Error deleting match: ' + error.message)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl w-full max-w-2xl m-4 h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Match History</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="text-center py-10 text-gray-500">Loading history...</div>
                    ) : matches.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">No matches recorded yet.</div>
                    ) : (
                        <div className="space-y-3">
                            {matches.map(match => (
                                <div key={match.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                    <div className="flex-1 flex justify-end items-center space-x-3">
                                        <span className={`font-bold ${match.score1 > match.score2 ? 'text-black' : 'text-gray-500'}`}>{match.player1?.name || 'Unknown'}</span>
                                        <img src={match.player1?.avatar_url || 'https://via.placeholder.com/30'} className="w-8 h-8 rounded-full bg-gray-200 object-cover" alt="player1" />
                                    </div>

                                    <div className="px-4 font-mono font-bold text-xl flex items-center space-x-2">
                                        <span>{match.score1}</span>
                                        <span className="text-gray-400">-</span>
                                        <span>{match.score2}</span>
                                    </div>

                                    <div className="flex-1 flex justify-start items-center space-x-3">
                                        <img src={match.player2?.avatar_url || 'https://via.placeholder.com/30'} className="w-8 h-8 rounded-full bg-gray-200 object-cover" alt="player2" />
                                        <span className={`font-bold ${match.score2 > match.score1 ? 'text-black' : 'text-gray-500'}`}>{match.player2?.name || 'Unknown'}</span>
                                    </div>

                                    <div className="ml-4 flex space-x-1">
                                        <button onClick={() => onEditMatch(match)} className="text-gray-400 hover:text-blue-600 p-2" title="Edit Match">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(match)} className="text-gray-400 hover:text-red-600 p-2" title="Delete Match">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default MatchHistoryModal
