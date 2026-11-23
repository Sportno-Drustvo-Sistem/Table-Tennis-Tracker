import { useCallback, useEffect, useRef, useState } from 'react'
import { bettingLeader, buildShowtime, diffBets } from './betShowtime'

// Realtime delivers a settlement one row at a time, so settled bets are
// gathered for a moment and shown together.
const SETTLE_GATHER_MS = 900

// Watches bets while the Bets tab is open and queues what to show. Only
// changes seen here count, so opening the tab never replays old results.
// `stage` is the full-screen queue (show stage[0]), `banners` the small ones.
export const useBetShowtime = ({ users, wallets, markets, bets }) => {
    const [stage, setStage] = useState([])
    const [banners, setBanners] = useState([])
    const seen = useRef(null)
    const leader = useRef(null)
    const gathered = useRef([])
    const timer = useRef(null)
    const latest = useRef({ users, wallets, markets, bets })
    useEffect(() => { latest.current = { users, wallets, markets, bets } })

    useEffect(() => () => clearTimeout(timer.current), [])

    useEffect(() => {
        if (!seen.current) {
            seen.current = new Map(bets.map(bet => [bet.id, bet.status]))
            leader.current = bettingLeader(users, wallets, bets)
            return
        }
        const { placed, settled } = diffBets(seen.current, bets)
        seen.current = new Map(bets.map(bet => [bet.id, bet.status]))
        if (placed.length) setBanners(queue => [...queue, ...placed.map(bet => ({ type: 'bet', id: `bet-${bet.id}`, userId: bet.user_id, bet }))])
        if (!settled.length) return
        gathered.current.push(...settled)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => {
            const now = latest.current
            const leaderAfter = bettingLeader(now.users, now.wallets, now.bets)
            const show = buildShowtime({ settledIds: gathered.current, ...now, leaderBefore: leader.current, leaderAfter })
            gathered.current = []
            leader.current = leaderAfter
            if (show.stage.length) setStage(queue => [...queue, ...show.stage])
            if (show.banners.length) setBanners(queue => [...queue, ...show.banners])
        }, SETTLE_GATHER_MS)
    }, [bets, users, wallets])

    const nextStage = useCallback(() => setStage(queue => queue.slice(1)), [])
    const nextBanner = useCallback(() => setBanners(queue => queue.slice(1)), [])
    return { moment: stage[0] || null, banner: banners[0] || null, nextStage, nextBanner }
}
