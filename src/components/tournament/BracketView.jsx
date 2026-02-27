import React, { useState } from 'react'
import { Trophy, RefreshCw, Swords, UserX } from 'lucide-react'

const MatchNode = ({ match, onMatchClick, onManualBye, readOnly, roundIndex, matchIndex, totalRounds }) => {
    const p1 = match.player1
    const p2 = match.player2
    const winner = match.winner
    const isThirdPlace = match.isThirdPlace

    const isClickable = !readOnly
    const isCompleted = !!winner
    const isWaiting = !p1 || !p2
    const hasSinglePlayer = (p1 && !p2) || (!p1 && p2)

    return (
        <div
            className={`
                relative flex flex-col justify-center min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-sm border
                transition-all duration-200
                ${isCompleted ? 'border-green-200 dark:border-green-900/50 bg-green-50/30 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-700'}
                ${isThirdPlace ? 'border-orange-300 dark:border-orange-700 ring-2 ring-orange-100 dark:ring-orange-900/20' : ''}
                ${match.isBye ? 'opacity-50' : ''}
                ${isWaiting && !hasSinglePlayer ? 'opacity-70' : ''}
                ${!isCompleted && isClickable ? 'hover:border-blue-400 dark:hover:border-blue-500' : ''}
            `}
        >
            <div className="p-1 flex flex-col gap-0.5">
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
                            <span className="text-xs text-gray-400 dark:text-gray-500 italic px-2">
                                {match.isBye ? 'BYE' : 'Waiting...'}
                            </span>
                        )}
                    </div>
                    {match.score1 !== undefined && match.score1 !== null && (
                        <span className={`text-sm font-mono font-bold ${winner?.id === p1?.id ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}`}>
                            {match.score1}
                        </span>
                    )}
                </div>

                <div className="h-px bg-gray-100 dark:bg-gray-700 mx-2 flex items-center justify-center">
                    {!isCompleted && isClickable && p1 && p2 && !match.isBye && (
                        <div className="flex bg-white dark:bg-gray-800 px-2 gap-2 z-10">
                            <button
                                onClick={(e) => { e.stopPropagation(); onMatchClick(match.id, false) }}
                                className="p-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 transition-colors border border-blue-200 dark:border-blue-800"
                                title="Record Result"
                            >
                                <RefreshCw size={12} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onMatchClick(match.id, true) }}
                                className="p-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md hover:bg-red-100 transition-colors border border-red-200 dark:border-red-800"
                                title="Live Match"
                            >
                                <Trophy size={12} />
                            </button>
                        </div>
                    )}
                    {/* Manual Bye button: shown when only one player is present and match is not decided */}
                    {!isCompleted && isClickable && hasSinglePlayer && !match.isBye && onManualBye && (
                        <div className="flex bg-white dark:bg-gray-800 px-2 z-10">
                            <button
                                onClick={(e) => { e.stopPropagation(); onManualBye(match.id) }}
                                className="p-1 px-2 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-md hover:bg-orange-100 transition-colors border border-orange-200 dark:border-orange-800 flex items-center gap-1 text-xs font-bold"
                                title="Assign Bye — advance the lone player"
                            >
                                <UserX size={12} />
                                BYE
                            </button>
                        </div>
                    )}
                </div>

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
                            <span className="text-xs text-gray-400 dark:text-gray-500 italic px-2">
                                {match.isBye ? 'BYE' : 'Waiting...'}
                            </span>
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


const RoundColumn = ({ round, rIndex, onMatchClick, onManualBye, readOnly, totalRounds }) => (
    <div className="flex flex-col justify-around gap-8">
        <h3 className="text-center text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
            {round.name}
        </h3>
        <div className="flex flex-col justify-around flex-grow gap-8">
            {round.matches.map((match, mIndex) => (
                <MatchNode
                    key={match.id}
                    match={match}
                    onMatchClick={onMatchClick}
                    onManualBye={onManualBye}
                    readOnly={readOnly}
                    roundIndex={rIndex}
                    matchIndex={mIndex}
                    totalRounds={totalRounds}
                />
            ))}
        </div>
    </div>
)

