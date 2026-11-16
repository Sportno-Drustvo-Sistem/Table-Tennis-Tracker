import { createClient } from 'npm:@supabase/supabase-js@2.93.1'
import { handleDiscordRequest } from '../_shared/discordHandler.js'

const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
})
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean)
Deno.serve((request: Request) => handleDiscordRequest(request, { client, allowedOrigins }))
