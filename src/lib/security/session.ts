import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getServerEnv } from '@/lib/env';
import { createServerSupabase } from '@/lib/supabase/server';

export const SESSION_COOKIE = 'autosyndicate_session';
const sessionSchema = z.object({
  playerId: z.string().regex(/^tg_[0-9]{1,24}$/),
  telegramId: z.number().int().positive(),
  username: z.string().max(64).nullable(),
  name: z.string().min(1).max(64),
  exp: z.number().int().positive()
});
export type GameSession = z.infer<typeof sessionSchema>;

function signPayload(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function encodeSession(session: GameSession) {
  const secret = getServerEnv().SESSION_SECRET;
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${signPayload(payload, secret)}`;
}

export function decodeSession(value: string | undefined | null): GameSession | null {
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;
  const expected = signPayload(payload, getServerEnv().SESSION_SECRET);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = sessionSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    return parsed.exp > Math.floor(Date.now() / 1000) ? parsed : null;
  } catch { return null; }
}

export async function getSession() {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error('UNAUTHORIZED');
  const supabase = createServerSupabase();
  const [{ data: profile, error: profileError }, { data: principal, error: principalError }] = await Promise.all([
    supabase.from('player_profiles').select('owner_uid,banned_at').eq('id', session.playerId).maybeSingle(),
    supabase.from('telegram_principals').select('telegram_user_id,player_id,owner_uid').eq('telegram_user_id', session.telegramId).maybeSingle()
  ]);
  if (profileError) throw profileError;
  if (principalError) throw principalError;
  if (!profile || !principal || principal.player_id !== session.playerId || principal.owner_uid !== profile.owner_uid) {
    // Returning an auth failure intentionally triggers the Mini App's one-shot Telegram re-auth,
    // which repairs stale principal/profile bindings without leaving social screens half-online.
    throw new Error('UNAUTHORIZED');
  }
  if (profile.banned_at) throw new Error('BANNED');
  return session;
}
