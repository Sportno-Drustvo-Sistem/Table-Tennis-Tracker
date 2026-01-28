import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { recalculateWins } from '../../utils'

const EditMatchModal = ({ isOpen, onClose, match, onMatchUpdated }) => {
    const [score1, setScore1] = useState(0)
    const [score2, setScore2] = useState(0)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (match) {
            setScore1(match.score1)
            setScore2(match.score2)
        }
    }, [match])

    if (!isOpen || !match) return null

    const handleSave = async () => {
        setSaving(true)
        try {
            // 1. Update match
            const { error: updateError } = await supabase
                .from('matches')
                .update({ score1: parseInt(score1), score2: parseInt(score2) })
                .eq('id', match.id)

            if (updateError) throw updateError

            // 2. Recalculate wins for both players
            await recalculateWins(match.player1_id)
            await recalculateWins(match.player2_id)

            onMatchUpdated()
            onClose()
        } catch (error) {
            alert('Error updating match: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm m-4 shadow-2xl">
                <h2 className="text-xl font-bold mb-4 text-center">Edit Match Score</h2>
                <div className="flex justify-between items-center mb-6">
                    <div className="text-center w-1/3">
                        <div className="font-bold truncate">{match.player1?.name}</div>
                    </div>
                    <div className="text-gray-400">vs</div>
                    <div className="text-center w-1/3">
                        <div className="font-bold truncate">{match.player2?.name}</div>
                    </div>
                </div>
                <div className="flex justify-center space-x-4 mb-6">
                    <input type="number" value={score1} onChange={e => setScore1(e.target.value)} className="w-16 h-12 text-2xl text-center border rounded-lg" />
                    <input type="number" value={score2} onChange={e => setScore2(e.target.value)} className="w-16 h-12 text-2xl text-center border rounded-lg" />
                </div>
                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default EditMatchModal
