import React from 'react'

const DateRangePicker = ({ startDate, endDate, onStartDateChange, onEndDateChange }) => {
    const toLocalISO = (date) => {
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const d = String(date.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
    }

    const setPreset = (preset) => {
        const today = new Date()
        const todayStr = toLocalISO(today)

        if (preset === 'all') {
            onStartDateChange('')
            onEndDateChange('')
        } else if (preset === 'today') {
            onStartDateChange(todayStr)
            onEndDateChange(todayStr)
        } else if (preset === 'week') {
            const start = new Date(today)
            start.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)) // Monday
            onStartDateChange(toLocalISO(start))
            onEndDateChange(todayStr)
        } else if (preset === 'month') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1)
            onStartDateChange(toLocalISO(start))
            onEndDateChange(todayStr)
        }
    }

    const getActivePreset = () => {
        const today = new Date()
        const todayStr = toLocalISO(today)
        if (!startDate && !endDate) return 'all'
        if (startDate === todayStr && endDate === todayStr) return 'today'

        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1))
        if (startDate === toLocalISO(weekStart) && endDate === todayStr) return 'week'

        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        if (startDate === toLocalISO(monthStart) && endDate === todayStr) return 'month'

        return null
    }

    const activePreset = getActivePreset()

    const presetBtn = (label, key) => (
        <button
            onClick={() => setPreset(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activePreset === key
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 ring-1 ring-blue-300 dark:ring-blue-700'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
        >
            {label}
        </button>
    )

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 space-y-3">
            {/* Preset Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mr-1">Quick Filter:</span>
                {presetBtn('Today', 'today')}
                {presetBtn('This Week', 'week')}
                {presetBtn('This Month', 'month')}
                {presetBtn('All-Time', 'all')}
            </div>

            {/* Date Inputs */}
            <div className="flex items-center space-x-4">
                <div className="flex flex-col">
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => onStartDateChange(e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        style={{ colorScheme: 'light dark' }}
                    />
                </div>
                <div className="text-gray-300 dark:text-gray-600">→</div>
                <div className="flex flex-col">
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">End Date</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => onEndDateChange(e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        style={{ colorScheme: 'light dark' }}
                    />
                </div>
                {(startDate || endDate) && (
                    <button
                        onClick={() => {
                            onStartDateChange('')
                            onEndDateChange('')
                        }}
                        className="ml-auto text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium"
                    >
                        Clear
                    </button>
                )}
            </div>
        </div>
    )
}

export default DateRangePicker
