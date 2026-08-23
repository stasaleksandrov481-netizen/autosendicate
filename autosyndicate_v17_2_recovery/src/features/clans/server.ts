import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import type { z } from 'zod';
import type { clanActionSchema } from './schema';

type ClanAction = z.infer<typeof clanActionSchema>;

async function membershipFor(playerId: string) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('clan_members')
    .select('clan_id,role')
    .eq('player_id', playerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function applyClanAction(playerId: string, body: ClanAction) {
  const supabase = createServerSupabase();

  if (body.action === 'visibility') {
    const membership = await membershipFor(playerId);
    if (!membership || membership.role !== 'owner') throw new Error('only clan owner can change visibility');
    const { data, error } = await supabase
      .from('clans')
      .update({ is_open: body.isOpen })
      .eq('id', membership.clan_id)
      .select('id,name,is_open')
      .single();
    if (error) throw error;
    return data;
  }

  if (body.action === 'joinOpen') {
    const existing = await membershipFor(playerId);
    if (existing) throw new Error('player already belongs to a clan');
    const [{ data: clan, error: clanError }, { data: profile, error: profileError }] = await Promise.all([
      supabase.from('clans').select('id,name,is_open').eq('id', body.clanId).maybeSingle(),
      supabase.from('player_profiles').select('id,name,owner_uid,banned_at').eq('id', playerId).maybeSingle()
    ]);
    if (clanError) throw clanError;
    if (profileError) throw profileError;
    if (!clan || clan.is_open !== true) throw new Error('clan is invite-only');
    if (!profile || profile.banned_at) throw new Error('player unavailable');
    const { data, error } = await supabase
      .from('clan_members')
      .insert({
        clan_id: clan.id,
        player_id: playerId,
        member_uid: profile.owner_uid,
        player_name: profile.name,
        role: 'member'
      })
      .select('clan_id,role')
      .single();
    if (error) throw error;
    return data;
  }

  let rpc = '';
  const args: Record<string, unknown> = { p_player_id: playerId };

  if (body.action === 'create') {
    rpc = 'autosyndicate_server_clan_create_v10';
    args.p_name = body.name;
  } else if (body.action === 'invite') {
    rpc = 'autosyndicate_server_clan_invite_v10';
    args.p_query = body.query;
  } else if (body.action === 'accept') {
    rpc = 'autosyndicate_server_clan_accept_v10';
    args.p_invite_id = body.inviteId;
  } else if (body.action === 'leave') {
    rpc = 'autosyndicate_server_clan_leave_v10';
  } else {
    rpc = 'autosyndicate_server_clan_kick_v10';
    args.p_member_uid = body.memberUid;
  }

  const { data, error } = await supabase.rpc(rpc, args);
  if (error) throw error;

  if (body.action === 'create') {
    const membership = await membershipFor(playerId);
    if (membership?.clan_id) {
      const { error: visibilityError } = await supabase
        .from('clans')
        .update({ is_open: body.isOpen })
        .eq('id', membership.clan_id);
      if (visibilityError) throw visibilityError;
    }
  }

  return data;
}

export async function getClanView(playerId: string) {
  const supabase = createServerSupabase();

  const [
    { data: membership, error: membershipError },
    { data: invites, error: invitesError },
    { data: leaderboard, error: leaderboardError },
    { data: openClans, error: openClansError }
  ] = await Promise.all([
    supabase
      .from('clan_members')
      .select('clan_id,role,clans(id,name,owner_uid,created_at,is_open)')
      .eq('player_id', playerId)
      .maybeSingle(),
    supabase
      .from('clan_invites')
      .select('id,clan_id,inviter_name,created_at,clans(name,is_open)')
      .eq('invitee_id', playerId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('clan_leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(100),
    supabase
      .from('clans')
      .select('id,name,is_open,created_at')
      .eq('is_open', true)
      .order('created_at', { ascending: false })
      .limit(50)
  ]);

  if (membershipError) throw membershipError;
  if (invitesError) throw invitesError;
  if (leaderboardError) throw leaderboardError;
  if (openClansError) throw openClansError;

  let members: unknown[] = [];
  let clanRank: unknown = null;
  if (membership?.clan_id) {
    const [{ data: memberRows, error: memberError }, { data: rankRow, error: rankError }] = await Promise.all([
      supabase
        .from('clan_members')
        .select('member_uid,player_id,player_name,role,joined_at,player_profiles(rating,wins,current_car_name,profile_tags,wanted_level)')
        .eq('clan_id', membership.clan_id)
        .order('joined_at', { ascending: true }),
      supabase
        .from('clan_leaderboard')
        .select('*')
        .eq('id', membership.clan_id)
        .maybeSingle()
    ]);
    if (memberError) throw memberError;
    if (rankError) throw rankError;
    members = memberRows ?? [];
    clanRank = rankRow ?? null;
  }

  return {
    membership: membership ?? null,
    invites: invites ?? [],
    members,
    clanRank,
    leaderboard: leaderboard ?? [],
    openClans: openClans ?? []
  };
}
