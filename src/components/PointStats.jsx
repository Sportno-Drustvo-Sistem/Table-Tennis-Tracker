import React from 'react'
import { scoreProgression } from '../pingPongPoints'

const PointStats = ({ games, players }) => {
    return (
        <div className="space-y-4 text-gray-700 dark:text-gray-200">
            {games.map((game, index) => game.points?.length > 0 && (
                <details key={index} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                    <summary className="cursor-pointer text-sm font-bold">Game {index + 1} · Score progression</summary>
                    <ol className="mt-2 max-h-52 overflow-y-auto text-xs space-y-1" aria-label={`Game ${index + 1} score progression`}>
                        {scoreProgression(game.points).map(point => (
                            <li key={point.number} className="flex gap-2 flex-wrap py-1 border-b border-gray-100 dark:border-gray-800">
                                <span className="text-gray-400">#{point.number}</span>
                                <strong className="tabular-nums">{point.score1}–{point.score2}</strong>
                                <span>Point to {players[point.winner - 1]?.name || 'Unknown'}</span>
                                {(point.server === 1 || point.server === 2) && (
                                    <span className="text-gray-500 dark:text-gray-400">· {players[point.server - 1]?.name || 'Unknown'} served</span>
                                )}
                            </li>
                        ))}
                    </ol>
                </details>
            ))}
        </div>
    )
}

export default PointStats
