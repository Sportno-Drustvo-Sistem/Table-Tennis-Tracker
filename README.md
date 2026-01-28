# 🏓 Ping Pong Tracker

A modern, web-based tracker for ping pong matches. Keep track of scores, view leaderboards, and analyze player statistics to see who truly rules the table.

## Features

### 🏆 Leaderboard
*   **Rankings**: Automatically ranked by Wins, Losses, Win %, and Score Difference.
*   **Sorting**: Click any column header to sort the leaderboard by that metric.
*   **Date Filtering**: Filter the leaderboard to see who was the best in a specific month or year.

### 📊 Player Stats
*   **Deep Dive**: Select any player to view their detailed performance metrics.
*   **Head-to-Head**: See your win/loss record against every opponent.
*   **Timeline**: View a history of recent matches with win/loss indicators.
*   **Date Filtering**: Analyze performance over specific time periods.

### ⚔️ Match Tracking
*   **Quick Entry**: Select two players and logging a match takes seconds.
*   **Avatar Support**: Upload profile pictures for players.
*   **Match History**: View and edit/delete past match records.

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
The app uses two main tables in Supabase:
*   `users`: Stores player info (id, name, avatar_url, total_wins).
*   `matches`: Stores match records (id, player1_id, player2_id, score1, score2, created_at).
