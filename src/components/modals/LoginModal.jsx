import React, { useState } from 'react'
import { X, Lock, Unlock, AlertCircle } from 'lucide-react'

const LoginModal = ({ isOpen, onClose, onLogin }) => {
    const [pin, setPin] = useState('')
    const [error, setError] = useState('')

    // Hardcoded PIN for now - could be moved to env later
    const ADMIN_PIN = '1234'

    const handleSubmit = (e) => {
        e.preventDefault()
        if (pin === ADMIN_PIN) {
            onLogin()
            setPin('')
            setError('')
            onClose()
        } else {
            setError('Incorrect PIN')
            setPin('')
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
                                placeholder="••••"
                                autoFocus
                                maxLength={4}
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
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center"
                        >
                            <Unlock size={20} className="mr-2" />
                            Unlock
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default LoginModal
