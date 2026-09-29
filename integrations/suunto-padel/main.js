/* SuuntoPlus callbacks run as an ES5 script, not an ES module. */
/* exported onLoad, onEvent, evaluate, getUserInterface, getSummaryOutputs */
var match;
var pointHistory;

function onLoad(_input, output) {
    var format = localStorage.getItem('matchFormat');
    match = { points: [0, 0], games: [0, 0], sets: [], winner: 0, format: format === '0' ? 1 : 3 };
    pointHistory = [];
    updateOutput(output);
}

var snapshot = function () {
    return {
        points: match.points.slice(), games: match.games.slice(),
        sets: match.sets.slice(), winner: match.winner, format: match.format
    };
};

var pointLabel = function (team) {
    var points = match.points[team];
    var opponent = match.points[1 - team];
    if (match.games[0] === 6 && match.games[1] === 6) return points;
    if (points >= 3 && opponent >= 3) return points > opponent ? -1 : 40;
    return [0, 15, 30, 40][points];
};

var updateOutput = function (output) {
    output.p1 = pointLabel(0);
    output.p2 = pointLabel(1);
    output.g1 = match.games[0];
    output.g2 = match.games[1];
    output.w = match.winner;
    output.n1 = 0;
    output.n2 = 0;
    for (var i = 0; i < match.sets.length; i++) {
        if (Math.floor(match.sets[i] / 10) > match.sets[i] % 10) output.n1++;
        else output.n2++;
    }
};

var scorePoint = function (team) {
    if (match.winner) return;
    // Keep the last eight points available for undo within watch memory limits.
    pointHistory.push(snapshot());
    if (pointHistory.length > 8) pointHistory.shift();
    var other = 1 - team;
    var tiebreak = match.games[0] === 6 && match.games[1] === 6;
    match.points[team]++;
    var target = tiebreak ? 7 : 4;
    if (match.points[team] < target || match.points[team] - match.points[other] < 2) {
        // Normalize deuce to keep counters small, including unusually long games.
        if (!tiebreak && match.points[0] > 3 && match.points[0] === match.points[1]) {
            match.points = [3, 3];
        }
        return;
    }
    match.games[team]++;
    match.points = [0, 0];
    if (!tiebreak && (match.games[team] < 6 || match.games[team] - match.games[other] < 2)) return;
    match.sets.push(match.games[0] * 10 + match.games[1]);
    var wins = 0;
    for (var i = 0; i < match.sets.length; i++) {
        var firstWon = Math.floor(match.sets[i] / 10) > match.sets[i] % 10;
        if ((team === 0 && firstWon) || (team === 1 && !firstWon)) wins++;
    }
    if (wins >= (match.format + 1) / 2) match.winner = team + 1;
    else match.games = [0, 0];
};

function onEvent(_input, output, eventId) {
    if (eventId === 1) scorePoint(0);
    else if (eventId === 3) scorePoint(1);
    else if ((eventId === 2 || eventId === 4) && pointHistory.length) match = pointHistory.pop();
    updateOutput(output);
}

function evaluate(_input, output) {
    updateOutput(output);
}

function getUserInterface() {
    return { template: 't' };
}

function getSummaryOutputs() {
    // Four float32-safe integer fields; protocol embeds version, format, winner,
    // and set count. A zero winner means the match was stopped before completion.
    return [
        { id: 'v', name: 'Result code', format: 'Count_Fourdigits', value: 1000 + match.format * 100 + match.winner * 10 + match.sets.length },
        { id: 'a', name: 'Set 1 code', format: 'Count_Twodigits', value: match.sets[0] || 0 },
        { id: 'b', name: 'Set 2 code', format: 'Count_Twodigits', value: match.sets[1] || 0 },
        { id: 'c', name: 'Set 3 code', format: 'Count_Twodigits', value: match.sets[2] || 0 }
    ];
}
