import { createServerSupabase } from '@/lib/supabase/server';
import { noStoreJson } from '@/lib/security/http';
import { getSession } from '@/lib/security/session';
export const runtime='nodejs';
export async function GET(){
  const s=createServerSupabase();
  const session=await getSession().catch(()=>null);
  const [cars,opponents,settings]=await Promise.all([
    s.from('game_cars_v11').select('id,name,image_path,price,power,tier,category,flavor,sort_order').eq('active',true).not('image_path','is',null).order('sort_order').order('id'),
    s.from('game_opponents_v11').select('*').eq('active',true).order('sort_order').order('key'),
    s.from('game_settings_v11').select('key,value')
  ]);
  if(cars.error) console.warn('game cars bootstrap fallback', cars.error.code);
  if(opponents.error) console.warn('game opponents bootstrap fallback', opponents.error.code);
  if(settings.error) console.warn('game settings bootstrap fallback', settings.error.code);
  const carRows=(cars.data??[]).filter((c:any)=>Number(c.id)>=1&&Number(c.id)<=25&&/^\/assets\/cars\/[0-9]+\.webp$/i.test(String(c.image_path||'')));
  let player=null;
  if(session?.playerId){
    const res=await s.from('player_profiles').select('id,name,level,balance,xp,races,wins,losses,total_earned,owned_cars,active_car_id,rating,best_0_100').eq('id',session.playerId).maybeSingle();
    if(!res.error) player=res.data;
  }
  return noStoreJson({
    ok:true,
    partial:Boolean(cars.error||opponents.error||settings.error),
    cars:carRows.map((c:any)=>({id:c.id,name:c.name,image:c.image_path,price:c.price,power:c.power,tier:c.tier,cat:c.category,flavor:c.flavor})),
    opponents:(opponents.data??[]).map((o:any)=>({id:o.key,name:o.name,power:o.power,reward:o.reward,unlockLevel:o.unlock_level,car:o.car_name,rating:o.rating,style:o.style,favoriteTracks:o.favorite_tracks,wins:o.wins,losses:o.losses,avatar:o.avatar,taunt:o.taunt,preLines:o.pre_lines,winLine:o.win_line,loseLine:o.lose_line,boss:o.boss})),
    settings:Object.fromEntries((settings.data??[]).map((x:any)=>[x.key,x.value])),
    player
  });
}
