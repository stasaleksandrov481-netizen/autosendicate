import { ImageResponse } from 'next/og';
import { createServerSupabase } from '@/lib/supabase/server';
import { carVisualDataUri } from '@/features/car-visual/svg';
import { normalizeCarVisualConfig } from '@/features/car-visual/catalog';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:Request,{params}:{params:Promise<{playerId:string}>}){
  const {playerId}=await params;
  if(!/^tg_[0-9]{1,24}$/.test(playerId))return new Response('not found',{status:404});
  const url=new URL(request.url);
  const requested=Number(url.searchParams.get('carId')||0);
  const s=createServerSupabase();
  const {data,error}=await s.from('player_profiles').select('active_car_id,owned_cars,car_visuals').eq('id',playerId).maybeSingle();
  if(error||!data)return new Response('not found',{status:404});
  const owned=Array.isArray(data.owned_cars)?data.owned_cars.map(Number).filter(Number.isInteger):[];
  const carId=requested&&owned.includes(requested)?requested:Number(data.active_car_id)||owned[0]||1;
  if(!owned.includes(carId))return new Response('not found',{status:404});
  const visuals=(data.car_visuals&&typeof data.car_visuals==='object'&&!Array.isArray(data.car_visuals))?data.car_visuals as Record<string,unknown>:{};
  const config=normalizeCarVisualConfig(visuals[String(carId)],carId);
  const src=carVisualDataUri(config);
  return new ImageResponse(
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(160deg,#080a0f,#111827 62%,#050608)',padding:'38px'}}>
      <img src={src} alt="" width="920" height="530" style={{objectFit:'contain'}} />
    </div>,
    {width:1000,height:600,headers:{'Cache-Control':'public, max-age=30, stale-while-revalidate=120'}}
  );
}
