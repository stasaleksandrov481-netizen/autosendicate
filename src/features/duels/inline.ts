import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';
import { answerTelegramCallback, answerTelegramInlineQuery, editTelegramMessage, editTelegramInlineMessage, sendTelegramMessage, type TelegramInlinePhotoResult } from '@/features/bot/telegram';
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
function plateText(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const item = value as Record<string, unknown>;
    return String(item.text ?? item.number ?? item.plate ?? '').trim();
  }
  return '';
}
function targetFromQuery(query: string) {
  const normalized = query.trim();
  if (!normalized) return '';
  const match = normalized.match(/^(?:duel\s+)?@([A-Za-z0-9_]{1,32})$/i);
  return match?.[1]?.toLowerCase() ?? '';
}

async function currentProfileAndCars(telegramId: number) {
  const s = createServerSupabase();
  const { data: profile, error } = await s.from('player_profiles')
    .select('id,name,telegram_username,active_car_id,owned_cars,active_plate,banned_at')
    .eq('id', playerId(telegramId)).maybeSingle();
  if (error) throw error;
  if (!profile || profile.banned_at) return null;
  const owned = Array.isArray(profile.owned_cars) ? profile.owned_cars.map(Number).filter(Number.isInteger) : [];
  if (!owned.length) return { profile, cars: [] };
  const { data: cars, error: carsError } = await s.from('game_cars_v11')
    .select('id,name,image_path,power,tier,category,flavor')
    .in('id', owned).eq('active', true).order('power', { ascending: false });
  if (carsError) throw carsError;
  return { profile, cars: cars ?? [] };
}

export async function handleInlineDuelQuery(query: TgInlineQuery) {
  const targetUsername = targetFromQuery(query.query);
  if (!targetUsername) {
    await answerTelegramInlineQuery(query.id, [], { cacheTime: 0, isPersonal: true });
    return;
  }

  if (query.from.username?.toLowerCase() === targetUsername) {
    await answerTelegramInlineQuery(query.id, [{
      type: 'article',
      id: `self_${query.from.id}`,
      title: '⛔ Нельзя вызвать самого себя',
      description: 'Укажи username другого игрока',
      input_message_content: { message_text: '🏁 Нельзя бросить вызов самому себе.' }
    }], { cacheTime: 0, isPersonal: true });
    return;
  }

  const selected = await currentProfileAndCars(query.from.id);
  const env = getServerEnv();
  const appUrl = `https://t.me/${env.TELEGRAM_BOT_USERNAME}/${env.TELEGRAM_APP_SHORT_NAME}`;
  const privateBotUrl = `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=select_car`;

  if (!selected) {
    await answerTelegramInlineQuery(query.id, [{
      type: 'article', id: `profile_${query.from.id}`, title: '🚗 Сначала зайди в AutoSendicate',
      description: 'Создай профиль и забери машину',
      input_message_content: { message_text: '🚗 У тебя ещё нет гаража. Открой AutoSendicate и забери первый автомобиль.' },
      reply_markup: { inline_keyboard: [[{ text: '🚗 Открыть AutoSendicate', url: appUrl }]] }
    }], { cacheTime: 0, isPersonal: true });
    return;
  }

  if (!selected.cars.length) {
    await answerTelegramInlineQuery(query.id, [{
      type: 'article', id: `nocars_${query.from.id}`, title: '🚗 В гараже нет машин',
      description: 'Забери автомобиль в личке бота',
      input_message_content: { message_text: '🚗 В гараже пусто. Забери первый автомобиль и возвращайся на линию.' },
      reply_markup: { inline_keyboard: [[{ text: '🚗 Забрать тачку', url: privateBotUrl }]] }
    }], { cacheTime: 0, isPersonal: true });
    return;
  }

  const plate = plateText(selected.profile.active_plate);
  const results = selected.cars.slice(0, 20).map((car: any) => {
    const image = publicImage(car.image_path);
    const caption = [
      '<b>🏁 ВЫЗОВ БРОШЕН!</b>',
      '',
      `${safe(username(query.from))} вызывает <b>@${safe(targetUsername)}</b>.`,
      '',
      `🏎️ <b>${safe(String(car.name))}</b>`,
      `⚙️ ${Number(car.power)} л.с.`,
      plate ? `🔖 Госномер: <b>${safe(plate)}</b>` : '🔖 Госномер: —',
      '',
      'Готов показать, на что способен твой аппарат?'
    ].join('\n');

    const keyboard = [[
      { text: '🚦 Принять вызов', callback_data: `duel_inline_accept:${query.from.id}:${car.id}:${targetUsername}` },
      { text: '❌ Сдать назад', callback_data: `duel_inline_decline:${query.from.id}:${car.id}:${targetUsername}` }
    ]];

    if (image) {
      const result: TelegramInlinePhotoResult = {
        type: 'photo',
        id: `duel_${query.from.id}_${car.id}_${targetUsername}`,
        photo_url: image,
        thumbnail_url: image,
        title: `🏎️ ${car.name}`,
        description: `${Number(car.power)} л.с. • ${plate || 'без госномера'}`,
        caption,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
      };
      return result;
    }

    return {
      type: 'article',
      id: `duel_${query.from.id}_${car.id}_${targetUsername}`,
      title: `🏎️ ${car.name}`,
      description: `${Number(car.power)} л.с. • ${plate || 'без госномера'}`,
      input_message_content: { message_text: caption, parse_mode: 'HTML' },
      reply_markup: { inline_keyboard: keyboard }
    };
  });

  await answerTelegramInlineQuery(query.id, results, { cacheTime: 0, isPersonal: true });
}

