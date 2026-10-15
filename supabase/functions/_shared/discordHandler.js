// Pure request handler with injected dependencies so tests never contact Discord.
export const handleDiscordRequest = async (request, { client, fetcher = fetch, allowedOrigins = [] }) => {
    const origin = request.headers.get('origin')
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' }
    if (origin && !allowedOrigins.includes(origin)) return new Response('{}', { status: 403, headers })
    if (origin) headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info'
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply(405, { error: 'POST required' })
    try {
        const raw = await request.text()
        if (raw.length > 16000) return reply(413, { error: 'Request too large' })
        const { action, adminToken, url, payload } = JSON.parse(raw)
        if (typeof adminToken !== 'string' || !adminToken) return reply(401, { error: 'Admin session required' })
        if (action === 'status' || action === 'update') {
            const { data, error } = await client.rpc('admin_discord_config', {
                p_admin_token: adminToken, p_action: action, p_url: action === 'update' ? url : null,
            })
            if (error) return reply(error.code === '42501' ? 401 : 400, { error: 'Configuration request rejected' })
            return reply(200, { configured: data?.configured === true })
        }
        if (action !== 'send') return reply(400, { error: 'Invalid action' })
        const { data: webhook, error } = await client.rpc('discord_delivery_url', { p_admin_token: adminToken })
        if (error) return reply(401, { error: 'Admin session required' })
        if (!webhook) return reply(409, { error: 'Configure a Discord webhook first' })
        // Validate migrated configuration too. Never follow redirects or forward
        // caller-provided destinations/credentials to an arbitrary host.
        if (!/^https:\/\/discord\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_-]+$/.test(webhook)) return reply(409, { error: 'Update the Discord configuration' })
        if (typeof payload?.content !== 'string' || !payload.content.trim() || payload.content.length > 2000) return reply(400, { error: 'Report must contain 1 to 2000 characters' })
        const response = await fetcher(webhook, {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: payload.content, username: 'Table Tennis Tracker', allowed_mentions: { parse: [] } }),
        })
        if (!response.ok) return reply(502, { error: 'Discord delivery failed' })
        return reply(200, { sent: true })
    } catch {
        return reply(400, { error: 'Unable to process the request' })
    }
}
