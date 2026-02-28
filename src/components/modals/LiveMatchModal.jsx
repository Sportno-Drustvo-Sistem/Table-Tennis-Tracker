import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Undo2, Trophy, Scale, Skull, X, Volume2, VolumeX, RefreshCw } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { recalculatePlayerStats, getHeadToHeadStreak, getHandicapRule, getActiveDebuffs, calculateExpectedScore, calculateEloChange, getKFactor } from '../../utils'
import { useToast } from '../../contexts/ToastContext'

const WINNING_SCORE = 11
const MIN_LEAD = 2

// --- Sound / Voice Utilities ---
const playBlip = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.12)
    } catch (e) { /* silent fail */ }
}

const playWinSound = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const notes = [523, 659, 784, 1047]
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.value = freq
            osc.type = 'sine'
            gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.15)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3)
            osc.start(ctx.currentTime + i * 0.15)
            osc.stop(ctx.currentTime + i * 0.15 + 0.3)
        })
    } catch (e) { /* silent fail */ }
}

// Wait for any currently playing audio to finish before playing the next
let currentAudio = null;

const speak = (text) => {
    try {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }

        // We use the Google Translate unofficial TTS API for a guaranteed high-quality 
        // female English voice, regardless of browser or OS installed voices.
        // It's incredibly reliable and bypasses the issues with window.speechSynthesis
        // tl=en-GB sets the language to UK English (Female)
        const textEncoded = encodeURIComponent(text);
        const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${textEncoded}&tl=en-GB&client=gtx`;
        
        currentAudio = new Audio(url);
        currentAudio.playbackRate = 0.95; // Slightly slower for better cadence
        currentAudio.play().catch(e => {
            console.error("Audio playback blocked or failed:", e);
            // Fallback to basic window.speechSynthesis if the audio element is blocked
            window.speechSynthesis.cancel()
            const utterance = new SpeechSynthesisUtterance(text)
            utterance.lang = 'en-GB'
            utterance.rate = 0.85
            window.speechSynthesis.speak(utterance)
        });

    } catch (e) { console.error("Speech Error:", e) }
}

const LiveMatchModal = ({ isOpen, onClose, player1, player2, onMatchSaved, matches }) => {
    const { showToast } = useToast()
    const [score1, setScore1] = useState(0)
    const [score2, setScore2] = useState(0)
    const [history, setHistory] = useState([]) // array of 1 or 2 indicating who scored
    const [gameWinner, setGameWinner] = useState(null) // null | 1 | 2 (current game winner)
    const [matchWinner, setMatchWinner] = useState(null) // null | 1 | 2 (overall match winner)
    const [initialServer, setInitialServer] = useState(null) // 1 | 2
    const [saving, setSaving] = useState(false)
    const [allDebuffs, setAllDebuffs] = useState([])
    const [showWinAnimation, setShowWinAnimation] = useState(false)

    // Multi-set state
    const [bestOf, setBestOf] = useState(1) // 1 (single), 3, or 5
    const [completedSets, setCompletedSets] = useState([]) // array of { s1, s2 }
    const [matchStarted, setMatchStarted] = useState(false)

    // Sound / voice
    const [soundEnabled, setSoundEnabled] = useState(() => {
        return localStorage.getItem('liveMatchSound') !== 'off'
    })

    // ELO animation
    const [eloChange, setEloChange] = useState(null) // { p1: number, p2: number }

    // Reset everything when modal opens
    useEffect(() => {
        if (isOpen) {
            setScore1(0)
            setScore2(0)
            setHistory([])
            setGameWinner(null)
            setMatchWinner(null)
            setSaving(false)
            setShowWinAnimation(false)
            setCompletedSets([])
            setBestOf(1)
            setMatchStarted(false)
            setEloChange(null)
            getActiveDebuffs().then(setAllDebuffs)

            // Determine initial server: Higher seed (Lower Elo) serves first
            if (player1 && player2) {
                const p1Elo = player1.elo_rating || 1200
                const p2Elo = player2.elo_rating || 1200
                if (p1Elo < p2Elo) {
                    setInitialServer(1)
                } else if (p2Elo < p1Elo) {
                    setInitialServer(2)
                } else {
                    setInitialServer(Math.random() > 0.5 ? 1 : 2)
                }
            }
        }
    }, [isOpen, player1, player2])

    // Persist sound preference
    useEffect(() => {
        localStorage.setItem('liveMatchSound', soundEnabled ? 'on' : 'off')
    }, [soundEnabled])

    // Check win condition for a single game
    const checkGameWin = useCallback((s1, s2) => {
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

    // How many games needed to win the match
    const gamesNeeded = Math.ceil(bestOf / 2)

    // Count games won
    const gamesWon1 = completedSets.filter(s => s.s1 > s.s2).length
    const gamesWon2 = completedSets.filter(s => s.s2 > s.s1).length

    const scorePoint = (playerNum) => {
        if (gameWinner || matchWinner) return

        let newS1 = score1
        let newS2 = score2

        if (playerNum === 1) newS1 += 1
        else newS2 += 1

        setScore1(newS1)
        setScore2(newS2)
        setHistory(prev => [...prev, playerNum])

        if (!matchStarted) setMatchStarted(true)

        // Sound
        if (soundEnabled) playBlip()

        const w = checkGameWin(newS1, newS2)
        if (w) {
            const newSets = [...completedSets, { s1: newS1, s2: newS2 }]
            setCompletedSets(newSets)

            const newGamesWon1 = newSets.filter(s => s.s1 > s.s2).length
            const newGamesWon2 = newSets.filter(s => s.s2 > s.s1).length

            if (newGamesWon1 >= gamesNeeded || newGamesWon2 >= gamesNeeded) {
                // Match over
                const mw = newGamesWon1 >= gamesNeeded ? 1 : 2
                setGameWinner(w)
                setMatchWinner(mw)
                setShowWinAnimation(true)
                if (soundEnabled) {
                    playWinSound()
                    const winnerName = mw === 1 ? 'Blue' : 'Red'
                    setTimeout(() => speak(`${winnerName} wins!`), 300)
                }
            } else {
                // Game within set done, start next game
                setGameWinner(w)
                if (soundEnabled) {
                    const gameWinnerName = w === 1 ? 'Blue' : 'Red'
                    setTimeout(() => speak(`Game to ${gameWinnerName}... ${newGamesWon1} - ${newGamesWon2}.`), 200)
                }
                // Auto-reset after a brief pause
                setTimeout(() => {
                    setScore1(0)
                    setScore2(0)
                    setHistory([])
                    setGameWinner(null)
                }, 1200)
            }
        } else {
            // Voice announcements for ongoing game
            if (soundEnabled) {
                const isDeuce = newS1 >= 10 && newS2 >= 10
                const mp1 = newS1 >= 10 && newS1 > newS2 && newS1 - newS2 >= 1
                const mp2 = newS2 >= 10 && newS2 > newS1 && newS2 - newS1 >= 1

                // Compute who serves after this point
                const totalPts = newS1 + newS2
                const isDeuceMode = newS1 >= 10 && newS2 >= 10
                let nextServer
                if (isDeuceMode) {
                    nextServer = (totalPts % 2 === 0) ? initialServer : (initialServer === 1 ? 2 : 1)
                } else {
                    const periods = Math.floor(totalPts / 2)
                    nextServer = (periods % 2 === 0) ? initialServer : (initialServer === 1 ? 2 : 1)
                }
                const serverName = nextServer === 1 ? 'Blue' : 'Red'

                // Using commas and ellipses forces the speech engine to pause naturally
                if (isDeuce && newS1 === newS2) {
                    setTimeout(() => speak(`Deuce... ... ${serverName} serves.`), 100)
                } else if (mp1 && !matchWinner) {
                    setTimeout(() => speak(`Match point, Blue... ... Blue, ${newS1}... Red, ${newS2}... ... ${serverName} serves.`), 100)
                } else if (mp2 && !matchWinner) {
                    setTimeout(() => speak(`Match point, Red... ... Blue, ${newS1}... Red, ${newS2}... ... ${serverName} serves.`), 100)
                } else {
                    setTimeout(() => speak(`Blue, ${newS1}... Red, ${newS2}... ... ${serverName} serves.`), 100)
                }
            }
        }
    }

    const undoLast = () => {
        if (history.length === 0 || gameWinner || matchWinner) return

        const lastScorer = history[history.length - 1]
        setHistory(prev => prev.slice(0, -1))

        if (lastScorer === 1) setScore1(prev => prev - 1)
        else setScore2(prev => prev - 1)
    }

    const handleSave = async () => {
        if (!matchWinner) return
        setSaving(true)
        try {
            // Insert each completed set as a separate match record
            const allSets = completedSets
            for (const setScore of allSets) {
                const { error: matchError } = await supabase
                    .from('matches')
                    .insert([
                        {
                            player1_id: player1.id,
                            player2_id: player2.id,
                            score1: setScore.s1,
                            score2: setScore.s2,
                            handicap_rule: activeRules.length > 0 ? activeRules : null,
                        }
                    ])
                if (matchError) throw matchError
            }

            await recalculatePlayerStats()

            // Compute ELO change for animation
            const p1Elo = player1.elo_rating || 1200
            const p2Elo = player2.elo_rating || 1200
            // Sum ELO changes across all games
            let totalP1Change = 0
            let totalP2Change = 0
            let runP1 = p1Elo, runP2 = p2Elo
            const p1Mp = player1.matches_played || 0
            const p2Mp = player2.matches_played || 0
            allSets.forEach((s, i) => {
                const c1 = calculateEloChange(runP1, runP2, s.s1, s.s2, getKFactor(p1Mp + i))
                const c2 = calculateEloChange(runP2, runP1, s.s2, s.s1, getKFactor(p2Mp + i))
                totalP1Change += c1
                totalP2Change += c2
                runP1 += c1
                runP2 += c2
            })
            setEloChange({ p1: Math.round(totalP1Change), p2: Math.round(totalP2Change) })

            // Clear animation after 3 seconds
            setTimeout(() => setEloChange(null), 3000)

            showToast('Match saved!', 'success')
        } catch (error) {
            console.error(error)
            showToast('Error saving match: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleRematch = () => {
        setScore1(0)
        setScore2(0)
        setHistory([])
        setGameWinner(null)
        setMatchWinner(null)
        setShowWinAnimation(false)
        setCompletedSets([])
        setMatchStarted(false)
        setEloChange(null)

        // Re-determine server
        if (player1 && player2) {
            const p1Elo = player1.elo_rating || 1200
            const p2Elo = player2.elo_rating || 1200
            if (p1Elo < p2Elo) setInitialServer(1)
            else if (p2Elo < p1Elo) setInitialServer(2)
            else setInitialServer(Math.random() > 0.5 ? 1 : 2)
        }
    }

    if (!isOpen || !player1 || !player2) return null

    const isDeuce = score1 >= 10 && score2 >= 10
    const winnerPlayer = matchWinner === 1 ? player1 : matchWinner === 2 ? player2 : null
    const matchPoint1 = !gameWinner && !matchWinner && score1 >= 10 && score1 > score2 && score1 - score2 >= 1
    const matchPoint2 = !gameWinner && !matchWinner && score2 >= 10 && score2 > score1 && score2 - score1 >= 1

    // Is this the potentially match-deciding game?
    const isMatchPoint = (gamesWon1 === gamesNeeded - 1 || gamesWon2 === gamesNeeded - 1) && bestOf > 1

    // Serve Tracking Logic
    const currentServer = useMemo(() => {
        if (!initialServer) return null
        const totalPoints = score1 + score2
        const isDeuceMode = score1 >= 10 && score2 >= 10

        if (isDeuceMode) {
            return (totalPoints % 2 === 0) ? initialServer : (initialServer === 1 ? 2 : 1)
        } else {
            const periods = Math.floor(totalPoints / 2)
            return (periods % 2 === 0) ? initialServer : (initialServer === 1 ? 2 : 1)
        }
    }, [score1, score2, initialServer])

    // Win Probability
    const winProb = useMemo(() => {
        if (!player1 || !player2) return null
        const p1Elo = player1.elo_rating || 1200
        const p2Elo = player2.elo_rating || 1200
        const p1Expected = calculateExpectedScore(p1Elo, p2Elo)
        return { p1: Math.round(p1Expected * 100), p2: Math.round((1 - p1Expected) * 100) }
    }, [player1, player2])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">

                {/* Close button */}
                {!matchWinner && (
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
                        {matchWinner ? '🏆 Match Complete' : isDeuce ? '🔥 Deuce!' : gameWinner ? '🎉 Game!' : 'Live Match'}
                    </h2>

                    {/* Best-of selector (only before first point) */}
                    {!matchStarted && !matchWinner && (
                        <div className="mt-2 flex items-center justify-center gap-2">
                            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Format:</span>
                            {[1, 3, 5].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setBestOf(n)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${bestOf === n
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {n === 1 ? 'Single' : `Best of ${n}`}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Win probability bar */}
                    {winProb && !matchWinner && (
                        <div className="mt-2 mx-auto max-w-xs">
                            <div className="flex justify-between text-[10px] font-bold mb-0.5">
                                <span className="text-blue-500">{winProb.p1}%</span>
                                <span className="text-gray-400 dark:text-gray-500">Win Prob</span>
                                <span className="text-red-500">{winProb.p2}%</span>
                            </div>
                            <div className="flex h-1 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                                <div className="bg-blue-500" style={{ width: `${winProb.p1}%` }} />
                                <div className="bg-red-500" style={{ width: `${winProb.p2}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Set scores (multi-game) */}
                    {bestOf > 1 && completedSets.length > 0 && (
                        <div className="mt-2 flex items-center justify-center gap-3">
                            <span className="text-lg font-black text-blue-600 dark:text-blue-400">{gamesWon1}</span>
                            <div className="flex gap-1">
                                {completedSets.map((s, i) => (
                                    <span key={i} className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400">
                                        {s.s1}-{s.s2}
                                    </span>
                                ))}
                            </div>
                            <span className="text-lg font-black text-red-600 dark:text-red-400">{gamesWon2}</span>
                        </div>
                    )}

                    {(matchPoint1 || matchPoint2) && !matchWinner && !gameWinner && (
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
                        disabled={!!gameWinner || !!matchWinner}
                        className={`
                            flex-1 rounded-2xl flex flex-col items-center justify-center p-4 transition-all duration-200 select-none relative overflow-hidden
                            ${matchWinner === 1
                                ? 'bg-gradient-to-b from-blue-500 to-blue-700 ring-4 ring-blue-400 shadow-xl shadow-blue-500/30'
                                : matchWinner === 2
                                    ? 'bg-gray-100 dark:bg-gray-800 opacity-60'
                                    : 'bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/50 hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-900/40 dark:hover:to-blue-900/60 active:scale-[0.97] cursor-pointer border-2 border-blue-200 dark:border-blue-800'
                            }
                        `}
                    >
                        {/* ELO change animation */}
                        {eloChange && (
                            <div className={`absolute top-4 left-1/2 -translate-x-1/2 text-2xl font-black animate-bounce ${eloChange.p1 > 0 ? 'text-green-400' : 'text-red-400'}`}
                                style={{ animation: 'floatUp 2.5s ease-out forwards' }}>
                                {eloChange.p1 > 0 ? '+' : ''}{eloChange.p1}
                            </div>
                        )}

                        <div className="flex items-center gap-2 mb-3">
                            <img
                                src={player1.avatar_url || 'https://via.placeholder.com/150'}
                                alt={player1.name}
                                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg ${matchWinner === 1 ? 'border-4 border-white' : 'border-3 border-blue-300 dark:border-blue-600'}`}
                            />
                            {currentServer === 1 && !matchWinner && !gameWinner && (
                                <div className="bg-amber-400 dark:bg-amber-500 rounded-full p-1 shadow-md animate-bounce">
                                    <div className="w-3 h-3 bg-white rounded-full"></div>
                                </div>
                            )}
                        </div>
                        <div className={`font-bold text-sm sm:text-base truncate max-w-full ${matchWinner === 1 ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`}>
                            {player1.name}
                        </div>
                        <div className={`text-6xl sm:text-8xl font-black tabular-nums mt-2 leading-none transition-all duration-200 ${matchWinner === 1 ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`}>
                            {score1}
                        </div>
                        {matchWinner === 1 && (
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
                        disabled={!!gameWinner || !!matchWinner}
                        className={`
                            flex-1 rounded-2xl flex flex-col items-center justify-center p-4 transition-all duration-200 select-none relative overflow-hidden
                            ${matchWinner === 2
                                ? 'bg-gradient-to-b from-red-500 to-red-700 ring-4 ring-red-400 shadow-xl shadow-red-500/30'
                                : matchWinner === 1
                                    ? 'bg-gray-100 dark:bg-gray-800 opacity-60'
                                    : 'bg-gradient-to-b from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/50 hover:from-red-100 hover:to-red-200 dark:hover:from-red-900/40 dark:hover:to-red-900/60 active:scale-[0.97] cursor-pointer border-2 border-red-200 dark:border-red-800'
                            }
                        `}
                    >
                        {/* ELO change animation */}
                        {eloChange && (
                            <div className={`absolute top-4 left-1/2 -translate-x-1/2 text-2xl font-black animate-bounce ${eloChange.p2 > 0 ? 'text-green-400' : 'text-red-400'}`}
                                style={{ animation: 'floatUp 2.5s ease-out forwards' }}>
                                {eloChange.p2 > 0 ? '+' : ''}{eloChange.p2}
                            </div>
                        )}

                        <div className="flex items-center gap-2 mb-3">
                            {currentServer === 2 && !matchWinner && !gameWinner && (
                                <div className="bg-amber-400 dark:bg-amber-500 rounded-full p-1 shadow-md animate-bounce">
                                    <div className="w-3 h-3 bg-white rounded-full"></div>
                                </div>
                            )}
                            <img
                                src={player2.avatar_url || 'https://via.placeholder.com/150'}
                                alt={player2.name}
                                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg ${matchWinner === 2 ? 'border-4 border-white' : 'border-3 border-red-300 dark:border-red-600'}`}
                            />
                        </div>
                        <div className={`font-bold text-sm sm:text-base truncate max-w-full ${matchWinner === 2 ? 'text-white' : 'text-red-600 dark:text-red-400'}`}>
                            {player2.name}
                        </div>
                        <div className={`text-6xl sm:text-8xl font-black tabular-nums mt-2 leading-none transition-all duration-200 ${matchWinner === 2 ? 'text-white' : 'text-red-600 dark:text-red-400'}`}>
                            {score2}
                        </div>
                        {matchWinner === 2 && (
                            <div className="mt-3 flex items-center gap-2 text-white">
                                <Trophy size={20} />
                                <span className="font-bold text-sm uppercase tracking-wider">Winner!</span>
                            </div>
                        )}
                    </button>
                </div>

                {/* Bottom Bar */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                    {!matchWinner ? (
                        <>
                            <button
                                onClick={undoLast}
                                disabled={history.length === 0 || !!gameWinner}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                            >
                                <Undo2 size={16} />
                                Undo
                            </button>
                            <div className="flex items-center gap-2">
                                <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                                    Tap a player's side to score
                                </div>
                                <button
                                    onClick={() => setSoundEnabled(!soundEnabled)}
                                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-lg"
                                    title={soundEnabled ? 'Mute' : 'Unmute'}
                                >
                                    {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex gap-2">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    Discard
                                </button>
                                <button
                                    onClick={handleRematch}
                                    className="px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center gap-1 font-bold border border-blue-200 dark:border-blue-800"
                                >
                                    <RefreshCw size={14} />
                                    Rematch
                                </button>
                            </div>
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

            {/* CSS for ELO float-up animation */}
            <style>{`
                @keyframes floatUp {
                    0% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    70% { opacity: 1; transform: translateX(-50%) translateY(-40px); }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-60px); }
                }
            `}</style>
        </div>
    )
}

export default LiveMatchModal
