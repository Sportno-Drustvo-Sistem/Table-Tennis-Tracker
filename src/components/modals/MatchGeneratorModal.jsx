import React, { useState, useEffect } from 'react'
import { X, Shuffle, Check, AlertCircle, Scale } from 'lucide-react'
import { getHeadToHeadStreak, getHandicapRule } from '../../utils'
import { calculateExpectedScore } from '../../utils'

const MatchGeneratorModal = ({ isOpen, onClose, users, matches, onMatchGenerated }) => {
    const [selectedPool, setSelectedPool] = useState([])
    const [excludedPlayers, setExcludedPlayers] = useState([])
    const [generatedMatch, setGeneratedMatch] = useState(null)
    const [handicapRule, setHandicapRule] = useState(null)
    const [error, setError] = useState(null)
    const [isGenerating, setIsGenerating] = useState(false)

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            // Load from localStorage or default to all users
            const savedPool = localStorage.getItem('matchGeneratorPool')
            if (savedPool) {
                try {
                    const parsedPool = JSON.parse(savedPool)
                    // Ensure saved IDs still exist in current users list
                    const validIds = parsedPool.filter(id => users.some(u => u.id === id))
                    setSelectedPool(validIds)
                } catch (e) {
                    setSelectedPool(users.map(u => u.id))
                }
            } else {
                setSelectedPool(users.map(u => u.id))
            }

            setGeneratedMatch(null)
            setHandicapRule(null)
            setError(null)
            identifyExcludedPlayers()
        }
    }, [isOpen, users, matches])

    // Save selected pool when it changes
    const updateSelectedPool = (newPool) => {
        setSelectedPool(newPool)
        localStorage.setItem('matchGeneratorPool', JSON.stringify(newPool))
    }

    const identifyExcludedPlayers = () => {
        // Find players who played the last 2 consecutive matches
        // matches are assumed to be sorted by date desc (newest first)

        const consecutiveMatches = {} // map of userId -> consecutive count
        const excluded = new Set()

        // We only care about the most recent matches to determine "streak"
        // Iterate through matches to find current streaks

        // Actually, the rule is "player shouldn't have more than 2 games in a row"
        // This means if I played the last 2 games, I cannot play the next one.
        // We look at the last 2 matches strictly.

        if (matches.length >= 2) {
            const lastMatch = matches[0]
            const secondLastMatch = matches[1]

            const lastPlayers = [lastMatch.player1_id, lastMatch.player2_id]
            const secondLastPlayers = [secondLastMatch.player1_id, secondLastMatch.player2_id]

            // Check for players present in BOTH
            const playedBoth = lastPlayers.filter(id => secondLastPlayers.includes(id))

            playedBoth.forEach(id => excluded.add(id))
        }

        setExcludedPlayers(Array.from(excluded))
    }

    const togglePlayer = (userId) => {
        if (selectedPool.includes(userId)) {
            updateSelectedPool(selectedPool.filter(id => id !== userId))
        } else {
            updateSelectedPool([...selectedPool, userId])
        }
    }

    const generateMatch = () => {
        setError(null)
        setGeneratedMatch(null)
        setIsGenerating(true)

        // 1. Filter pool: Must be in selectedPool AND NOT in excludedPlayers
        const candidates = users.filter(u =>
            selectedPool.includes(u.id) && !excludedPlayers.includes(u.id)
        )

        if (candidates.length < 2) {
            setError('Not enough available players in the pool (after applying constraints).')
            setIsGenerating(false)
            return
        }

        // 2. Weighted Random Selection
        // Get last 10 matches to determine weights
        const recentMatches = matches.slice(0, 10)

        // Calculate play counts in recent matches
        const playCounts = {}
        // candidateIds line removed as it was unused and invalid

        // Initialize counts to 0
        candidates.forEach(c => playCounts[c.id] = 0)

        // Count occurrences
        recentMatches.forEach(m => {
            if (playCounts[m.player1_id] !== undefined) playCounts[m.player1_id]++
            if (playCounts[m.player2_id] !== undefined) playCounts[m.player2_id]++
        })

        // Calculate weights: 1 / (count + 1)
        // Less played = Higher weight
        const candidatesWithWeights = candidates.map(c => {
            const count = playCounts[c.id]
            const weight = 1 / (count + 1)
            return { ...c, weight, recentCount: count }
        })

        console.log('Match Generation Weights:', candidatesWithWeights.map(c => ({
            name: c.name,
            recentMatches: c.recentCount,
            weight: c.weight.toFixed(3)
        })))

        // Helper for weighted random choice
        const weightedRandomObj = (items) => {
            const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
            let random = Math.random() * totalWeight

            for (const item of items) {
                if (random < item.weight) return item
                random -= item.weight
            }
            return items[items.length - 1]
        }

        setTimeout(() => {
            // Select Player 1
            const player1 = weightedRandomObj(candidatesWithWeights)

            // Select Player 2 (exclude Player 1)
            const remainingCandidates = candidatesWithWeights.filter(c => c.id !== player1.id)
            const player2 = weightedRandomObj(remainingCandidates)

            // Check for Handicap
            const { streak, winnerId } = getHeadToHeadStreak(player1.id, player2.id, matches)
            let rule = null

            if (streak >= 8 && winnerId) {
                const winnerName = winnerId === player1.id ? player1.name : player2.name
                const loserName = winnerId === player1.id ? player2.name : player1.name
                rule = getHandicapRule(streak, winnerName, loserName)
            }

            setGeneratedMatch([player1, player2])
            setHandicapRule(rule)
            setIsGenerating(false)
        }, 600)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                        <Shuffle className="mr-2 text-blue-600 dark:text-blue-400" />
                        Generate Match
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto">
                    {generatedMatch ? (
                        <div className="text-center py-8">
                            <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-6">Match Found!</h3>
                            <div className="flex items-center justify-center gap-4 mb-8">
                                <div className="flex flex-col items-center">
                                    <img
                                        src={generatedMatch[0].avatar_url}
                                        alt={generatedMatch[0].name}
                                        className="w-20 h-20 rounded-full border-4 border-blue-500 shadow-lg object-cover"
                                    />
                                    <span className="mt-2 font-bold text-lg dark:text-white">{generatedMatch[0].name}</span>
                                </div>
                                <div className="text-2xl font-bold text-gray-300">VS</div>
                                <div className="flex flex-col items-center">
                                    <img
                                        src={generatedMatch[1].avatar_url}
                                        alt={generatedMatch[1].name}
                                        className="w-20 h-20 rounded-full border-4 border-red-500 shadow-lg object-cover"
                                    />
                                    <span className="mt-2 font-bold text-lg dark:text-white">{generatedMatch[1].name}</span>
                                </div>
                            </div>

                            {handicapRule && (
                                <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/40 border-l-4 border-amber-500 rounded-r-lg text-left shadow-sm">
                                    <div className="flex items-start">
                                        <Scale className="text-amber-600 dark:text-amber-400 mr-3 mt-1 flex-shrink-0" size={24} />
                                        <div>
                                            <h4 className="font-bold text-amber-800 dark:text-amber-200 uppercase text-sm tracking-wide mb-1">
                                                {handicapRule.title}
                                            </h4>
                                            <p className="text-amber-700 dark:text-amber-100 font-medium">
                                                {handicapRule.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Win Probability */}
                            <div className="mb-6 px-4">
                                {(() => {
                                    const p1Elo = generatedMatch[0].elo_rating || 1200
                                    const p2Elo = generatedMatch[1].elo_rating || 1200
                                    const p1Expected = calculateExpectedScore(p1Elo, p2Elo)
                                    const p1Pct = Math.round(p1Expected * 100)
                                    const p2Pct = 100 - p1Pct
                                    return (
                                        <div>
                                            <div className="flex justify-between text-xs font-bold mb-1">
                                                <span className="text-blue-600 dark:text-blue-400">{p1Pct}%</span>
                                                <span className="text-gray-400 dark:text-gray-500 uppercase text-[10px]">Win Probability</span>
                                                <span className="text-red-500 dark:text-red-400">{p2Pct}%</span>
                                            </div>
                                            <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                                                <div className="bg-blue-500 transition-all" style={{ width: `${p1Pct}%` }} />
                                                <div className="bg-red-500 transition-all" style={{ width: `${p2Pct}%` }} />
                                            </div>
                                        </div>
                                    )
                                })()}
                            </div>

                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => {
                                        setGeneratedMatch(null)
                                        generateMatch()
                                    }}
                                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-600"
                                >
                                    Retry
                                </button>
                                <button
                                    onClick={() => onMatchGenerated(generatedMatch[0], generatedMatch[1])}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center"
                                >
                                    <Check size={20} className="mr-2" />
                                    Start Match
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Select players available for this match. Players who played the last 2 consecutive games are automatically excluded.
                            </p>

                            {/* Exclusion Notice */}
                            {excludedPlayers.length > 0 && (
                                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start text-sm text-amber-800 dark:text-amber-200">
                                    <AlertCircle size={16} className="mr-2 mt-0.5 shrink-0" />
                                    <div>
                                        <span className="font-bold">Taking a break:</span>
                                        {users.filter(u => excludedPlayers.includes(u.id)).map(u => ' ' + u.name).join(', ')}
                                        {' '} (played last 2 games)
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 mb-6">
                                {users.map(user => {
                                    const isExcluded = excludedPlayers.includes(user.id)
                                    const isSelected = selectedPool.includes(user.id)

                                    return (
                                        <button
                                            key={user.id}
                                            onClick={() => !isExcluded && togglePlayer(user.id)}
                                            disabled={isExcluded}
                                            className={`
                                                flex items-center p-3 rounded-lg border text-left transition-all
                                                ${isExcluded
                                                    ? 'opacity-50 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                                                    : isSelected
                                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-500'
                                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                                }
                                            `}
                                        >
                                            <div className={`
                                                w-5 h-5 rounded-full border flex items-center justify-center mr-3
                                                ${isSelected && !isExcluded ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600'}
                                            `}>
                                                {isSelected && !isExcluded && <Check size={12} className="text-white" />}
                                            </div>
                                            <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full bg-gray-200 mr-3 object-cover" />
                                            <span className={`font-medium truncate ${isExcluded ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                                {user.name}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>

                            {error && (
                                <div className="mb-4 text-red-500 text-sm text-center font-medium animate-pulse">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={generateMatch}
                                disabled={isGenerating}
                                className={`
                                    w-full py-3 rounded-xl font-bold text-white shadow-md transition-all flex items-center justify-center
                                    ${isGenerating
                                        ? 'bg-gray-400 cursor-wait'
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                                    }
                                `}
                            >
                                {isGenerating ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        <Shuffle size={20} className="mr-2" />
                                        Generate Match
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default MatchGeneratorModal
