import { createClient } from '@supabase/supabase-js'
import { getRuntimeConfigValue } from './runtimeConfig'

const supabaseUrl = getRuntimeConfigValue('VITE_SUPABASE_URL')
const supabaseKey = getRuntimeConfigValue('VITE_SUPABASE_ANON_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase URL or Key. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key',
  {
    // This app uses PIN-issued admin tokens passed to RPCs, not Supabase Auth.
    // Skip Auth's storage/refresh locks, which can stall requests after Safari
    // resumes an idle tab. Returning null keeps requests on the public API key;
    // privileged RPCs still validate their p_admin_token on the server.
    accessToken: async () => null,
  }
)
