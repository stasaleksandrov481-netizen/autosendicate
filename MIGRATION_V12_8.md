# v12.8 migration

## Existing v12.x database

Run only:

```text
supabase/schema_v12_8_FIX.sql
```

It repairs untouched starter profiles, disables non-WebP cars, restores referrals, fixes bank transfer UIDs/claim timestamps and updates the server patch marker to 12.8.

## Fresh database

Run:

```text
supabase/schema_v12_8_FULL.sql
```

The consolidated installer is wrapped in one transaction.

## Telegram group duels

Run `npm run telegram:setup` once after deployment or open the Mini App with a valid Telegram account so the server can self-check the webhook. Plain reply words require BotFather Privacy Mode = Disable. `/duel` reply works as the fallback when Privacy Mode is enabled.
