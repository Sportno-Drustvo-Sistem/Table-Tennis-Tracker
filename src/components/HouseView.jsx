import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, Check, Search, TrendingDown, TrendingUp, Scale, PencilLine, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { loadWalletAdjustments, payOut, setWalletBalance } from '../betPersistence'
import { STARTING_BALANCE, formatPoints, houseTotals, walletBalance } from '../bettingUtils'
import { useToast } from '../contexts/useToast'
import { BetAvatar } from './MatchBets'

const card = 'bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700'
const points = value => value.toLocaleString()
const MAX_POINTS = 10000000
const TOP_UP = 1000

const Stat = (props) => {
    const { Icon, label, value, detail, tone } = props
    return (
    <div className={`${card} !p-4`}>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Icon size={14} className={tone} />
            {label}
        </div>
        <div className={`mt-1 text-2xl font-black tabular-nums ${tone}`}>{value}</div>
        {detail && <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{detail}</div>}
    </div>
    )
}

const WalletRow = ({ user, balance, adminToken, onSaved }) => {
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
        <div className="py-2.5">
        <form onSubmit={save} className="flex items-center gap-3">
            <BetAvatar user={user} className="w-10 h-10" />
            <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-white truncate">{user.name}</div>
                <button type="button" onClick={() => store(balance + TOP_UP)} disabled={saving || !canTopUp}
                    aria-label={`Add ${points(TOP_UP)} points for ${user.name}`}
                    className="mt-1 px-2.5 py-1 rounded-full text-xs font-bold tabular-nums text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 active:scale-95 transition-transform disabled:opacity-40">
                    +{points(TOP_UP)}
                </button>
                <button type="button" onClick={() => setPaying(open => !open)} disabled={saving || balance < 1} aria-expanded={paying}
                    aria-label={`Pay out points for ${user.name}`}
                    className={`mt-1 ml-1.5 px-2.5 py-1 rounded-full text-xs font-bold border active:scale-95 transition-transform disabled:opacity-40 ${paying
                        ? 'text-white bg-amber-500 border-amber-500'
                        : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'}`}>
                    Pay out
                </button>
            </div>
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
                disabled={saving}
                className={`w-28 sm:w-32 p-2 text-right tabular-nums font-bold rounded-lg border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 ${valid ? 'border-gray-200 dark:border-gray-600' : 'border-red-400'}`}
            />
            <button type="submit" disabled={!changed || saving} aria-label={`Save points for ${user.name}`}
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-blue-600 text-white disabled:opacity-0 transition-opacity">
                <Check size={18} />
            </button>
        </form>
        {paying && <PayoutForm user={user} balance={balance} adminToken={adminToken} onDone={() => setPaying(false)} />}
        </div>
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
        return users
            .filter(user => !needle || (user.name || '').toLowerCase().includes(needle))
            .map(user => ({ user, balance: walletBalance(wallets, user.id) }))
            .sort((a, b) => b.balance - a.balance || (a.user.name || '').localeCompare(b.user.name || ''))
    }, [users, wallets, query])

    return (
        <div className="space-y-5 sm:space-y-6">
            <section aria-label="House totals" className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <Stat Icon={TrendingUp} label="Won from losses" value={`+${points(totals.collected)}`}
                    detail={`${totals.lostBets} lost ${totals.lostBets === 1 ? 'bet' : 'bets'}`} tone="text-green-600 dark:text-green-400" />
                <Stat Icon={TrendingDown} label="Paid on wins" value={`−${points(totals.paidOut)}`}
                    detail={`${totals.wonBets} winning ${totals.wonBets === 1 ? 'bet' : 'bets'}, profit only`} tone="text-red-600 dark:text-red-400" />
                <Stat Icon={Scale} label="House net" value={formatPoints(totals.net)}
                    detail={totals.riding ? `${points(totals.riding)} riding on open bets` : 'From settled bets'}
                    tone={totals.net > 0 ? 'text-green-600 dark:text-green-400' : totals.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'} />
                <Stat Icon={PencilLine} label="Paid in" value={formatPoints(totals.adjusted)}
                    detail={`${adjustments.length} manual ${adjustments.length === 1 ? 'edit' : 'edits'}${totals.restartCount ? ` · ${points(totals.restarts)} in past restarts` : ''}`}
                    tone="text-gray-700 dark:text-gray-200" />
                <Stat Icon={Banknote} label="Cashed out" value={points(totals.cashedOut)}
                    detail={`${plural(totals.payoutCount, 'payout')} to players`} tone="text-amber-600 dark:text-amber-400" />
            </section>

            <section className={card}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Everyone's points</h2>
                    <label className="relative w-full sm:w-56">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a player"
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </label>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Tap +1,000 to top someone up, Pay out when they cash points in, or type a new total and tap the tick. New players start at 0.</p>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {rows.map(({ user, balance }) => (
                        <WalletRow key={user.id} user={user} balance={balance} adminToken={adminToken} onSaved={refreshAdjustments} />
                    ))}
                    {rows.length === 0 && <p className="py-4 text-sm text-center text-gray-500 dark:text-gray-400">No players match.</p>}
                </div>
            </section>

            <EditHistory adjustments={adjustments} payouts={payouts} users={users} usersById={usersById} />
        </div>
    )
}

export default HouseView
