import React, { useState, useMemo } from 'react'
import { Edit2, Trash2, Calendar, RefreshCw, Scale, Check, X, CheckSquare, Square, MinusSquare, ListChecks, Search, Skull } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../supabaseClient'
import { recalculatePlayerStats, buildEloHistory, getAvatarFallback } from '../utils'
import { PingPongIcon } from './Icons'

const Matches = ({ matches, users, onEditMatch, onMatchDeleted, onGenerateMatch, isAdmin }) => {
    const [loading, setLoading] = useState(false)
    const [recalculating, setRecalculating] = useState(false)
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
    const [isBulkMode, setIsBulkMode] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const { showToast } = useToast()

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === matches.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(matches.map(m => m.id)))
        }
    }

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return
        setLoading(true)
        setBulkDeleteConfirm(false)
        try {
            const ids = [...selectedIds]
            const { error } = await supabase.from('matches').delete().in('id', ids)
            if (error) throw error

            await recalculatePlayerStats()
            setSelectedIds(new Set())
            setIsBulkMode(false)
            if (onMatchDeleted) onMatchDeleted()
        } catch (error) {
            showToast('Error deleting matches: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    // Use shared buildEloHistory to avoid duplicating the ELO simulation logic
    const matchEloData = useMemo(() => {
        if (!matches || !users || matches.length === 0 || users.length === 0) return {}
        const { matchHistory } = buildEloHistory(users, matches)
        const eloMap = {}
        matchHistory.forEach(m => {
            eloMap[m.matchId] = {
                p1Elo: m.p1EloAfter,
                p1Change: m.p1Change,
                p2Elo: m.p2EloAfter,
                p2Change: m.p2Change,
            }
        })
        return eloMap
    }, [matches, users])

    const handleRecalculate = async () => {
        setRecalculating(true)
        try {
            await recalculatePlayerStats()
            if (onMatchDeleted) onMatchDeleted()
        } catch (error) {
            console.error('Error recalculating stats:', error)
            showToast('Error recalculating stats', 'error')
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
            const { error } = await supabase.from('matches').delete().eq('id', match.id)
            if (error) throw error

            await recalculatePlayerStats()

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
        const user = users.find(u => u.id === playerId)
        return user || { name: 'Unknown', avatar_url: null }
    }

    // Filter matches by search query (player name)
    const filteredMatches = useMemo(() => {
        if (!searchQuery.trim()) return matches
        const q = searchQuery.toLowerCase()
        return matches.filter(m => {
            const p1 = users.find(u => u.id === m.player1_id)
            const p2 = users.find(u => u.id === m.player2_id)
            return (p1?.name?.toLowerCase().includes(q)) || (p2?.name?.toLowerCase().includes(q))
        })
    }, [matches, users, searchQuery])

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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end gap-3 flex-wrap">
                <h2 className="text-2xl font-bold flex items-center text-gray-900 dark:text-white">
                    <Calendar className="mr-2 text-blue-500" /> Matches
                </h2>
                {/* Search bar */}
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by player…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-gray-700 dark:text-gray-200"
                    />
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                    {isAdmin && (
                        <button
                            onClick={() => { setIsBulkMode(!isBulkMode); setSelectedIds(new Set()); setBulkDeleteConfirm(false) }}
                            className={`flex items-center text-sm font-bold transition-colors px-3 py-2 rounded-lg ${isBulkMode ? 'bg-blue-600 text-white shadow-inner' : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30'}`}
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

            {/* Bulk Delete Action Bar */}
            {isBulkMode && isAdmin && (
                <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4 animate-fade-in">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-red-700 dark:text-red-300">
                            {selectedIds.size} match{selectedIds.size > 1 ? 'es' : ''} selected
                        </span>
                        <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline">
                            Clear selection
                        </button>
                    </div>
                    {bulkDeleteConfirm ? (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-red-600 dark:text-red-400 font-bold">Are you sure?</span>
                            <button onClick={handleBulkDelete} disabled={loading}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-sm disabled:opacity-50 flex items-center gap-1">
                                <Trash2 size={14} /> {loading ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                            <button onClick={() => setBulkDeleteConfirm(false)}
                                className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 font-bold text-sm">
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setBulkDeleteConfirm(true)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-sm flex items-center gap-2">
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
                                <div className="mb-4 flex justify-center text-blue-500"><PingPongIcon size={64} /></div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white">No matches recorded yet</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6">Click &quot;New Match&quot; to get started!</p>
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
                                            <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                                {selectedIds.size === filteredMatches.length && filteredMatches.length > 0 ? <CheckSquare size={16} className="sm:w-[18px] sm:h-[18px]" /> : selectedIds.size > 0 ? <MinusSquare size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Square size={16} className="sm:w-[18px] sm:h-[18px]" />}
                                            </button>
                                        </th>
                                    )}
                                    <th className="px-2 sm:px-6 py-3 sm:py-4 text-right">P1</th>
                                    <th className="px-1 sm:px-6 py-3 sm:py-4 text-center">Score</th>
                                    <th className="px-2 sm:px-6 py-3 sm:py-4 text-left">P2</th>
                                    <th className="px-2 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">Date</th>
                                    <th className="px-2 sm:px-6 py-3 sm:py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredMatches.map(match => {
                                    const player1 = getPlayerInfo(match.player1_id)
                                    const player2 = getPlayerInfo(match.player2_id)
                                    const matchDate = new Date(match.created_at)
                                    const eloData = matchEloData[match.id]

                                    const isSelected = selectedIds.has(match.id)
                                    return (
                                        <tr key={match.id} className={`transition-colors text-sm ${isSelected ? 'bg-red-50/50 dark:bg-red-900/10' : 'hover:bg-blue-50 dark:hover:bg-gray-700'}`}>
                                            {isAdmin && isBulkMode && (
                                                <td className="px-2 sm:px-3 py-3 sm:py-4">
                                                    <button onClick={() => toggleSelect(match.id)} className={`transition-colors ${isSelected ? 'text-red-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'}`}>
                                                        {isSelected ? <CheckSquare size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Square size={16} className="sm:w-[18px] sm:h-[18px]" />}
                                                    </button>
                                                </td>
                                            )}
                                            <td className="px-2 sm:px-6 py-3 sm:py-4">
                                                <div className="flex items-center justify-end space-x-2 sm:space-x-3">
                                                    <div className="text-right flex flex-col items-end">
                                                        <span className={`font-bold truncate max-w-[70px] sm:max-w-[none] ${match.score1 > match.score2 ? 'text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                                            {player1.name}
                                                        </span>
                                                        {eloData && (
                                                            <EloChangeDisplay elo={eloData.p1Elo} change={eloData.p1Change} />
                                                        )}
                                                    </div>
                                                    <img src={player1.avatar_url || getAvatarFallback(player1.name)} className="hidden sm:block w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 object-cover" alt={player1.name} />
                                                </div>
                                            </td>
                                            <td className="px-1 sm:px-6 py-3 sm:py-4">
                                                <div className="flex flex-col items-center">
                                                    <div className="flex items-center justify-center space-x-1 sm:space-x-2 font-mono font-bold text-lg sm:text-xl text-gray-900 dark:text-white whitespace-nowrap">
                                                        <span className={match.score1 > match.score2 ? 'text-green-600 dark:text-green-400' : ''}>{match.score1}</span>
                                                        <span className="text-gray-400">-</span>
                                                        <span className={match.score2 > match.score1 ? 'text-green-600 dark:text-green-400' : ''}>{match.score2}</span>
                                                    </div>
                                                    {match.handicap_rule && (
                                                        <div className="mt-1 flex flex-col gap-1 items-center">
                                                            {(Array.isArray(match.handicap_rule) ? match.handicap_rule : [match.handicap_rule]).map((rule, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className={`flex items-center text-xs px-2 py-0.5 rounded-full cursor-help ${rule.type === 'mayhem'
                                                                        ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30'
                                                                        : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30'
                                                                        }`}
                                                                    title={`${rule.targetPlayerName ? rule.targetPlayerName + ': ' : ''}${rule.title}: ${rule.description}`}
                                                                >
                                                                    {rule.type === 'mayhem' ? <Skull size={12} className="mr-1" /> : <Scale size={12} className="mr-1" />}
                                                                    <span>{rule.title}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-2 sm:px-6 py-3 sm:py-4">
                                                <div className="flex items-center space-x-2 sm:space-x-3">
                                                    <img src={player2.avatar_url || getAvatarFallback(player2.name)} className="hidden sm:block w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 object-cover" alt={player2.name} />
                                                    <div className="flex flex-col items-start">
                                                        <span className={`font-bold truncate max-w-[70px] sm:max-w-[none] ${match.score2 > match.score1 ? 'text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                                            {player2.name}
                                                        </span>
                                                        {eloData && (
                                                            <EloChangeDisplay elo={eloData.p2Elo} change={eloData.p2Change} />
                                                        )}
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
                                                                        className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
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

export default Matches
