import React, { useEffect, useMemo, useState } from 'react'
import { Calendar, Check, CheckSquare, Edit2, ListChecks, MinusSquare, RefreshCw, Search, Square, Trash2, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { buildTennisEloHistory, getTennisScoreSummary, recalculateTennisStats } from '../tennisUtils'
import { getAvatarFallback } from '../utils'
import { useToast } from '../contexts/useToast'

const TennisMatches = ({ matches, users, onEditMatch, onMatchDeleted, isAdmin }) => {
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
            const p1 = users.find(user => user.id === match.player1_id)
            const p2 = users.find(user => user.id === match.player2_id)
            return p1?.name?.toLowerCase().includes(query) || p2?.name?.toLowerCase().includes(query)
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

    const matchEloData = useMemo(() => {
        if (!matches?.length || !users?.length) return {}
        const { matchHistory } = buildTennisEloHistory(users, matches)
        const eloMap = {}
        matchHistory.forEach(match => {
            eloMap[match.matchId] = {
                p1Elo: Math.round(match.p1EloAfter),
                p1Change: Math.round(match.p1Change),
                p2Elo: Math.round(match.p2EloAfter),
                p2Change: Math.round(match.p2Change),
            }
        })
        return eloMap
    }, [matches, users])

    const getPlayerInfo = (playerId) => users.find(user => user.id === playerId) || { id: playerId, name: 'Unknown', avatar_url: null }

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        setSelectedIds(allFilteredSelected ? new Set() : new Set(filteredMatchIds))
    }

    const handleBulkDelete = async () => {
        if (!selectedFilteredIds.length) return
        setLoading(true)
        setBulkDeleteConfirm(false)
        try {
            const { error } = await supabase.from('tennis_matches').delete().in('id', selectedFilteredIds)
            if (error) throw error
            await recalculateTennisStats()
            setSelectedIds(new Set())
            setIsBulkMode(false)
            onMatchDeleted?.()
        } catch (error) {
            showToast('Error deleting tennis matches: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleRecalculate = async () => {
        setRecalculating(true)
        try {
            await recalculateTennisStats()
            onMatchDeleted?.()
        } catch (error) {
            console.error(error)
            showToast('Error recalculating tennis stats', 'error')
        } finally {
            setRecalculating(false)
        }
    }

    const handleDeleteConfirm = async (match) => {
        setLoading(true)
        setConfirmDeleteId(null)
        try {
            const { error } = await supabase.from('tennis_matches').delete().eq('id', match.id)
            if (error) throw error
            await recalculateTennisStats()
            onMatchDeleted?.()
        } catch (error) {
            showToast('Error deleting tennis match: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const EloChangeDisplay = ({ elo, change }) => (
        <div className="text-xs mt-0.5">
            <span className="text-gray-500 dark:text-gray-400">{elo}</span>{' '}
            <span className={change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                ({change > 0 ? '+' : ''}{change})
            </span>
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end gap-3 flex-wrap">
                <h2 className="text-2xl font-bold flex items-center text-gray-900 dark:text-white">
                    <Calendar className="mr-2 text-emerald-500" /> Tennis Matches
                </h2>
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by player..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none text-gray-700 dark:text-gray-200"
                    />
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                    {isAdmin && (
                        <button
                            onClick={() => { setIsBulkMode(!isBulkMode); setSelectedIds(new Set()); setBulkDeleteConfirm(false) }}
                            className={`flex items-center text-sm font-bold transition-colors px-3 py-2 rounded-lg ${isBulkMode ? 'bg-emerald-600 text-white shadow-inner' : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30'}`}
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
                        <div className="mb-4 flex justify-center text-emerald-500"><Calendar size={64} /></div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{matches.length === 0 ? 'No tennis matches recorded yet' : 'No matches found'}</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">{matches.length === 0 ? 'Record a tennis match to get started.' : 'Try a different player name.'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {isAdmin && isBulkMode && (
                                        <th className="px-2 sm:px-3 py-3 sm:py-4 w-8 sm:w-10">
                                            <button onClick={toggleSelectAll} className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                                {allFilteredSelected ? <CheckSquare size={16} /> : hasFilteredSelection ? <MinusSquare size={16} /> : <Square size={16} />}
                                            </button>
                                        </th>
                                    )}
                                    <th className="px-2 sm:px-6 py-3 sm:py-4 text-right">Player 1</th>
                                    <th className="px-1 sm:px-6 py-3 sm:py-4 text-center">Score</th>
                                    <th className="px-2 sm:px-6 py-3 sm:py-4">Player 2</th>
                                    <th className="px-2 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">Date</th>
                                    <th className="px-2 sm:px-6 py-3 sm:py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredMatches.map(match => {
                                    const player1 = getPlayerInfo(match.player1_id)
                                    const player2 = getPlayerInfo(match.player2_id)
                                    const summary = getTennisScoreSummary(match)
                                    const matchDate = new Date(match.created_at)
                                    const eloData = matchEloData[match.id]
                                    const isSelected = selectedIds.has(match.id)
                                    return (
                                        <tr key={match.id} className={`transition-colors text-sm ${isSelected ? 'bg-red-50/50 dark:bg-red-900/10' : 'hover:bg-emerald-50 dark:hover:bg-gray-700'}`}>
                                            {isAdmin && isBulkMode && (
                                                <td className="px-2 sm:px-3 py-3 sm:py-4">
                                                    <button onClick={() => toggleSelect(match.id)} className={isSelected ? 'text-red-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500'}>
                                                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                                    </button>
                                                </td>
                                            )}
                                            <td className="px-2 sm:px-6 py-3 sm:py-4">
                                                <div className="flex items-center justify-end gap-3">
                                                    <div className="text-right flex flex-col items-end">
                                                        <span className={`font-bold truncate max-w-[80px] sm:max-w-none ${summary.winner === 1 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{player1.name}</span>
                                                        {eloData && <EloChangeDisplay elo={eloData.p1Elo} change={eloData.p1Change} />}
                                                    </div>
                                                    <img src={player1.avatar_url || getAvatarFallback(player1.name)} className="hidden sm:block w-8 h-8 rounded-full bg-gray-200 object-cover" alt={player1.name} />
                                                </div>
                                            </td>
                                            <td className="px-1 sm:px-6 py-3 sm:py-4">
                                                <div className="flex flex-col items-center">
                                                    <div className="flex items-center justify-center space-x-2 font-mono font-bold text-lg sm:text-xl text-gray-900 dark:text-white whitespace-nowrap pb-1">
                                                        <span className={summary.winner === 1 ? 'text-emerald-600 dark:text-emerald-400' : ''}>{summary.hasSets ? summary.player1Sets : summary.player1Games}</span>
                                                        <span className="text-gray-400">-</span>
                                                        <span className={summary.winner === 2 ? 'text-emerald-600 dark:text-emerald-400' : ''}>{summary.hasSets ? summary.player2Sets : summary.player2Games}</span>
                                                    </div>
                                                    {summary.sets.length > 0 && (
                                                        <div className="flex space-x-1 sm:space-x-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                            {summary.sets.map((set, idx) => (
                                                                <span key={idx} className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                                                    {set.player1Games}-{set.player2Games}{set.player1Games === 7 && set.player2Games === 6 ? ` (${set.player1Tiebreak}-${set.player2Tiebreak})` : ''}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-2 sm:px-6 py-3 sm:py-4">
                                                <div className="flex items-center gap-3">
                                                    <img src={player2.avatar_url || getAvatarFallback(player2.name)} className="hidden sm:block w-8 h-8 rounded-full bg-gray-200 object-cover" alt={player2.name} />
                                                    <div className="flex flex-col items-start">
                                                        <span className={`font-bold truncate max-w-[80px] sm:max-w-none ${summary.winner === 2 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{player2.name}</span>
                                                        {eloData && <EloChangeDisplay elo={eloData.p2Elo} change={eloData.p2Change} />}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-2 sm:px-6 py-3 sm:py-4 text-gray-600 dark:text-gray-400 font-mono text-[9px] sm:text-sm whitespace-nowrap hidden sm:table-cell">
                                                {matchDate.toLocaleDateString()} {matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-2 sm:px-6 py-3 sm:py-4">
                                                <div className="flex justify-center items-center space-x-1">
                                                    {confirmDeleteId === match.id ? (
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => handleDeleteConfirm(match)} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 text-white"><Check size={16} /></button>
                                                            <button onClick={() => setConfirmDeleteId(null)} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200"><X size={16} /></button>
                                                        </div>
                                                    ) : isAdmin ? (
                                                        <>
                                                            <button onClick={() => onEditMatch(match)} className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 min-w-[44px] min-h-[44px] flex items-center justify-center" disabled={loading}>
                                                                <Edit2 size={18} />
                                                            </button>
                                                            {!isBulkMode && (
                                                                <button onClick={() => setConfirmDeleteId(match.id)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 min-w-[44px] min-h-[44px] flex items-center justify-center" disabled={loading}>
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-400 dark:text-gray-600 text-xs italic">Read-only</span>
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

export default TennisMatches
