import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Search, TrendingDown, TrendingUp, Scale, PencilLine } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { loadWalletAdjustments, setWalletBalance } from '../betPersistence'
import { formatPoints, houseTotals, walletBalance } from '../bettingUtils'
import { useToast } from '../contexts/useToast'
import { BetAvatar } from './MatchBets'

const card = 'bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700'
const points = value => value.toLocaleString()
const MAX_POINTS = 10000000

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

    const save = async (event) => {
        event.preventDefault()
        if (!changed) return
        setSaving(true)
        try {
            await setWalletBalance(supabase, { adminToken, userId: user.id, balance: value })
            showToast(`${user.name}: ${points(balance)} → ${points(value)} points`, 'success')
            setEditing(false)
            onSaved()
        } catch (error) {
            console.error(error)
            showToast('Points not saved: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={save} className="flex items-center gap-3 py-2.5">
            <BetAvatar user={user} className="w-10 h-10" />
            <span className="flex-1 min-w-0 font-semibold text-gray-900 dark:text-white truncate">{user.name}</span>
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
    )
}

const HISTORY_PAGE = 20
const when = iso => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

// Every manual points change, newest first, optionally for one player.
export const EditHistory = ({ adjustments, users, usersById }) => {
    const [playerId, setPlayerId] = useState('')
    const [shown, setShown] = useState(HISTORY_PAGE)
    const edited = useMemo(() => {
        const ids = new Set(adjustments.map(row => row.user_id))
        return users.filter(user => ids.has(user.id)).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }, [adjustments, users])
    const rows = playerId ? adjustments.filter(row => row.user_id === playerId) : adjustments
    const net = rows.reduce((sum, row) => sum + row.new_balance - row.old_balance, 0)

    return (
        <section className={card} aria-label="Points history">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                    <PencilLine size={18} /> Points history
                </h2>
                {edited.length > 1 && (
                    <select value={playerId} onChange={e => { setPlayerId(e.target.value); setShown(HISTORY_PAGE) }} aria-label="Show edits for"
                        className="w-full sm:w-56 p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">All players</option>
                        {edited.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                )}
            </div>
            {rows.length === 0 ? (
                <p className="py-4 text-sm text-center text-gray-500 dark:text-gray-400">No point edits yet. Every change you make above is listed here.</p>
            ) : (
                <>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 tabular-nums">
                        {rows.length} {rows.length === 1 ? 'edit' : 'edits'} · net {formatPoints(net)} points
                    </p>
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {rows.slice(0, shown).map(row => {
                            const change = row.new_balance - row.old_balance
                            const user = usersById[row.user_id]
                            return (
                                <li key={row.id} className="flex items-center gap-3 py-2.5 text-sm">
                                    <BetAvatar user={user} className="w-8 h-8" />
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate font-semibold text-gray-900 dark:text-white">{user?.name || 'Unknown'}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums truncate">
                                            {points(row.old_balance)} → {points(row.new_balance)} · <time dateTime={row.created_at}>{when(row.created_at)}</time>
                                        </div>
                                    </div>
                                    <span className={`shrink-0 text-right tabular-nums font-bold ${change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatPoints(change)}</span>
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
const HouseView = ({ users, wallets, bets, adminToken }) => {
    const [adjustments, setAdjustments] = useState([])
    const [query, setQuery] = useState('')

    const refreshAdjustments = useCallback(() => (
        loadWalletAdjustments(supabase, { adminToken })
            .then(rows => setAdjustments(Array.isArray(rows) ? rows : []))
            .catch(error => console.error('Failed to load point edits:', error))
    ), [adminToken])
    useEffect(() => { refreshAdjustments() }, [refreshAdjustments])

    const totals = houseTotals(bets, wallets, adjustments)
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
            <section aria-label="House totals" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Stat Icon={TrendingUp} label="Won from losses" value={`+${points(totals.collected)}`}
                    detail={`${totals.lostBets} lost ${totals.lostBets === 1 ? 'bet' : 'bets'}`} tone="text-green-600 dark:text-green-400" />
                <Stat Icon={TrendingDown} label="Paid on wins" value={`−${points(totals.paidOut)}`}
                    detail={`${totals.wonBets} winning ${totals.wonBets === 1 ? 'bet' : 'bets'}, profit only`} tone="text-red-600 dark:text-red-400" />
                <Stat Icon={Scale} label="House net" value={formatPoints(totals.net)}
                    detail={totals.riding ? `${points(totals.riding)} riding on open bets` : 'From settled bets'}
                    tone={totals.net > 0 ? 'text-green-600 dark:text-green-400' : totals.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'} />
                <Stat Icon={PencilLine} label="Points added" value={formatPoints(totals.adjusted)}
                    detail={`${adjustments.length} manual ${adjustments.length === 1 ? 'edit' : 'edits'}${totals.restartCount ? ` · ${points(totals.restarts)} in past restarts` : ''}`}
                    tone="text-gray-700 dark:text-gray-200" />
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
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Type a new total and tap the tick. Players who never bet start at 1,000.</p>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {rows.map(({ user, balance }) => (
                        <WalletRow key={user.id} user={user} balance={balance} adminToken={adminToken} onSaved={refreshAdjustments} />
                    ))}
                    {rows.length === 0 && <p className="py-4 text-sm text-center text-gray-500 dark:text-gray-400">No players match.</p>}
                </div>
            </section>

            <EditHistory adjustments={adjustments} users={users} usersById={usersById} />
        </div>
    )
}

export default HouseView