const BracketView = ({ rounds, onMatchClick, readOnly, champion, format, onManualBye }) => {
    const [activeTab, setActiveTab] = useState('winners')

    if (format === 'double_elim') {
        const winnersRounds = rounds.filter(r => r.bracket === 'winners')
        const losersRounds = rounds.filter(r => r.bracket === 'losers')
        const grandFinal = rounds.filter(r => r.bracket === 'grand_final')

        // Calculate actual indices for onMatchClick
        const getActualIndex = (round) => rounds.indexOf(round)

        return (
            <div className="flex flex-col h-full">
                {/* Tab Switcher */}
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg m-4 gap-1">
                    {['winners', 'losers', 'finals'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all capitalize ${activeTab === tab
                                ? tab === 'winners' ? 'bg-blue-500 text-white' : tab === 'losers' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >
                            {tab === 'finals' ? '🏆 Grand Final' : tab === 'winners' ? '🔵 Winners' : '🔴 Losers'}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-x-auto pb-12 pt-4 hide-scrollbar">
                    <div className="min-w-max flex gap-12 px-8">
                        {activeTab === 'winners' && winnersRounds.map((round, rIndex) => (
                            <RoundColumn key={rIndex} round={round} rIndex={getActualIndex(round)}
                                onMatchClick={onMatchClick} onManualBye={onManualBye} readOnly={readOnly} totalRounds={rounds.length} />
                        ))}
                        {activeTab === 'losers' && losersRounds.map((round, rIndex) => (
                            <RoundColumn key={rIndex} round={round} rIndex={getActualIndex(round)}
                                onMatchClick={onMatchClick} onManualBye={onManualBye} readOnly={readOnly} totalRounds={rounds.length} />
                        ))}
                        {activeTab === 'finals' && (
                            <>
                                {grandFinal.map((round, rIndex) => (
                                    <RoundColumn key={rIndex} round={round} rIndex={getActualIndex(round)}
                                        onMatchClick={onMatchClick} onManualBye={onManualBye} readOnly={readOnly} totalRounds={rounds.length} />
                                ))}
                                {champion && <ChampionDisplay champion={champion} />}
                            </>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // Single Elimination layout
    const bracketRounds = rounds.filter(r => r.name !== '3rd Place Match')
    const thirdPlaceRound = rounds.find(r => r.name === '3rd Place Match')

    // Hide rounds where ALL matches are byes (e.g. entirely-bye round)
    const visibleRounds = bracketRounds.filter(round =>
        !round.matches.every(m => m.isBye)
    )
    // In mixed rounds (some byes, some real), hide the bye-only matches for cleaner display
    const cleanedRounds = visibleRounds.map(round => {
        const realMatches = round.matches.filter(m => !m.isBye)
        if (realMatches.length > 0 && realMatches.length < round.matches.length) {
            return { ...round, matches: realMatches }
        }
        return round
    })

    return (
        <div className="overflow-x-auto pb-12 pt-4 hide-scrollbar">
            <div className="min-w-max flex gap-12 px-8">
                {cleanedRounds.map((round, rIndex) => {
                    const actualIdx = rounds.indexOf(round)
                    return (
                        <RoundColumn key={rIndex} round={round} rIndex={actualIdx}
                            onMatchClick={onMatchClick} onManualBye={onManualBye} readOnly={readOnly} totalRounds={rounds.length} />
                    )
                })}

                {/* Champion + 3rd Place Column */}
                <div className="flex flex-col justify-center gap-8">
                    {champion && <ChampionDisplay champion={champion} />}

                    {thirdPlaceRound && (
                        <div className="flex flex-col items-center">
                            <h3 className="text-center text-sm font-bold text-orange-400 uppercase tracking-wider mb-4">
                                3rd Place Match
                            </h3>
                            {thirdPlaceRound.matches.map((match, mIndex) => (
                                <MatchNode key={match.id} match={match}
                                    onMatchClick={onMatchClick} onManualBye={onManualBye} readOnly={readOnly}
                                    roundIndex={rounds.indexOf(thirdPlaceRound)}
                                    matchIndex={mIndex} totalRounds={rounds.length} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

const ChampionDisplay = ({ champion }) => (
    <div className="flex flex-col justify-center items-center pl-4 animate-fade-in">
        <div className="mb-4 text-center">
            <div className="inline-block p-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 ring-8 ring-yellow-50 dark:ring-yellow-900/10 mb-4 animate-bounce-slow">
                <Trophy size={48} className="text-yellow-500" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">Champion</h2>
            <p className="text-yellow-600 dark:text-yellow-400 font-bold text-xl">{champion.name}</p>
            <div className="mt-2 text-xs text-gray-400 uppercase tracking-widest">Victory</div>
        </div>
    </div>
)

export default BracketView

