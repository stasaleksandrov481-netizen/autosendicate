import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getServerEnv } from '@/lib/env';

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
  return session;
}
