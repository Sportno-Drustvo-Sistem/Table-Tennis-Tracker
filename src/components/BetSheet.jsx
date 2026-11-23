import React, { useState } from 'react'
import { X, Coins, Trash2, Flame } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { getAvatarFallback } from '../utils'
import { cancelBet, placeBet, placeLiveBet } from '../betPersistence'
import { STAKE_CHIPS, allowedSides, chipLabel, chipTone, betMultiplier, clampBetProbability, poolTotals, potentialPayout, walletBalance } from '../bettingUtils'
import { useToast } from '../contexts/useToast'
import { BetAvatar, BetList, BetPool, CountUp, MiniChip } from './MatchBets'

const selectedRing = 'ring-4 ring-amber-400 scale-110'
// A picked chip lifts off the table with a little overshoot.
const chipMotion = 'transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] active:scale-90'
const chipPicked = '-translate-y-1.5 scale-110 outline outline-[3px] outline-offset-2 outline-amber-400'
// Odds this long get a flame.
const LONG_SHOT = 3

const SIDE_STYLES = {
    1: {
        idle: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        active: 'border-blue-500 bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/40 motion-safe:animate-pop',
    },
    2: {
        idle: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
        active: 'border-red-500 bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg shadow-red-500/40 motion-safe:animate-pop',
    },
}

// Chips thrown up from the slip when a bet lands; more of them for an all-in.
const BURST_CHIPS = [10, 50, 100, 300, 500, 1000]
const ChipBurst = ({ count }) => (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-28 z-10 flex justify-center motion-reduce:hidden">
        {Array.from({ length: count }, (_, i) => {
            const spread = (i / (count - 1)) * 2 - 1
            return (
                <span key={i} className="absolute motion-safe:animate-chip-fly"
                    style={{ '--dx': `${Math.round(spread * 150)}px`, '--dy': `${-140 - ((i * 67) % 190)}px`, '--rot': `${Math.round(spread * 300)}deg`, animationDelay: `${(i % 5) * 40}ms` }}>
                    <MiniChip amount={BURST_CHIPS[i % BURST_CHIPS.length]} className="w-6 h-6" />
                </span>
            )
        })}
    </div>
)

const BETTOR_STORAGE_KEY = 'betSheetBettor'
const rememberedBettor = () => {
    try { return localStorage.getItem(BETTOR_STORAGE_KEY) } catch { return null }
}

