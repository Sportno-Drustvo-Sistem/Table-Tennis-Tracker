import React, { useState } from 'react'
import { X, Shuffle, Check, ArrowRight, ArrowLeft } from 'lucide-react'
import UserCard from '../UserCard'

const PadelPlayerSelectionModal = ({ isOpen, onClose, users, onTeamsSelected }) => {
    const [selectedPlayers, setSelectedPlayers] = useState([])
    const [phase, setPhase] = useState('select') // 'select' or 'assign'
    const [team1, setTeam1] = useState([])
    const [team2, setTeam2] = useState([])

    if (!isOpen) return null

    const handlePlayerClick = (user) => {
        if (phase !== 'select') return
        const isSelected = selectedPlayers.some(p => p.id === user.id)

        if (isSelected) {
            setSelectedPlayers(selectedPlayers.filter(p => p.id !== user.id))
        } else {
            if (selectedPlayers.length >= 4) return
            setSelectedPlayers([...selectedPlayers, user])
        }
    }

    const goToAssignPhase = () => {
        if (selectedPlayers.length !== 4) return
        // Start with no assignment — user picks manually
        setTeam1([])
        setTeam2([])
        setPhase('assign')
    }

    const handleShuffleTeams = () => {
        const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5)
        setTeam1([shuffled[0], shuffled[1]])
        setTeam2([shuffled[2], shuffled[3]])
    }

    const handleAssignToTeam = (player, teamNumber) => {
        // Remove from both teams first
        const newTeam1 = team1.filter(p => p.id !== player.id)
        const newTeam2 = team2.filter(p => p.id !== player.id)

        if (teamNumber === 1 && newTeam1.length < 2) {
            newTeam1.push(player)
        } else if (teamNumber === 2 && newTeam2.length < 2) {
            newTeam2.push(player)
        }

        setTeam1(newTeam1)
        setTeam2(newTeam2)
    }

    const getPlayerTeam = (player) => {
        if (team1.some(p => p.id === player.id)) return 1
        if (team2.some(p => p.id === player.id)) return 2
        return null
    }

    const handleConfirm = () => {
        if (team1.length !== 2 || team2.length !== 2) return
        onTeamsSelected(team1, team2)
        resetState()
    }

    const resetState = () => {
        setSelectedPlayers([])
        setTeam1([])
        setTeam2([])
        setPhase('select')
    }

    const handleClose = () => {
        resetState()
        onClose()
    }

    const PlayerBadge = ({ player, teamColor }) => (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${teamColor}`}>
            <img
                src={player.avatar_url || 'https://via.placeholder.com/40'}
                className="w-8 h-8 rounded-full object-cover bg-gray-200"
                alt={player.name}
            />
            <span className="font-bold text-sm text-gray-900 dark:text-white">{player.name}</span>
        </div>
    )

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-xl border border-gray-100 dark:border-gray-700">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {phase === 'select' ? 'Select Players for Padel Match' : 'Assign Teams'}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            {phase === 'select'
                                ? `Choose 4 players (${selectedPlayers.length}/4 selected)`
                                : 'Assign each player to a team, or shuffle randomly'
                            }
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {phase === 'select' ? (
                        /* Phase 1: Select 4 players */
                        <>
                            {users.length < 4 ? (
                                <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                                    <div className="text-6xl mb-4">🎾</div>
                                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">Need at least 4 players</h3>
                                    <p className="text-gray-500 dark:text-gray-400">Add more players to play padel doubles!</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                    {users.map(user => (
                                        <UserCard
                                            key={user.id}
                                            user={user}
                                            selectionMode={true}
                                            isSelected={selectedPlayers.some(p => p.id === user.id)}
                                            onClick={() => handlePlayerClick(user)}
                                            onEdit={() => { }}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        /* Phase 2: Assign to teams */
                        <div className="space-y-6">
                            {/* Unassigned players */}
                            {selectedPlayers.filter(p => !getPlayerTeam(p)).length > 0 && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">
                                        Unassigned — click a team button to assign
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {selectedPlayers.filter(p => !getPlayerTeam(p)).map(player => (
                                            <div key={player.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-200 dark:border-gray-600">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={player.avatar_url || 'https://via.placeholder.com/40'}
                                                        className="w-10 h-10 rounded-full object-cover bg-gray-200 dark:bg-gray-600"
                                                        alt={player.name}
                                                    />
                                                    <span className="font-bold text-gray-900 dark:text-white">{player.name}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleAssignToTeam(player, 1)}
                                                        disabled={team1.length >= 2}
                                                        className="px-3 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 rounded-lg text-xs font-bold hover:bg-emerald-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        <ArrowRight size={14} className="inline mr-1" />Team 1
                                                    </button>
                                                    <button
                                                        onClick={() => handleAssignToTeam(player, 2)}
                                                        disabled={team2.length >= 2}
                                                        className="px-3 py-1.5 bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 rounded-lg text-xs font-bold hover:bg-sky-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        <ArrowRight size={14} className="inline mr-1" />Team 2
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Teams side by side */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {/* Team 1 */}
                                <div className={`rounded-xl border-2 p-4 ${team1.length === 2 ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-dashed border-gray-300 dark:border-gray-600'}`}>
                                    <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-3">
                                        Team 1 ({team1.length}/2)
                                    </h3>
                                    {team1.length === 0 ? (
                                        <p className="text-gray-400 dark:text-gray-500 text-sm py-4 text-center">Assign players here</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {team1.map(player => (
                                                <div key={player.id} className="flex items-center justify-between">
                                                    <PlayerBadge player={player} teamColor="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30" />
                                                    <button
                                                        onClick={() => setTeam1(team1.filter(p => p.id !== player.id))}
                                                        className="ml-2 p-1 text-gray-400 hover:text-red-500 rounded"
                                                        title="Remove from team"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Team 2 */}
                                <div className={`rounded-xl border-2 p-4 ${team2.length === 2 ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/20' : 'border-dashed border-gray-300 dark:border-gray-600'}`}>
                                    <h3 className="text-sm font-bold text-sky-600 dark:text-sky-400 uppercase mb-3">
                                        Team 2 ({team2.length}/2)
                                    </h3>
                                    {team2.length === 0 ? (
                                        <p className="text-gray-400 dark:text-gray-500 text-sm py-4 text-center">Assign players here</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {team2.map(player => (
                                                <div key={player.id} className="flex items-center justify-between">
                                                    <PlayerBadge player={player} teamColor="border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/30" />
                                                    <button
                                                        onClick={() => setTeam2(team2.filter(p => p.id !== player.id))}
                                                        className="ml-2 p-1 text-gray-400 hover:text-red-500 rounded"
                                                        title="Remove from team"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                    {phase === 'select' ? (
                        <>
                            <div />
                            <button
                                onClick={goToAssignPhase}
                                disabled={selectedPlayers.length !== 4}
                                className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                Choose Teams
                                <ArrowRight size={18} className="ml-2" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => { setPhase('select'); setTeam1([]); setTeam2([]) }}
                                className="flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                                <ArrowLeft size={16} className="mr-2" />
                                Back
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleShuffleTeams}
                                    className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                                >
                                    <Shuffle size={16} className="mr-2" />
                                    Shuffle
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={team1.length !== 2 || team2.length !== 2}
                                    className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                >
                                    <Check size={18} className="mr-2" />
                                    Start Match
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default PadelPlayerSelectionModal
