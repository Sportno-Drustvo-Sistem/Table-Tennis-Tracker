import React, { useState, useEffect } from 'react'
import { X, Shuffle, Check, AlertCircle } from 'lucide-react'

const PadelMatchGeneratorModal = ({ isOpen, onClose, users, matches, padelStats, onMatchGenerated }) => {
    const [excludedPlayers, setExcludedPlayers] = useState(new Set())
    const [selectedPlayers, setSelectedPlayers] = useState([])
    const [generatedTeams, setGeneratedTeams] = useState(null)
    const [mode, setMode] = useState('select') // 'select' or 'result'

    // Build padel stats map
    const padelStatsMap = {}
        ; (padelStats || []).forEach(s => {
            padelStatsMap[s.user_id] = s
        })

    useEffect(() => {
        if (isOpen) {
            setSelectedPlayers([])
            setGeneratedTeams(null)
            setMode('select')
        }
    }, [isOpen])

    if (!isOpen) return null

    const availablePlayers = users.filter(u => !excludedPlayers.has(u.id))

    const toggleExclude = (userId) => {
        const newExcluded = new Set(excludedPlayers)
        if (newExcluded.has(userId)) {
            newExcluded.delete(userId)
        } else {
            newExcluded.add(userId)
            // Also remove from selected if excluded
            setSelectedPlayers(prev => prev.filter(p => p.id !== userId))
        }
        setExcludedPlayers(newExcluded)
    }

    const toggleSelect = (user) => {
        const isSelected = selectedPlayers.some(p => p.id === user.id)
        if (isSelected) {
            setSelectedPlayers(prev => prev.filter(p => p.id !== user.id))
        } else {
            if (selectedPlayers.length >= 4) return
            setSelectedPlayers(prev => [...prev, user])
        }
    }

    const generateTeams = () => {
        if (selectedPlayers.length !== 4) return

        // Shuffle randomly and split into teams
        const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5)
        const team1 = [shuffled[0], shuffled[1]]
        const team2 = [shuffled[2], shuffled[3]]

        setGeneratedTeams({ team1, team2 })
        setMode('result')
    }

    const reshuffleTeams = () => {
        if (selectedPlayers.length !== 4) return
        const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5)
        setGeneratedTeams({
            team1: [shuffled[0], shuffled[1]],
            team2: [shuffled[2], shuffled[3]]
        })
    }

    const confirmMatch = () => {
        if (!generatedTeams) return
        onMatchGenerated(generatedTeams.team1, generatedTeams.team2)
        setGeneratedTeams(null)
        setSelectedPlayers([])
        setMode('select')
    }

    const TeamCard = ({ team, label }) => (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 flex-1">
            <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-3 text-center">{label}</div>
            <div className="space-y-3">
                {team.map(player => {
                    const ps = padelStatsMap[player.id]
                    return (
                        <div key={player.id} className="flex items-center gap-3">
                            <img
                                src={player.avatar_url || 'https://via.placeholder.com/40'}
                                className="w-12 h-12 rounded-full object-cover bg-gray-200 dark:bg-gray-600"
                                alt={player.name}
                            />
                            <div>
                                <div className="font-bold text-gray-900 dark:text-white">{player.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    ELO: {(ps?.matches_played || 0) >= 10 ? (ps?.elo_rating || 1200) : `Placement (${ps?.matches_played || 0}/10)`}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl border border-gray-100 dark:border-gray-700">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">🎾 Padel Match Generator</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            {mode === 'select'
                                ? `Select 4 players (${selectedPlayers.length}/4) to generate random teams`
                                : 'Teams generated! Confirm or reshuffle.'
                            }
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {mode === 'select' ? (
                        <>
                            {/* Player Selection */}
                            {availablePlayers.length < 4 && (
                                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2">
                                    <AlertCircle size={16} className="text-amber-600 dark:text-amber-400" />
                                    <span className="text-amber-700 dark:text-amber-300 text-sm">Need at least 4 available players for padel</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {users.map(user => {
                                    const isExcluded = excludedPlayers.has(user.id)
                                    const isSelected = selectedPlayers.some(p => p.id === user.id)
                                    const ps = padelStatsMap[user.id]

                                    return (
                                        <div
                                            key={user.id}
                                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${isExcluded
                                                    ? 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-50'
                                                    : isSelected
                                                        ? 'bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-600 ring-2 ring-green-400'
                                                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-green-300'
                                                }`}
                                            onClick={() => !isExcluded && toggleSelect(user)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={user.avatar_url || 'https://via.placeholder.com/40'}
                                                    className="w-10 h-10 rounded-full object-cover bg-gray-200 dark:bg-gray-600"
                                                    alt={user.name}
                                                />
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white text-sm">{user.name}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                        Padel ELO: {(ps?.matches_played || 0) >= 10 ? (ps?.elo_rating || 1200) : `P(${ps?.matches_played || 0}/10)`}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleExclude(user.id) }}
                                                className={`text-xs px-2 py-1 rounded ${isExcluded ? 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300' : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 hover:bg-red-100 hover:text-red-600'}`}
                                                title={isExcluded ? 'Include player' : 'Exclude player'}
                                            >
                                                {isExcluded ? 'Include' : 'Exclude'}
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    ) : (
                        /* Teams Result */
                        generatedTeams && (
                            <div className="space-y-6">
                                <div className="flex gap-4 items-center">
                                    <TeamCard team={generatedTeams.team1} label="Team 1" />
                                    <div className="text-2xl font-bold text-gray-400 dark:text-gray-500">VS</div>
                                    <TeamCard team={generatedTeams.team2} label="Team 2" />
                                </div>
                            </div>
                        )
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                    {mode === 'select' ? (
                        <button
                            onClick={generateTeams}
                            disabled={selectedPlayers.length !== 4}
                            className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Shuffle size={18} className="mr-2" />
                            Generate Teams
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setMode('select')}
                                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                                Back
                            </button>
                            <button
                                onClick={reshuffleTeams}
                                className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                            >
                                <Shuffle size={16} className="mr-2" />
                                Reshuffle
                            </button>
                            <button
                                onClick={confirmMatch}
                                className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors"
                            >
                                <Check size={18} className="mr-2" />
                                Confirm & Play
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default PadelMatchGeneratorModal
