import React, { useState } from 'react'
import { X } from 'lucide-react'
import UserCard from '../UserCard'

const PlayerSelectionModal = ({ isOpen, onClose, users, onPlayersSelected }) => {
    const [selectedPlayers, setSelectedPlayers] = useState([])

    if (!isOpen) return null

    const handlePlayerClick = (user) => {
        const isSelected = selectedPlayers.some(p => p.id === user.id)
        let newSelected = []

        if (isSelected) {
            newSelected = selectedPlayers.filter(p => p.id !== user.id)
        } else {
            if (selectedPlayers.length >= 2) return
            newSelected = [...selectedPlayers, user]
        }

        setSelectedPlayers(newSelected)

        // If 2 players selected, trigger callback after a short delay
        if (newSelected.length === 2) {
            setTimeout(() => {
                onPlayersSelected(newSelected[0], newSelected[1])
                setSelectedPlayers([]) // Reset for next time
            }, 300)
        }
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
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Select Players for Match</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Choose 2 players ({selectedPlayers.length}/2 selected)
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
                    <div className="bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800 px-6 py-3">
                        <div className="flex items-center justify-between">
                            <span className="text-blue-800 dark:text-blue-200 font-medium">
                                Selected: {selectedPlayers.map(p => p.name).join(' vs ')}
                            </span>
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
                        </div>
                    </div>
                )}

                {/* Player Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {users.length === 0 ? (
                        <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                            <div className="text-6xl mb-4">👻</div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">No players found</h3>
                            <p className="text-gray-500 dark:text-gray-400">Add some players first!</p>
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
                                    onEdit={() => { }} // Disable edit in this modal
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default PlayerSelectionModal
