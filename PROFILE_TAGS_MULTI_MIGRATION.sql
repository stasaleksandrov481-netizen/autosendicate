-- AutoSyndicate Carbon: multi-tag community roles
-- Run once in Supabase SQL Editor, AFTER PROFILE_TAGS_MIGRATION.sql.
-- Adds an array column so a player can hold several badges at once
-- (e.g. "Команда проекта" + "Разработчик"), while keeping the old
-- single-tag column untouched for backward compatibility.

ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS profile_tags jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.player_profiles.profile_tags IS
  'Array of community role/tag badges shown next to the player name across profile, chat, leaderboard, clans and admin. Each item: {key,label,icon,background,foreground,glow}';

-- Backfill: anyone who already had a single legacy tag gets it carried over as the
-- first entry in the new array (only where profile_tags is still empty).
UPDATE public.player_profiles
SET profile_tags = jsonb_build_array(
  jsonb_build_object(
    'key', COALESCE(profile_tag->>'key', 'legacy_tag'),
    'label', profile_tag->>'label',
    'icon', 'star',
    'background', profile_tag->>'background',
    'foreground', profile_tag->>'foreground',
    'glow', false
  )
)
WHERE profile_tag IS NOT NULL
  AND (profile_tags IS NULL OR profile_tags = '[]'::jsonb);

-- Postgres CHECK constraints cannot contain a subquery (EXISTS/SELECT), so the
-- per-element validation lives in its own IMMUTABLE function instead.
CREATE OR REPLACE FUNCTION public.player_profiles_tags_valid(tags jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t jsonb;
BEGIN
  IF jsonb_typeof(tags) IS DISTINCT FROM 'array' THEN
    RETURN false;
  END IF;
  IF jsonb_array_length(tags) > 6 THEN
    RETURN false;
  END IF;
  FOR t IN SELECT * FROM jsonb_array_elements(tags) LOOP
    IF jsonb_typeof(t) <> 'object'
      OR jsonb_typeof(t->'key') <> 'string'
      OR jsonb_typeof(t->'label') <> 'string'
      OR jsonb_typeof(t->'icon') <> 'string'
      OR jsonb_typeof(t->'background') <> 'string'
      OR jsonb_typeof(t->'foreground') <> 'string'
      OR length(t->>'label') NOT BETWEEN 1 AND 40
      OR (t->>'background') !~ '^#[0-9A-Fa-f]{6}$'
      OR (t->>'foreground') !~ '^#[0-9A-Fa-f]{6}$'
    THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

ALTER TABLE public.player_profiles
  DROP CONSTRAINT IF EXISTS player_profiles_profile_tags_shape_check;

ALTER TABLE public.player_profiles
  ADD CONSTRAINT player_profiles_profile_tags_shape_check
  CHECK (public.player_profiles_tags_valid(profile_tags));

CREATE INDEX IF NOT EXISTS player_profiles_profile_tags_gin
  ON public.player_profiles USING gin (profile_tags);
