// Tournament utility functions: bracket generation, Swiss logic, placement matches

// Shuffle array (Fisher-Yates)
export const shuffle = (array) => {
    const arr = [...array]
    let i = arr.length
    while (i !== 0) {
        const j = Math.floor(Math.random() * i)
        i--
            ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
}

// ─── SINGLE ELIMINATION ───────────────────────────────────────────

export const generateSingleEliminationBracket = (participants, mayhemMode, debuffsPool, usersMap, assignDebuffsToMatch) => {
    const count = participants.length
    let size = 2
    while (size < count) size *= 2

    // Fill with byes — top seeds get the byes
    const seeded = [...participants]
    const filledParticipants = []
    for (let i = 0; i < size; i++) {
        filledParticipants.push(i < seeded.length ? seeded[i] : null)
    }

    // Proper seeding: 1v(size), 2v(size-1), etc. with bye distribution to top seeds
    const seededOrder = generateSeededOrder(size)
    const ordered = seededOrder.map(idx => filledParticipants[idx] || null)

    // Round 1
    const matches = []
    let r1Name = 'Round 1';
    if (size === 2) r1Name = 'Grand Final';
    else if (size === 4) r1Name = 'Semi-Finals';
    else if (size === 8) r1Name = 'Quarter-Finals';
    else if (size === 16) r1Name = 'Round of 16';

    for (let i = 0; i < size; i += 2) {
        const p1 = ordered[i]
        const p2 = ordered[i + 1]

        let match = {
            id: `r1_m${i / 2}`,
            player1: p1,
            player2: p2,
            score1: null,
            score2: null,
            winner: (!p1 && p2) ? p2 : ((p1 && !p2) ? p1 : null),
            isBye: !p1 || !p2
        }

        if (mayhemMode && !match.isBye && !match.winner) {
            match = assignDebuffsToMatch(match, debuffsPool, usersMap)
        }
        matches.push(match)
    }

    // Subsequent Rounds
    const allRounds = [{ name: r1Name, matches }]
    let currentSize = matches.length
    let roundNum = 2

    while (currentSize > 1) {
        const nextMatches = []
        for (let i = 0; i < currentSize; i += 2) {
            nextMatches.push({
                id: `r${roundNum}_m${i / 2}`,
                player1: null, player2: null,
                score1: null, score2: null,
                winner: null
            })
        }

        let roundName
        if (currentSize === 2) roundName = 'Grand Final'
        else if (currentSize === 4) roundName = 'Semi-Finals'
        else if (currentSize === 8) roundName = 'Quarter-Finals'
        else roundName = `Round ${roundNum}`

        allRounds.push({ name: roundName, matches: nextMatches })
        currentSize /= 2
        roundNum++
    }

    // Add 3rd place match after Semi-Finals if bracket has at least 4 real players
    const realPlayers = participants.filter(p => p !== null).length
    if (realPlayers >= 4) {
        allRounds.push({
            name: '3rd Place Match',
            matches: [{
                id: 'third_place',
                player1: null, player2: null,
                score1: null, score2: null,
                winner: null,
                isThirdPlace: true
            }]
        })
    }

    // Auto-advance byes through rounds
    propagateAdvancements(allRounds, mayhemMode, debuffsPool, usersMap, assignDebuffsToMatch)

    return allRounds
}

// Generate seeded bracket order (1vN, 2v(N-1) etc.)
function generateSeededOrder(size) {
    if (size === 1) return [0]
    if (size === 2) return [0, 1]

    const result = [0, 1]
    let currentSize = 2
    while (currentSize < size) {
        const nextResult = []
        for (let i = 0; i < result.length; i++) {
            nextResult.push(result[i])
            nextResult.push(currentSize * 2 - 1 - result[i])
        }
        currentSize *= 2
        result.length = 0
        result.push(...nextResult)
    }
    return result
}

// Unified propagation logic for byes and advancements
export const propagateAdvancements = (allRounds, mayhemMode, debuffsPool, usersMap, assignDebuffsToMatch) => {
    let changed = true
    let limit = 50 // Increased safety limit for DE brackets

    while (changed && limit > 0) {
        changed = false
        limit--

        allRounds.forEach((round, rIdx) => {
            // Skip 3rd place match for normal advancement logic
            if (round.name === '3rd Place Match') return

            round.matches.forEach((match, mIdx) => {
                // 1. Determine winner if it's a bye or has only one valid player
                if (!match.winner) {
                    // One player is real, the other is null or missing
                    if (match.player1 && !match.player2) {
                        match.winner = match.player1
                        match.isBye = true
                        changed = true
                    } else if (!match.player1 && match.player2) {
                        match.winner = match.player2
                        match.isBye = true
                        changed = true
                    } else if (match.isBye && !match.player1 && !match.player2) {
                        // Special case: both null (e.g. propagated bye in LB)
                        match.winner = null
                    }
                }

                // 2. Propagate advancement if match has a result (winner or null-bye)
                if (match.winner !== undefined && (match.winner !== null || match.isBye)) {
                    // --- Winner Advancement ---
                    const nextRoundIdx = findNextRoundIdx(allRounds, rIdx, match)
                    if (nextRoundIdx !== -1) {
                        const nextRound = allRounds[nextRoundIdx]
                        const isP1Slot = mIdx % 2 === 0

                        let targetMatchIdx = Math.floor(mIdx / 2)

                        // In some LB rounds (drop-downs), matches don't halve but stay same count
                        if (nextRound.matches.length === round.matches.length) {
                            targetMatchIdx = mIdx
                        }

                        const nextMatch = nextRound.matches[targetMatchIdx]
                        if (nextMatch) {
                            if (isP1Slot) {
                                if (nextMatch.player1?.id !== match.winner?.id) {
                                    nextMatch.player1 = match.winner
                                    changed = true
                                }
                            } else {
                                if (nextMatch.player2?.id !== match.winner?.id) {
                                    nextMatch.player2 = match.winner
                                    changed = true
                                }
                            }
                        }
                    }

                    // --- Loser Drop-down (Double Elim Winners Bracket only) ---
                    if (round.bracket === 'winners') {
                        const loser = match.winner?.id === match.player1?.id ? match.player2 : match.player1
                        propagateLoser(allRounds, rIdx, mIdx, loser, (hasChanged) => { if (hasChanged) changed = true })
                    }
                }

                // 3. Assign debuffs if match just became ready
                if (mayhemMode && match.player1 && match.player2 && !match.winner && !match.debuffs) {
                    if (assignDebuffsToMatch) {
                        const updated = assignDebuffsToMatch(match, debuffsPool, usersMap)
                        Object.assign(match, updated)
                        changed = true
                    }
                }
            })
        })
    }
}

function propagateLoser(allRounds, roundIdx, matchIndex, loser, setChanged) {
    const currentRound = allRounds[roundIdx]
    const wbRounds = allRounds.filter(r => r.bracket === 'winners')
    const wbRelativeIdx = wbRounds.indexOf(currentRound)
    const isWBFinal = currentRound.name === 'WB Final'

    if (isWBFinal) {
        const lbFinal = allRounds.find(r => r.name === 'LB Final')
        if (lbFinal) {
            const m = lbFinal.matches[0]
            if (m.player1?.id !== loser?.id && !m.player1) { m.player1 = loser; setChanged(true) }
            else if (m.player2?.id !== loser?.id && !m.player2) { m.player2 = loser; setChanged(true) }
        }
        return
    }

    const lbRound = allRounds.find(r =>
        r.bracket === 'losers' && r.matches.some(m =>
            (m.feedsFrom?.type === 'wb_losers' && m.feedsFrom.wbRound === wbRelativeIdx) ||
            (m.feedsFrom?.type === 'wb_drop' && m.feedsFrom.wbRound === wbRelativeIdx)
        )
    )

    if (lbRound) {
        const isDrop = lbRound.matches[0].feedsFrom?.type === 'wb_drop'
        const reverse = lbRound.matches[0].feedsFrom?.reverse
        const wbSize = currentRound.matches.length

        let targetMatchIdx
        if (isDrop) {
            targetMatchIdx = reverse ? wbSize - 1 - matchIndex : matchIndex
        } else {
            targetMatchIdx = Math.floor(matchIndex / 2)
            if (reverse) targetMatchIdx = (wbSize / 2) - 1 - targetMatchIdx
        }

        const lbMatch = lbRound.matches[targetMatchIdx]
        if (lbMatch) {
            if (!lbMatch.player1 && lbMatch.player1?.id !== loser?.id) { lbMatch.player1 = loser; setChanged(true) }
            else if (!lbMatch.player2 && lbMatch.player2?.id !== loser?.id) { lbMatch.player2 = loser; setChanged(true) }
        }
    }
}

function findNextRoundIdx(allRounds, currentRoundIdx, match) {
    if (match.isThirdPlace) return -1

    // For single elimination, find the round with 1/2 the matches or Grand Final
    const currentRound = allRounds[currentRoundIdx]
    if (currentRound.name === 'Grand Final' || currentRound.bracket === 'grand_final') return -1

    // Determine type: winners or losers
    const currentBracket = currentRound.bracket || 'winners'

    // Generic next round search
    for (let i = currentRoundIdx + 1; i < allRounds.length; i++) {
        const r = allRounds[i]
        if (r.name === '3rd Place Match') continue
        if (r.bracket === currentBracket || (currentBracket === 'winners' && r.bracket === 'grand_final') || (currentBracket === 'losers' && r.name === 'LB Final')) return i
    }
    return -1
}

// ─── DOUBLE ELIMINATION ───────────────────────────────────────────

export const generateDoubleEliminationBracket = (participants, mayhemMode, debuffsPool, usersMap, assignDebuffsToMatch) => {
    const count = participants.length
    let size = 2
    while (size < count) size *= 2

    // --- Winners Bracket (same as single elim minus 3rd place) ---
    const seeded = [...participants]
    const filledParticipants = []
    for (let i = 0; i < size; i++) {
        filledParticipants.push(i < seeded.length ? seeded[i] : null)
    }

    const seededOrder = generateSeededOrder(size)
    const ordered = seededOrder.map(idx => filledParticipants[idx] || null)

    // WB Round 1
    const wbR1Matches = []
    for (let i = 0; i < size; i += 2) {
        const p1 = ordered[i]
        const p2 = ordered[i + 1]
        let match = {
            id: `wb_r1_m${i / 2}`,
            player1: p1, player2: p2,
            score1: null, score2: null,
            winner: (!p1 && p2) ? p2 : ((p1 && !p2) ? p1 : null),
            isBye: !p1 || !p2,
            bracket: 'winners'
        }
        if (mayhemMode && !match.isBye && !match.winner) {
            match = assignDebuffsToMatch(match, debuffsPool, usersMap)
        }
        wbR1Matches.push(match)
    }

    const winnersRounds = [{ name: 'WB Round 1', matches: wbR1Matches, bracket: 'winners' }]
    let wbSize = wbR1Matches.length
    let wbRound = 2
    while (wbSize > 1) {
        const nextMatches = []
        for (let i = 0; i < wbSize; i += 2) {
            nextMatches.push({
                id: `wb_r${wbRound}_m${i / 2}`,
                player1: null, player2: null,
                score1: null, score2: null,
                winner: null, bracket: 'winners'
            })
        }
        let name
        if (wbSize === 2) name = 'WB Final'
        else if (wbSize === 4) name = 'WB Semi-Finals'
        else name = `WB Round ${wbRound}`
        winnersRounds.push({ name, matches: nextMatches, bracket: 'winners' })
        wbSize /= 2
        wbRound++
    }

    // --- Losers Bracket ---
    // LB has (wbRounds - 1) * 2 rounds
    // Round pattern: drop-down round (losers from WB join), then internal LB round
    const numWBRounds = winnersRounds.length
    const losersRounds = []
    let lbMatchCount = Math.floor(size / 2) // First LB round has half the WB R1 matches
    let lbRound = 1

    for (let wbr = 0; wbr < numWBRounds - 1; wbr++) {
        // Drop-down round: losers from WB round (wbr) face LB survivors (or enter directly)
        if (wbr === 0) {
            // First LB round: losers from WB R1 face each other
            const lbMatches = []
            for (let i = 0; i < lbMatchCount; i += 2) {
                lbMatches.push({
                    id: `lb_r${lbRound}_m${i / 2}`,
                    player1: null, player2: null,
                    score1: null, score2: null,
                    winner: null, bracket: 'losers',
                    feedsFrom: { type: 'wb_losers', wbRound: 0, reverse: false }
                })
            }
            losersRounds.push({ name: `LB Round ${lbRound}`, matches: lbMatches, bracket: 'losers' })
            lbRound++
            lbMatchCount = lbMatches.length
        }

        if (wbr > 0) {
            // Drop-down: WB losers from round wbr face LB survivors
            const dropMatches = []
            const numMatches = lbMatchCount
            for (let i = 0; i < numMatches; i++) {
                dropMatches.push({
                    id: `lb_r${lbRound}_m${i}`,
                    player1: null, player2: null, // slot1 = LB survivor, slot2 = WB dropout
                    score1: null, score2: null,
                    winner: null, bracket: 'losers',
                    feedsFrom: { type: 'wb_drop', wbRound: wbr, reverse: wbr % 2 === 1 }
                })
            }
            losersRounds.push({ name: `LB Round ${lbRound}`, matches: dropMatches, bracket: 'losers' })
            lbRound++

            // Internal LB round (survivors face each other)
            if (numMatches > 1) {
                const internalMatches = []
                for (let i = 0; i < numMatches; i += 2) {
                    internalMatches.push({
                        id: `lb_r${lbRound}_m${i / 2}`,
                        player1: null, player2: null,
                        score1: null, score2: null,
                        winner: null, bracket: 'losers'
                    })
                }
                losersRounds.push({ name: `LB Round ${lbRound}`, matches: internalMatches, bracket: 'losers' })
                lbRound++
                lbMatchCount = internalMatches.length
            } else {
                // Only 1 match, no internal round needed
            }
        }
    }

    // LB Final
    losersRounds.push({
        name: 'LB Final',
        matches: [{
            id: 'lb_final',
            player1: null, player2: null,
            score1: null, score2: null,
            winner: null, bracket: 'losers'
        }],
        bracket: 'losers'
    })

    // --- Grand Final ---
    const grandFinal = {
        name: 'Grand Final',
        matches: [{
            id: 'grand_final',
            player1: null, player2: null,
            score1: null, score2: null,
            winner: null, bracket: 'grand_final'
        }],
        bracket: 'grand_final'
    }

    const allRounds = [...winnersRounds, ...losersRounds, grandFinal]

    // Auto-advance byes in all brackets
    propagateAdvancements(allRounds, mayhemMode, debuffsPool, usersMap, assignDebuffsToMatch)

    return allRounds
}

// ─── GROUP STAGE ──────────────────────────────────────────────────

/**
 * Divides participants into groups based on the requirements:
 * - If odd number of players: Single group.
 * - If even and < 6 players: Single group.
 * - If even and >= 6 players: Two groups.
 */
export const generateGroups = (participants) => {
    const n = participants.length
    if (n % 2 !== 0 || n < 6) {
        return [{ name: 'Group A', players: participants }]
    } else {
        const mid = n / 2
        return [
            { name: 'Group A', players: participants.slice(0, mid) },
            { name: 'Group B', players: participants.slice(mid) }
        ]
    }
}

/**
 * Standard Round Robin pairing (Circle Method)
 */
export const generateRoundRobinMatches = (players) => {
    const pairings = []
    const n = players.length
    if (n < 2) return pairings

    const tempPlayers = [...players]
    if (n % 2 !== 0) tempPlayers.push(null) // Bye placeholder

    const rounds = tempPlayers.length - 1
    const half = tempPlayers.length / 2

    for (let round = 0; round < rounds; round++) {
        for (let i = 0; i < half; i++) {
            const p1 = tempPlayers[i]
            const p2 = tempPlayers[tempPlayers.length - 1 - i]
            if (p1 && p2) {
                pairings.push({ player1Id: p1.id, player2Id: p2.id })
            }
        }
        // Rotate: keep first element, move others
        tempPlayers.splice(1, 0, tempPlayers.pop())
    }
    return pairings
}

export const initGroupStandings = (players) => {
    return players.map(p => ({
        playerId: p.id,
        playerName: p.name,
        player: p,
        score: 0,       // wins
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
        matchesPlayed: 0
    }))
}

/**
 * Seed players into elimination bracket based on Group standings
 * and the specific pairing rules:
 * - Single group: 1st vs last, 2nd vs second-to-last, etc.
 * - Two groups: A1 vs BLAST, B1 vs ALAST, etc.
 */
export const seedFromGroups = (groups) => {
    // Rank each group first
    const rankedGroups = groups.map(group => {
        return [...group.standings].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score
            return b.pointDiff - a.pointDiff
        })
    })

    const participants = []

    if (rankedGroups.length === 1) {
        const sorted = rankedGroups[0]
        const n = sorted.length

        // Custom rule: for 5 players (or any odd N), 1st seed gets a bye
        if (n % 2 !== 0) {
            // Rank 1 gets bye, others pair up
            participants.push(sorted[0].player) // Seed 1
            participants.push(null)             // Bye for Seed 1

            // Remaining players (2, 3, 4, 5...) paired 2nd vs last, 3rd vs second-to-last
            const remaining = sorted.slice(1)
            for (let i = 0; i < Math.floor(remaining.length / 2); i++) {
                participants.push(remaining[i].player)
                participants.push(remaining[remaining.length - 1 - i].player)
            }
        } else {
            // Even: 1vN, 2v(N-1) etc.
            for (let i = 0; i < n / 2; i++) {
                participants.push(sorted[i].player)
                participants.push(sorted[n - 1 - i].player)
            }
        }
    } else {
        // Two groups: A1 vs BLAST, B1 vs ALAST, A2 vs B(LAST-1), etc.
        const groupA = rankedGroups[0]
        const groupB = rankedGroups[1]
        const m = groupA.length // They are split evenly

        for (let i = 0; i < Math.floor(m / 2); i++) {
            const oppositeIdx = m - 1 - i

            // Pair Ai vs B(opposite)
            participants.push(groupA[i].player)
            participants.push(groupB[oppositeIdx].player)

            // Pair Bi vs A(opposite)
            participants.push(groupB[i].player)
            participants.push(groupA[oppositeIdx].player)
        }

        // If m is odd, pair the middle players from each group
        if (m % 2 !== 0) {
            const mid = Math.floor(m / 2)
            participants.push(groupA[mid].player)
            participants.push(groupB[mid].player)
        }
    }



    return participants
}

