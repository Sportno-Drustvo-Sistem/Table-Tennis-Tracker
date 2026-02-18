-- 1. Add trigger_value column for configurable thresholds
alter table public.debuffs 
add column if not exists trigger_value integer null;

-- 2. Insert Hardcoded Rules as Debuffs
-- Mayhem Mode / General Pool
insert into public.debuffs (title, description, severity, trigger_type, is_active)
values 
('Non-Dominant Hand', 'Player must play with their non-dominant hand whenever leading by more than 1 point.', 10, 'mayhem', true),
('3 Serves vs 1', 'Opponent serves 3 times, Player serves 1 time.', 6, 'mayhem', true),
('Alternating Serves', 'Player must alternate between forehand and backhand serves.', 4, 'mayhem', true),
('Backhand Serves Only', 'Player must only serve using backhand.', 5, 'mayhem', true),
('Opponent Headstart', 'Opponent starts the match with a 2-0 lead.', 7, 'mayhem', true),
('No Spin Serves', 'Player cannot use spin on serves.', 3, 'mayhem', true);

-- Streak Rules (Migrating existing logic to DB)
-- "Loss Streak 8+" handled via trigger_type='streak_loss' and trigger_value=8
insert into public.debuffs (title, description, severity, trigger_type, trigger_value, is_active)
values 
('Loss Streak Handicap', 'Receiver serves 3 times, Server serves 1 time.', 5, 'streak_loss', 8, true),
('Alternating Serves', 'Server must alternate between forehand and backhand serves.', 4, 'streak_loss', 8, true),
('Mandatory Backhand Serve', 'Server must only serve using backhand.', 5, 'streak_loss', 8, true),
('Point Headstart', 'Opponent starts the match with a 2-0 lead.', 6, 'streak_loss', 8, true),
('No Spin Serves', 'Server cannot use spin on serves.', 3, 'streak_loss', 8, true);

-- "Loss Streak 16+" (Critical)
insert into public.debuffs (title, description, severity, trigger_type, trigger_value, is_active)
values 
('Unstoppable Force Handicap', 'Since winner has won 16+ games in a row, they must play with their NON-DOMINANT hand whenever leading by more than 1 point!', 10, 'streak_loss', 16, true);
