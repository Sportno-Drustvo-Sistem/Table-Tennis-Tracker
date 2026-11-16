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
    propagateAdvancements(allRounds, mayhemMode, debuffsPool, usersMap, assignDebuffsToMatch, true)

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

// Each incoming slot has exactly one source. A missing participant becomes a bye
// only after that source has resolved; waiting for a result is never a bye.
export const propagateAdvancements = (allRounds, mayhemMode, debuffsPool, usersMap, assignDebuffsToMatch) => {
    const wb = allRounds.filter(r => r.bracket === 'winners')
    const lb = allRounds.filter(r => r.bracket === 'losers')
    const single = allRounds.filter(r => !r.bracket && r.name !== '3rd Place Match')
    const sources = new Map()
    const win = match => ({ match, loser: false })
    const lose = match => ({ match, loser: true })
    const pair = (previous, index) => [win(previous.matches[index * 2]), win(previous.matches[index * 2 + 1])]
    single.slice(1).forEach((r, i) => r.matches.forEach((m, j) => sources.set(m, pair(single[i], j))))
    wb.slice(1).forEach((r, i) => r.matches.forEach((m, j) => sources.set(m, pair(wb[i], j))))
    lb.forEach((r, i) => r.matches.forEach((m, j) => {
        const feed = m.feedsFrom
        if (feed?.type === 'wb_losers') {
            sources.set(m, [lose(wb[0].matches[j * 2]), lose(wb[0].matches[j * 2 + 1])])
        } else if (feed?.type === 'wb_drop') {
            const dropped = wb[feed.wbRound].matches
            sources.set(m, [win(lb[i - 1].matches[j]), lose(dropped[feed.reverse ? dropped.length - 1 - j : j])])
        } else if (r.name === 'LB Final') {
            sources.set(m, [i ? win(lb[i - 1].matches[0]) : null, lose(wb[wb.length - 1].matches[0])])
        } else if (i) sources.set(m, pair(lb[i - 1], j))
    }))
    const gf = allRounds.find(r => r.bracket === 'grand_final')?.matches[0]
    if (gf) sources.set(gf, [win(wb[wb.length - 1].matches[0]), win(lb[lb.length - 1].matches[0])])

    const resolved = new Set()
    const value = source => {
        if (!source?.match) return { ready: true, player: null }
        const m = source.match
        if (!resolved.has(m)) return { ready: false }
        return { ready: true, player: source.loser
            ? (m.winner?.id === m.player1?.id ? m.player2 : m.player1) : m.winner }
    }
    // Rounds are topologically ordered: WB, LB, then final.
    allRounds.forEach(r => r.matches.forEach(m => {
        const incoming = sources.get(m)
        if (incoming) {
            const slots = incoming.map(value)
            slots.forEach((slot, i) => { if (slot.ready) m['player' + (i + 1)] = slot.player || null })
            if (slots.every(slot => slot.ready) && (!m.player1 || !m.player2)) {
                m.isBye = true
                m.winner = m.player1 || m.player2 || null
            }
        }
        if (m.winner || m.isBye) resolved.add(m)
        if (mayhemMode && m.player1 && m.player2 && !m.winner && !m.debuffs && assignDebuffsToMatch) {
            Object.assign(m, assignDebuffsToMatch(m, debuffsPool, usersMap))
        }
    }))
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
    propagateAdvancements(allRounds, mayhemMode, debuffsPool, usersMap, assignDebuffsToMatch, true)

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
        // Just return the single group straight down from 1st to last
        return rankedGroups[0].map(s => s.player)
    } else {
        // Interleaved serpentine seeding for 2+ groups
        // e.g., A1, B1, A2, B2, A3, B3
        const maxLen = Math.max(...rankedGroups.map(g => g.length))
        for (let i = 0; i < maxLen; i++) {
            for (let g = 0; g < rankedGroups.length; g++) {
                if (rankedGroups[g][i]) {
                    participants.push(rankedGroups[g][i].player)
                }
            }
        }
    }

    return participants
}

export const checkTournamentComplete = (tournament) => {
    const rounds = tournament.rounds
    const grandFinal = rounds.find(r => r.name === 'Grand Final')
    const thirdPlace = rounds.find(r => r.name === '3rd Place Match')

    const gfDone = grandFinal?.matches[0]?.winner
    const tpDone = !thirdPlace || thirdPlace?.matches[0]?.winner

    if (gfDone && tpDone) {
        tournament.status = 'completed'
        return true;
    }
    return false;
}

export const handleSingleElimAdvancement = (tournament, roundIdx, matchIndex, match, winner, loser, debuffsPool, usersMap, assignDebuffsToMatch) => {
    const rounds = tournament.rounds
    const thirdPlaceRoundIdx = rounds.findIndex(r => r.name === '3rd Place Match')
    const grandFinalRoundIdx = rounds.findIndex(r => r.name === 'Grand Final')

    const isSemiFinal = rounds[roundIdx]?.name === 'Semi-Finals'

    if (match.isThirdPlace) {
        return checkTournamentComplete(tournament)
    }

    if (isSemiFinal && thirdPlaceRoundIdx !== -1) {
        const thirdMatch = rounds[thirdPlaceRoundIdx].matches[0]
        if (!thirdMatch.player1) thirdMatch.player1 = loser
        else if (!thirdMatch.player2) thirdMatch.player2 = loser

        if (thirdMatch.player1 && thirdMatch.player2 && tournament.config?.mayhemMode) {
            assignDebuffsToMatch(thirdMatch, debuffsPool, usersMap)
        }
    }

    if (roundIdx === grandFinalRoundIdx) {
        if (rounds[grandFinalRoundIdx]?.matches[0]?.winner) {
            return checkTournamentComplete(tournament)
        }
        return false
    }

    let nextRoundIdx = roundIdx + 1
    if (nextRoundIdx < rounds.length && rounds[nextRoundIdx].name === '3rd Place Match') {
        nextRoundIdx = grandFinalRoundIdx
    }

    if (nextRoundIdx !== -1 && nextRoundIdx < rounds.length && !rounds[nextRoundIdx].matches[0]?.isThirdPlace) {
        const nextMatchIdx = Math.floor(matchIndex / 2)
        const isP1Slot = matchIndex % 2 === 0
        const nextMatch = rounds[nextRoundIdx].matches[nextMatchIdx]
        if (nextMatch) {
            if (isP1Slot) nextMatch.player1 = winner
            else nextMatch.player2 = winner

            if (nextMatch.player1 && nextMatch.player2 && tournament.config?.mayhemMode) {
                assignDebuffsToMatch(nextMatch, debuffsPool, usersMap)
            }
        }
    }

    if (rounds[grandFinalRoundIdx]?.matches[0]?.winner) {
        return checkTournamentComplete(tournament)
    }
    return false
}

export const handleDoubleElimAdvancement = (tournament, _roundIdx, _matchIndex, _winner, _loser, debuffsPool, usersMap, assignDebuffsToMatch) => {
    propagateAdvancements(tournament.rounds, tournament.config?.mayhemMode, debuffsPool, usersMap, assignDebuffsToMatch)
    return checkTournamentComplete(tournament)
}
