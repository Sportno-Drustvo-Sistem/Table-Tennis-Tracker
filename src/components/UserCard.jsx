import React, { memo } from 'react'
import { Check, Pencil } from 'lucide-react'
import { getEloRank, getAvatarFallback } from '../utils'

const UserCard = memo(({ user, isSelected, selectionMode, onClick, onEdit, isAdmin, compact, sport, padelStats }) => {
    // Use padel stats when in padel mode, otherwise ping pong stats from user object
    const isPadel = sport === 'padel'
    const elo = isPadel ? (padelStats?.elo_rating || 1200) : (user.elo_rating || 1200)
    const wins = isPadel ? (padelStats?.total_wins || 0) : (user.total_wins || 0)
    const gamesPlayed = isPadel ? (padelStats?.matches_played || 0) : (user.matches_played || 0)
    const rank = getEloRank(elo)

    return (
        <div
            onClick={onClick}
            className={`
        relative group flex flex-col items-center bg-white dark:bg-gray-800 rounded-xl shadow-md transition-all cursor-pointer hover:shadow-lg border-2
        ${compact ? 'p-3' : 'p-6'}
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-transparent dark:border-gray-700'}
        ${selectionMode ? 'hover:border-blue-300 dark:hover:border-blue-700' : ''}
      `}
        >
            <div className={`relative ${compact ? 'w-16 h-16 mb-2' : 'w-24 h-24 mb-4'}`}>
                <img
                    src={user.avatar_url || getAvatarFallback(user.name)}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover border-4 border-gray-100 dark:border-gray-700"
                />
                {isSelected && (
                    <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-1 z-10 shadow-sm">
                        <Check size={compact ? 12 : 16} />
                    </div>
                )}
                {!selectionMode && isAdmin && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onEdit(user)
                        }}
                        className="absolute bottom-0 right-0 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900 dark:hover:text-blue-200"
                        aria-label={`Edit ${user.name}`}
                    >
                        <Pencil size={14} />
                    </button>
                )}
            </div>
            <h3 className={`${compact ? 'text-sm' : 'text-xl'} font-bold text-gray-800 dark:text-white text-center w-full truncate px-1`}>{user.name}</h3>

            {!compact && (
                <>
                    {/* ELO + Rank badge */}
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-lg font-extrabold ${isPadel ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {elo}
                        </span>
                        <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ color: rank.color, backgroundColor: `${rank.color}22` }}
                        >
                            {rank.label}
                        </span>
                    </div>
                    {/* Win count */}
                    <div className="flex items-center mt-1 text-gray-500 dark:text-gray-400 text-xs font-medium">
                        {wins} {wins === 1 ? 'Win' : 'Wins'} · {gamesPlayed} Games
                    </div>
                </>
            )}

            {compact && (
                <div className="flex items-center mt-1 text-yellow-500 font-semibold text-xs">
                    <span>{wins}</span>
                </div>
            )}
        </div>
    )
})

UserCard.displayName = 'UserCard'

export default UserCard

