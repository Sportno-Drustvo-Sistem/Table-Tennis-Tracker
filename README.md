# 🏓 Ping Pong & Padel Tracker

A modern, web-based tracker for your local sports club or office league. Initially built for ping pong, now expanded to support Padel doubles! Keep track of scores, run tournaments, view leaderboards, and analyze player statistics to see who truly rules the court.

## Features

### 🏆 Tournaments (New!)
*   **Bracket Generator**: Create Single or Double Elimination brackets for 4-16 players.
*   **Seeding**: Optional Swiss stage (coming soon) or random seeding.
*   **Trophy Case**: Tournament results are permanently saved. Winners get virtual trophies displayed on their profile.
*   **Integrated Stats**: Tournament matches count towards your global ELO and win/loss records.

### 🎾 Padel Support
*   **Doubles Tracking**: Record matches for 2v2 Padel games.
*   **Separate Stats**: Padel ELO and stats are tracked separately from Ping Pong.
*   **Team Analysis**: See which partnerships work best.

### 🏅 Leaderboard
*   **Rankings**: Automatically ranked by Wins, Losses, Win %, and Score Difference.
*   **Streaks**: See who is currently on a hot winning streak or a cold losing streak.
*   **Sorting**: Click any column header to sort the leaderboard by that metric.
*   **Date Filtering**: Filter the leaderboard to see who was the best in a specific month or year.

### 📊 Player Stats
*   **Deep Dive**: Select any player to view their detailed performance metrics.
*   **Trophy Case**: View a collection of badges and medals from tournament performances.
*   **Head-to-Head**: See your win/loss record against every opponent.
*   **Timeline**: View a history of recent matches with win/loss indicators.

### ⚔️ Match Tracking
*   **Quick Entry**: Select players/teams and log a match in seconds.
*   **Handicap System**: Automatic handicap suggestions if a player is on a massive winning streak against another.
*   **Avatar Support**: Upload profile pictures for players.

### 🌗 Dark Mode
*   **Theme Toggle**: Switch between Light and Dark mode to suit your environment.

## Tech Stack
*   **Frontend**: React + Vite
*   **Styling**: TailwindCSS + Vanilla CSS
*   **Icons**: Lucide React
*   **Backend**: Supabase (Database & Storage)

## Setup & Running

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Setup**
    Create a `.env` file in the root directory and add your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your_project_url
    VITE_SUPABASE_ANON_KEY=your_anon_key
    ```

3.  **Run Locally**
    ```bash
    npm run dev
    ```

## Database Schema
The app uses Supabase for data persistence. Key tables:

*   `users`: Player info (id, name, avatar_url, stats).
*   `matches`: Ping pong match records.
*   `padel_matches`: Padel match records.
*   `tournaments`: Tournament metadata (name, status, format).
*   `tournament_results`: Player placements in tournaments.
