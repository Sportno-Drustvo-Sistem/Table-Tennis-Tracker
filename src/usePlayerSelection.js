import { useState } from 'react'

export const validPlayerId = (users, selected, initial) => users.some(u => u.id === selected) ? selected
    : users.some(u => u.id === initial) ? initial : (users[0]?.id || '')

export const usePlayerSelection = (users, initialPlayerId) => {
    const [selection, setSelection] = useState({ initial: initialPlayerId, id: initialPlayerId })
    const requested = selection.initial === initialPlayerId ? selection.id : initialPlayerId
    const id = validPlayerId(users, requested, initialPlayerId)
    if (selection.initial !== initialPlayerId || selection.id !== id) setSelection({ initial: initialPlayerId, id })
    return [id, value => setSelection({ initial: initialPlayerId, id: value })]
}
