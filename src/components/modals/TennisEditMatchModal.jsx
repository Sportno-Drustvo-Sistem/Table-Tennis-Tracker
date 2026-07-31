import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { recalculateTennisStats, validateTennisSets } from '../../tennisUtils'
import { useToast } from '../../contexts/useToast'

const TennisEditMatchModal = ({ isOpen, match, onClose, onMatchUpdated, users }) => {
    const { showToast } = useToast()
    const [sets, setSets] = useState([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (isOpen && match) {
            setSets((match.sets_data?.length ? match.sets_data : [{ player1Games: match.score1, player2Games: match.score2 }]).map(set => ({
                player1Games: set.player1Games ?? '',
                player2Games: set.player2Games ?? '',
                player1Tiebreak: set.player1Tiebreak ?? '',
                player2Tiebreak: set.player2Tiebreak ?? '',
            })))
        }
    }, [isOpen, match])

    if (!isOpen || !match) return null

    const player1 = users.find(user => user.id === match.player1_id)
    const player2 = users.find(user => user.id === match.player2_id)

    const updateSet = (index, key, value) => {
        setSets(prev => prev.map((set, idx) => idx === index ? { ...set, [key]: value } : set))
    }

    const handleSave = async () => {
        const validation = validateTennisSets(sets, match.match_format || 'best_of_3')
        if (!validation.valid) {
            showToast(validation.message, 'error')
            return
        }

        setSaving(true)
        try {
            const { error } = await supabase
                .from('tennis_matches')
                .update({
                    score1: validation.summary.player1Games,
                    score2: validation.summary.player2Games,
                    sets_data: validation.sets,
                })
                .eq('id', match.id)

            if (error) throw error
            await recalculateTennisStats()
            showToast('Tennis match updated!', 'success')
            onMatchUpdated?.()
            onClose()
        } catch (error) {
            console.error(error)
            showToast('Error updating tennis match: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Tennis Match</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                        <X size={22} />
                    </button>
                </div>

                <div className="text-center text-sm font-bold text-gray-700 dark:text-gray-200 mb-4">
                    {player1?.name || 'Player 1'} vs {player2?.name || 'Player 2'}
                </div>

                <div className="space-y-3 mb-6">
                    {sets.map((set, index) => (
                        <div key={index} className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                            <label>
                                <span className="block text-xs font-bold text-gray-500 mb-1">Set {index + 1} {player1?.name}</span>
                                <input type="number" min="0" value={set.player1Games} onChange={event => updateSet(index, 'player1Games', event.target.value)} className="w-full p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                            </label>
                            <label>
                                <span className="block text-xs font-bold text-gray-500 mb-1">Set {index + 1} {player2?.name}</span>
                                <input type="number" min="0" value={set.player2Games} onChange={event => updateSet(index, 'player2Games', event.target.value)} className="w-full p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                            </label>
                            {(Number(set.player1Games) === 7 && Number(set.player2Games) === 6) || (Number(set.player2Games) === 7 && Number(set.player1Games) === 6) ? (
                                <>
                                    <label>
                                        <span className="block text-xs font-bold text-gray-500 mb-1">Tiebreak {player1?.name}</span>
                                        <input type="number" min="0" value={set.player1Tiebreak} onChange={event => updateSet(index, 'player1Tiebreak', event.target.value)} className="w-full p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                    </label>
                                    <label>
                                        <span className="block text-xs font-bold text-gray-500 mb-1">Tiebreak {player2?.name}</span>
                                        <input type="number" min="0" value={set.player2Tiebreak} onChange={event => updateSet(index, 'player2Tiebreak', event.target.value)} className="w-full p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
                                    </label>
                                </>
                            ) : null}
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-bold">
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default TennisEditMatchModal
