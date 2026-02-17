import React, { useState } from 'react'
import { supabase } from '../../supabaseClient'
import { recalculatePadelStats } from '../../padelUtils'

const PadelMatchModal = ({ isOpen, onClose, team1, team2, onMatchSaved }) => {
    const [score1, setScore1] = useState(0)
    const [score2, setScore2] = useState(0)
    const [saving, setSaving] = useState(false)

    if (!isOpen || !team1 || !team2 || team1.length !== 2 || team2.length !== 2) return null

    const handleSave = async () => {
        setSaving(true)
        try {
            const { error: matchError } = await supabase
                .from('padel_matches')
                .insert([
                    {
                        team1_player1_id: team1[0].id,
                        team1_player2_id: team1[1].id,
                        team2_player1_id: team2[0].id,
                        team2_player2_id: team2[1].id,
                        score1: parseInt(score1),
                        score2: parseInt(score2),
                    }
                ])

            if (matchError) throw matchError

            await recalculatePadelStats()

            onMatchSaved()
            setScore1(0)
            setScore2(0)
        } catch (error) {
            alert('Error saving padel match: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-lg m-4 shadow-xl border border-gray-100 dark:border-gray-700">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">🎾 Record Padel Match</h2>

                <div className="flex justify-between items-center mb-8">
                    {/* Team 1 */}
                    <div className="flex flex-col items-center w-2/5">
                        <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-2">Team 1</div>
                        <div className="flex -space-x-3 mb-2">
                            {team1.map(p => (
                                <img key={p.id} src={p.avatar_url || 'https://via.placeholder.com/150'} className="w-14 h-14 rounded-full border-2 border-white dark:border-gray-800 object-cover bg-gray-200" alt={p.name} />
                            ))}
                        </div>
                        <div className="text-center">
                            {team1.map(p => (
                                <div key={p.id} className="font-bold text-sm text-gray-900 dark:text-white">{p.name}</div>
                            ))}
                        </div>
                    </div>

                    <div className="font-bold text-2xl text-gray-400 dark:text-gray-500">VS</div>

                    {/* Team 2 */}
                    <div className="flex flex-col items-center w-2/5">
                        <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-2">Team 2</div>
                        <div className="flex -space-x-3 mb-2">
                            {team2.map(p => (
                                <img key={p.id} src={p.avatar_url || 'https://via.placeholder.com/150'} className="w-14 h-14 rounded-full border-2 border-white dark:border-gray-800 object-cover bg-gray-200" alt={p.name} />
                            ))}
                        </div>
                        <div className="text-center">
                            {team2.map(p => (
                                <div key={p.id} className="font-bold text-sm text-gray-900 dark:text-white">{p.name}</div>
                            ))}
                        </div>
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
                            className="w-20 h-16 text-3xl text-center border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
                        />
                    </div>
                    <div className="flex flex-col items-center">
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
                        {saving ? 'Saving...' : 'Finish Match'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PadelMatchModal
