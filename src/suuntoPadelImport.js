export const SUUNTO_PADEL_APP_NAME = 'Tracker Padel'
export const MAX_SUUNTO_IMPORT_BYTES = 10 * 1024 * 1024
// SuuntoPlus prefix followed by the eight ASCII bytes of private app ID ttpadel1.
export const SUUNTO_PADEL_FIT_APP_ID = [222, 19, 214, 168, 153, 195, 193, 157, 116, 116, 112, 97, 100, 101, 108, 49]

// Decode the compact numeric summary, independently of the workout container.
// This can also be reused by a future FIT/Cloud API adapter.
export const decodeSuuntoPadelSummary = (summary) => {
    if (!Array.isArray(summary)) throw new Error('Missing padel workout summary.')
    const fields = new Map()
    for (const item of summary) {
        if (!['v', 'a', 'b', 'c'].includes(item?.Id)) continue
        if (fields.has(item.Id) || !Number.isInteger(item.SummaryValue)) {
            throw new Error('Invalid or duplicate padel summary field.')
        }
        fields.set(item.Id, item.SummaryValue)
    }
    if (fields.size !== 4) throw new Error('The padel summary is incomplete.')
    const code = fields.get('v')
    const format = Math.floor(code / 100) % 10
    const winner = Math.floor(code / 10) % 10
    const count = code % 10
    if (Math.floor(code / 1000) !== 1 || ![1, 3].includes(format) || count > format) {
        throw new Error('Unsupported padel result code.')
    }
    if (winner === 0) throw new Error('This workout ended before the padel match was complete.')
    if (![1, 2].includes(winner)) throw new Error('Invalid padel winner.')
    if (count < 1) throw new Error('The padel summary has no completed sets.')
    const wins = [0, 0]
    const setsData = []
    for (let i = 0; i < 3; i++) {
        const packed = fields.get(['a', 'b', 'c'][i])
        if (i >= count) {
            if (packed !== 0) throw new Error('Unexpected extra set scores.')
            continue
        }
        if (packed < 0 || packed > 77) throw new Error('Invalid padel set score.')
        const team1Games = Math.floor(packed / 10)
        const team2Games = packed % 10
        const high = Math.max(team1Games, team2Games)
        const low = Math.min(team1Games, team2Games)
        if (!((high === 6 && low <= 4) || (high === 7 && [5, 6].includes(low)))) {
            throw new Error('The workout contains an unfinished or invalid set.')
        }
        if (Math.max(...wins) >= (format + 1) / 2) throw new Error('Extra sets after the match was won.')
        wins[team1Games > team2Games ? 0 : 1]++
        setsData.push({ team1Games, team2Games })
    }
    if (wins[winner - 1] !== (format + 1) / 2) throw new Error('Set scores do not match the recorded winner.')
    return { matchFormat: `best_of_${format}`, setsData }
}

const decodePackedMatch = (code) => {
    if (code > 3374) throw new Error('Invalid packed padel match.')
    const sets = []
    while (code) {
        const digit = code % 15
        if (digit === 0) throw new Error('Missing set in packed padel match.')
        const team1Won = digit <= 7
        const low = (digit - 1) % 7
        const high = low < 5 ? 6 : 7
        sets.push({ team1Games: team1Won ? high : low, team2Games: team1Won ? low : high })
        code = Math.floor(code / 15)
    }
    // Reuse strict match validation, including no sets after a deciding set.
    const winner = sets[sets.length - 1].team1Games > sets[sets.length - 1].team2Games ? 1 : 2
    const format = sets.length === 1 ? 1 : 3
    return decodeSuuntoPadelSummary([
        { Id: 'v', SummaryValue: 1000 + format * 100 + winner * 10 + sets.length },
        ...['a', 'b', 'c'].map((id, i) => ({ Id: id, SummaryValue: sets[i] ? sets[i].team1Games * 10 + sets[i].team2Games : 0 })),
    ])
}

export const decodeSuuntoPadelMatches = (summary) => {
    if (!Array.isArray(summary)) throw new Error('Missing padel workout summary.')
    if (summary.some(field => /^q/.test(field?.Id) && !/^q[1-4]$/.test(field?.Id))) throw new Error('Unsupported padel queue version or size.')
    if (!summary.some(field => /^q[1-4]$/.test(field?.Id))) return [decodeSuuntoPadelSummary(summary)]
    const fields = new Map()
    for (const field of summary) {
        if (!/^q[1-4]$/.test(field?.Id)) continue
        if (fields.has(field.Id) || !Number.isInteger(field.SummaryValue) || field.SummaryValue < 0 || field.SummaryValue > 16777215) {
            throw new Error('Invalid or duplicate padel summary field.')
        }
        fields.set(field.Id, field.SummaryValue)
    }
    if (fields.size !== 4) throw new Error('The padel summary is incomplete.')
    if (summary.some(field => ['v', 'a', 'b', 'c'].includes(field?.Id))) throw new Error('Mixed padel export versions.')
    const matches = []
    let empty = false
    for (let i = 1; i <= 4; i++) {
        const value = fields.get(`q${i}`)
        for (const code of [value % 4096, Math.floor(value / 4096)]) {
            if (code === 0) empty = true
            else {
                if (empty) throw new Error('Missing match in padel workout.')
                matches.push(decodePackedMatch(code))
            }
        }
    }
    if (!matches.length) throw new Error('This workout has no completed padel matches.')
    return matches
}

