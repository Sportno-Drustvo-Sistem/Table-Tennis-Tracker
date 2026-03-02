import React from 'react'

export const PingPongIcon = ({ size = 24, className = "" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M15.5 13.5A7 7 0 1 0 8.5 6.5l-2.8 2.8a7 7 0 0 0 9.9 9.9l2.8-2.8Z" fill="currentColor" fillOpacity="0.15" />
        <path d="M19 16l3 3a2.121 2.121 0 0 1-3 3l-3-3" strokeWidth="2.5" />
        <path d="m15.5 13.5-3-3" />
        <circle cx="5" cy="19" r="2.5" fill="currentColor" stroke="none" />
    </svg>
)

export const TennisIcon = ({ size = 24, className = "" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.15" />
        <path d="M6 5.3A9.9 9.9 0 0 0 12 12a9.9 9.9 0 0 0 6 6.7" />
        <path d="M6 18.7A9.9 9.9 0 0 1 12 12a9.9 9.9 0 0 1 6-6.7" />
    </svg>
)
