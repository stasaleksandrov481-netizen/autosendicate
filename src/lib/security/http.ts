import { NextResponse } from 'next/server';

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!host) throw new Error('invalid host');
  let originHost = '';
  try { originHost = new URL(origin).host; } catch { throw new Error('invalid origin'); }
  if (originHost !== host) throw new Error('origin rejected');
}

export function apiError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : 'request failed';
  const safe = message === 'UNAUTHORIZED' ? 'unauthorized' : message.slice(0, 180);
  const code = message === 'UNAUTHORIZED' ? 401 : message.includes('rate limit') ? 429 : status;
  return NextResponse.json({ ok: false, error: safe }, { status: code, headers: { 'Cache-Control':'no-store' } });
}

export function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