async function createInlineRoom(challenger: TgUser, opponent: TgUser, challengerCarId: number, context: { chatId?: number; messageId?: number }) {
  const s = createServerSupabase();
  const challengerData = await currentProfileAndCars(challenger.id);
  if (!challengerData || !challengerData.cars.some((car: any) => Number(car.id) === challengerCarId)) throw new Error('CHALLENGER_NO_CAR');
  const challengerCar = challengerData.cars.find((car: any) => Number(car.id) === challengerCarId)!;
  const opponentData = await currentProfileAndCars(opponent.id);
  if (!opponentData || !opponentData.cars.length) return { missingOpponentCar: true } as const;
  const opponentActiveId = Number(opponentData.profile.active_car_id);
  const opponentCar = opponentData.cars.find((car: any) => Number(car.id) === opponentActiveId) ?? opponentData.cars[0];
  const code = makeCode();
  const { data, error } = await s.from('duel_rooms_v11').insert({
    public_code: code,
    chat_id: context.chatId ?? null,
    challenge_message_id: context.messageId ?? null,
    player_a_id: playerId(challenger.id),
    player_b_id: playerId(opponent.id),
    player_a_telegram_id: challenger.id,
    player_b_telegram_id: opponent.id,
    player_a_name: username(challenger),
    player_b_name: username(opponent),
    player_a_car_id: challengerCar.id,
    player_b_car_id: opponentCar.id,
    status: 'accepted',
    accepted_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString()
  }).select('*').single();
  if (error) throw error;
  return { room: data, challenger: challengerData, opponent: opponentData, challengerCar, opponentCar } as const;
}

