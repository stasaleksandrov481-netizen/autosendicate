import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';

export async function enforceRateLimit(subject:string,scope:string,limit:number,windowSeconds:number){
  const supabase=createServerSupabase();
  const {error}=await supabase.rpc('autosyndicate_rate_limit_v10',{
    p_subject:subject,p_scope:scope,p_limit:limit,p_window_seconds:windowSeconds
  });
  if(error)throw error;
}
