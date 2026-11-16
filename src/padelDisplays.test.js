import { describe, expect, it } from 'vitest'
import { getMatchWinner } from './padelUtils'
import { inLocalDateRange } from './dateRange'
import { hookHarness } from './test/hookHarness'
const users=['a','b','c','d'].map(id=>({id,name:id}))
describe('Padel leaderboard outcome',()=>{
    it('shows wins/losses/streaks using sets when game totals disagree or tie',()=>{
        const match={id:'m1',created_at:'2026-10-15',team1_player1_id:'a',team1_player2_id:'b',team2_player1_id:'c',team2_player2_id:'d',score1:12,score2:14,sets_data:[{team1Games:6,team2Games:4},{team1Games:0,team2Games:6},{team1Games:6,team2Games:4}]}
        const equal={...match,id:'m2',score1:14,score2:14,sets_data:[{team1Games:6,team2Games:4},{team1Games:2,team2Games:6},{team1Games:6,team2Games:4}]}
        const h=hookHarness('src/components/PadelLeaderboard.jsx','PadelLeaderboard','stats','    const sortedStats',{getMatchWinner,inLocalDateRange})
        const {stats}=h.render({users,matches:[match,equal],padelStats:[]})
        expect(stats.find(p=>p.id==='a')).toMatchObject({wins:2,losses:0,streak:'2W'})
        expect(stats.find(p=>p.id==='c')).toMatchObject({wins:0,losses:2,streak:'2L'})
    })
})
