import React, { useMemo } from 'react'
import { Flame, Sword, Mountain, TrendingUp, Target, Medal, Users, Crosshair } from 'lucide-react'
import { buildPadelEloHistory, getMatchWinner } from '../padelUtils'

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
            { req: 3, desc: '3+ match win streak' },
            { req: 5, desc: '5+ match win streak' },
            { req: 7, desc: '7+ match win streak' },
            { req: 10, desc: '10+ match win streak' },
            { req: 15, desc: '15+ match win streak' }
        ]
    },
    {
        id: 'giant_killer',
        label: 'Giant Killer',
        icon: Sword,
        levels: [
            { req: 50, desc: 'Beat team 50+ avg ELO above your team' },
            { req: 100, desc: 'Beat team 100+ avg ELO above your team' },
            { req: 150, desc: 'Beat team 150+ avg ELO above your team' },
            { req: 200, desc: 'Beat team 200+ avg ELO above your team' },
            { req: 300, desc: 'Beat team 300+ avg ELO above your team' }
        ]
    },
    {
        id: 'summit',
        label: 'Summit',
        icon: Mountain,
        levels: [
            { req: 10, desc: 'Reached Top 10 on padel leaderboard' },
            { req: 5, desc: 'Reached Top 5 on padel leaderboard' },
            { req: 3, desc: 'Reached Top 3 on padel leaderboard' },
            { req: 2, desc: 'Reached Top 2 on padel leaderboard' },
            { req: 1, desc: 'Reached #1 on padel leaderboard' }
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
        label: 'Dominator',
        icon: Target,
        levels: [
            { req: 1, desc: 'Won a set 6-0' },
            { req: 3, desc: 'Won 3 sets 6-0' },
            { req: 5, desc: 'Won 5 sets 6-0' },
            { req: 10, desc: 'Won 10 sets 6-0' },
            { req: 20, desc: 'Won 20 sets 6-0' }
        ]
    },
    {
        id: 'century',
        label: 'Veteran',
        icon: Medal,
        levels: [
            { req: 20, desc: 'Played 20+ padel matches' },
            { req: 50, desc: 'Played 50+ padel matches' },
            { req: 100, desc: 'Played 100+ padel matches' },
            { req: 250, desc: 'Played 250+ padel matches' },
            { req: 500, desc: 'Played 500+ padel matches' }
        ]
    },
    {
        id: 'variety',
        label: 'Social Butterfly',
        icon: Users,
        levels: [
            { req: 5, desc: 'Played 5+ different opponents' },
            { req: 10, desc: 'Played 10+ different opponents' },
            { req: 20, desc: 'Played 20+ different opponents' },
            { req: 30, desc: 'Played 30+ different opponents' },
            { req: 50, desc: 'Played 50+ different opponents' }
        ]
    },
    {
        id: 'clutch_master',
        label: 'Clutch Master',
        icon: Crosshair,
        levels: [
            { req: 0.5, desc: '50%+ win rate in tiebreak sets (min 3)' },
            { req: 0.6, desc: '60%+ win rate in tiebreak sets (min 3)' },
            { req: 0.7, desc: '70%+ win rate in tiebreak sets (min 3)' },
            { req: 0.8, desc: '80%+ win rate in tiebreak sets (min 3)' },
            { req: 0.9, desc: '90%+ win rate in tiebreak sets (min 3)' }
        ]
    },
]

