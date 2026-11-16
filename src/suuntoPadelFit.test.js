import { Encoder, Profile } from '@garmin/fitsdk'
import { describe, expect, it } from 'vitest'
import { MAX_SUUNTO_IMPORT_BYTES, SUUNTO_PADEL_FIT_APP_ID, parseSuuntoPadelFile, parseSuuntoPadelFit } from './suuntoPadelImport'

// Generate actual binary FIT messages rather than mock the decoder.
const workout = ({ appId = SUUNTO_PADEL_FIT_APP_ID, values = [1 + 4096 * 8, 0, 0, 0], names = ['q1', 'q2', 'q3', 'q4'], sessions = 1, recordOnly = false, baseType = 136, extraApp = false } = {}) => {
    const encoder = new Encoder()
    const developer = { developerDataIndex: 2, applicationId: appId }
    encoder.onMesg(Profile.MesgNum.DEVELOPER_DATA_ID, developer)
    names.forEach((fieldName, i) => {
        const field = { developerDataIndex: 2, fieldDefinitionNumber: i, fieldName, fitBaseTypeId: baseType }
        encoder.onMesg(Profile.MesgNum.FIELD_DESCRIPTION, field)
        encoder.addDeveloperField(i, developer, field)
    })
    const developerFields = Object.fromEntries(values.slice(0, names.length).map((value, i) => [i, value]))
    if (extraApp) {
        const other = { developerDataIndex: 3, applicationId: Array(16).fill(42) }
        const field = { developerDataIndex: 3, fieldDefinitionNumber: 0, fieldName: 'q1', fitBaseTypeId: 136 }
        encoder.onMesg(Profile.MesgNum.DEVELOPER_DATA_ID, other)
        encoder.onMesg(Profile.MesgNum.FIELD_DESCRIPTION, field)
        encoder.addDeveloperField(4, other, field)
        developerFields[4] = 999
    }
    if (recordOnly) encoder.onMesg(Profile.MesgNum.RECORD, { timestamp: 100, developerFields })
    for (let i = 0; i < sessions; i++) {
        encoder.onMesg(Profile.MesgNum.SESSION, { timestamp: 100 + i, ...(recordOnly ? {} : { developerFields }) })
    }
    const bytes = encoder.close()
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

describe('standalone Suunto FIT imports', () => {
    it('decodes ordered binary scores and keeps profiles out of the export', async () => {
        expect(await parseSuuntoPadelFit(workout())).toEqual([
            { matchFormat: 'best_of_1', setsData: [{ team1Games: 6, team2Games: 0 }] },
            { matchFormat: 'best_of_1', setsData: [{ team1Games: 0, team2Games: 6 }] },
        ])
    })
    it('ignores identically named fields from another app', async () => {
        expect(await parseSuuntoPadelFit(workout({ extraApp: true }))).toHaveLength(2)
    })
    it('accepts the legacy single-match FIT contract', async () => {
        const result = await parseSuuntoPadelFit(workout({ names: ['v', 'a', 'b', 'c'], values: [1312, 60, 60, 0] }))
        expect(result[0]).toEqual({ matchFormat: 'best_of_3', setsData: [{ team1Games: 6, team2Games: 0 }, { team1Games: 6, team2Games: 0 }] })
    })
    it('rejects unrelated app identifiers', async () => {
        const id = [...SUUNTO_PADEL_FIT_APP_ID]; id[0] = 0
        await expect(parseSuuntoPadelFit(workout({ appId: id }))).rejects.toThrow('No Tracker Padel')
    })
    it('rejects truncated, corrupt and non-FIT inputs', async () => {
        const buffer = workout()
        await expect(parseSuuntoPadelFit(buffer.slice(0, -1))).rejects.toThrow('damaged')
        new Uint8Array(buffer)[20] ^= 1
        await expect(parseSuuntoPadelFit(buffer)).rejects.toThrow('damaged')
        await expect(parseSuuntoPadelFit(new ArrayBuffer(16))).rejects.toThrow('damaged')
    })
    it('rejects trailing or concatenated FIT data', async () => {
        const original = new Uint8Array(workout())
        const combined = new Uint8Array(original.length * 2)
        combined.set(original); combined.set(original, original.length)
        await expect(parseSuuntoPadelFit(combined.buffer)).rejects.toThrow('trailing data')
    })
    it.each([
        [{ sessions: 2 }, 'one padel workout session'],
        [{ recordOnly: true }, 'incomplete'],
        [{ names: ['q1', 'q2', 'q3'] }, 'incomplete'],
        [{ names: ['q1', 'q1', 'q3', 'q4'] }, 'duplicate'],
        [{ values: [1.5, 0, 0, 0] }, 'Invalid'],
        [{ values: [0, 1, 0, 0] }, 'Missing match'],
        [{ names: ['q1', 'q2', 'q3', 'q5'] }, 'Unsupported'],
        [{ baseType: 134 }, 'float32'],
    ])('rejects unsafe summary inputs %j', async (options, message) => {
        await expect(parseSuuntoPadelFit(workout(options))).rejects.toThrow(message)
    })
    it('dispatches files by extension and rejects oversized uploads before reading', async () => {
        const buffer = workout()
        expect(await parseSuuntoPadelFile({ name: 'workout.FIT', size: buffer.byteLength, arrayBuffer: async () => buffer })).toHaveLength(2)
        const text = JSON.stringify({ Zapps: [{ Zapp: { Name: 'Tracker Padel', SummaryOutputs: ['q1', 'q2', 'q3', 'q4'].map((Id, i) => ({ Id, SummaryValue: i ? 0 : 1 })) } }] })
        expect(await parseSuuntoPadelFile({ name: 'workout.json', size: text.length, text: async () => text })).toHaveLength(1)
        await expect(parseSuuntoPadelFile({ name: 'workout.fit', size: MAX_SUUNTO_IMPORT_BYTES + 1 })).rejects.toThrow('10 MB')
        await expect(parseSuuntoPadelFile({ name: 'workout.txt', size: 1 })).rejects.toThrow('JSON or FIT')
    })
})
