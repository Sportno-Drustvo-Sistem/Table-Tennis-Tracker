// Sabotage shop: debuffs bought with betting points for a number of points of
// a live match. Points are counted across the whole match, so a debuff bought
// in game 1 can run into game 2. Debuffs are display-only: nothing here feeds
// match results or ELO.

// Points played so far, from a shared live row ({ score1, score2, sets }).
export const livePointsPlayed = (live) => {
    if (!live) return 0
    const sets = Array.isArray(live.sets) ? live.sets : []
    return sets.reduce((sum, set) => sum + (Number(set?.s1) || 0) + (Number(set?.s2) || 0), (Number(live.score1) || 0) + (Number(live.score2) || 0))
}

// 'queued' (waits for an earlier debuff), 'active' or 'done', and points left.
export const sabotageStatus = (sabotage, played) => {
    if (played >= sabotage.end_point) return { state: 'done', left: 0, startsIn: 0 }
    if (played < sabotage.start_point) return { state: 'queued', left: sabotage.points, startsIn: sabotage.start_point - played }
    return { state: 'active', left: sabotage.end_point - played, startsIn: 0 }
}

// Debuffs still to be played in one match, by target, current one first.
export const pendingSabotages = (sabotages, liveMatchId, played) => (sabotages || [])
    .filter(sabotage => sabotage.live_match_id === liveMatchId)
    .map(sabotage => ({ ...sabotage, status: sabotageStatus(sabotage, played) }))
    .filter(sabotage => sabotage.status.state !== 'done')
    .sort((a, b) => a.start_point - b.start_point || Date.parse(a.created_at) - Date.parse(b.created_at))

export const sabotagePrice = (item, points) => (item ? item.price_per_point * points : 0)

// The buyer has to keep at least one point.
export const canAffordSabotage = (balance, price) => price > 0 && balance > price

// Most points spent, most points received, and who was hit the most.
export const sabotageStats = (sabotages) => {
    const spent = new Map()
    const received = new Map()
    for (const sabotage of sabotages || []) {
        spent.set(sabotage.buyer_id, (spent.get(sabotage.buyer_id) || 0) + sabotage.price)
        received.set(sabotage.target_id, (received.get(sabotage.target_id) || 0) + sabotage.price)
    }
    const top = map => [...map.entries()].sort((a, b) => b[1] - a[1])[0] || null
    return { saboteur: top(spent), victim: top(received) }
}
