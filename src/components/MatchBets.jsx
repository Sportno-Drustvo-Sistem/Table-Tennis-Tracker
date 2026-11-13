import React from 'react'
import { getAvatarFallback } from '../utils'
import { describeSnapshot, formatPoints, poolTotals, potentialPayout } from '../bettingUtils'

// Side 1 is blue and side 2 red wherever bets are shown.
const SIDE_TEXT = {
    1: 'text-blue-600 dark:text-blue-400',
    2: 'text-red-600 dark:text-red-400',
}
const SIDE_BAR = { 1: 'bg-blue-500', 2: 'bg-red-500' }

export const BetAvatar = ({ user, className = 'w-10 h-10' }) => (
    <img loading="lazy" decoding="async" src={user?.avatar_url || getAvatarFallback(user?.name)} alt="" className={`${className} rounded-full object-cover flex-shrink-0 bg-gray-200 dark:bg-gray-600`} />
)

// How the points on a match split between the two players.
export const BetPool = ({ bets, names }) => {
    const pool = poolTotals(bets)
    if (!pool.total) return null
    return (
        <div>
            <div className="flex justify-between gap-3 text-xs font-bold tabular-nums mb-1">
                <span className={`min-w-0 truncate ${SIDE_TEXT[1]}`}>{names[1]} · {pool[1].toLocaleString()}</span>
                <span className={`min-w-0 truncate ${SIDE_TEXT[2]}`}>{pool[2].toLocaleString()} · {names[2]}</span>
            </div>
            <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700" role="img"
                aria-label={`${pool[1]} points on ${names[1]}, ${pool[2]} on ${names[2]}`}>
                {[1, 2].map(side => pool[side] > 0 && (
                    <div key={side} className={SIDE_BAR[side]} style={{ width: `${(pool[side] / pool.total) * 100}%` }} />
                ))}
            </div>
        </div>
    )
}

const outcome = (bet) => {
    if (bet.status === 'won') return { text: formatPoints(bet.payout - bet.stake), className: 'text-green-600 dark:text-green-400', note: 'won' }
    if (bet.status === 'lost') return { text: formatPoints(-bet.stake), className: 'text-red-600 dark:text-red-400', note: 'lost' }
    if (bet.status === 'void') return { text: 'refunded', className: 'text-gray-400 dark:text-gray-500', note: '' }
    return { text: potentialPayout(bet.stake, Number(bet.multiplier)).toLocaleString(), className: 'text-gray-800 dark:text-gray-100', note: 'to win' }
}

// Who bet, how much, on whom and what it paid. `getUser` maps a user id to a
// player; `names` are the two players' names by side; `renderAction` adds a
// control at the end of each row.
export const BetList = ({ bets, getUser, names, renderAction }) => (
    <ul className="space-y-1.5">
        {bets.map(bet => {
            const bettor = getUser(bet.user_id)
            const result = outcome(bet)
            const at = describeSnapshot(bet.snapshot)
            return (
                <li key={bet.id} className="flex items-center gap-2.5 rounded-xl bg-gray-50 dark:bg-white/5 px-2.5 py-2">
                    <BetAvatar user={bettor} />
                    <div className="min-w-0 flex-1 text-sm">
                        <div className="font-bold text-gray-900 dark:text-white truncate">{bettor?.name || 'Unknown'}</div>
                        <div className="text-gray-500 dark:text-gray-400 truncate tabular-nums">
                            <span className="font-bold text-gray-700 dark:text-gray-200">{bet.stake.toLocaleString()}</span> on <span className={`font-bold ${SIDE_TEXT[bet.side]}`}>{names[bet.side]}</span>
                            {' · '}{Number(bet.multiplier).toFixed(2)}×{at && ` · at ${at}`}
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0 leading-tight">
                        <div className={`font-black tabular-nums ${result.className}`}>{result.text}</div>
                        {result.note && <div className="text-[11px] text-gray-400 dark:text-gray-500">{result.note}</div>}
                    </div>
                    {renderAction?.(bet)}
                </li>
            )
        })}
    </ul>
)
