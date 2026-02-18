import React, { useState, useEffect } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { recalculatePadelStats } from '../../padelUtils'

const PadelMatchModal = ({ isOpen, onClose, team1, team2, users, onMatchSaved }) => {
    const [score1, setScore1] = useState(0)
    const [score2, setScore2] = useState(0)
    const [localTeam1, setLocalTeam1] = useState(team1)
    const [localTeam2, setLocalTeam2] = useState(team2)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (team1) setLocalTeam1(team1)
        if (team2) setLocalTeam2(team2)
    }, [team1, team2])

    if (!isOpen || !team1 || !team2 || team1.length !== 2 || team2.length !== 2) return null

    const handleSwapTeams = () => {
        const temp = localTeam1
        setLocalTeam1(localTeam2)
        setLocalTeam2(temp)
    }

    const handleSave = async () => {
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
                        score1: parseInt(score1),
                        score2: parseInt(score2),
                    }
                ])

            if (matchError) throw matchError

            await recalculatePadelStats()

            onMatchSaved()
            setScore1(0)
            setScore2(0)
        } catch (error) {
            alert('Error saving padel match: ' + error.message)
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

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-lg m-4 shadow-xl border border-gray-100 dark:border-gray-700">
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

                <div className="flex justify-center space-x-8 mb-8">
                    <div className="flex flex-col items-center">
                        <input
                            type="number"
                            min="0"
                            value={score1}
                            onFocus={(e) => e.target.select()}
                            onChange={e => setScore1(e.target.value)}
                            className="w-20 h-16 text-3xl text-center border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
                        />
                    </div>
                    <div className="flex flex-col items-center">
                        <input
                            type="number"
                            min="0"
                            value={score2}
                            onFocus={(e) => e.target.select()}
                            onChange={e => setScore2(e.target.value)}
                            className="w-20 h-16 text-3xl text-center border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
                        />
                    </div>
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
                        {saving ? 'Saving...' : 'Finish Match'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PadelMatchModal
