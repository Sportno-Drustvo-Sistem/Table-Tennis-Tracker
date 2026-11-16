-- Seed only the upgrade database BEFORE the season migration. Its archive must
-- remain byte-for-byte unchanged through remediation and rating rebuilds.
INSERT INTO public.users(id,name,elo_rating,total_wins,matches_played,is_ranked) VALUES
('10000000-0000-0000-0000-000000000001','Archived A',1300,1,1,false),
('10000000-0000-0000-0000-000000000002','Archived B',1100,0,1,false);
INSERT INTO public.matches(player1_id,player2_id,score1,score2) VALUES
('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',11,5);
