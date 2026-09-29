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
        <circle cx="9.5" cy="9.5" r="6.5" />
        <path d="m14.1 14.1 1.4 1.4" />
        <path d="m15.5 15.5 3.3 3.3a1.4 1.4 0 0 1-2 2l-3.3-3.3" />
        <circle cx="19" cy="5" r="2" />
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
