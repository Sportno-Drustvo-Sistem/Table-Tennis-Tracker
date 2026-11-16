// Types describe the stroke/outcome by the player whose button was pressed.
// Errors belong to the losing player; all other types belong to the winner.
export const POINT_TYPES = [
    { id: 'winner', label: 'Winner', description: 'A winning shot other than a smash or ace.' },
    { id: 'smash', label: 'Smash', description: 'A smash that wins the rally.' },
    { id: 'ace', label: 'Ace', description: 'A serve the receiver does not touch.' },
    { id: 'forced_error', label: 'Forced error', error: true, description: 'An error caused by pressure from the opponent.' },
    { id: 'unforced_error', label: 'Unforced error', error: true, description: 'A missed routine shot.' },
    { id: 'serve_fault', label: 'Serve fault', error: true, description: 'An illegal or missed serve; the receiver wins the point.' },
    { id: 'other', label: 'Other', description: 'Another way of winning, or an unclassified point.' },
]

export const getPointType = type => POINT_TYPES.find(item => item.id === type)

export const getGameFirstServer = (firstServer, gameIndex = 0) => (
    firstServer == null ? null : gameIndex % 2 === 0 ? firstServer : 3 - firstServer
)

export const getPointServer = (firstServer, score1, score2) => {
    if (firstServer == null) return null
    const total = score1 + score2
    const turn = score1 >= 10 && score2 >= 10 ? total : Math.floor(total / 2)
    return turn % 2 === 0 ? firstServer : 3 - firstServer
}

export const createPoint = (actor, type, server) => {
    const definition = getPointType(type)
    if (![1, 2].includes(actor) || ![1, 2].includes(server) || !definition) return null
    if ((type === 'ace' || type === 'serve_fault') && actor !== server) return null
    return { winner: definition.error ? 3 - actor : actor, server, type }
}

export const pointActor = point => getPointType(point.type)?.error ? 3 - point.winner : point.winner

export const scoreProgression = points => {
    let score1 = 0, score2 = 0
    return points.map((point, index) => {
        if (point.winner === 1) score1++
        else score2++
        return { ...point, number: index + 1, score1, score2 }
    })
}

export const emptyPointStats = () => ({
    pointsWon: 0, pointsPlayed: 0, serveWon: 0, servePlayed: 0,
    receiveWon: 0, receivePlayed: 0,
    types: Object.fromEntries(POINT_TYPES.map(type => [type.id, 0])),
})

export const summarizePoints = (points, side) => {
    const stats = emptyPointStats()
    for (const point of points) {
        stats.pointsPlayed++
        if (point.winner === side) stats.pointsWon++
        const phase = point.server === side ? 'serve' : 'receive'
        stats[phase + 'Played']++
        if (point.winner === side) stats[phase + 'Won']++
        if (pointActor(point) === side && getPointType(point.type)) stats.types[point.type]++
    }
    return stats
}

// Missing histories are excluded, never treated as zero-performance games.
export const summarizePlayerPoints = (matches, playerId) => {
    const total = emptyPointStats()
    let trackedGames = 0
    for (const match of matches) {
        if (match.player1_id !== playerId && match.player2_id !== playerId) continue
        if (!match.point_history?.length) continue
        trackedGames++
        const stats = summarizePoints(match.point_history, match.player1_id === playerId ? 1 : 2)
        for (const key of Object.keys(total)) {
            if (key === 'types') {
                for (const type of POINT_TYPES) total.types[type.id] += stats.types[type.id]
            } else total[key] += stats[key]
        }
    }
    return { ...total, trackedGames }
}

export const formatPointRate = (won, played) => played ? `${won}/${played} (${Math.round(won / played * 100)}%)` : '—'
