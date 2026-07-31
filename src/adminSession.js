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

export const validateAdminSession = async (client, token) => {
    if (!token) return false

    const { data, error } = await client.rpc('validate_admin_session', {
        p_token: token,
    })
    if (error) throw error
    return data === true
}

export const revokeAdminSession = async (client, token) => {
    if (!token) return

    const { error } = await client.rpc('revoke_admin_session', {
        p_token: token,
    })
    if (error) throw error
}
