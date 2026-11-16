// Avatars are shown at 96px at most, so phone photos are shrunk before upload.
const AVATAR_SIZE = 256
const AVATAR_CACHE_SECONDS = '31536000' // file names are random, so a file never changes

// Centre-crops to a square and re-encodes. Falls back to the original file
// when the browser cannot decode it (e.g. HEIC outside Safari).
export const resizeAvatar = async (file, size = AVATAR_SIZE) => {
    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
        const side = Math.min(bitmap.width, bitmap.height)
        const target = Math.min(size, side)
        const canvas = document.createElement('canvas')
        canvas.width = target
        canvas.height = target
        canvas.getContext('2d').drawImage(
            bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, target, target,
        )
        bitmap.close?.()
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85))
        if (!blob || blob.size >= file.size) return { body: file, ext: file.name.split('.').pop().toLowerCase() }
        // Browsers without WebP encoding hand back a PNG instead.
        return { body: blob, ext: blob.type === 'image/webp' ? 'webp' : 'png' }
    } catch {
        return { body: file, ext: file.name.split('.').pop().toLowerCase() }
    }
}

// Uploads a picked picture and returns its public URL.
export const uploadAvatar = async (client, file) => {
    const { body, ext } = await resizeAvatar(file)
    const fileName = `create/${crypto.randomUUID()}.${ext}`
    const { error } = await client.storage.from('avatars').upload(fileName, body, {
        upsert: false,
        cacheControl: AVATAR_CACHE_SECONDS,
        contentType: body.type || undefined,
    })
    if (error) throw error
    return client.storage.from('avatars').getPublicUrl(fileName).data.publicUrl
}
