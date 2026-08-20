import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';
import type { TgMessage, TgUpdate, TgUser, TgInlineQuery } from './types';
import { answerTelegramCallback, answerTelegramInlineQuery, sendTelegramMessage, editTelegramMessage } from './telegram';
import { createChatDuelChallenge, createInlineDuelForAcceptor, handleDuelCallback } from '@/features/duels/server';
import { isAdminTelegramId } from '@/features/admin/auth';
import { enforceRateLimit } from '@/lib/security/rate-limit';

const DEFAULT_DUEL_WORDS = ['дуэль','дуель','поединок','гонка','заезд'];
const fallbackUpdates = new Map<number, number>();

function normalizeText(value: string) {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_/@\s-]+/giu, ' ').replace(/\s+/g, ' ').trim();
}

function parseCommand(text: string) {
  const match = text.trim().match(/^\/([a-zA-Z0-9_]{1,32})(?:@[A-Za-z0-9_]{5,64})?(?:\s+([\s\S]*))?$/);
  return match ? { command: match[1].toLowerCase(), args: (match[2] ?? '').trim() } : null;
}

async function isDuelTrigger(text: string) {
  const normalized = normalizeText(text);
  let words = DEFAULT_DUEL_WORDS;
  try {
    const s = createServerSupabase();
    const { data, error } = await s.from('game_settings_v11').select('value').eq('key', 'bot.duel_words').maybeSingle();
    if (!error && Array.isArray(data?.value)) {
      const configured = data.value
        .filter((value: unknown): value is string => typeof value === 'string')
        .map((value: string) => normalizeText(value)).filter(Boolean);
      if (configured.length) words = [...new Set([...DEFAULT_DUEL_WORDS, ...configured])];
    }
  } catch (error) {
    console.warn('Bot duel words settings unavailable; using defaults', error);
  }
  return words.some((word: string) => normalized === word || normalized.split(' ').includes(word));
}



function publicCarImageUrl(imagePath: string | null | undefined) {
  const env = getServerEnv();
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const path = String(imagePath || '/assets/cars/1.webp').startsWith('/') ? String(imagePath || '/assets/cars/1.webp') : `/${imagePath}`;
  return `${base}${path}`;
}

async function handleInlineQuery(query: TgInlineQuery) {
  const s = createServerSupabase();
  const playerId = playerIdFromInline(query.from.id);
  const { data: profile, error } = await s.from('player_profiles').select('id,name,telegram_username,active_car_id,owned_cars,active_plate,banned_at').eq('id', playerId).maybeSingle();
  if (error) throw error;
  const env = getServerEnv();
  const appUrl = `https://t.me/${env.TELEGRAM_BOT_USERNAME}/${env.TELEGRAM_APP_SHORT_NAME}`;
  if (!profile || profile.banned_at) {
    await answerTelegramInlineQuery(query.id, [{ type:'article', id:'no-profile', title:'Открыть AutoSyndicate', description:'Зайдите в Mini App и выберите машину.', input_message_content:{message_text:'🏎️ Открой AutoSyndicate и выбери машину для дуэли.'}, reply_markup:{inline_keyboard:[[{text:'🚗 Открыть Mini App',url:appUrl}]]} }], {cacheTime:0,isPersonal:true});
    return;
  }
  const owned = Array.isArray(profile.owned_cars) ? profile.owned_cars : [];
  const carId = Number(profile.active_car_id) || Number(owned[0]);
  if (!carId || !owned.includes(carId)) {
    await answerTelegramInlineQuery(query.id, [{ type:'article', id:'no-car', title:'Нет машины в гараже', description:'Заберите первый автомобиль в Mini App.', input_message_content:{message_text:'🚗 У меня пока нет машины. Захожу в AutoSyndicate за первым авто.'}, reply_markup:{inline_keyboard:[[{text:'🚗 Забрать тачку и приехать',url:appUrl}]]} }], {cacheTime:0,isPersonal:true});
    return;
  }
  const { data: car, error: carError } = await s.from('game_cars_v11').select('id,name,image_path,power').eq('id',carId).eq('active',true).maybeSingle();
  if (carError) throw carError;
  if (!car) throw new Error('active car not found');
  const username = profile.telegram_username ? `@${profile.telegram_username}` : profile.name || query.from.first_name;
  const plate = profile.active_plate?.text ? `\n🔖 ${String(profile.active_plate.text)}` : '';
  const caption = `<b>🏎️ ВЫЗОВ НА 402m</b>\n\n<b>${safeHtml(username)}</b>\n${safeHtml(car.name)} • ${Number(car.power)} л.с.${plate}\n\n⚡ Кто быстрее — тот и хозяин улиц.\nВыбирай соперника и принимай вызов.`;
  const photoUrl = publicCarImageUrl(car.image_path);
  const result = { type:'photo', id:`duel_${query.from.id}_${car.id}`, photo_url:photoUrl, thumbnail_url:photoUrl, photo_width:1024, photo_height:576, title:`Дуэль — ${car.name}`, caption, parse_mode:'HTML', reply_markup:{inline_keyboard:[[{text:'⚡ Принять вызов',callback_data:`duel_inline_accept:${query.from.id}:${car.id}`}],[{text:'🎯 Личный вызов',switch_inline_query_current_chat:'duel '},{text:'🌐 Вызов в чат',switch_inline_query:'duel '}]]} };
  await answerTelegramInlineQuery(query.id, [result], {cacheTime:0,isPersonal:true});
}
function playerIdFromInline(id:number){ return `tg_${id}`; }

