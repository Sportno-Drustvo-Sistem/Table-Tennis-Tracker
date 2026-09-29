export const SUUNTO_PADEL_APP_NAME = 'Tracker Padel'
export const MAX_SUUNTO_IMPORT_BYTES = 10 * 1024 * 1024

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

export const parseSuuntoPadelWorkout = (text) => {
    if (typeof text !== 'string' || text.length > MAX_SUUNTO_IMPORT_BYTES) throw new Error('Workout JSON must be smaller than 10 MB.')
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
    return decodeSuuntoPadelSummary(candidates[0].SummaryOutputs)
}
