-- Tennis matches table (singles: 1v1)
CREATE TABLE
    IF NOT EXISTS tennis_matches (
        id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
        player1_id UUID REFERENCES users (id) ON DELETE CASCADE,
        player2_id UUID REFERENCES users (id) ON DELETE CASCADE,
        score1 INTEGER NOT NULL DEFAULT 0,
        score2 INTEGER NOT NULL DEFAULT 0,
        match_format VARCHAR(20) DEFAULT 'best_of_3',
        sets_data JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW ()
    );

-- Tennis per-player stats (separate from ping pong stats on users table)
CREATE TABLE
    IF NOT EXISTS tennis_stats (
        id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
        user_id UUID REFERENCES users (id) ON DELETE CASCADE UNIQUE,
        elo_rating INTEGER DEFAULT 1200,
        matches_played INTEGER DEFAULT 0,
        total_wins INTEGER DEFAULT 0,
        total_losses INTEGER DEFAULT 0,
        is_ranked BOOLEAN DEFAULT FALSE
    );

ALTER TABLE tennis_matches ENABLE ROW LEVEL SECURITY;

ALTER TABLE tennis_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for tennis_matches" ON tennis_matches FOR ALL USING (true)
WITH
    CHECK (true);

CREATE POLICY "Allow all for tennis_stats" ON tennis_stats FOR ALL USING (true)
WITH
    CHECK (true);
