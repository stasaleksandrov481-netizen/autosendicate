-- AutoSyndicate Carbon: profile tags / community roles
-- Run once in Supabase SQL Editor. Existing profiles remain untagged.
ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS profile_tag jsonb;

COMMENT ON COLUMN public.player_profiles.profile_tag IS 'Community role/tag shown next to player names across profile, chat, leaderboard and social lists. Shape: {key,label,emoji,background,foreground}';

ALTER TABLE public.player_profiles
  DROP CONSTRAINT IF EXISTS player_profiles_profile_tag_shape_check;

ALTER TABLE public.player_profiles
  ADD CONSTRAINT player_profiles_profile_tag_shape_check CHECK (
    profile_tag IS NULL OR (
      jsonb_typeof(profile_tag) = 'object'
      AND jsonb_typeof(profile_tag->'key') = 'string'
      AND jsonb_typeof(profile_tag->'label') = 'string'
      AND jsonb_typeof(profile_tag->'emoji') = 'string'
      AND jsonb_typeof(profile_tag->'background') = 'string'
      AND jsonb_typeof(profile_tag->'foreground') = 'string'
      AND length(profile_tag->>'label') BETWEEN 1 AND 40
      AND (profile_tag->>'background') ~ '^#[0-9A-Fa-f]{6}$'
      AND (profile_tag->>'foreground') ~ '^#[0-9A-Fa-f]{6}$'
    )
  );

