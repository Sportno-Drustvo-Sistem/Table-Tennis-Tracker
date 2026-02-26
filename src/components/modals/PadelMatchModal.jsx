import React, { useState, useEffect } from 'react'
import { ArrowLeftRight, Trash2 } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { recalculatePadelStats } from '../../padelUtils'
import { useToast } from '../../contexts/ToastContext'

const PadelMatchModal = ({ isOpen, onClose, team1, team2, users, onMatchSaved }) => {
    const { showToast } = useToast()
    const [matchFormat, setMatchFormat] = useState('best_of_3') // 'best_of_1', 'best_of_3', 'best_of_5'
    const [setsData, setSetsData] = useState([{ team1Games: '', team2Games: '' }])

    const [localTeam1, setLocalTeam1] = useState(team1)
    const [localTeam2, setLocalTeam2] = useState(team2)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (team1) setLocalTeam1(team1)
        if (team2) setLocalTeam2(team2)
        if (isOpen) {
            setMatchFormat('best_of_3')
            setSetsData([{ team1Games: '', team2Games: '' }])
        }
    }, [team1, team2, isOpen])

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
        // Validation
        const cleanSets = setsData.map(s => ({
            team1Games: s.team1Games === '' ? 0 : s.team1Games,
            team2Games: s.team2Games === '' ? 0 : s.team2Games
        }))

        // Ensure at least one game is played or one set is valid
        if (cleanSets.length === 0) {
            showToast('Please enter at least one set score.', 'error')
            return
        }

        // Calculate Sets won to determine match winner
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

        // Require a clear winner in terms of sets won for normal scenarios
        if (team1SetsWon === team2SetsWon) {
            // We'll allow taking the match even if tied sets but warn if it feels wrong, 
            // but technically allow it.
        }

        setSaving(true)
        try {
            const { error: matchError } = await supabase
                .from('padel_matches')
                .insert([
                    {
                        team1_player1_id: localTeam1[0].id,
                        team1_player2_id: localTeam1[1].id,
                        team2_player1_id: localTeam2[0].id,
                        team2_player2_id: localTeam2[1].id,
                        // We store total games won into score1/score2 for Elo calculations backwards compatibility!
                        score1: team1TotalGames,
                        score2: team2TotalGames,
                        match_format: matchFormat,
                        sets_data: cleanSets
                    }
                ])

            if (matchError) {
                console.error("Match saving error:", matchError)
                throw matchError
            }

            await recalculatePadelStats()

            onMatchSaved()

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
                        disabled={saving}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold"
                    >
                        {saving ? 'Saving...' : 'Finish Match'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PadelMatchModal
