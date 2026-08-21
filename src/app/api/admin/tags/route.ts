import { requireAdmin } from '@/features/admin/auth';
import { apiError, assertSameOrigin, noStoreJson } from '@/lib/security/http';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  try {
    await requireAdmin();
    const { data, error } = await createServerSupabase()
      .from('profile_tag_catalog').select('*').order('label');
    if (error) throw error;
    return noStoreJson({ ok:true, tags:data ?? [] });
  } catch (e) { return apiError(e,403); }
}

export async function POST(request:Request) {
  try {
    assertSameOrigin(request);
    await requireAdmin();
    const body = await request.json();
    const row = {
      key:String(body.key).replace(/[^a-z0-9_-]/gi,'').slice(0,40),
      label:String(body.label).slice(0,40),
      emoji:String(body.emoji ?? '').slice(0,8),
      background:String(body.background).slice(0,80),
      foreground:String(body.foreground).slice(0,20),
      border_color:String(body.border_color ?? '#ffffff22').slice(0,20),
      glow:Boolean(body.glow)
    };
    const {data,error}=await createServerSupabase()
      .from('profile_tag_catalog').upsert(row,{onConflict:'key'}).select().single();
    if(error) throw error;
    return noStoreJson({ok:true,tag:data});
  } catch(e){ return apiError(e,403); }
}
