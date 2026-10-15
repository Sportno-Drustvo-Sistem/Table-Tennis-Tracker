import { describe, expect, it, vi } from 'vitest'
import { hookHarness } from './test/hookHarness'
import { validatePadelSets } from './padelUtils'
import { validateTennisSets } from './tennisUtils'
import { validPingPongScores, recordPingPongMatch } from './matchPersistence'

const users=['a','b','c','d'].map(id=>({id,name:id}))
describe('authorized edit flows',()=>{
    for(const sport of ['Padel','Tennis']) it(sport+' sends token, scores and sets in one RPC',async()=>{
        const rpc=vi.fn().mockResolvedValue({error:null}),updated=vi.fn(),close=vi.fn()
        const isPadel=sport==='Padel',field=isPadel?'team':'player'
        const sets=[{[field+'1Games']:6,[field+'2Games']:4},{[field+'1Games']:6,[field+'2Games']:3}]
        const match={id:'match-id',player1_id:'a',player2_id:'b',team1_player1_id:'a',team1_player2_id:'b',team2_player1_id:'c',team2_player2_id:'d',match_format:'best_of_3',sets_data:sets}
        const h=hookHarness(`src/components/modals/${sport}EditMatchModal.jsx`,sport+'EditMatchModal','handleSave,saving,'+(isPadel?'setSetsData':'setSets'),isPadel?'    const getPlayerName':'    return (',{
            supabase:{rpc},useToast:()=>({showToast:vi.fn()}),validatePadelSets,validateTennisSets,
        })
        let v=h.render({isOpen:true,match,users,adminToken:'custom-token',onMatchUpdated:updated,onClose:close})
        await v.handleSave()
        expect(rpc).toHaveBeenCalledWith('update_'+sport.toLowerCase()+'_match',expect.objectContaining({p_admin_token:'custom-token',p_match_id:'match-id',p_score1:12,p_score2:7,p_match_format:'best_of_3'}))
        expect(rpc.mock.calls[0][1].p_sets_data).toHaveLength(2)
        expect(updated).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce()
        rpc.mockResolvedValue({error:new Error('Rejected')}); updated.mockClear();close.mockClear()
        // A rejected RPC never runs a separate recalculation or closes the editor.
        const log=vi.spyOn(console,'error').mockImplementation(()=>{})
        v=h.render();await v.handleSave();v=h.render()
        log.mockRestore()
        expect(v.saving).toBe(false);expect(updated).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled()
        expect(rpc).toHaveBeenCalledTimes(2)
    })
})
describe('Ping Pong score boundaries',()=>{
    for(const score of ['', ' ', null, undefined, NaN, Infinity, -1, 2.5]) it('rejects '+String(score),()=>expect(validPingPongScores(score,3)).toBe(false))
    it('rejects ties and an invalid later set before calling the RPC',async()=>{
        expect(validPingPongScores(3,3)).toBe(false)
        const rpc=vi.fn()
        await expect(recordPingPongMatch({rpc},{adminToken:'token',player1Id:'a',player2Id:'b',sets:[{s1:11,s2:8},{s1:null,s2:0}]})).rejects.toThrow('Invalid Ping Pong scores')
        expect(rpc).not.toHaveBeenCalled()
        expect(validPingPongScores(3,0)).toBe(true)
    })
})
