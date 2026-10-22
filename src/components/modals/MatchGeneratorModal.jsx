import React, { useState, useEffect, useMemo } from 'react'
import { X, Shuffle, Check, AlertCircle, Scale } from 'lucide-react'
import { getHeadToHeadStreak, getHandicapRule, getActiveDebuffs, getAvatarFallback, calculateExpectedScore } from '../../utils'
import { generatePairing, getRecentMatches, getRestingPlayers } from '../../matchGenerator'

const POOL_KEY = 'matchGeneratorPool'

const loadSavedPool = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(POOL_KEY))
        return Array.isArray(saved) ? saved : null
    } catch {
        return null
    }
}

const MatchGeneratorModal = ({ isOpen, onClose, users, matches, onMatchGenerated }) => {
    // null = no saved choice yet, so everyone is in the pool
    const [selectedPool, setSelectedPool] = useState(null)
    const [openedAt, setOpenedAt] = useState(null)
    const [debuffs, setDebuffs] = useState([])
    const [generatedMatch, setGeneratedMatch] = useState(null)
    const [handicapRule, setHandicapRule] = useState(null)
    const [error, setError] = useState(null)
    const [isGenerating, setIsGenerating] = useState(false)

    // Reset only when the modal opens, so realtime updates don't wipe a shown pairing
    useEffect(() => {
        if (!isOpen) return undefined
        let cancelled = false

        const timer = setTimeout(() => {
            setSelectedPool(loadSavedPool())
            setOpenedAt(Date.now())
            setGeneratedMatch(null)
            setHandicapRule(null)
            setError(null)
        }, 0)
        getActiveDebuffs().then(active => { if (!cancelled) setDebuffs(active) })

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [isOpen])

    const recentMatches = useMemo(() => openedAt ? getRecentMatches(matches, openedAt) : [], [matches, openedAt])
    const excludedPlayers = useMemo(() => getRestingPlayers(recentMatches), [recentMatches])
    const pool = selectedPool ?? users.map(u => u.id)

    const togglePlayer = (userId) => {
        const next = pool.includes(userId) ? pool.filter(id => id !== userId) : [...pool, userId]
        const valid = next.filter(id => users.some(u => u.id === id))
        setSelectedPool(valid)
        try {
            localStorage.setItem(POOL_KEY, JSON.stringify(valid))
        } catch {
            // Storage unavailable: the pool still works for this visit
        }
    }

    const generateMatch = () => {
        setError(null)
        const avoidPair = generatedMatch?.map(p => p.id) ?? null
        setGeneratedMatch(null)

        const inPool = users.filter(u => pool.includes(u.id))
        const candidates = inPool.filter(u => !excludedPlayers.includes(u.id))

        if (candidates.length < 2) {
            const resting = inPool.filter(u => excludedPlayers.includes(u.id)).map(u => u.name)
            setError(resting.length
                ? `Not enough players: ${resting.join(' and ')} ${resting.length > 1 ? 'are' : 'is'} resting after playing the last 2 games. Add more players to the pool.`
                : 'Select at least 2 players.')
            return
        }

        setIsGenerating(true)
        setTimeout(() => {
            const [player1, player2] = generatePairing(candidates, recentMatches, { avoidPair })

            const { streak, winnerId } = getHeadToHeadStreak(player1.id, player2.id, matches)
            let rule = null

            if (streak >= 8 && winnerId) {
                const winnerName = winnerId === player1.id ? player1.name : player2.name
                const loserName = winnerId === player1.id ? player2.name : player1.name
                rule = getHandicapRule(streak, winnerName, loserName, debuffs)
            }

            setGeneratedMatch([player1, player2])
            setHandicapRule(rule)
            setIsGenerating(false)
        }, 600)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90dvh]">
                {/* Header */}
                <div className="px-4 py-3 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                        <Shuffle className="mr-2 text-blue-600 dark:text-blue-400" />
                        Generate Match
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="p-2 -m-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 overflow-y-auto">
                    {generatedMatch ? (
                        <div className="text-center py-8">
                            <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-6">Match Found!</h3>
                            <div className="flex items-center justify-center gap-4 mb-8">
                                <div className="flex flex-col items-center">
                                    <img
                                        src={generatedMatch[0].avatar_url || getAvatarFallback(generatedMatch[0].name)}
                                        alt={generatedMatch[0].name}
                                        className="w-20 h-20 rounded-full border-4 border-blue-500 shadow-lg object-cover"
                                    />
                                    <span className="mt-2 font-bold text-lg dark:text-white">{generatedMatch[0].name}</span>
                                </div>
                                <div className="text-2xl font-bold text-gray-300">VS</div>
                                <div className="flex flex-col items-center">
                                    <img
                                        src={generatedMatch[1].avatar_url || getAvatarFallback(generatedMatch[1].name)}
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
                                    onClick={generateMatch}
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
                                Select players available for this match. Players who played the last 2 games in a row sit the next one out. Games older than 12 hours don't count.
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

                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                {users.map(user => {
                                    const isExcluded = excludedPlayers.includes(user.id)
                                    const isSelected = pool.includes(user.id)

                                    return (
                                        <button
                                            key={user.id}
                                            onClick={() => !isExcluded && togglePlayer(user.id)}
                                            disabled={isExcluded}
                                            className={`
                                                flex items-center min-w-0 p-2.5 sm:p-3 rounded-lg border text-left transition-all
                                                ${isExcluded
                                                    ? 'opacity-50 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                                                    : isSelected
                                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-500'
                                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                                }
                                            `}
                                        >
                                            <div className={`
                                                w-5 h-5 shrink-0 rounded-full border flex items-center justify-center mr-2 sm:mr-3
                                                ${isSelected && !isExcluded ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600'}
                                            `}>
                                                {isSelected && !isExcluded && <Check size={12} className="text-white" />}
                                            </div>
                                            <img src={user.avatar_url || getAvatarFallback(user.name)} alt="" className="w-10 h-10 shrink-0 rounded-full bg-gray-200 mr-2 sm:mr-3 object-cover" />
                                            <span className={`font-medium truncate ${isExcluded ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                                {user.name}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Kept below the scrolling list so it is reachable without scrolling to the end. */}
                {!generatedMatch && (
                    <div className="px-4 pt-3 pb-4 sm:px-6 sm:pb-6 border-t border-gray-100 dark:border-gray-700">
                        {error && (
                            <div className="mb-3 text-red-500 text-sm text-center font-medium animate-pulse">
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
                    </div>
                )}
            </div>
        </div>
    )
}

export default MatchGeneratorModal
