import { isAdminSessionError, reportAdminSessionExpired } from './adminSession'

// Every betting write returns the rows it touched; they are announced here so
// the app merges them into its cache without waiting for realtime.
const changeListeners = new Set()

export const onBetsChanged = (listener) => {
    changeListeners.add(listener)
    return () => changeListeners.delete(listener)
}

// { market, bets, wallets, deletedBets, live, deletedLive } -> a change set for the app's reducer.
export const bettingChanges = ({ market, bets = [], wallets = [], deletedBets = [], live = null, deletedLive = [] }) => {
    const changes = {}
    if (live || deletedLive.length) changes.liveMatches = { upserts: live ? [live] : [], deletes: deletedLive }
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

const callBetRpc = async (client, functionName, params, { reportExpiry = true } = {}) => {
    if ('p_admin_token' in params && !params.p_admin_token) throw new Error('Admin mode is required to manage bets')
    const { data, error } = await client.rpc(functionName, params)
    if (error) {
        if (reportExpiry && isAdminSessionError(error)) reportAdminSessionExpired()
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

// A bet from any phone, no admin needed. The server prices it from the live
// match row; `multiplier` is what the bettor saw, and the bet is refused if a
// point has moved the odds since.
export const placeLiveBet = async (client, { marketId, userId, side, stake, multiplier }) => {
    const data = await callBetRpc(client, 'place_live_bet', {
        p_market_id: marketId,
        p_user_id: userId,
        p_side: side,
        p_stake: stake,
        p_expected_multiplier: multiplier,
    })
    announce({ market: data.market, bets: data.bet ? [data.bet] : [], wallets: data.wallet ? [data.wallet] : [] })
    return data
}

// The umpire phone shares its score so every phone can follow and bet.
// Failures are left to the caller: a missed update is fixed by the next point,
// so an expired session must not interrupt the match with a login prompt.
export const publishLiveMatch = async (client, { adminToken, marketId, player1Id, player2Id, state }) => {
    const data = await callBetRpc(client, 'publish_live_match', {
        p_admin_token: adminToken,
        p_id: marketId,
        p_player1_id: player1Id,
        p_player2_id: player2Id,
        p_state: state,
    }, { reportExpiry: false })
    announce({ live: data?.id ? data : null })
    return data
}

// Takes the match off every phone and refunds bets still open on it.
export const endLiveMatch = async (client, { adminToken, marketId }) => {
    const data = await callBetRpc(client, 'end_live_match', { p_admin_token: adminToken, p_id: marketId })
    announce({ ...data, deletedLive: [marketId] })
    return data
}

// Super admin only: set a player's points outright.
export const setWalletBalance = async (client, { adminToken, userId, balance }) => {
    const data = await callBetRpc(client, 'super_admin_set_wallet', {
        p_admin_token: adminToken,
        p_user_id: userId,
        p_balance: balance,
    })
    announce({ wallets: data.wallet ? [data.wallet] : [] })
    return data
}

// Super admin only: the latest manual point changes, newest first.
export const loadWalletAdjustments = async (client, { adminToken }) => (
    callBetRpc(client, 'super_admin_wallet_adjustments', { p_admin_token: adminToken })
)
