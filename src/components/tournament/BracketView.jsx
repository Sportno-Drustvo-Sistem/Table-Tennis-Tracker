import React from 'react'
import { Trophy, Medal, Star } from 'lucide-react'

// Simple helper to visualize a match node
const MatchNode = ({ match, onMatchClick, readOnly, roundIndex, matchIndex, totalRounds }) => {
    const p1 = match.player1
    const p2 = match.player2
    const winner = match.winner

    const isFinal = roundIndex === totalRounds - 1
    const isSemi = roundIndex === totalRounds - 2

    // Determine styling based on state
    const isClickable = !readOnly && p1 && p2 && !winner
    const isCompleted = !!winner
    const isWaiting = !p1 || !p2

    return (
        <div
            onClick={() => isClickable && onMatchClick(match.id)}
            className={`
        relative flex flex-col justify-center min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-sm border 
        transition-all duration-200
        ${isClickable ? 'cursor-pointer hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500' : ''}
        ${isCompleted ? 'border-green-200 dark:border-green-900/50 bg-green-50/30 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-700'}
        ${isFinal ? 'border-yellow-400 dark:border-yellow-600 ring-4 ring-yellow-100 dark:ring-yellow-900/20' : ''}
        ${isWaiting ? 'opacity-70' : ''}
      `}
        >
            {/* Connector Left (Connection from previous round) */}
            {roundIndex > 0 && (
                <div className="absolute top-1/2 left-0 w-0 h-0 -translate-x-full border-t border-b border-gray-300 dark:border-gray-600" />
            )}

            {/* Connector Right (Connection to next round) */}

            <div className={`p-1 flex flex-col gap-0.5`}>
                {/* Player 1 Slot */}
                <div className={`
          flex items-center justify-between p-2 rounded-md transition-colors
          ${winner && winner.id === p1?.id ? 'bg-green-100 dark:bg-green-900/40 font-bold' : ''}
          ${winner && winner.id !== p1?.id && p1 ? 'opacity-50 grayscale' : ''}
        `}>
                    <div className="flex items-center gap-2 overflow-hidden">
                        {p1 ? (
                            <>
                                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                    {p1.avatar_url && <img src={p1.avatar_url} alt="" className="w-full h-full object-cover" />}
                                </div>
                                <span className={`text-sm truncate ${winner?.id === p1.id ? 'text-green-800 dark:text-green-300' : 'text-gray-900 dark:text-white'}`}>
                                    {p1.name}
                                </span>
                            </>
                        ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500 italic px-2">Waiting...</span>
                        )}
                    </div>
                    {match.score1 !== undefined && match.score1 !== null && (
                        <span className={`text-sm font-mono font-bold ${winner?.id === p1?.id ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}`}>
                            {match.score1}
                        </span>
                    )}
                </div>

                <div className="h-px bg-gray-100 dark:bg-gray-700 mx-2" />

                {/* Player 2 Slot */}
                <div className={`
            flex items-center justify-between p-2 rounded-md transition-colors
            ${winner && winner.id === p2?.id ? 'bg-green-100 dark:bg-green-900/40 font-bold' : ''}
            ${winner && winner.id !== p2?.id && p2 ? 'opacity-50 grayscale' : ''}
          `}>
                    <div className="flex items-center gap-2 overflow-hidden">
                        {p2 ? (
                            <>
                                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                    {p2.avatar_url && <img src={p2.avatar_url} alt="" className="w-full h-full object-cover" />}
                                </div>
                                <span className={`text-sm truncate ${winner?.id === p2.id ? 'text-green-800 dark:text-green-300' : 'text-gray-900 dark:text-white'}`}>
                                    {p2.name}
                                </span>
                            </>
                        ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500 italic px-2">Waiting...</span>
                        )}
                    </div>
                    {match.score2 !== undefined && match.score2 !== null && (
                        <span className={`text-sm font-mono font-bold ${winner?.id === p2?.id ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}`}>
                            {match.score2}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

const BracketView = ({ rounds, onMatchClick, readOnly, title, champion }) => {
    return (
        <div className="overflow-x-auto pb-12 pt-4 hide-scrollbar">
            <div className="min-w-max flex gap-12 px-8">
                {rounds.map((round, rIndex) => (
                    <div key={rIndex} className="flex flex-col justify-around gap-8">
                        <h3 className="text-center text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                            {round.name}
                        </h3>
                        <div className="flex flex-col justify-around flex-grow gap-8">
                            {round.matches.map((match, mIndex) => (
                                <MatchNode
                                    key={match.id}
                                    match={match}
                                    onMatchClick={onMatchClick}
                                    readOnly={readOnly}
                                    roundIndex={rIndex}
                                    matchIndex={mIndex}
                                    totalRounds={rounds.length}
                                />
                            ))}
                        </div>
                    </div>
                ))}

                {champion && (
                    <div className="flex flex-col justify-center items-center pl-8 animate-fade-in">
                        <div className="mb-6 text-center">
                            <div className="inline-block p-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 ring-8 ring-yellow-50 dark:ring-yellow-900/10 mb-4 animate-bounce-slow">
                                <Trophy size={48} className="text-yellow-500" />
                            </div>
                            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">Champion</h2>
                            <p className="text-yellow-600 dark:text-yellow-400 font-bold text-xl">{champion.name}</p>
                            <div className="mt-2 text-xs text-gray-400 uppercase tracking-widest">Victory</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default BracketView
