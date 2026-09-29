import React, { useMemo, useState } from 'react'
import { Plus, Search, Ghost } from 'lucide-react'
import UserCard from './UserCard'
import { Button } from './layout/AppShell'
import { getSportStats } from '../utils'

const SkeletonCard = () => (
    <div className="p-4 rounded-2xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700/80 animate-pulse">
        <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-1/3 rounded bg-gray-100 dark:bg-gray-700/60" />
            </div>
        </div>
        <div className="mt-5 h-6 w-16 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60" />
    </div>
)

const PlayersView = ({ users, loading, sport, padelStatsMap, tennisStatsMap, isAdmin, onUserClick, onEditUser, onAddPlayer }) => {
    const [query, setQuery] = useState('')

    // Rank players by the active sport's Elo; players without games go last.
    const ranked = useMemo(() => {
        const rows = users.map(user => ({
            user,
            stats: getSportStats(user, sport, padelStatsMap[user.id], tennisStatsMap[user.id]),
        }))
        rows.sort((a, b) => {
            const aPlayed = a.stats.gamesPlayed > 0
            const bPlayed = b.stats.gamesPlayed > 0
            if (aPlayed !== bPlayed) return aPlayed ? -1 : 1
            return b.stats.elo - a.stats.elo || a.user.name.localeCompare(b.user.name)
        })
        let position = 0
        return rows.map(row => ({ ...row, position: row.stats.gamesPlayed > 0 ? ++position : null }))
    }, [users, sport, padelStatsMap, tennisStatsMap])

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase()
        return q ? ranked.filter(({ user }) => user.name.toLowerCase().includes(q)) : ranked
    }, [ranked, query])

    if (loading && users.length === 0) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} />)}
            </div>
        )
    }

    if (users.length === 0) {
        return (
            <div className="flex flex-col items-center text-center py-16 px-6 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 mb-4">
                    <Ghost size={28} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No players yet</h3>
                <p className="mt-1 mb-6 text-sm text-gray-500 dark:text-gray-400">Add some colleagues to get started.</p>
                <Button variant="primary" icon={Plus} onClick={onAddPlayer}>Add Player</Button>
            </div>
        )
    }

    return (
        <>
            <div className="relative mb-5 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Search ${users.length} players`}
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
                />
            </div>

            {visible.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">No players match “{query}”.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {visible.map(({ user, position }) => (
                        <UserCard
                            key={user.id}
                            user={user}
                            position={position}
                            selectionMode={false}
                            isSelected={false}
                            onClick={() => onUserClick(user)}
                            onEdit={onEditUser}
                            isAdmin={isAdmin}
                            sport={sport}
                            padelStats={padelStatsMap[user.id]}
                            tennisStats={tennisStatsMap[user.id]}
                        />
                    ))}
                </div>
            )}
        </>
    )
}

export default PlayersView
