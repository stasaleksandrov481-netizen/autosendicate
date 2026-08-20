# AutoSyndicate Carbon v10

AutoSyndicate Carbon переведён на стек **Next.js App Router + TypeScript + Supabase + Vercel**.

v10 — миграционный релиз: серверная архитектура и критичные online-системы уже разнесены по TypeScript-модулям, а существующий игровой UI подключён через `src/legacy/runtime.ts`, чтобы перенос не уничтожил рабочую гонку, кейсы, рынок и экраны v9. Compatibility-layer помечен `@ts-nocheck`; новый код работает в strict TypeScript.

## Стек

- Next.js 16 / App Router
- React 19
- TypeScript strict
- Supabase Auth + Postgres + RLS/RPC
- Telegram Mini App `initData` authentication
- Vercel Node.js Functions
- Zod request/environment validation

## Структура

```text
src/
  app/
    api/                 # HTTP boundary: auth, race, cases, market, profile, social
  components/            # React entry components
  features/
    auth/                 # stable Telegram -> Supabase principal
    race/                 # typed physics + server race validation
    cases/                # case roll/claim boundary
    economy/              # economy types
    market/               # market server access
    profile/              # safe profile updates
    social/               # friends
    clans/                # clans
    ui/                   # loading/runtime UI helpers
  lib/
    security/             # HttpOnly session, origin checks, rate limits
    supabase/             # browser/server clients
    telegram/             # Telegram initData HMAC verification
  legacy/                 # temporary v9 UI compatibility layer
supabase/
  schema_v8.sql
  schema_v9.sql
  schema_v10.sql          # v10 server bridge + hardening
```

## Локальный запуск

1. Установить Node.js 20.9+.
2. Установить зависимости:

```bash
npm install
```

3. Создать локальный файл секретов:

```bash
cp .env.local.example .env.local
```

4. Заполнить `.env.local` реальными значениями.
5. Проверить окружение:

```bash
npm run check:env
```

6. Если v8/v9 ещё не применялись, выполнить их по порядку в Supabase SQL Editor. Затем выполнить:

```text
supabase/schema_v10.sql
```

7. Запустить:

```bash
npm run dev
```

## Vercel

В Vercel Project Settings -> Environment Variables задать для Production/Preview/Development:

```text
NEXT_PUBLIC_APP_NAME
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN
SESSION_SECRET
TELEGRAM_AUTH_MAX_AGE_SECONDS
```

`SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN` и `SESSION_SECRET` должны быть **server-only**. Никогда не добавлять им префикс `NEXT_PUBLIC_`.

Через Vercel CLI можно использовать:

```bash
vercel link
vercel env add SUPABASE_SERVICE_ROLE_KEY --sensitive
vercel env add TELEGRAM_BOT_TOKEN --sensitive
vercel env add SESSION_SECRET --sensitive
vercel env pull .env.local --yes
```

Перед deploy:

```bash
npm run check:env
npm run typecheck
npm run lint
npm run build
```

Deploy:

```bash
vercel --prod
```

## Telegram Bot

Production-запуск ожидает настоящий `Telegram.WebApp.initData`. Vercel API проверяет подпись initData через `TELEGRAM_BOT_TOKEN`; простой `playerId` из браузера больше не считается доказательством личности.

В BotFather/Web App настройках укажи production URL Vercel/собственного домена.

## Supabase Auth

Для v10 рекомендуется отключить Anonymous Sign-Ins. Сервер после Telegram-проверки создаёт/находит стабильный Supabase principal и выдаёт одноразовый token hash для `verifyOtp`, чтобы существующие RLS-политики работали с постоянным `auth.uid()` на разных устройствах.

Email provider должен оставаться доступным для server-side `generateLink`; реальная отправка письма пользователю не используется.

## ENV

- `.env` содержит только публичную конфигурацию и может храниться в Git.
- `.env.local` содержит секреты и находится в `.gitignore`.
- `.env.example` — полный шаблон без секретов.
- На Vercel реальные секреты хранятся в Environment Variables, а не в репозитории.

Подробнее: `ARCHITECTURE.md`, `SECURITY.md`, `MIGRATION_V10.md`.
