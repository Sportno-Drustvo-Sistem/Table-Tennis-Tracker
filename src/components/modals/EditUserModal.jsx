import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

const EditUserModal = ({ isOpen, onClose, user, onUserUpdated }) => {
    const [name, setName] = useState('')
    const [file, setFile] = useState(null)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        if (user) {
            setName(user.name)
            setFile(null)
        }
    }, [user])

    if (!isOpen || !user) return null

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!name) return alert('Please provide a name')

        setUploading(true)
        try {
            let publicUrl = user.avatar_url

            if (file) {
                const fileExt = file.name.split('.').pop()
                const fileName = `${Date.now()}.${fileExt}`
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, file)

                if (uploadError) throw uploadError

                const { data } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(fileName)
                publicUrl = data.publicUrl
            }

            const { error: updateError } = await supabase
                .from('users')
                .update({ name, avatar_url: publicUrl })
                .eq('id', user.id)

            if (updateError) throw updateError

            onUserUpdated()
            onClose()
        } catch (error) {
            alert('Error updating user: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md m-4">
                <h2 className="text-2xl font-bold mb-4">Edit Player</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">New Profile Picture (Optional)</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={e => setFile(e.target.files[0])}
                            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                        <button type="submit" disabled={uploading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            {uploading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default EditUserModal
