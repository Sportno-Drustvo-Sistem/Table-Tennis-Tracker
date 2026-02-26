import React, { useState } from 'react'
import { Plus, Users, ArrowRight, Dices, Trophy, Shield, Settings } from 'lucide-react'
import { generateTournamentName } from '../../utils'

const TournamentSetup = ({ users, onStart, isAdmin }) => {
    const [name, setName] = useState(generateTournamentName())
    const [selectedPlayerIds, setSelectedPlayerIds] = useState([])
    const [format, setFormat] = useState('single_elim') // 'single_elim', 'double_elim'
    const [useGroupStage, setUseGroupStage] = useState(false)
    const [mayhemMode, setMayhemMode] = useState(false)

    // Available players (filtered slightly to avoid partial/broken users if any)
    const availableUsers = users.filter(u => u && u.name)

    const handleTogglePlayer = (id) => {
        if (selectedPlayerIds.includes(id)) {
            setSelectedPlayerIds(selectedPlayerIds.filter(pId => pId !== id))
        } else {
            if (selectedPlayerIds.length >= 16) return // Max 16
            setSelectedPlayerIds([...selectedPlayerIds, id])
        }
    }

    const handleRandomizeName = () => {
        setName(generateTournamentName())
    }

    const handleSelectAll = () => {
        if (selectedPlayerIds.length === availableUsers.length) {
            setSelectedPlayerIds([])
        } else {
            setSelectedPlayerIds(availableUsers.slice(0, 16).map(u => u.id))
        }
    }

    const canStart = selectedPlayerIds.length >= 3 && selectedPlayerIds.length <= 16 && name.trim().length > 0

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-4 bg-gray-100 dark:bg-gray-700/50 rounded-full mb-4">
                    <Trophy size={48} className="text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">No Active Tournaments</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md text-center">
                    There are no tournaments currently available to view. Ask an admin to start one!
                </p>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold mb-6 flex items-center text-gray-900 dark:text-white">
                    <Trophy className="mr-3 text-yellow-500" />
                    Create New Tournament
                </h2>

                {/* Name Input */}
                <div className="mb-8">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tournament Name</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Summer Smash 2024"
                            className="flex-1 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none dark:text-white transition-all"
                        />
                        <button
                            onClick={handleRandomizeName}
                            className="p-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-blue-50 dark:hover:bg-gray-600 hover:text-blue-600 transition-colors tooltip-trigger"
                            title="Randomize Name"
                        >
                            <Dices size={24} />
                        </button>
                    </div>
                </div>

                {/* Format Selection */}
                <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                        onClick={() => setFormat('single_elim')}
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${format === 'single_elim' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
                    >
                        <div className="flex items-center mb-2">
                            <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${format === 'single_elim' ? 'border-blue-600' : 'border-gray-400'}`}>
                                {format === 'single_elim' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">Single Elimination</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 pl-8">Standard bracket. Lose once and you're out.</p>
                    </div>

                    <div
                        onClick={() => setFormat('double_elim')}
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${format === 'double_elim' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'}`}
                    >
                        <div className="flex items-center mb-2">
                            <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${format === 'double_elim' ? 'border-purple-600' : 'border-gray-400'}`}>
                                {format === 'double_elim' && <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />}
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">Double Elimination</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 pl-8">Upper and Lower brackets. Lose twice to be eliminated.</p>
                    </div>
                </div>

                {/* Group Stage Option */}
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-700">
                    <label className="flex items-start cursor-pointer">
                        <div className="relative flex items-center mt-1">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={useGroupStage}
                                onChange={(e) => setUseGroupStage(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-600 peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                        </div>
                        <div className="ml-3">
                            <span className="block text-sm font-bold text-gray-900 dark:text-white">Enable Group Stage Seeding</span>
                            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">Play a Round Robin group stage first to determine seeding for the bracket. More games for everyone!</span>
                        </div>
                    </label>
                </div>

                {/* Mayhem Mode Option */}
                <div className="mb-8 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-700/50">
                    <label className="flex items-start cursor-pointer">
                        <div className="relative flex items-center mt-1">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={mayhemMode}
                                onChange={(e) => setMayhemMode(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-600 peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                        </div>
                        <div className="ml-3">
                            <div className="flex items-center">
                                <span className="block text-sm font-bold text-gray-900 dark:text-white mr-2">Mayhem Mode</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 font-bold tracking-wider">NEW</span>
                            </div>
                            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">Players receive random debuffs based on Elo. Chaos guaranteed!</span>
                        </div>
                    </label>
                </div>

                {/* Player Selection */}
                <div className="mb-8">
                    <div className="flex justify-between items-end mb-3">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Select Players ({selectedPlayerIds.length}/16)
                            <span className="ml-2 text-xs font-normal text-red-500">{selectedPlayerIds.length < 3 ? '(Min 3 required)' : ''}</span>
                        </label>
                        <button
                            onClick={handleSelectAll}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                            {selectedPlayerIds.length === availableUsers.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {availableUsers.map(user => (
                            <div
                                key={user.id}
                                onClick={() => handleTogglePlayer(user.id)}
                                className={`
                   cursor-pointer p-3 rounded-lg border flex items-center transition-all select-none
                   ${selectedPlayerIds.includes(user.id)
                                        ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/30 dark:border-blue-500 shadow-sm'
                                        : 'bg-white border-gray-200 dark:bg-gray-700/50 dark:border-gray-600 hover:border-gray-300 opacity-80 hover:opacity-100'}
                 `}
                            >
                                <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-colors ${selectedPlayerIds.includes(user.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-400'}`}>
                                    {selectedPlayerIds.includes(user.id) && <Plus size={12} className="text-white transform rotate-45" />}
                                </div>
                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Start Button */}
                <button
                    onClick={() => onStart({ name, playerIds: selectedPlayerIds, format, useGroupStage, mayhemMode })}
                    disabled={!canStart}
                    className={`
            w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center transition-all shadow-lg
            ${canStart
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transform hover:scale-[1.02]'
                            : 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'}
          `}
                >
                    <span>Start Tournament</span>
                    <ArrowRight className="ml-2" size={24} />
                </button>

            </div>
        </div>
    )
}

export default TournamentSetup
