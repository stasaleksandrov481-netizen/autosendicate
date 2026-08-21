import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import type { VerifiedTelegramUser } from '@/lib/telegram/verify-init-data';

export interface TelegramPrincipal {
  playerId: string;
  ownerUid: string;
  tokenHash?: string;
}

function isAlreadyRegisteredError(message: unknown) {
  return String(message ?? '').toLowerCase().includes('already been registered')
    || String(message ?? '').toLowerCase().includes('already registered');
}

// Finds an orphaned Supabase Auth user (no linked player_profiles row) by email.
// admin.listUsers() has no server-side email filter, so we page through results.
async function findAuthUserIdByEmail(supabase: ReturnType<typeof createServerSupabase>, email: string): Promise<string | null> {
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((candidate) => candidate.email === email);
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
  return null;
}

export async function ensureTelegramPrincipal(user: VerifiedTelegramUser): Promise<TelegramPrincipal> {
  const supabase = createServerSupabase();
  const playerId = `tg_${user.id}`;
  const email = `tg-${user.id}@auth.autosyndicate.invalid`;
  let authEmail = email;

  const { data: existingProfile, error: profileError } = await supabase
    .from('player_profiles')
    .select('id,owner_uid,balance,owned_cars,races,total_earned,active_car_id')
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
    if (error || !data.user) {
      // A Supabase Auth user with this synthetic email can already exist without a matching
      // player_profiles row (e.g. left over from an earlier interrupted login). Recover it
      // instead of hard-failing the whole login.
      if (!isAlreadyRegisteredError(error?.message)) throw error ?? new Error('failed to create Supabase principal');
      const recoveredId = await findAuthUserIdByEmail(supabase, email);
      if (!recoveredId) throw error ?? new Error('failed to create Supabase principal');
      ownerUid = recoveredId;
      const { error: syncError } = await supabase.auth.admin.updateUserById(recoveredId, {
        email_confirm: true,
        user_metadata: { telegram_id: user.id, telegram_verified: true }
      });
      if (syncError) console.warn('Failed to sync recovered Supabase principal metadata', syncError);
    } else {
      ownerUid = data.user.id;
    }
  } else {
    const { error } = await supabase.auth.admin.updateUserById(ownerUid, {
      email,
      email_confirm: true,
      user_metadata: { telegram_id: user.id, telegram_verified: true }
    });
    // The game server only needs the stable profile binding. A stale/deleted auth principal is
    // recovered below by creating a replacement rather than taking the whole Telegram login down.
    if (error) {
      const missingPrincipal = String(error.message || '').toLowerCase().includes('not found');
      if (!missingPrincipal) throw error;
      authEmail = `tg-${user.id}-${Date.now()}@auth.autosyndicate.invalid`;
      const replacement = await supabase.auth.admin.createUser({
        email: authEmail,
        email_confirm: true,
        user_metadata: { telegram_id: user.id, telegram_verified: true }
      });
      if (replacement.error || !replacement.data.user) throw replacement.error ?? error;
      ownerUid = replacement.data.user.id;
    }
  }

  if (!ownerUid) throw new Error('Supabase principal owner UID missing');

  const stableOwnerUid = ownerUid;
  const isFreshProfile = !existingProfile;
  const needsStarterRepair = Boolean(existingProfile && (!Array.isArray(existingProfile.owned_cars) || existingProfile.owned_cars.length === 0) && Number(existingProfile.races ?? 0) === 0 && Number(existingProfile.total_earned ?? 0) === 0);
  const starterPatch = isFreshProfile || needsStarterRepair ? {
    balance: Math.max(1500, Number(existingProfile?.balance ?? 0)),
    owned_cars: [1],
    active_car_id: 1
  } : {};

  const { error: upsertProfileError } = await supabase.from('player_profiles').upsert(
    {
      id: playerId,
      owner_uid: stableOwnerUid,
      name: user.first_name,
      photo_url: user.photo_url ?? null,
      telegram_username: user.username ?? null,
      last_seen: new Date().toISOString(),
      ...starterPatch
    },
    { onConflict: 'id' }
  );
  if (upsertProfileError) throw upsertProfileError;

  const { error: principalError } = await supabase.from('telegram_principals').upsert(
    {
      telegram_user_id: user.id,
      player_id: playerId,
      owner_uid: stableOwnerUid,
      telegram_username: user.username ?? null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'telegram_user_id' }
  );
  if (principalError) throw principalError;

  // Optional browser session for Supabase Realtime. Failure here must never invalidate the
  // already verified Telegram/Vercel session or disable server-backed gameplay.
  let tokenHash: string | undefined;
  try {
    const { data: link, error: linkError } = await supabase.auth.admin.generateLink({ type: 'magiclink', email: authEmail });
    if (!linkError) tokenHash = link.properties?.hashed_token;
  } catch (error) {
    console.warn('Supabase browser-session link generation failed', error);
  }

  return { playerId, ownerUid: stableOwnerUid, tokenHash };
}
