import React, { useState } from 'react'
import { X, Coins, Trash2, Flame } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { getAvatarFallback } from '../utils'
import { cancelBet, placeBet } from '../betPersistence'
import { STAKE_CHIPS, allowedSides, betMultiplier, clampBetProbability, poolTotals, potentialPayout, walletBalance } from '../bettingUtils'
import { useToast } from '../contexts/useToast'
import { BetAvatar, BetList, BetPool } from './MatchBets'

// Stake buttons drawn as poker chips, one colour per value.
const CHIP_COLORS = { 10: 'bg-sky-600', 50: 'bg-emerald-600', 100: 'bg-violet-600', 250: 'bg-gray-950 dark:bg-black' }
const selectedRing = 'ring-4 ring-amber-400 scale-110'

const SIDE_STYLES = {
    1: {
        idle: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        active: 'border-blue-500 bg-blue-500 text-white',
    },
    2: {
        idle: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
        active: 'border-red-500 bg-red-500 text-white',
    },
}

// The bookie's sheet on the umpire phone: pick who is betting, on whom and how
// much. Odds are those of the score at the moment it was opened, because no
// point can be scored while it covers the table.
const BetSheet = ({ isOpen, onClose, marketId, player1, player2, users, wallets, bets, prob1, closed, snapshot, adminToken }) => {
    const { showToast } = useToast()
    const [bettorId, setBettorId] = useState(null)
    const [side, setSide] = useState(null)
    const [stake, setStake] = useState('')
    const [busy, setBusy] = useState(false)

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
    const sides = bettorId ? allowedSides(bettorId, player1.id, player2.id) : [1, 2]
    const activeSide = sides.includes(side) ? side : (sides.length === 1 ? sides[0] : null)
    const stakeValue = Number(stake)
    const stakeValid = Number.isInteger(stakeValue) && stakeValue >= 1 && stakeValue <= balance
    const allIn = stakeValid && stakeValue === balance
    const canPlace = !closed && !busy && bettorId && activeSide && stakeValid

    const pickBettor = (id) => {
        setBettorId(id)
        setSide(null)
        setStake('')
    }

    const handlePlace = async () => {
        if (!canPlace) return
        setBusy(true)
        try {
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
            const bettor = usersById[bettorId]?.name || 'Bet'
            showToast(allIn ? `${bettor} is all in on ${players[activeSide].name}!` : `${bettor} put ${stakeValue.toLocaleString()} on ${players[activeSide].name}`, 'success')
            pickBettor(null)
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
            <div className="w-full sm:max-w-lg max-h-[100dvh] sm:max-h-[90dvh] bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden short:max-w-none short:rounded-none short:h-[100dvh]">
                <div className="flex items-center justify-between px-4 pt-4 pb-2 short:pt-2">
                    <div className="min-w-0">
                        <h3 id="bet-sheet-title" className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                            <Coins size={20} className="text-amber-500" />
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
                                    <img src={players[n].avatar_url || getAvatarFallback(players[n].name)} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                                    <span className="min-w-0">
                                        <span className="block font-bold truncate">{players[n].name}</span>
                                        <span className="block text-xl font-black tabular-nums leading-tight">{multiplier[n].toFixed(2)}×</span>
                                        <span className="block text-[11px] opacity-80">{Math.round(probability[n] * 100)}% to win</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                        {pool.total > 0 && <div className="mt-2 short:hidden"><BetPool bets={bets} names={names} /></div>}
                        {closed && (
                            <p className="mt-2 text-sm font-medium text-amber-600 dark:text-amber-400">Betting is closed at match point.</p>
                        )}
                        {!closed && bettorId && !activeSide && (
                            <p className="mt-2 text-sm font-medium text-amber-600 dark:text-amber-400">Tap the player {usersById[bettorId]?.name} is backing.</p>
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
                                                <img src={user.avatar_url || getAvatarFallback(user.name)} alt="" className="w-12 h-12 rounded-full object-cover" />
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
                            <BetList bets={bets} getUser={id => usersById[id]} names={names} renderAction={bet => (
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
                                        className={`w-12 h-12 rounded-full border-[3px] border-dashed border-white/70 text-white text-sm font-black tabular-nums shadow-md transition-transform active:scale-95 ${CHIP_COLORS[amount] || 'bg-gray-600'} ${stakeValue === amount ? selectedRing : ''}`}>
                                        {amount}
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
                        <button
                            type="button" onClick={handlePlace} disabled={!canPlace}
                            className={`mt-3 w-full py-3 rounded-xl text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed ${allIn && activeSide ? 'bg-gradient-to-r from-orange-500 to-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}
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
