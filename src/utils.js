import { supabase } from './supabaseClient'

export const recalculateWins = async (userId) => {
    // Get all matches for user
    const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)

    if (!matches) return

    let wins = 0
    matches.forEach(m => {
        if (m.player1_id === userId && m.score1 > m.score2) wins++
        if (m.player2_id === userId && m.score2 > m.score1) wins++
    })

    await supabase.from('users').update({ total_wins: wins }).eq('id', userId)
}
