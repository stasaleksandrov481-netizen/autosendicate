import { createServerSupabase } from '@/lib/supabase/server';
import type { z } from 'zod';
import type { friendshipActionSchema } from './schema';

type FriendshipAction=z.infer<typeof friendshipActionSchema>;
export async function applyFriendAction(playerId:string,body:FriendshipAction){
  const supabase=createServerSupabase();
  let rpc:string;let args:Record<string,unknown>;
  if(body.action==='request'){rpc='autosyndicate_server_friend_request_v10';args={p_player_id:playerId,p_query:body.query};}
  else if(body.action==='accept'){rpc='autosyndicate_server_friend_accept_v10';args={p_player_id:playerId,p_friendship_id:body.friendshipId};}
  else{rpc='autosyndicate_server_friend_remove_v10';args={p_player_id:playerId,p_friendship_id:body.friendshipId};}
  const {data,error}=await supabase.rpc(rpc,args);if(error)throw error;return data;
}
export async function listFriends(playerId:string){
  const supabase=createServerSupabase();
  const {data,error}=await supabase.from('friendships').select('*').or(`requester_id.eq.${playerId},recipient_id.eq.${playerId}`).order('created_at',{ascending:false});
  if(error)throw error;return data??[];
}
