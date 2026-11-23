// Casino-ish sound effects for the Bets tab, synthesised with Web Audio so
// there are no files to ship. Every call is best-effort: no audio support, a
// browser that has not been tapped yet, or a muted phone just stays quiet.
import { useSyncExternalStore } from 'react'

const MUTE_KEY = 'betSoundsMuted'
const listeners = new Set()
let muted = (() => {
    try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
})()
let context = null

export const isSoundMuted = () => muted
export const setSoundMuted = (value) => {
    muted = Boolean(value)
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch { /* private mode */ }
    listeners.forEach(listener => listener())
}
const subscribe = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
}
export const useSoundMuted = () => useSyncExternalStore(subscribe, isSoundMuted, () => false)

const audio = () => {
    if (muted || typeof window === 'undefined') return null
    try {
        const Context = window.AudioContext || window.webkitAudioContext
        if (!Context) return null
        context ||= new Context()
        if (context.state === 'suspended') context.resume().catch(() => {})
        return context
    } catch {
        return null
    }
}

// Phones only allow sound after a tap, so the first tap anywhere wakes it up.
if (typeof window !== 'undefined') {
    const unlock = () => { audio(); window.removeEventListener('pointerdown', unlock) }
    window.addEventListener('pointerdown', unlock)
}

const tone = (ctx, { freq, at = 0, length = 0.15, type = 'sine', volume = 0.12, slideTo }) => {
    const start = ctx.currentTime + at
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + length)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + length + 0.02)
}

const noise = (ctx, { at = 0, length = 0.25, volume = 0.25 }) => {
    const start = ctx.currentTime + at
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    gain.gain.value = volume
    source.buffer = buffer
    source.connect(gain).connect(ctx.destination)
    source.start(start)
}

const play = (build) => {
    const ctx = audio()
    if (ctx) {
        try { build(ctx) } catch { /* never let a sound break the page */ }
    }
}

// Two bright pings: a chip hitting the felt.
export const chipSound = () => play(ctx => {
    tone(ctx, { freq: 2200, length: 0.08, type: 'triangle', volume: 0.08 })
    tone(ctx, { freq: 3100, at: 0.05, length: 0.1, type: 'triangle', volume: 0.06 })
})

// The counter ticking up.
export const tickSound = () => play(ctx => tone(ctx, { freq: 1400 + Math.random() * 400, length: 0.03, type: 'square', volume: 0.025 }))

// A rising arpeggio, longer and higher for each win tier.
export const winSound = (tier = 0) => play(ctx => {
    const notes = [523, 659, 784, 1047, 1319, 1568, 2093].slice(0, 4 + tier)
    notes.forEach((freq, i) => tone(ctx, { freq, at: i * 0.09, length: 0.35, type: 'triangle', volume: 0.1 }))
    const end = notes.length * 0.09
    ;[1047, 1319, 1568].forEach(freq => tone(ctx, { freq, at: end, length: 0.9 + tier * 0.3, type: 'sine', volume: 0.06 }))
    for (let i = 0; i < 6 + tier * 6; i++) tone(ctx, { freq: 2500 + ((i * 373) % 1500), at: end + i * 0.06, length: 0.07, type: 'triangle', volume: 0.04 })
})

// Two players colliding: a low thump and a crash.
export const slamSound = () => play(ctx => {
    tone(ctx, { freq: 160, length: 0.35, type: 'sine', volume: 0.35, slideTo: 40 })
    noise(ctx, { length: 0.3, volume: 0.18 })
})

// Sad trombone for a bust.
export const bustSound = () => play(ctx => {
    ;[392, 370, 349].forEach((freq, i) => tone(ctx, { freq, at: i * 0.28, length: 0.3, type: 'sawtooth', volume: 0.05 }))
    tone(ctx, { freq: 330, at: 0.84, length: 0.8, type: 'sawtooth', volume: 0.05, slideTo: 300 })
})

// A short fanfare for banners worth shouting about.
export const fanfareSound = () => play(ctx => {
    ;[784, 988, 1175].forEach((freq, i) => tone(ctx, { freq, at: i * 0.07, length: 0.22, type: 'square', volume: 0.04 }))
})
