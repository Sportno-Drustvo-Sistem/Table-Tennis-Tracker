export const getRuntimeConfig = () => {
    if (typeof window === 'undefined') return {}
    return window.__APP_CONFIG__ || {}
}

export const getRuntimeConfigValue = (key, env = import.meta.env, runtimeConfig = getRuntimeConfig()) => {
    return runtimeConfig[key] || env[key] || ''
}