function fallbackMarkUpdate(updateId: number) {
  const now = Date.now();
  for (const [id, at] of fallbackUpdates) if (now - at > 10 * 60_000) fallbackUpdates.delete(id);
  if (fallbackUpdates.has(updateId)) return false;
  fallbackUpdates.set(updateId, now);
  return true;
}

async function markUpdate(updateId: number) {
  try {
    const s = createServerSupabase();
    const { error } = await s.from('telegram_updates_v11').insert({ update_id: updateId });
    if (!error) return true;
    if (error.code === '23505') return false;
    const msg = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
    if (msg.includes('does not exist') || msg.includes('schema cache') || ['42P01','PGRST205'].includes(String(error.code))) {
      return fallbackMarkUpdate(updateId);
    }
    throw error;
  } catch (error) {
    console.warn('Telegram update ledger unavailable; using process fallback', error);
    return fallbackMarkUpdate(updateId);
  }
}

async function runCommand(message: TgMessage, command: string, args = '') {
  const s = createServerSupabase();
  const { data, error } = await s.from('bot_commands_v11').select('*').eq('command', command).eq('enabled', true).maybeSingle();
  if (error) {
    const msg = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
    if (msg.includes('does not exist') || msg.includes('schema cache') || ['42P01','PGRST205'].includes(String(error.code))) return false;
    throw error;
  }
  if (!data) return false;
  const env = getServerEnv();
  const miniAppUrl = `https://t.me/${env.TELEGRAM_BOT_USERNAME}/${env.TELEGRAM_APP_SHORT_NAME}`;
  const text = String(data.response_text)
    .replaceAll('{first_name}', message.from?.first_name ?? 'гонщик')
    .replaceAll('{username}', message.from?.username ? `@${message.from.username}` : 'без username')
    .replaceAll('{app_url}', miniAppUrl)
    .replaceAll('{args}', args)
    .replaceAll('{user_id}', String(message.from?.id ?? ''))
    .replaceAll('{chat_id}', String(message.chat.id));
  const keyboard = data.button_label ? [[{ text: String(data.button_label), url: data.button_url || miniAppUrl }]] : undefined;
  await sendTelegramMessage(message.chat.id, text, {
    replyTo: message.message_id,
    parseMode: data.parse_mode === 'MarkdownV2' ? 'MarkdownV2' : data.parse_mode === 'plain' ? undefined : 'HTML',
    keyboard
  });
  return true;
}

async function startReplyDuel(message: TgMessage, target: TgUser) {
  try {
    await enforceRateLimit(`tg_${message.from!.id}`, 'bot-duel-challenge', 4, 60);
    await createChatDuelChallenge(message, target);
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Не удалось создать дуэль.';
    const text = raw.includes('relation') || raw.includes('schema') || raw.includes('duel_rooms')
      ? 'Дуэли временно недоступны. Попробуйте через минуту.'
      : raw;
    await sendTelegramMessage(message.chat.id, `Не удалось создать дуэль: ${text}`, { replyTo: message.message_id });
  }
}

