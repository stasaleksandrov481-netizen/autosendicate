-- AutoSyndicate V17 · persistent layered car visuals
-- Safe additive migration. Existing players receive an empty map and the client derives defaults per model.

alter table if exists public.player_profiles
  add column if not exists car_visuals jsonb not null default '{}'::jsonb;

-- Reject obviously malformed/bloated maps at the DB boundary while keeping the JSON structure extensible.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='player_profiles_car_visuals_object_v17'
  ) then
    alter table public.player_profiles
      add constraint player_profiles_car_visuals_object_v17
      check (jsonb_typeof(car_visuals)='object');
  end if;
end $$;

comment on column public.player_profiles.car_visuals is
  'V17 layered visual configs keyed by numeric car id: paint, tint, wheels, aero and <=60 decals.';
