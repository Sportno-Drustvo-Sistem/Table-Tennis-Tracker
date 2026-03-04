import React, { useMemo } from 'react'
import { Flame, Sword, Mountain, TrendingUp, Target, Medal, Users, Crosshair, Shield } from 'lucide-react'
import { buildEloHistory, getActiveDebuffs } from '../utils'

const LEVEL_COLORS = {
    1: { name: 'Bronze', bg: 'bg-amber-100 dark:bg-amber-900/30 border-amber-400 dark:border-amber-600', text: 'text-amber-700 dark:text-amber-500' },
    2: { name: 'Silver', bg: 'bg-gray-200 dark:bg-gray-700 border-gray-400 dark:border-gray-500', text: 'text-gray-700 dark:text-gray-400' },
    3: { name: 'Gold', bg: 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-400 dark:border-yellow-500', text: 'text-yellow-700 dark:text-yellow-500' },
    4: { name: 'Platinum', bg: 'bg-cyan-100 dark:bg-cyan-900/40 border-cyan-400 dark:border-cyan-500', text: 'text-cyan-700 dark:text-cyan-500' },
    5: { name: 'Diamond', bg: 'bg-purple-100 dark:bg-purple-900/40 border-purple-400 dark:border-purple-500', text: 'text-purple-700 dark:text-purple-400' }
}

const BADGE_DEFS = [
    {
        id: 'on_fire',
        label: 'On Fire',
        icon: Flame,
        levels: [
            { req: 3, desc: '3+ game win streak' },
            { req: 5, desc: '5+ game win streak' },
            { req: 7, desc: '7+ game win streak' },
            { req: 10, desc: '10+ game win streak' },
            { req: 15, desc: '15+ game win streak' }
        ]
    },
    {
        id: 'giant_killer',
        label: 'Giant Killer',
        icon: Sword,
        levels: [
            { req: 100, desc: 'Beat someone 100+ ELO above you' },
            { req: 150, desc: 'Beat someone 150+ ELO above you' },
            { req: 200, desc: 'Beat someone 200+ ELO above you' },
            { req: 300, desc: 'Beat someone 300+ ELO above you' },
            { req: 400, desc: 'Beat someone 400+ ELO above you' }
        ]
    },
    {
        id: 'summit',
        label: 'Summit',
        icon: Mountain,
        levels: [
            { req: 10, desc: 'Reached Top 10 on leaderboard' },
            { req: 5, desc: 'Reached Top 5 on leaderboard' },
            { req: 3, desc: 'Reached Top 3 on leaderboard' },
            { req: 2, desc: 'Reached Top 2 on leaderboard' },
            { req: 1, desc: 'Reached #1 on leaderboard' }
        ]
    },
    {
        id: 'rising_star',
        label: 'Rising Star',
        icon: TrendingUp,
        levels: [
            { req: 100, desc: 'Gained 100+ ELO in 7 days' },
            { req: 150, desc: 'Gained 150+ ELO in 7 days' },
            { req: 200, desc: 'Gained 200+ ELO in 7 days' },
            { req: 300, desc: 'Gained 300+ ELO in 7 days' },
            { req: 400, desc: 'Gained 400+ ELO in 7 days' }
        ]
    },
    {
        id: 'perfect_game',
        label: 'Perfect Game',
        icon: Target,
        levels: [
            { req: 1, desc: 'Won a game 11-0' },
            { req: 3, desc: 'Won 3 games 11-0' },
            { req: 5, desc: 'Won 5 games 11-0' },
            { req: 10, desc: 'Won 10 games 11-0' },
            { req: 20, desc: 'Won 20 games 11-0' }
        ]
    },
    {
        id: 'century',
        label: 'Veteran',
        icon: Medal,
        levels: [
            { req: 50, desc: 'Played 50+ matches' },
            { req: 100, desc: 'Played 100+ matches' },
            { req: 250, desc: 'Played 250+ matches' },
            { req: 500, desc: 'Played 500+ matches' },
            { req: 1000, desc: 'Played 1000+ matches' }
        ]
    },
    {
        id: 'variety',
        label: 'Social Butterfly',
        icon: Users,
        levels: [
            { req: 2, desc: 'Played 2+ different opponents' },
            { req: 5, desc: 'Played 5+ different opponents' },
            { req: 10, desc: 'Played 10+ different opponents' },
            { req: 15, desc: 'Played 15+ different opponents' },
            { req: 20, desc: 'Played 20+ different opponents' }
        ]
    },
    {
        id: 'clutch_master',
        label: 'Clutch Master',
        icon: Crosshair,
        levels: [
            { req: 0.5, desc: '50%+ win rate in deuce games (min 5)' },
            { req: 0.6, desc: '60%+ win rate in deuce games (min 5)' },
            { req: 0.7, desc: '70%+ win rate in deuce games (min 5)' },
            { req: 0.8, desc: '80%+ win rate in deuce games (min 5)' },
            { req: 0.9, desc: '90%+ win rate in deuce games (min 5)' }
        ]
    },

]

const Achievements = ({ playerId, users, matches }) => {
    const [debuffs, setDebuffs] = React.useState([])
    React.useEffect(() => {
        getActiveDebuffs().then(setDebuffs)
    }, [])

    const allBadgeDefs = useMemo(() => {
        const wonDebuffTitles = new Set()
        if (matches && playerId) {
            matches.forEach(m => {
                const isP1 = m.player1_id === playerId
                const isP2 = m.player2_id === playerId
                if (isP1 || isP2) {
                    const myScore = isP1 ? m.score1 : m.score2
                    const oppScore = isP1 ? m.score2 : m.score1
                    if (myScore > oppScore && m.handicap_rule) {
                        const rules = Array.isArray(m.handicap_rule) ? m.handicap_rule : [m.handicap_rule]
                        rules.forEach(r => {
                            if (r.targetPlayerId === playerId && r.title) {
                                wonDebuffTitles.add(r.title)
                            }
                        })
                    }
                }
            })
        }

        debuffs.forEach(d => {
            if (d.title) wonDebuffTitles.add(d.title)
        })

        const dynamicBadges = Array.from(wonDebuffTitles).map(title => {
            const cleanId = 'debuff_' + title.toLowerCase().replace(/[^a-z0-9]/g, '_')
            return {
                id: cleanId,
                label: `${title} Master`,
                icon: Shield,
                isDebuffBadge: true,
                debuffTitle: title,
                levels: [
                    { req: 1, desc: `Won 1 match with ${title}` },
                    { req: 3, desc: `Won 3 matches with ${title}` },
                    { req: 5, desc: `Won 5 matches with ${title}` },
                    { req: 10, desc: `Won 10 matches with ${title}` },
                    { req: 20, desc: `Won 20 matches with ${title}` }
                ]
            }
        })

        return [...BADGE_DEFS, ...dynamicBadges]
    }, [debuffs, matches, playerId])

    const { badges: earned, metrics } = useMemo(() => {
        if (!playerId || !matches?.length) return { badges: {}, metrics: null }

        const sortedMatches = [...matches].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        const playerMatches = sortedMatches.filter(m => m.player1_id === playerId || m.player2_id === playerId)

        if (playerMatches.length === 0) return { badges: {}, metrics: null }

        const badges = {} // { badge_id: level_index }

        // Helper to check which level was reached (returns 0-4, or -1 if none)
        // ascending indicates if higher metric is better (streak, ELO gained) 
        // string 'summit' needs reversed logic (lower rank is better)
        const getLevel = (id, metric, ascending = true) => {
            const def = allBadgeDefs.find(b => b.id === id)
            if (!def) return -1
            let highest = -1
            for (let i = 0; i < def.levels.length; i++) {
                if (ascending ? metric >= def.levels[i].req : metric <= def.levels[i].req) {
                    highest = i
                } else if (ascending) {
                    break // Next levels require higher metrics, so we can stop
                }
            }
            return highest
        }

        // --- On Fire: current 5+ win streak ---
        let streak = 0
        for (let i = playerMatches.length - 1; i >= 0; i--) {
            const m = playerMatches[i]
            const isP1 = m.player1_id === playerId
            const won = isP1 ? m.score1 > m.score2 : m.score2 > m.score1
            if (won) streak++
            else break
        }
        const onFireLvl = getLevel('on_fire', streak)
        if (onFireLvl >= 0) badges['on_fire'] = onFireLvl

        const eloData = buildEloHistory(users, matches)

        // --- Giant Killer: highest ELO beaten ---
        let maxEloDiff = 0
        eloData.matchHistory.forEach(m => {
            if (m.p1Id === playerId && m.score1 > m.score2) {
                const diff = m.p2EloBefore - m.p1EloBefore
                if (diff > maxEloDiff) maxEloDiff = diff
            }
            if (m.p2Id === playerId && m.score2 > m.score1) {
                const diff = m.p1EloBefore - m.p2EloBefore
                if (diff > maxEloDiff) maxEloDiff = diff
            }
        })
        const gkLvl = getLevel('giant_killer', maxEloDiff)
        if (gkLvl >= 0) badges['giant_killer'] = gkLvl

        // --- Summit: best rank ever ---
        const ratingsCheck = {}
        users.forEach(u => { ratingsCheck[u.id] = 1200 })
        let bestRank = Infinity

        for (const m of eloData.matchHistory) {
            ratingsCheck[m.p1Id] = m.p1EloAfter
            ratingsCheck[m.p2Id] = m.p2EloAfter

            if (m.p1Id === playerId || m.p2Id === playerId) {
                // Determine rank among all players
                // Rank is 1 + number of players with strictly higher ELO
                const myElo = ratingsCheck[playerId]
                const rank = 1 + users.filter(u => ratingsCheck[u.id] > myElo).length
                if (rank < bestRank) bestRank = rank
            }
        }
        if (bestRank !== Infinity) {
            const summitLvl = getLevel('summit', bestRank, false) // false because lower rank is better (1 is best)
            if (summitLvl >= 0) badges['summit'] = summitLvl
        }

        // --- Rising Star: gained ELO in any 7-day window ---
        const myTimeline = eloData.playerEloTimelines[playerId] || []
        let maxSevenDayGain = 0
        for (let i = 0; i < myTimeline.length; i++) {
            for (let j = i + 1; j < myTimeline.length; j++) {
                const daysDiff = (myTimeline[j].date - myTimeline[i].date) / (1000 * 60 * 60 * 24)
                if (daysDiff > 7) break
                const gain = myTimeline[j].elo - myTimeline[i].elo
                if (gain > maxSevenDayGain) maxSevenDayGain = gain
            }
        }
        const rsLvl = getLevel('rising_star', maxSevenDayGain)
        if (rsLvl >= 0) badges['rising_star'] = rsLvl

        // --- Perfect Game: 11-0 wins ---
        let perfects = 0
        playerMatches.forEach(m => {
            const isP1 = m.player1_id === playerId
            const myScore = isP1 ? m.score1 : m.score2
            const oppScore = isP1 ? m.score2 : m.score1
            if (myScore === 11 && oppScore === 0) perfects++
        })
        const pgLvl = getLevel('perfect_game', perfects)
        if (pgLvl >= 0) badges['perfect_game'] = pgLvl

        // --- Veteran: tracked matches length ---
        const vetLvl = getLevel('century', playerMatches.length)
        if (vetLvl >= 0) badges['century'] = vetLvl

        // --- Social Butterfly: unique opponents ---
        const opponents = new Set()
        playerMatches.forEach(m => {
            opponents.add(m.player1_id === playerId ? m.player2_id : m.player1_id)
        })
        const sbLvl = getLevel('variety', opponents.size)
        if (sbLvl >= 0) badges['variety'] = sbLvl

        // --- Specific Debuff Winners ---
        const specificDebuffWins = {}
        playerMatches.forEach(m => {
            const isP1 = m.player1_id === playerId
            const myScore = isP1 ? m.score1 : m.score2
            const oppScore = isP1 ? m.score2 : m.score1
            if (myScore > oppScore && m.handicap_rule) {
                const rules = Array.isArray(m.handicap_rule) ? m.handicap_rule : [m.handicap_rule]
                rules.forEach(r => {
                    // Need to capture mayhem type targeting the player or any rule targeting the player
                    if (r.targetPlayerId === playerId && r.title) {
                        specificDebuffWins[r.title] = (specificDebuffWins[r.title] || 0) + 1
                    }
                })
            }
        })

        allBadgeDefs.filter(b => b.isDebuffBadge).forEach(badge => {
            const count = specificDebuffWins[badge.debuffTitle] || 0
            const lvl = getLevel(badge.id, count)
            if (lvl >= 0) badges[badge.id] = lvl
        })

        // --- Clutch Master: deuce win rate (min 5) ---
        let deuceWins = 0
        let deuceTotal = 0
        playerMatches.forEach(m => {
            const isP1 = m.player1_id === playerId
            const myScore = isP1 ? m.score1 : m.score2
            const oppScore = isP1 ? m.score2 : m.score1
            if (myScore >= 10 && oppScore >= 10) {
                deuceTotal++
                if (myScore > oppScore) deuceWins++
            }
        })
        const deuceWr = deuceTotal > 0 ? deuceWins / deuceTotal : 0
        if (deuceTotal >= 5) {
            const cmLvl = getLevel('clutch_master', deuceWr)
            if (cmLvl >= 0) badges['clutch_master'] = cmLvl
        }

        return {
            badges,
            metrics: { deuceTotal, deuceWins, deuceWr, specificDebuffWins }
        }
    }, [playerId, users, matches, allBadgeDefs])

    if (Object.keys(earned).length === 0 && !matches?.length) return null

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-bold text-lg mb-4 flex items-center text-gray-900 dark:text-white">
                <Medal className="mr-2 text-yellow-500" size={20} /> Achievements
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {allBadgeDefs.map(badge => {
                    const earnedLevelIndex = earned[badge.id]
                    const isEarned = earnedLevelIndex !== undefined
                    const levelDef = isEarned ? badge.levels[earnedLevelIndex] : badge.levels[0]
                    const theme = isEarned ? LEVEL_COLORS[earnedLevelIndex + 1] : null

                    const Icon = badge.icon
                    return (
                        <div
                            key={badge.id}
                            className={`flex flex-col items-center p-3 rounded-lg border text-center transition-all ${isEarned
                                ? theme.bg
                                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-50 grayscale'
                                }`}
                            title={levelDef.desc}
                        >
                            <Icon className={`${isEarned ? theme.text : 'text-gray-400'} mb-1`} size={24} />
                            <span className={`text-xs font-bold flex flex-col items-center gap-0.5 ${isEarned ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                                <span>{badge.label}</span>
                                {isEarned && (
                                    <span className={`text-[10px] px-1.5 rounded-sm ${theme.bg} ${theme.text}`}>Level {earnedLevelIndex + 1} ({theme.name})</span>
                                )}
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{levelDef.desc}</span>
                            {badge.id === 'clutch_master' && metrics && (
                                <span className="text-[10px] font-semibold text-blue-500 dark:text-blue-400 mt-0.5">
                                    {(metrics.deuceWr * 100).toFixed(1)}% ({metrics.deuceWins}/{metrics.deuceTotal})
                                </span>
                            )}
                            {badge.isDebuffBadge && metrics && (
                                <span className="text-[10px] font-semibold text-fuchsia-500 dark:text-fuchsia-400 mt-0.5">
                                    {metrics.specificDebuffWins[badge.debuffTitle] || 0} Wins
                                </span>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default Achievements
