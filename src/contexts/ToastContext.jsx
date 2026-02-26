import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

export const useToast = () => {
    const context = useContext(ToastContext)
    if (!context) throw new Error('useToast must be used within ToastProvider')
    return context
}

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([])
    const [confirmDialog, setConfirmDialog] = useState(null)

    const showToast = useCallback((message, type = 'info') => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 4000) // auto-dismiss
    }, [])

    const showConfirm = useCallback((message, onConfirm) => {
        setConfirmDialog({ message, onConfirm })
    }, [])

    const handleConfirm = () => {
        if (confirmDialog?.onConfirm) confirmDialog.onConfirm()
        setConfirmDialog(null)
    }

    const handleCancel = () => {
        setConfirmDialog(null)
    }

    return (
        <ToastContext.Provider value={{ showToast, showConfirm }}>
            {children}

            {/* Toasts Overlay */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto flex items-center p-4 rounded-xl shadow-lg border animate-slide-up transition-all ${toast.type === 'error' ? 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/90 dark:text-red-100 dark:border-red-800' :
                                toast.type === 'success' ? 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/90 dark:text-green-100 dark:border-green-800' :
                                    'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/90 dark:text-blue-100 dark:border-blue-800'
                            }`}
                    >
                        {toast.type === 'error' ? <AlertCircle className="w-5 h-5 mr-3" /> :
                            toast.type === 'success' ? <CheckCircle className="w-5 h-5 mr-3" /> :
                                <Info className="w-5 h-5 mr-3" />}
                        <span className="font-medium text-sm">{toast.message}</span>
                        <button
                            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                            className="ml-4 opacity-50 hover:opacity-100 transition-opacity"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Confirm Modal Overlay */}
            {confirmDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm overflow-hidden animate-scale-in">
                        <div className="p-6">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mx-auto mb-4">
                                <AlertCircle size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">Are you sure?</h3>
                            <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
                                {confirmDialog.message}
                            </p>
                        </div>
                        <div className="flex border-t border-gray-100 dark:border-gray-700/50">
                            <button
                                onClick={handleCancel}
                                className="flex-1 py-3 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                Cancel
                            </button>
                            <div className="w-px bg-gray-100 dark:bg-gray-700/50"></div>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 py-3 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ToastContext.Provider>
    )
}
