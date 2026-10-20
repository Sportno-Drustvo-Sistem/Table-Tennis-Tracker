import { useEffect } from 'react'

// Live scoring can sit untouched for a while between points; without this the
// phone locked mid-match. Rendered inside the live match screens while open.
const KeepAwake = () => {
    useEffect(() => {
        if (!navigator.wakeLock) return
        let lock = null
        let closed = false

        const request = async () => {
            if (document.visibilityState !== 'visible' || (lock && !lock.released)) return
            try {
                const next = await navigator.wakeLock.request('screen')
                if (closed) next.release().catch(() => {})
                else lock = next
            } catch {
                // Denied (e.g. battery saver): the screen just sleeps as usual.
            }
        }

        // The browser drops the lock whenever the page is hidden; take it again on return.
        request()
        document.addEventListener('visibilitychange', request)
        return () => {
            closed = true
            document.removeEventListener('visibilitychange', request)
            lock?.release().catch(() => {})
        }
    }, [])

    return null
}

export default KeepAwake
