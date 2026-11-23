import React, { useEffect, useRef, useState } from 'react'
import { Drumstick } from 'lucide-react'
import { BIG_WIN_MULTIPLIER } from '../bettingUtils'
import { WIN_TIERS, rollingTier } from '../betShowtime'
import { tickSound, winSound } from '../betSounds'
import { BetAvatar, MiniChip } from './MatchBets'

const HOLD_AFTER_ROLL_MS = 3800
const RAIN_CHIPS = [10, 50, 100, 300, 500, 1000]
const points = value => value.toLocaleString()

// Per tier: how long the counter rolls, how many chips rain and how it looks.
const LOOK = [
    { roll: 1600, rain: 32, title: 'text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-orange-500', burst: 'rgb(251 191 36 / 0.55)', tag: 'from-amber-300 to-yellow-200 text-amber-950' },
    { roll: 2800, rain: 48, title: 'text-transparent bg-clip-text bg-gradient-to-b from-fuchsia-200 via-pink-400 to-violet-600', burst: 'rgb(232 121 249 / 0.5)', tag: 'from-fuchsia-300 to-pink-200 text-fuchsia-950' },
    { roll: 4000, rain: 64, title: 'text-transparent bg-clip-text bg-[length:200%_auto] bg-gradient-to-r from-red-400 via-yellow-300 via-50% to-red-400 motion-safe:animate-shimmer', burst: 'rgb(248 113 113 / 0.55)', tag: 'from-red-400 to-yellow-300 text-red-950' },
]

// Chips pouring down the whole screen. Positions are spread deterministically
// so every phone sees the same shower.
const ChipRain = ({ count }) => (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
        {Array.from({ length: count }, (_, i) => (
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

// Slot-style big win for bets that settle while someone watches the Bets tab.
// The counter rolls up and the title climbs Big → Mega → Epic as it passes each
// tier. First tap skips the roll, the next one closes. `wins` is biggest first.
const BigWinCelebration = ({ wins, tier: finalTier = 0, getUser, sideName, onDone }) => {
    const [top, ...rest] = wins
    const profit = top.payout - top.stake
    const multiplier = Number(top.multiplier)
    const duration = LOOK[finalTier].roll
    const [shown, setShown] = useState(0)
    const [skipped, setSkipped] = useState(false)
    const rolled = skipped || shown >= profit
    const tierNow = rolled ? finalTier : rollingTier(shown, finalTier)
    const look = LOOK[tierNow]

    useEffect(() => {
        if (skipped) return undefined
        const began = performance.now()
        let lastTick = 0
        let frame = requestAnimationFrame(function step(now) {
            const progress = Math.min(1, (now - began) / duration)
            setShown(Math.round(profit * (1 - (1 - progress) ** 3)))
            if (now - lastTick > 70 && progress < 1) { tickSound(); lastTick = now }
            if (progress < 1) frame = requestAnimationFrame(step)
        })
        return () => cancelAnimationFrame(frame)
    }, [profit, duration, skipped])

    // A fanfare each time the title climbs a tier.
    const heard = useRef(-1)
    useEffect(() => {
        if (tierNow > heard.current) { heard.current = tierNow; winSound(tierNow) }
    }, [tierNow])

    useEffect(() => {
        if (!rolled) return undefined
        const timer = setTimeout(onDone, HOLD_AFTER_ROLL_MS)
        return () => clearTimeout(timer)
    }, [rolled, onDone])
    useEffect(() => {
        const onKey = event => { if (event.key === 'Escape') onDone() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onDone])

    const user = getUser(top.user_id)
    const tap = () => (rolled ? onDone() : setSkipped(true))
    const isBig = tierNow === 0

    return (
        <div role="status" aria-live="assertive" onClick={tap}
            className={`fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in cursor-pointer overflow-hidden ${tierNow === 2 ? 'motion-safe:animate-shake' : ''}`}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                <div className="shrink-0 w-[160vmax] h-[160vmax] opacity-40 motion-safe:animate-spin-slow transition-[background] duration-500"
                    style={{ background: `repeating-conic-gradient(${look.burst} 0deg 10deg, transparent 10deg 24deg)`, maskImage: 'radial-gradient(circle, black 0%, transparent 55%)', WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 55%)' }} />
            </div>
            {/* White flash on every tier-up */}
            <div key={`flash-${tierNow}`} aria-hidden="true" className="pointer-events-none absolute inset-0 bg-white motion-safe:animate-flash opacity-0" />
            <ChipRain key={`rain-${tierNow}`} count={look.rain} />

            <div className="relative w-full max-w-sm text-center motion-safe:animate-jackpot-in">
                <div className="mb-3 flex justify-center gap-2">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-[0.2em] bg-gradient-to-r shadow-lg ${look.tag}`}>
                        {WIN_TIERS[tierNow].title}
                    </span>
                    {multiplier >= BIG_WIN_MULTIPLIER && (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-[0.2em] bg-sky-300 text-sky-950 shadow-lg">Long shot</span>
                    )}
                </div>
                <h2 key={tierNow} className="font-black uppercase leading-[0.95] tracking-tight drop-shadow-[0_4px_0_rgb(0_0_0/0.45)] motion-safe:animate-jackpot-in">
                    {isBig ? (
                        <>
                            <span className="block text-3xl sm:text-4xl text-white">Winner winner</span>
                            <span className={`flex items-center justify-center gap-2 text-4xl sm:text-5xl ${look.title}`}>
                                <Drumstick aria-hidden="true" className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 text-amber-300 motion-safe:animate-wiggle" />
                                Chicken dinner!
                                <Drumstick aria-hidden="true" className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 text-amber-300 -scale-x-100 motion-safe:animate-wiggle" />
                            </span>
                        </>
                    ) : (
                        <>
                            <span className={`block text-6xl sm:text-7xl ${look.title}`}>{WIN_TIERS[tierNow].title}</span>
                            <span className="mt-1 flex items-center justify-center gap-1.5 text-base sm:text-lg text-white/90 tracking-wide">
                                <Drumstick aria-hidden="true" className="w-5 h-5 text-amber-300 motion-safe:animate-wiggle" />
                                Winner winner chicken dinner
                                <Drumstick aria-hidden="true" className="w-5 h-5 text-amber-300 -scale-x-100 motion-safe:animate-wiggle" />
                            </span>
                        </>
                    )}
                </h2>

                <div className="mt-6 flex flex-col items-center">
                    <BetAvatar user={user} className="w-24 h-24 ring-4 ring-amber-400 shadow-[0_0_40px_rgb(251_191_36/0.7)]" />
                    <div className="mt-2 text-2xl font-black text-white truncate max-w-full">{user?.name || 'Someone'}</div>
                    <div className={`mt-1 flex items-center gap-2 text-5xl font-black tabular-nums text-amber-300 drop-shadow-[0_2px_12px_rgb(251_191_36/0.6)] ${rolled ? 'motion-safe:animate-pop' : ''}`}>
                        <MiniChip amount={profit} className="w-9 h-9" />
                        +{points(rolled ? profit : shown)}
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
                <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-white/50">{rolled ? 'Tap to close' : 'Tap to skip'}</p>
            </div>
        </div>
    )
}

export default BigWinCelebration
