import { useCallback, useEffect, useReducer, useRef } from 'react'
import { supabase } from './supabaseClient'
import { onMatchRecorded } from './matchPersistence'
import {
    DATA_SOURCES,
    REALTIME_TABLES,
    SPORT_DATA,
    combineChanges,
    createInitialData,
    dataReducer,
    mergeRows,
    realtimeChange,
} from './appData'

const ALL_KEYS = Object.keys(DATA_SOURCES)
const REALTIME_BATCH_MS = 150

// Loads every dataset once, then keeps it current without full reloads:
// saves merge the rows the RPC returned and refresh only that sport's stats,
// and realtime row changes are merged in place.
export const useAppData = (showToast) => {
    const [data, dispatch] = useReducer(dataReducer, undefined, createInitialData)
    const loads = useRef({})

    const applyChanges = useCallback((changes) => {
        for (const [key, change] of Object.entries(changes)) {
            // A load already in flight may have read the table before this change.
            const load = loads.current[key]
            if (load?.inflight) load.missed.push(change)
        }
        dispatch({ type: 'changed', changes })
    }, [])

    const refresh = useCallback(async (keys = ALL_KEYS) => {
        const failed = await Promise.all(keys.map(async (key) => {
            const load = loads.current[key] ||= { started: 0, applied: 0, inflight: 0, missed: [] }
            const ticket = ++load.started
            load.inflight++
            let result
            try {
                result = await DATA_SOURCES[key].load(supabase)
            } catch (error) {
                result = { data: null, error }
            }
            load.inflight--
            const missed = load.missed
            if (!load.inflight) load.missed = []
            if (ticket < load.applied) return null
            load.applied = ticket

            if (result.error) {
                console.error(`Error loading ${key}:`, result.error)
                dispatch({ type: 'failed', key })
                return key
            }
            let value = result.data ?? []
            for (const change of missed) value = mergeRows(value, change, DATA_SOURCES[key].order)
            dispatch({ type: 'loaded', key, data: value })
            return null
        }))

        if (failed.some(key => DATA_SOURCES[key]?.history)) {
            showToast('Match history load failed. No partial history was accepted.', 'error')
        }
        if (failed.includes('seasonData')) {
            showToast('Season history could not be loaded. Please refresh and try again.', 'error')
        }
    }, [showToast])

    const refreshSport = useCallback((sport) => {
        const { history, stats } = SPORT_DATA[sport]
        return refresh([history, stats])
    }, [refresh])

    useEffect(() => onMatchRecorded(({ sport, matches }) => {
        const { history, stats } = SPORT_DATA[sport]
        if (matches.length) applyChanges({ [history]: { upserts: matches } })
        refresh([stats])
    }), [applyChanges, refresh])

    useEffect(() => {
        const initialLoad = setTimeout(() => refresh(), 0)
        let queue = []
        let flushTimer = null
        let joined = false

        const flush = () => {
            flushTimer = null
            const batch = queue
            queue = []
            const reload = new Set(batch.filter(change => change.reload).map(change => change.key))
            const changes = combineChanges(batch.filter(change => !reload.has(change.key)))
            if (Object.keys(changes).length) applyChanges(changes)
            if (reload.size) refresh([...reload])
        }

        const channel = supabase.channel('public:db_changes')
        REALTIME_TABLES.forEach(table => {
            channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
                const change = realtimeChange(payload)
                if (!change) return
                queue.push(change)
                flushTimer ||= setTimeout(flush, REALTIME_BATCH_MS)
            })
        })
        channel.subscribe((status) => {
            if (status !== 'SUBSCRIBED') return
            // Changes made while the socket was down were never delivered.
            if (joined) refresh()
            joined = true
        })

        return () => {
            clearTimeout(initialLoad)
            clearTimeout(flushTimer)
            supabase.removeChannel(channel)
        }
    }, [applyChanges, refresh])

    const historyFailed = Object.keys(DATA_SOURCES).some(key => DATA_SOURCES[key].history && data.failed[key])

    const loading = !data.loaded.users && !data.failed.users

    return { ...data, loading, historyFailed, refresh, refreshSport }
}
