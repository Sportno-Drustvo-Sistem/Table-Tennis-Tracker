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
    return points.map((winner, index) => {
        // Read legacy rows during rollout; new rows store only the point winner.
        const pointWinner = typeof winner === 'object' ? winner?.winner : winner
        if (pointWinner === 1) score1++
        else if (pointWinner === 2) score2++
        return { winner: pointWinner, number: index + 1, score1, score2 }
    })
}
