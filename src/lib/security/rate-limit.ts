import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';

type Bucket = { hits: number; resetAt: number };
const emergencyBuckets = new Map<string, Bucket>();

function localFallback(subject: string, scope: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const key = `${subject}:${scope}`;
  const current = emergencyBuckets.get(key);
  if (!current || current.resetAt <= now) {
    emergencyBuckets.set(key, { hits: 1, resetAt: now + windowSeconds * 1000 });
    return;
  }
  current.hits += 1;
  if (current.hits > limit) throw new Error('rate limit exceeded');
}

function isSchemaOrRoleCompatibilityError(error: any) {
  const code = String(error?.code ?? '');
  const msg = `${error?.message ?? ''} ${error?.details ?? ''} ${error?.hint ?? ''}`.toLowerCase();
  return [
    '42883', '42P01', '42703', 'PGRST202', 'PGRST204', 'PGRST205'
  ].includes(code) ||
    msg.includes('could not find the function') ||
    msg.includes('schema cache') ||
    msg.includes('service role required') ||
    msg.includes('api_rate_limits_v10');
}

export async function enforceRateLimit(subject:string,scope:string,limit:number,windowSeconds:number){
  const supabase=createServerSupabase();

  // v12.4 uses database grants as the trust boundary. This works with both legacy
  // service_role JWTs and the newer Supabase server secret keys.
  const {error}=await supabase.rpc('autosyndicate_rate_limit_v12_4',{
    p_subject:subject,p_scope:scope,p_limit:limit,p_window_seconds:windowSeconds
  });
  if(!error)return;

  // Allow a deployment to remain functional while the patch migration is being
  // applied. The fallback is intentionally process-local and only used for
  // infrastructure compatibility failures; real rate-limit violations still fail.
  if(isSchemaOrRoleCompatibilityError(error)){
    console.warn('Persistent rate limiter unavailable; using emergency limiter', {
      code:error?.code, message:error?.message, scope
    });
    localFallback(subject,scope,limit,windowSeconds);
    return;
  }
  throw error;
}
