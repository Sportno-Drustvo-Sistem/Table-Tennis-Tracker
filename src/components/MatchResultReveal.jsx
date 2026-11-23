import React, { useEffect } from 'react'
import { Crown } from 'lucide-react'
import { BAD_BEAT_STAKE } from '../betShowtime'
import { bustSound, chipSound, fanfareSound, slamSound } from '../betSounds'
import { BetAvatar, MiniChip } from './MatchBets'

const SHOW_FOR_MS = 7000
const SLAM_AT_MS = 550
const STAMP_AT_MS = 950
const ROWS_AT_MS = 1400
const ROW_GAP_MS = 160
const MAX_ROWS = 6
const points = value => value.toLocaleString()

// "Bor beat Maks": shown when a match more than one person bet on settles while
// someone watches the Bets tab. The players slam together, the loser drops,
// the result is stamped on and every bettor's result rolls in underneath.
const MatchResultReveal = ({ result, getUser, onDone }) => {
    const winnerId = result.winnerSide === 2 ? result.player2Id : result.player1Id
    const loserId = result.winnerSide === 2 ? result.player1Id : result.player2Id
    const winner = getUser(winnerId)
    const loser = getUser(loserId)
    const rows = result.bets.slice(0, MAX_ROWS)
    const extra = result.bets.length - rows.length
    const pool = result.bets.reduce((sum, bet) => sum + bet.stake, 0)

    // Sound cues follow the animation; the reveal plays once per result.
    useEffect(() => {
        const shown = result.bets.slice(0, MAX_ROWS)
        const timers = [
            setTimeout(slamSound, SLAM_AT_MS),
            setTimeout(fanfareSound, STAMP_AT_MS),
            ...shown.flatMap((bet, i) => (bet.status === 'won' ? [setTimeout(chipSound, ROWS_AT_MS + i * ROW_GAP_MS)] : [])),
            setTimeout(onDone, SHOW_FOR_MS),
        ]
        if (shown.some(bet => bet.status === 'lost' && bet.stake >= BAD_BEAT_STAKE)) {
            timers.push(setTimeout(bustSound, ROWS_AT_MS + shown.length * ROW_GAP_MS))
        }
        const onKey = event => { if (event.key === 'Escape') onDone() }
        window.addEventListener('keydown', onKey)
        return () => { timers.forEach(clearTimeout); window.removeEventListener('keydown', onKey) }
    }, [result, onDone])

    const side = (user, from, won) => (
        <div className={`flex flex-col items-center min-w-0 flex-1 ${from === 'left' ? 'motion-safe:animate-slam-left' : 'motion-safe:animate-slam-right'}`}>
            <div className={won ? 'motion-safe:animate-winner-rise' : 'motion-safe:animate-ko'} style={{ animationDelay: `${STAMP_AT_MS - 150}ms` }}>
                <div className="relative">
                    {won && <Crown aria-hidden="true" className="absolute -top-7 left-1/2 -translate-x-1/2 w-8 h-8 text-amber-400 fill-amber-400 motion-safe:animate-crown-drop" style={{ animationDelay: `${STAMP_AT_MS}ms` }} />}
                    <BetAvatar user={user} className={`w-20 h-20 sm:w-24 sm:h-24 ring-4 ${won ? 'ring-amber-400 shadow-[0_0_36px_rgb(251_191_36/0.7)]' : 'ring-gray-500'}`} />
                </div>
            </div>
            <div className="mt-2 w-full truncate text-lg font-black text-white">{user?.name || 'Someone'}</div>
        </div>
    )

    return (
        <div role="status" aria-live="assertive" onClick={onDone}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-gray-950/85 backdrop-blur-sm animate-fade-in cursor-pointer overflow-hidden">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-white opacity-0 motion-safe:animate-flash" style={{ animationDelay: `${SLAM_AT_MS}ms` }} />
            <div className="relative w-full max-w-sm text-center motion-safe:animate-shake-once" style={{ animationDelay: `${SLAM_AT_MS}ms` }}>
                <div className="text-xs font-black uppercase tracking-[0.25em] text-white/60">Match result</div>

                <div className="mt-8 flex items-start justify-center gap-3">
                    {side(getUser(result.player1Id), 'left', result.winnerSide === 1)}
                    <span className="mt-7 shrink-0 text-2xl font-black italic text-amber-400 motion-safe:animate-pop-in" style={{ animationDelay: `${SLAM_AT_MS}ms` }}>VS</span>
                    {side(getUser(result.player2Id), 'right', result.winnerSide === 2)}
                </div>

                <h2 className="mt-5 motion-safe:animate-stamp" style={{ animationDelay: `${STAMP_AT_MS}ms` }}>
                    {result.upset && (
                        <span className="inline-block mb-2 px-3 py-0.5 -rotate-3 rounded border-2 border-red-500 text-red-400 text-sm font-black uppercase tracking-[0.3em]">Upset!</span>
                    )}
                    <span className="block text-4xl sm:text-5xl font-black uppercase leading-none tracking-tight text-white drop-shadow-[0_4px_0_rgb(0_0_0/0.5)]">
                        <span className="text-amber-400">{winner?.name || 'Someone'}</span>
                        <span className="block text-2xl sm:text-3xl text-white/80">beat</span>
                        <span className="text-gray-300">{loser?.name || 'Someone'}</span>
                    </span>
                </h2>

                <ul className="mt-6 space-y-1.5">
                    {rows.map((bet, i) => {
                        const won = bet.status === 'won'
                        return (
                            <li key={bet.id} className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl motion-safe:animate-rise-in ${won ? 'bg-emerald-500/15 ring-1 ring-emerald-400/40' : 'bg-white/5'}`}
                                style={{ animationDelay: `${ROWS_AT_MS + i * ROW_GAP_MS}ms` }}>
                                <BetAvatar user={getUser(bet.user_id)} className={`w-8 h-8 ${won ? '' : 'grayscale opacity-70'}`} />
                                <span className={`min-w-0 flex-1 truncate text-left font-bold ${won ? 'text-white' : 'text-white/60'}`}>{getUser(bet.user_id)?.name || 'Someone'}</span>
                                {won ? (
                                    <span className="flex items-center gap-1 font-black tabular-nums text-emerald-300">
                                        <MiniChip amount={bet.payout} className="w-4 h-4" />+{points(bet.payout - bet.stake)}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-red-400 border border-red-400/70 rounded px-1 -rotate-6">Busted</span>
                                        <span className="font-black tabular-nums text-red-400 line-through decoration-2">−{points(bet.stake)}</span>
                                    </span>
                                )}
                            </li>
                        )
                    })}
                </ul>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-white/50 tabular-nums motion-safe:animate-rise-in" style={{ animationDelay: `${ROWS_AT_MS + rows.length * ROW_GAP_MS}ms` }}>
                    {extra > 0 && `+${extra} more · `}{points(pool)} points in the pot · tap to close
                </p>
            </div>
        </div>
    )
}

export default MatchResultReveal
