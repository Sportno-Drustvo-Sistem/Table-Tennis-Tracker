import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../contexts/ToastContext'

const EditUserModal = ({ isOpen, onClose, user, onUserUpdated, onViewStats, isAdmin }) => {
    const { showToast } = useToast()
    const [name, setName] = useState('')
    const [file, setFile] = useState(null)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        if (user) {
            setName(user.name)
        }
    }, [user])

    if (!isOpen) return null

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!name) return showToast('Please provide a name', 'error')

        setUploading(true)
        try {
            let publicUrl = user.avatar_url

            if (file) {
                const fileExt = file.name.split('.').pop()
                const fileName = `${user.id}-${Date.now()}.${fileExt}`
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
            console.error(error)
            showToast('Error updating user: ' + error.message, 'error')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-md m-4 shadow-xl border border-gray-100 dark:border-gray-700">
                <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Edit Player</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Profile Picture (Optional)</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={e => setFile(e.target.files[0])}
                            className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-200"
                        />
                    </div>

                    {isAdmin ? (
                        <div className="flex justify-end space-x-2 pt-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                            <button type="submit" disabled={uploading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                {uploading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex justify-end space-x-2 pt-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Close</button>
                            <button
                                type="button"
                                onClick={() => {
                                    onViewStats(user.id)
                                    onClose()
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                View Stats
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    )
}

export default EditUserModal
