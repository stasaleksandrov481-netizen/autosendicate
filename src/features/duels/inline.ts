import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';
import { answerTelegramCallback, answerTelegramInlineQuery, editTelegramMessage, sendTelegramMessage, type TelegramInlinePhotoResult } from '@/features/bot/telegram';
import type { TgInlineQuery, TgMessage, TgUser } from '@/features/bot/types';
import { randomBytes } from 'node:crypto';

function playerId(id: number) { return `tg_${id}`; }
function safe(value: string) { return value.replace(/[&<>]/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m]!)); }
function username(user: TgUser) { return user.username ? `@${user.username}` : user.first_name || `tg_${user.id}`; }
function makeCode() { return randomBytes(12).toString('base64url'); }
function publicImage(path: string | null | undefined) {
  if (!path) return null;
  const env = getServerEnv();
  try { return new URL(path, `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/,'')}/`).toString(); } catch { return null; }
}

async function currentCar(telegramId: number) {
  const s = createServerSupabase();
  const profile = await s.from('player_profiles')
    .select('id,name,telegram_username,active_car_id,owned_cars,active_plate')
    .eq('id', playerId(telegramId)).maybeSingle();
  if (profile.error) throw profile.error;
  if (!profile.data) return null;
  const owned = Array.isArray(profile.data.owned_cars) ? profile.data.owned_cars.map(Number) : [];
  const active = Number(profile.data.active_car_id);
  if (!active || !owned.includes(active)) return null;
  const car = await s.from('game_cars_v11')
    .select('id,name,image_path,power,tier,category')
    .eq('id', active).eq('active', true).maybeSingle();
  if (car.error) throw car.error;
  if (!car.data) return null;
  return { profile: profile.data, car: car.data, plate: profile.data.active_plate ?? null };
}

export async function handleInlineDuelQuery(query: TgInlineQuery) {
  const selected = await currentCar(query.from.id);
  if (!selected) {
    await answerTelegramInlineQuery(query.id, [], 0);
    return;
  }
  const image = publicImage(selected.car.image_path);
  if (!image) {
    await answerTelegramInlineQuery(query.id, [], 0);
    return;
  }
  const plate = selected.plate && typeof selected.plate === 'object' ? String((selected.plate as any).text ?? '') : '';
  const plateLine = plate ? `\n🔖 ${safe(plate)}` : '';
  const result: TelegramInlinePhotoResult = {
    type: 'photo', id: `duel_${query.from.id}_${selected.car.id}`, photo_url: image, thumbnail_url: image,
    title: `Вызов на дуэль — ${selected.car.name}`,
    description: `${selected.car.name} • ${selected.car.power} л.с.`,
    caption: `<b>🏎️ ВЫЗОВ НА УЛИЧНУЮ ДУЭЛЬ</b>\n\n<b>${safe(username(query.from))}</b>\n${safe(selected.car.name)} • ${selected.car.power} л.с.${plateLine}\n\n⚡ Кто быстрее на 402m?`,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [
      [{ text: '⚡ Принять вызов', callback_data: `duel_inline:${query.from.id}` }],
      [{ text: '👤 Персональная дуэль', switch_inline_query_current_chat: 'duel' }, { text: '🌐 Открытый вызов в чат', switch_inline_query: 'duel' }]
    ] }
  };
  await answerTelegramInlineQuery(query.id, [result], 0);
}

async function createInlineRoom(challenger: TgUser, opponent: TgUser, message: TgMessage) {
  const s = createServerSupabase();
  const a = await currentCar(challenger.id);
  if (!a) throw new Error('CHALLENGER_NO_CAR');
  const b = await currentCar(opponent.id);
  if (!b) return { missingOpponentCar: true } as const;
  const code = makeCode();
  const { data, error } = await s.from('duel_rooms_v11').insert({
    public_code: code, chat_id: message.chat.id, challenge_message_id: message.message_id,
    player_a_id: playerId(challenger.id), player_b_id: playerId(opponent.id),
    player_a_telegram_id: challenger.id, player_b_telegram_id: opponent.id,
    player_a_name: username(challenger), player_b_name: username(opponent),
    player_a_car_id: a.car.id, player_b_car_id: b.car.id, status: 'accepted',
    accepted_at: new Date().toISOString(), expires_at: new Date(Date.now() + 10 * 60_000).toISOString()
  }).select('*').single();
  if (error) throw error;
  return { room: data, a, b } as const;
}

export async function handleInlineDuelCallback(callbackId: string, actor: TgUser, data: string, message?: TgMessage) {
  if (!message || !data.startsWith('duel_inline:')) return false;
  const challengerId = Number(data.slice('duel_inline:'.length));
  if (!Number.isInteger(challengerId) || challengerId === actor.id) {
    await answerTelegramCallback(callbackId, 'Нельзя принять собственный вызов.', true); return true;
  }
  const challenger: TgUser = { id: challengerId, first_name: 'Гонщик' };
  const s = createServerSupabase();
  const profile = await s.from('player_profiles').select('name,telegram_username').eq('id', playerId(challengerId)).maybeSingle();
  if (profile.data) { challenger.first_name = String(profile.data.name || 'Гонщик'); challenger.username = profile.data.telegram_username ?? undefined; }
  const opponentCar = await currentCar(actor.id);
  await answerTelegramCallback(callbackId, 'Проверяю гараж…');
  if (!opponentCar) {
    const env = getServerEnv();
    await editTelegramMessage(message.chat.id, message.message_id,
      `⚠️ <b>${safe(username(actor))}</b> принял вызов, но трухнул!\nНу или у него просто нет тачки в гараже... 🤷‍♂️\n\n🏎️ Заходи в Mini App, забирай свой первый авто и покажи, кто тут настоящий хозяин улиц! 👇`,
      [[{ text: '🚗 Забрать тачку и приехать', url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?startapp` }]]);
    return true;
  }
  const fakeMessage = message;
  const created = await createInlineRoom(challenger, actor, fakeMessage);
  if ('missingOpponentCar' in created && created.missingOpponentCar) return true;
  const env = getServerEnv();
  const duelId = created.room.public_code;
  await editTelegramMessage(message.chat.id, message.message_id,
    `🚨 <b>ГОНКА НАЧИНАЕТСЯ! ДУЭЛЬ ПОДТВЕРЖДЕНА!</b> 🚨\n\n🏎️ <b>${safe(username(challenger))}</b> (${safe(created.a.car.name)} • ${created.a.car.power} л.с.)\n⚡ VS\n🏎️ <b>${safe(username(actor))}</b> (${safe(created.b.car.name)} • ${created.b.car.power} л.с.)\n\n🏆 Ставка принята! Отрезок 402m ждёт. Кто окажется на финише, а кто будет глотать пыль? 🔥`,
    [[{ text: '🏁 ВЪЕХАТЬ НА ТРАССУ', url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?startapp=${encodeURIComponent(duelId)}` }]]);
  return true;
}
