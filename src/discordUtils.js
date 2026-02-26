import { supabase } from "./supabaseClient";

/**
 * Fetches all matches played on a specific date (local time).
 * @param {Date} date
 */
export const getDailyStats = async (date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Ping Pong Matches
  const { data: pingPongMatches, error: ppError } = await supabase
    .from("matches")
    .select("*, player1:player1_id(name), player2:player2_id(name)")
    .gte("created_at", startOfDay.toISOString())
    .lte("created_at", endOfDay.toISOString());

  if (ppError) console.error("Error fetching ping pong matches:", ppError);

  // Padel Matches
  const { data: padelMatches, error: padelError } = await supabase
    .from("padel_matches")
    .select(
      "*, t1p1:team1_player1_id(name), t1p2:team1_player2_id(name), t2p1:team2_player1_id(name), t2p2:team2_player2_id(name)",
    )
    .gte("created_at", startOfDay.toISOString())
    .lte("created_at", endOfDay.toISOString());

  if (padelError) console.error("Error fetching padel matches:", padelError);

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

  // Ping Pong Section
  if (stats.pingPong.length > 0) {
    content += `### 🏓 Ping Pong Highlights\n`;
    const h2h = {};

    stats.pingPong.forEach((m) => {
      const p1 = m.player1?.name || "Unknown";
      const p2 = m.player2?.name || "Unknown";
      const players = [p1, p2].sort().join(" vs ");

      if (!h2h[players])
        h2h[players] = { p1, p2, p1Wins: 0, p2Wins: 0, matches: 0 };
      h2h[players].matches++;
      if (m.score1 > m.score2) h2h[players].p1Wins++;
      else h2h[players].p2Wins++;
    });

    Object.values(h2h).forEach((pair) => {
      content += `• **${pair.p1}** vs **${pair.p2}**: ${pair.p1Wins}-${pair.p2Wins} (${pair.matches} games)\n`;
    });
    content += `\n`;
  }

  // Padel Section
  if (stats.padel.length > 0) {
    content += `### 🎾 Padel Highlights\n`;
    const h2h = {};

    stats.padel.forEach((m) => {
      const t1 = `${m.t1p1?.name || "?"}/${m.t1p2?.name || "?"}`;
      const t2 = `${m.t2p1?.name || "?"}/${m.t2p2?.name || "?"}`;
      const teams = [t1, t2].sort().join(" vs ");

      if (!h2h[teams])
        h2h[teams] = { t1, t2, t1Wins: 0, t2Wins: 0, matches: 0 };
      h2h[teams].matches++;
      if (m.score1 > m.score2) h2h[teams].t1Wins++;
      else h2h[teams].t2Wins++;
    });

    Object.values(h2h).forEach((pair) => {
      content += `• **${pair.t1}** vs **${pair.t2}**: ${pair.t1Wins}-${pair.t2Wins} (${pair.matches} matches)\n`;
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
export const sendToDiscord = async (webhookUrl, payload) => {
  if (!webhookUrl) throw new Error("No webhook URL provided");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Discord API error: ${err}`);
  }

  return true;
};

export const getDiscordWebhook = async () => {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "discord_webhook_url")
    .single();

  if (error) {
    console.error("Error fetching webhook URL:", error);
    return null;
  }
  return data?.value || "";
};

export const updateDiscordWebhook = async (url) => {
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "discord_webhook_url", value: url });

  if (error) {
    console.error("Error updating webhook URL:", error);
    throw error;
  }
};
