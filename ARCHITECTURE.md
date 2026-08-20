# Architecture — v10

## Request flow

```text
Telegram Mini App
    |
    | initData
    v
POST /api/auth/telegram
    |
    +-- HMAC validation with TELEGRAM_BOT_TOKEN
    +-- auth_date freshness check
    +-- Telegram user -> stable playerId (tg_<id>)
    +-- Telegram principal -> stable Supabase auth.users.id
    +-- signed HttpOnly game session
    +-- one-time Supabase magic-link token hash
    |
    v
Browser Supabase session
    |
    +-- RLS for realtime/read access
    |
    v
Next.js API routes
    |
    +-- signed session validation
    +-- same-origin check on mutations
    +-- Zod validation
    +-- DB-backed rate limit
    |
    v
server-only feature modules
    |
    v
Supabase service-role RPC / RLS
```

## Domain boundaries

### `features/race`
Owns gear limits, RPM/shift rules, race payload schema and server result submission. Server recording is idempotent by `raceId` UUID.

### `features/cases`
Owns case roll/claim input validation and server RPC calls. The browser does not choose the winning prize.

### `features/market`
Owns market queries and typed lot boundaries. Existing v9 transactional market RPC remains in Supabase during the migration.

### `features/profile`
Only presentation fields are accepted from the client. Economy/progression/rating columns are protected again in PostgreSQL by `autosyndicate_profile_guard()`.

### `features/social` and `features/clans`
Friends and clans are isolated from UI code. Mutations go through server-only v10 wrapper RPCs.

### `lib/security`
Owns the signed HttpOnly session, Origin enforcement and durable database rate limiting. No in-memory serverless rate-limit map is used.

### `lib/supabase`
Separate browser publishable-key client and server service-role client. Server secrets are guarded with `server-only` imports.

## Compatibility layer

`src/legacy/runtime.ts` currently contains the mature v9 browser gameplay/UI runtime so the TypeScript/Vercel migration does not regress the game. It is deliberately isolated and marked `@ts-nocheck`.

New security-sensitive code must **not** be added there. The next cleanup phase can move race rendering, garage/tuning, casino visual state and screen controllers into typed React/domain modules one subsystem at a time.

This is preferable to rewriting 3,000+ lines of gameplay in one shot and quietly reintroducing physics/economy bugs.
