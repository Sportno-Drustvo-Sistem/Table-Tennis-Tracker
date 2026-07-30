import React, { useEffect, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { validateTennisSets } from '../../tennisUtils'
import { getAvatarFallback } from '../../utils'
import { recordTennisMatch } from '../../matchPersistence'
import { useToast } from '../../contexts/useToast'

const emptySet = { player1Games: '', player2Games: '', player1Tiebreak: '', player2Tiebreak: '' }

const TennisMatchModal = ({ isOpen, onClose, player1, player2, onMatchSaved, adminToken }) => {
    const { showToast } = useToast()
    const [matchFormat, setMatchFormat] = useState('best_of_3')
    const [sets, setSets] = useState([{ ...emptySet }, { ...emptySet }, { ...emptySet }])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setMatchFormat('best_of_3')
            setSets([{ ...emptySet }, { ...emptySet }, { ...emptySet }])
        }
    }, [isOpen])

    if (!isOpen || !player1 || !player2) return null

    const updateSet = (index, key, value) => {
        setSets(prev => prev.map((set, idx) => idx === index ? { ...set, [key]: value } : set))
    }

    const addSet = () => {
        setSets(prev => [...prev, { ...emptySet }].slice(0, matchFormat === 'best_of_1' ? 1 : 3))
    }

    const removeSet = (index) => {
        setSets(prev => prev.filter((_, idx) => idx !== index))
    }

    const handleSave = async () => {
        const cleanSets = sets.map(set => ({
            player1Games: set.player1Games,
            player2Games: set.player2Games,
            player1Tiebreak: set.player1Tiebreak,
            player2Tiebreak: set.player2Tiebreak,
        }))
        const validation = validateTennisSets(cleanSets, matchFormat)
        if (!validation.valid) {
            showToast(validation.message, 'error')
            return
        }

        setSaving(true)
        try {
            await recordTennisMatch(supabase, {
                adminToken,
                player1Id: player1.id,
                player2Id: player2.id,
                score1: validation.summary.player1Games,
                score2: validation.summary.player2Games,
                matchFormat,
                setsData: validation.sets,
            })
            showToast('Tennis match saved!', 'success')
            onMatchSaved?.()
        } catch (error) {
            console.error(error)
            showToast('Error saving tennis match: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const maxSets = matchFormat === 'best_of_1' ? 1 : 3
    const visibleSets = sets.slice(0, maxSets)

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-2xl shadow-xl border border-gray-100 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Record Tennis Match</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                        <X size={22} />
                    </button>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center mb-6">
                    <PlayerPreview player={player1} align="right" />
                    <div className="text-gray-400 font-black">VS</div>
                    <PlayerPreview player={player2} />
                </div>

                <div className="mb-5">
                    <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Format</label>
                    <div className="inline-flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                        <button onClick={() => { setMatchFormat('best_of_1'); setSets([{ ...emptySet }]) }} className={`px-3 py-1.5 rounded-md text-sm font-bold ${matchFormat === 'best_of_1' ? 'bg-white dark:bg-gray-900 text-emerald-600 shadow-sm' : 'text-gray-500 dark:text-gray-300'}`}>Single Set</button>
                        <button onClick={() => { setMatchFormat('best_of_3'); setSets(prev => [...prev, { ...emptySet }, { ...emptySet }].slice(0, 3)) }} className={`px-3 py-1.5 rounded-md text-sm font-bold ${matchFormat === 'best_of_3' ? 'bg-white dark:bg-gray-900 text-emerald-600 shadow-sm' : 'text-gray-500 dark:text-gray-300'}`}>Best of 3</button>
                    </div>
                </div>

                <div className="space-y-3 mb-6">
                    {visibleSets.map((set, index) => (
                        <div key={index} className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 items-center bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                            <span className="text-sm font-bold text-gray-500 dark:text-gray-300">Set {index + 1}</span>
                            <ScoreInput label={player1.name} value={set.player1Games} onChange={value => updateSet(index, 'player1Games', value)} />
                            <ScoreInput label={player2.name} value={set.player2Games} onChange={value => updateSet(index, 'player2Games', value)} />
                            <button onClick={() => removeSet(index)} disabled={visibleSets.length === 1} className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30">
                                <Trash2 size={16} />
                            </button>
                            {(Number(set.player1Games) === 7 && Number(set.player2Games) === 6) || (Number(set.player2Games) === 7 && Number(set.player1Games) === 6) ? (
                                <>
                                    <span />
                                    <ScoreInput label={`${player1.name} TB`} value={set.player1Tiebreak} onChange={value => updateSet(index, 'player1Tiebreak', value)} />
                                    <ScoreInput label={`${player2.name} TB`} value={set.player2Tiebreak} onChange={value => updateSet(index, 'player2Tiebreak', value)} />
                                    <span />
                                </>
                            ) : null}
                        </div>
                    ))}
                </div>

                {visibleSets.length < maxSets && (
                    <button onClick={addSet} className="mb-6 flex items-center px-3 py-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                        <Plus size={16} className="mr-2" /> Add Set
                    </button>
                )}

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-bold">
                        {saving ? 'Saving...' : 'Save Match'}
                    </button>
                </div>
            </div>
        </div>
    )
}

const PlayerPreview = ({ player, align }) => (
    <div className={`flex items-center gap-3 ${align === 'right' ? 'justify-end text-right' : ''}`}>
        {align === 'right' && <span className="font-bold text-gray-900 dark:text-white">{player.name}</span>}
        <img src={player.avatar_url || getAvatarFallback(player.name)} alt={player.name} className="w-14 h-14 rounded-full object-cover bg-gray-200" />
        {align !== 'right' && <span className="font-bold text-gray-900 dark:text-white">{player.name}</span>}
    </div>
)

const ScoreInput = ({ label, value, onChange }) => (
    <label className="block">
        <span className="block text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1 truncate">{label}</span>
        <input
            type="number"
            min="0"
            value={value}
            onChange={event => onChange(event.target.value)}
            className="w-full h-11 text-center text-lg font-bold border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:border-emerald-500 focus:outline-none"
        />
    </label>
)

export default TennisMatchModal
