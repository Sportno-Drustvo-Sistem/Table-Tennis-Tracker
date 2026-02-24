import React, { useState, useEffect, useMemo } from 'react'
import { Scale, Skull } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { recalculatePlayerStats, getHeadToHeadStreak, getHandicapRule, getActiveDebuffs } from '../../utils'
import { useToast } from '../../contexts/ToastContext'

const MatchModal = ({ isOpen, onClose, player1, player2, onMatchSaved, matches, tournamentId, debuffs }) => {
    const { showToast } = useToast()
    const [score1, setScore1] = useState('')
    const [score2, setScore2] = useState(0)
    const [saving, setSaving] = useState(false)
    const [allDebuffs, setAllDebuffs] = useState([])

    useEffect(() => {
        if (isOpen) {
            getActiveDebuffs().then(setAllDebuffs)
        }
    }, [isOpen])

    if (!isOpen || !player1 || !player2) return null

    // Calculate Handicap
    const activeRules = useMemo(() => {
        if (!isOpen || !player1 || !player2) return []

        const { streak, winnerId } = matches ? getHeadToHeadStreak(player1.id, player2.id, matches) : { streak: 0, winnerId: null }
        let streakRule = null

        if (streak >= 8 && winnerId) {
            const winnerName = winnerId === player1.id ? player1.name : player2.name
            const loserName = winnerId === player1.id ? player2.name : player1.name
            streakRule = getHandicapRule(streak, winnerName, loserName, allDebuffs)
        }

        const rules = []
        if (streakRule) rules.push({ ...streakRule, type: 'streak' })

        if (debuffs) {
            if (debuffs[player1.id]) rules.push({ ...debuffs[player1.id], targetPlayerId: player1.id, targetPlayerName: player1.name, type: 'mayhem' })
            if (debuffs[player2.id]) rules.push({ ...debuffs[player2.id], targetPlayerId: player2.id, targetPlayerName: player2.name, type: 'mayhem' })
        }

        return rules
    }, [isOpen, player1, player2, matches, allDebuffs, debuffs])

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
                        score2: parseInt(score2),
                        handicap_rule: activeRules.length > 0 ? activeRules : null,
                        tournament_id: tournamentId || null
                    }
                ])

            if (matchError) throw matchError

            // 2. Recalculate stats
            await recalculatePlayerStats()

            onMatchSaved()
            setScore1('')
            setScore2(0)
        } catch (error) {
            console.error(error)
            showToast('Error saving match: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-lg m-4 shadow-xl border border-gray-100 dark:border-gray-700">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">Record Match Result</h2>

                {activeRules.length > 0 && (
                    <div className="mb-8 space-y-3">
                        {activeRules.map((rule, idx) => (
                            <div key={idx} className={`p-4 border-l-4 rounded-r-lg text-left shadow-sm ${rule.type === 'mayhem'
                                ? 'bg-purple-50 dark:bg-purple-900/40 border-purple-500'
                                : 'bg-amber-50 dark:bg-amber-900/40 border-amber-500'
                                }`}>
                                <div className="flex items-start">
                                    {rule.type === 'mayhem' ? (
                                        <Skull className="text-purple-600 dark:text-purple-400 mr-3 mt-1 flex-shrink-0" size={24} />
                                    ) : (
                                        <Scale className="text-amber-600 dark:text-amber-400 mr-3 mt-1 flex-shrink-0" size={24} />
                                    )}
                                    <div>
                                        <h4 className={`font-bold uppercase text-sm tracking-wide mb-1 ${rule.type === 'mayhem' ? 'text-purple-800 dark:text-purple-200' : 'text-amber-800 dark:text-amber-200'
                                            }`}>
                                            {rule.targetPlayerName ? `${rule.targetPlayerName}: ` : ''}{rule.title}
                                        </h4>
                                        <p className={`font-medium ${rule.type === 'mayhem' ? 'text-purple-700 dark:text-purple-100' : 'text-amber-700 dark:text-amber-100'
                                            }`}>
                                            {rule.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

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
