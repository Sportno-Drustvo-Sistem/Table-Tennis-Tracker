import React from 'react'
import { Lock, Unlock } from 'lucide-react'

const AdminButton = ({ isAdmin, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`
                p-2 rounded-lg transition-all duration-300 flex items-center gap-2
                ${isAdmin
                    ? 'bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}
            `}
            title={isAdmin ? "Logged in as Admin (Click to Logout)" : "Admin Login"}
        >
            {isAdmin ? <Unlock size={20} /> : <Lock size={20} />}
            <span className="text-sm font-semibold hidden md:inline">
                {isAdmin ? 'Admin' : 'Guest'}
            </span>
        </button>
    )
}

export default AdminButton
