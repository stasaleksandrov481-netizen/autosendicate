# AutoSyndicate Carbon v12.8 FINAL

## Existing database
Run `supabase/schema_v12_8_FIX.sql` once, then redeploy Vercel.

## Fresh database
Run `supabase/schema_v12_8_FULL.sql`.

## Telegram group duels
- Reply to another user's message with: `дуэль`, `дуель`, `поединок`, `гонка`, or `заезд`.
- `/duel` as a reply is the Privacy Mode-compatible fallback.
- To make plain words work in groups, disable bot Privacy Mode in BotFather (`/setprivacy`) and re-add the bot to the group if needed.

## Vercel
Use `.env.example` / `.env.local.example` as the variable-name reference. Do not commit real secrets.
