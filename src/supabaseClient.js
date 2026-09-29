import { createClient } from '@supabase/supabase-js'
import { getRuntimeConfigValue } from './runtimeConfig'

const supabaseUrl = getRuntimeConfigValue('VITE_SUPABASE_URL')
const supabaseKey = getRuntimeConfigValue('VITE_SUPABASE_ANON_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase URL or Key. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
)