export async function handleTelegramUpdate(update: TgUpdate) {
  const first = await markUpdate(update.update_id);
  if (!first) return { duplicate: true };

  if (update.inline_query) {
    try { await handleInlineQuery(update.inline_query); }
    catch (error) { console.error('inline duel failed', error); try { await answerTelegramInlineQuery(update.inline_query.id, [], {cacheTime:0,isPersonal:true}); } catch {} }
    return { inline_query: true };
  }

  if (update.callback_query?.data) {
    const inlineMatch = update.callback_query.data.match(/^duel_inline_accept:(\d+):(\d+)$/);
    if (inlineMatch) {
      const creatorTelegramId = Number(inlineMatch[1]);
      const creatorCarId = Number(inlineMatch[2]);
      try {
        const created = await createInlineDuelForAcceptor(update.callback_query.from, creatorTelegramId, creatorCarId, update.callback_query.message?.chat.id, update.callback_query.message?.message_id);
        const env = getServerEnv();
        const url = `https://t.me/${env.TELEGRAM_BOT_USERNAME}/${env.TELEGRAM_APP_SHORT_NAME}?startapp=${created.room.public_code}`;
        await answerTelegramCallback(update.callback_query.id, 'Дуэль подтверждена!');
        if (update.callback_query.message) await editTelegramMessage(update.callback_query.message.chat.id, update.callback_query.message.message_id, `<b>🚨 ГОНКА НАЧИНАЕТСЯ! ДУЭЛЬ ПОДТВЕРЖДЕНА! 🚨</b>\n\n🏎️ ${safeHtml(created.room.player_a_name)} (${safeHtml(created.creatorCar.name)} • ${Number(created.creatorCar.power)} л.с.)\n⚡ VS\n🏎️ ${safeHtml(created.room.player_b_name)} (${safeHtml(created.opponentCar.name)} • ${Number(created.opponentCar.power)} л.с.)\n\n🏆 Ставка принята! Отрезок 402m ждёт. Кто окажется на финише, а кто будет глотать пыль? 🔥`, [[{text:'🏁 ВЪЕХАТЬ НА ТРАССУ',url}]]);
      } catch (error) {
        const raw = error instanceof Error ? error.message : '';
        await answerTelegramCallback(update.callback_query.id, raw === 'opponent has no car' ? 'У тебя нет машины в гараже.' : 'Не удалось принять вызов.', true);
        if (update.callback_query.message && raw === 'opponent has no car') {
          const env = getServerEnv(); const appUrl = `https://t.me/${env.TELEGRAM_BOT_USERNAME}/${env.TELEGRAM_APP_SHORT_NAME}`;
          await editTelegramMessage(update.callback_query.message.chat.id, update.callback_query.message.message_id, `<b>⚠️ ${safeHtml(update.callback_query.from.username ? '@'+update.callback_query.from.username : update.callback_query.from.first_name)} принял вызов, но трухнул!</b>\nНу или у него просто нет тачки в гараже... 🤷‍♂️\n\n🏎️ Заходи в Mini App, забирай свой первый авто и покажи, кто тут настоящий хозяин улиц! 👇`, [[{text:'🚗 Забрать тачку и приехать',url:appUrl}]]);
        }
      }
      return { inline_duel_callback: true };
    }
    const handled = await handleDuelCallback(update.callback_query.id, update.callback_query.from, update.callback_query.data, update.callback_query.message);
    if (!handled) await answerTelegramCallback(update.callback_query.id);
    return { callback: true };
  }

  const message = update.message ?? update.edited_message;
  if (!message?.from || message.from.is_bot || !message.text) return { ignored: true };

  const parsed = parseCommand(message.text);
  if (parsed) {
    // /duel works even with Telegram Privacy Mode enabled because commands are delivered to bots.
    if (parsed.command === 'duel') {
      if (!['group','supergroup'].includes(message.chat.type) || !message.reply_to_message?.from) {
        await sendTelegramMessage(message.chat.id, 'Ответьте командой /duel на сообщение игрока, которого хотите вызвать.', { replyTo: message.message_id });
        return { command: 'duel-help' };
      }
      await startReplyDuel(message, message.reply_to_message.from);
      return { command: 'duel' };
    }

    if (parsed.command === 'admin') {
      const env = getServerEnv();
      if (!isAdminTelegramId(message.from.id)) {
        await sendTelegramMessage(message.chat.id, 'У этого Telegram-аккаунта нет доступа к панели управления.', { replyTo: message.message_id });
        return { command: 'admin-denied' };
      }
      await sendTelegramMessage(message.chat.id, '<b>AUTOSYNDICATE CONTROL</b>\n\nПанель управления доступна только администраторам.', { replyTo: message.message_id, parseMode: 'HTML', keyboard: [[{ text: 'Открыть панель', url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?startapp=admin` }]] });
      return { command: 'admin' };
    }
    try {
      const handled = await runCommand(message, parsed.command, parsed.args);
      if (!handled && parsed.command === 'start') {
        const env = getServerEnv();
        await sendTelegramMessage(message.chat.id,
          `<b>AUTOSYNDICATE</b>\n\nУличные дуэли, тюнинг, рынок, кланы и турниры. Открой игру и выбери машину.`,
          { replyTo: message.message_id, parseMode: 'HTML', keyboard: [[{ text: 'Открыть AutoSyndicate', url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}/${env.TELEGRAM_APP_SHORT_NAME}` }]] }
        );
      }
      return { command: parsed.command };
    } catch (error) {
      console.error('Bot command failed', { command: parsed.command, error });
      await sendTelegramMessage(message.chat.id, 'Команда временно недоступна.', { replyTo: message.message_id });
      return { command: 'failed' };
    }
  }

  if (message.reply_to_message?.from && ['group','supergroup'].includes(message.chat.type) && await isDuelTrigger(message.text)) {
    await startReplyDuel(message, message.reply_to_message.from);
    return { duel: true };
  }

  return { ignored: true };
}
