import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const migrationsDir = path.resolve('supabase/migrations')

const readMigration = (name) => fs.readFileSync(path.join(migrationsDir, name), 'utf8').toLowerCase()
const migrationNames = () => fs.readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()
const findMigration = (partialName) => {
    const name = migrationNames().find(fileName => fileName.includes(partialName))
    expect(name).toBeTruthy()
    return name
}

describe('fresh Supabase migration readiness', () => {
    it('uses unique migration versions for Supabase CLI compatibility', () => {
        const versions = migrationNames().map(name => name.split('_')[0])
        expect(new Set(versions).size).toBe(versions.length)
    })

    it('creates core users and matches tables before feature migrations run', () => {
        const names = migrationNames()
        const baselineName = findMigration('baseline_core_schema')
        const debuffsName = findMigration('create_debuffs_table')

        expect(baselineName).toBeTruthy()
        expect(names.indexOf(baselineName)).toBeLessThan(names.indexOf(debuffsName))

        const baseline = readMigration(baselineName)
        expect(baseline).toContain('create extension if not exists "uuid-ossp"')
        expect(baseline).toContain('create table if not exists public.users')
        expect(baseline).toContain('create table if not exists public.matches')
        expect(baseline).toContain('create table if not exists public.tournaments')
    })

    it('provisions the public avatars bucket and storage policies when storage exists', () => {
        const baseline = readMigration(findMigration('baseline_core_schema'))

        expect(baseline).toContain("insert into storage.buckets")
        expect(baseline).toContain("''avatars'', ''avatars'', true")
        expect(baseline).toContain('on storage.objects')
        expect(baseline).toContain('for insert')
        expect(baseline).toContain("bucket_id = ''avatars''")
    })

    it('keeps early debuff migration idempotent for empty or partially migrated databases', () => {
        const migration = readMigration(findMigration('create_debuffs_table'))

        expect(migration).toContain('create table if not exists public.debuffs')
        expect(migration).toContain('create table if not exists public.tournaments')
        expect(migration).toContain('drop policy if exists "enable read access for all users"')
        expect(migration).toContain('drop policy if exists "enable write access for all users"')
    })

    it('keeps settings policy creation idempotent', () => {
        const migration = readMigration(findMigration('create_settings_table'))

        expect(migration).toContain('create table if not exists public.settings')
        expect(migration).toContain('drop policy if exists "allow all for settings" on public.settings')
        expect(migration).toContain('create policy "allow all for settings" on public.settings')
    })

    it('keeps sport table policy migrations idempotent', () => {
        const padel = readMigration(findMigration('add_padel_tables'))
        const tennis = readMigration(findMigration('add_tennis_tables'))

        expect(padel).toContain('drop policy if exists "allow all for padel_matches" on public.padel_matches')
        expect(padel).toContain('drop policy if exists "allow all for padel_stats" on public.padel_stats')
        expect(tennis).toContain('drop policy if exists "allow all for tennis_matches" on public.tennis_matches')
        expect(tennis).toContain('drop policy if exists "allow all for tennis_stats" on public.tennis_stats')
    })

    it('keeps later column and constraint migrations retryable', () => {
        const padelScoring = readMigration(findMigration('update_padel_matches'))
        const tournamentFk = readMigration(findMigration('fix_matches_tournament_fk'))

        expect(padelScoring).toContain('add column if not exists match_format')
        expect(padelScoring).toContain('add column if not exists sets_data')
        expect(tournamentFk).toContain('drop constraint if exists matches_tournament_id_fkey')
        expect(tournamentFk).toContain('add column if not exists tournament_id')
    })
})
