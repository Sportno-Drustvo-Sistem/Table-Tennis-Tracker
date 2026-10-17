import { fetchAllMatches, fetchAllPingpongMatches } from './seasonUtils'

// Same order the history loader returns: newest first, ties by id.
const byNewest = (a, b) => (Date.parse(b.created_at) - Date.parse(a.created_at)) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
const byWins = (a, b) => (b.total_wins || 0) - (a.total_wins || 0)

const loadSeasons = async (client) => {
    const [seasons, snapshots] = await Promise.all([
        client.from('pingpong_seasons').select('*').order('id'),
        client.from('pingpong_season_snapshots').select('*'),
    ])
    const error = seasons.error || snapshots.error
    return error
        ? { data: null, error }
        : { data: { seasons: seasons.data || [], snapshots: snapshots.data || [] }, error: null }
}

// Every cached dataset loads on its own so one slow table never blocks the
// rest. `table` is the realtime source whose row changes are merged in place.
export const DATA_SOURCES = {
    users: { table: 'users', order: byWins, load: client => client.from('users').select('*').order('total_wins', { ascending: false }) },
    matches: { table: 'matches', order: byNewest, history: true, load: fetchAllPingpongMatches },
    padelMatches: { table: 'padel_matches', order: byNewest, history: true, load: client => fetchAllMatches(client, 'padel_matches') },
    padelStats: { table: 'padel_stats', load: client => client.from('padel_stats').select('*') },
    tennisMatches: { table: 'tennis_matches', order: byNewest, history: true, load: client => fetchAllMatches(client, 'tennis_matches') },
    tennisStats: { table: 'tennis_stats', load: client => client.from('tennis_stats').select('*') },
    seasonData: { load: loadSeasons },
}

export const SPORT_DATA = {
    pingpong: { history: 'matches', stats: 'users' },
    padel: { history: 'padelMatches', stats: 'padelStats' },
    tennis: { history: 'tennisMatches', stats: 'tennisStats' },
}

export const REALTIME_TABLES = Object.values(DATA_SOURCES).map(source => source.table).filter(Boolean)
const keyForTable = Object.fromEntries(Object.entries(DATA_SOURCES).map(([key, source]) => [source.table, key]))

export const createInitialData = () => ({
    users: [],
    matches: [],
    padelMatches: [],
    padelStats: [],
    tennisMatches: [],
    tennisStats: [],
    seasonData: { seasons: [], snapshots: [] },
    loaded: {},
    failed: {},
})

// Upserts replace rows by id (or add them) and deletes remove ids. Applying a
// change twice is harmless, so realtime echoes of our own saves are no-ops.
export const mergeRows = (rows, { upserts = [], deletes = [] }, order) => {
    if (!upserts.length && !deletes.length) return rows
    const pending = new Map(upserts.map(row => [row.id, row]))
    const removed = new Set(deletes)
    const next = []
    for (const row of rows) {
        if (removed.has(row.id)) continue
        if (pending.has(row.id)) {
            next.push({ ...row, ...pending.get(row.id) })
            pending.delete(row.id)
        } else next.push(row)
    }
    for (const row of pending.values()) if (!removed.has(row.id)) next.push(row)
    return order ? next.sort(order) : next
}

export const dataReducer = (state, action) => {
    switch (action.type) {
        case 'loaded':
            return {
                ...state,
                [action.key]: action.data,
                loaded: { ...state.loaded, [action.key]: true },
                failed: { ...state.failed, [action.key]: false },
            }
        case 'failed':
            return { ...state, failed: { ...state.failed, [action.key]: true } }
        case 'changed': {
            const next = { ...state }
            for (const [key, change] of Object.entries(action.changes)) {
                next[key] = mergeRows(state[key], change, DATA_SOURCES[key].order)
            }
            return next
        }
        default:
            return state
    }
}

// Maps a postgres_changes payload to a merge for its dataset, or asks for a
// reload when the payload cannot be applied (e.g. a truncated record).
export const realtimeChange = (payload) => {
    const key = keyForTable[payload?.table]
    if (!key) return null
    if (payload.errors?.length) return { key, reload: true }
    if (payload.eventType === 'DELETE') return payload.old?.id ? { key, deletes: [payload.old.id] } : { key, reload: true }
    return payload.new?.id ? { key, upserts: [payload.new] } : { key, reload: true }
}

// Groups queued changes into one merge per dataset, keeping arrival order.
export const combineChanges = (changes) => {
    const combined = {}
    for (const { key, upserts = [], deletes = [] } of changes) {
        const entry = combined[key] ||= { upserts: [], deletes: [] }
        entry.upserts.push(...upserts)
        entry.deletes.push(...deletes)
    }
    return combined
}
