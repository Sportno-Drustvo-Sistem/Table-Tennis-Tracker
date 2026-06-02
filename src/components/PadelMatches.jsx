import React, { useState, useMemo, useEffect } from 'react'
import { Edit2, Trash2, Calendar, RefreshCw, Check, X, CheckSquare, Square, MinusSquare, ListChecks, Search } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { buildPadelEloHistory, getPadelScoreSummary, recalculatePadelStats } from '../padelUtils'
import { getAvatarFallback } from '../utils'
import { useToast } from '../contexts/ToastContext'
import { TennisIcon } from './Icons'

const PadelMatches = ({ matches, users, onEditMatch, onMatchDeleted, isAdmin }) => {
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [recalculating, setRecalculating] = useState(false)
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
    const [isBulkMode, setIsBulkMode] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    const filteredMatches = useMemo(() => {
        if (!searchQuery.trim()) return matches
        const query = searchQuery.toLowerCase()
        return matches.filter(match => {
            const playerIds = [
                match.team1_player1_id,
                match.team1_player2_id,
                match.team2_player1_id,
                match.team2_player2_id,
            ]
            return playerIds.some(id => users.find(user => user.id === id)?.name?.toLowerCase().includes(query))
        })
    }, [matches, searchQuery, users])

    const filteredMatchIds = useMemo(() => filteredMatches.map(match => match.id), [filteredMatches])
    const selectedFilteredIds = useMemo(
        () => filteredMatchIds.filter(id => selectedIds.has(id)),
        [filteredMatchIds, selectedIds]
    )
    const allFilteredSelected = filteredMatches.length > 0 && selectedFilteredIds.length === filteredMatches.length
    const hasFilteredSelection = selectedFilteredIds.length > 0

    useEffect(() => {
        setSelectedIds(new Set())
        setBulkDeleteConfirm(false)
    }, [searchQuery])

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (allFilteredSelected) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredMatchIds))
        }
    }

    const handleBulkDelete = async () => {
        if (selectedFilteredIds.length === 0) return
        setLoading(true)
        setBulkDeleteConfirm(false)
        try {
            const { error } = await supabase.from('padel_matches').delete().in('id', selectedFilteredIds)
            if (error) throw error

            await recalculatePadelStats()
            setSelectedIds(new Set())
            setIsBulkMode(false)
            if (onMatchDeleted) onMatchDeleted()
        } catch (error) {
            showToast('Error deleting padel matches: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    // Compute ELO ratings and changes for every padel match
    const matchEloData = useMemo(() => {
        if (!matches || !users || matches.length === 0 || users.length === 0) return {}
        const { playerEloTimelines } = buildPadelEloHistory(users, matches)
        const eloMap = {}
        Object.entries(playerEloTimelines).forEach(([playerId, timeline]) => {
            timeline.forEach(point => {
                if (!point.matchId) return
                if (!eloMap[point.matchId]) eloMap[point.matchId] = {}
                eloMap[point.matchId][playerId] = {
                    elo: Math.round(point.elo),
                    change: Math.round(point.change),
                }
            })
        })
        return eloMap
    }, [matches, users])

    const handleRecalculate = async () => {
        setRecalculating(true)
        try {
            await recalculatePadelStats()
            if (onMatchDeleted) onMatchDeleted()
        } catch (error) {
            console.error(error)
            showToast('Error recalculating padel stats', 'error')
        } finally {
            setRecalculating(false)
        }
    }

    const handleDeleteRequest = (matchId) => {
        setConfirmDeleteId(matchId)
    }

    const handleDeleteConfirm = async (match) => {
        setLoading(true)
        setConfirmDeleteId(null)
        try {
            const { error } = await supabase.from('padel_matches').delete().eq('id', match.id)
            if (error) throw error

            await recalculatePadelStats()
            if (onMatchDeleted) onMatchDeleted()
        } catch (error) {
            showToast('Error deleting match: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteCancel = () => {
        setConfirmDeleteId(null)
    }

    const getPlayerInfo = (playerId) => {
        return users.find(u => u.id === playerId) || { id: playerId, name: 'Unknown', avatar_url: null }
    }

    const EloChangeDisplay = ({ elo, change }) => {
        const isPositive = change > 0
        const changeColor = isPositive
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-500 dark:text-red-400'
        const sign = isPositive ? '+' : ''

        return (
            <div className="text-xs mt-0.5">
                <span className="text-gray-500 dark:text-gray-400">{elo}</span>
                {' '}
                <span className={changeColor}>
                    ({sign}{change})
                </span>
            </div>
        )
    }

    const TeamDisplay = ({ player1, player2, eloData, align = 'left' }) => {
        const isRight = align === 'right'
        return (
            <div className={`flex flex-col gap-1 ${isRight ? 'items-end' : 'items-start'}`}>
                {[player1, player2].map((player, i) => {
                    const playerElo = eloData?.[player.id]
                    return (
                        <div key={i} className={`flex items-center gap-2 ${isRight ? 'flex-row-reverse' : ''}`}>
                            <img src={player.avatar_url || getAvatarFallback(player.name)} className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 object-cover" alt={player.name} />
                            <div className={isRight ? 'text-right' : ''}>
                                <span className="font-bold text-sm text-gray-900 dark:text-white">{player.name}</span>
                                {playerElo && <EloChangeDisplay elo={playerElo.elo} change={playerElo.change} />}
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end gap-3 flex-wrap">
                <h2 className="text-2xl font-bold flex items-center text-gray-900 dark:text-white">
                    <Calendar className="mr-2 text-green-500" /> Padel Matches
                </h2>
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by player..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-green-400 outline-none text-gray-700 dark:text-gray-200"
                    />
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                    {isAdmin && (
                        <button
                            onClick={() => { setIsBulkMode(!isBulkMode); setSelectedIds(new Set()); setBulkDeleteConfirm(false) }}
                            className={`flex items-center text-sm font-bold transition-colors px-3 py-2 rounded-lg ${isBulkMode ? 'bg-green-600 text-white shadow-inner' : 'text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 bg-green-50 dark:bg-green-900/30'}`}
                            title="Toggle Bulk Actions"
                        >
                            <ListChecks size={16} className="mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Bulk Actions</span>
                            <span className="sm:hidden">Bulk</span>
                        </button>
                    )}
                    <button
                        onClick={handleRecalculate}
                        disabled={recalculating}
                        className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg disabled:opacity-50"
                        title="Recalculate ELO and Stats"
                    >
                        <RefreshCw size={16} className={`mr-1 sm:mr-2 ${recalculating ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">{recalculating ? 'Recalculating...' : 'Sync'}</span>
                        <span className="sm:hidden">{recalculating ? '...' : 'Sync'}</span>
                    </button>
                </div>
            </div>

            {isBulkMode && isAdmin && (
                <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4 animate-fade-in">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-red-700 dark:text-red-300">
                            {selectedFilteredIds.length} match{selectedFilteredIds.length === 1 ? '' : 'es'} selected
                        </span>
                        <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline">
                            Clear selection
                        </button>
                    </div>
                    {bulkDeleteConfirm ? (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-red-600 dark:text-red-400 font-bold">Are you sure?</span>
                            <button onClick={handleBulkDelete} disabled={loading || !hasFilteredSelection} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-sm disabled:opacity-50 flex items-center gap-1">
                                <Trash2 size={14} /> {loading ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                            <button onClick={() => setBulkDeleteConfirm(false)} className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 font-bold text-sm">
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setBulkDeleteConfirm(true)} disabled={!hasFilteredSelection} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-sm flex items-center gap-2 disabled:opacity-50">
                            <Trash2 size={14} /> Delete Selected
                        </button>
                    )}
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {filteredMatches.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                        {matches.length === 0 ? (
                            <>
                                <div className="mb-4 flex justify-center text-green-500"><TennisIcon size={64} /></div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white">No padel matches recorded yet</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6">Record a match to get started.</p>
                            </>
                        ) : (
                            <>
                                <div className="mb-4 flex justify-center text-gray-400"><Search size={48} /></div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white">No matches found</h3>
                                <p className="text-gray-500 dark:text-gray-400">Try a different player name.</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {isAdmin && isBulkMode && (
                                        <th className="px-2 sm:px-3 py-3 sm:py-4 w-8 sm:w-10">
                                            <button onClick={toggleSelectAll} className="text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                                                {allFilteredSelected ? <CheckSquare size={16} className="sm:w-[18px] sm:h-[18px]" /> : hasFilteredSelection ? <MinusSquare size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Square size={16} className="sm:w-[18px] sm:h-[18px]" />}
                                            </button>
                                        </th>
                                    )}
                                    <th className="px-2 sm:px-6 py-3 sm:py-4 text-right">Team 1</th>
                                    <th className="px-1 sm:px-6 py-3 sm:py-4 text-center">Score</th>
                                    <th className="px-2 sm:px-6 py-3 sm:py-4">Team 2</th>
                                    <th className="px-2 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">Date</th>
                                    <th className="px-2 sm:px-6 py-3 sm:py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredMatches.map(match => {
                                    const t1p1 = getPlayerInfo(match.team1_player1_id)
                                    const t1p2 = getPlayerInfo(match.team1_player2_id)
                                    const t2p1 = getPlayerInfo(match.team2_player1_id)
                                    const t2p2 = getPlayerInfo(match.team2_player2_id)
                                    const matchDate = new Date(match.created_at)
                                    const eloData = matchEloData[match.id]
                                    const summary = getPadelScoreSummary(match)
                                    const isSelected = selectedIds.has(match.id)

                                    return (
                                        <tr key={match.id} className={`transition-colors text-sm ${isSelected ? 'bg-red-50/50 dark:bg-red-900/10' : 'hover:bg-green-50 dark:hover:bg-gray-700'}`}>
                                            {isAdmin && isBulkMode && (
                                                <td className="px-2 sm:px-3 py-3 sm:py-4">
                                                    <button onClick={() => toggleSelect(match.id)} className={`transition-colors ${isSelected ? 'text-red-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'}`}>
                                                        {isSelected ? <CheckSquare size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Square size={16} className="sm:w-[18px] sm:h-[18px]" />}
                                                    </button>
                                                </td>
                                            )}
                                            <td className="px-2 sm:px-6 py-3 sm:py-4">
                                                <TeamDisplay
                                                    player1={t1p1}
                                                    player2={t1p2}
                                                    eloData={eloData}
                                                    align="right"
                                                />
                                            </td>
                                            <td className="px-1 sm:px-6 py-3 sm:py-4">
                                                <div className="flex flex-col items-center">
                                                    <div className="flex items-center justify-center space-x-1 sm:space-x-2 font-mono font-bold text-lg sm:text-xl text-gray-900 dark:text-white whitespace-nowrap pb-1">
                                                        <span className={summary.winner === 1 ? 'text-green-600 dark:text-green-400' : ''}>{summary.hasSets && summary.sets.length > 1 ? summary.team1Sets : summary.team1Games}</span>
                                                        <span className="text-gray-400">-</span>
                                                        <span className={summary.winner === 2 ? 'text-green-600 dark:text-green-400' : ''}>{summary.hasSets && summary.sets.length > 1 ? summary.team2Sets : summary.team2Games}</span>
                                                    </div>
                                                    {summary.sets.length > 1 && (
                                                        <div className="flex space-x-1 sm:space-x-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                            {summary.sets.map((set, idx) => (
                                                                <span key={idx} className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                                                    {set.team1Games}-{set.team2Games}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-2 sm:px-6 py-3 sm:py-4">
                                                <TeamDisplay
                                                    player1={t2p1}
                                                    player2={t2p2}
                                                    eloData={eloData}
                                                    align="left"
                                                />
                                            </td>
                                            <td className="px-2 sm:px-6 py-3 sm:py-4 text-gray-600 dark:text-gray-400 font-mono text-[9px] sm:text-sm whitespace-nowrap hidden sm:table-cell">
                                                {matchDate.toLocaleDateString()} {matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-2 sm:px-6 py-3 sm:py-4">
                                                <div className="flex justify-center items-center space-x-1">
                                                    {confirmDeleteId === match.id ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Delete?</span>
                                                            <button
                                                                onClick={() => handleDeleteConfirm(match)}
                                                                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                                                                title="Confirm Delete"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                            <button
                                                                onClick={handleDeleteCancel}
                                                                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 transition-colors"
                                                                title="Cancel"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {isAdmin && (
                                                                <>
                                                                    <button
                                                                        onClick={() => onEditMatch(match)}
                                                                        className="text-gray-400 hover:text-green-600 dark:hover:text-green-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                                                        title="Edit Match"
                                                                        disabled={loading}
                                                                    >
                                                                        <Edit2 size={18} />
                                                                    </button>
                                                                    {!isBulkMode && (
                                                                        <button
                                                                            onClick={() => handleDeleteRequest(match.id)}
                                                                            className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 min-w-[36px] sm:min-w-[44px] min-h-[36px] sm:min-h-[44px] flex items-center justify-center p-1 sm:p-2"
                                                                            title="Delete Match"
                                                                            disabled={loading}
                                                                        >
                                                                            <Trash2 size={18} />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                            {!isAdmin && <span className="text-gray-400 dark:text-gray-600 text-xs italic">Read-only</span>}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

export default PadelMatches
