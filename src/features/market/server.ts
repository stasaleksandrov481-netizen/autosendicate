import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import type { z } from 'zod';
import type { marketActionSchema } from './schema';

type MarketAction = z.infer<typeof marketActionSchema>;

export async function listActiveMarket() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('market_cars')
    .select('id,seller_id,seller_name,car_id,price,vehicle_data,status,created_at')
    .eq('status', 'active')
    .order('id', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function applyMarketAction(playerId: string, body: MarketAction) {
  const supabase = createServerSupabase();
  let rpc = '';
  const args: Record<string, unknown> = { p_player_id: playerId };

  if (body.action === 'list') {
    rpc = 'autosyndicate_server_market_list_v10';
    args.p_price = body.price;
    args.p_vehicle_data = body.vehicle;
  } else if (body.action === 'cancel') {
    rpc = 'autosyndicate_server_market_cancel_v10';
    args.p_listing_id = body.listingId;
  } else if (body.action === 'buy') {
    rpc = 'autosyndicate_server_market_buy_v10';
    args.p_listing_id = body.listingId;
  } else {
    rpc = 'autosyndicate_server_market_settle_v10';
    args.p_listing_id = body.listingId;
  }

  const { data, error } = await supabase.rpc(rpc, args);
  if (error) throw error;
  return data;
}