export async function handleInlineDuelCallback(callbackId: string, actor: TgUser, data: string, message?: TgMessage, inlineMessageId?: string) {
  if (!message && !inlineMessageId) return false;
  const edit = (text: string, keyboard?: Array<Array<{ text: string; callback_data?: string; url?: string }>>) => {
    if (inlineMessageId) return editTelegramInlineMessage(inlineMessageId, text, keyboard);
    return editTelegramMessage(message!.chat.id, message!.message_id, text, keyboard);
  };
  const context = { chatId: message?.chat.id, messageId: message?.message_id };
  const accept = data.match(/^duel_inline_accept:(\d+):(\d+):([A-Za-z0-9_]{1,32})$/);
  const decline = data.match(/^duel_inline_decline:(\d+):(\d+):([A-Za-z0-9_]{1,32})$/);
  const match = accept ?? decline;
  if (!match) return false;

  const challengerId = Number(match[1]);
  const challengerCarId = Number(match[2]);
  const targetUsername = match[3].toLowerCase();
  const actorUsername = actor.username?.toLowerCase() ?? '';

  if (!actorUsername || actorUsername !== targetUsername) {
    await answerTelegramCallback(callbackId, 'Эй, остынь! Этот вызов брошен не тебе, не лезь в чужую гонку!', true);
    return true;
  }
  if (actor.id === challengerId) {
    await answerTelegramCallback(callbackId, 'Нельзя принять собственный вызов.', true);
    return true;
  }

  if (decline) {
    await answerTelegramCallback(callbackId, 'Вызов отклонён.');
    await edit(
      `🏎💨 <b>@${safe(targetUsername)}</b> дал по газам и скрылся в тумане, решив не позориться!\n\n🏁 Гонка отменяется, победитель определён без боя.`);
    return true;
  }

  await answerTelegramCallback(callbackId, 'Проверяю гараж…');
  const opponentData = await currentProfileAndCars(actor.id);
  if (!opponentData || !opponentData.cars.length) {
    const env = getServerEnv();
    await edit(
      `⚠️ <b>@${safe(targetUsername)}</b>, у тебя же даже колес нету, чтобы на старт выйти! 🚲\n\nДуй в @${safe(env.TELEGRAM_BOT_USERNAME)}, бери тачку и возвращайся мстить!`,
      [[{ text: '🚗 Забрать тачку и приехать', url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=select_car` }]]);
    return true;
  }

  const challenger: TgUser = { id: challengerId, first_name: 'Гонщик' };
  const s = createServerSupabase();
  const { data: challengerProfile } = await s.from('player_profiles').select('name,telegram_username').eq('id', playerId(challengerId)).maybeSingle();
  if (challengerProfile) {
    challenger.first_name = String(challengerProfile.name || 'Гонщик');
    challenger.username = challengerProfile.telegram_username ?? undefined;
  }

  try {
    const created = await createInlineRoom(challenger, actor, challengerCarId, context);
    if ('missingOpponentCar' in created && created.missingOpponentCar) return true;
    const env = getServerEnv();
    const duelId = created.room.public_code;
    const url = `https://t.me/${env.TELEGRAM_BOT_USERNAME}/${env.TELEGRAM_APP_SHORT_NAME}?startapp=${encodeURIComponent(duelId)}`;
    await edit(
      `🚦 <b>ВЫЗОВ ПРИНЯТ!</b>\n\nМоторы ревут, резина горит...\n🏎️ ${safe(username(challenger))} — ${safe(String(created.challengerCar.name))} • ${Number(created.challengerCar.power)} л.с.\n⚡ VS\n🏎️ ${safe(username(actor))} — ${safe(String(created.opponentCar.name))} • ${Number(created.opponentCar.power)} л.с.\n\n🏁 <b>ГОНКА НАЧАЛАСЬ! ПОГНАЛИ!</b>`,
      [[{ text: '🏁 ВЪЕХАТЬ НА ТРАССУ', url }]]);
    if (message?.message_id) await s.from('duel_rooms_v11').update({ bot_message_id: message.message_id }).eq('id', created.room.id);
  } catch (error) {
    console.error('inline duel accept failed', error);
    await answerTelegramCallback(callbackId, 'Не удалось создать дуэль. Попробуй ещё раз.', true);
  }
  return true;
}


function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function sendStreetDuelsMenu(telegramId: number, mode: 'all' | 'equal' | 'risk' | 'boss' = 'all') {
  const s = createServerSupabase();
  const selfId = playerId(telegramId);
  const { data: me, error: meError } = await s.from('player_profiles')
    .select('id,name,telegram_username,level,balance,rating,races,wins,losses,current_car_name,active_car_id,owned_cars,banned_at')
    .eq('id', selfId).maybeSingle();
  if (meError) throw meError;
  if (!me) throw new Error('PROFILE_REQUIRED');

  const { data: profiles, error: profileError } = await s.from('player_profiles')
    .select('id,name,telegram_username,level,balance,rating,races,wins,losses,current_car_name,active_car_id,owned_cars,banned_at')
    .neq('id', selfId).is('banned_at', null).not('telegram_username', 'is', null).limit(100);
  if (profileError) throw profileError;

  const raw = (profiles ?? []).filter((p: any) => Number(p.active_car_id) > 0);
  const carIds = [...new Set(raw.map((p: any) => Number(p.active_car_id)).filter(Number.isInteger))];
  const { data: cars, error: carError } = carIds.length
    ? await s.from('game_cars_v11').select('id,name,power,tier,category').in('id', carIds).eq('active', true)
    : { data: [], error: null };
  if (carError) throw carError;
  const carMap = new Map((cars ?? []).map((car: any) => [Number(car.id), car]));

  const myRating = Number(me.rating ?? 0);
  const opponents = raw.map((p: any) => {
    const car = carMap.get(Number(p.active_car_id));
    const wins = Number(p.wins ?? 0);
    const losses = Number(p.losses ?? 0);
    const total = wins + losses;
    const winrate = total ? Math.round((wins / total) * 100) : 0;
    const rating = Number(p.rating ?? 0);
    const isBoss = rating >= myRating + 35;
    const isEqual = Math.abs(rating - myRating) <= 15;
    const isRisk = rating > myRating + 15;
    return { ...p, car, wins, losses, winrate, rating, isBoss, isEqual, isRisk };
  }).filter((p: any) => p.car);

  const filtered = mode === 'equal' ? opponents.filter((p: any) => p.isEqual)
    : mode === 'risk' ? opponents.filter((p: any) => p.isRisk)
    : mode === 'boss' ? opponents.filter((p: any) => p.isBoss)
    : opponents;

  const list = shuffle(filtered).slice(0, 30);
  const filterRow = [[
    { text: mode === 'all' ? '✅ Все' : 'Все', callback_data: 'street_duels:all' },
    { text: mode === 'equal' ? '✅ Равные' : 'Равные', callback_data: 'street_duels:equal' },
    { text: mode === 'risk' ? '✅ Риск' : 'Риск', callback_data: 'street_duels:risk' },
    { text: mode === 'boss' ? '✅ Боссы' : 'Боссы', callback_data: 'street_duels:boss' }
  ]];

  const lines = [
    '🔥 <b>КАРБОНОВАЯ ЛИГА | УЛИЧНЫЕ ДУЭЛИ</b> 🔥',
    '',
    `⚡️ LVL: ${Number(me.level ?? 1)} | 💰 Баланс: ${Number(me.balance ?? 0).toLocaleString('ru-RU')}`,
    '',
    me.current_car_name
      ? `🚘 <b>Твой аппарат:</b> ${safe(String(me.current_car_name))}`
      : '🚘 <b>Твой аппарат:</b> ❌ не выбран',
    '',
    '━━━━━━━━━━━━━━━━━━',
    mode === 'all' ? '🎯 <b>Соперники</b>' : `🎯 <b>Соперники • ${mode}</b>`,
    ''
  ];

  const rows: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [...filterRow];
  for (const opponent of list) {
    const usernameValue = String(opponent.telegram_username).replace(/^@/, '');
    const tier = safe(String(opponent.car.tier ?? 'KR'));
    const name = safe(String(opponent.name ?? usernameValue));
    const carName = safe(String(opponent.car.name));
    lines.push(
      `<b>[${tier}] 👤 ${name} (@${safe(usernameValue)})</b>\n` +
      `${carName} — ${Number(opponent.car.power)} л.с. | 🏆 Рейтинг: ${opponent.rating} (${opponent.winrate}% побед)`,
      '──────────────────'
    );
    rows.push([{ text: '⚡️ ВЫЗВАТЬ НА ЛИНИЮ', url: `https://t.me/${getServerEnv().TELEGRAM_BOT_USERNAME}?start=duel_${encodeURIComponent(usernameValue)}` }]);
  }

  if (!list.length) lines.push('😶 Подходящих соперников пока нет. Попробуй другой фильтр.');

  return sendTelegramMessage(telegramId, lines.join('\n'), { parseMode: 'HTML', keyboard: rows });
}

export async function handleStreetDuelsCallback(callbackId: string, actor: TgUser, data: string) {
  const match = data.match(/^street_duels:(all|equal|risk|boss)$/);
  if (!match) return false;
  await answerTelegramCallback(callbackId);
  await sendStreetDuelsMenu(actor.id, match[1] as 'all' | 'equal' | 'risk' | 'boss');
  return true;
}
