import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Undo2, Trophy, Scale, Skull, X } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { recalculatePlayerStats, getHeadToHeadStreak, getHandicapRule, getActiveDebuffs } from '../../utils'
import { useToast } from '../../contexts/ToastContext'

const WINNING_SCORE = 11
const MIN_LEAD = 2

const LiveMatchModal = ({ isOpen, onClose, player1, player2, onMatchSaved, matches }) => {
    const { showToast } = useToast()
    const [score1, setScore1] = useState(0)
    const [score2, setScore2] = useState(0)
    const [history, setHistory] = useState([]) // array of 1 or 2 indicating who scored
    const [winner, setWinner] = useState(null) // null | 1 | 2
    const [saving, setSaving] = useState(false)
    const [allDebuffs, setAllDebuffs] = useState([])
    const [showWinAnimation, setShowWinAnimation] = useState(false)

    // Reset everything when modal opens
    useEffect(() => {
        if (isOpen) {
            setScore1(0)
            setScore2(0)
            setHistory([])
            setWinner(null)
            setSaving(false)
            setShowWinAnimation(false)
            getActiveDebuffs().then(setAllDebuffs)
        }
    }, [isOpen])

    // Check win condition
    const checkWin = useCallback((s1, s2) => {
        if (s1 >= WINNING_SCORE && s1 - s2 >= MIN_LEAD) return 1
        if (s2 >= WINNING_SCORE && s2 - s1 >= MIN_LEAD) return 2
        return null
    }, [])

    // Handicap / debuff rules
    const activeRules = useMemo(() => {
        if (!isOpen || !player1 || !player2) return []

        const { streak, winnerId } = matches ? getHeadToHeadStreak(player1.id, player2.id, matches) : { streak: 0, winnerId: null }
        let streakRule = null

        if (streak >= 8 && winnerId) {
            const winnerName = winnerId === player1.id ? player1.name : player2.name
            const loserName = winnerId === player1.id ? player2.name : player1.name
            streakRule = getHandicapRule(streak, winnerName, loserName, allDebuffs)
        }

        const rules = []
        if (streakRule) rules.push({ ...streakRule, type: 'streak' })
        return rules
    }, [isOpen, player1, player2, matches, allDebuffs])

    const scorePoint = (playerNum) => {
        if (winner) return

        let newS1 = score1
        let newS2 = score2

        if (playerNum === 1) newS1 += 1
        else newS2 += 1

        setScore1(newS1)
        setScore2(newS2)
        setHistory(prev => [...prev, playerNum])

        const w = checkWin(newS1, newS2)
        if (w) {
            setWinner(w)
            setShowWinAnimation(true)
        }
    }

    const undoLast = () => {
        if (history.length === 0 || winner) return

        const lastScorer = history[history.length - 1]
        setHistory(prev => prev.slice(0, -1))

        if (lastScorer === 1) setScore1(prev => prev - 1)
        else setScore2(prev => prev - 1)
    }

    const handleSave = async () => {
        if (!winner) return
        setSaving(true)
        try {
            const { error: matchError } = await supabase
                .from('matches')
                .insert([
                    {
                        player1_id: player1.id,
                        player2_id: player2.id,
                        score1,
                        score2,
                        handicap_rule: activeRules.length > 0 ? activeRules : null,
                    }
                ])

            if (matchError) throw matchError

            await recalculatePlayerStats()
            onMatchSaved()
        } catch (error) {
            console.error(error)
            showToast('Error saving match: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    if (!isOpen || !player1 || !player2) return null

    const isDeuce = score1 >= 10 && score2 >= 10
    const winnerPlayer = winner === 1 ? player1 : winner === 2 ? player2 : null
    const matchPoint1 = !winner && score1 >= 10 && score1 > score2 && score1 - score2 >= 1
    const matchPoint2 = !winner && score2 >= 10 && score2 > score1 && score2 - score1 >= 1

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">

                {/* Close button */}
                {!winner && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-white/80 dark:bg-gray-800/80 rounded-full p-2"
                    >
                        <X size={20} />
                    </button>
                )}

                {/* Header */}
                <div className="text-center pt-6 pb-2 px-4">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        {winner ? '🏆 Match Complete' : isDeuce ? '🔥 Deuce!' : 'Live Match'}
                    </h2>
                    {(matchPoint1 || matchPoint2) && !winner && (
                        <div className="mt-1 text-xs font-bold text-amber-500 dark:text-amber-400 animate-pulse uppercase tracking-wider">
                            Match Point — {matchPoint1 ? player1.name : player2.name}
                        </div>
                    )}
                </div>

                {/* Handicap rules */}
                {activeRules.length > 0 && (
                    <div className="mx-6 mb-2 space-y-2">
                        {activeRules.map((rule, idx) => (
                            <div key={idx} className={`p-3 border-l-4 rounded-r-lg text-left text-sm ${rule.type === 'mayhem'
                                ? 'bg-purple-50 dark:bg-purple-900/40 border-purple-500'
                                : 'bg-amber-50 dark:bg-amber-900/40 border-amber-500'
                                }`}>
                                <div className="flex items-start">
                                    {rule.type === 'mayhem' ? (
                                        <Skull className="text-purple-600 dark:text-purple-400 mr-2 mt-0.5 flex-shrink-0" size={16} />
                                    ) : (
                                        <Scale className="text-amber-600 dark:text-amber-400 mr-2 mt-0.5 flex-shrink-0" size={16} />
                                    )}
                                    <div>
                                        <span className={`font-bold text-xs uppercase tracking-wide ${rule.type === 'mayhem' ? 'text-purple-800 dark:text-purple-200' : 'text-amber-800 dark:text-amber-200'}`}>
                                            {rule.title}
                                        </span>
                                        <span className={`ml-2 text-xs ${rule.type === 'mayhem' ? 'text-purple-700 dark:text-purple-100' : 'text-amber-700 dark:text-amber-100'}`}>
                                            {rule.description}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Score Area */}
                <div className="flex-1 flex items-stretch px-4 pb-4 pt-2 gap-3 min-h-0">
                    {/* Player 1 Side */}
                    <button
                        onClick={() => scorePoint(1)}
                        disabled={!!winner}
                        className={`
                            flex-1 rounded-2xl flex flex-col items-center justify-center p-4 transition-all duration-200 select-none
                            ${winner === 1
                                ? 'bg-gradient-to-b from-blue-500 to-blue-700 ring-4 ring-blue-400 shadow-xl shadow-blue-500/30'
                                : winner === 2
                                    ? 'bg-gray-100 dark:bg-gray-800 opacity-60'
                                    : 'bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/50 hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-900/40 dark:hover:to-blue-900/60 active:scale-[0.97] cursor-pointer border-2 border-blue-200 dark:border-blue-800'
                            }
                        `}
                    >
                        <img
                            src={player1.avatar_url || 'https://via.placeholder.com/150'}
                            alt={player1.name}
                            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg mb-3 ${winner === 1 ? 'border-4 border-white' : 'border-3 border-blue-300 dark:border-blue-600'}`}
                        />
                        <span className={`font-bold text-sm sm:text-base truncate max-w-full ${winner === 1 ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                            {player1.name}
                        </span>
                        <div className={`text-6xl sm:text-8xl font-black tabular-nums mt-2 leading-none transition-all duration-200 ${winner === 1 ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`}>
                            {score1}
                        </div>
                        {winner === 1 && (
                            <div className="mt-3 flex items-center gap-2 text-white">
                                <Trophy size={20} />
                                <span className="font-bold text-sm uppercase tracking-wider">Winner!</span>
                            </div>
                        )}
                    </button>

                    {/* Divider */}
                    <div className="flex flex-col items-center justify-center gap-2 w-10 flex-shrink-0">
                        <div className="text-gray-300 dark:text-gray-600 font-bold text-lg">VS</div>
                    </div>

                    {/* Player 2 Side */}
                    <button
                        onClick={() => scorePoint(2)}
                        disabled={!!winner}
                        className={`
                            flex-1 rounded-2xl flex flex-col items-center justify-center p-4 transition-all duration-200 select-none
                            ${winner === 2
                                ? 'bg-gradient-to-b from-red-500 to-red-700 ring-4 ring-red-400 shadow-xl shadow-red-500/30'
                                : winner === 1
                                    ? 'bg-gray-100 dark:bg-gray-800 opacity-60'
                                    : 'bg-gradient-to-b from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/50 hover:from-red-100 hover:to-red-200 dark:hover:from-red-900/40 dark:hover:to-red-900/60 active:scale-[0.97] cursor-pointer border-2 border-red-200 dark:border-red-800'
                            }
                        `}
                    >
                        <img
                            src={player2.avatar_url || 'https://via.placeholder.com/150'}
                            alt={player2.name}
                            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg mb-3 ${winner === 2 ? 'border-4 border-white' : 'border-3 border-red-300 dark:border-red-600'}`}
                        />
                        <span className={`font-bold text-sm sm:text-base truncate max-w-full ${winner === 2 ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                            {player2.name}
                        </span>
                        <div className={`text-6xl sm:text-8xl font-black tabular-nums mt-2 leading-none transition-all duration-200 ${winner === 2 ? 'text-white' : 'text-red-600 dark:text-red-400'}`}>
                            {score2}
                        </div>
                        {winner === 2 && (
                            <div className="mt-3 flex items-center gap-2 text-white">
                                <Trophy size={20} />
                                <span className="font-bold text-sm uppercase tracking-wider">Winner!</span>
                            </div>
                        )}
                    </button>
                </div>

                {/* Bottom Bar */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                    {!winner ? (
                        <>
                            <button
                                onClick={undoLast}
                                disabled={history.length === 0}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                            >
                                <Undo2 size={16} />
                                Undo
                            </button>
                            <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                                Tap a player's side to score
                            </div>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 disabled:opacity-50 transition-all text-sm flex items-center gap-2"
                            >
                                <Trophy size={18} />
                                {saving ? 'Saving...' : 'Save Match'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default LiveMatchModal
