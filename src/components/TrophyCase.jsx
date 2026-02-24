import React, { useState, useEffect } from 'react'
import { Trophy, Medal, Award } from 'lucide-react'
import { supabase } from '../supabaseClient'

const TrophyCase = ({ playerId }) => {
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchResults = async () => {
            if (!playerId) return
            setLoading(true)

            const { data, error } = await supabase
                .from('tournament_results')
                .select(`
                  *,
                  tournaments (
                      name,
                      format,
                      created_at
                  )
              `)
                .eq('user_id', playerId)
                .order('created_at', { ascending: false })

            if (error) {
                console.error("Error fetching trophies", error)
            } else {
                setResults(data || [])
            }
            setLoading(false)
        }

        fetchResults()
    }, [playerId])

    if (loading) return <div className="text-center text-sm ml-2">Loading trophies...</div>

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mt-6">
            <h3 className="font-bold text-lg mb-4 flex items-center text-gray-900 dark:text-white">
                <Trophy className="mr-2 text-yellow-500" size={20} />
                Trophy Case
            </h3>

            {results.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <Trophy className="mx-auto text-gray-300 dark:text-gray-600 mb-2" size={32} />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No trophies yet</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Win tournaments to earn accolades!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {results.map(result => {
                        const isWin = result.rank === 1
                        const isTop3 = result.rank <= 3

                        // Color Logic
                        let bgColor = 'bg-gray-50 dark:bg-gray-700/50'
                        let borderColor = 'border-gray-200 dark:border-gray-600'
                        let icon = <Award className="text-gray-400" />
                        let rankText = `${result.rank}th Place`

                        if (result.rank === 1) {
                            bgColor = 'bg-yellow-50 dark:bg-yellow-900/20'
                            borderColor = 'border-yellow-200 dark:border-yellow-700'
                            icon = <Trophy className="text-yellow-500" />
                            rankText = "Champion"
                        } else if (result.rank === 2) {
                            bgColor = 'bg-gray-100 dark:bg-gray-800'
                            borderColor = 'border-gray-300 dark:border-gray-600'
                            icon = <Medal className="text-gray-400" />
                            rankText = "Runner Up"
                        } else if (result.rank === 3) {
                            bgColor = 'bg-orange-50 dark:bg-orange-900/20'
                            borderColor = 'border-orange-200 dark:border-orange-800'
                            icon = <Medal className="text-orange-500" />
                            rankText = "3rd Place"
                        } else if (result.rank <= 8) {
                            rankText = "Top 8"
                        }

                        return (
                            <div key={result.id} className={`flex items-center p-3 rounded-lg border ${bgColor} ${borderColor} transition-transform hover:scale-105`}>
                                <div className="mr-3 p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm">
                                    {icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className={`font-bold text-sm truncate ${isWin ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>
                                        {result.tournaments?.name || 'Tournament'}
                                    </h4>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{rankText}</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                            {new Date(result.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default TrophyCase