// The bookie's sheet: pick who is betting, on whom and how much.
// On the umpire phone odds are those of the score at the moment it was opened,
// because no point can be scored while it covers the table.
// `remote` is any other phone: odds follow the live score, the server prices
// the bet itself, and the phone remembers who used it last. `scoreboard` is
// drawn under the title.
const BetSheet = ({ isOpen, onClose, marketId, player1, player2, users, wallets, bets, prob1, closed, closedReason = 'Betting is closed at match point.', snapshot, adminToken, remote = false, scoreboard = null }) => {
    const { showToast } = useToast()
    const [bettorId, setBettorId] = useState(() => {
        if (!remote) return null
        const id = rememberedBettor()
        return users.some(user => user.id === id) ? id : null
    })
    const [side, setSide] = useState(null)
    const [stake, setStake] = useState('')
    const [busy, setBusy] = useState(false)
    const [burst, setBurst] = useState(null)

    if (!isOpen) return null

    const players = { 1: player1, 2: player2 }
    const probability = { 1: clampBetProbability(prob1), 2: clampBetProbability(1 - prob1) }
    const multiplier = { 1: betMultiplier(probability[1]), 2: betMultiplier(probability[2]) }
    const usersById = Object.fromEntries(users.map(user => [user.id, user]))
    const bettors = [...users].sort((a, b) => a.name.localeCompare(b.name))
    const pool = poolTotals(bets)
    const names = { 1: player1.name, 2: player2.name }
    const hasBet = new Set(bets.map(bet => bet.user_id))

    const balance = bettorId ? walletBalance(wallets, bettorId) : 0
    const sides = bettorId ? allowedSides(bettorId, player1.id, player2.id, bets) : [1, 2]
    const activeSide = sides.includes(side) ? side : (sides.length === 1 ? sides[0] : null)
    const stakeValue = Number(stake)
    const stakeValid = Number.isInteger(stakeValue) && stakeValue >= 1 && stakeValue <= balance
    const allIn = stakeValid && stakeValue === balance
    const canPlace = !closed && !busy && bettorId && activeSide && stakeValid

    const pickBettor = (id) => {
        setBettorId(id)
        if (remote && id) {
            try { localStorage.setItem(BETTOR_STORAGE_KEY, id) } catch { /* private mode */ }
        }
        setSide(null)
        setStake('')
    }

    const handlePlace = async () => {
        if (!canPlace) return
        setBusy(true)
        try {
            if (remote) {
                await placeLiveBet(supabase, { marketId, userId: bettorId, side: activeSide, stake: stakeValue, multiplier: multiplier[activeSide] })
            } else {
                await placeBet(supabase, {
                    adminToken,
                    marketId,
                    player1Id: player1.id,
                    player2Id: player2.id,
                    userId: bettorId,
                    side: activeSide,
                    stake: stakeValue,
                    winProbability: Number(probability[activeSide].toFixed(4)),
                    snapshot,
                })
            }
            setBurst(last => ({ id: (last?.id || 0) + 1, count: allIn ? 24 : 12 }))
            const bettor = usersById[bettorId]?.name || 'Bet'
            showToast(allIn ? `${bettor} is all in on ${players[activeSide].name}!` : `${bettor} put ${stakeValue.toLocaleString()} on ${players[activeSide].name}`, 'success')
            // A phone of your own keeps you picked for the next bet.
            if (remote) {
                setSide(null)
                setStake('')
            } else pickBettor(null)
        } catch (error) {
            console.error(error)
            showToast('Bet not placed: ' + error.message, 'error')
        } finally {
            setBusy(false)
        }
    }

    const handleCancel = async (bet) => {
        setBusy(true)
        try {
            await cancelBet(supabase, { adminToken, betId: bet.id })
        } catch (error) {
            console.error(error)
            showToast('Bet not removed: ' + error.message, 'error')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="bet-sheet-title">
            <div className="relative w-full sm:max-w-lg max-h-[100dvh] sm:max-h-[90dvh] bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden motion-safe:animate-slide-up short:max-w-none short:rounded-none short:h-[100dvh]">
                {burst && <ChipBurst key={burst.id} count={burst.count} />}
                <div className="flex items-center justify-between px-4 pt-4 pb-2 short:pt-2 bg-gradient-to-b from-amber-50 to-transparent dark:from-amber-500/10">
                    <div className="min-w-0">
                        <h3 id="bet-sheet-title" className="flex items-center gap-2 text-lg font-black text-gray-900 dark:text-white">
                            <MiniChip amount={500} className="w-6 h-6" />
                            Bets
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums short:hidden">
                            {pool.count === 0 ? 'Nothing riding yet' : `${pool.count} ${pool.count === 1 ? 'bet' : 'bets'} · ${pool.total.toLocaleString()} points riding`}
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Close bets" className="p-2.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800">
                        <X size={20} />
                    </button>
                </div>

                {scoreboard && <div className="px-4 pb-3">{scoreboard}</div>}

                {/* Odds, doubling as the side picker; stays put above the list */}
                <div className="px-4 pb-3">
                    <div>
                        <div className="grid grid-cols-2 gap-2">
                            {[1, 2].map(n => (
                                <button
                                    key={n}
                                    type="button"
                                    disabled={closed || !bettorId || !sides.includes(n)}
                                    onClick={() => setSide(n)}
                                    aria-pressed={activeSide === n}
                                    className={`min-w-0 rounded-2xl border-2 p-3 short:p-2 flex items-center gap-3 text-left transition-colors disabled:cursor-not-allowed ${activeSide === n ? SIDE_STYLES[n].active : SIDE_STYLES[n].idle} ${bettorId && !sides.includes(n) ? 'opacity-40' : ''}`}
                                >
                                    <img loading="lazy" decoding="async" src={players[n].avatar_url || getAvatarFallback(players[n].name)} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                                    <span className="min-w-0">
                                        <span className="block font-bold truncate">{players[n].name}</span>
                                        <span className="flex items-center gap-1 text-xl font-black tabular-nums leading-tight">
                                            {multiplier[n].toFixed(2)}×
                                            {multiplier[n] >= LONG_SHOT && <Flame size={14} className={activeSide === n ? 'text-amber-300' : 'text-orange-500'} aria-label="Long shot" />}
                                        </span>
                                        <span className="block text-[11px] opacity-80">{Math.round(probability[n] * 100)}% to win</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                        {pool.total > 0 && <div className="mt-2 short:hidden"><BetPool bets={bets} names={names} /></div>}
                        {closed && (
                            <p className="mt-2 text-sm font-medium text-amber-600 dark:text-amber-400">{closedReason}</p>
                        )}
                        {remote && !closed && (
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 short:hidden">Odds move with every point. Your bet is locked at the odds shown when you tap Bet.</p>
                        )}
                        {!closed && bettorId && !activeSide && (
                            <p className="mt-2 text-sm font-medium text-amber-600 dark:text-amber-400">Tap the player {usersById[bettorId]?.name} is backing.</p>
                        )}
                        {!closed && bettorId && sides.length === 1 && hasBet.has(bettorId) && bettorId !== player1.id && bettorId !== player2.id && (
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{usersById[bettorId]?.name} already backs {players[sides[0]].name}. One player per match.</p>
                        )}
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-4">
                    {!closed && (
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Who is betting?</h4>
                                <div className="grid grid-cols-4 min-[400px]:grid-cols-5 gap-2">
                                    {bettors.map(user => (
                                        <button
                                            key={user.id}
                                            type="button"
                                            onClick={() => pickBettor(user.id)}
                                            aria-pressed={bettorId === user.id}
                                            className={`min-w-0 rounded-xl p-1.5 flex flex-col items-center gap-0.5 border-2 transition-colors ${bettorId === user.id
                                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30'
                                                : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                        >
                                            <span className="relative">
                                                <img loading="lazy" decoding="async" src={user.avatar_url || getAvatarFallback(user.name)} alt="" className="w-12 h-12 rounded-full object-cover" />
                                                {hasBet.has(user.id) && (
                                                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center ring-2 ring-white dark:ring-gray-900" title="Has a bet on this match">
                                                        <Coins size={10} />
                                                    </span>
                                                )}
                                            </span>
                                            <span className="w-full truncate text-center text-xs font-bold text-gray-800 dark:text-gray-100">{user.name}</span>
                                            <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{walletBalance(wallets, user.id)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                    )}

                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                            On this match{bets.length > 0 ? ` · ${bets.length}` : ''}
                        </h4>
                        {bets.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No bets yet.</p>
                        ) : (
                            <BetList bets={bets} getUser={id => usersById[id]} names={names} renderAction={remote ? undefined : bet => (
                                <button type="button" onClick={() => handleCancel(bet)} disabled={busy}
                                    aria-label={`Remove ${usersById[bet.user_id]?.name || ''} bet`}
                                    className="p-2.5 -mr-1.5 text-gray-400 hover:text-red-500 disabled:opacity-40">
                                    <Trash2 size={16} />
                                </button>
                            )} />
                        )}
                    </div>
                </div>

                {!closed && bettorId && (
                    <div className="px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2.5 mb-2.5">
                            <BetAvatar user={usersById[bettorId]} className="w-9 h-9" />
                            <div className="min-w-0 flex-1 leading-tight">
                                <div className="font-bold text-gray-900 dark:text-white truncate">{usersById[bettorId]?.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{balance.toLocaleString()} points to bet</div>
                            </div>
                            <button type="button" onClick={() => pickBettor(null)} aria-label="Pick someone else" className="p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <X size={18} />
                            </button>
                        </div>
                        {balance === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No points left until their bets are settled.</p>
                        ) : (
                            <div className="flex flex-wrap items-center gap-2.5">
                                {STAKE_CHIPS.filter(amount => amount < balance).map(amount => (
                                    <button key={amount} type="button" onClick={() => setStake(String(amount))} aria-pressed={stakeValue === amount}
                                        aria-label={`${amount} points`} style={chipTone(amount)}
                                        className={`bet-chip w-12 h-12 text-sm font-black tabular-nums ${chipMotion} ${stakeValue === amount ? chipPicked : 'can-hover:hover:-translate-y-0.5'}`}>
                                        <span className="relative">{chipLabel(amount)}</span>
                                    </button>
                                ))}
                                <button type="button" onClick={() => setStake(String(balance))} aria-pressed={allIn}
                                    className={`h-12 px-4 rounded-full flex items-center gap-1.5 text-sm font-black uppercase tracking-wide text-white bg-gradient-to-r from-orange-500 to-red-600 shadow-md transition-transform active:scale-95 ${allIn ? selectedRing : ''}`}>
                                    <Flame size={16} />
                                    All in
                                </button>
                                <input
                                    type="number" inputMode="numeric" min="1" max={balance} step="1"
                                    value={stake} onChange={e => setStake(e.target.value)}
                                    placeholder="Other" aria-label="Stake in points"
                                    className="w-24 h-12 px-3 rounded-full text-sm font-bold tabular-nums border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                            </div>
                        )}
                        {stake !== '' && !stakeValid && balance > 0 && (
                            <p className="mt-2 text-sm text-red-600 dark:text-red-400">Enter a whole number from 1 to {balance.toLocaleString()}.</p>
                        )}
                        {activeSide && stakeValid && (
                            <div className="mt-3 short:hidden flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-white bg-gradient-to-r from-gray-900 to-gray-700 dark:from-black dark:to-gray-800 shadow-md motion-safe:animate-slide-up">
                                <MiniChip amount={stakeValue} className="w-8 h-8" />
                                <div className="min-w-0 flex-1 leading-tight">
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{allIn ? 'All in on' : 'Backing'}</div>
                                    <div className="font-bold truncate">{players[activeSide].name} · {multiplier[activeSide].toFixed(2)}×</div>
                                </div>
                                <div className="text-right leading-tight flex-shrink-0">
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">To win · 10% to house</div>
                                    <div className="text-2xl font-black tabular-nums text-amber-400">+<CountUp value={potentialPayout(stakeValue, multiplier[activeSide]) - stakeValue} /></div>
                                </div>
                            </div>
                        )}
                        <button
                            type="button" onClick={handlePlace} disabled={!canPlace}
                            className={`mt-3 w-full py-3 rounded-xl text-white font-bold shadow-md transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none bg-gradient-to-r ${allIn && activeSide ? 'from-orange-500 to-red-600 shadow-red-500/30' : 'from-amber-500 to-orange-500 shadow-amber-500/30'} ${canPlace ? 'bet-shine' : ''}`}
                        >
                            {busy ? 'Placing…' : !activeSide ? 'Pick who they back' : !stakeValid ? 'Pick a stake'
                                : `${allIn ? 'All in!' : 'Bet'} ${stakeValue.toLocaleString()} on ${players[activeSide].name} · pays ${potentialPayout(stakeValue, multiplier[activeSide]).toLocaleString()}`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default BetSheet
