# Security model — v10

## Implemented

### Telegram identity is server verified
The server validates Telegram Mini App `initData` using HMAC-SHA256, checks `auth_date`, uses constant-time hash comparison and derives `playerId` only from the verified Telegram user ID.

### Stable Supabase principal
A verified Telegram account is mapped to a stable `auth.users.id`. The browser receives only a one-time Supabase token hash and never receives the service-role key or bot token.

### Secret separation
These values are server-only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `SESSION_SECRET`

Only the Supabase URL and publishable key use `NEXT_PUBLIC_`.

### HttpOnly session
Vercel API authorization uses a signed, expiring `HttpOnly` cookie with `SameSite=Lax` and `Secure` in production.

### CSRF/origin boundary
Mutating API requests verify the request Origin against the deployment host. Session cookies are not treated as sufficient authorization by themselves.

### Durable rate limiting
Rate limits are atomic counters in Postgres (`api_rate_limits_v10`), not a process-local JavaScript `Map`. This remains effective when Vercel creates multiple function instances.

### RLS + server-only RPC wrappers
v10 wrapper functions are revoked from `public`, `anon` and `authenticated` and granted only to `service_role`.

### Profile stat tampering blocked
Browser-owned profile updates cannot alter:

- balance
- XP / level
- races / wins / losses
- total earned
- owned cars
- rating
- best 0–100
- Telegram username

`autosyndicate_profile_guard()` restores authoritative values from `OLD` for non-privileged updates. Race statistics are updated by a dedicated server RPC.

### Idempotent race submissions
Race rows are keyed by client-generated UUID. Re-sending the same race cannot create a second result row.

### Case result authority
v10 case routes call server-only wrappers around the existing server roll/claim RPC. Client visuals display the result; they do not select it.

## Remaining security debt

v10 intentionally preserves the mature v9 browser gameplay as a compatibility layer. Therefore some old economy/inventory state still exists in `localStorage`. A user controlling DevTools can still tamper with **local-only** wallet/inventory flows that have not yet been migrated to the server ledger.

For a production real-money/valuable-economy launch, the next mandatory hardening is:

1. server-authoritative SYND ledger;
2. server-owned vehicle instances and tuning inventory;
3. server-side casino debits/payouts;
4. market settlement only against the server wallet;
5. race reward calculation entirely server-side;
6. removal of legacy direct Supabase mutation paths after old clients are retired.

### CSP compatibility debt
The existing v9 UI uses inline HTML event handlers. The CSP therefore still permits `'unsafe-inline'` for scripts/styles while framing is restricted to Telegram domains. Once legacy handlers are moved to React event handlers, remove `'unsafe-inline'` and switch to a nonce/hash-based CSP.

## Operational rules

- Never commit `.env.local`.
- Rotate any secret that has ever appeared in a public repository/client bundle.
- Use separate Supabase/Vercel projects or secret scopes for Preview and Production where practical.
- Do not log Telegram `initData`, service-role keys, bot tokens, magic-link token hashes or session cookies.
- Keep Supabase RLS enabled on all browser-visible tables.
