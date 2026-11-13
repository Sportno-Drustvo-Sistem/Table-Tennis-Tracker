import React from 'react'
import { Coins } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { voidBetMarket } from '../betPersistence'
import { buildBettingLeaderboard, formatPoints, groupBetsByMarket, poolTotals } from '../bettingUtils'
import { useToast } from '../contexts/useToast'
import { BetAvatar, BetList, BetPool } from './MatchBets'

const RECENT_MATCHES = 15
const card = 'bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700'
const netClass = value => (value > 0 ? 'text-green-600 dark:text-green-400' : value < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400')
const RANK_CLASS = ['text-amber-500', 'text-gray-400', 'text-orange-700 dark:text-orange-500']
const net = bet => bet.payout - bet.stake

const BetsView = ({ users, wallets, markets, bets, isAdmin, adminToken }) => {
    const { showToast, showConfirm } = useToast()
    const usersById = Object.fromEntries(users.map(user => [user.id, user]))
    const getUser = id => usersById[id]
    const name = id => usersById[id]?.name || 'Unknown'
    const sideNames = market => ({ 1: name(market.player1_id), 2: name(market.player2_id) })

    const board = buildBettingLeaderboard(users, wallets, bets)
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
        <div className="space-y-6">
            {openMarkets.map(market => {
                const marketBets = (betsByMarket.get(market.id) || []).filter(bet => bet.status === 'pending').reverse()
                const pool = poolTotals(marketBets)
                const names = sideNames(market)
                return (
                    <section key={market.id} className={`${card} border-amber-300 dark:border-amber-700`}>
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
                                <BetAvatar user={getUser(market.player1_id)} className="w-12 h-12" />
                            </span>
                            <span className="text-xs font-bold uppercase text-gray-400 dark:text-gray-500">vs</span>
                            <span className="flex-1 min-w-0 flex items-center gap-2.5">
                                <BetAvatar user={getUser(market.player2_id)} className="w-12 h-12" />
                                <span className="font-bold text-lg truncate">{names[2]}</span>
                            </span>
                        </h3>
                        {marketBets.length === 0 ? (
                            <p className="text-sm text-center text-gray-500 dark:text-gray-400">No bets riding on this match.</p>
                        ) : (
                            <div className="space-y-3">
                                <BetPool bets={marketBets} names={names} />
                                <div className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 tabular-nums">
                                    {pool.count} {pool.count === 1 ? 'bet' : 'bets'} · {pool.total.toLocaleString()} points riding
                                </div>
                                <BetList bets={marketBets} getUser={getUser} names={names} />
                            </div>
                        )}
                    </section>
                )
            })}

            <section className={card}>
                <h3 className="font-bold text-lg mb-1 flex items-center text-gray-900 dark:text-white">
                    <Coins className="mr-2 text-amber-500" size={20} />
                    Points
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Everyone starts with 1,000 points. Bets are placed on the umpire&apos;s phone during a live match. No real money.
                </p>
                <ol className="divide-y divide-gray-100 dark:divide-gray-700">
                    {board.map((row, index) => (
                        <li key={row.user.id} className={`flex items-center gap-3 py-2.5 ${row.hasBet ? '' : 'opacity-60'}`}>
                            <span className={`w-6 text-center text-sm font-black tabular-nums ${(row.hasBet && RANK_CLASS[index]) || 'text-gray-400 dark:text-gray-500'}`}>{index + 1}</span>
                            <BetAvatar user={row.user} className="w-11 h-11" />
                            <div className="min-w-0 flex-1">
                                <div className="font-bold text-gray-900 dark:text-white truncate">{row.user.name}</div>
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
                                <div className="text-lg font-black tabular-nums text-gray-900 dark:text-white">{row.balance.toLocaleString()}</div>
                                {row.pending > 0
                                    ? <div className="text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">{row.pending.toLocaleString()} riding</div>
                                    : row.hasBet && <div className={`text-xs font-bold tabular-nums ${netClass(row.profit)}`}>{formatPoints(row.profit)}</div>}
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            <section className={card}>
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
                                                {' · '}{pool.count} {pool.count === 1 ? 'bet' : 'bets'} · {pool.total.toLocaleString()} points
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
        </div>
    )
}

export default BetsView
