-- AutoSyndicate V16: live private-duel progress.
-- Run once in Supabase SQL Editor before deploying V16.

alter table if exists public.duel_rooms_v11
  add column if not exists player_a_progress jsonb,
  add column if not exists player_b_progress jsonb;

comment on column public.duel_rooms_v11.player_a_progress is 'Latest live progress sample for player A: distance/speed/elapsedMs/updatedAt';
comment on column public.duel_rooms_v11.player_b_progress is 'Latest live progress sample for player B: distance/speed/elapsedMs/updatedAt';
