import { afterEach, describe, expect, it } from 'vitest'
import process from 'node:process'
import { inLocalDateRange, localDateBounds, toLocalISO } from './dateRange'
const originalTZ = process.env.TZ
afterEach(() => { process.env.TZ = originalTZ })
describe('local calendar filters', () => {
    for (const zone of ['Europe/Ljubljana','America/Los_Angeles']) {
        it('includes entire selected day in '+zone, () => {
            process.env.TZ = zone
            const { start, end } = localDateBounds('2026-10-15','2026-10-15')
            expect(start.getHours()).toBe(0)
            expect(toLocalISO(start)).toBe('2026-10-15')
            expect(inLocalDateRange(new Date(2026,9,15,1).toISOString(),'2026-10-15','2026-10-15')).toBe(true)
            expect(inLocalDateRange(new Date(end-1).toISOString(),'2026-10-15','2026-10-15')).toBe(true)
            expect(inLocalDateRange(end.toISOString(),'2026-10-15','2026-10-15')).toBe(false)
            expect(inLocalDateRange(new Date(start-1).toISOString(),'2026-10-15','2026-10-15')).toBe(false)
        })
    }
    for(const [date,hours] of [['2026-03-29',23],['2026-10-25',25]]) it('handles DST day '+date,()=>{
        process.env.TZ='Europe/Ljubljana'
        const { start,end }=localDateBounds(date,date)
        expect((end-start)/3600000).toBe(hours)
        expect(inLocalDateRange(new Date(end-1),date,date)).toBe(true)
        expect(inLocalDateRange(end,date,date)).toBe(false)
    })
    it('leaves all-time unbounded',()=>expect(inLocalDateRange('1990-01-01','','')).toBe(true))
})
