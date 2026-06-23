import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RotateCcw, Save, Undo2, Volume2, VolumeX, X } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { validateTennisSets } from '../../tennisUtils'
import { getAvatarFallback } from '../../utils'
import { recordTennisMatch } from '../../matchPersistence'
import { useToast } from '../../contexts/useToast'

const TENNIS_POINTS = ['0', '15', '30', '40']

const TennisLiveMatchModal = ({ isOpen, onClose, player1, player2, onMatchSaved }) => {
    const { showToast } = useToast()
    const [matchFormat, setMatchFormat] = useState('best_of_3')
    const [matchStarted, setMatchStarted] = useState(false)
    const [matchWinner, setMatchWinner] = useState(null)
    const [saving, setSaving] = useState(false)
    const [eloChange, setEloChange] = useState(null)
    const [completedSets, setCompletedSets] = useState([])
    const [p1Games, setP1Games] = useState(0)
    const [p2Games, setP2Games] = useState(0)
    const [p1Points, setP1Points] = useState(0)
    const [p2Points, setP2Points] = useState(0)
    const [isTiebreak, setIsTiebreak] = useState(false)
    const [server, setServer] = useState(1)
    const [history, setHistory] = useState([])
    const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('liveMatchSound') !== 'off')

    useEffect(() => {
        if (isOpen) resetMatch()
    }, [isOpen])

    useEffect(() => {
        localStorage.setItem('liveMatchSound', soundEnabled ? 'on' : 'off')
    }, [soundEnabled])

    const resetMatch = () => {
        setMatchFormat('best_of_3')
        setMatchStarted(false)
        setMatchWinner(null)
        setSaving(false)
        setEloChange(null)
        setCompletedSets([])
        setP1Games(0)
        setP2Games(0)
        setP1Points(0)
        setP2Points(0)
        setIsTiebreak(false)
        setServer(1)
        setHistory([])
    }

    const scoreDisplay = useCallback((points, opponentPoints) => {
        if (isTiebreak) return String(points)
        if (points <= 3) return TENNIS_POINTS[points]
        if (points === opponentPoints) return '40'
        return points > opponentPoints ? 'AD' : '40'
    }, [isTiebreak])

    const checkPointWinner = useCallback((a, b) => {
        if (isTiebreak) {
            if (a >= 7 && a - b >= 2) return 1
            if (b >= 7 && b - a >= 2) return 2
            return null
        }
        if (a >= 4 && a - b >= 2) return 1
        if (b >= 4 && b - a >= 2) return 2
        return null
    }, [isTiebreak])

    const completeSetIfNeeded = useCallback((nextP1Games, nextP2Games, nextCompletedSets, finalP1Points, finalP2Points) => {
        let setWinner = null
        if (nextP1Games >= 6 && nextP1Games - nextP2Games >= 2) setWinner = 1
        if (nextP2Games >= 6 && nextP2Games - nextP1Games >= 2) setWinner = 2
        if (nextP1Games === 7 && nextP2Games === 6) setWinner = 1
        if (nextP2Games === 7 && nextP1Games === 6) setWinner = 2

        if (!setWinner) {
            if (nextP1Games === 6 && nextP2Games === 6) setIsTiebreak(true)
            return
        }

        const completedSet = {
            player1Games: nextP1Games,
            player2Games: nextP2Games,
            player1Tiebreak: nextP1Games === 7 && nextP2Games === 6 ? finalP1Points : nextP2Games === 7 && nextP1Games === 6 ? finalP1Points : null,
            player2Tiebreak: nextP1Games === 7 && nextP2Games === 6 ? finalP2Points : nextP2Games === 7 && nextP1Games === 6 ? finalP2Points : null,
        }
        const updatedSets = [...nextCompletedSets, completedSet]
        setCompletedSets(updatedSets)
        setP1Games(0)
        setP2Games(0)
        setP1Points(0)
        setP2Points(0)
        setIsTiebreak(false)

        const p1Sets = updatedSets.filter(set => set.player1Games > set.player2Games).length
        const p2Sets = updatedSets.filter(set => set.player2Games > set.player1Games).length
        const setsToWin = matchFormat === 'best_of_1' ? 1 : 2
        if (p1Sets >= setsToWin) setMatchWinner(1)
        if (p2Sets >= setsToWin) setMatchWinner(2)
    }, [matchFormat])

    const scorePoint = useCallback((playerNumber) => {
        if (matchWinner) return
        setMatchStarted(true)
        setHistory(prev => [...prev, { p1Games, p2Games, p1Points, p2Points, isTiebreak, server, completedSets, matchWinner }])

        const nextP1Points = p1Points + (playerNumber === 1 ? 1 : 0)
        const nextP2Points = p2Points + (playerNumber === 2 ? 1 : 0)
        const pointWinner = checkPointWinner(nextP1Points, nextP2Points)

        if (!pointWinner) {
            setP1Points(nextP1Points)
            setP2Points(nextP2Points)
            return
        }

        const nextP1Games = p1Games + (pointWinner === 1 ? 1 : 0)
        const nextP2Games = p2Games + (pointWinner === 2 ? 1 : 0)
        setP1Points(0)
        setP2Points(0)
        setP1Games(nextP1Games)
        setP2Games(nextP2Games)
        setServer(prev => prev === 1 ? 2 : 1)
        completeSetIfNeeded(nextP1Games, nextP2Games, completedSets, nextP1Points, nextP2Points)
    }, [checkPointWinner, completeSetIfNeeded, completedSets, isTiebreak, matchWinner, p1Games, p1Points, p2Games, p2Points, server])

    const undoLast = useCallback(() => {
        if (!history.length || matchWinner) return
        const prev = history[history.length - 1]
        setP1Games(prev.p1Games)
        setP2Games(prev.p2Games)
        setP1Points(prev.p1Points)
        setP2Points(prev.p2Points)
        setIsTiebreak(prev.isTiebreak)
        setServer(prev.server)
        setCompletedSets(prev.completedSets)
        setMatchWinner(prev.matchWinner)
        setHistory(h => h.slice(0, -1))
    }, [history, matchWinner])

    const handleSave = async () => {
        if (!matchWinner) return
        setSaving(true)
        try {
            const validation = validateTennisSets(completedSets, matchFormat)
            if (!validation.valid) {
                showToast(validation.message, 'error')
                return
            }

            const { changes } = await recordTennisMatch(supabase, {
                player1Id: player1.id,
                player2Id: player2.id,
                score1: validation.summary.player1Games,
                score2: validation.summary.player2Games,
                matchFormat,
                setsData: validation.sets,
            })
            setEloChange({ p1: Math.round(changes[player1.id] || 0), p2: Math.round(changes[player2.id] || 0) })
            setTimeout(() => setEloChange(null), 3000)
            showToast('Tennis match saved!', 'success')
            onMatchSaved?.()
        } catch (error) {
            console.error(error)
            showToast('Error saving tennis match: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    useEffect(() => {
        if (!isOpen) return
        const onKey = (event) => {
            if (matchWinner) return
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return
            if (event.key === '1') scorePoint(1)
            if (event.key === '2') scorePoint(2)
            if (event.key.toLowerCase() === 'z') undoLast()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen, matchWinner, scorePoint, undoLast])

    const p1Score = useMemo(() => scoreDisplay(p1Points, p2Points), [p1Points, p2Points, scoreDisplay])
    const p2Score = useMemo(() => scoreDisplay(p2Points, p1Points), [p1Points, p2Points, scoreDisplay])

    if (!isOpen || !player1 || !player2) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
                <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white">{matchWinner ? 'Match Complete' : isTiebreak ? 'Tiebreak' : 'Tennis Live Match'}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Server: {server === 1 ? player1.name : player2.name}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                        </button>
                        <button onClick={onClose} className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {!matchStarted && (
                    <div className="px-5 pt-4">
                        <div className="inline-flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                            <button onClick={() => setMatchFormat('best_of_1')} className={`px-3 py-1.5 rounded-md text-sm font-bold ${matchFormat === 'best_of_1' ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-sm' : 'text-gray-500'}`}>Single Set</button>
                            <button onClick={() => setMatchFormat('best_of_3')} className={`px-3 py-1.5 rounded-md text-sm font-bold ${matchFormat === 'best_of_3' ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-sm' : 'text-gray-500'}`}>Best of 3</button>
                        </div>
                    </div>
                )}

                <div className="p-5 space-y-5 overflow-y-auto">
                    <div className="flex justify-center gap-2 text-xs font-mono text-gray-500 dark:text-gray-400">
                        {completedSets.map((set, idx) => <span key={idx} className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">{set.player1Games}-{set.player2Games}</span>)}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <ScorePanel player={player1} active={server === 1} won={matchWinner === 1} games={p1Games} points={p1Score} eloChange={eloChange?.p1} onScore={() => scorePoint(1)} color="emerald" />
                        <ScorePanel player={player2} active={server === 2} won={matchWinner === 2} games={p2Games} points={p2Score} eloChange={eloChange?.p2} onScore={() => scorePoint(2)} color="red" />
                    </div>
                </div>

                <div className="p-5 border-t border-gray-200 dark:border-gray-800 flex justify-between gap-3">
                    <div className="flex gap-2">
                        <button onClick={undoLast} disabled={!history.length || !!matchWinner} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold disabled:opacity-40 flex items-center gap-2">
                            <Undo2 size={16} /> Undo
                        </button>
                        <button onClick={resetMatch} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold flex items-center gap-2">
                            <RotateCcw size={16} /> Reset
                        </button>
                    </div>
                    <button onClick={handleSave} disabled={!matchWinner || saving} className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-40 flex items-center gap-2">
                        <Save size={16} /> {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}

const ScorePanel = ({ player, active, won, games, points, eloChange, onScore, color }) => (
    <button
        onClick={onScore}
        disabled={won}
        className={`relative rounded-2xl p-5 min-h-[260px] flex flex-col items-center justify-center transition-all select-none ${won ? 'bg-emerald-600 text-white' : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'} ${active ? 'ring-2 ring-emerald-400' : ''}`}
    >
        {eloChange !== undefined && (
            <div className={`absolute top-4 right-4 text-xl font-black ${eloChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {eloChange >= 0 ? '+' : ''}{eloChange}
            </div>
        )}
        <img src={player.avatar_url || getAvatarFallback(player.name)} alt={player.name} className="w-20 h-20 rounded-full object-cover bg-gray-200 mb-3" />
        <div className="font-black text-gray-900 dark:text-white">{player.name}</div>
        <div className={`text-6xl font-black mt-4 ${won ? 'text-white' : color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{points}</div>
        <div className="text-sm font-bold text-gray-500 dark:text-gray-400 mt-2">Games: {games}</div>
    </button>
)

export default TennisLiveMatchModal
