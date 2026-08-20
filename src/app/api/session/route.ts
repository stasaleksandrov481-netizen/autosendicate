import { getSession } from '@/lib/security/session';
import { noStoreJson } from '@/lib/security/http';
export const runtime = 'nodejs';
export async function GET() {
  const session = await getSession();
  return noStoreJson({ authenticated: Boolean(session), session: session ? { playerId: session.playerId, username: session.username, name: session.name } : null }, session ? 200 : 401);
}
