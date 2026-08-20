import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerEnv } from '@/lib/env';
import { verifyTelegramInitData } from '@/lib/telegram/verify-init-data';
import { ensureTelegramPrincipal } from '@/features/auth/principal';
import { encodeSession, SESSION_COOKIE } from '@/lib/security/session';
import { apiError, assertSameOrigin } from '@/lib/security/http';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
const bodySchema = z.object({ initData: z.string().min(1).max(16_000) });

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = bodySchema.parse(await request.json());
    const env = getServerEnv();
    const user = verifyTelegramInitData(body.initData, env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_AUTH_MAX_AGE_SECONDS);
    await enforceRateLimit(`tg_${user.id}`, 'auth', 10, 60);
    const principal = await ensureTelegramPrincipal(user);
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
    const token = encodeSession({ playerId: principal.playerId, telegramId: user.id, username: user.username ?? null, name: user.first_name, exp });
    const response = NextResponse.json({ ok: true, playerId: principal.playerId, tokenHash: principal.tokenHash, user: { name: user.first_name, username: user.username ?? null } });
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) { return apiError(error, 401); }
}
