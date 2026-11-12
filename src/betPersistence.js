import { isAdminSessionError, reportAdminSessionExpired } from './adminSession'

// Every betting write returns the rows it touched; they are announced here so
// the app merges them into its cache without waiting for realtime.
const changeListeners = new Set()

export const onBetsChanged = (listener) => {
    changeListeners.add(listener)
    return () => changeListeners.delete(listener)
}

// { market, bets, wallets, deletedBets } -> a change set for the app's reducer.
export const bettingChanges = ({ market, bets = [], wallets = [], deletedBets = [] }) => {
    const changes = {}
    if (market) changes.betMarkets = { upserts: [market] }
    if (bets.length || deletedBets.length) changes.bets = { upserts: bets, deletes: deletedBets }
    if (wallets.length) changes.betWallets = { upserts: wallets }
    return changes
}

const announce = (rows) => {
    const changes = bettingChanges(rows)
    changeListeners.forEach(listener => {
        try { listener(changes) } catch (listenerError) { console.error(listenerError) }
    })
}

const callBetRpc = async (client, functionName, params) => {
    if (!params.p_admin_token) throw new Error('Admin mode is required to manage bets')
    const { data, error } = await client.rpc(functionName, params)
    if (error) {
        if (isAdminSessionError(error)) reportAdminSessionExpired()
        throw error
    }
    return data || {}
}

// winProbability is the chance that the backed side wins right now.
export const placeBet = async (client, { adminToken, marketId, player1Id, player2Id, userId, side, stake, winProbability, snapshot = null }) => {
    const data = await callBetRpc(client, 'place_bet', {
        p_admin_token: adminToken,
        p_market_id: marketId,
        p_player1_id: player1Id,
        p_player2_id: player2Id,
        p_user_id: userId,
        p_side: side,
        p_stake: stake,
        p_win_probability: winProbability,
        p_snapshot: snapshot,
    })
    announce({ market: data.market, bets: data.bet ? [data.bet] : [], wallets: data.wallet ? [data.wallet] : [] })
    return data
}

export const cancelBet = async (client, { adminToken, betId }) => {
    const data = await callBetRpc(client, 'cancel_bet', { p_admin_token: adminToken, p_bet_id: betId })
    announce({ deletedBets: data.deleted ? [data.deleted] : [], wallets: data.wallet ? [data.wallet] : [] })
    return data
}

export const voidBetMarket = async (client, { adminToken, marketId }) => {
    const data = await callBetRpc(client, 'void_bet_market', { p_admin_token: adminToken, p_market_id: marketId })
    announce(data)
    return data
}
