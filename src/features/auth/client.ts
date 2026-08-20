'use client';

import { createBrowserSupabase } from '@/lib/supabase/client';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: { start_param?: string; user?: { id?: number; first_name?: string; username?: string; photo_url?: string } };
        ready?: () => void;
        expand?: () => void;
      };
    };
    __AUTOSYNDICATE_AUTHENTICATED__?: boolean;
    __AUTOSYNDICATE_SERVER_SESSION__?: {
      playerId: string;
      username: string | null;
      name: string;
      telegramId?: number;
    } | null;
    __AUTOSYNDICATE_SUPABASE_SESSION__?: boolean;
    __AUTOSYNDICATE_REAUTH__?: () => Promise<boolean>;
  }
}

type SessionPayload = {
  authenticated?: boolean;
  session?: { playerId: string; username: string | null; name: string; telegramId?: number } | null;
};

type TelegramAuthPayload = {
  ok?: boolean;
  playerId?: string;
  tokenHash?: string;
  user?: { name?: string; username?: string | null };
  error?: string;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function timedFetch(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: init.signal ?? controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function waitForTelegramInitData(timeoutMs = 2600) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const webApp = window.Telegram?.WebApp;
    try {
      webApp?.ready?.();
      webApp?.expand?.();
    } catch {
      // Telegram SDK can briefly throw while WebView is still attaching.
    }
    const value = webApp?.initData;
    if (typeof value === 'string' && value.length > 0) return value;
    await delay(80);
  }
  return '';
}

async function readServerSession(): Promise<SessionPayload['session']> {
  try {
    const response = await timedFetch('/api/session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store'
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as SessionPayload | null;
    return payload?.authenticated && payload.session ? payload.session : null;
  } catch {
    return null;
  }
}

async function establishBrowserSupabaseSession(tokenHash: string) {
  try {
    const supabase = createBrowserSupabase();
    const current = await supabase.auth.getSession();
    if (current.data.session?.user) {
      window.__AUTOSYNDICATE_SUPABASE_SESSION__ = true;
      return true;
    }
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
    if (error) throw error;
    window.__AUTOSYNDICATE_SUPABASE_SESSION__ = true;
    return true;
  } catch (error) {
    // Server-authenticated APIs do not depend on this session. Realtime may fall back to polling.
    window.__AUTOSYNDICATE_SUPABASE_SESSION__ = false;
    console.warn('Optional browser Supabase session unavailable', error);
    return false;
  }
}

export async function bootstrapSecureSession() {
  // Expose one recovery entry point for the legacy runtime. A 401 from any Vercel API can
  // refresh the Telegram-backed HttpOnly session and retry once without reloading the Mini App.
  window.__AUTOSYNDICATE_REAUTH__ = bootstrapSecureSession;
  window.__AUTOSYNDICATE_AUTHENTICATED__ = false;
  window.__AUTOSYNDICATE_SERVER_SESSION__ = null;
  window.__AUTOSYNDICATE_SUPABASE_SESSION__ = false;

  // A valid HttpOnly cookie survives Telegram WebView reloads. Use it immediately instead of
  // requiring a fresh client-side Supabase magic-link exchange on every screen open.
  const existing = await readServerSession();
  if (existing) {
    window.__AUTOSYNDICATE_SERVER_SESSION__ = existing;
    window.__AUTOSYNDICATE_AUTHENTICATED__ = true;
  }

  const initData = await waitForTelegramInitData();
  if (!initData) return Boolean(existing);

  const response = await timedFetch('/api/auth/telegram', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  });
  const payload = (await response.json().catch(() => null)) as TelegramAuthPayload | null;
  if (!response.ok) {
    if (payload?.error === 'player banned') throw new Error('PLAYER_BANNED');
    // If a still-valid server cookie already exists, keep the game online instead of falsely
    // dropping all social/server features because Telegram initData refresh was unavailable.
    if (existing) return true;
    throw new Error(payload?.error || `telegram auth rejected (${response.status})`);
  }

  const refreshed = await readServerSession();
  if (!refreshed) throw new Error('SERVER_SESSION_MISSING');
  window.__AUTOSYNDICATE_SERVER_SESSION__ = refreshed;
  window.__AUTOSYNDICATE_AUTHENTICATED__ = true;

  if (payload?.tokenHash) await establishBrowserSupabaseSession(payload.tokenHash);
  return true;
}
