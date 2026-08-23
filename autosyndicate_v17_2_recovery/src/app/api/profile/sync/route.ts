import { profileSyncSchema } from '@/features/profile/schema';
import { syncProfile } from '@/features/profile/server';
import { requireSession } from '@/lib/security/session';
import { apiError, assertSameOrigin, noStoreJson } from '@/lib/security/http';
import { enforceRateLimit } from '@/lib/security/rate-limit';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    await enforceRateLimit(session.playerId, 'profile_sync', 20, 60);
    const body = profileSyncSchema.parse(await request.json());
    await syncProfile(session.playerId, session.username, body);
    return noStoreJson({ ok: true });
  } catch (error) {
    const msg=error instanceof Error?error.message:'';
    if(msg==='UNAUTHORIZED'||msg==='BANNED'||msg.includes('rate limit')) return apiError(error);
    console.warn('profile presentation sync deferred', error);
    return noStoreJson({ ok:true, synced:false, deferred:true });
  }
}
