import React, { useState } from 'react'
import { X } from 'lucide-react'
import UserCard from '../UserCard'

const PlayerSelectionModal = ({ isOpen, onClose, users, onPlayersSelected, onLiveMatchSelected }) => {
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

        // If 2 players selected, don't trigger callback automatically anymore
        // Instead they will choose Live Match or Record Match from the banner
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
                            <div className="flex items-center gap-4">
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
                                {selectedPlayers.length === 2 && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                onPlayersSelected(selectedPlayers[0], selectedPlayers[1])
                                                setSelectedPlayers([])
                                            }}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded shadow-sm transition-colors"
                                        >
                                            Record Score
                                        </button>
                                        {onLiveMatchSelected && (
                                            <button
                                                onClick={() => {
                                                    onLiveMatchSelected(selectedPlayers[0], selectedPlayers[1])
                                                    setSelectedPlayers([])
                                                }}
                                                className="group px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-sm font-bold rounded shadow-sm flex items-center gap-1 transition-all"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 36 36" className="transform -rotate-12 group-hover:scale-110 transition-transform">
                                                    <path fill="#ffac33" d="M32.938 15.651A1 1 0 0 0 32 15H19.925L26.89 1.458A1 1 0 0 0 26 0a1 1 0 0 0-.653.243L18 6.588L3.347 19.243A1 1 0 0 0 4 21h12.075L9.11 34.542A1 1 0 0 0 10 36a1 1 0 0 0 .653-.243L18 29.412l14.653-12.655a1 1 0 0 0 .285-1.106" />
                                                </svg>
                                                Live Match
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Player Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
                            <div className="mb-6 flex justify-center drop-shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 36 36">
                                    <path fill="#e1e8ed" d="M36 11a2 2 0 0 0-4 0s-.011 3.285-3 3.894V12c0-6.075-4.925-11-11-11S7 5.925 7 12v3.237C1.778 16.806 0 23.231 0 27a2 2 0 0 0 4 0s.002-3.54 3.336-3.958C7.838 27.883 8.954 33 11 33h1c4 0 3 2 7 2s3-2 6-2s2.395 2 6 2a3 3 0 0 0 3-3c0-.675-2.274-4.994-3.755-9.268C35.981 21.348 36 14.58 36 11" />
                                    <circle cx="13" cy="12" r="2" fill="#292f33" />
                                    <circle cx="23" cy="12" r="4" fill="#292f33" />
                                    <circle cx="23" cy="13" r="2" fill="#9aaab4" />
                                    <path fill="#292f33" d="M22.192 19.491c2.65 1.987 3.591 5.211 2.1 7.199s-4.849 1.988-7.5 0s-3.591-5.211-2.1-7.199c1.492-1.989 4.849-1.988 7.5 0" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">No players found</h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-sm text-center">It looks like the roster is empty. Head back and add some players to get the action started!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                            {users.map(user => (
                                <UserCard
                                    key={user.id}
                                    user={user}
                                    selectionMode={true}
                                    isSelected={selectedPlayers.some(p => p.id === user.id)}
                                    onClick={() => handlePlayerClick(user)}
                                    onEdit={() => { }} // Disable edit in this modal
                                    compact={true}
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
