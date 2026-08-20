import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';

export async function getReferralDashboard(playerId:string) {
  const s=createServerSupabase();
  const { data: me, error: meError }=await s.from('player_profiles').select('id,owner_uid,referral_code').eq('id',playerId).maybeSingle();
  if(meError) throw meError;
  if(!me?.owner_uid) return { referral_code:'',has_referrer:false,invites:0,total_earned:0 };
  const code=String(me.referral_code||'').trim().toUpperCase();
  const [{count:invites,error:inviteErr},{count:bound,error:boundErr},{data:earnings,error:earnErr}]=await Promise.all([
    s.from('referrals').select('invitee_uid',{count:'exact',head:true}).eq('inviter_uid',me.owner_uid),
    s.from('referrals').select('invitee_uid',{count:'exact',head:true}).eq('invitee_uid',me.owner_uid),
    s.from('referral_earnings').select('amount').eq('inviter_uid',me.owner_uid)
  ]);
  if(inviteErr||boundErr||earnErr){
    const err=inviteErr||boundErr||earnErr;
    const errCode=String((err as any)?.code||'');
    if(['42P01','PGRST204','PGRST205'].includes(errCode)) return { referral_code:code||playerId.replace(/^tg_/,'').slice(-10).toUpperCase(),has_referrer:false,invites:0,total_earned:0 };
    throw err;
  }
  return { referral_code:code||playerId.replace(/^tg_/,'').slice(-10).toUpperCase(),has_referrer:(bound??0)>0,invites:invites??0,total_earned:(earnings??[]).reduce((sum:any,row:any)=>sum+Number(row.amount||0),0) };
}

export async function bindReferral(playerId:string, code:string) {
  const {data,error}=await createServerSupabase().rpc('autosyndicate_server_bind_referrer_v12_7',{p_player_id:playerId,p_referral_code:code});
  if(error) throw error; return Array.isArray(data)?data[0]??null:data;
}
export async function claimReferralRewards(playerId:string) {
  const {data,error}=await createServerSupabase().rpc('autosyndicate_server_claim_referrals_v12_7',{p_player_id:playerId});
  if(error) throw error; const row=Array.isArray(data)?data[0]:data; return Number(row?.amount??row??0)||0;
}
export async function claimFirstRaceBonus(playerId:string) {
  const {data,error}=await createServerSupabase().rpc('autosyndicate_server_claim_first_race_bonus_v12_7',{p_player_id:playerId});
  if(error) throw error; const row=Array.isArray(data)?data[0]:data; return Number(row?.bonus??row??0)||0;
}
