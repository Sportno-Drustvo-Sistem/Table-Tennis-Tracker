import { describe, expect, it, vi } from 'vitest'
import { hookHarness } from './test/hookHarness'

const setup = (rpcResult = { error: null }) => {
    const rpc = vi.fn().mockResolvedValue(rpcResult)
    const upload = vi.fn().mockResolvedValue({ error: null })
    const publicUrl = 'https://example.supabase.co/storage/v1/object/public/avatars/create/avatar.png'
    const storage = { from: vi.fn().mockReturnValue({ upload, getPublicUrl: () => ({ data: { publicUrl } }) }) }
    const showToast = vi.fn(), onUserAdded = vi.fn(), onClose = vi.fn()
    const harness = hookHarness(
        'src/components/modals/AddUserModal.jsx', 'AddUserModal',
        'handleSubmit,setName,setFile,name,file,uploading', '    return (',
        { supabase: { rpc, storage }, useToast: () => ({ showToast }), crypto: { randomUUID: () => 'test-uuid' } },
    )
    const view = harness.render({ isOpen: true, onUserAdded, onClose })
    return { harness, view, rpc, upload, publicUrl, showToast, onUserAdded, onClose }
}

describe('public Add Player flow', () => {
    it('creates a player without a login or picture and resets the form', async () => {
        const t = setup()
        t.view.setName('  Alice  ')
        await t.harness.render().handleSubmit({ preventDefault() {} })
        expect(t.rpc).toHaveBeenCalledWith('create_player', { p_name: 'Alice', p_avatar_url: null })
        expect(t.upload).not.toHaveBeenCalled()
        expect(t.onUserAdded).toHaveBeenCalledOnce()
        expect(t.onClose).toHaveBeenCalledOnce()
        expect(t.harness.render()).toMatchObject({ name: '', file: null, uploading: false })
    })

    it('attaches the optional avatar after a create-only upload', async () => {
        const t = setup(), file = { name: 'Portrait.PNG' }
        t.view.setName('Bob'); t.view.setFile(file)
        await t.harness.render().handleSubmit({ preventDefault() {} })
        expect(t.upload).toHaveBeenCalledWith('create/test-uuid.png', file, { upsert: false })
        expect(t.rpc).toHaveBeenCalledWith('create_player', { p_name: 'Bob', p_avatar_url: t.publicUrl })
    })

    it('keeps the entered name and form open when the database rejects creation', async () => {
        const t = setup({ error: { message: 'Creation rejected' } })
        t.view.setName('Carol')
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        try { await t.harness.render().handleSubmit({ preventDefault() {} }) }
        finally { log.mockRestore() }
        expect(t.showToast).toHaveBeenCalledWith('Error adding user: Creation rejected', 'error')
        expect(t.onUserAdded).not.toHaveBeenCalled()
        expect(t.onClose).not.toHaveBeenCalled()
        expect(t.harness.render()).toMatchObject({ name: 'Carol', uploading: false })
    })

    it('rejects a blank name before uploading or calling the database', async () => {
        const t = setup()
        t.view.setName('   ')
        await t.harness.render().handleSubmit({ preventDefault() {} })
        expect(t.showToast).toHaveBeenCalledWith('Please provide a name', 'error')
        expect(t.rpc).not.toHaveBeenCalled()
        expect(t.upload).not.toHaveBeenCalled()
    })
})
