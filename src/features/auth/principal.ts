import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import type { VerifiedTelegramUser } from '@/lib/telegram/verify-init-data';

export interface TelegramPrincipal {
  playerId: string;
  ownerUid: string;
  tokenHash: string;
}

export async function ensureTelegramPrincipal(user: VerifiedTelegramUser): Promise<TelegramPrincipal> {
  const supabase = createServerSupabase();
  const playerId = `tg_${user.id}`;
  const email = `tg-${user.id}@auth.autosyndicate.invalid`;

  const { data: existingProfile, error: profileError } = await supabase
    .from('player_profiles')
    .select('id,owner_uid')
    .eq('id', playerId)
    .maybeSingle();
  if (profileError) throw profileError;

  let ownerUid = existingProfile?.owner_uid as string | undefined;
  if (!ownerUid) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { telegram_id: user.id, telegram_verified: true }
    });
    if (error || !data.user) throw error ?? new Error('failed to create Supabase principal');
    ownerUid = data.user.id;
  } else {
    const { error } = await supabase.auth.admin.updateUserById(ownerUid, {
      email,
      email_confirm: true,
      user_metadata: { telegram_id: user.id, telegram_verified: true }
    });
    if (error) throw error;
  }

  const { error: upsertProfileError } = await supabase.from('player_profiles').upsert({
    id: playerId,
    owner_uid: ownerUid,
    name: user.first_name,
    photo_url: user.photo_url ?? null,
    telegram_username: user.username ?? null,
    last_seen: new Date().toISOString()
  }, { onConflict: 'id' });
  if (upsertProfileError) throw upsertProfileError;

  const { error: principalError } = await supabase.from('telegram_principals').upsert({
    telegram_user_id: user.id,
    player_id: playerId,
    owner_uid: ownerUid,
    telegram_username: user.username ?? null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'telegram_user_id' });
  if (principalError) throw principalError;

  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email
  });
  if (linkError) throw linkError;
  const tokenHash = link.properties?.hashed_token;
  if (!tokenHash) throw new Error('Supabase magic-link token was not generated');

  return { playerId, ownerUid, tokenHash };
}
