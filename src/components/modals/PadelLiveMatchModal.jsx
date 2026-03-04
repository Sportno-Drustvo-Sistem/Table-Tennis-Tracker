import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Undo2, Trophy, X, Volume2, VolumeX, RefreshCw } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { recalculatePadelStats } from '../../padelUtils'
import { calculateExpectedScore, calculateEloChange, getKFactor, getAvatarFallback } from '../../utils'
import { useToast } from '../../contexts/ToastContext'

// --- Padel Scoring Constants ---
const PADEL_POINTS = ['0', '15', '30', '40'] // Standard point sequence
const GAMES_TO_WIN_SET = 6
const TIEBREAK_TARGET = 7

// --- Sound / Voice Utilities (shared with ping pong) ---
let sharedAudioCtx = null
const getAudioCtx = () => {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
        sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume()
    return sharedAudioCtx
}

const playBlip = () => {
    try {
        const ctx = getAudioCtx()
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
        const ctx = getAudioCtx()
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

let cachedVoices = []
const initVoices = () => {
    return new Promise((resolve) => {
        let voices = window.speechSynthesis.getVoices()
        if (voices.length) { cachedVoices = voices; resolve(voices); return }
        const timeoutId = setTimeout(() => { voices = window.speechSynthesis.getVoices(); cachedVoices = voices; resolve(voices) }, 500)
        window.speechSynthesis.onvoiceschanged = () => {
            clearTimeout(timeoutId)
            voices = window.speechSynthesis.getVoices()
            cachedVoices = voices
            resolve(voices)
        }
    })
}
initVoices()

const speak = async (text) => {
    try {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        let voices = cachedVoices
        if (!voices.length) voices = await initVoices()
        const englishVoices = voices.filter(v => v.lang.startsWith('en'))
        let selectedVoice = englishVoices.find(v =>
            v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('premium') ||
            (v.name.includes('Google') && !v.name.includes('US English')) || v.name.includes('Online (Natural)')
        )
        if (!selectedVoice) selectedVoice = englishVoices.find(v =>
            v.name.includes('Zira') || v.name.includes('Hazel') || v.name.includes('Susan') ||
            v.name.toLowerCase().includes('female') || (v.name.includes('Google') && v.lang === 'en-GB') ||
            v.name.includes('Samantha') || v.name.includes('Daniel')
        )
        if (!selectedVoice) selectedVoice = englishVoices.find(v => v.lang === 'en-GB' || v.lang === 'en-AU')
        if (!selectedVoice && englishVoices.length > 0) selectedVoice = englishVoices[0]
        if (selectedVoice) utterance.voice = selectedVoice
        utterance.lang = 'en-US'
        utterance.rate = 0.90
        utterance.pitch = 0.95 + (Math.random() * 0.1) - 0.05
        utterance.volume = 1.0
        window.speechSynthesis.speak(utterance)
    } catch (e) { console.error("Speech Error:", e) }
}

/**
 * PadelLiveMatchModal — Full live match tracker with correct Padel scoring and serving rules.
 * Padel scoring: 15/30/40/Deuce/Advantage per game, first to 6 games wins a set (tiebreak at 6-6).
 * Match format: Best of 3 sets or single set (user selectable).
 * Serving: Teams alternate per game; within a team, players alternate their serving games per set.
 */
const PadelLiveMatchModal = ({ isOpen, onClose, team1, team2, onMatchSaved, padelStats }) => {
    const { showToast } = useToast()

    // --- Match state ---
    const [matchFormat, setMatchFormat] = useState(3) // 1 (single set) or 3 (best of 3)
    const [matchStarted, setMatchStarted] = useState(false)
    const [matchWinner, setMatchWinner] = useState(null) // null | 1 | 2
    const [saving, setSaving] = useState(false)
    const [showWinAnimation, setShowWinAnimation] = useState(false)
    const [eloChange, setEloChange] = useState(null)

    // --- Set tracking ---
    const [completedSets, setCompletedSets] = useState([]) // [{t1Games, t2Games}]

    // --- Current set state ---
    const [t1Games, setT1Games] = useState(0)
    const [t2Games, setT2Games] = useState(0)

    // --- Current game state ---
    const [t1Points, setT1Points] = useState(0) // Internal point count (0,1,2,3,4,5...)
    const [t2Points, setT2Points] = useState(0)
    const [isTiebreak, setIsTiebreak] = useState(false)

    // --- History for undo ---
    const [history, setHistory] = useState([]) // Array of snapshots

    // --- Sound ---
    const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('liveMatchSound') !== 'off')

    // --- Serving state ---
    // servingTeam: 1 or 2 (which team serves this game)
    // servingPlayerIndex: index within that team (0 or 1) indicating which player serves this game
    // These track per-set serving rotation
    const [servingTeam, setServingTeam] = useState(1)
    const [t1ServeIndex, setT1ServeIndex] = useState(0) // Which player on team 1 serves next (0 or 1)
    const [t2ServeIndex, setT2ServeIndex] = useState(0) // Which player on team 2 serves next (0 or 1)
    const [totalGamesInSet, setTotalGamesInSet] = useState(0) // Track games in current set for serve alternation

    // --- Tiebreak serve tracking ---
    const [tiebreakPointCount, setTiebreakPointCount] = useState(0)
    const [tiebreakServingTeam, setTiebreakServingTeam] = useState(1)

    // Reset everything when modal opens
    useEffect(() => {
        if (isOpen) {
            setT1Points(0)
            setT2Points(0)
            setT1Games(0)
            setT2Games(0)
            setCompletedSets([])
            setMatchFormat(3)
            setMatchStarted(false)
            setMatchWinner(null)
            setSaving(false)
            setShowWinAnimation(false)
            setEloChange(null)
            setHistory([])
            setIsTiebreak(false)
            setServingTeam(1)
            setT1ServeIndex(0)
            setT2ServeIndex(0)
            setTotalGamesInSet(0)
            setTiebreakPointCount(0)
            setTiebreakServingTeam(1)
        }
    }, [isOpen])

    useEffect(() => {
        localStorage.setItem('liveMatchSound', soundEnabled ? 'on' : 'off')
    }, [soundEnabled])

    // --- Helper: Get display score for a point count ---
    const getPointDisplay = useCallback((pts, opponentPts, tiebreak) => {
        if (tiebreak) return pts.toString()
        if (pts <= 3) return PADEL_POINTS[pts]
        // Deuce territory (both >= 3)
        if (pts === opponentPts) return '40' // Deuce displayed as 40-40
        if (pts > opponentPts) return 'AD'
        return '40'
    }, [])

    // --- Get descriptive score text for voice ---
    const getScoreAnnouncement = useCallback((p1, p2, tiebreak) => {
        if (tiebreak) return `${p1}... ${p2}`
        if (p1 >= 3 && p2 >= 3) {
            if (p1 === p2) return 'Deuce'
            if (p1 > p2) return 'Advantage Green'
            return 'Advantage Red'
        }
        return `${PADEL_POINTS[p1]}... ${PADEL_POINTS[p2]}`
    }, [])

    // --- Determine current server for display ---
    const currentServer = useMemo(() => {
        if (isTiebreak) {
            // In tiebreak: first point served by the player due; then every 2 points alternate
            return tiebreakServingTeam
        }
        return servingTeam
    }, [servingTeam, isTiebreak, tiebreakServingTeam])

    // Which player on the serving team is serving
    const currentServerPlayer = useMemo(() => {
        if (isTiebreak) {
            // In tiebreak the initial server is whoever was due to serve; their partner serves 2 points later etc.
            return tiebreakServingTeam === 1 ? t1ServeIndex : t2ServeIndex
        }
        return servingTeam === 1 ? t1ServeIndex : t2ServeIndex
    }, [servingTeam, t1ServeIndex, t2ServeIndex, isTiebreak, tiebreakServingTeam])

    // --- Win probability ---
    const winProb = useMemo(() => {
        if (!team1 || !team2 || !padelStats) return null
        const statsMap = {}
            ; (padelStats || []).forEach(s => { statsMap[s.user_id] = s })
        const t1Elo = ((statsMap[team1[0]?.id]?.elo_rating || 1200) + (statsMap[team1[1]?.id]?.elo_rating || 1200)) / 2
        const t2Elo = ((statsMap[team2[0]?.id]?.elo_rating || 1200) + (statsMap[team2[1]?.id]?.elo_rating || 1200)) / 2
        const t1Expected = calculateExpectedScore(t1Elo, t2Elo)
        return { p1: Math.round(t1Expected * 100), p2: Math.round((1 - t1Expected) * 100) }
    }, [team1, team2, padelStats])

    // How many sets needed to win
    const setsNeeded = Math.ceil(matchFormat / 2)
    const setsWon1 = completedSets.filter(s => s.t1Games > s.t2Games).length
    const setsWon2 = completedSets.filter(s => s.t2Games > s.t1Games).length

    // --- Advance serving after a game ---
    const advanceServe = useCallback(() => {
        // After each game, the OTHER team serves
        setServingTeam(prev => {
            const nextTeam = prev === 1 ? 2 : 1
            // Advance the serving player index for the team that just finished serving
            if (prev === 1) {
                setT1ServeIndex(i => (i + 1) % 2)
            } else {
                setT2ServeIndex(i => (i + 1) % 2)
            }
            return nextTeam
        })
        setTotalGamesInSet(prev => prev + 1)
    }, [])

    // --- Start a new set (reset game/point counters, keep serve order) ---
    const startNewSet = useCallback(() => {
        setT1Games(0)
        setT2Games(0)
        setT1Points(0)
        setT2Points(0)
        setIsTiebreak(false)
        setHistory([])
        setTotalGamesInSet(0)
        // At the start of a new set, the team that didn't serve first last set gets to serve
        // Players within a team can re-choose who serves first (we auto-advance)
    }, [])

    // --- Score a point ---
    const scorePoint = useCallback((teamNum) => {
        if (matchWinner) return

        if (!matchStarted) setMatchStarted(true)

        // Save snapshot for undo
        setHistory(prev => [...prev, {
            t1Points, t2Points, t1Games, t2Games,
            completedSets: [...completedSets],
            isTiebreak, servingTeam, t1ServeIndex, t2ServeIndex,
            totalGamesInSet, tiebreakPointCount, tiebreakServingTeam,
            matchWinner
        }])

        if (soundEnabled) playBlip()

        let newT1Pts = t1Points
        let newT2Pts = t2Points

        if (teamNum === 1) newT1Pts++
        else newT2Pts++

        // --- Check if game is won ---
        let gameWon = null // null or 1 or 2

        if (isTiebreak) {
            // Tiebreak: first to 7 with 2-point lead
            if (newT1Pts >= TIEBREAK_TARGET && newT1Pts - newT2Pts >= 2) gameWon = 1
            else if (newT2Pts >= TIEBREAK_TARGET && newT2Pts - newT1Pts >= 2) gameWon = 2

            // Update tiebreak serve rotation: first point by initial server, then every 2 points
            const newTbPts = newT1Pts + newT2Pts
            setTiebreakPointCount(newTbPts)
            if (newTbPts === 1) {
                // After first point, other team serves
                setTiebreakServingTeam(prev => prev === 1 ? 2 : 1)
            } else if (newTbPts > 1 && (newTbPts - 1) % 2 === 0) {
                // Switch every 2 points after the first
                setTiebreakServingTeam(prev => prev === 1 ? 2 : 1)
            }
        } else {
            // Standard game scoring
            if (newT1Pts >= 4 && newT1Pts - newT2Pts >= 2) gameWon = 1
            else if (newT2Pts >= 4 && newT2Pts - newT1Pts >= 2) gameWon = 2
        }

        if (gameWon) {
            // Game won — update game score
            let newT1Games = t1Games
            let newT2Games = t2Games

            if (gameWon === 1) newT1Games++
            else newT2Games++

            // Check if set is won
            let setWon = null

            if (isTiebreak) {
                // Tiebreak game always decides the set
                setWon = gameWon
            } else if (newT1Games >= GAMES_TO_WIN_SET && newT1Games - newT2Games >= 2) {
                setWon = 1
            } else if (newT2Games >= GAMES_TO_WIN_SET && newT2Games - newT1Games >= 2) {
                setWon = 2
            } else if (newT1Games === GAMES_TO_WIN_SET && newT2Games === GAMES_TO_WIN_SET) {
                // Trigger tiebreak
                setT1Games(newT1Games)
                setT2Games(newT2Games)
                setT1Points(0)
                setT2Points(0)
                setIsTiebreak(true)
                setTiebreakPointCount(0)
                setTiebreakServingTeam(servingTeam) // The player due to serve starts the tiebreak
                advanceServe()

                if (soundEnabled) {
                    setTimeout(() => speak('Tiebreak!'), 100)
                }
                return
            }

            if (setWon) {
                // Set complete
                const newCompletedSets = [...completedSets, { t1Games: newT1Games, t2Games: newT2Games }]
                setCompletedSets(newCompletedSets)

                const newSetsWon1 = newCompletedSets.filter(s => s.t1Games > s.t2Games).length
                const newSetsWon2 = newCompletedSets.filter(s => s.t2Games > s.t1Games).length

                if (newSetsWon1 >= setsNeeded || newSetsWon2 >= setsNeeded) {
                    // Match over!
                    const mw = newSetsWon1 >= setsNeeded ? 1 : 2
                    setMatchWinner(mw)
                    setShowWinAnimation(true)
                    setT1Games(newT1Games)
                    setT2Games(newT2Games)
                    setT1Points(newT1Pts)
                    setT2Points(newT2Pts)
                    if (soundEnabled) {
                        playWinSound()
                        const winnerName = mw === 1 ? 'Green' : 'Red'
                        setTimeout(() => speak(`Game, set, and match... ${winnerName} wins!`), 300)
                    }
                    return
                }

                // Set won but match continues — announce and start new set after delay
                if (soundEnabled) {
                    const setWinnerName = setWon === 1 ? 'Green' : 'Red'
                    setTimeout(() => speak(`Set to ${setWinnerName}... ${newSetsWon1} - ${newSetsWon2}.`), 200)
                }

                setT1Games(newT1Games)
                setT2Games(newT2Games)
                setT1Points(newT1Pts)
                setT2Points(newT2Pts)

                setTimeout(() => {
                    startNewSet()
                    // Serve alternation: the team that received in the last game of the set serves first
                    setServingTeam(servingTeam === 1 ? 2 : 1)
                }, 1800)
                return
            }

            // Game won but set continues
            setT1Games(newT1Games)
            setT2Games(newT2Games)
            setT1Points(0)
            setT2Points(0)
            setIsTiebreak(false)
            advanceServe()

            if (soundEnabled) {
                const gwName = gameWon === 1 ? 'Green' : 'Red'
                setTimeout(() => speak(`Game ${gwName}... ${newT1Games} - ${newT2Games}.`), 150)
            }
            return
        }

        // No game won — just update points
        setT1Points(newT1Pts)
        setT2Points(newT2Pts)

        // Voice announcement for point
        if (soundEnabled) {
            const announcement = getScoreAnnouncement(newT1Pts, newT2Pts, isTiebreak)
            setTimeout(() => speak(announcement), 100)
        }
    }, [t1Points, t2Points, t1Games, t2Games, completedSets, isTiebreak,
        servingTeam, t1ServeIndex, t2ServeIndex, totalGamesInSet,
        tiebreakPointCount, tiebreakServingTeam, matchWinner, matchStarted,
        soundEnabled, setsNeeded, advanceServe, startNewSet, getScoreAnnouncement])

    // --- Undo last point ---
    const undoLast = useCallback(() => {
        if (history.length === 0 || matchWinner) return
        const prev = history[history.length - 1]
        setT1Points(prev.t1Points)
        setT2Points(prev.t2Points)
        setT1Games(prev.t1Games)
        setT2Games(prev.t2Games)
        setCompletedSets(prev.completedSets)
        setIsTiebreak(prev.isTiebreak)
        setServingTeam(prev.servingTeam)
        setT1ServeIndex(prev.t1ServeIndex)
        setT2ServeIndex(prev.t2ServeIndex)
        setTotalGamesInSet(prev.totalGamesInSet)
        setTiebreakPointCount(prev.tiebreakPointCount)
        setTiebreakServingTeam(prev.tiebreakServingTeam)
        setMatchWinner(prev.matchWinner)
        setHistory(h => h.slice(0, -1))
    }, [history, matchWinner])

    // --- Save match ---
    const handleSave = async () => {
        if (!matchWinner) return
        setSaving(true)
        try {
            // Build sets_data from completed sets
            const setsData = completedSets.map(s => ({
                team1Games: s.t1Games,
                team2Games: s.t2Games
            }))

            // Calculate total games for the overall match score
            const totalT1Games = completedSets.reduce((sum, s) => sum + s.t1Games, 0)
            const totalT2Games = completedSets.reduce((sum, s) => sum + s.t2Games, 0)

            const { error: matchError } = await supabase
                .from('padel_matches')
                .insert([{
                    team1_player1_id: team1[0].id,
                    team1_player2_id: team1[1].id,
                    team2_player1_id: team2[0].id,
                    team2_player2_id: team2[1].id,
                    score1: totalT1Games,
                    score2: totalT2Games,
                    sets_data: setsData,
                }])

            if (matchError) throw matchError

            await recalculatePadelStats()

            // Calculate ELO change for display animation
            const statsMap = {}
                ; (padelStats || []).forEach(s => { statsMap[s.user_id] = s })
            const t1Elo = ((statsMap[team1[0]?.id]?.elo_rating || 1200) + (statsMap[team1[1]?.id]?.elo_rating || 1200)) / 2
            const t2Elo = ((statsMap[team2[0]?.id]?.elo_rating || 1200) + (statsMap[team2[1]?.id]?.elo_rating || 1200)) / 2
            const avgMp = ((statsMap[team1[0]?.id]?.matches_played || 0) + (statsMap[team1[1]?.id]?.matches_played || 0) +
                (statsMap[team2[0]?.id]?.matches_played || 0) + (statsMap[team2[1]?.id]?.matches_played || 0)) / 4
            const k = getKFactor(avgMp)
            const c1 = calculateEloChange(t1Elo, t2Elo, totalT1Games, totalT2Games, k)
            const c2 = calculateEloChange(t2Elo, t1Elo, totalT2Games, totalT1Games, k)
            setEloChange({ t1: Math.round(c1), t2: Math.round(c2) })
            setTimeout(() => setEloChange(null), 3000)

            showToast('Padel match saved!', 'success')
            if (onMatchSaved) onMatchSaved()
        } catch (error) {
            console.error(error)
            showToast('Error saving match: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    // --- Rematch ---
    const handleRematch = () => {
        setT1Points(0)
        setT2Points(0)
        setT1Games(0)
        setT2Games(0)
        setCompletedSets([])
        setMatchStarted(false)
        setMatchWinner(null)
        setShowWinAnimation(false)
        setEloChange(null)
        setHistory([])
        setIsTiebreak(false)
        setServingTeam(1)
        setT1ServeIndex(0)
        setT2ServeIndex(0)
        setTotalGamesInSet(0)
        setTiebreakPointCount(0)
        setTiebreakServingTeam(1)
    }

    // --- Keyboard shortcuts ---
    useEffect(() => {
        if (!isOpen) return
        const onKey = (e) => {
            if (matchWinner) return
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
            if (e.key === 'ArrowLeft' || e.key === '1') scorePoint(1)
            else if (e.key === 'ArrowRight' || e.key === '2') scorePoint(2)
            else if (e.key === 'Backspace' || e.key === 'z') undoLast()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen, matchWinner, scorePoint, undoLast])

    if (!isOpen || !team1 || !team2 || team1.length < 2 || team2.length < 2) return null

    // --- Display values ---
    const t1PointDisplay = getPointDisplay(t1Points, t2Points, isTiebreak)
    const t2PointDisplay = getPointDisplay(t2Points, t1Points, isTiebreak)
    const isDeuce = !isTiebreak && t1Points >= 3 && t2Points >= 3 && t1Points === t2Points
    const isAdvantage = !isTiebreak && t1Points >= 3 && t2Points >= 3 && t1Points !== t2Points

    // Serving player info
    const servingPlayerObj = useMemo(() => {
        if (currentServer === 1) return team1[currentServerPlayer]
        return team2[currentServerPlayer]
    }, [currentServer, currentServerPlayer, team1, team2])

    // Match point detection
    const isSetPoint1 = !matchWinner && t1Games >= 5 && t1Games > t2Games && t1Points >= 3 && t1Points > t2Points && !isTiebreak
    const isSetPoint2 = !matchWinner && t2Games >= 5 && t2Games > t1Games && t2Points >= 3 && t2Points > t1Points && !isTiebreak
    const isMatchPoint1 = isSetPoint1 && (setsWon1 === setsNeeded - 1)
    const isMatchPoint2 = isSetPoint2 && (setsWon2 === setsNeeded - 1)

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
                        {matchWinner ? '🏆 Match Complete' : isTiebreak ? '⚡ Tiebreak!' : isDeuce ? '🔥 Deuce!' : isAdvantage ? '💪 Advantage' : 'Padel Live Match'}
                    </h2>

                    {/* Format selector (before match starts) */}
                    {!matchStarted && !matchWinner && (
                        <div className="mt-2 flex items-center justify-center gap-2">
                            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Format:</span>
                            {[1, 3].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setMatchFormat(n)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${matchFormat === n
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {n === 1 ? '1 Set' : `Best of ${n}`}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Win probability bar */}
                    {winProb && !matchWinner && (
                        <div className="mt-2 mx-auto max-w-xs">
                            <div className="flex justify-between text-[10px] font-bold mb-0.5">
                                <span className="text-emerald-500">{winProb.p1}%</span>
                                <span className="text-gray-400 dark:text-gray-500">Win Prob</span>
                                <span className="text-red-500">{winProb.p2}%</span>
                            </div>
                            <div className="flex h-1 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                                <div className="bg-emerald-500" style={{ width: `${winProb.p1}%` }} />
                                <div className="bg-red-500" style={{ width: `${winProb.p2}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Set scores (completed sets) */}
                    {completedSets.length > 0 && (
                        <div className="mt-2 flex items-center justify-center gap-3">
                            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{setsWon1}</span>
                            <div className="flex gap-1">
                                {completedSets.map((s, i) => (
                                    <span key={i} className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400">
                                        {s.t1Games}-{s.t2Games}
                                    </span>
                                ))}
                            </div>
                            <span className="text-lg font-black text-red-600 dark:text-red-400">{setsWon2}</span>
                        </div>
                    )}

                    {/* Current set game score */}
                    {matchStarted && !matchWinner && (
                        <div className="mt-1 text-xs text-gray-400 dark:text-gray-500 font-bold">
                            Games: <span className="text-emerald-500">{t1Games}</span> – <span className="text-red-500">{t2Games}</span>
                            {isTiebreak && <span className="ml-2 text-amber-500">Tiebreak</span>}
                        </div>
                    )}

                    {/* Serve indicator */}
                    {!matchWinner && matchStarted && servingPlayerObj && (
                        <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                            Serving: <span className="font-bold text-amber-500">{servingPlayerObj.name}</span>
                        </div>
                    )}

                    {/* Match/Set point indicator */}
                    {(isMatchPoint1 || isMatchPoint2) && (
                        <div className="mt-1 text-xs font-bold text-amber-500 dark:text-amber-400 animate-pulse uppercase tracking-wider">
                            Match Point — {isMatchPoint1 ? 'Team 1' : 'Team 2'}
                        </div>
                    )}
                    {(isSetPoint1 || isSetPoint2) && !isMatchPoint1 && !isMatchPoint2 && (
                        <div className="mt-1 text-xs font-bold text-cyan-500 dark:text-cyan-400 animate-pulse uppercase tracking-wider">
                            Set Point — {isSetPoint1 ? 'Team 1' : 'Team 2'}
                        </div>
                    )}
                </div>

                {/* Score Area */}
                <div className="flex-1 flex items-stretch px-4 pb-4 pt-2 gap-3 min-h-0">
                    {/* Team 1 Side */}
                    <button
                        onClick={() => scorePoint(1)}
                        disabled={!!matchWinner}
                        className={`
                            flex-1 rounded-2xl flex flex-col items-center justify-center p-4 transition-all duration-200 select-none relative overflow-hidden
                            ${matchWinner === 1
                                ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 ring-4 ring-emerald-400 shadow-xl shadow-emerald-500/30'
                                : matchWinner === 2
                                    ? 'bg-gray-100 dark:bg-gray-800 opacity-60'
                                    : 'bg-gradient-to-b from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-900/50 hover:from-emerald-100 hover:to-emerald-200 dark:hover:from-emerald-900/40 dark:hover:to-emerald-900/60 active:scale-[0.97] cursor-pointer border-2 border-emerald-200 dark:border-emerald-800'
                            }
                        `}
                    >
                        {/* ELO change animation */}
                        {eloChange && (
                            <div className={`absolute top-4 left-1/2 -translate-x-1/2 text-2xl font-black animate-bounce ${eloChange.t1 > 0 ? 'text-green-400' : 'text-red-400'}`}
                                style={{ animation: 'floatUp 2.5s ease-out forwards' }}>
                                {eloChange.t1 > 0 ? '+' : ''}{eloChange.t1}
                            </div>
                        )}

                        <div className="flex items-center gap-1 mb-2">
                            <img src={team1[0].avatar_url || getAvatarFallback(team1[0].name)} alt={team1[0].name}
                                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover shadow-lg ${matchWinner === 1 ? 'border-3 border-white' : 'border-2 border-emerald-300 dark:border-emerald-600'} ${currentServer === 1 && currentServerPlayer === 0 && !matchWinner ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                            />
                            <img src={team1[1].avatar_url || getAvatarFallback(team1[1].name)} alt={team1[1].name}
                                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover shadow-lg ${matchWinner === 1 ? 'border-3 border-white' : 'border-2 border-emerald-300 dark:border-emerald-600'} ${currentServer === 1 && currentServerPlayer === 1 && !matchWinner ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                            />
                            {currentServer === 1 && !matchWinner && (
                                <div className="bg-amber-400 dark:bg-amber-500 rounded-full p-1 shadow-md animate-bounce ml-1">
                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                </div>
                            )}
                        </div>
                        <div className={`font-bold text-xs truncate max-w-full ${matchWinner === 1 ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {team1[0].name} & {team1[1].name}
                        </div>
                        <div className={`text-5xl sm:text-7xl font-black tabular-nums mt-1 leading-none transition-all duration-200 ${matchWinner === 1 ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {t1PointDisplay}
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

                    {/* Team 2 Side */}
                    <button
                        onClick={() => scorePoint(2)}
                        disabled={!!matchWinner}
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
                            <div className={`absolute top-4 left-1/2 -translate-x-1/2 text-2xl font-black animate-bounce ${eloChange.t2 > 0 ? 'text-green-400' : 'text-red-400'}`}
                                style={{ animation: 'floatUp 2.5s ease-out forwards' }}>
                                {eloChange.t2 > 0 ? '+' : ''}{eloChange.t2}
                            </div>
                        )}

                        <div className="flex items-center gap-1 mb-2">
                            {currentServer === 2 && !matchWinner && (
                                <div className="bg-amber-400 dark:bg-amber-500 rounded-full p-1 shadow-md animate-bounce mr-1">
                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                </div>
                            )}
                            <img src={team2[0].avatar_url || getAvatarFallback(team2[0].name)} alt={team2[0].name}
                                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover shadow-lg ${matchWinner === 2 ? 'border-3 border-white' : 'border-2 border-red-300 dark:border-red-600'} ${currentServer === 2 && currentServerPlayer === 0 && !matchWinner ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                            />
                            <img src={team2[1].avatar_url || getAvatarFallback(team2[1].name)} alt={team2[1].name}
                                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover shadow-lg ${matchWinner === 2 ? 'border-3 border-white' : 'border-2 border-red-300 dark:border-red-600'} ${currentServer === 2 && currentServerPlayer === 1 && !matchWinner ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                            />
                        </div>
                        <div className={`font-bold text-xs truncate max-w-full ${matchWinner === 2 ? 'text-white' : 'text-red-600 dark:text-red-400'}`}>
                            {team2[0].name} & {team2[1].name}
                        </div>
                        <div className={`text-5xl sm:text-7xl font-black tabular-nums mt-1 leading-none transition-all duration-200 ${matchWinner === 2 ? 'text-white' : 'text-red-600 dark:text-red-400'}`}>
                            {t2PointDisplay}
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
                                disabled={history.length === 0}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                            >
                                <Undo2 size={16} />
                                Undo
                            </button>
                            <div className="flex items-center gap-2">
                                <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                                    Tap or use ← → keys to score
                                </div>
                                <button
                                    onClick={() => setSoundEnabled(!soundEnabled)}
                                    aria-label={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
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
                                    className="px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors flex items-center gap-1 font-bold border border-emerald-200 dark:border-emerald-800"
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

export default PadelLiveMatchModal
