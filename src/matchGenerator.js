// Only games from the current play session count toward breaks and fairness,
// so yesterday's games don't penalise anyone at the start of the day.
export const RECENT_WINDOW_MS = 12 * 60 * 60 * 1000
const RECENT_MATCH_LIMIT = 10
// Opponents from either of the last 2 games are this much less likely to be drawn again.
const REMATCH_PENALTY = 0.2

const playersOf = m => [m.player1_id, m.player2_id]

// Matches must be newest first.
export const getRecentMatches = (matches, now = Date.now()) =>
    matches.slice(0, RECENT_MATCH_LIMIT).filter(m => now - Date.parse(m.created_at) <= RECENT_WINDOW_MS)

// Players who played both of the last 2 games sit the next one out.
export const getRestingPlayers = (recentMatches) => {
    if (recentMatches.length < 2) return []
    const previous = playersOf(recentMatches[1])
    return playersOf(recentMatches[0]).filter(id => previous.includes(id))
}

export const pickWeighted = (items, random = Math.random) => {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
    let roll = random() * totalWeight
    for (const item of items) {
        if (roll < item.weight) return item
        roll -= item.weight
    }
    return items[items.length - 1]
}

// Less recent play = higher weight: 1 / (games in recent matches + 1).
export const getCandidateWeights = (candidates, recentMatches) => {
    const counts = Object.fromEntries(candidates.map(c => [c.id, 0]))
    recentMatches.forEach(m => playersOf(m).forEach(id => {
        if (counts[id] !== undefined) counts[id]++
    }))
    return candidates.map(c => ({ player: c, weight: 1 / (counts[c.id] + 1) }))
}

// `avoidPair` is the pairing just shown, skipped on retry whenever another opponent exists.
export const generatePairing = (candidates, recentMatches, { avoidPair = null, random = Math.random } = {}) => {
    if (candidates.length < 2) return null
    const weighted = getCandidateWeights(candidates, recentMatches)
    const player1 = pickWeighted(weighted, random).player

    let opponents = weighted.filter(c => c.player.id !== player1.id)
    if (avoidPair?.includes(player1.id) && opponents.length > 1) {
        opponents = opponents.filter(c => !avoidPair.includes(c.player.id))
    }

    const lastOpponents = recentMatches.slice(0, 2)
        .filter(m => playersOf(m).includes(player1.id))
        .flatMap(playersOf)
    const player2 = pickWeighted(opponents.map(c => lastOpponents.includes(c.player.id)
        ? { ...c, weight: c.weight * REMATCH_PENALTY }
        : c), random).player

    return [player1, player2]
}
