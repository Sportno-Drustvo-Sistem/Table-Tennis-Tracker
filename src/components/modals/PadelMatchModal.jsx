import React, { useState, useEffect, useRef } from 'react'
import { ArrowLeftRight, Trash2 } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { validatePadelSets } from '../../padelUtils'
import { recordPadelMatch } from '../../matchPersistence'
import { useToast } from '../../contexts/useToast'
import { MAX_SUUNTO_IMPORT_BYTES, parseSuuntoPadelWorkoutMatches } from '../../suuntoPadelImport'

const PadelMatchModal = ({ isOpen, onClose, team1, team2, users, onMatchSaved, adminToken }) => {
    const { showToast } = useToast()
    const [matchFormat, setMatchFormat] = useState('best_of_3') // 'best_of_1', 'best_of_3', 'best_of_5'
    const [setsData, setSetsData] = useState([{ team1Games: '', team2Games: '' }])

    const [localTeam1, setLocalTeam1] = useState(team1)
    const [localTeam2, setLocalTeam2] = useState(team2)
    const [saving, setSaving] = useState(false)
    const [importing, setImporting] = useState(false)
    const [importedMatches, setImportedMatches] = useState([])
    const [importIndex, setImportIndex] = useState(0)
    const importVersion = useRef(0)

    useEffect(() => {
        importVersion.current++
        setImporting(false)
        setImportedMatches([])
        setImportIndex(0)
        if (team1) setLocalTeam1(team1)
        if (team2) setLocalTeam2(team2)
        if (isOpen) {
            setMatchFormat('best_of_3')
            setSetsData([{ team1Games: '', team2Games: '' }])
        }
    }, [team1, team2, isOpen])

    const loadImportedMatch = (result, index) => {
        setMatchFormat(result.matchFormat)
        setSetsData(result.setsData.map(set => ({ ...set })))
        if (result.team1) setLocalTeam1(result.team1)
        if (result.team2) setLocalTeam2(result.team2)
        setImportIndex(index)
    }

    const selectImportedMatch = (index) => {
        if (saving || importing || index === importIndex || importedMatches[index]?.saved) return
        setImportedMatches(matches => matches.map((match, i) => i === importIndex ? {
            ...match, matchFormat, setsData: setsData.map(set => ({ ...set })), team1: localTeam1, team2: localTeam2,
        } : match))
        loadImportedMatch(importedMatches[index], index)
    }

    const handleWatchImport = async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file || importing || saving || importedMatches.length) return
        const version = ++importVersion.current
        setImporting(true)
        try {
            if (file.size > MAX_SUUNTO_IMPORT_BYTES) throw new Error('Workout JSON must be smaller than 10 MB.')
            const matches = parseSuuntoPadelWorkoutMatches(await file.text())
            if (version !== importVersion.current) return
            setImportedMatches(matches.map(match => ({ ...match, saved: false })))
            loadImportedMatch(matches[0], 0)
            showToast(`${matches.length} watch match${matches.length === 1 ? '' : 'es'} loaded. Review the players for each match.`, 'success')
        } catch (error) {
            if (version === importVersion.current) showToast('Could not import workout: ' + error.message, 'error')
        } finally {
            if (version === importVersion.current) setImporting(false)
        }
    }

    if (!isOpen || !team1 || !team2 || team1.length !== 2 || team2.length !== 2) return null

    const handleSwapTeams = () => {
        const temp = localTeam1
        setLocalTeam1(localTeam2)
        setLocalTeam2(temp)
    }

    const handleFormatChange = (e) => {
        const format = e.target.value
        setMatchFormat(format)

        let initialSets = 1
        if (format === 'best_of_3') initialSets = 1
        if (format === 'best_of_5') initialSets = 1

        const newSets = Array.from({ length: initialSets }, () => ({ team1Games: '', team2Games: '' }))
        setSetsData(newSets)
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
        if (saving || importing) return
        if (importedMatches[importIndex]?.saved) return
        // Validation
        const cleanSets = setsData.map(s => ({
            team1Games: s.team1Games === '' ? 0 : s.team1Games,
            team2Games: s.team2Games === '' ? 0 : s.team2Games
        }))

        const validation = validatePadelSets(cleanSets)
        if (!validation.valid) {
            showToast(validation.message, 'error')
            return
        }

        const validSets = validation.sets
        const { team1Games: team1TotalGames, team2Games: team2TotalGames } = validation.summary

        setSaving(true)
        try {
            await recordPadelMatch(supabase, {
                adminToken,
                team1: [localTeam1[0].id, localTeam1[1].id],
                team2: [localTeam2[0].id, localTeam2[1].id],
                score1: team1TotalGames,
                score2: team2TotalGames,
                matchFormat,
                setsData: validSets,
            })

            if (importedMatches.length) {
                const updated = importedMatches.map((match, index) => index === importIndex ? {
                    ...match, matchFormat, setsData: validSets, team1: localTeam1, team2: localTeam2, saved: true,
                } : match)
                setImportedMatches(updated)
                const nextIndex = updated.findIndex(match => !match.saved)
                if (nextIndex >= 0) loadImportedMatch(updated[nextIndex], nextIndex)
                showToast(`Watch match ${importIndex + 1} saved.${nextIndex >= 0 ? ' Review the next match and its players.' : ''}`, 'success')
                onMatchSaved({ keepOpen: nextIndex >= 0 })
            } else onMatchSaved()

        } catch (error) {
            console.error(error)
            showToast('Error saving padel match: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const getAllSelectedIds = () => {
        return [
            ...localTeam1.map(p => p.id),
            ...localTeam2.map(p => p.id)
        ]
    }

    const handlePlayerChange = (teamNum, playerIndex, newUserId) => {
        const newUser = users.find(u => u.id === newUserId)
        if (!newUser) return

        if (teamNum === 1) {
            const newTeam = [...localTeam1]
            newTeam[playerIndex] = newUser
            setLocalTeam1(newTeam)
        } else {
            const newTeam = [...localTeam2]
            newTeam[playerIndex] = newUser
            setLocalTeam2(newTeam)
        }
    }

    const PlayerSelect = ({ player, teamNum, index }) => {
        const selectedIds = getAllSelectedIds().filter(id => id !== player.id)

        return (
            <div className="flex flex-col items-center group relative">
                <div className="relative">
                    <img
                        src={player.avatar_url || 'https://via.placeholder.com/150'}
                        className="w-14 h-14 rounded-full border-2 border-white dark:border-gray-800 object-cover bg-gray-200"
                        alt={player.name}
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                        <span className="text-white text-xs font-bold">Change</span>
                    </div>
                    <select
                        value={player.id}
                        onChange={(e) => handlePlayerChange(teamNum, index, e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        title="Click to change player"
                    >
                        <option value={player.id}>{player.name}</option>
                        {users
                            .filter(u => !selectedIds.includes(u.id))
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))
                        }
                    </select>
                </div>
                <div className="font-bold text-sm text-gray-900 dark:text-white mt-1 text-center truncate w-24">
                    {player.name}
                </div>
            </div>
        )
    }

    const maxSets = matchFormat === 'best_of_1' ? 1 : matchFormat === 'best_of_3' ? 3 : 5

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-2xl shadow-xl border border-gray-100 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
                <fieldset disabled={saving || importing} className="min-w-0 border-0 p-0 m-0">
                <h2 className="text-2xl font-bold mb-2 text-center text-gray-900 dark:text-white">🎾 Record Padel Match</h2>
                <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-6">Click on a player to change them</p>

                <div className="flex justify-between items-center mb-8">
                    {/* Team 1 */}
                    <div className="flex flex-col items-center w-2/5">
                        <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-2">Team 1</div>
                        <div className="flex justify-center gap-4 mb-2">
                            {localTeam1.map((p, i) => (
                                <PlayerSelect key={i} player={p} teamNum={1} index={i} />
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                        <div className="font-bold text-2xl text-gray-400 dark:text-gray-500">VS</div>
                        <button
                            onClick={handleSwapTeams}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                            title="Swap Teams"
                        >
                            <ArrowLeftRight size={20} />
                        </button>
                    </div>

                    {/* Team 2 */}
                    <div className="flex flex-col items-center w-2/5">
                        <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-2">Team 2</div>
                        <div className="flex justify-center gap-4 mb-2">
                            {localTeam2.map((p, i) => (
                                <PlayerSelect key={i} player={p} teamNum={2} index={i} />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-600 p-3 text-sm">
                    <label className="block font-bold text-gray-900 dark:text-white mb-2" htmlFor="suunto-padel-workout">Import Suunto padel scores</label>
                    <p className="text-gray-500 dark:text-gray-400 mb-2">Use workout JSON exported from SuuntoPlus Editor with the Tracker Padel watch app. Team 1 is the top button; Team 2 is the bottom button.</p>
                    <input id="suunto-padel-workout" type="file" accept=".json,application/json" disabled={saving || importing || importedMatches.length > 0} onChange={handleWatchImport} className="block w-full text-gray-700 dark:text-gray-300" />
                    {importing && <p role="status" className="mt-2 text-gray-500">Reading workout…</p>}
                    {importedMatches.length > 0 && <>
                        <p role="status" className="mt-2 text-green-600 dark:text-green-400">Reviewing match {importIndex + 1} of {importedMatches.length}. Check the four players and team order before saving.</p>
                        <div className="flex flex-wrap gap-2 mt-2" aria-label="Workout matches">
                            {importedMatches.map((match, index) => <button
                                key={index} type="button" disabled={match.saved || saving || importing}
                                aria-pressed={index === importIndex}
                                onClick={() => selectImportedMatch(index)}
                                className={`rounded-md border px-3 py-1 disabled:opacity-50 ${index === importIndex ? 'border-green-600 text-green-600 dark:text-green-400' : 'border-gray-300 text-gray-700 dark:text-gray-300'}`}
                            >Match {index + 1}{match.saved ? ' · Saved' : ''}</button>)}
                        </div>
                        <p className="mt-2 text-gray-500 dark:text-gray-400">Each save adds one match. Saved matches are disabled here; importing this workout again later can create duplicates. Finish reviewing before closing this window.</p>
                    </>}
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

                <div className="flex justify-end space-x-2 mt-8">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || importing || importedMatches[importIndex]?.saved}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold"
                    >
                        {saving ? 'Saving...' : importedMatches.length ? `Save match ${importIndex + 1}` : 'Finish Match'}
                    </button>
                </div>
                </fieldset>
            </div>
        </div>
    )
}

export default PadelMatchModal
