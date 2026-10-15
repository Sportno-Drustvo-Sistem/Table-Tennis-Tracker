import { getMatchWinner } from './padelUtils'
import { localDateBounds, toLocalISO } from './dateRange'
import { fetchAllMatches } from './seasonUtils'
import { supabase } from "./supabaseClient";

/**
 * Fetches all matches played on a specific date (local time).
 * @param {Date} date
 */
export const getDailyStats = async (date) => {
  const { start, end } = localDateBounds(toLocalISO(date), toLocalISO(date))
  const [pingpong, padel] = await Promise.all([
    fetchAllMatches(supabase, 'matches', { select: '*, player1:player1_id(name, elo_rating), player2:player2_id(name, elo_rating)', start, end }),
    fetchAllMatches(supabase, 'padel_matches', { select: '*, t1p1:team1_player1_id(name), t1p2:team1_player2_id(name), t2p1:team2_player1_id(name), t2p2:team2_player2_id(name)', start, end }),
  ])
  if (pingpong.error || padel.error) throw (pingpong.error || padel.error)
  const pingPongMatches = pingpong.data
  const padelMatches = padel.data

  return {
    pingPong: pingPongMatches || [],
    padel: padelMatches || [],
  };
};

/**
 * Formats daily stats into a Discord message payload.
 */
export const formatDiscordMessage = (stats, date) => {
  const dateStr = new Date(date).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let content = `## 🏓 Table Tennis & Padel Daily Report - ${dateStr}\n\n`;

  // --- Ping Pong Section ---
  if (stats.pingPong.length > 0) {
    content += `### 🏓 Ping Pong Highlights\n`;

    // Build H2H: group by player pair, track individual scores and wins correctly
    const h2h = {};
    const playCounts = {};
    let biggestUpset = null; // { winner, loser, eloDiff, score }

    stats.pingPong.forEach((m) => {
      const p1Name = m.player1?.name || "Unknown";
      const p2Name = m.player2?.name || "Unknown";
      const p1Elo = m.player1?.elo_rating || 1200;
      const p2Elo = m.player2?.elo_rating || 1200;

      // Consistent key: always alphabetical
      const sortedNames = [p1Name, p2Name].sort();
      const key = sortedNames.join(" vs ");

      if (!h2h[key]) {
        h2h[key] = {
          nameA: sortedNames[0],
          nameB: sortedNames[1],
          winsA: 0,
          winsB: 0,
          matches: 0,
          scores: [],
        };
      }

      h2h[key].matches++;

      // Determine winner name and track wins by the correct person
      const winnerName = m.score1 > m.score2 ? p1Name : p2Name;
      if (winnerName === h2h[key].nameA) h2h[key].winsA++;
      else h2h[key].winsB++;

      // Track individual game scores
      h2h[key].scores.push(`${m.score1}-${m.score2}`);

      // Play counts for most active
      playCounts[p1Name] = (playCounts[p1Name] || 0) + 1;
      playCounts[p2Name] = (playCounts[p2Name] || 0) + 1;

      // Biggest upset
      const winnerElo = m.score1 > m.score2 ? p1Elo : p2Elo;
      const loserElo = m.score1 > m.score2 ? p2Elo : p1Elo;
      const eloDiff = loserElo - winnerElo;
      if (eloDiff > 0 && (!biggestUpset || eloDiff > biggestUpset.eloDiff)) {
        biggestUpset = {
          winner: winnerName,
          loser: m.score1 > m.score2 ? p2Name : p1Name,
          eloDiff,
          score: `${m.score1}-${m.score2}`,
        };
      }
    });

    // H2H output with individual scores
    Object.values(h2h).forEach((pair) => {
      content += `• **${pair.nameA}** vs **${pair.nameB}**: ${pair.winsA}-${pair.winsB} (${pair.scores.join(", ")})\n`;
    });
    content += `\n`;

    // Most Active Player
    const mostActive = Object.entries(playCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostActive) {
      content += `🔥 **Most Active:** ${mostActive[0]} (${mostActive[1]} games)\n`;
    }

    // Biggest Upset
    if (biggestUpset && biggestUpset.eloDiff >= 50) {
      content += `😱 **Biggest Upset:** ${biggestUpset.winner} beat ${biggestUpset.loser} (${biggestUpset.score}) — ${biggestUpset.eloDiff} ELO gap!\n`;
    }

    content += `\n`;
  }

  // --- Padel Section ---
  if (stats.padel.length > 0) {
    content += `### 🎾 Padel Highlights\n`;
    const h2h = {};

    stats.padel.forEach((m) => {
      const t1 = `${m.t1p1?.name || "?"}/${m.t1p2?.name || "?"}`;
      const t2 = `${m.t2p1?.name || "?"}/${m.t2p2?.name || "?"}`;
      const sortedTeams = [t1, t2].sort();
      const key = sortedTeams.join(" vs ");

      if (!h2h[key]) {
        h2h[key] = {
          teamA: sortedTeams[0],
          teamB: sortedTeams[1],
          winsA: 0,
          winsB: 0,
          matches: 0,
          scores: [],
        };
      }

      h2h[key].matches++;
      const winner = getMatchWinner(m);
      const winnerTeam = winner === 1 ? t1 : winner === 2 ? t2 : null;
      const sortedWinner = [t1, t2].sort()[0] === winnerTeam ? "A" : "B";
      if (winner && sortedWinner === "A") h2h[key].winsA++;
      else if (winner) h2h[key].winsB++;
      h2h[key].scores.push(`${m.score1}-${m.score2}`);
    });

    Object.values(h2h).forEach((pair) => {
      content += `• **${pair.teamA}** vs **${pair.teamB}**: ${pair.winsA}-${pair.winsB} (${pair.scores.join(", ")})\n`;
    });
    content += `\n`;
  }

  if (stats.pingPong.length === 0 && stats.padel.length === 0) {
    content += `No matches played today. Go out there and smash some balls! 🚀`;
  }

  return {
    content: content,
    username: "Table Tennis Tracker",
    avatar_url:
      "https://raw.githubusercontent.com/lucide-react/lucide/main/icons/trophy.png",
  };
};

/**
 * Sends stats to Discord webhook.
 */
const discordRequest = async (adminToken, action, values = {}) => {
  if (!adminToken) throw new Error('Admin session required')
  const { data, error } = await supabase.functions.invoke('discord-admin', { body: { adminToken, action, ...values } })
  if (error) throw new Error('Discord request failed. Check your admin session and server configuration.')
  if (data?.error) throw new Error(data.error)
  return data
}

export const getDiscordStatus = adminToken => discordRequest(adminToken, 'status')
export const updateDiscordWebhook = (adminToken, url) => discordRequest(adminToken, 'update', { url })
export const sendToDiscord = (adminToken, payload) => discordRequest(adminToken, 'send', { payload })
