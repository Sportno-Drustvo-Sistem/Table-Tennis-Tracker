import { describe, expect, it } from 'vitest'
import { fetchAllMatches } from './seasonUtils'

const fixture=Array.from({length:2507},(_,i)=>({ id:String(9000-i),created_at:i<1400?'2026-10-15T12:00:00+00:00':'2026-10-14T12:00:00+00:00' }))
const mockClient=(cap,failAt=Infinity)=>{
    let page=0,cursor=null
    const query={select:()=>query,order:()=>query,or(value){cursor=value;return query},async range(){
        if(++page===failAt)return{data:null,error:new Error('page unavailable')}
        let rows=fixture
        if(cursor){const match=cursor.match(/created_at\.eq\.(.*),id\.lt\.(.*)\)/);rows=rows.filter(r=>r.created_at<match[1]||(r.created_at===match[1]&&r.id<match[2]))}
        return {data:rows.slice(0,cap),error:null}
    }}
    return{from:()=>query}
}
describe('complete match history',()=>{
    for(const table of ['matches','padel_matches','tennis_matches']) for(const cap of [1000,317]) it(`loads ${table} beyond 2000 with server cap ${cap}`,async()=>{
        const {data,error}=await fetchAllMatches(mockClient(cap),table)
        expect(error).toBeNull();expect(data).toEqual(fixture)
        expect(new Set(data.map(m=>m.id)).size).toBe(fixture.length)
    })
    it('discards partial history after an intermediate failure',async()=>{
        const result=await fetchAllMatches(mockClient(317,3),'padel_matches')
        expect(result.data).toBeNull();expect(result.error.message).toBe('page unavailable')
    })
})
