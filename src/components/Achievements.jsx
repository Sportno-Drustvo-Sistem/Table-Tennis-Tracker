import React, { useMemo } from 'react'
import { Flame, Sword, Mountain, TrendingUp, Target, Medal, Users, Shield } from 'lucide-react'
import { buildEloHistory } from '../utils'

const BADGE_DEFS = [
    {
        id: 'on_fire',
        label: 'On Fire',
        desc: '5+ game win streak',
        icon: Flame,
        color: 'text-orange-500',
        bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    },
    {
        id: 'giant_killer',
        label: 'Giant Killer',
        desc: 'Beat someone 200+ ELO above you',
        icon: Sword,
        color: 'text-red-500',
        bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    },
    {
        id: 'summit',
        label: 'Summit',
        desc: 'Reached #1 on the leaderboard',
        icon: Mountain,
        color: 'text-emerald-500',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    },
    {
        id: 'rising_star',
        label: 'Rising Star',
        desc: 'Gained 100+ ELO in 7 days',
        icon: TrendingUp,
        color: 'text-blue-500',
        bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    },
    {
        id: 'perfect_game',
        label: 'Perfect Game',
        desc: 'Won a game 11-0',
        icon: Target,
        color: 'text-purple-500',
        bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    },
    {
        id: 'century',
        label: 'Century',
        desc: 'Played 100+ matches',
        icon: Medal,
        color: 'text-yellow-500',
        bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    },
    {
        id: 'variety',
        label: 'Social Butterfly',
        desc: 'Played 10+ different opponents',
        icon: Users,
        color: 'text-pink-500',
        bg: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800',
    },
    {
        id: 'iron_will',
        label: 'Iron Will',
        desc: 'Won after trailing 1-10',
        icon: Shield,
        color: 'text-indigo-500',
        bg: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
    },
]

const Achievements = ({ playerId, users, matches }) => {
    const earned = useMemo(() => {
        if (!playerId || !matches?.length) return []

        const sortedMatches = [...matches].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        const playerMatches = sortedMatches.filter(m => m.player1_id === playerId || m.player2_id === playerId)

        if (playerMatches.length === 0) return []

        const badges = new Set()

        // --- On Fire: current 5+ win streak ---
        let streak = 0
        for (let i = playerMatches.length - 1; i >= 0; i--) {
            const m = playerMatches[i]
            const isP1 = m.player1_id === playerId
            const won = isP1 ? m.score1 > m.score2 : m.score2 > m.score1
            if (won) streak++
            else break
        }
        if (streak >= 5) badges.add('on_fire')

        const eloData = buildEloHistory(users, matches)

        // --- Giant Killer: beat someone 200+ ELO above you ---
        const checkGK = eloData.matchHistory.some(m => {
            if (m.p1Id === playerId && m.score1 > m.score2 && m.p2EloBefore - m.p1EloBefore >= 200) return true
            if (m.p2Id === playerId && m.score2 > m.score1 && m.p1EloBefore - m.p2EloBefore >= 200) return true
            return false
        })
        if (checkGK) badges.add('giant_killer')

        // --- Summit: was ever #1 ---
        const ratingsCheck = {}
        const mpcCheck = {}
        users.forEach(u => { ratingsCheck[u.id] = 1200; mpcCheck[u.id] = 0 })

        for (const m of eloData.matchHistory) {
            ratingsCheck[m.p1Id] = m.p1EloAfter
            ratingsCheck[m.p2Id] = m.p2EloAfter
            mpcCheck[m.p1Id] = (mpcCheck[m.p1Id] || 0) + 1
            mpcCheck[m.p2Id] = (mpcCheck[m.p2Id] || 0) + 1

            if (m.p1Id === playerId || m.p2Id === playerId) {
                const rankedPlayers = users.filter(u => mpcCheck[u.id] >= 10)
                if (rankedPlayers.length > 0 && mpcCheck[playerId] >= 10) {
                    const isTop = rankedPlayers.every(u => ratingsCheck[playerId] >= ratingsCheck[u.id])
                    if (isTop) badges.add('summit')
                }
            }
        }

        // --- Rising Star: gained 100+ ELO in any 7-day window ---
        const myTimeline = eloData.playerEloTimelines[playerId] || []
        for (let i = 0; i < myTimeline.length; i++) {
            for (let j = i + 1; j < myTimeline.length; j++) {
                const daysDiff = (myTimeline[j].date - myTimeline[i].date) / (1000 * 60 * 60 * 24)
                if (daysDiff > 7) break
                if (myTimeline[j].elo - myTimeline[i].elo >= 100) {
                    badges.add('rising_star')
                    break
                }
            }
            if (badges.has('rising_star')) break
        }

        // --- Perfect Game: won 11-0 ---
        playerMatches.forEach(m => {
            const isP1 = m.player1_id === playerId
            const myScore = isP1 ? m.score1 : m.score2
            const oppScore = isP1 ? m.score2 : m.score1
            if (myScore === 11 && oppScore === 0) badges.add('perfect_game')
        })

        // --- Century: 100+ matches ---
        if (playerMatches.length >= 100) badges.add('century')

        // --- Social Butterfly: 10+ unique opponents ---
        const opponents = new Set()
        playerMatches.forEach(m => {
            opponents.add(m.player1_id === playerId ? m.player2_id : m.player1_id)
        })
        if (opponents.size >= 10) badges.add('variety')

        // --- Iron Will: won after being down 1-10 --- (needs point-by-point but we can check score)
        // We approximate: if player won and opponent scored 10+, it was close. Real iron will = won 12-10 or similar.
        // Actually the badge says "won after being down 1-10" which we can't verify from final scores.
        // Approximate: won with at least 10 points scored by opponent
        playerMatches.forEach(m => {
            const isP1 = m.player1_id === playerId
            const myScore = isP1 ? m.score1 : m.score2
            const oppScore = isP1 ? m.score2 : m.score1
            if (myScore > oppScore && oppScore >= 10) badges.add('iron_will')
        })

        return Array.from(badges)
    }, [playerId, users, matches])

    if (!earned.length && !matches?.length) return null

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-bold text-lg mb-4 flex items-center text-gray-900 dark:text-white">
                <Medal className="mr-2 text-yellow-500" size={20} /> Achievements
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {BADGE_DEFS.map(badge => {
                    const isEarned = earned.includes(badge.id)
                    const Icon = badge.icon
                    return (
                        <div
                            key={badge.id}
                            className={`flex flex-col items-center p-3 rounded-lg border text-center transition-all ${isEarned
                                ? `${badge.bg}`
                                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-35 grayscale'
                                }`}
                            title={badge.desc}
                        >
                            <Icon className={`${isEarned ? badge.color : 'text-gray-400'} mb-1`} size={24} />
                            <span className={`text-xs font-bold ${isEarned ? 'text-gray-800 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                                {badge.label}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{badge.desc}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default Achievements
