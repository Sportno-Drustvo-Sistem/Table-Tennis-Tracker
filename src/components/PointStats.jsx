import React from 'react'
import { POINT_TYPES, formatPointRate, pointActor, scoreProgression, summarizePoints } from '../pingPongPoints'

export const PlayerPointStats = ({ stats }) => (
    <dl className="text-xs space-y-1 tabular-nums">
        {[
            ['Points won', `${stats.pointsWon}/${stats.pointsPlayed}`],
            ['On serve', formatPointRate(stats.serveWon, stats.servePlayed)],
            ['On receive', formatPointRate(stats.receiveWon, stats.receivePlayed)],
            ...POINT_TYPES.map(type => [type.label, stats.types[type.id]]),
        ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-bold">{value}</dd></div>
        ))}
    </dl>
)

const PointStats = ({ games, players }) => {
    const points = games.flatMap(game => game.points || [])
    return (
        <div className="space-y-4 text-gray-700 dark:text-gray-200">
            <div className="grid grid-cols-2 gap-4">
                {players.map((player, index) => (
                    <div key={player.id} className="min-w-0">
                        <h4 className={`font-bold text-sm break-words mb-2 ${index === 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>{player.name}</h4>
                        <PlayerPointStats stats={summarizePoints(points, index + 1)} />
                    </div>
                ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Errors are counted against the player who made them. Each rally has one outcome; smashes and aces are separate from other winners.</p>
            {games.map((game, index) => game.points?.length > 0 && (
                <details key={index} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                    <summary className="cursor-pointer text-sm font-bold">Game {index + 1} · Score progression</summary>
                    <ol className="mt-2 max-h-52 overflow-y-auto text-xs space-y-1" aria-label={`Game ${index + 1} score progression`}>
                        {scoreProgression(game.points).map(point => (
                            <li key={point.number} className="flex gap-2 flex-wrap py-1 border-b border-gray-100 dark:border-gray-800">
                                <span className="text-gray-400">#{point.number}</span>
                                <strong className="tabular-nums">{point.score1}–{point.score2}</strong>
                                <span>{players[pointActor(point) - 1].name} · {POINT_TYPES.find(type => type.id === point.type)?.label}</span>
                                <span className="text-gray-500 dark:text-gray-400">{players[point.server - 1].name} served · Point to {players[point.winner - 1].name}</span>
                            </li>
                        ))}
                    </ol>
                </details>
            ))}
        </div>
    )
}

export default PointStats
