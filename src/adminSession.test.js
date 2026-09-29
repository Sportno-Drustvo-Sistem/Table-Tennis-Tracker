import { describe, expect, it, vi } from 'vitest'
import {
    createAdminSession,
    revokeAdminSession,
    validateAdminSession,
} from './adminSession'

describe('admin session RPC helpers', () => {
    it('creates an admin session from the PIN', async () => {
        const rpc = vi.fn().mockResolvedValue({
            data: {
                ok: true,
                token: 'server-issued-token',
                expires_at: '2026-07-30T22:00:00Z',
            },
            error: null,
        })

        await expect(createAdminSession({ rpc }, '654321')).resolves.toEqual({
            token: 'server-issued-token',
            expiresAt: '2026-07-30T22:00:00Z',
        })
        expect(rpc).toHaveBeenCalledWith('create_admin_session', {
            p_pin: '654321',
        })
    })

    it('surfaces an incorrect PIN without storing a session', async () => {
        const client = {
            rpc: vi.fn().mockResolvedValue({
                data: { ok: false, error: 'Incorrect admin PIN' },
                error: null,
            }),
        }

        await expect(createAdminSession(client, '000000'))
            .rejects.toThrow('Incorrect admin PIN')
    })

    it('validates and revokes an issued token', async () => {
        const rpc = vi.fn()
            .mockResolvedValueOnce({ data: true, error: null })
            .mockResolvedValueOnce({ data: null, error: null })

        await expect(validateAdminSession({ rpc }, 'token')).resolves.toBe(true)
        await expect(revokeAdminSession({ rpc }, 'token')).resolves.toBeUndefined()
        expect(rpc).toHaveBeenNthCalledWith(1, 'validate_admin_session', {
            p_token: 'token',
        })
        expect(rpc).toHaveBeenNthCalledWith(2, 'revoke_admin_session', {
            p_token: 'token',
        })
    })
})
