import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';
import type { TgMessage, TgUpdate, TgUser, TgInlineQuery, TgCallbackQuery } from './types';
import { answerTelegramCallback, answerTelegramInlineQuery, sendTelegramMessage, editTelegramMessage, editTelegramInlineMessage, type TelegramInlinePhotoResult } from './telegram';
import { createChatDuelChallenge, createInlineDuelForAcceptor, getOwnedCarsForTelegramUser, handleDuelCallback, safeHtml } from '@/features/duels/server';
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



function cleanInlineUsername(value: string | undefined) {
  return String(value || '').replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 32);
}

function parseInlineTarget(raw: string) {
  const match = String(raw || '').trim().match(/(?:^|\s)@([A-Za-z0-9_]{5,32})(?:\s|$)/);
  return match ? cleanInlineUsername(match[1]) : '';
}

async function editInlineCallbackMessage(callback: TgCallbackQuery, text: string, keyboard?: Array<Array<{ text: string; callback_data?: string; url?: string }>>) {
  if (callback.inline_message_id) return editTelegramInlineMessage(callback.inline_message_id, text, keyboard);
  if (callback.message) return editTelegramMessage(callback.message.chat.id, callback.message.message_id, text, keyboard);
  return null;
}

async function handleInlineQuery(query: TgInlineQuery) {
  const s = createServerSupabase();
  const playerId = playerIdFromInline(query.from.id);
  const { data: profile, error } = await s.from('player_profiles').select('id,name,telegram_username,active_car_id,owned_cars,active_plate,car_visuals,banned_at').eq('id', playerId).maybeSingle();
  if (error) throw error;
  const env = getServerEnv();
  const appUrl = `https://t.me/${env.TELEGRAM_BOT_USERNAME}/${env.TELEGRAM_APP_SHORT_NAME}`;
  const targetUsername = parseInlineTarget(query.query);

  if (!profile || profile.banned_at) {
    await answerTelegramInlineQuery(query.id, [{ type:'article', id:'no-profile', title:'Сначала открой AutoSyndicate', description:'Нужен профиль и машина для отправки вызова.', input_message_content:{message_text:'🏎️ Сначала открой AutoSyndicate и выбери машину для дуэли.'}, reply_markup:{inline_keyboard:[[{text:'🚗 Открыть Mini App',url:appUrl}]]} }], {cacheTime:0,isPersonal:true});
    return;
  }

  const owned = Array.isArray(profile.owned_cars) ? profile.owned_cars : [];
  if (!owned.length) {
    await answerTelegramInlineQuery(query.id, [{ type:'article', id:'no-car', title:'Нет машины в гараже', description:'Купи первую машину перед созданием вызова.', input_message_content:{message_text:'🚗 Сначала нужна машина в AutoSyndicate.'}, reply_markup:{inline_keyboard:[[{text:'🚗 Открыть гараж',url:appUrl}]]} }], {cacheTime:0,isPersonal:true});
    return;
  }

  if (!targetUsername) {
    await answerTelegramInlineQuery(query.id, [{
      type:'article', id:'inline-help', title:'Укажи соперника: @username',
      description:`Формат: @${env.TELEGRAM_BOT_USERNAME} @username_соперника`,
      input_message_content:{message_text:`🏁 Чтобы вызвать игрока, напиши в чате: @${env.TELEGRAM_BOT_USERNAME} @username_соперника`},
      reply_markup:{inline_keyboard:[[{text:'Выбрать соперника',switch_inline_query_current_chat:'@'}]]}
    }], {cacheTime:0,isPersonal:true});
    return;
  }

  const myUsername = cleanInlineUsername(profile.telegram_username || query.from.username).toLowerCase();
  if (myUsername && myUsername === targetUsername.toLowerCase()) {
    await answerTelegramInlineQuery(query.id, [{ type:'article', id:'self-target', title:'Нельзя вызвать самого себя', description:'Укажи username другого игрока.', input_message_content:{message_text:'🏁 Для дуэли нужен другой соперник.'} }], {cacheTime:0,isPersonal:true});
    return;
  }

  const { data: targetProfile, error: targetError } = await s.from('player_profiles').select('id,name,telegram_username,owned_cars,banned_at').ilike('telegram_username', targetUsername).maybeSingle();
  if (targetError) throw targetError;
  if (targetProfile?.banned_at) {
    await answerTelegramInlineQuery(query.id, [{ type:'article', id:'target-banned', title:'Соперник недоступен', description:`@${targetUsername} сейчас не может принимать дуэли.`, input_message_content:{message_text:`🏁 @${targetUsername} сейчас недоступен для дуэли.`} }], {cacheTime:0,isPersonal:true});
    return;
  }

  const { data: cars, error: carsError } = await s.from('game_cars_v11').select('id,name,image_path,power,tier,category,flavor').in('id', owned).eq('active', true).order('power', { ascending: false });
  if (carsError) throw carsError;
  if (!cars?.length) {
    await answerTelegramInlineQuery(query.id, [{ type:'article', id:'no-active-car', title:'Машины недоступны', description:'Проверь гараж в Mini App.', input_message_content:{message_text:'🚗 Машины в гараже сейчас недоступны.'}, reply_markup:{inline_keyboard:[[{text:'Открыть AutoSyndicate',url:appUrl}]]} }], {cacheTime:0,isPersonal:true});
    return;
  }

  const challenger = profile.telegram_username ? `@${profile.telegram_username}` : profile.name || query.from.first_name;
  const plate = profile.active_plate?.text ? `\n🔖 ${safeHtml(String(profile.active_plate.text))}` : '';
  const activeCarId = Number(profile.active_car_id) || Number(owned[0]);
  const targetHasCar = Boolean(targetProfile && Array.isArray(targetProfile.owned_cars) && targetProfile.owned_cars.length);
  const targetState = targetProfile ? (targetHasCar ? 'готов выбрать машину' : 'пока без авто') : 'ещё не заходил в игру';

  // Telegram's inline-results list is the car selector: one rendered visual per owned car.
  const publicBase=env.NEXT_PUBLIC_APP_URL.replace(/\/$/,'');
  const results:TelegramInlinePhotoResult[] = cars.slice(0, 20).map((car: any) => {
    const caption = `<b>🏁 AUTOSYNDICATE · ДУЭЛЬ</b>\n\n<b>${safeHtml(challenger)}</b> вызывает <b>@${safeHtml(targetUsername)}</b>\n\n🚗 <b>${safeHtml(car.name)}</b>\n⚙️ ${Number(car.power)} л.с.${car.tier ? ` · ${safeHtml(String(car.tier))}` : ''}${plate}\n\nСоперник: ${safeHtml(targetState)}.\nНажать «Принять дуэль» может только @${safeHtml(targetUsername)}.`;
    const image=`${publicBase}/api/car-visual/${encodeURIComponent(profile.id)}?carId=${Number(car.id)}`;
    return {
      type:'photo', id:`duel_${query.from.id}_${car.id}_${targetUsername}`,photo_url:image,thumbnail_url:image,
      title:`${car.id === activeCarId ? '✓ ' : ''}${car.name}`,
      description:`${Number(car.power)} л.с. • вызов @${targetUsername}`,caption,parse_mode:'HTML',
      reply_markup:{inline_keyboard:[[{text:'🏁 Принять дуэль',callback_data:`di:a:${query.from.id}:${car.id}:${targetUsername}`}]]}
    };
  });
  await answerTelegramInlineQuery(query.id, results, {cacheTime:0,isPersonal:true});
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
    catch (error) {
      console.error('inline duel failed', error);
      const message = error instanceof Error ? error.message : 'unknown error';
      try {
        await answerTelegramInlineQuery(update.inline_query.id, [{
          type: 'article', id: 'debug-error', title: '⚠️ Ошибка инлайна (временно)',
          description: message.slice(0, 200),
          input_message_content: { message_text: `Отладка: ${message.slice(0, 300)}` }
        }], {cacheTime:0,isPersonal:true});
      } catch {}
    }
    return { inline_query: true };
  }

  if (update.callback_query?.data) {
    const inlineMatch = update.callback_query.data.match(/^di:a:(\d+):(\d+):([A-Za-z0-9_]{5,32})$/);
    if (inlineMatch) {
      const creatorTelegramId = Number(inlineMatch[1]);
      const creatorCarId = Number(inlineMatch[2]);
      const targetUsername = inlineMatch[3];
      const actorUsername = cleanInlineUsername(update.callback_query.from.username);
      const env = getServerEnv();
      const appUrl = `https://t.me/${env.TELEGRAM_BOT_USERNAME}/${env.TELEGRAM_APP_SHORT_NAME}`;
      try {
        if (update.callback_query.from.id === creatorTelegramId) {
          await answerTelegramCallback(update.callback_query.id, 'Нельзя принять собственный вызов.', true);
          return { inline_duel_self: true };
        }
        if (!actorUsername || actorUsername.toLowerCase() !== targetUsername.toLowerCase()) {
          await answerTelegramCallback(update.callback_query.id, `Этот вызов адресован @${targetUsername}.`, true);
          return { inline_duel_wrong_target: true };
        }

        const cars = await getOwnedCarsForTelegramUser(update.callback_query.from.id);
        if (!cars.length) {
          await answerTelegramCallback(update.callback_query.id, 'Сначала нужна машина в гараже.', true);
          await editInlineCallbackMessage(
            update.callback_query,
            `<b>@${safeHtml(targetUsername)}, у вас нет авто!</b>\n\nПерейдите в бота, чтобы купить первую машину и принять вызов.`,
            [[{text:'🚗 Открыть AutoSyndicate',url:appUrl}]]
          );
          return { inline_duel_no_car: true };
        }

        await answerTelegramCallback(update.callback_query.id, 'Выбери машину для дуэли.');
        {
          const rows = cars.slice(0, 16).map((car: any) => [{
            text: `${car.name} • ${Number(car.power)} л.с.`,
            callback_data: `di:p:${creatorTelegramId}:${creatorCarId}:${update.callback_query!.from.id}:${car.id}`
          }]);
          rows.push([{ text:'Отмена', callback_data:`di:x:${update.callback_query.from.id}` }]);
          await editInlineCallbackMessage(
            update.callback_query,
            `<b>🚗 @${safeHtml(targetUsername)}, выбери машину</b>\n\nПосле выбора будет создана приватная Race Room для двух игроков.`,
            rows
          );
        }
      } catch (error) {
        console.error('inline duel accept failed', error);
        await answerTelegramCallback(update.callback_query.id, 'Не удалось принять вызов.', true);
      }
      return { inline_duel_carpick: true };
    }

    const cancelMatch = update.callback_query.data.match(/^di:x:(\d+)$/);
    if (cancelMatch) {
      if (Number(cancelMatch[1]) !== update.callback_query.from.id) {
        await answerTelegramCallback(update.callback_query.id, 'Эта кнопка не для вас.', true);
        return { inline_duel_cancel_wrong_user: true };
      }
      await answerTelegramCallback(update.callback_query.id, 'Выбор отменён.');
      await editInlineCallbackMessage(update.callback_query, '<b>Дуэль отменена соперником.</b>');
      return { inline_duel_cancelled: true };
    }

    const pickMatch = update.callback_query.data.match(/^di:p:(\d+):(\d+):(\d+):(\d+)$/);
    if (pickMatch) {
      const creatorTelegramId = Number(pickMatch[1]);
      const creatorCarId = Number(pickMatch[2]);
      const expectedOpponentId = Number(pickMatch[3]);
      const chosenCarId = Number(pickMatch[4]);
      try {
        if (expectedOpponentId !== update.callback_query.from.id) {
          await answerTelegramCallback(update.callback_query.id, 'Эта машина выбирается другим игроком.', true);
          return { inline_duel_pick_wrong_user: true };
        }
        const created = await createInlineDuelForAcceptor(update.callback_query.from, creatorTelegramId, creatorCarId, chosenCarId, update.callback_query.message?.chat.id, update.callback_query.message?.message_id, update.callback_query.from.username);
        const env = getServerEnv();
        const url = `https://t.me/${env.TELEGRAM_BOT_USERNAME}/${env.TELEGRAM_APP_SHORT_NAME}?startapp=duel_${created.room.public_code}`;
        await answerTelegramCallback(update.callback_query.id, 'Race Room создана!');
        await editInlineCallbackMessage(
          update.callback_query,
          `<b>🏁 AUTOSYNDICATE · RACE ROOM</b>\n\n🚗 <b>${safeHtml(created.room.player_a_name)}</b>\n${safeHtml(created.creatorCar.name)} · ${Number(created.creatorCar.power)} л.с.\n\n<b>VS</b>\n\n🚗 <b>${safeHtml(created.room.player_b_name)}</b>\n${safeHtml(created.opponentCar.name)} · ${Number(created.opponentCar.power)} л.с.\n\nОба игрока открывают одну комнату, подтверждают готовность и видят прогресс соперника прямо во время заезда.`,
          [[{text:'🏁 ОТКРЫТЬ RACE ROOM',url}]]
        );
      } catch (error) {
        const raw = error instanceof Error ? error.message : '';
        console.error('inline duel pick failed', error);
        await answerTelegramCallback(update.callback_query.id, raw === 'opponent car unavailable' ? 'Эта машина недоступна.' : 'Не удалось создать Race Room.', true);
      }
      return { inline_duel_pick: true };
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
      await sendTelegramMessage(message.chat.id, '<b>AUTOSYNDICATE CONTROL</b>\n\nПанель управления доступна только администраторам.', { replyTo: message.message_id, parseMode: 'HTML', keyboard: [[{ text: 'Открыть панель', url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}/${env.TELEGRAM_APP_SHORT_NAME}?startapp=admin` }]] });
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
