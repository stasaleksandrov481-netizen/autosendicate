-- AutoSyndicate V17: open "Lobby" challenges in Telegram inline mode.
-- Run once in Supabase SQL Editor before deploying V17.
--
-- An open challenge has no fixed opponent: any group member may tap
-- "Принять вызов" and whoever's callback lands first in Postgres wins the
-- race. We enforce that atomically with a partial unique index keyed on the
-- Telegram inline_message_id — the first INSERT for a given inline message
-- succeeds, every later one violates the unique index and is rejected.

alter table if exists public.duel_rooms_v11
  add column if not exists is_open boolean not null default false,
  add column if not exists inline_message_id text;

create unique index if not exists duel_rooms_v11_open_claim_uidx
  on public.duel_rooms_v11 (inline_message_id)
  where is_open = true and inline_message_id is not null;

comment on column public.duel_rooms_v11.is_open is 'true for lobby/open challenges claimable by any group member (first click wins)';
comment on column public.duel_rooms_v11.inline_message_id is 'Telegram inline_message_id of the posted open-challenge card; used as the atomic claim key';
