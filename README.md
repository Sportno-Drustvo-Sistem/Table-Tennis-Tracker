# 🏓 Ping Pong & Padel Tracker

A modern, high-performance web application for tracking sports leagues, tournaments, and player statistics. Designed for local clubs, office leagues, or competitive circles to professionalize their matches.

![App Screenshot](https://raw.githubusercontent.com/lucide-react/lucide/main/icons/trophy.png)

## 🌟 Key Features

### 🎙️ Live Umpire & Voice (New!)

* **Point-by-Point Scoring**: Real-time match tracking with a dedicated umpire interface.
* **Serve Indicator**: Automatic calculation of whose serve it is, including ELO-based initial serve determination.
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

- Node.js 20+
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

---

## 📂 Project Structure

- `/src/components`: React UI components grouped by feature (Modals, Tournament, etc.).
* `/src/utils.js`: Core logic for ELO, Ranks, and Match calculations.
* `/src/discordUtils.js`: Logic for Discord Webhook formatting and delivery.
* `/supabase`: Database migrations and configuration.

---

## 🤝 Contributing

Contributions are welcome! Please ensure you follow the clean code principles (SOLID, DRY) and document new features in the code comments.

---
*Created with ❤️ for the competitive spirit.*
