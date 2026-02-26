-- Add columns for detailed Padel scoring

ALTER TABLE padel_matches
ADD COLUMN match_format VARCHAR(20) DEFAULT 'best_of_3',
ADD COLUMN sets_data JSONB DEFAULT '[]'::jsonb;

-- sets_data will be an array of objects:
-- [ { "team1Games": 6, "team2Games": 4, "team1Tiebreak": null, "team2Tiebreak": null }, ... ]
