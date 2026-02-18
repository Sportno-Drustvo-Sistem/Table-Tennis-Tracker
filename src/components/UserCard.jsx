import React from 'react'
import { Check, Trophy, Pencil } from 'lucide-react'

const UserCard = ({ user, isSelected, selectionMode, onClick, onEdit, isAdmin }) => {
    return (
        <div
            onClick={onClick}
            className={`
        relative group flex flex-col items-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md transition-all cursor-pointer
        hover:shadow-lg border-2
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-transparent dark:border-gray-700'}
        ${selectionMode ? 'hover:border-blue-300 dark:hover:border-blue-700' : ''}
      `}
        >
            <div className="relative w-24 h-24 mb-4">
                <img
                    src={user.avatar_url || 'https://via.placeholder.com/150'}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover border-4 border-gray-100 dark:border-gray-700"
                />
                {isSelected && (
                    <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-1">
                        <Check size={16} />
                    </div>
                )}
                {!selectionMode && isAdmin && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onEdit(user)
                        }}
                        className="absolute bottom-0 right-0 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900 dark:hover:text-blue-200"
                    >
                        <Pencil size={14} />
                    </button>
                )}
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">{user.name}</h3>
            <div className="flex items-center mt-2 text-yellow-500 font-semibold">
                <Trophy size={16} className="mr-1" />
                <span>{user.total_wins} Wins</span>
            </div>
        </div>
    )
}

export default UserCard
