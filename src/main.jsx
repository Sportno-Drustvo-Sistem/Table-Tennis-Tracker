import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/wght.css'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './contexts/ToastContext'
import { installAvatarFallback } from './avatarFallback'

installAvatarFallback()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
