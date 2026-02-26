import React, { useState, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../contexts/ToastContext'
import { recalculatePadelStats } from '../../padelUtils'

const PadelEditMatchModal = ({ isOpen, match, onClose, onMatchUpdated, users }) => {
    const { showToast } = useToast()

    const [matchFormat, setMatchFormat] = useState('best_of_3')
    const [setsData, setSetsData] = useState([{ team1Games: '', team2Games: '' }])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (match) {
            setMatchFormat(match.match_format || 'best_of_3')

            if (match.sets_data && match.sets_data.length > 0) {
                // Ensure empty values are shown properly
                const parsedSets = match.sets_data.map(s => ({
                    team1Games: s.team1Games !== undefined ? s.team1Games : '',
                    team2Games: s.team2Games !== undefined ? s.team2Games : ''
                }))
                setSetsData(parsedSets)
            } else {
                // Legacy match fallback, we just show a fake set
                setSetsData([{ team1Games: match.score1 || '', team2Games: match.score2 || '' }])
                setMatchFormat('best_of_1') // Best guess
            }
        }
    }, [match])

    if (!isOpen || !match) return null

    const handleFormatChange = (e) => {
        const format = e.target.value
        setMatchFormat(format)

        let initialSets = 1
        if (format === 'best_of_3') initialSets = 1
        if (format === 'best_of_5') initialSets = 1

        // Don't auto-clear sets on format change if reducing, just let them add/delete manually for now, 
        // or just let it be handled by maxSets limits.
    }

    const handleSetChange = (index, field, value) => {
        const newSets = [...setsData]
        newSets[index][field] = value === '' ? '' : parseInt(value)
        setSetsData(newSets)
    }

    const addSet = () => {
        const maxSets = matchFormat === 'best_of_1' ? 1 : matchFormat === 'best_of_3' ? 3 : 5
        if (setsData.length < maxSets) {
            setSetsData([...setsData, { team1Games: '', team2Games: '' }])
        }
    }

    const removeSet = (index) => {
        if (setsData.length > 1) {
            const newSets = [...setsData]
            newSets.splice(index, 1)
            setSetsData(newSets)
        }
    }

    const handleSave = async () => {
        // Validation
        const cleanSets = setsData.map(s => ({
            team1Games: s.team1Games === '' ? 0 : s.team1Games,
            team2Games: s.team2Games === '' ? 0 : s.team2Games
        }))

        if (cleanSets.length === 0) {
            showToast('Please enter at least one set score.', 'error')
            return
        }

        let team1SetsWon = 0
        let team2SetsWon = 0
        let team1TotalGames = 0
        let team2TotalGames = 0

        cleanSets.forEach(s => {
            team1TotalGames += s.team1Games
            team2TotalGames += s.team2Games
            if (s.team1Games > s.team2Games) team1SetsWon++
            else if (s.team2Games > s.team1Games) team2SetsWon++
        })

        setSaving(true)
        try {
            const { error } = await supabase
                .from('padel_matches')
                .update({
                    score1: team1TotalGames,
                    score2: team2TotalGames,
                    match_format: matchFormat,
                    sets_data: cleanSets
                })
                .eq('id', match.id)

            if (error) throw error

            await recalculatePadelStats()

            onMatchUpdated()
            onClose()
        } catch (error) {
            console.error(error)
            showToast('Error updating padel match: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const getPlayerName = (id) => {
        if (!users) return 'Unknown'
        const u = users.find(u => u.id === id)
        return u ? u.name : 'Unknown'
    }

    const maxSets = matchFormat === 'best_of_1' ? 1 : matchFormat === 'best_of_3' ? 3 : 5

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-2xl m-4 shadow-xl border border-gray-100 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Padel Match</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex justify-between items-center mb-8 px-8">
                    <div className="flex flex-col items-center">
                        <div className="text-xs font-bold text-gray-400 uppercase">Team 1</div>
                        <div className="font-bold text-lg text-gray-900 dark:text-white mt-1 text-center">
                            {getPlayerName(match.team1_player1_id)}<br />
                            <span className="text-gray-400 text-sm">&amp;</span><br />
                            {getPlayerName(match.team1_player2_id)}
                        </div>
                    </div>
                    <div className="font-bold text-2xl text-gray-300 dark:text-gray-600">VS</div>
                    <div className="flex flex-col items-center">
                        <div className="text-xs font-bold text-gray-400 uppercase">Team 2</div>
                        <div className="font-bold text-lg text-gray-900 dark:text-white mt-1 text-center">
                            {getPlayerName(match.team2_player1_id)}<br />
                            <span className="text-gray-400 text-sm">&amp;</span><br />
                            {getPlayerName(match.team2_player2_id)}
                        </div>
                    </div>
                </div>

                {/* Match Format */}
                <div className="mb-6 flex justify-center">
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-1 rounded-lg inline-flex">
                        <button
                            onClick={() => handleFormatChange({ target: { value: 'best_of_1' } })}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${matchFormat === 'best_of_1' ? 'bg-white dark:bg-gray-600 text-green-600 dark:text-green-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        >
                            1 Set
                        </button>
                        <button
                            onClick={() => handleFormatChange({ target: { value: 'best_of_3' } })}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${matchFormat === 'best_of_3' ? 'bg-white dark:bg-gray-600 text-green-600 dark:text-green-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        >
                            Best of 3
                        </button>
                        <button
                            onClick={() => handleFormatChange({ target: { value: 'best_of_5' } })}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${matchFormat === 'best_of_5' ? 'bg-white dark:bg-gray-600 text-green-600 dark:text-green-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        >
                            Best of 5
                        </button>
                    </div>
                </div>

                {/* Set Scores */}
                <div className="space-y-4 mb-8">
                    {setsData.map((set, index) => (
                        <div key={index} className="flex items-center justify-center space-x-6 relative">
                            {setsData.length > 1 && (
                                <button
                                    onClick={() => removeSet(index)}
                                    className="absolute left-0 sm:left-10 text-red-400 hover:text-red-600 p-2"
                                    title="Remove Set"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                            <div className="text-sm font-bold text-gray-400 dark:text-gray-500 w-16 text-right">SET {index + 1}</div>
                            <div className="flex items-center space-x-4">
                                <input
                                    type="number"
                                    min="0"
                                    value={set.team1Games}
                                    onFocus={(e) => e.target.select()}
                                    onChange={e => handleSetChange(index, 'team1Games', e.target.value)}
                                    placeholder="0"
                                    className="w-16 h-16 text-3xl text-center border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
                                />
                                <span className="text-gray-400 font-bold">-</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={set.team2Games}
                                    onFocus={(e) => e.target.select()}
                                    onChange={e => handleSetChange(index, 'team2Games', e.target.value)}
                                    placeholder="0"
                                    className="w-16 h-16 text-3xl text-center border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    ))}

                    {setsData.length < maxSets && (
                        <div className="flex justify-center mt-4">
                            <button
                                onClick={addSet}
                                className="text-sm text-green-600 dark:text-green-400 font-bold hover:underline"
                            >
                                + Add Set
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex justify-end space-x-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold"
                    >
                        {saving ? 'Saving...' : 'Update Match'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PadelEditMatchModal

