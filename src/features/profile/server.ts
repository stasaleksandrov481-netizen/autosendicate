import { createServerSupabase } from '@/lib/supabase/server';
import type { z } from 'zod';
import type { profileSyncSchema } from './schema';

type ProfileSync = z.infer<typeof profileSyncSchema>;
export async function syncProfile(playerId:string, username:string|null, body:ProfileSync){
  const supabase=createServerSupabase();
  const patch:Record<string,unknown>={
    name:body.displayName,photo_url:body.photoUrl??null,current_car_name:body.currentCarName??null,
    active_car_id:body.activeCarId,active_plate:body.activePlate??null,wanted_level:body.wantedLevel??0,telegram_username:username,last_seen:new Date().toISOString()
  };
  /* v17-fix: только затираем экономические поля, если клиент реально их прислал —
     это защищает от случайного обнуления гаража старыми вызовами API, которые
     ещё не обновлены до нового payload. */
  if(body.ownedCars!==undefined) patch.owned_cars=body.ownedCars;
  if(body.balance!==undefined) patch.balance=body.balance;
  if(body.xp!==undefined) patch.xp=body.xp;
  if(body.races!==undefined) patch.races=body.races;
  if(body.wins!==undefined) patch.wins=body.wins;
  if(body.losses!==undefined) patch.losses=body.losses;
  if(body.totalEarned!==undefined) patch.total_earned=body.totalEarned;
  if(body.level!==undefined) patch.level=body.level;
  const {error}=await supabase.from('player_profiles').update(patch).eq('id',playerId);
  if(error)throw error;
}
