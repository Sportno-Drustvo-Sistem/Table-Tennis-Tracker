import React from 'react'

const DateRangePicker = ({ startDate, endDate, onStartDateChange, onEndDateChange }) => {
    return (
        <div className="flex items-center space-x-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
            <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Start Date</label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
            </div>
            <div className="text-gray-300">→</div>
            <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">End Date</label>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
            </div>
            {(startDate || endDate) && (
                <button
                    onClick={() => {
                        onStartDateChange('')
                        onEndDateChange('')
                    }}
                    className="ml-auto text-sm text-red-500 hover:text-red-700 font-medium"
                >
                    Clear
                </button>
            )}
        </div>
    )
}

export default DateRangePicker
