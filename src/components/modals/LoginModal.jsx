import React, { useState } from 'react'
import { X, Lock, Unlock, AlertCircle } from 'lucide-react'

const LoginModal = ({ isOpen, onClose, onLogin }) => {
    const [pin, setPin] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        setError('')

        try {
            await onLogin(pin)
            setPin('')
            onClose()
        } catch (loginError) {
            setError(loginError?.message || 'Unable to unlock admin mode')
            setPin('')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-scale-in">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                            <Lock className="mr-2 text-blue-500" size={24} />
                            Admin Access
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Enter Admin PIN
                            </label>
                            <input
                                type="password"
                                inputMode="numeric"
                                value={pin}
                                onChange={(e) => {
                                    setPin(e.target.value)
                                    setError('')
                                }}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center text-2xl tracking-widest"
                                placeholder="••••••"
                                autoFocus
                                maxLength={6}
                                pattern="[0-9]{6}"
                                autoComplete="current-password"
                                disabled={submitting}
                            />
                        </div>

                        {error && (
                            <div className="flex items-center text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                                <AlertCircle size={16} className="mr-2" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting || pin.length !== 6}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center"
                        >
                            <Unlock size={20} className="mr-2" />
                            {submitting ? 'Checking…' : 'Unlock'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default LoginModal
