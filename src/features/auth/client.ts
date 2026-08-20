'use client';
import { createBrowserSupabase } from '@/lib/supabase/client';

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } };
    __AUTOSYNDICATE_AUTHENTICATED__?: boolean;
  }
}

export async function bootstrapSecureSession() {
  const initData = window.Telegram?.WebApp?.initData ?? '';
  if (!initData) return false;

  const response = await fetch('/api/auth/telegram', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  });
  const payload = await response.json().catch(() => null) as { tokenHash?: string } | null;
  if (!response.ok || !payload?.tokenHash) return false;

  const supabase = createBrowserSupabase();
  const { error } = await supabase.auth.verifyOtp({ token_hash: payload.tokenHash, type: 'magiclink' });
  if (error) throw error;
  window.__AUTOSYNDICATE_AUTHENTICATED__ = true;
  return true;
}
