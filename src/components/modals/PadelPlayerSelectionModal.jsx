import React, { useState } from 'react'
import { X, Shuffle } from 'lucide-react'
import UserCard from '../UserCard'

const PadelPlayerSelectionModal = ({ isOpen, onClose, users, onTeamsSelected }) => {
    const [selectedPlayers, setSelectedPlayers] = useState([])

    if (!isOpen) return null

    const handlePlayerClick = (user) => {
        const isSelected = selectedPlayers.some(p => p.id === user.id)
        let newSelected = []

        if (isSelected) {
            newSelected = selectedPlayers.filter(p => p.id !== user.id)
        } else {
            if (selectedPlayers.length >= 4) return
            newSelected = [...selectedPlayers, user]
        }

        setSelectedPlayers(newSelected)
    }

    const handleRandomTeams = () => {
        if (selectedPlayers.length !== 4) return

        // Randomly shuffle and split into 2 teams
        const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5)
        const team1 = [shuffled[0], shuffled[1]]
        const team2 = [shuffled[2], shuffled[3]]

        setTimeout(() => {
            onTeamsSelected(team1, team2)
            setSelectedPlayers([])
        }, 300)
    }

    const handleClose = () => {
        setSelectedPlayers([])
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-xl border border-gray-100 dark:border-gray-700">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Select Players for Padel Match</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Choose 4 players ({selectedPlayers.length}/4 selected) — teams will be assigned randomly
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Selection Banner */}
                {selectedPlayers.length > 0 && (
                    <div className="bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800 px-6 py-3">
                        <div className="flex items-center justify-between">
                            <span className="text-green-800 dark:text-green-200 font-medium">
                                Selected: {selectedPlayers.map(p => p.name).join(', ')}
                            </span>
                            <div className="flex items-center gap-3">
                                <div className="flex -space-x-2">
                                    {selectedPlayers.map(p => (
                                        <img
                                            key={p.id}
                                            src={p.avatar_url || 'https://via.placeholder.com/150'}
                                            className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 object-cover"
                                            alt={p.name}
                                        />
                                    ))}
                                </div>
                                {selectedPlayers.length === 4 && (
                                    <button
                                        onClick={handleRandomTeams}
                                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm"
                                    >
                                        <Shuffle size={16} className="mr-2" />
                                        Shuffle Teams & Start
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Player Grid */}
                <div className="flex-1 overflow-y-auto p-6">
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
                </div>
            </div>
        </div>
    )
}

export default PadelPlayerSelectionModal
