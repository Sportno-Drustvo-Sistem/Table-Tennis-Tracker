import React, { useState } from 'react'
import { Search, X } from 'lucide-react'
import UserCard from '../UserCard'
import { getAvatarFallback } from '../../utils'

const PlayerSelectionModal = ({ isOpen, onClose, users, onPlayersSelected, onLiveMatchSelected, sport = 'pingpong', sportStatsMap, title = 'Select Players for Match', accent = 'blue' }) => {
    const [selectedPlayers, setSelectedPlayers] = useState([])
    const [query, setQuery] = useState('')

    if (!isOpen) return null

    const search = query.trim().toLowerCase()
    const visibleUsers = search ? users.filter(user => user.name.toLowerCase().includes(search)) : users

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
        // Clear the filter after a pick so the next player can be searched straight away.
        if (!isSelected) setQuery('')

        // If 2 players selected, don't trigger callback automatically anymore
        // Instead they will choose Live Match or Record Match from the banner
    }

    const handleClose = () => {
        setSelectedPlayers([])
        setQuery('')
        onClose()
    }

    const accentButton = accent === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
    const ready = selectedPlayers.length === 2

    return (
        // Bottom sheet on phones: actions sit in thumb reach and the fixed height never jumps while filtering.
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={handleClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-5xl h-[88dvh] sm:h-[80vh] flex flex-col shadow-xl border border-gray-100 dark:border-gray-700 animate-slide-up"
            >
                {/* Header */}
                <div className="flex justify-between items-center px-4 py-3 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="min-w-0">
                        <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">{title}</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm sm:mt-1">
                            Choose 2 players ({selectedPlayers.length}/2 selected)
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        aria-label="Close"
                        className="p-2 -mr-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Player Grid */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {users.length > 0 && (
                        <div className="relative mb-4 sm:max-w-sm">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={`Search ${users.length} players`}
                                aria-label="Search players"
                                className="w-full h-10 sm:h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
                            />
                        </div>
                    )}
                    {users.length > 0 && visibleUsers.length === 0 && (
                        <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No players match “{query}”.</p>
                    )}
                    {users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
                            <div className="mb-6 flex justify-center drop-shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 36 36">
                                    <path fill="#E1E8ED" d="M36 11a2 2 0 0 0-4 0s-.011 3.285-3 3.894V12c0-6.075-4.925-11-11-11S7 5.925 7 12v3.237C1.778 16.806 0 23.231 0 27a2 2 0 0 0 4 0s.002-3.54 3.336-3.958C7.838 27.883 8.954 33 11 33h1c4 0 3 2 7 2s3-2 6-2s2.395 2 6 2a3 3 0 0 0 3-3c0-.675-2.274-4.994-3.755-9.268C35.981 21.348 36 14.58 36 11z" />
                                    <circle cx="13" cy="12" r="2" fill="#292F33" />
                                    <circle cx="23" cy="12" r="4" fill="#292F33" />
                                    <circle cx="23" cy="13" r="2" fill="#9AAAB4" />
                                    <path fill="#292F33" d="M22.192 19.491c2.65 1.987 3.591 5.211 2.1 7.199s-4.849 1.988-7.5 0s-3.591-5.211-2.1-7.199c1.492-1.989 4.849-1.988 7.5 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">No players found</h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-sm text-center">It looks like the roster is empty. Head back and add some players to get the action started!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                            {visibleUsers.map(user => (
                                <UserCard
                                    key={user.id}
                                    user={user}
                                    selectionMode={true}
                                    isSelected={selectedPlayers.some(p => p.id === user.id)}
                                    onClick={() => handlePlayerClick(user)}
                                    onEdit={() => { }} // Disable edit in this modal
                                    compact={true}
                                    sport={sport}
                                    tennisStats={sportStatsMap?.[user.id]}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Selection + actions */}
                {users.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-700 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            {selectedPlayers.length > 0 && (
                                <div className="flex -space-x-2 shrink-0">
                                    {selectedPlayers.map(p => (
                                        <img
                                            key={p.id}
                                            src={p.avatar_url || getAvatarFallback(p.name)}
                                            className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 object-cover"
                                            alt={p.name}
                                        />
                                    ))}
                                </div>
                            )}
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                                {selectedPlayers.length === 0
                                    ? 'Tap two players'
                                    : selectedPlayers.map(p => p.name).join(' vs ') + (ready ? '' : ' vs …')}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                disabled={!ready}
                                onClick={() => {
                                    onPlayersSelected(selectedPlayers[0], selectedPlayers[1])
                                    setSelectedPlayers([])
                                }}
                                className={`${accentButton} flex-1 sm:flex-none h-11 sm:h-9 px-4 text-white text-sm font-bold rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                                Record Score
                            </button>
                            {onLiveMatchSelected && (
                                <button
                                    disabled={!ready}
                                    onClick={() => {
                                        onLiveMatchSelected(selectedPlayers[0], selectedPlayers[1])
                                        setSelectedPlayers([])
                                    }}
                                    className="group flex-1 sm:flex-none h-11 sm:h-9 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm flex items-center justify-center gap-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 36 36" className="transform -rotate-12 group-hover:scale-110 transition-transform">
                                        <path fill="#ffac33" d="M32.938 15.651A1 1 0 0 0 32 15H19.925L26.89 1.458A1 1 0 0 0 26 0a1 1 0 0 0-.653.243L18 6.588L3.347 19.243A1 1 0 0 0 4 21h12.075L9.11 34.542A1 1 0 0 0 10 36a1 1 0 0 0 .653-.243L18 29.412l14.653-12.655a1 1 0 0 0 .285-1.106" />
                                    </svg>
                                    Live Match
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default PlayerSelectionModal
