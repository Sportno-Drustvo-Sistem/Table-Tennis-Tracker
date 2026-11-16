import { describe, expect, it } from 'vitest'
import { buildPadelEloHistory, getMatchWinner } from './padelUtils'
import { buildTennisEloHistory, getTennisMatchWinner } from './tennisUtils'
import { calculateSetEloChange } from './utils'
import { formatDiscordMessage } from './discordUtils'

const users=['a','b','c','d'].map(id=>({id,name:id}))
describe('set sport rating outcomes',()=>{
    for(const games of [[[6,4],[0,6],[6,4]],[[6,0],[0,6],[7,5]],[[6,4],[2,6],[6,4]]]) it('rates a set winner independently of game margin '+JSON.stringify(games),()=>{
        const padel={id:'m',team1_player1_id:'a',team1_player2_id:'b',team2_player1_id:'c',team2_player2_id:'d',created_at:'2026-10-15',score1:games.reduce((n,s)=>n+s[0],0),score2:games.reduce((n,s)=>n+s[1],0),sets_data:games.map(([team1Games,team2Games])=>({team1Games,team2Games}))}
        const tennis={id:'m',player1_id:'a',player2_id:'c',created_at:padel.created_at,score1:padel.score1,score2:padel.score2,sets_data:games.map(([player1Games,player2Games])=>({player1Games,player2Games}))}
        expect(getMatchWinner(padel)).toBe(1);expect(getTennisMatchWinner(tennis)).toBe(1)
        expect(buildPadelEloHistory(users,[padel]).currentRatings).toEqual({a:1216,b:1216,c:1184,d:1184})
        expect(buildTennisEloHistory(users,[tennis]).currentRatings).toMatchObject({a:1216,c:1184})
        const report=formatDiscordMessage({pingPong:[],padel:[{...padel,t1p1:users[0],t1p2:users[1],t2p1:users[2],t2p2:users[3]}]},new Date(2026,9,15))
        expect(report.content).toContain('**a/b** vs **c/d**: 1-0')
    })
    it('uses game winner for legacy rows and does not rate ties',()=>{
        expect(getTennisMatchWinner({score1:11,score2:8})).toBe(1)
        expect(calculateSetEloChange(1200,1200,1,1)).toBe(16)
        expect(calculateSetEloChange(1200,1200,0,1)).toBe(0)
    })
    it('replays equal timestamps in id order regardless of response order',()=>{
        const a={id:'a',created_at:'2026-10-15',player1_id:'a',player2_id:'b',score1:11,score2:1}
        const b={...a,id:'b',score1:1,score2:11}
        expect(buildTennisEloHistory(users,[b,a])).toEqual(buildTennisEloHistory(users,[a,b]))
    })
})
