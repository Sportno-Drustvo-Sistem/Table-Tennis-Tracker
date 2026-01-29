import React, { useState } from 'react'
import { supabase } from '../../supabaseClient'

const MatchModal = ({ isOpen, onClose, player1, player2, onMatchSaved }) => {
    const [score1, setScore1] = useState(0)
    const [score2, setScore2] = useState(0)
    const [saving, setSaving] = useState(false)

    if (!isOpen || !player1 || !player2) return null

    const handleSave = async () => {
        setSaving(true)
        try {
            // 1. Insert match
            const { error: matchError } = await supabase
                .from('matches')
                .insert([
                    {
                        player1_id: player1.id,
                        player2_id: player2.id,
                        score1: parseInt(score1),
                        score2: parseInt(score2)
                    }
                ])

            if (matchError) throw matchError

            // 2. Update winner
            let winnerId = null
            if (parseInt(score1) > parseInt(score2)) winnerId = player1.id
            if (parseInt(score2) > parseInt(score1)) winnerId = player2.id

            if (winnerId) {
                const { data: user, error: fetchError } = await supabase
                    .from('users')
                    .select('total_wins')
                    .eq('id', winnerId)
                    .single()

                if (fetchError) throw fetchError

                const { error: updateError } = await supabase
                    .from('users')
                    .update({ total_wins: user.total_wins + 1 })
                    .eq('id', winnerId)

                if (updateError) throw updateError
            }

            onMatchSaved()
            setScore1(0)
            setScore2(0)
        } catch (error) {
            alert('Error saving match: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-lg m-4 shadow-xl border border-gray-100 dark:border-gray-700">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">Record Match Result</h2>

                <div className="flex justify-between items-center mb-8">
                    <div className="flex flex-col items-center w-1/3">
                        <img src={player1.avatar_url || 'https://via.placeholder.com/150'} className="w-20 h-20 rounded-full mb-2 object-cover bg-gray-200" alt={player1.name} />
                        <span className="font-bold text-center break-words w-full text-gray-900 dark:text-white">{player1.name}</span>
                    </div>

                    <div className="font-bold text-2xl text-gray-400 dark:text-gray-500">VS</div>

                    <div className="flex flex-col items-center w-1/3">
                        <img src={player2.avatar_url || 'https://via.placeholder.com/150'} className="w-20 h-20 rounded-full mb-2 object-cover bg-gray-200" alt={player2.name} />
                        <span className="font-bold text-center break-words w-full text-gray-900 dark:text-white">{player2.name}</span>
                    </div>
                </div>

                <div className="flex justify-center space-x-8 mb-8">
                    <div className="flex flex-col items-center">
                        <input
                            type="number"
                            min="0"
                            value={score1}
                            onFocus={(e) => e.target.select()}
                            onChange={e => setScore1(e.target.value)}
                            className="w-20 h-16 text-3xl text-center border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div className="flex flex-col items-center">
                        <input
                            type="number"
                            min="0"
                            value={score2}
                            onFocus={(e) => e.target.select()}
                            onChange={e => setScore2(e.target.value)}
                            className="w-20 h-16 text-3xl text-center border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
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
                        {saving ? 'Saving...' : 'Finish Match'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default MatchModal
