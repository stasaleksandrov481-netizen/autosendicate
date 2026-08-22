-- AutoSyndicate v14: open / invite-only clans.
-- Safe to run repeatedly.
begin;

alter table if exists public.clans
  add column if not exists is_open boolean not null default false;

alter table if exists public.player_profiles
  add column if not exists wanted_level smallint not null default 0
  check (wanted_level between 0 and 5);

create index if not exists clans_is_open_created_at_idx
  on public.clans (is_open, created_at desc);

commit;
