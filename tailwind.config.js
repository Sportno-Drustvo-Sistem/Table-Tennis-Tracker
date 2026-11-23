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
        // Epic win: the whole screen rattles; a result slam rattles once.
        'shake': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '20%': { transform: 'translate(-6px, 3px)' },
          '40%': { transform: 'translate(5px, -4px)' },
          '60%': { transform: 'translate(-4px, -2px)' },
          '80%': { transform: 'translate(4px, 3px)' },
        },
        'flash': {
          '0%': { opacity: '0' },
          '15%': { opacity: '0.55' },
          '100%': { opacity: '0' },
        },
        'shimmer': {
          from: { backgroundPosition: '0% center' },
          to: { backgroundPosition: '200% center' },
        },
        // Match result: players slam in from the sides, the loser is knocked out.
        'slam-left': {
          '0%': { transform: 'translateX(-120%) scale(0.8)', opacity: '0' },
          '85%': { transform: 'translateX(12%) scale(1.05)', opacity: '1' },
          '100%': { transform: 'translateX(0) scale(1)' },
        },
        'slam-right': {
          '0%': { transform: 'translateX(120%) scale(0.8)', opacity: '0' },
          '85%': { transform: 'translateX(-12%) scale(1.05)', opacity: '1' },
          '100%': { transform: 'translateX(0) scale(1)' },
        },
        'ko': {
          '0%': { transform: 'rotate(0) translateY(0)', filter: 'grayscale(0)' },
          '40%': { transform: 'rotate(-18deg) translateY(-6px)' },
          '100%': { transform: 'rotate(12deg) translateY(10px) scale(0.88)', filter: 'grayscale(1) brightness(0.7)' },
        },
        'winner-rise': {
          '0%': { transform: 'scale(1)' },
          '60%': { transform: 'scale(1.18) translateY(-6px)' },
          '100%': { transform: 'scale(1.1) translateY(-4px)' },
        },
        'crown-drop': {
          '0%': { transform: 'translate(-50%, -40px) rotate(-30deg)', opacity: '0' },
          '70%': { transform: 'translate(-50%, 4px) rotate(8deg)', opacity: '1' },
          '100%': { transform: 'translate(-50%, 0) rotate(0)', opacity: '1' },
        },
        'stamp': {
          '0%': { transform: 'scale(2.4) rotate(-6deg)', opacity: '0' },
          '60%': { transform: 'scale(0.94) rotate(1deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0)', opacity: '1' },
        },
        'rise-in': {
          from: { transform: 'translateY(14px) scale(0.96)', opacity: '0' },
          to: { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '60%': { transform: 'scale(1.4)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        // Small "just happened" banners drop in from the top.
        'banner-in': {
          '0%': { transform: 'translateY(-140%)', opacity: '0' },
          '65%': { transform: 'translateY(8%)', opacity: '1' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
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
        'shake': 'shake 180ms linear infinite',
        'shake-once': 'shake 160ms linear 3 both',
        'flash': 'flash 500ms ease-out both',
        'shimmer': 'shimmer 1.6s linear infinite',
        'slam-left': 'slam-left 550ms cubic-bezier(0.5, 0, 0.75, 0) both',
        'slam-right': 'slam-right 550ms cubic-bezier(0.5, 0, 0.75, 0) both',
        'ko': 'ko 600ms ease-in both',
        'winner-rise': 'winner-rise 500ms ease-out both',
        'crown-drop': 'crown-drop 500ms cubic-bezier(0.3, 1.4, 0.6, 1) both',
        'stamp': 'stamp 420ms cubic-bezier(0.3, 1.3, 0.6, 1) both',
        'rise-in': 'rise-in 320ms ease-out both',
        'pop-in': 'pop-in 350ms ease-out both',
        'banner-in': 'banner-in 420ms cubic-bezier(0.3, 1.2, 0.6, 1) both',
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
