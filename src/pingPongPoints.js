export const getGameFirstServer = (firstServer, gameIndex = 0) => (
    firstServer == null ? null : gameIndex % 2 === 0 ? firstServer : 3 - firstServer
)

export const getPointServer = (firstServer, score1, score2) => {
    if (firstServer == null) return null
    const total = score1 + score2
    const turn = score1 >= 10 && score2 >= 10 ? total : Math.floor(total / 2)
    return turn % 2 === 0 ? firstServer : 3 - firstServer
}

export const scoreProgression = points => {
    let score1 = 0, score2 = 0
    return points.map((point, index) => {
        const winner = typeof point === 'number' ? point : point?.winner
        if (winner === 1) score1++
        else if (winner === 2) score2++
        return { winner, server: point?.server ?? null, number: index + 1, score1, score2 }
    })
}

export const getServeStats = (matches, playerId) => {
    const serve = { won: 0, total: 0 }
    const receive = { won: 0, total: 0 }
    for (const match of matches) {
        const side = match.player1_id === playerId ? 1 : match.player2_id === playerId ? 2 : null
        if (!side) continue
        for (const point of match.point_history ?? []) {
            if (point?.server !== 1 && point?.server !== 2) continue
            if (point.winner !== 1 && point.winner !== 2) continue
            const stats = point.server === side ? serve : receive
            stats.total++
            if (point.winner === side) stats.won++
        }
    }
    return { serve, receive }
}
