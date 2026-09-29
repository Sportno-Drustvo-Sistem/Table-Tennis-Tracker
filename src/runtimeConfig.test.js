import { describe, expect, it } from 'vitest'
import { getRuntimeConfigValue } from './runtimeConfig'

describe('runtime config', () => {
    it('prefers window runtime config over build-time env values', () => {
        const config = { VITE_SUPABASE_URL: 'https://runtime.example' }
        const env = { VITE_SUPABASE_URL: 'https://build.example' }

        expect(getRuntimeConfigValue('VITE_SUPABASE_URL', env, config)).toBe('https://runtime.example')
    })

    it('falls back to build-time env values when runtime config is missing', () => {
        const env = { VITE_SUPABASE_ANON_KEY: 'build-key' }

        expect(getRuntimeConfigValue('VITE_SUPABASE_ANON_KEY', env, {})).toBe('build-key')
    })
})
