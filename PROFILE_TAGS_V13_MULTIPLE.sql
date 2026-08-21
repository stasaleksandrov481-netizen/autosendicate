-- AutoSyndicate v13 multiple configurable profile tags
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS profile_tags jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.player_profiles
SET profile_tags = jsonb_build_array(profile_tag)
WHERE profile_tag IS NOT NULL AND (profile_tags = '[]'::jsonb OR profile_tags IS NULL);

CREATE TABLE IF NOT EXISTS public.profile_tag_catalog (
 key text PRIMARY KEY,
 label text NOT NULL,
 emoji text DEFAULT '',
 background text NOT NULL,
 foreground text NOT NULL,
 border_color text DEFAULT NULL,
 glow boolean DEFAULT false,
 created_at timestamptz DEFAULT now()
);

INSERT INTO public.profile_tag_catalog(key,label,emoji,background,foreground,glow) VALUES
('developer','Разработчик','⚙','linear-gradient(135deg,#7f1d1d,#ec4899)','#fff',true),
('project_team','Команда проекта','✦','#3730a3','#fff',true),
('tester','Тестировщик','🐞','#16a34a','#07130a',false),
('player','Игрок','●','#4b5563','#fff',false)
ON CONFLICT (key) DO NOTHING;
