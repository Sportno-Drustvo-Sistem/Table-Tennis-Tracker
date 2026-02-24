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
    const allRounds = [{ name: 'Round 1', matches }]
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
    autoAdvanceByes(allRounds)

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

// Auto-advance byes through bracket rounds
function autoAdvanceByes(rounds) {
    for (let rIdx = 0; rIdx < rounds.length - 1; rIdx++) {
        const round = rounds[rIdx]
        if (round.name === '3rd Place Match') continue

        round.matches.forEach((match, mIdx) => {
            if (match.winner && match.isBye) {
                // Propagate to next round
                const nextRoundIdx = rIdx + 1
                const nextRound = rounds[nextRoundIdx]
                if (!nextRound || nextRound.name === '3rd Place Match') return

                const nextMatchIdx = Math.floor(mIdx / 2)
                const isP1Slot = mIdx % 2 === 0
                const nextMatch = nextRound.matches[nextMatchIdx]
                if (!nextMatch) return

                if (isP1Slot) nextMatch.player1 = match.winner
                else nextMatch.player2 = match.winner

                // Check if next match also becomes a bye
                if (nextMatch.player1 && !nextMatch.player2) {
                    // Wait for other match
                } else if (!nextMatch.player1 && nextMatch.player2) {
                    // Wait for other match
                } else if (nextMatch.player1 && nextMatch.player2) {
                    // Both filled, check if one is bye (shouldn't happen at this level)
                }
            }
        })
    }
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

    // Auto-advance byes in winners bracket
    autoAdvanceByesDE(allRounds, winnersRounds.length)

    return allRounds
}

function autoAdvanceByesDE(allRounds, wbRoundCount) {
    // Only auto-advance within winners bracket
    for (let rIdx = 0; rIdx < wbRoundCount - 1; rIdx++) {
        const round = allRounds[rIdx]
        round.matches.forEach((match, mIdx) => {
            if (match.winner && match.isBye) {
                const nextRoundIdx = rIdx + 1
                const nextMatch = allRounds[nextRoundIdx].matches[Math.floor(mIdx / 2)]
                if (!nextMatch) return
                if (mIdx % 2 === 0) nextMatch.player1 = match.winner
                else nextMatch.player2 = match.winner
            }
        })
    }
}

// ─── SWISS STAGE ──────────────────────────────────────────────────

export const generateSwissRound = (standings, roundHistory, allPlayers) => {
    // Sort by score desc, then by tiebreaker (point diff)
    const sorted = [...standings].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return b.pointDiff - a.pointDiff
    })

    const paired = []
    const usedIds = new Set()
    const pairings = []

    // Build set of previous matchups to avoid
    const previousMatchups = new Set()
    roundHistory.forEach(round => {
        round.forEach(m => {
            if (m.player1Id && m.player2Id) {
                previousMatchups.add(`${m.player1Id}_${m.player2Id}`)
                previousMatchups.add(`${m.player2Id}_${m.player1Id}`)
            }
        })
    })

    // Greedy pairing by proximity in standings
    for (let i = 0; i < sorted.length; i++) {
        if (usedIds.has(sorted[i].playerId)) continue

        let bestJ = -1
        for (let j = i + 1; j < sorted.length; j++) {
            if (usedIds.has(sorted[j].playerId)) continue
            const key = `${sorted[i].playerId}_${sorted[j].playerId}`
            if (!previousMatchups.has(key)) {
                bestJ = j
                break
            }
        }

        // Fallback: pick next available even if rematch
        if (bestJ === -1) {
            for (let j = i + 1; j < sorted.length; j++) {
                if (!usedIds.has(sorted[j].playerId)) {
                    bestJ = j
                    break
                }
            }
        }

        if (bestJ !== -1) {
            usedIds.add(sorted[i].playerId)
            usedIds.add(sorted[bestJ].playerId)
            pairings.push({
                player1Id: sorted[i].playerId,
                player2Id: sorted[bestJ].playerId
            })
        }
    }

    // Handle bye for odd player out
    let byePlayerId = null
    for (const s of sorted) {
        if (!usedIds.has(s.playerId)) {
            byePlayerId = s.playerId
            break
        }
    }

    return { pairings, byePlayerId }
}

export const initSwissStandings = (players) => {
    return players.map(p => ({
        playerId: p.id,
        playerName: p.name,
        player: p,
        score: 0,       // wins
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
        matchesPlayed: 0,
        hadBye: false
    }))
}

export const getSwissRoundCount = (playerCount) => {
    return Math.ceil(Math.log2(playerCount))
}

// Seed players into elimination bracket based on Swiss standings
export const seedFromSwiss = (standings) => {
    return [...standings]
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score
            return b.pointDiff - a.pointDiff
        })
        .map(s => s.player)
}
