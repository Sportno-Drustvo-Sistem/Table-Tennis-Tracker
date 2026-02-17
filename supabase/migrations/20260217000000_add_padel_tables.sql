-- Padel matches table (doubles: 2v2)
CREATE TABLE
    IF NOT EXISTS padel_matches (
        id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
        team1_player1_id UUID REFERENCES users (id) ON DELETE CASCADE,
        team1_player2_id UUID REFERENCES users (id) ON DELETE CASCADE,
        team2_player1_id UUID REFERENCES users (id) ON DELETE CASCADE,
        team2_player2_id UUID REFERENCES users (id) ON DELETE CASCADE,
        score1 INTEGER NOT NULL DEFAULT 0,
        score2 INTEGER NOT NULL DEFAULT 0,
        handicap_rule JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW ()
    );

-- Padel per-player stats (separate from ping pong stats on users table)
CREATE TABLE
    IF NOT EXISTS padel_stats (
        id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
        user_id UUID REFERENCES users (id) ON DELETE CASCADE UNIQUE,
        elo_rating INTEGER DEFAULT 1200,
        matches_played INTEGER DEFAULT 0,
        total_wins INTEGER DEFAULT 0,
        is_ranked BOOLEAN DEFAULT FALSE
    );

-- Enable RLS
ALTER TABLE padel_matches ENABLE ROW LEVEL SECURITY;

ALTER TABLE padel_stats ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon (same policy as existing tables)
CREATE POLICY "Allow all for padel_matches" ON padel_matches FOR ALL USING (true)
WITH
    CHECK (true);

CREATE POLICY "Allow all for padel_stats" ON padel_stats FOR ALL USING (true)
WITH
    CHECK (true);