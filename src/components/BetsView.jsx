import React from 'react'
import { Coins } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { getAvatarFallback } from '../utils'
import { voidBetMarket } from '../betPersistence'
import { buildBettingLeaderboard, formatPoints, potentialPayout } from '../bettingUtils'
import { useToast } from '../contexts/useToast'

const RECENT_BETS = 30
const card = 'bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700'
const netClass = value => (value > 0 ? 'text-green-600 dark:text-green-400' : value < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400')

const Avatar = ({ user, className = 'w-10 h-10' }) => (
    <img src={user?.avatar_url || getAvatarFallback(user?.name)} alt="" className={`${className} rounded-full object-cover flex-shrink-0`} />
)

const BetsView = ({ users, wallets, markets, bets, isAdmin, adminToken }) => {
    const { showToast, showConfirm } = useToast()
    const usersById = Object.fromEntries(users.map(user => [user.id, user]))
    const marketsById = Object.fromEntries(markets.map(market => [market.id, market]))
    const name = id => usersById[id]?.name || 'Unknown'
    const backed = bet => {
        const market = marketsById[bet.market_id]
        return market ? name(bet.side === 1 ? market.player1_id : market.player2_id) : 'Unknown'
    }

    const board = buildBettingLeaderboard(users, wallets, bets)
    const openMarkets = markets.filter(market => market.status === 'open')
    const settledBets = bets.filter(bet => bet.status === 'won' || bet.status === 'lost').slice(0, RECENT_BETS)

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
                const marketBets = bets.filter(bet => bet.market_id === market.id && bet.status === 'pending')
                return (
                    <section key={market.id} className={`${card} border-amber-300 dark:border-amber-700`}>
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white min-w-0 truncate">
                                <span className="text-amber-500">Live · </span>{name(market.player1_id)} vs {name(market.player2_id)}
                            </h3>
                            {isAdmin && (
                                <button onClick={() => handleVoid(market)} className="flex-shrink-0 px-3 py-1.5 text-sm font-bold rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                                    Refund all
                                </button>
                            )}
                        </div>
                        <ul className="space-y-2">
                            {marketBets.map(bet => (
                                <li key={bet.id} className="flex items-center gap-3">
                                    <Avatar user={usersById[bet.user_id]} />
                                    <div className="min-w-0 flex-1 text-sm">
                                        <div className="font-bold text-gray-900 dark:text-white truncate">{name(bet.user_id)}</div>
                                        <div className="text-gray-500 dark:text-gray-400 truncate tabular-nums">
                                            {bet.stake} on {backed(bet)} · {Number(bet.multiplier).toFixed(2)}×
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold tabular-nums text-gray-700 dark:text-gray-200">pays {potentialPayout(bet.stake, Number(bet.multiplier))}</div>
                                </li>
                            ))}
                        </ul>
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
                            <span className="w-6 text-center text-sm font-bold tabular-nums text-gray-400 dark:text-gray-500">{index + 1}</span>
                            <Avatar user={row.user} className="w-11 h-11" />
                            <div className="min-w-0 flex-1">
                                <div className="font-bold text-gray-900 dark:text-white truncate">{row.user.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums truncate">
                                    {row.hasBet ? (
                                        <>
                                            {row.won}W {row.lost}L
                                            {row.biggestWin > 0 && ` · best +${row.biggestWin}`}
                                            {row.pending > 0 && ` · ${row.pending} riding`}
                                            {row.rebuys > 0 && ` · ${row.rebuys} restart${row.rebuys === 1 ? '' : 's'}`}
                                        </>
                                    ) : 'No bets yet'}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-black tabular-nums text-gray-900 dark:text-white">{row.balance.toLocaleString()}</div>
                                {row.hasBet && <div className={`text-xs font-bold tabular-nums ${netClass(row.profit)}`}>{formatPoints(row.profit)}</div>}
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            <section className={card}>
                <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">Recent bets</h3>
                {settledBets.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No settled bets yet. Start a live match and tap Bets.</p>
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {settledBets.map(bet => {
                            const net = bet.payout - bet.stake
                            return (
                                <li key={bet.id} className="flex items-center gap-3 py-2.5">
                                    <Avatar user={usersById[bet.user_id]} />
                                    <div className="min-w-0 flex-1 text-sm">
                                        <div className="font-bold text-gray-900 dark:text-white truncate">{name(bet.user_id)}</div>
                                        <div className="text-gray-500 dark:text-gray-400 truncate tabular-nums">
                                            {bet.stake} on {backed(bet)} · {Number(bet.multiplier).toFixed(2)}×
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-black tabular-nums ${netClass(net)}`}>{formatPoints(net)}</div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500">{new Date(bet.created_at).toLocaleDateString()}</div>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </section>
        </div>
    )
}

export default BetsView
