import React from 'react'

// Line icons drawn on lucide's 24px grid so they sit alongside lucide-react icons.
const SportIcon = ({ size = 24, className = '', strokeWidth = 2, children }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {children}
    </svg>
)

export const PingPongIcon = (props) => (
    <SportIcon {...props}>
        <circle cx="10" cy="9" r="7" fill="currentColor" fillOpacity="0.2" />
        <path d="M8.5 16v4.5a1.5 1.5 0 0 0 3 0V16" />
        <circle cx="20" cy="18.5" r="2" fill="currentColor" />
    </SportIcon>
)

export const PadelIcon = (props) => (
    <SportIcon {...props}>
        <rect x="5" y="2" width="12" height="13" rx="6" />
        <path d="M11 15v2.5" />
        <path d="M9.5 17.5h3V22h-3z" />
        <path d="M9 6.5h.01M13 6.5h.01M11 9h.01M9 11.5h.01M13 11.5h.01" />
    </SportIcon>
)

export const TennisIcon = (props) => (
    <SportIcon {...props}>
        <circle cx="12" cy="12" r="10" />
        <path d="M5.5 4.4a10 10 0 0 1 0 15.2" />
        <path d="M18.5 4.4a10 10 0 0 0 0 15.2" />
    </SportIcon>
)