export const parseSuuntoPadelWorkoutMatches = (text) => {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_SUUNTO_IMPORT_BYTES) throw new Error('Workout JSON must be smaller than 10 MB.')
    const workout = JSON.parse(text)
    // Editor exports wrap the documented Zapps header differently across versions.
    // Walk JSON containers only; never infer a score from an unrelated activity.
    const pending = [workout]
    const candidates = []
    while (pending.length) {
        const node = pending.pop()
        if (!node || typeof node !== 'object') continue
        if (Array.isArray(node.Zapps)) {
            for (const entry of node.Zapps) {
                if (entry?.Zapp?.Name === SUUNTO_PADEL_APP_NAME) candidates.push(entry.Zapp)
            }
        }
        for (const value of Object.values(node)) {
            if (value && typeof value === 'object') pending.push(value)
        }
    }
    if (candidates.length !== 1) {
        throw new Error(candidates.length ? 'Import one padel workout at a time.' : 'No Tracker Padel workout found. Export the workout JSON from SuuntoPlus Editor.')
    }
    return decodeSuuntoPadelMatches(candidates[0].SummaryOutputs)
}

// Preserve the single-match API for existing callers without silently losing matches.
export const parseSuuntoPadelWorkout = (text) => {
    const matches = parseSuuntoPadelWorkoutMatches(text)
    if (matches.length !== 1) throw new Error('Use the multiple-match importer for this workout.')
    return matches[0]
}

export const parseSuuntoPadelFit = async (buffer) => {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength > MAX_SUUNTO_IMPORT_BYTES) {
        throw new Error('Workout FIT must be smaller than 10 MB.')
    }
    // Load the official decoder only when a FIT file is uploaded.
    const { Decoder, Stream } = await import('@garmin/fitsdk')
    const decoder = new Decoder(Stream.fromArrayBuffer(buffer))
    if (!decoder.isFIT() || !decoder.checkIntegrity()) throw new Error('Invalid or damaged FIT workout.')
    const header = new DataView(buffer)
    if (buffer.byteLength !== header.getUint8(0) + header.getUint32(4, true) + 2) {
        throw new Error('Import one FIT workout file without trailing data.')
    }
    const descriptions = new Map()
    const { messages, errors } = decoder.read({
        convertTypesToStrings: false,
        fieldDescriptionListener: (key, developer, field) => {
            const id = developer.applicationId
            if (!Array.isArray(id) || id.length !== 16 || !id.every((byte, i) => byte === SUUNTO_PADEL_FIT_APP_ID[i])) return
            if (descriptions.has(key)) throw new Error('Duplicate padel FIT field description.')
            if ((field.fitBaseTypeId & 31) !== 8) throw new Error('Padel FIT summary fields must be float32.')
            descriptions.set(key, { name: field.fieldName, developerIndex: developer.developerDataIndex })
        },
    })
    if (errors.length) throw new Error('Could not decode FIT workout: ' + errors[0].message)
    const sessions = messages.sessionMesgs || []
    if (sessions.length !== 1) throw new Error('Import one padel workout session at a time.')
    if (!descriptions.size) throw new Error('No Tracker Padel scores found in this FIT workout.')
    if (new Set([...descriptions.values()].map(field => field.developerIndex)).size !== 1) {
        throw new Error('Import one Tracker Padel app at a time.')
    }
    const summary = []
    for (const [key, field] of descriptions) {
        if (Object.hasOwn(sessions[0].developerFields || {}, key)) {
            summary.push({ Id: field.name, SummaryValue: sessions[0].developerFields[key] })
        }
    }
    return decodeSuuntoPadelMatches(summary)
}

export const parseSuuntoPadelFile = async (file) => {
    if (file.size > MAX_SUUNTO_IMPORT_BYTES) throw new Error('Workout file must be smaller than 10 MB.')
    if (/\.fit$/i.test(file.name)) return parseSuuntoPadelFit(await file.arrayBuffer())
    if (/\.json$/i.test(file.name)) return parseSuuntoPadelWorkoutMatches(await file.text())
    throw new Error('Choose a Suunto workout JSON or FIT file.')
}
