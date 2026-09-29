import { getAvatarFallback } from './utils'

// Every <img> in the app is a player avatar. When a stored avatar URL is dead
// (deleted file, expired storage link), swap in the generated silhouette.
export const handleImageError = (event) => {
    const img = event.target
    if (!(img instanceof HTMLImageElement)) return
    if (img.src.startsWith('data:')) return
    img.src = getAvatarFallback(img.alt || '?')
}

export const installAvatarFallback = (target = window) => {
    // Image load errors don't bubble, so listen in the capture phase.
    target.addEventListener('error', handleImageError, true)
    return () => target.removeEventListener('error', handleImageError, true)
}
