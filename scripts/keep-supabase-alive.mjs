import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MODE = readModeArg(process.argv) || process.env.MODE || process.env.NODE_ENV || ''
const protectedKeys = new Set(Object.keys(process.env))

loadEnvFile('.env', protectedKeys)
loadEnvFile('.env.local', protectedKeys)

if (MODE) {
  loadEnvFile(`.env.${MODE}`, protectedKeys)
  loadEnvFile(`.env.${MODE}.local`, protectedKeys)
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY
const KEEPALIVE_TABLE = process.env.SUPABASE_KEEPALIVE_TABLE || 'users'
const KEEPALIVE_COLUMN = process.env.SUPABASE_KEEPALIVE_COLUMN || 'id'
const KEEPALIVE_SCHEMA = process.env.SUPABASE_KEEPALIVE_SCHEMA || 'public'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    `Missing Supabase credentials. Checked process env${MODE ? ` and .env files for mode "${MODE}"` : ''}. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.`
  )
  process.exit(1)
}

const normalizedUrl = SUPABASE_URL.replace(/\/+$/, '')
const requestUrl = new URL(`${normalizedUrl}/rest/v1/${encodeURIComponent(KEEPALIVE_TABLE)}`)
requestUrl.searchParams.set('select', KEEPALIVE_COLUMN)
requestUrl.searchParams.set('limit', '1')

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Accept-Profile': KEEPALIVE_SCHEMA,
}

function loadEnvFile(filename, protectedKeys) {
  const filePath = resolve(process.cwd(), filename)
  if (!existsSync(filePath)) {
    return
  }

  const fileContents = readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, '')

  for (const rawLine of fileContents.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const rawKey = line.slice(0, separatorIndex).trim()
    const key = rawKey.startsWith('export ') ? rawKey.slice(7).trim() : rawKey
    if (!key || protectedKeys.has(key)) {
      continue
    }

    let value = line.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

function readModeArg(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--mode') {
      return argv[index + 1]
    }

    if (value.startsWith('--mode=')) {
      return value.slice('--mode='.length)
    }
  }

  return ''
}

async function pingDatabase(method) {
  const response = await fetch(requestUrl, {
    method,
    headers,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${method} ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`)
  }
}

try {
  const start = Date.now()

  try {
    await pingDatabase('HEAD')
    console.log(
      `Supabase keepalive succeeded with HEAD on ${KEEPALIVE_SCHEMA}.${KEEPALIVE_TABLE} in ${Date.now() - start}ms.`
    )
  } catch (headError) {
    console.warn(`HEAD keepalive failed, retrying with GET: ${headError.message}`)
    await pingDatabase('GET')
    console.log(
      `Supabase keepalive succeeded with GET on ${KEEPALIVE_SCHEMA}.${KEEPALIVE_TABLE} in ${Date.now() - start}ms.`
    )
  }
} catch (error) {
  console.error(`Supabase keepalive failed: ${error.message}`)
  process.exit(1)
}
