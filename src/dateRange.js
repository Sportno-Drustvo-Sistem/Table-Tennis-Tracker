export const toLocalISO = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')

export const localDate = value => {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
}

export const localDateBounds = (startDate, endDate) => {
    const start = startDate ? localDate(startDate) : null
    const end = endDate ? localDate(endDate) : null
    if (end) end.setDate(end.getDate() + 1)
    return { start, end }
}

export const inLocalDateRange = (timestamp, startDate, endDate) => {
    const { start, end } = localDateBounds(startDate, endDate)
    const date = new Date(timestamp)
    return (!start || date >= start) && (!end || date < end)
}
