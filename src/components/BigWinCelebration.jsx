import React, { useEffect, useState } from 'react'
import { Drumstick } from 'lucide-react'
import { BIG_WIN_MULTIPLIER } from '../bettingUtils'
import { BetAvatar, MiniChip } from './MatchBets'

const SHOW_FOR_MS = 6500
const JACKPOT = 1000
const RAIN_CHIPS = [10, 50, 100, 300, 500, 1000]
const RAIN_COUNT = 32
const points = value => value.toLocaleString()

// Rolls from 0 up to `value` once, slower than CountUp so the number lands with the card.
const RollUp = ({ value, duration = 1400 }) => {
    const [shown, setShown] = useState(0)
    useEffect(() => {
        const began = performance.now()
        let frame = requestAnimationFrame(function tick(now) {
            const progress = Math.min(1, (now - began) / duration)
            setShown(Math.round(value * (1 - (1 - progress) ** 4)))
            if (progress < 1) frame = requestAnimationFrame(tick)
        })
        return () => cancelAnimationFrame(frame)
    }, [value, duration])
    return points(shown)
}

// Chips pouring down the whole screen. Positions are spread deterministically
// so every phone sees the same shower.
const ChipRain = () => (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
        {Array.from({ length: RAIN_COUNT }, (_, i) => (
            <span key={i} className="absolute top-0 animate-chip-rain"
                style={{
                    left: `${(i * 37) % 100}%`,
                    '--rot': `${((i * 97) % 720) - 360}deg`,
                    '--drift': `${((i * 53) % 80) - 40}px`,
                    animationDelay: `${(i % 8) * 140 + Math.floor(i / 8) * 60}ms`,
                    animationDuration: `${1700 + ((i * 131) % 1100)}ms`,
                }}>
                <MiniChip amount={RAIN_CHIPS[i % RAIN_CHIPS.length]} className={i % 3 === 0 ? 'w-9 h-9' : 'w-6 h-6'} />
            </span>
        ))}
    </div>
)

// Full-screen "winner winner chicken dinner" for big wins that settle while
// someone is watching the Bets tab. `wins` is biggest first; tap to dismiss.
const BigWinCelebration = ({ wins, getUser, sideName, onDone }) => {
    useEffect(() => {
        const timer = setTimeout(onDone, SHOW_FOR_MS)
        const onKey = event => { if (event.key === 'Escape') onDone() }
        window.addEventListener('keydown', onKey)
        return () => { clearTimeout(timer); window.removeEventListener('keydown', onKey) }
    }, [onDone])

    const [top, ...rest] = wins
    const user = getUser(top.user_id)
    const profit = top.payout - top.stake
    const multiplier = Number(top.multiplier)
    const tag = profit >= JACKPOT ? 'Jackpot' : multiplier >= BIG_WIN_MULTIPLIER ? 'Long shot' : 'Big win'

    return (
        <div role="status" aria-live="assertive" onClick={onDone}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in cursor-pointer">
            {/* Sunburst behind the card */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                <div className="shrink-0 w-[160vmax] h-[160vmax] opacity-40 motion-safe:animate-spin-slow"
                    style={{ background: 'repeating-conic-gradient(rgb(251 191 36 / 0.55) 0deg 10deg, transparent 10deg 24deg)', maskImage: 'radial-gradient(circle, black 0%, transparent 55%)', WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 55%)' }} />
            </div>
            <ChipRain />

            <div className="relative w-full max-w-sm text-center motion-safe:animate-jackpot-in">
                <span className="inline-block mb-3 px-3 py-1 rounded-full text-xs font-black uppercase tracking-[0.2em] text-amber-950 bg-gradient-to-r from-amber-300 to-yellow-200 shadow-lg shadow-amber-500/40">
                    {tag}
                </span>
                <h2 className="font-black uppercase leading-[0.95] tracking-tight drop-shadow-[0_4px_0_rgb(120_53_15)]">
                    <span className="block text-3xl sm:text-4xl text-white">Winner winner</span>
                    <span className="flex items-center justify-center gap-2 text-4xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-orange-500">
                        <Drumstick aria-hidden="true" className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 text-amber-300 motion-safe:animate-wiggle" />
                        Chicken dinner!
                        <Drumstick aria-hidden="true" className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 text-amber-300 -scale-x-100 motion-safe:animate-wiggle" />
                    </span>
                </h2>

                <div className="mt-6 flex flex-col items-center">
                    <BetAvatar user={user} className="w-24 h-24 ring-4 ring-amber-400 shadow-[0_0_40px_rgb(251_191_36/0.7)]" />
                    <div className="mt-2 text-2xl font-black text-white truncate max-w-full">{user?.name || 'Someone'}</div>
                    <div className="mt-1 flex items-center gap-2 text-5xl font-black tabular-nums text-amber-300 drop-shadow-[0_2px_12px_rgb(251_191_36/0.6)]">
                        <MiniChip amount={profit} className="w-9 h-9" />
                        +<RollUp value={profit} />
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white/80 tabular-nums">
                        {points(top.stake)} on {sideName(top)} at {multiplier.toFixed(2)}× · paid {points(top.payout)}
                    </div>
                </div>

                {rest.length > 0 && (
                    <ul className="mt-5 flex flex-wrap justify-center gap-2">
                        {rest.slice(0, 4).map(bet => (
                            <li key={bet.id} className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-white/10 ring-1 ring-white/20 text-sm font-bold text-white tabular-nums">
                                <BetAvatar user={getUser(bet.user_id)} className="w-6 h-6" />
                                {getUser(bet.user_id)?.name || 'Someone'} <span className="text-amber-300">+{points(bet.payout - bet.stake)}</span>
                            </li>
                        ))}
                    </ul>
                )}
                <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-white/50">Tap to close</p>
            </div>
        </div>
    )
}

export default BigWinCelebration
