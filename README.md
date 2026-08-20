# AutoSyndicate Carbon v12

AutoSyndicate Carbon v12 is a Telegram Mini App built for Vercel on Next.js App Router + TypeScript. v12 focuses on reliable server synchronization: Telegram identity, friends, clans, chat, market, cases, referrals, bank operations and legacy PvP now use the same Vercel/HttpOnly-session boundary instead of depending on a browser Supabase session.

## v12 synchronization fixes

- Server Telegram session is the authoritative online identity.
- Browser Supabase Auth is optional and used only as a realtime accelerator where available.
- A valid HttpOnly session survives Telegram WebView reloads.
- Any Vercel API `401` triggers a one-shot Telegram re-auth and retries the original request automatically.
- `requireSession()` verifies the signed cookie against both `player_profiles` and `telegram_principals`; stale bindings self-repair through re-auth instead of leaving the UI half-online.
- Friends and clans no longer require a separate client Supabase session.
- Chat reads/writes are routed through `/api/social/chat`; direct browser table writes are removed.
- Market reads and mutations use `/api/market`; realtime is optional.
- Case reconciliation uses `/api/cases/pending`.
- Referral operations use `/api/referrals`.
- Bank transfers and claims use `/api/bank`.
- Legacy async PvP transitions use `/api/pvp`.
- Background claims no longer stop when the optional browser Supabase client is unavailable.
- Profile screen includes a server-sync indicator and a retry action.
- `/api/sync/status` reports the deployed synchronization schema version.
- Friends now receive server-enriched profile/presence data.
- Chat messages are resolved to stable `player_id` values rather than identifying the sender by display name.
- Server calls have a client-side timeout so a broken connection does not leave the Telegram UI loading forever.

## v11 systems retained

- Redesigned Street Network duel list.
- 40 server-managed AI opponents.
- Server-managed car catalog.
- `/admin` Control Center with statistics, moderation, balance/car/content controls and audit log.
- Telegram Bot API webhook with secret-token verification and update idempotency.
- `/start`, `/help`, protected `/admin`, and DB-configurable custom commands.
- Chat reply duel flow with Accept/Decline inline buttons.
- Private two-player Mini App duel rooms with membership checks, vehicle selection, ready-check and synchronized `start_at`.

## Stack

- Next.js 16.3.1 App Router
- TypeScript strict mode
- React 19.2.8
- Supabase Auth + PostgreSQL/RLS/RPC
- Telegram Mini Apps + Telegram Bot API webhooks
- Vercel Node.js Functions

## Database migrations

For a fresh database apply in this order:

1. `supabase/schema_v8.sql`
2. `supabase/schema_v9.sql`
3. `supabase/schema_v10.sql`
4. `supabase/schema_v11.sql`
5. `supabase/schema_v12.sql`

If v11 is already deployed, run only `supabase/schema_v12.sql`.

**v12 SQL is required for the new server chat/bank/PvP/referral bridges.** If the code is deployed without the migration, `/api/sync/status` reports an old schema and the profile synchronization card will tell you that v12 migration is required.

See `MIGRATION_V12.md`.

## Environment

Public values may be present in `.env`:

```dotenv
NEXT_PUBLIC_APP_NAME=AutoSyndicate Carbon
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Server secrets belong in Vercel Environment Variables and in local `.env.local` only:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN=123456:BOT_TOKEN
TELEGRAM_BOT_USERNAME=YourBotUsername
TELEGRAM_WEBHOOK_SECRET=generate_a_long_random_secret
SESSION_SECRET=generate_at_least_32_random_characters
ADMIN_TELEGRAM_IDS=123456789,987654321
TELEGRAM_AUTH_MAX_AGE_SECONDS=3600
```

Never put a bot token, service-role key or session secret into `NEXT_PUBLIC_*`.

## Local setup

```bash
cp .env.local.example .env.local
npm install
npm run check:env
npm run typecheck
npm run build
npm run dev
```

`npm run check:env` expects the required variables to be present in the process environment. On Vercel, configure them in Project → Settings → Environment Variables.

## Vercel deployment

1. Apply all required SQL migrations.
2. Configure Production/Preview/Development environment variables in Vercel.
3. Deploy the Next.js project.
4. Open the Mini App from the configured Telegram bot and verify the profile card shows `СЕРВЕР ПОДКЛЮЧЕН`.
5. Open Friends, Clans and Chat. They should work even if the optional browser Supabase realtime session cannot be created.
6. Configure the Telegram webhook from the protected admin flow. See `BOT_SETUP.md`.

## Server synchronization model

```text
Telegram WebApp initData
        ↓ HMAC verification on Vercel
stable tg_<telegram_id> player
        ↓
telegram_principals + player_profiles
        ↓
signed HttpOnly session cookie
        ↓
Next.js /api/* routes
        ↓
service-role queries / server-only RPC bridges
        ↓
Supabase PostgreSQL
```

The browser never chooses another player's server identity. Sensitive API routes derive `playerId` from the verified session cookie.

Browser Supabase Auth may still be created to accelerate realtime UI. Its failure does not invalidate the server session and does not disable Friends, Clans, Chat, Market, Cases, Referrals or Bank APIs.

## Important remaining security debt

The v12 synchronization layer is substantially safer, but the old compatibility runtime still keeps parts of the SYND wallet/inventory/game progression in `localStorage`. Do not treat the current economy as tamper-proof for valuable competitive rewards. The next architectural step is a server-authoritative wallet/inventory/vehicle ledger and server-calculated rewards. See `SECURITY.md`.
