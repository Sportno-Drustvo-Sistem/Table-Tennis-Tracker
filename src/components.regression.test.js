import { afterEach, describe, expect, it, vi } from 'vitest'
import * as utils from './utils'
import * as padel from './padelUtils'
import * as tennis from './tennisUtils'
import * as persistence from './matchPersistence'
import { inLocalDateRange } from './dateRange'
import { hookHarness } from './test/hookHarness'

const players = Array.from({ length: 4 }, (_, i) => ({ id: String(i + 1), name: ['Alice','Bob','Carol','Dave'][i] }))
const base = () => ({
    ...utils, ...padel, ...tennis, ...persistence, inLocalDateRange, supabase: {}, SpeechSynthesisUtterance: class {},
    useToast: () => ({ showToast: vi.fn() }),
    localStorage: { getItem: () => 'off', setItem: () => {} },
    window: { addEventListener() {}, removeEventListener() {}, AudioContext: class { state = 'running' }, speechSynthesis: { getVoices: () => [{}], speak() {} } },
    Audio: class { play() { return Promise.resolve() } },
})
afterEach(() => vi.useRealTimers())

describe('component regression handlers', () => {
    it('selects/deletes only visible matches and clears selection on search changes', async () => {
        const rpc = vi.fn().mockResolvedValue({ error: null })
        const h = hookHarness('src/components/Matches.jsx', 'Matches', 'toggleSelectAll,toggleSelect,visibleSelectedIds,handleSearchChange,handleBulkDelete', '    const EloChangeDisplay', { ...base(), supabase: { rpc } })
        const props = { users: players, matches: [{ id:'visible', player1_id:'1', player2_id:'2' },{ id:'hidden', player1_id:'3', player2_id:'4' }], adminToken:'token' }
        let v = h.render(props)
        v.handleSearchChange('Alice'); v = h.render()
        v.toggleSelectAll(); v = h.render()
        expect([...v.visibleSelectedIds]).toEqual(['visible'])
        await v.handleBulkDelete()
        expect(rpc).toHaveBeenLastCalledWith('delete_pingpong_matches', { p_admin_token:'token', p_match_ids:['visible'] })
        v = h.render(); v.toggleSelect('visible'); v = h.render()
        v.handleSearchChange('Carol'); v = h.render()
        expect(v.visibleSelectedIds.size).toBe(0)
        v.handleSearchChange(''); v = h.render(); v.toggleSelectAll(); v = h.render()
        expect(v.visibleSelectedIds.size).toBe(2)
        v = h.render({ ...props, matches: [props.matches[0]] })
        expect(v.visibleSelectedIds.size).toBe(1)
        v = h.render(props)
        expect([...v.visibleSelectedIds]).toEqual(['visible'])
        v.toggleSelectAll(); v = h.render()
        expect(v.visibleSelectedIds.size).toBe(2)
        v.toggleSelectAll(); v = h.render(); expect(v.visibleSelectedIds.size).toBe(0)
        v.handleSearchChange('no results'); v = h.render(); v.toggleSelectAll(); v = h.render()
        await v.handleBulkDelete(); expect(rpc).toHaveBeenCalledTimes(1)
    })
    for (const component of ['PlayerStats','PadelPlayerStats','TennisPlayerStats']) {
        it(component + ' recovers on hydration and season changes, preserving valid choices', () => {
            const id = component === 'TennisPlayerStats' ? 'activePlayerId' : 'selectedPlayerId'
            const h = hookHarness('src/components/'+component+'.jsx', component, id+',selectedPlayer,setSelectedPlayerId', component === 'TennisPlayerStats' ? '    if (!users.length)' : '    if (!selectedPlayer) return <div>', base(), ['src/usePlayerSelection.js'])
            let props = { users: [], matches: [], padelStats:[], tennisStats:[] }
            expect(h.render(props).selectedPlayer).toBeUndefined()
            props = { ...props, users: players }
            let v = h.render(props); expect(v.selectedPlayer.id).toBe('1')
            v.setSelectedPlayerId('3'); v = h.render(); expect(v.selectedPlayer.id).toBe('3')
            v = h.render({ ...props, users: [...players] }); expect(v.selectedPlayer.id).toBe('3')
            v = h.render({ ...props, users: [players[1]] }); expect(v.selectedPlayer.id).toBe('2')
            expect(h.render({ ...props, users: [] }).selectedPlayer).toBeUndefined()
        })
    }
    it('untouched/invalid Ping Pong fields never save or override a tournament', async () => {
        const save = vi.fn(), override = vi.fn()
        const h = hookHarness('src/components/modals/MatchModal.jsx','MatchModal','handleSave,setScore1,setScore2','    if (!isOpen) return null', { ...base(), recordPingPongMatch:save, getActiveDebuffs:async()=>[] })
        const props = { isOpen:true,player1:players[0],player2:players[1],onOverridePlayers:override }
        let v = h.render(props)
        await v.handleSave(); expect(save).not.toHaveBeenCalled(); expect(override).not.toHaveBeenCalled()
        for (const [a,b] of [['',''],[-1,3],[1.2,3],[4,4],[Infinity,3]]) {
            v.setScore1(a); v.setScore2(b); v=h.render(); await v.handleSave()
        }
        expect(save).not.toHaveBeenCalled()
        save.mockResolvedValue({match:{id:'saved'}})
        v.setScore1('11'); v.setScore2('8'); v=h.render(); await v.handleSave()
        expect(save).toHaveBeenCalledOnce()
    })
    it('blocks Padel transition clicks, starts once, supports undo and cleans up timers', () => {
        vi.useFakeTimers()
        const h = hookHarness('src/components/modals/PadelLiveMatchModal.jsx','PadelLiveMatchModal','scorePoint,completedSets,matchWinner,t1Games,t2Games,setTransition,undoLast,handleRematch','    if (!isOpen || !team1',base())
        const props = { isOpen:true,team1:players.slice(0,2),team2:players.slice(2),padelStats:[] }
        let v = h.render(props)
        const winSet = () => { for(let i=0;i<24;i++){ v.scorePoint(1); v=h.render() } }
        winSet()
        expect(v.completedSets).toHaveLength(1); expect(v.setTransition).toBeTruthy()
        for(let i=0;i<10;i++) v.scorePoint(1)
        v=h.render(); expect(v.completedSets).toHaveLength(1); expect(v.matchWinner).toBeNull()
        vi.advanceTimersByTime(1800); v=h.render()
        expect([v.t1Games,v.t2Games,v.setTransition]).toEqual([0,0,null])
        v.undoLast(); v=h.render(); expect(v.completedSets).toHaveLength(0); expect(v.t1Games).toBe(5)
        v.scorePoint(1); v=h.render(); expect(v.setTransition).toBeTruthy()
        v.handleRematch(); v=h.render(); vi.advanceTimersByTime(2000); v=h.render()
        expect(v.completedSets).toHaveLength(0); expect(v.t1Games).toBe(0)
        winSet(); h.render({ ...props,isOpen:false }); vi.advanceTimersByTime(2000)
        v=h.render(props); expect(v.t1Games).toBe(0); expect(v.completedSets).toHaveLength(0)
        winSet(); h.unmount(); expect(vi.getTimerCount()).toBe(0)
    })
    for(const initialServer of [1,2]) it('Tennis tiebreak serves, undo and next set, initial '+initialServer,()=>{
        const h=hookHarness('src/components/modals/TennisLiveMatchModal.jsx','TennisLiveMatchModal','scorePoint,server,p1Points,p2Points,isTiebreak,undoLast,setServer,completedSets','    if (!isOpen || !player1',base())
        // Stop at the final render guard, after handlers/effects.
        let v=h.render({isOpen:true,player1:players[0],player2:players[1]})
        v.setServer(initialServer); v=h.render()
        for(let game=0;game<12;game++) for(let point=0;point<4;point++){v.scorePoint(game%2+1);v=h.render()}
        expect(v.isTiebreak).toBe(true)
        expect(v.server).toBe(initialServer)
        const sequence=[]
        for(let i=0;i<12;i++){
            sequence.push(v.server); v.scorePoint(i%2+1); v=h.render()
        }
        const other=initialServer===1?2:1
        expect(sequence).toEqual([initialServer,other,other,initialServer,initialServer,other,other,initialServer,initialServer,other,other,initialServer])
        v.undoLast();v=h.render();expect(v.server).toBe(initialServer)
        v.scorePoint(2);v=h.render()
        v.scorePoint(1);v=h.render();v.scorePoint(1);v=h.render()
        expect(v.completedSets).toHaveLength(1);expect(v.isTiebreak).toBe(false);expect(v.server).toBe(other)
    })
})
