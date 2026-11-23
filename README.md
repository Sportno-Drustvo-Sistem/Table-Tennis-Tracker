# 🏓 Ping Pong & Padel Tracker

A modern, high-performance web application for tracking sports leagues, tournaments, and player statistics. Designed for local clubs, office leagues, or competitive circles to professionalize their matches.

## 🌟 Key Features

### 🎙️ Live Umpire & Voice (New!)

* **Point-by-Point Scoring**: Real-time match tracking with a dedicated umpire interface.
* **Point-by-point Scoring**: Record which player won each point. Undo removes the last point from the current game's history. Use **Start game** between games, or undo the game-winning point to correct it. Saved games retain their point sequence and score progression; score edits clear that game's point history.
* **Serve Indicator**: Choose the first server; service changes every two points, every point at 10–10, and the starting server alternates between games.
* **Voice Announcements**: Built-in `speechSynthesis` to call scores and match points automatically.

### 📢 Discord Integration (New!)

* **Daily Reports**: Automatic summaries of the day's action sent directly to your Discord server.
* **Highlight Detection**: Automatically identifies biggest upsets (ELO gaps) and most active players.
* **H2H Summaries**: Detailed breakdown of every matchup played that day.

### 🏆 Tournaments

* **Bracket Management**: Generate Single or Double Elimination brackets for 4-16 players.
* **Trophy Case**: Winners earn permanent virtual trophies displayed on their global profiles.
* **Management**: Full control to create, manage, and delete tournaments as needed.
* **Integrated Stats**: Every tournament match feeds back into global player rankings.

### 🎾 Padel & Doubles Support

* **2v2 Tracking**: Full support for Padel doubles with team-based stats.
* **Independent Rankings**: Padel ELO and history are tracked separately from Ping Pong.
* **Synergy Analysis**: See which player partnerships are the most dominant.

### 💹 Advanced ELO & Ranking System

* **Dynamic K-Factor**: Adjusted based on match experience to ensure fair progression.
* **Handicap System**: Automatic debuffs suggested for players on significant winning streaks to keep games competitive.
* **Professional Tiers**: Custom ranks from **Iron** to **Champion** based on MMR.

### 📊 Player Statistics

* **Ping Pong Seasons**: Choose the current season, Season 1, or All-time on Players, Leaderboard, Stats, and Matches. Existing games and final standings are archived as Season 1; Season 2 starts at 1200 ELO with zero games and wins. New games always belong to the active season, and handicap streaks use that season only. All-time ratings replay the full history without resetting between seasons. Archived matches are read-only.

* **Achievements**: Track goals like "Clutch Master" (win % at match point) and debuff challenges.
* **Head-to-Head**: Deep historic analysis of your performance against every opponent.
* **ELO Timeline**: Interactive charts showing your rise (or fall) through the ranks.

---

## 🛠️ Tech Stack

* **Frontend**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
* **Styling**: [TailwindCSS](https://tailwindcss.com/)
* **Database**: [Supabase](https://supabase.com/) (Real-time DB & Auth)
* **Charts**: [Recharts](https://recharts.org/)
* **Icons**: [Twemoji](https://twemoji.twitter.com/) + [Lucide](https://lucide.dev/)

---

## 🚀 Getting Started

### Prerequisites

* Node.js 20+
* Supabase Account

### Option 1: Local Development

1. **Install Dependencies**

    ```bash
    npm install
    ```

2. **Environment Setup**
    Create a `.env` file:

    ```env
    VITE_SUPABASE_URL=your_project_url
    VITE_SUPABASE_ANON_KEY=your_anon_key
    ```

    For a brand-new Supabase backend, follow [Fresh Supabase Instance Setup](docs/supabase-fresh-instance.md).

    Existing backends must apply `supabase/migrations/20261116104541_pingpong_point_tracking.sql` and `supabase/migrations/20261120180116_pingpong_point_only_tracking.sql` before deploying point-by-point scoring. The save endpoint preserves score, point sequence, ratings and any bet settlement in one transaction; an older backend will refuse the save instead of dropping point history. The second migration converts older outcome-rich point records to point winners only.

    For the independent Suunto 9 Peak Pro scorer and JSON/FIT upload with Player 1–4 profile assignment, see [Suunto Padel Setup](docs/suunto-padel.md).
    Development status and next steps are tracked in [Suunto Integration Handoff](SUUNTO_INTEGRATION_HANDOFF.md).

3. **Run Development Server**

    ```bash
    npm run dev
    ```

### Option 2: Docker (Recommended)

We provide a containerized setup for easy deployment:

```bash
# Build and run with Docker Compose
docker-compose up -d
```

The app will be available at `http://localhost:8080`.

### Install on your phone

Open the deployed HTTPS tracker on your phone:

* **Android:** In Chrome, open the three-dot menu and choose **Install app**. If it appears under **Add to Home screen**, choose **Install** there.
* **iPhone:** In Safari, open **Share**, choose **Add to Home Screen**, enable **Open as Web App** if shown, then tap **Add**.

Launch **Sport Tracker** from its new icon to use it in its own window. Live data and match saves still require an internet connection. If you use admin features, sign in from the installed app.

---

## 📂 Project Structure

* `/src/components`: React UI components grouped by feature (Modals, Tournament, etc.).
* `/src/utils.js`: Core logic for ELO, Ranks, and Match calculations.
* `/src/discordUtils.js`: Logic for Discord Webhook formatting and delivery.
* `/supabase`: Database migrations and configuration.

### October 2026 remediation

See [completion and verification status](docs/code-review-remediation-completion.md) and [migration/deployment steps](docs/remediation-deployment.md). Run npm run test:db with a local Docker engine to execute fresh/upgrade authorization and transaction checks.
