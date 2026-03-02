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
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-300 transform -rotate-12 group-hover:animate-pulse transition-all">
                                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
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
                            <div className="mb-6 relative">
                                <svg className="w-24 h-24 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <div className="absolute -bottom-2 -right-2 bg-blue-100 dark:bg-blue-900/50 rounded-full p-2">
                                    <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
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
