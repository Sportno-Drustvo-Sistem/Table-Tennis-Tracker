import React, { useEffect } from 'react'
import { Coins, Crown, Flame, Skull, Snowflake } from 'lucide-react'
import { bustSound, chipSound, fanfareSound } from '../betSounds'
import { BetAvatar, MiniChip } from './MatchBets'

const points = value => value.toLocaleString()

// How each kind of banner looks, sounds and reads. `text` gets the banner and the player's name.
const KINDS = {
    bet: { Icon: Coins, tone: 'from-gray-900 to-gray-700 ring-amber-400/50', icon: 'text-amber-400', ms: 2600, sound: chipSound,
        text: (b, who, side) => [`${who} bet ${points(b.bet.stake)} on ${side}`, `pays ${Number(b.bet.multiplier).toFixed(2)}×`] },
    hot: { Icon: Flame, tone: 'from-orange-600 to-red-600 ring-orange-300/60', icon: 'text-yellow-200 motion-safe:animate-wiggle', ms: 3400, sound: fanfareSound,
        text: (b, who) => [`${who} is on fire!`, `${b.value} wins in a row`] },
    cold: { Icon: Snowflake, tone: 'from-cyan-700 to-sky-800 ring-cyan-300/50', icon: 'text-cyan-200 motion-safe:animate-spin-slow', ms: 3000, sound: null,
        text: (b, who) => [`${who} is ice cold`, `${b.value} losses in a row`] },
    leader: { Icon: Crown, tone: 'from-amber-500 to-yellow-500 ring-yellow-200/70', icon: 'text-white fill-white motion-safe:animate-float', ms: 3800, sound: fanfareSound,
        text: (b, who) => [`${who} takes the crown`, 'New #1 on the points board'] },
    ouch: { Icon: Skull, tone: 'from-red-700 to-rose-900 ring-red-300/50', icon: 'text-white', ms: 3200, sound: bustSound,
        text: (b, who) => [`Ouch! ${who} lost ${points(b.value)}`, 'That one stings'] },
    broke: { Icon: Skull, tone: 'from-gray-950 to-red-950 ring-red-500/60', icon: 'text-red-400 motion-safe:animate-wiggle', ms: 3800, sound: bustSound,
        text: (b, who) => [`${who} is broke!`, `Lost the last ${points(b.value)} points`] },
}

// One small banner at a time slides down from the top, like a casino's
// "just won" ticker. Tap it to move on.
const BetBanner = ({ banner, getUser, sideName, onDone }) => {
    const kind = KINDS[banner.type]
    useEffect(() => {
        kind.sound?.()
        const timer = setTimeout(onDone, kind.ms)
        return () => clearTimeout(timer)
    }, [banner.id, kind, onDone])

    const user = getUser(banner.userId)
    const [title, detail] = kind.text(banner, user?.name || 'Someone', banner.bet ? sideName(banner.bet) : '')
    const { Icon } = kind
    return (
        <div className="fixed inset-x-0 top-0 z-[65] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none">
            <button type="button" role="status" onClick={onDone}
                className={`pointer-events-auto bet-shine w-full max-w-sm flex items-center gap-3 pl-2 pr-4 py-2 rounded-2xl text-left text-white bg-gradient-to-r ring-2 shadow-xl shadow-black/30 motion-safe:animate-banner-in ${kind.tone}`}>
                <span className="relative shrink-0">
                    <BetAvatar user={user} className="w-11 h-11 ring-2 ring-white/70" />
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                        {banner.type === 'bet' ? <MiniChip amount={banner.bet.stake} className="w-4 h-4" /> : <Icon size={14} className={kind.icon} />}
                    </span>
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block font-black truncate">{title}</span>
                    <span className="block text-xs font-semibold text-white/75 truncate tabular-nums">{detail}</span>
                </span>
                <Icon size={22} aria-hidden="true" className={`shrink-0 ${kind.icon}`} />
            </button>
        </div>
    )
}

export default BetBanner
