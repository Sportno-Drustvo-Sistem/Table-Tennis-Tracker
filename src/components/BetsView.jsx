import React, { useState } from 'react'
import { Coins, Crown, Eye, Flame, Gem, PartyPopper, Rocket, Skull, Snowflake } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { voidBetMarket } from '../betPersistence'
import { buildBettingAwards, buildBettingLeaderboard, bettingTotals, formatPoints, groupBetsByMarket, poolTotals } from '../bettingUtils'
import { useToast } from '../contexts/useToast'
import { BetAvatar, BetList, BetPool } from './MatchBets'

const RECENT_MATCHES = 15
const card = 'bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700'
const netClass = value => (value > 0 ? 'text-green-600 dark:text-green-400' : value < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400')
const RANK_CLASS = ['text-amber-500', 'text-gray-400', 'text-orange-700 dark:text-orange-500']
const net = bet => bet.payout - bet.stake
const points = value => value.toLocaleString()

const TABS = [
    { id: 'standings', label: 'Standings' },
    { id: 'awards', label: 'Awards' },
    { id: 'history', label: 'History' },
]

// Bragging rights, in the order they are shown. `detail` gets the award from buildBettingAwards.
const AWARDS = {
    jackpot: { title: 'Jackpot', Icon: PartyPopper, tone: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300', detail: a => `Won +${points(a.value)} with one bet` },
    longShot: { title: 'Long shot', Icon: Rocket, tone: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300', detail: a => `Landed a ${a.value.toFixed(2)}× bet` },
    oracle: { title: 'Oracle', Icon: Eye, tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300', detail: a => `Called ${a.value} of ${a.total} bets right` },
    hot: { title: 'On fire', Icon: Flame, tone: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300', detail: a => `${a.value} wins in a row` },
    highRoller: { title: 'High roller', Icon: Gem, tone: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300', detail: a => `Put ${points(a.value)} on one match` },
    cold: { title: 'Ice cold', Icon: Snowflake, tone: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-300', detail: a => `${a.value} losses in a row` },
    ouch: { title: 'Ouch', Icon: Skull, tone: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300', detail: a => `Lost ${points(a.value)} with one bet` },
}

// Second, first, third: the winner stands in the middle on the tallest step.
const PODIUM = [
    { place: 2, avatar: 'w-14 h-14 sm:w-16 sm:h-16', step: 'h-14 bg-gradient-to-b from-gray-300 to-gray-200 dark:from-gray-500 dark:to-gray-600 text-gray-600 dark:text-gray-200' },
    { place: 1, avatar: 'w-20 h-20 sm:w-24 sm:h-24 ring-4 ring-amber-400', step: 'h-20 bg-gradient-to-b from-amber-400 to-amber-300 dark:from-amber-500 dark:to-amber-600 text-amber-900 dark:text-amber-50' },
    { place: 3, avatar: 'w-14 h-14 sm:w-16 sm:h-16', step: 'h-10 bg-gradient-to-b from-orange-300 to-orange-200 dark:from-orange-700 dark:to-orange-800 text-orange-800 dark:text-orange-100' },
]

const Streak = ({ run }) => {
    if (Math.abs(run) < 2) return null
    const Icon = run > 0 ? Flame : Snowflake
    return (
        <span className={`inline-flex items-center gap-0.5 text-xs font-bold tabular-nums ${run > 0 ? 'text-orange-500' : 'text-cyan-500'}`}
            title={`${Math.abs(run)} ${run > 0 ? 'wins' : 'losses'} in a row`}>
            <Icon size={12} />{Math.abs(run)}
        </span>
    )
}

const BetsView = ({ users, wallets, markets, bets, isAdmin, adminToken, initialTab = 'standings' }) => {
    const { showToast, showConfirm } = useToast()
    const [tab, setTab] = useState(initialTab)
    const usersById = Object.fromEntries(users.map(user => [user.id, user]))
    const getUser = id => usersById[id]
    const name = id => usersById[id]?.name || 'Unknown'
    const sideNames = market => ({ 1: name(market.player1_id), 2: name(market.player2_id) })

    const board = buildBettingLeaderboard(users, wallets, bets)
    const bettors = board.filter(row => row.hasBet)
    const totals = bettingTotals(bets)
    const earned = buildBettingAwards(bets)
    const awards = Object.keys(AWARDS).map(id => earned.find(award => award.id === id)).filter(Boolean)
    const betsByMarket = groupBetsByMarket(bets)
    const openMarkets = markets.filter(market => market.status === 'open')
    const paidMatches = markets
        .filter(market => market.status === 'settled')
        .map(market => ({ market, bets: (betsByMarket.get(market.id) || []).filter(bet => bet.status === 'won' || bet.status === 'lost').sort((a, b) => net(b) - net(a)) }))
        .filter(group => group.bets.length > 0)
        .slice(0, RECENT_MATCHES)

    const handleVoid = (market) => {
        showConfirm(`Refund every bet on ${name(market.player1_id)} vs ${name(market.player2_id)}?`, async () => {
            try {
                await voidBetMarket(supabase, { adminToken, marketId: market.id })
                showToast('Bets refunded', 'success')
            } catch (error) {
                console.error(error)
                showToast('Bets not refunded: ' + error.message, 'error')
            }
        })
    }

    return (
        <div className="space-y-5 sm:space-y-6">
            {openMarkets.map(market => {
                const marketBets = (betsByMarket.get(market.id) || []).filter(bet => bet.status === 'pending').reverse()
                const pool = poolTotals(marketBets)
                const names = sideNames(market)
                return (
                    <section key={market.id} className={`${card} border-amber-300 dark:border-amber-600 bg-gradient-to-b from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-800 shadow-md shadow-amber-500/10`}>
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                                </span>
                                Live now
                            </span>
                            {isAdmin && (
                                <button onClick={() => handleVoid(market)} className="flex-shrink-0 px-3 py-1.5 text-sm font-bold rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                                    Refund all
                                </button>
                            )}
                        </div>
                        <h3 className="flex items-center justify-center gap-3 mb-4 text-gray-900 dark:text-white" aria-label={`${names[1]} vs ${names[2]}`}>
                            <span className="flex-1 min-w-0 flex items-center justify-end gap-2.5">
                                <span className="font-bold text-lg truncate">{names[1]}</span>
                                <BetAvatar user={getUser(market.player1_id)} className="w-12 h-12 ring-2 ring-blue-500" />
                            </span>
                            <span className="text-xs font-bold uppercase text-gray-400 dark:text-gray-500">vs</span>
                            <span className="flex-1 min-w-0 flex items-center gap-2.5">
                                <BetAvatar user={getUser(market.player2_id)} className="w-12 h-12 ring-2 ring-red-500" />
                                <span className="font-bold text-lg truncate">{names[2]}</span>
                            </span>
                        </h3>
                        {marketBets.length === 0 ? (
                            <p className="text-sm text-center text-gray-500 dark:text-gray-400">No bets riding on this match.</p>
                        ) : (
                            <div className="space-y-3">
                                <BetPool bets={marketBets} names={names} />
                                <div className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 tabular-nums">
                                    {pool.count} {pool.count === 1 ? 'bet' : 'bets'} · {points(pool.total)} points riding
                                </div>
                                <BetList bets={marketBets} getUser={getUser} names={names} />
                            </div>
                        )}
                    </section>
                )
            })}

            <dl className="grid grid-cols-3 gap-2 sm:gap-4">
                {[
                    { label: 'Wagered', value: points(totals.wagered) },
                    { label: 'Bets paid', value: points(totals.count) },
                    { label: 'Biggest win', value: totals.biggestWin > 0 ? `+${points(totals.biggestWin)}` : '–', className: totals.biggestWin > 0 ? 'text-green-600 dark:text-green-400' : '' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-2 py-3 text-center">
                        <dd className={`text-xl sm:text-2xl font-black tabular-nums ${stat.className || 'text-gray-900 dark:text-white'}`}>{stat.value}</dd>
                        <dt className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{stat.label}</dt>
                    </div>
                ))}
            </dl>

            <div role="tablist" aria-label="Bets" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
                {TABS.map(item => (
                    <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
                        className={`py-2 rounded-lg text-sm font-bold transition-colors ${tab === item.id
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                        {item.label}
                    </button>
                ))}
            </div>

            {tab === 'standings' && (
                <section className={`${card} animate-fade-in`}>
                    <h3 className="font-bold text-lg mb-1 flex items-center text-gray-900 dark:text-white">
                        <Coins className="mr-2 text-amber-500" size={20} />
                        Points
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Everyone starts with 1,000 points. Bets are placed on the umpire&apos;s phone during a live match. No real money.
                    </p>

                    {bettors.length >= 3 && (
                        <ol className="grid grid-cols-3 items-end gap-2 sm:gap-4 max-w-md mx-auto mb-5" aria-label="Top three">
                            {PODIUM.map(({ place, avatar, step }) => {
                                const row = bettors[place - 1]
                                return (
                                    <li key={place} className="min-w-0 flex flex-col items-center text-center">
                                        {place === 1 && <Crown size={22} className="mb-1 text-amber-400 fill-amber-400" aria-hidden="true" />}
                                        <BetAvatar user={row.user} className={avatar} />
                                        <div className="mt-1.5 w-full font-bold truncate text-gray-900 dark:text-white">{row.user.name}</div>
                                        <div className="text-sm font-black tabular-nums text-amber-600 dark:text-amber-400">{points(row.balance)}</div>
                                        <div className={`mt-1.5 w-full rounded-t-lg flex items-center justify-center text-xl font-black ${step}`}>{place}</div>
                                    </li>
                                )
                            })}
                        </ol>
                    )}

                    <ol className="divide-y divide-gray-100 dark:divide-gray-700">
                        {board.map((row, index) => (
                            <li key={row.user.id} className={`flex items-center gap-3 py-2.5 ${row.hasBet ? '' : 'opacity-60'}`}>
                                <span className={`w-6 text-center text-sm font-black tabular-nums ${(row.hasBet && RANK_CLASS[index]) || 'text-gray-400 dark:text-gray-500'}`}>{index + 1}</span>
                                <BetAvatar user={row.user} className="w-11 h-11" />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-gray-900 dark:text-white truncate">{row.user.name}</span>
                                        <Streak run={row.streak} />
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums truncate">
                                        {row.hasBet ? (
                                            <>
                                                {row.won}W {row.lost}L
                                                {row.biggestWin > 0 && ` · best +${row.biggestWin}`}
                                                {row.rebuys > 0 && ` · ${row.rebuys} restart${row.rebuys === 1 ? '' : 's'}`}
                                            </>
                                        ) : 'No bets yet'}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-black tabular-nums text-gray-900 dark:text-white">{points(row.balance)}</div>
                                    {row.pending > 0
                                        ? <div className="text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">{points(row.pending)} riding</div>
                                        : row.hasBet && <div className={`text-xs font-bold tabular-nums ${netClass(row.profit)}`}>{formatPoints(row.profit)}</div>}
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            {tab === 'awards' && (
                awards.length === 0 ? (
                    <section className={`${card} animate-fade-in text-sm text-gray-500 dark:text-gray-400`}>
                        No awards yet. They are handed out once bets have been paid.
                    </section>
                ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                        {awards.map(award => {
                            const { title, Icon, tone, detail } = AWARDS[award.id]
                            return (
                                <li key={award.id} className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-3.5">
                                    <span className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${tone}`}>
                                        <Icon size={24} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[11px] font-black uppercase tracking-wide text-gray-400 dark:text-gray-500">{title}</div>
                                        <div className="font-bold text-gray-900 dark:text-white truncate">{name(award.userId)}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 tabular-nums truncate">{detail(award)}</div>
                                    </div>
                                    <BetAvatar user={getUser(award.userId)} className="w-12 h-12" />
                                </li>
                            )
                        })}
                    </ul>
                )
            )}

            {tab === 'history' && (
                <section className={`${card} animate-fade-in`}>
                    <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">Recent matches</h3>
                    {paidMatches.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No settled bets yet. Start a live match and tap Bets.</p>
                    ) : (
                        <div className="space-y-6">
                            {paidMatches.map(({ market, bets: matchBets }) => {
                                const names = sideNames(market)
                                const winner = market.winner_side === 2 ? 2 : 1
                                const pool = poolTotals(matchBets)
                                return (
                                    <article key={market.id} className="space-y-3">
                                        <header className="flex items-center gap-3">
                                            <span className="flex -space-x-2 flex-shrink-0">
                                                <BetAvatar user={getUser(market.player1_id)} className="w-9 h-9 ring-2 ring-white dark:ring-gray-800" />
                                                <BetAvatar user={getUser(market.player2_id)} className="w-9 h-9 ring-2 ring-white dark:ring-gray-800" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-gray-500 dark:text-gray-400">
                                                    <span className="font-bold text-gray-900 dark:text-white">{names[winner]}</span> beat {names[3 - winner]}
                                                </div>
                                                <div className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                                                    {new Date(market.settled_at || market.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                                                    {' · '}{pool.count} {pool.count === 1 ? 'bet' : 'bets'} · {points(pool.total)} points
                                                </div>
                                            </div>
                                        </header>
                                        <BetPool bets={matchBets} names={names} />
                                        <BetList bets={matchBets} getUser={getUser} names={names} />
                                    </article>
                                )
                            })}
                        </div>
                    )}
                </section>
            )}
        </div>
    )
}

export default BetsView
