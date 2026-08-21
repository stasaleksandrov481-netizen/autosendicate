import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';
import type { TgMessage, TgUpdate, TgUser } from './types';
import { answerTelegramCallback, answerTelegramInlineQuery, sendTelegramMessage, editTelegramMessage } from './telegram';
import { createChatDuelChallenge, handleDuelCallback, safeHtml } from '@/features/duels/server';
import { handleInlineDuelCallback, handleInlineDuelQuery, handleStreetDuelsCallback, sendStreetDuelsMenu } from '@/features/duels/inline';
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
    .replaceAll('\\n', '\n')
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

async function getPrivateCarSelection(telegramId: number) {
  const s = createServerSupabase();
  const { data: profile, error } = await s.from('player_profiles').select('owned_cars,banned_at').eq('id', `tg_${telegramId}`).maybeSingle();
  if (error) throw error;
  if (!profile || profile.banned_at || !Array.isArray(profile.owned_cars) || !profile.owned_cars.length) return [];
  const { data: cars, error: carsError } = await s.from('game_cars_v11').select('id,name,power').in('id', profile.owned_cars).eq('active', true).order('power', { ascending: false });
  if (carsError) throw carsError;
  return cars ?? [];
}

async function handlePrivateCarSelectionCallback(callbackId: string, actor: TgUser, data: string) {
  const match = data.match(/^garage_select:(\d+)$/);
  if (!match) return false;
  const carId = Number(match[1]);
  const s = createServerSupabase();
  const { data: profile, error } = await s.from('player_profiles').select('id,owned_cars').eq('id', `tg_${actor.id}`).maybeSingle();
  if (error) throw error;
  const owned = Array.isArray(profile?.owned_cars) ? profile.owned_cars.map(Number) : [];
  if (!profile || !owned.includes(carId)) {
    await answerTelegramCallback(callbackId, 'Этой машины нет в твоём гараже.', true);
    return true;
  }
  const { data: car, error: carError } = await s.from('game_cars_v11').select('id,name,power').eq('id', carId).eq('active', true).maybeSingle();
  if (carError) throw carError;
  if (!car) {
    await answerTelegramCallback(callbackId, 'Машина недоступна.', true);
    return true;
  }
  const { error: updateError } = await s.from('player_profiles').update({ active_car_id: carId, current_car_name: car.name, last_seen: new Date().toISOString() }).eq('id', profile.id);
  if (updateError) throw updateError;
  await answerTelegramCallback(callbackId, 'Машина выбрана 🏁');
  if (actor.username) {
    // Номер уже хранится в active_plate и не меняется при выборе машины.
  }
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
    try { await handleInlineDuelQuery(update.inline_query); }
    catch (error) {
      console.error('inline duel failed', error);
      try {
        await answerTelegramInlineQuery(update.inline_query.id, [{
          type: 'article',
          id: `inline_error_${update.inline_query.id}`,
          title: '⚠️ Не удалось загрузить вызов',
          description: 'Попробуйте ещё раз',
          input_message_content: { message_text: '⚠️ Не удалось загрузить список машин. Попробуйте ещё раз.' }
        }], { cacheTime: 0, isPersonal: true });
      } catch {}
    }
    return { inline_query: true };
  }

  if (update.callback_query?.data) {
    if (update.callback_query.data.startsWith('street_duels:')) {
      try { await handleStreetDuelsCallback(update.callback_query.id, update.callback_query.from, update.callback_query.data); }
      catch (error) { console.error('street duels filter failed', error); await answerTelegramCallback(update.callback_query.id, 'Меню дуэлей временно недоступно.', true); }
      return { street_duels: true };
    }
    if (update.callback_query.data.startsWith('garage_select:')) {
      try { await handlePrivateCarSelectionCallback(update.callback_query.id, update.callback_query.from, update.callback_query.data); }
      catch (error) { console.error('garage select failed', error); await answerTelegramCallback(update.callback_query.id, 'Не удалось выбрать машину.', true); }
      return { garage_select: true };
    }
    if (update.callback_query.data.startsWith('duel_inline_accept:') || update.callback_query.data.startsWith('duel_inline_decline:')) {
      try {
        const handled = await handleInlineDuelCallback(update.callback_query.id, update.callback_query.from, update.callback_query.data, update.callback_query.message, update.callback_query.inline_message_id);
        if (handled) return { inline_duel: true };
      } catch (error) {
        console.error('inline duel callback failed', error);
        await answerTelegramCallback(update.callback_query.id, 'Дуэль временно недоступна.', true);
      }
      return { inline_duel: true };
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

    if (parsed.command === 'duels' || parsed.command === 'streetduels') {
      try { await sendStreetDuelsMenu(message.from.id); }
      catch (error) { console.error('street duels menu failed', error); await sendTelegramMessage(message.chat.id, '🏁 Меню уличных дуэлей временно недоступно.', { replyTo: message.message_id }); }
      return { command: 'duels' };
    }

    if (parsed.command === 'admin') {
      const env = getServerEnv();
      if (!isAdminTelegramId(message.from.id)) {
        await sendTelegramMessage(message.chat.id, 'У этого Telegram-аккаунта нет доступа к панели управления.', { replyTo: message.message_id });
        return { command: 'admin-denied' };
      }
      await sendTelegramMessage(message.chat.id, '<b>AUTOSYNDICATE CONTROL</b>\n\nПанель управления доступна только администраторам.', { replyTo: message.message_id, parseMode: 'HTML', keyboard: [[{ text: 'Открыть панель', url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}/${env.TELEGRAM_APP_SHORT_NAME}?startapp=admin` }]] });
      return { command: 'admin' };
    }
    try {
      if (parsed.command === 'start' && parsed.args.startsWith('duel_')) {
        const target = parsed.args.slice(5).replace(/^@/, '').trim();
        if (/^[A-Za-z0-9_]{1,32}$/.test(target)) {
          await sendTelegramMessage(message.chat.id, `🏁 Соперник: <b>@${safeHtml(target)}</b>\n\nНажми кнопку — откроется выбор твоей машины прямо в личке.`, { replyTo: message.message_id, parseMode: 'HTML', keyboard: [[{ text: '🏎️ Выбрать машину и вызвать', switch_inline_query_current_chat: `@${target}` }]] });
          return { command: 'start-duel-target' };
        }
      }
      if (parsed.command === 'start' && parsed.args === 'select_car') {
        const cars = await getPrivateCarSelection(message.from.id);
        if (!cars.length) {
          await sendTelegramMessage(message.chat.id, '🚗 В гараже пока нет машины. Сначала забери первый автомобиль в AutoSendicate.', { replyTo: message.message_id });
          return { command: 'start-select-car-empty' };
        }
        const rows = cars.slice(0, 20).map((car: any) => [{
          text: `🏎️ ${car.name} • ${Number(car.power)} л.с.`,
          callback_data: `garage_select:${car.id}`
        }]);
        await sendTelegramMessage(message.chat.id, '<b>🚗 ВЫБЕРИ МАШИНУ ДЛЯ ГОНКИ</b>\n\nВыбранный автомобиль будет закреплён за тобой.', { replyTo: message.message_id, parseMode: 'HTML', keyboard: rows });
        return { command: 'start-select-car' };
      }
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
