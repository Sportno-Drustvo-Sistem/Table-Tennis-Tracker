import React, { memo } from 'react'
import { Check, Pencil } from 'lucide-react'
import { getEloRank, getAvatarFallback, getSportStats } from '../utils'

const RankBadge = ({ rank, children }) => (
    <span
        className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md"
        style={{ color: rank.color, backgroundColor: `${rank.color}1f` }}
    >
        {children ?? rank.label}
    </span>
)

const UserCard = memo(({ user, isSelected, selectionMode, onClick, onEdit, isAdmin, compact, sport, padelStats, tennisStats, position }) => {
    const { elo, wins, gamesPlayed, losses } = getSportStats(user, sport, padelStats, tennisStats)
    const rank = gamesPlayed > 0 ? getEloRank(elo) : { label: 'New', color: '#71717a' }
    const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : null
    const avatar = user.avatar_url || getAvatarFallback(user.name)

    if (compact) {
        return (
            <div
                onClick={onClick}
                className={`
                    relative flex flex-col items-center p-3 rounded-xl border bg-white dark:bg-gray-800 cursor-pointer transition-all
                    ${isSelected
                        ? 'border-accent ring-2 ring-accent/25'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'}
                `}
            >
                <div className="relative w-14 h-14 mb-2">
                    <img src={avatar} alt={user.name} className="w-full h-full rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-700" />
                    {isSelected && (
                        <div className="absolute -top-1 -right-1 bg-accent text-white rounded-full p-0.5 shadow-sm">
                            <Check size={12} strokeWidth={3} />
                        </div>
                    )}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white text-center w-full truncate">{user.name}</h3>
                <div className="mt-1">
                    <RankBadge rank={rank}>{elo}</RankBadge>
                </div>
            </div>
        )
    }

    return (
        <div
            onClick={onClick}
            className={`
                relative group flex flex-col p-4 rounded-2xl border bg-white dark:bg-gray-800 cursor-pointer transition-all
                hover:shadow-md hover:-translate-y-px
                ${isSelected
                    ? 'border-accent ring-2 ring-accent/25'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700/80 dark:hover:border-gray-600'}
            `}
        >
            <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                    <img src={avatar} alt={user.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-700" />
                    {isSelected && (
                        <div className="absolute -top-1 -right-1 bg-accent text-white rounded-full p-0.5 shadow-sm">
                            <Check size={12} strokeWidth={3} />
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{user.name}</h3>
                    <div className="mt-0.5">
                        <RankBadge rank={rank} />
                    </div>
                </div>
                {position != null && (
                    <span className="self-start text-xs font-semibold tabular-nums text-gray-400 dark:text-gray-500">#{position}</span>
                )}
            </div>

            <div className="mt-4 flex items-end justify-between gap-2">
                <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Elo</div>
                    <div className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white leading-none mt-1">{elo}</div>
                </div>
                <div className="text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{wins}</span>W
                        <span className="mx-1 text-gray-300 dark:text-gray-600">/</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{losses}</span>L
                    </div>
                    <div className="mt-0.5">{winRate != null ? `${winRate}% win rate` : 'No games yet'}</div>
                </div>
            </div>

            <div className="mt-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700/70 overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${winRate ?? 0}%` }} />
            </div>

            {!selectionMode && isAdmin && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onEdit(user)
                    }}
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/90 text-gray-500 border border-gray-200 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 transition-opacity hover:text-gray-900 dark:bg-gray-800/90 dark:border-gray-600 dark:text-gray-300 dark:hover:text-white"
                    aria-label={`Edit ${user.name}`}
                >
                    <Pencil size={14} />
                </button>
            )}
        </div>
    )
})

UserCard.displayName = 'UserCard'

export default UserCard
