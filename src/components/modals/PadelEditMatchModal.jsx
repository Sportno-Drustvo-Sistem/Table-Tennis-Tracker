import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../contexts/ToastContext'
import { recalculatePadelStats } from '../../padelUtils'

const PadelEditMatchModal = ({ isOpen, match, onClose, onMatchUpdated, users }) => {
    const { showToast } = useToast()
    const [score1, setScore1] = useState('')
    const [score2, setScore2] = useState(0)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (match) {
            setScore1(match.score1 || 0)
            setScore2(match.score2 || 0)
        }
    }, [match])

    if (!isOpen || !match) return null

    const handleSave = async () => {
        setSaving(true)
        try {
            const { error } = await supabase
                .from('padel_matches')
                .update({
                    score1: parseInt(score1),
                    score2: parseInt(score2)
                })
                .eq('id', match.id)

            if (error) throw error

            await recalculatePadelStats()
            onMatchUpdated()
            onClose()
        } catch (error) {
            console.error(error)
            showToast('Error updating padel match: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-md m-4 shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Padel Match Score</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex justify-center space-x-8 mb-8">
                    <div className="flex flex-col items-center">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Team 1</label>
                        <input
                            type="number"
                            min="0"
                            value={score1}
                            onFocus={(e) => e.target.select()}
                            onChange={e => setScore1(e.target.value)}
                            className="w-20 h-16 text-3xl text-center border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
                        />
                    </div>
                    <div className="flex flex-col items-center">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Team 2</label>
                        <input
                            type="number"
                            min="0"
                            value={score2}
                            onFocus={(e) => e.target.select()}
                            onChange={e => setScore2(e.target.value)}
                            className="w-20 h-16 text-3xl text-center border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
                        />
                    </div>
                </div>

                <div className="flex justify-end space-x-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold"
                    >
                        {saving ? 'Saving...' : 'Update Match'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PadelEditMatchModal
