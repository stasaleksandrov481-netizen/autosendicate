# Migration v11 → v12

## 1. Database

Run in **Supabase SQL Editor**:

```text
supabase/schema_v12.sql
```

Do not skip this step. v12 routes Chat, Bank, Referrals and legacy PvP through server-only RPC/table access and revokes obsolete browser mutations.

The migration is wrapped in one transaction and records:

```text
server.schema_version = 12
server.sync_mode = vercel_authoritative
```

## 2. Vercel environment

Confirm all variables exist in the deployment environment:

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_BOT_USERNAME
TELEGRAM_WEBHOOK_SECRET
SESSION_SECRET
ADMIN_TELEGRAM_IDS
TELEGRAM_AUTH_MAX_AGE_SECONDS
```

Do not expose server secrets through `NEXT_PUBLIC_*`.

## 3. Redeploy

Deploy the v12 code only after applying `schema_v12.sql`.

## 4. Smoke test in Telegram

Open the Mini App through the bot, not as a plain browser URL, then check:

1. Profile shows `СЕРВЕР ПОДКЛЮЧЕН`.
2. Friends opens without `secure Telegram auth unavailable`.
3. Search/add a second player by `tg_<id>` or `@telegram_username`.
4. Accept the request on the second account.
5. Clan page loads and an accepted friend can be invited.
6. Global chat loads and a message appears after send.
7. Reload the Telegram WebView; Friends/Chat still work from the HttpOnly session.
8. Market loads without requiring browser Supabase realtime auth.
9. Case pending reconciliation completes through the Vercel route.
10. `/api/sync/status` returns `schemaVersion: 12` from an authenticated Mini App session.

## 5. Failure diagnostics

### `unauthorized`
The client now automatically performs one Telegram re-auth and retries the API request. If it still fails, verify that the Mini App was opened through Telegram and that the bot token matches the bot that opened it.

### `server schema < 12`
Apply `supabase/schema_v12.sql` to the same Supabase project referenced by Vercel.

### Chat insert says `authentication required`
The old chat trigger is still installed. Apply `schema_v12.sql`; v12 replaces it with a service-role-aware guard.

### Friends or clans say `profile sync required`
The v12 session validator checks `telegram_principals` against `player_profiles`. Reopen the Mini App so `/api/auth/telegram` can repair the mapping. If the problem persists, verify the v10 and v11 migrations were applied before v12.
