import defaultTheme from 'tailwindcss/defaultTheme'
import colors from 'tailwindcss/colors'
import plugin from 'tailwindcss/plugin'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  // Touch screens keep :hover after a tap, which left buttons stuck in their hover colour.
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter Variable', 'Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Neutral surfaces: every existing `gray-*` class picks up the zinc scale.
        gray: { ...colors.zinc, 950: '#0c0c0e' },
        // Per-sport accent, driven by `data-sport` on <html> (see index.css).
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          strong: 'rgb(var(--accent-strong) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          fg: 'rgb(var(--accent-fg) / <alpha-value>)',
        },
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        md: '0 2px 6px -1px rgb(0 0 0 / 0.07), 0 1px 3px -1px rgb(0 0 0 / 0.04)',
        lg: '0 8px 20px -4px rgb(0 0 0 / 0.10), 0 2px 6px -2px rgb(0 0 0 / 0.05)',
      },
      keyframes: {
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        // Betting: a picked card bounces, placed chips fly up out of the slip.
        'pop': {
          '0%': { transform: 'scale(0.94)' },
          '60%': { transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)' },
        },
        'chip-fly': {
          '0%': { transform: 'translate(0, 0) scale(0.3) rotate(0deg)', opacity: '0' },
          '15%': { opacity: '1' },
          '70%': { opacity: '1' },
          '100%': { transform: 'translate(var(--dx), var(--dy)) scale(1) rotate(var(--rot))', opacity: '0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        // Big-win celebration on the Bets tab.
        'chip-rain': {
          '0%': { transform: 'translate(0, -15vh) rotate(0deg)', opacity: '0' },
          '10%': { opacity: '1' },
          '85%': { opacity: '1' },
          '100%': { transform: 'translate(var(--drift), 110vh) rotate(var(--rot))', opacity: '0' },
        },
        'jackpot-in': {
          '0%': { transform: 'scale(0.3) rotate(-8deg)', opacity: '0' },
          '55%': { transform: 'scale(1.08) rotate(2deg)', opacity: '1' },
          '75%': { transform: 'scale(0.97) rotate(-1deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-14deg)' },
          '50%': { transform: 'rotate(14deg)' },
        },
      },
      animation: {
        'pop': 'pop 260ms ease-out',
        'chip-fly': 'chip-fly 900ms cubic-bezier(0.2, 0.7, 0.3, 1) both',
        'float': 'float 2.4s ease-in-out infinite',
        'chip-rain': 'chip-rain 2.2s cubic-bezier(0.4, 0, 0.8, 0.6) 2 both',
        'jackpot-in': 'jackpot-in 650ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
        'wiggle': 'wiggle 450ms ease-in-out infinite',
        'spin-slow': 'spin 14s linear infinite',
        'slide-up': 'slide-up 180ms ease-out',
        'fade-in': 'fade-in 150ms ease-out',
        'scale-in': 'scale-in 150ms ease-out',
      },
    },
  },
  // Variants rather than `screens` entries: object screens disable `min-[…]:` variants.
  plugins: [
    plugin(({ addVariant }) => {
      // Phones held sideways: wide enough for `sm:` but too short for the stacked layouts.
      // Tailwind emits plugin variants before `sm:`, so `html &` lets these win over it.
      addVariant('short', '@media (max-height: 500px) { html & }')
      // Mouse-style pointers only; touch devices never see hover-revealed controls.
      addVariant('can-hover', '@media (hover: hover) and (pointer: fine)')
    }),
  ],
}
