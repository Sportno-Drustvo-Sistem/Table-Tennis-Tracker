import React from 'react'

export const PingPongIcon = ({ size = 24, className = "" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="14" cy="14" r="6" />
        <path d="M9.75 9.75 4.5 4.5" />
        <path d="m5 3 2 2" />
        <circle cx="18" cy="6" r="1.5" />
    </svg>
)

export const TennisIcon = ({ size = 24, className = "" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 22c0-5.523-4.477-10-10-10" />
        <path d="M22 12c-5.523 0-10-4.477-10-10" />
    </svg>
)