const PadelAchievements = ({ playerId, users, matches }) => {
    const { badges: earned, metrics } = useMemo(() => {
        if (!playerId || !matches?.length) return { badges: {}, metrics: null }

        const sortedMatches = [...matches].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        const playerMatches = sortedMatches.filter(m =>
            m.team1_player1_id === playerId || m.team1_player2_id === playerId ||
            m.team2_player1_id === playerId || m.team2_player2_id === playerId
        )

        if (playerMatches.length === 0) return { badges: {}, metrics: null }

        const badges = {}

        const getLevel = (id, metric, ascending = true) => {
            const def = BADGE_DEFS.find(b => b.id === id)
            let highest = -1
            for (let i = 0; i < def.levels.length; i++) {
                if (ascending ? metric >= def.levels[i].req : metric <= def.levels[i].req) {
                    highest = i
                } else if (ascending) {
                    break
                }
            }
            return highest
        }

        // --- On Fire: current match win streak ---
        let streak = 0
        for (let i = playerMatches.length - 1; i >= 0; i--) {
            const m = playerMatches[i]
            const isTeam1 = m.team1_player1_id === playerId || m.team1_player2_id === playerId
            const winner = getMatchWinner(m)
            const won = (isTeam1 && winner === 1) || (!isTeam1 && winner === 2)
            if (won) streak++
            else break
        }
        const onFireLvl = getLevel('on_fire', streak)
        if (onFireLvl >= 0) badges['on_fire'] = onFireLvl

        const eloData = buildPadelEloHistory(users, matches)

        // --- Giant Killer: highest team ELO beaten ---
        let maxEloDiff = 0
        eloData.matchHistory.forEach(m => {
            const isT1 = m.t1Ids.includes(playerId)
            const isT2 = m.t2Ids.includes(playerId)
            if (isT1 && m.winner === 1) {
                const diff = m.t2EloBefore - m.t1EloBefore
                if (diff > maxEloDiff) maxEloDiff = diff
            }
            if (isT2 && m.winner === 2) {
                const diff = m.t1EloBefore - m.t2EloBefore
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
            // Update the 4 players' ELOs to track global standing
            m.t1Ids.forEach(id => {
                const myTimeline = eloData.playerEloTimelines[id]
                const t = myTimeline.find(tPoint => tPoint.matchId === m.matchId)
                if (t) ratingsCheck[id] = t.elo
            })
            m.t2Ids.forEach(id => {
                const myTimeline = eloData.playerEloTimelines[id]
                const t = myTimeline.find(tPoint => tPoint.matchId === m.matchId)
                if (t) ratingsCheck[id] = t.elo
            })

            if (m.t1Ids.includes(playerId) || m.t2Ids.includes(playerId)) {
                const myElo = ratingsCheck[playerId]
                const rank = 1 + users.filter(u => ratingsCheck[u.id] > myElo).length
                if (rank < bestRank) bestRank = rank
            }
        }
        if (bestRank !== Infinity) {
            const summitLvl = getLevel('summit', bestRank, false)
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

        // --- Perfect Game: 6-0 sets ---
        let perfects = 0
        playerMatches.forEach(m => {
            const isTeam1 = m.team1_player1_id === playerId || m.team1_player2_id === playerId
            if (m.sets_data && m.sets_data.length > 0) {
                m.sets_data.forEach(s => {
                    const myScore = isTeam1 ? s.team1Games : s.team2Games
                    const oppScore = isTeam1 ? s.team2Games : s.team1Games
                    if (myScore === 6 && oppScore === 0) perfects++
                })
            } else {
                const myScore = isTeam1 ? m.score1 : m.score2
                const oppScore = isTeam1 ? m.score2 : m.score1
                if (myScore === 6 && oppScore === 0) perfects++
            }
        })
        const pgLvl = getLevel('perfect_game', perfects)
        if (pgLvl >= 0) badges['perfect_game'] = pgLvl

        // --- Veteran: tracked matches length ---
        const vetLvl = getLevel('century', playerMatches.length)
        if (vetLvl >= 0) badges['century'] = vetLvl

        // --- Social Butterfly: unique opponents ---
        const opponents = new Set()
        playerMatches.forEach(m => {
            const isTeam1 = m.team1_player1_id === playerId || m.team1_player2_id === playerId
            if (isTeam1) {
                opponents.add(m.team2_player1_id)
                opponents.add(m.team2_player2_id)
            } else {
                opponents.add(m.team1_player1_id)
                opponents.add(m.team1_player2_id)
            }
        })
        const sbLvl = getLevel('variety', opponents.size)
        if (sbLvl >= 0) badges['variety'] = sbLvl

        // --- Clutch Master: tiebreak sets win rate (7-5 or 7-6) (min 3 sets) ---
        let clutchWins = 0
        let clutchTotal = 0
        playerMatches.forEach(m => {
            const isTeam1 = m.team1_player1_id === playerId || m.team1_player2_id === playerId
            if (m.sets_data && m.sets_data.length > 0) {
                m.sets_data.forEach(s => {
                    const myScore = isTeam1 ? s.team1Games : s.team2Games
                    const oppScore = isTeam1 ? s.team2Games : s.team1Games
                    if ((myScore === 7 && (oppScore === 5 || oppScore === 6)) || (oppScore === 7 && (myScore === 5 || myScore === 6))) {
                        clutchTotal++
                        if (myScore === 7) clutchWins++
                    }
                })
            }
        })
        const cmWr = clutchTotal > 0 ? clutchWins / clutchTotal : 0
        if (clutchTotal >= 3) {
            const cmLvl = getLevel('clutch_master', cmWr)
            if (cmLvl >= 0) badges['clutch_master'] = cmLvl
        }

        return {
            badges,
            metrics: { clutchTotal, clutchWins, cmWr }
        }
    }, [playerId, users, matches])

    if (Object.keys(earned).length === 0 && !matches?.length) return null

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-bold text-lg mb-4 flex items-center text-gray-900 dark:text-white">
                <Medal className="mr-2 text-yellow-500" size={20} /> Padel Achievements
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {BADGE_DEFS.map(badge => {
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
                                    {(metrics.cmWr * 100).toFixed(1)}% ({metrics.clutchWins}/{metrics.clutchTotal})
                                </span>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default PadelAchievements
