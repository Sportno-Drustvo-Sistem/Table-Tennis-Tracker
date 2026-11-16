import React from 'react'
import { BetAvatar } from './MatchBets'

const SIDE = {
    1: { ring: 'ring-blue-500', text: 'text-blue-600 dark:text-blue-400', bar: 'bg-blue-500' },
    2: { ring: 'ring-red-500', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500' },
}

const liveStatus = (live, names) => {
    if (live.winner_side) return `${names[live.winner_side]} won · waiting for the result to be saved`
    if (!live.server && live.score1 === 0 && live.score2 === 0 && live.games1 === 0 && live.games2 === 0) return 'About to start'
    if (live.betting_closed) return 'Match point · betting closed'
    if (live.score1 >= 10 && live.score2 >= 10 && live.score1 === live.score2) return 'Deuce'
    return null
}

// The umpire phone's score as every other phone sees it.
const LiveScoreboard = ({ live, getUser }) => {
    const players = { 1: getUser(live.player1_id), 2: getUser(live.player2_id) }
    const names = { 1: players[1]?.name || 'Player 1', 2: players[2]?.name || 'Player 2' }
    const scores = { 1: live.score1, 2: live.score2 }
    const games = { 1: live.games1, 2: live.games2 }
    const sets = Array.isArray(live.sets) ? live.sets : []
    const p1 = live.win_probability == null ? null : Math.min(99, Math.max(1, Math.round(Number(live.win_probability) * 100)))
    const status = liveStatus(live, names)

    return (
        <div className="rounded-2xl bg-white/70 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-3" aria-live="polite"
            aria-label={`${names[1]} ${scores[1]}, ${names[2]} ${scores[2]}${live.best_of > 1 ? `, games ${games[1]}-${games[2]}` : ''}`}>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                {[1, 2].map(side => (
                    <div key={side} className={`min-w-0 flex items-center gap-2 row-start-1 ${side === 1 ? 'col-start-1 justify-end flex-row' : 'col-start-3 flex-row-reverse justify-end'}`}>
                        <div className={`min-w-0 ${side === 1 ? 'text-right' : 'text-left'}`}>
                            <div className="font-bold text-gray-900 dark:text-white truncate">{names[side]}</div>
                            {live.server === side && !live.winner_side && (
                                <div className={`text-[11px] font-bold uppercase tracking-wide ${SIDE[side].text}`}>Serving</div>
                            )}
                        </div>
                        <BetAvatar user={players[side]} className={`w-11 h-11 ring-2 ${SIDE[side].ring}`} />
                    </div>
                ))}
                <div className="col-start-2 row-start-1 flex flex-col items-center px-1">
                    <div className="flex items-baseline gap-2 text-4xl font-black tabular-nums leading-none">
                        <span className={SIDE[1].text}>{scores[1]}</span>
                        <span className="text-xl text-gray-300 dark:text-gray-600">:</span>
                        <span className={SIDE[2].text}>{scores[2]}</span>
                    </div>
                    {live.best_of > 1 && (
                        <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 tabular-nums">
                            Games {games[1]}–{games[2]} · best of {live.best_of}
                        </div>
                    )}
                </div>
            </div>

            {sets.length > 0 && live.best_of > 1 && (
                <div className="mt-2 flex justify-center gap-1.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {sets.map((set, index) => (
                        <span key={index} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                            <span className={set.s1 > set.s2 ? 'font-bold text-gray-900 dark:text-white' : ''}>{set.s1}</span>
                            -
                            <span className={set.s2 > set.s1 ? 'font-bold text-gray-900 dark:text-white' : ''}>{set.s2}</span>
                        </span>
                    ))}
                </div>
            )}

            {p1 !== null && !live.winner_side && (
                <div className="mt-3">
                    <div className="flex justify-between text-[10px] font-bold mb-0.5 tabular-nums">
                        <span className={SIDE[1].text}>{p1}%</span>
                        <span className="text-gray-400 dark:text-gray-500">Win prob</span>
                        <span className={SIDE[2].text}>{100 - p1}%</span>
                    </div>
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                        <div className={`${SIDE[1].bar} transition-[width] duration-500`} style={{ width: `${p1}%` }} />
                        <div className={`${SIDE[2].bar} transition-[width] duration-500`} style={{ width: `${100 - p1}%` }} />
                    </div>
                </div>
            )}

            {status && <p className="mt-2 text-center text-xs font-bold text-amber-600 dark:text-amber-400">{status}</p>}
        </div>
    )
}

export default LiveScoreboard
