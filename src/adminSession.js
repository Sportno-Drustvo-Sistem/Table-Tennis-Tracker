export const ADMIN_SESSION_STORAGE_KEY = 'table-tennis-admin-session'

export const createAdminSession = async (client, pin) => {
    const { data, error } = await client.rpc('create_admin_session', { p_pin: pin })
    if (error) throw error
    if (!data?.ok || !data?.token) {
        throw new Error(data?.error || 'Unable to start an admin session')
    }

    return {
        token: data.token,
        expiresAt: data.expires_at,
    }
}

// The login takes the 6-digit PIN or, for a super admin, a long password. A
// super admin token is also an admin token.
export const isAdminPin = secret => /^[0-9]{6}$/.test(secret || '')

export const createSuperAdminSession = async (client, password) => {
    const { data, error } = await client.rpc('create_super_admin_session', { p_password: password })
    if (error) throw error
    if (!data?.ok || !data?.token) {
        throw new Error(data?.error || 'Unable to start a super admin session')
    }

    return {
        token: data.token,
        expiresAt: data.expires_at,
        super: true,
    }
}

export const validateSuperAdminSession = async (client, token) => {
    if (!token) return false

    const { data, error } = await client.rpc('validate_super_admin_session', {
        p_token: token,
    })
    if (error) throw error
    return data === true
}

export const validateAdminSession = async (client, token) => {
    if (!token) return false

    const { data, error } = await client.rpc('validate_admin_session', {
        p_token: token,
    })
    if (error) throw error
    return data === true
}

// Sessions last 12 hours but the app can stay open for days. Whoever finds the
// session gone reports it here; `prompt` asks for the PIN straight away, on top
// of whatever is open, so a finished match can still be saved.
const expiredListeners = new Set()

export const onAdminSessionExpired = (listener) => {
    expiredListeners.add(listener)
    return () => expiredListeners.delete(listener)
}

export const reportAdminSessionExpired = ({ prompt = true } = {}) => {
    expiredListeners.forEach(listener => listener({ prompt }))
}

// Postgres "insufficient privilege", raised by the admin-only RPCs.
export const isAdminSessionError = error => error?.code === '42501'

// Also wakes the idle API connection, so a save right after it answers faster.
export const checkAdminSession = async (client, token, options) => {
    try {
        if (!(await validateAdminSession(client, token))) reportAdminSessionExpired(options)
    } catch {
        // Offline or flaky: not proof the session ended. A save reports its own error.
    }
}

export const revokeAdminSession =async (client, token) => {
    if (!token) return

    const { error } = await client.rpc('revoke_admin_session', {
        p_token: token,
    })
    if (error) throw error
}
