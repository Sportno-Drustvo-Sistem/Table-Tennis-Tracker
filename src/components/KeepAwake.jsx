import { useEffect } from 'react'

// Live scoring can sit untouched for a while between points; without this the
// phone locked mid-match. Rendered inside the live match screens while open.
const KeepAwake = () => {
    useEffect(() => {
        if (!navigator.wakeLock) return
        let lock = null
        let closed = false
        // A visibilitychange can fire while the first request is still pending; without this
        // both would succeed and the extra lock would outlive the match screen.
        let pending = false

        const request = async () => {
            if (pending || document.visibilityState !== 'visible' || (lock && !lock.released)) return
            pending = true
            try {
                const next = await navigator.wakeLock.request('screen')
                if (closed) next.release().catch(() => {})
                else lock = next
            } catch {
                // Denied (e.g. battery saver): the screen just sleeps as usual.
            } finally {
                pending = false
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
