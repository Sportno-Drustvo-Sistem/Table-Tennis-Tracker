import React, { useEffect, useState } from 'react'
import { Clock, Minus, Plus, Skull, X, Zap } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { buySabotage } from '../betPersistence'
import { isLiveFresh, walletBalance } from '../bettingUtils'
import { canAffordSabotage, livePointsPlayed, pendingSabotages, sabotagePrice, sabotageStats } from '../sabotageUtils'
import { useToast } from '../contexts/useToast'
import { BetAvatar, MiniChip } from './MatchBets'
import LiveScoreboard from './LiveScoreboard'

const card = 'bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700'
const points = value => value.toLocaleString()
const pointsWord = n => `${n} ${n === 1 ? 'point' : 'points'}`

// Shared with the bet sheet: a phone remembers who used it last.
const BUYER_STORAGE_KEY = 'betSheetBettor'
const rememberedBuyer = () => {
    try { return localStorage.getItem(BUYER_STORAGE_KEY) } catch { return null }
}

// Debuffs still to be played in a match: the current one per player, then the queue.
export const SabotageQueue = ({ sabotages, getUser, compact = false }) => {
    if (!sabotages.length) return null
    return (
        <ul className={compact ? 'space-y-1.5' : 'space-y-2'} aria-label="Debuffs">
            {sabotages.map(sabotage => {
                const active = sabotage.status.state === 'active'
                const target = getUser(sabotage.target_id)
                return (
                    <li key={sabotage.id} className={`flex items-center gap-2.5 rounded-xl px-3 ${compact ? 'py-1.5' : 'py-2.5'} ${active
                        ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-md shadow-fuchsia-500/30'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>
                        <BetAvatar user={target} className={compact ? 'w-8 h-8' : 'w-10 h-10'} />
                        <div className="min-w-0 flex-1 leading-tight">
                            <div className="font-bold truncate">
                                {target?.name || 'Unknown'}: {sabotage.title}
                            </div>
                            <div className={`text-xs truncate ${active ? 'text-white/85' : 'text-gray-500 dark:text-gray-400'}`}>
                                {sabotage.description} · from {getUser(sabotage.buyer_id)?.name || 'Unknown'}
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0 leading-tight">
                            {active ? (
                                <>
                                    <div className="text-2xl font-black tabular-nums">{sabotage.status.left}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-white/80">{sabotage.status.left === 1 ? 'point left' : 'points left'}</div>
                                </>
                            ) : (
                                <div className="flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-gray-400 tabular-nums">
                                    <Clock size={12} /> in {sabotage.status.startsIn}
                                </div>
                            )}
                        </div>
                    </li>
                )
            })}
        </ul>
    )
}

// Buy a debuff on a player in a live match. The price goes to that player.
export const SabotageSheet = ({ live, users, wallets, items, onClose }) => {
    const { showToast } = useToast()
    const [buyerId, setBuyerId] = useState(() => {
        const id = rememberedBuyer()
        return users.some(user => user.id === id) ? id : null
    })
    const [targetId, setTargetId] = useState(null)
    const [itemId, setItemId] = useState(null)
    const [count, setCount] = useState(3)
    const [busy, setBusy] = useState(false)

    const usersById = Object.fromEntries(users.map(user => [user.id, user]))
    const players = [live.player1_id, live.player2_id].map(id => usersById[id]).filter(Boolean)
    const buyers = [...users].sort((a, b) => a.name.localeCompare(b.name))
    const item = items.find(entry => entry.id === itemId)
    const maxPoints = item?.max_points || 5
    const pointCount = Math.min(count, maxPoints)
    const price = sabotagePrice(item, pointCount)
    const balance = buyerId ? walletBalance(wallets, buyerId) : 0
    const activeTarget = targetId && targetId !== buyerId ? targetId : null
    const affordable = canAffordSabotage(balance, price)
    const over = Boolean(live.winner_side)
    const canBuy = !over && !busy && buyerId && activeTarget && item && affordable

    const pickBuyer = (id) => {
        setBuyerId(id)
        try { localStorage.setItem(BUYER_STORAGE_KEY, id) } catch { /* private mode */ }
    }

    const handleBuy = async () => {
        if (!canBuy) return
        setBusy(true)
        try {
            await buySabotage(supabase, { liveMatchId: live.id, buyerId, targetId: activeTarget, itemId: item.id, points: pointCount, price })
            showToast(`${usersById[activeTarget]?.name}: ${item.title} for ${pointsWord(pointCount)}! +${points(price)} to them`, 'success')
            onClose()
        } catch (error) {
            console.error(error)
            showToast('Debuff not bought: ' + error.message, 'error')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="sabotage-sheet-title">
            <div className="relative w-full sm:max-w-lg max-h-[100dvh] sm:max-h-[90dvh] bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden motion-safe:animate-slide-up short:max-w-none short:rounded-none short:h-[100dvh]">
                <div className="flex items-center justify-between px-4 pt-4 pb-2 short:pt-2 bg-gradient-to-b from-fuchsia-50 to-transparent dark:from-fuchsia-500/10">
                    <div className="min-w-0">
                        <h3 id="sabotage-sheet-title" className="flex items-center gap-2 text-lg font-black text-gray-900 dark:text-white">
                            <Zap size={20} className="text-fuchsia-500" />
                            Buy a debuff
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 short:hidden">The points go to the player you debuff. Results and ELO count as normal.</p>
                    </div>
                    <button onClick={onClose} aria-label="Close debuffs" className="p-2.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-4">
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Who is paying?</h4>
                        <div className="grid grid-cols-4 min-[400px]:grid-cols-5 gap-2">
                            {buyers.map(user => (
                                <button key={user.id} type="button" onClick={() => pickBuyer(user.id)} aria-pressed={buyerId === user.id}
                                    className={`min-w-0 rounded-xl p-1.5 flex flex-col items-center gap-0.5 border-2 transition-colors ${buyerId === user.id
                                        ? 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/30'
                                        : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                                    <BetAvatar user={user} className="w-12 h-12" />
                                    <span className="w-full truncate text-center text-xs font-bold text-gray-800 dark:text-gray-100">{user.name}</span>
                                    <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{points(walletBalance(wallets, user.id))}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Who gets it?</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {players.map(player => (
                                <button key={player.id} type="button" onClick={() => setTargetId(player.id)} disabled={player.id === buyerId}
                                    aria-pressed={activeTarget === player.id}
                                    className={`min-w-0 rounded-2xl border-2 p-3 flex items-center gap-3 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${activeTarget === player.id
                                        ? 'border-fuchsia-500 bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white shadow-lg shadow-fuchsia-500/30'
                                        : 'border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'}`}>
                                    <BetAvatar user={player} className="w-11 h-11" />
                                    <span className="min-w-0">
                                        <span className="block font-bold truncate">{player.name}</span>
                                        <span className="block text-[11px] opacity-80">{player.id === buyerId ? 'Not yourself' : 'Gets the points'}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Debuff</h4>
                        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
                            {items.map(entry => (
                                <button key={entry.id} type="button" onClick={() => setItemId(entry.id)} aria-pressed={itemId === entry.id}
                                    className={`min-w-0 rounded-xl border-2 p-3 text-left transition-colors ${itemId === entry.id
                                        ? 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/30'
                                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-gray-900 dark:text-white truncate">{entry.title}</span>
                                        <span className="flex-shrink-0 text-xs font-black tabular-nums text-fuchsia-600 dark:text-fuchsia-400">{entry.price_per_point}/pt</span>
                                    </span>
                                    <span className="block mt-0.5 text-xs text-gray-500 dark:text-gray-400">{entry.description}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">For the next</span>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setCount(Math.max(1, pointCount - 1))} disabled={pointCount <= 1} aria-label="Fewer points"
                                className="w-11 h-11 rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-40">
                                <Minus size={18} />
                            </button>
                            <span className="w-20 text-center font-black tabular-nums text-gray-900 dark:text-white" aria-live="polite">{pointsWord(pointCount)}</span>
                            <button type="button" onClick={() => setCount(Math.min(maxPoints, pointCount + 1))} disabled={pointCount >= maxPoints} aria-label="More points"
                                className="w-11 h-11 rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-40">
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>
                    {buyerId && item && !affordable && (
                        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{usersById[buyerId]?.name} has {points(balance)} points and has to keep at least 1.</p>
                    )}
                    {over && <p className="mt-2 text-sm font-medium text-amber-600 dark:text-amber-400">This match is over.</p>}
                    <button type="button" onClick={handleBuy} disabled={!canBuy}
                        className={`mt-3 w-full py-3 rounded-xl text-white font-bold shadow-md shadow-fuchsia-500/30 transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none bg-gradient-to-r from-fuchsia-600 to-purple-600 ${canBuy ? 'bet-shine' : ''}`}>
                        {busy ? 'Buying…' : !buyerId ? 'Pick who is paying' : !activeTarget ? 'Pick who gets it' : !item ? 'Pick a debuff'
                            : `Pay ${points(price)} · ${usersById[activeTarget]?.name}: ${item.title}`}
                    </button>
                </div>
            </div>
        </div>
    )
}

// The Sabotage tab: live matches with their debuffs, the menu and the history.
const SabotageView = ({ users, wallets, items, sabotages, liveMatches }) => {
    const [buyLiveId, setBuyLiveId] = useState(null)
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        if (!liveMatches?.length) return undefined
        const timer = setInterval(() => setNow(Date.now()), 30 * 1000)
        return () => clearInterval(timer)
    }, [liveMatches?.length])

    const usersById = Object.fromEntries(users.map(user => [user.id, user]))
    const getUser = id => usersById[id]
    const live = (liveMatches || []).filter(match => isLiveFresh(match, now) && getUser(match.player1_id) && getUser(match.player2_id))
    const buyLive = live.find(match => match.id === buyLiveId)
    const recent = sabotages.slice(0, 20)
    const { saboteur, victim } = sabotageStats(sabotages)

    return (
        <div className="space-y-5 sm:space-y-6">
            <section className={`${card} border-fuchsia-200 dark:border-fuchsia-800 bg-gradient-to-b from-fuchsia-50 to-white dark:from-fuchsia-900/20 dark:to-gray-800`}>
                <h3 className="font-bold text-lg mb-1 flex items-center text-gray-900 dark:text-white">
                    <Skull className="mr-2 text-fuchsia-500" size={20} />
                    Sabotage
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Spend betting points to put a debuff on a player for the next few points of a live match.
                    The points go straight to the player you debuff, so pick your victims wisely. Debuffs are just for fun: results and ELO count as normal.
                </p>
            </section>

            {live.length === 0 && (
                <section className={`${card} text-sm text-gray-500 dark:text-gray-400`}>
                    No match is live right now. Debuffs can be bought once the umpire starts a ping pong match.
                </section>
            )}

            {live.map(match => {
                const queue = pendingSabotages(sabotages, match.id, livePointsPlayed(match))
                return (
                    <section key={match.id} className={`${card} border-fuchsia-300 dark:border-fuchsia-700 shadow-md shadow-fuchsia-500/10`}>
                        <LiveScoreboard live={match} getUser={getUser} />
                        {queue.length > 0 && <div className="mt-3"><SabotageQueue sabotages={queue} getUser={getUser} /></div>}
                        <button type="button" onClick={() => setBuyLiveId(match.id)} disabled={Boolean(match.winner_side)}
                            className="mt-3 w-full py-3.5 rounded-xl flex items-center justify-center gap-2.5 text-white text-lg font-black bg-gradient-to-r from-fuchsia-600 to-purple-600 shadow-md shadow-fuchsia-500/30 transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
                            <Zap size={22} />
                            {match.winner_side ? 'Match over' : 'Buy a debuff'}
                        </button>
                    </section>
                )
            })}

            {buyLive && (
                <SabotageSheet key={buyLive.id} live={buyLive} users={users} wallets={wallets} items={items} onClose={() => setBuyLiveId(null)} />
            )}

            {(saboteur || victim) && (
                <dl className="grid grid-cols-2 gap-2 sm:gap-4">
                    {[
                        { label: 'Top saboteur', row: saboteur, note: 'spent' },
                        { label: 'Most sabotaged', row: victim, note: 'earned' },
                    ].filter(stat => stat.row).map(stat => (
                        <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-3 flex items-center gap-3">
                            <BetAvatar user={getUser(stat.row[0])} className="w-11 h-11" />
                            <div className="min-w-0">
                                <dt className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{stat.label}</dt>
                                <dd className="font-bold text-gray-900 dark:text-white truncate">{getUser(stat.row[0])?.name || 'Unknown'}</dd>
                                <dd className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{points(stat.row[1])} {stat.note}</dd>
                            </div>
                        </div>
                    ))}
                </dl>
            )}

            <section className={card}>
                <h3 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Menu</h3>
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                    {items.map(item => (
                        <li key={item.id} className="flex items-center gap-3 py-2.5">
                            <div className="min-w-0 flex-1">
                                <div className="font-bold text-gray-900 dark:text-white">{item.title}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{item.description}</div>
                            </div>
                            <div className="text-right flex-shrink-0 leading-tight">
                                <div className="flex items-center justify-end gap-1 font-black tabular-nums text-fuchsia-600 dark:text-fuchsia-400">
                                    <MiniChip amount={item.price_per_point * 3} className="w-3.5 h-3.5" />
                                    {item.price_per_point}
                                </div>
                                <div className="text-[11px] text-gray-400 dark:text-gray-500">per point · up to {item.max_points}</div>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            <section className={card}>
                <h3 className="font-bold text-lg mb-3 text-gray-900 dark:text-white">Recent sabotage</h3>
                {recent.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Nobody has been sabotaged yet.</p>
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {recent.map(sabotage => (
                            <li key={sabotage.id} className="flex items-center gap-3 py-2.5">
                                <span className="flex -space-x-2 flex-shrink-0">
                                    <BetAvatar user={getUser(sabotage.buyer_id)} className="w-9 h-9 ring-2 ring-white dark:ring-gray-800" />
                                    <BetAvatar user={getUser(sabotage.target_id)} className="w-9 h-9 ring-2 ring-white dark:ring-gray-800" />
                                </span>
                                <div className="min-w-0 flex-1 leading-tight">
                                    <div className="truncate text-gray-500 dark:text-gray-400">
                                        <span className="font-bold text-gray-900 dark:text-white">{getUser(sabotage.buyer_id)?.name || 'Unknown'}</span>
                                        {' → '}
                                        <span className="font-bold text-gray-900 dark:text-white">{getUser(sabotage.target_id)?.name || 'Unknown'}</span>
                                    </div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                        {sabotage.title} · {pointsWord(sabotage.points)} · {new Date(sabotage.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                                    </div>
                                </div>
                                <div className="text-sm font-black tabular-nums text-fuchsia-600 dark:text-fuchsia-400 flex-shrink-0">{points(sabotage.price)}</div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}

export default SabotageView
