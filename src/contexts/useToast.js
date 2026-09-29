import { useContext } from 'react'
import { ToastContextValue } from './ToastContextValue'

export const useToast = () => {
    const context = useContext(ToastContextValue)
    if (!context) throw new Error('useToast must be used within ToastProvider')
    return context
}
