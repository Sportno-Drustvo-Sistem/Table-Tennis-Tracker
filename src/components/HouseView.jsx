import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, Check, Search, TrendingDown, TrendingUp, Scale, PencilLine, Users, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { loadWalletAdjustments, payOut, setWalletBalance } from '../betPersistence'
import { STARTING_BALANCE, formatPoints, houseTotals, walletBalance } from '../bettingUtils'
import { useToast } from '../contexts/useToast'
import { BetAvatar } from './MatchBets'

const card = 'bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700'
const points = value => value.toLocaleString()
const MAX_POINTS = 10000000
const TOP_UP = 1000

const toneOf = value => (value > 0 ? 'text-green-600 dark:text-green-400' : value < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200')

const Stat = (props) => {
    const { Icon, label, value, detail, tone } = props
    return (
    <div className="p-3 sm:p-4 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/60 min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Icon size={13} className={tone} />
            <span className="leading-tight">{label}</span>
        </div>
        <div className={`mt-1 text-xl font-black tabular-nums ${tone}`}>{value}</div>
        {detail && <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{detail}</div>}
    </div>
    )
}

// The headline number plus where it came from.
const HouseSummary = ({ totals, editCount }) => {
    const flow = totals.collected + totals.paidOut
    const wonShare = flow ? (totals.collected / flow) * 100 : 0
    return (
        <section aria-label="House totals" className={card}>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        <Scale size={14} /> House net
                    </div>
                    <div className={`mt-1 text-4xl sm:text-5xl font-black tabular-nums tracking-tight ${toneOf(totals.net)}`}>{formatPoints(totals.net)}</div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {totals.riding ? <><span className="font-semibold tabular-nums text-gray-700 dark:text-gray-200">{points(totals.riding)}</span> riding on open bets</> : 'From settled bets'}
                    </div>
                </div>
                {flow > 0 && (
                    <div className="w-full sm:w-64">
                        <div className="flex justify-between text-xs font-bold tabular-nums mb-1">
                            <span className="text-green-600 dark:text-green-400">+{points(totals.collected)} won</span>
                            <span className="text-red-600 dark:text-red-400">−{points(totals.paidOut)} paid</span>
                        </div>
                        <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700" role="img"
                            aria-label={`${totals.collected} points won from losses, ${totals.paidOut} paid on wins`}>
                            <div className="bg-green-500" style={{ width: `${wonShare}%` }} />
                            <div className="flex-1 bg-red-500" />
                        </div>
                    </div>
                )}
            </div>
            <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <Stat Icon={TrendingUp} label="Won from losses" value={`+${points(totals.collected)}`}
                    detail={plural(totals.lostBets, 'lost bet')} tone="text-green-600 dark:text-green-400" />
                <Stat Icon={TrendingDown} label="Paid on wins" value={`−${points(totals.paidOut)}`}
                    detail={`${plural(totals.wonBets, 'winning bet')}, profit only`} tone="text-red-600 dark:text-red-400" />
                <Stat Icon={PencilLine} label="Paid in" value={formatPoints(totals.adjusted)}
                    detail={`${plural(editCount, 'manual edit')}${totals.restartCount ? ` · ${points(totals.restarts)} in past restarts` : ''}`}
                    tone="text-blue-600 dark:text-blue-400" />
                <Stat Icon={Banknote} label="Cashed out" value={points(totals.cashedOut)}
                    detail={`${plural(totals.payoutCount, 'payout')} to players`} tone="text-amber-600 dark:text-amber-400" />
            </div>
        </section>
    )
}

const chip = 'inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold border active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100'

const WalletRow = ({ user, balance, rank, adminToken, onSaved }) => {
    const { showToast } = useToast()
    const [draft, setDraft] = useState(String(balance))
    const [saving, setSaving] = useState(false)
    // Follow live updates (a bet, a payout) unless an edit is in progress.
    const [editing, setEditing] = useState(false)
    useEffect(() => { if (!editing) setDraft(String(balance)) }, [balance, editing])

    const value = Number(draft)
    const valid = draft.trim() !== '' && Number.isInteger(value) && value >= 0 && value <= MAX_POINTS
    const changed = valid && value !== balance

    const store = async (next) => {
        setSaving(true)
        try {
            await setWalletBalance(supabase, { adminToken, userId: user.id, balance: next })
            showToast(`${user.name}: ${points(balance)} → ${points(next)} points`, 'success')
            setEditing(false)
            onSaved()
        } catch (error) {
            console.error(error)
            showToast('Points not saved: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }
    const save = (event) => {
        event.preventDefault()
        if (changed) store(value)
    }
    // Adds to the saved balance, not to whatever is typed in the box.
    const canTopUp = balance + TOP_UP <= MAX_POINTS
    const [paying, setPaying] = useState(false)

    return (
        <li className="py-3">
        <form onSubmit={save} className="flex items-center gap-3">
            <div className="relative shrink-0">
                <BetAvatar user={user} className="w-10 h-10" />
                {rank <= 3 && balance > 0 && (
                    <span aria-label={`Rank ${rank}`} className="absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black bg-amber-400 text-amber-950 ring-2 ring-white dark:ring-gray-800">{rank}</span>
                )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <div className="font-semibold text-gray-900 dark:text-white truncate sm:flex-1">{user.name}</div>
                <div className="flex gap-1.5">
                    <button type="button" onClick={() => store(balance + TOP_UP)} disabled={saving || !canTopUp}
                        aria-label={`Add ${points(TOP_UP)} points for ${user.name}`}
                        className={`${chip} tabular-nums text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800`}>
                        +{points(TOP_UP)}
                    </button>
                    <button type="button" onClick={() => setPaying(open => !open)} disabled={saving || balance < 1} aria-expanded={paying}
                        aria-label={`Pay out points for ${user.name}`}
                        className={`${chip} ${paying
                            ? 'text-white bg-amber-500 border-amber-500'
                            : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'}`}>
                        <Banknote size={12} className="hidden min-[400px]:block" /> Pay out
                    </button>
                </div>
            </div>
            <div className="relative shrink-0">
                <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_POINTS}
                    step={1}
                    value={draft}
                    aria-label={`Points for ${user.name}`}
                    onFocus={() => setEditing(true)}
                    onBlur={() => { if (!changed) setEditing(false) }}
                    onChange={e => { setEditing(true); setDraft(e.target.value) }}
                    onKeyDown={e => { if (e.key === 'Escape') { setDraft(String(balance)); setEditing(false); e.currentTarget.blur() } }}
                    disabled={saving}
                    className={`w-[6.75rem] sm:w-36 py-2 pl-2 pr-10 text-right text-lg tabular-nums font-black rounded-lg border bg-gray-50/60 dark:bg-gray-700/40 text-gray-900 dark:text-white outline-none transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/70 focus:bg-gray-50 dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${valid ? (changed ? 'border-blue-400' : 'border-transparent') : 'border-red-400'}`}
                />
                {changed ? (
                    <button type="submit" disabled={saving} aria-label={`Save points for ${user.name}`}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md bg-blue-600 text-white active:scale-95 transition-transform">
                        <Check size={16} strokeWidth={3} />
                    </button>
                ) : (
                    <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-gray-400">pts</span>
                )}
            </div>
        </form>
        {paying && <PayoutForm user={user} balance={balance} adminToken={adminToken} onDone={() => setPaying(false)} />}
        </li>
    )
}

// Takes points out of one wallet when the player cashes them in.
const PayoutForm = ({ user, balance, adminToken, onDone }) => {
    const { showToast, showConfirm } = useToast()
    const winnings = balance - STARTING_BALANCE
    const [draft, setDraft] = useState(String(winnings > 0 ? winnings : balance))
    const [note, setNote] = useState('')
    const [saving, setSaving] = useState(false)
    const amount = Number(draft)
    const valid = Number.isInteger(amount) && amount >= 1 && amount <= balance

    const submit = (event) => {
        event.preventDefault()
        if (!valid || saving) return
        showConfirm(`Pay out ${points(amount)} points to ${user.name}? Their balance goes from ${points(balance)} to ${points(balance - amount)}.`, async () => {
            setSaving(true)
            try {
                await payOut(supabase, { adminToken, userId: user.id, amount, note: note.trim() || null })
                showToast(`Paid out ${points(amount)} points to ${user.name}`, 'success')
                onDone()
            } catch (error) {
                console.error(error)
                showToast('Payout not saved: ' + error.message, 'error')
                setSaving(false)
            }
        })
    }

    const quick = [
        winnings > 0 && winnings < balance && { label: `Winnings ${points(winnings)}`, value: winnings },
        { label: `All ${points(balance)}`, value: balance },
    ].filter(Boolean)

    return (
        <form onSubmit={submit} aria-label={`Pay out for ${user.name}`}
            className="mt-2 ml-[3.25rem] p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-bold text-amber-800 dark:text-amber-200"><Banknote size={16} /> Pay out</span>
                <button type="button" onClick={onDone} aria-label="Close pay out" className="p-1 -m-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={16} /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {quick.map(option => (
                    <button key={option.label} type="button" onClick={() => setDraft(String(option.value))} aria-pressed={amount === option.value}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold tabular-nums border ${amount === option.value
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200'}`}>
                        {option.label}
                    </button>
                ))}
            </div>
            <div className="flex gap-2">
                <input type="number" inputMode="numeric" min={1} max={balance} step={1} value={draft} onChange={e => setDraft(e.target.value)}
                    aria-label={`Points to pay out to ${user.name}`} disabled={saving}
                    className={`w-28 shrink-0 p-2 text-right tabular-nums font-bold rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 ${valid ? 'border-gray-200 dark:border-gray-600' : 'border-red-400'}`} />
                <input type="text" value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="Note (optional)"
                    aria-label="Payout note" disabled={saving}
                    className="min-w-0 flex-1 p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            {!valid && <p className="text-xs text-red-600 dark:text-red-400">Pay out a whole number from 1 to {points(balance)}.</p>}
            <button type="submit" disabled={!valid || saving}
                className="w-full py-2 rounded-lg text-sm font-bold text-white bg-amber-500 disabled:opacity-40">
                {saving ? 'Paying out…' : valid ? `Pay out ${points(amount)} · ${points(balance - amount)} left` : 'Pay out'}
            </button>
        </form>
    )
}

const HISTORY_PAGE = 20
const when = iso => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

// Every manual points edit and payout, newest first, optionally for one player.
export const EditHistory = ({ adjustments, payouts = [], users, usersById }) => {
    const [playerId, setPlayerId] = useState('')
    const [shown, setShown] = useState(HISTORY_PAGE)
    const entries = useMemo(() => [
        ...adjustments.map(row => ({ ...row, key: `edit-${row.id}`, kind: 'edit', change: row.new_balance - row.old_balance })),
        ...payouts.map(row => ({ ...row, key: `payout-${row.id}`, kind: 'payout', old_balance: row.balance_before, new_balance: row.balance_after, change: -row.amount })),
    ].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0)), [adjustments, payouts])
    const people = useMemo(() => {
        const ids = new Set(entries.map(row => row.user_id))
        return users.filter(user => ids.has(user.id)).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }, [entries, users])
    const rows = playerId ? entries.filter(row => row.user_id === playerId) : entries
    const edits = rows.filter(row => row.kind === 'edit')
    const paid = rows.filter(row => row.kind === 'payout')
    const summary = [
        edits.length && `${plural(edits.length, 'edit')} · net ${formatPoints(edits.reduce((sum, row) => sum + row.change, 0))} points`,
        paid.length && `${plural(paid.length, 'payout')} · ${points(paid.reduce((sum, row) => sum + row.amount, 0))} paid out`,
    ].filter(Boolean).join(' · ')

    return (
        <section className={card} aria-label="Points history">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                    <PencilLine size={18} /> Points history
                </h2>
                {people.length > 1 && (
                    <select value={playerId} onChange={e => { setPlayerId(e.target.value); setShown(HISTORY_PAGE) }} aria-label="Show history for"
                        className="w-full sm:w-56 p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">All players</option>
                        {people.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                )}
            </div>
            {rows.length === 0 ? (
                <p className="py-4 text-sm text-center text-gray-500 dark:text-gray-400">No point edits or payouts yet. Every change you make above is listed here.</p>
            ) : (
                <>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 tabular-nums">{summary}</p>
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {rows.slice(0, shown).map(row => {
                            const user = usersById[row.user_id]
                            const payout = row.kind === 'payout'
                            return (
                                <li key={row.key} className="flex items-center gap-3 py-2.5 text-sm">
                                    <BetAvatar user={user} className="w-8 h-8" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="truncate font-semibold text-gray-900 dark:text-white">{user?.name || 'Unknown'}</span>
                                            {payout && <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 rounded text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40"><Banknote size={10} /> Payout</span>}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums truncate">
                                            {points(row.old_balance)} → {points(row.new_balance)} · <time dateTime={row.created_at}>{when(row.created_at)}</time>
                                            {row.note && <> · {row.note}</>}
                                        </div>
                                    </div>
                                    <span className={`shrink-0 text-right tabular-nums font-bold ${payout ? 'text-amber-600 dark:text-amber-400' : row.change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatPoints(row.change)}</span>
                                </li>
                            )
                        })}
                    </ul>
                    {rows.length > shown && (
                        <button type="button" onClick={() => setShown(count => count + HISTORY_PAGE)}
                            className="mt-3 w-full py-2 rounded-lg text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30">
                            Show {Math.min(HISTORY_PAGE, rows.length - shown)} more
                        </button>
                    )}
                </>
            )}
        </section>
    )
}

// Super admin only: everyone's points, editable, what the house made, and
// every manual edit.
const HouseView = ({ users, wallets, bets, payouts = [], adminToken }) => {
    const [adjustments, setAdjustments] = useState([])
    const [query, setQuery] = useState('')

    const refreshAdjustments = useCallback(() => (
        loadWalletAdjustments(supabase, { adminToken })
            .then(rows => setAdjustments(Array.isArray(rows) ? rows : []))
            .catch(error => console.error('Failed to load point edits:', error))
    ), [adminToken])
    useEffect(() => { refreshAdjustments() }, [refreshAdjustments])

    const totals = houseTotals(bets, wallets, adjustments, payouts)
    const usersById = useMemo(() => Object.fromEntries(users.map(user => [user.id, user])), [users])
    const rows = useMemo(() => {
        const needle = query.trim().toLowerCase()
        // Rank on the full list so a search keeps everyone's place.
        return users
            .map(user => ({ user, balance: walletBalance(wallets, user.id) }))
            .sort((a, b) => b.balance - a.balance || (a.user.name || '').localeCompare(b.user.name || ''))
            .map((row, index) => ({ ...row, rank: index + 1 }))
            .filter(({ user }) => !needle || (user.name || '').toLowerCase().includes(needle))
    }, [users, wallets, query])

    const inWallets = useMemo(() => users.reduce((sum, user) => sum + walletBalance(wallets, user.id), 0), [users, wallets])

    return (
        <div className="space-y-5 sm:space-y-6">
            <HouseSummary totals={totals} editCount={adjustments.length} />

            <section className={card} aria-label="Everyone's points">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white"><Users size={18} /> Everyone's points</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">{plural(users.length, 'player')} · {points(inWallets)} points in wallets</p>
                    </div>
                    <label className="relative w-full sm:w-56">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a player" aria-label="Find a player"
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </label>
                </div>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Tap a balance to type a new total, then tap the tick. New players start at 0.</p>
                <ul className="mt-1 divide-y divide-gray-100 dark:divide-gray-700">
                    {rows.map(({ user, balance, rank }) => (
                        <WalletRow key={user.id} user={user} balance={balance} rank={rank} adminToken={adminToken} onSaved={refreshAdjustments} />
                    ))}
                    {rows.length === 0 && <li className="py-4 text-sm text-center text-gray-500 dark:text-gray-400">No players match.</li>}
                </ul>
            </section>

            <EditHistory adjustments={adjustments} payouts={payouts} users={users} usersById={usersById} />
        </div>
    )
}

export default HouseView
