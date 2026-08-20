import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';
import type { TgMessage, TgUpdate } from './types';
import { answerTelegramCallback, sendTelegramMessage } from './telegram';
import { createChatDuelChallenge, handleDuelCallback } from '@/features/duels/server';
import { isAdminTelegramId } from '@/features/admin/auth';
import { enforceRateLimit } from '@/lib/security/rate-limit';

function normalizeText(value: string) {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^a-zа-я0-9_/@\s-]+/giu, ' ').replace(/\s+/g, ' ').trim();
}

function parseCommand(text: string) {
  const match = text.trim().match(/^\/([a-zA-Z0-9_]{1,32})(?:@[A-Za-z0-9_]{5,64})?(?:\s+([\s\S]*))?$/);
  return match ? { command: match[1].toLowerCase(), args: (match[2] ?? '').trim() } : null;
}

async function isDuelTrigger(text: string) {
  const normalized = normalizeText(text);
  const s = createServerSupabase();
  const { data, error } = await s.from('game_settings_v11').select('value').eq('key', 'bot.duel_words').maybeSingle();
  if (error) throw error;
  const words = Array.isArray(data?.value) ? data.value.filter((value: unknown): value is string => typeof value === 'string').map((value: string) => normalizeText(value)).filter(Boolean) : [];
  return words.some((word: string) => normalized === word || normalized.split(' ').includes(word));
}

async function markUpdate(updateId: number) {
  const s = createServerSupabase();
  const { error } = await s.from('telegram_updates_v11').insert({ update_id: updateId });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

async function runCommand(message: TgMessage, command: string, args = '') {
  const s = createServerSupabase();
  const { data, error } = await s.from('bot_commands_v11').select('*').eq('command', command).eq('enabled', true).maybeSingle();
  if (error) throw error;
  if (!data) return false;
  const env = getServerEnv();
  const miniAppUrl = `https://t.me/${env.TELEGRAM_BOT_USERNAME}?startapp`;
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

export async function handleTelegramUpdate(update: TgUpdate) {
  const first = await markUpdate(update.update_id);
  if (!first) return { duplicate: true };

  if (update.callback_query?.data) {
    const handled = await handleDuelCallback(update.callback_query.id, update.callback_query.from, update.callback_query.data, update.callback_query.message);
    if (!handled) await answerTelegramCallback(update.callback_query.id);
    return { callback: true };
  }

  const message = update.message;
  if (!message?.from || message.from.is_bot || !message.text) return { ignored: true };

  const parsed = parseCommand(message.text);
  if (parsed) {
    if (parsed.command === 'admin') {
      const env = getServerEnv();
      if (!isAdminTelegramId(message.from.id)) {
        await sendTelegramMessage(message.chat.id, 'У этого Telegram-аккаунта нет доступа к панели управления.', { replyTo: message.message_id });
        return { command: 'admin-denied' };
      }
      await sendTelegramMessage(message.chat.id, '<b>AUTOSYNDICATE CONTROL</b>\n\nПанель управления доступна только администраторам из ADMIN_TELEGRAM_IDS.', { replyTo: message.message_id, parseMode: 'HTML', keyboard: [[{ text: 'Открыть Control Center', url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?startapp=admin` }]] });
      return { command: 'admin' };
    }
    const handled = await runCommand(message, parsed.command, parsed.args);
    if (!handled && parsed.command === 'start') {
      const env = getServerEnv();
      await sendTelegramMessage(message.chat.id,
        `<b>AUTOSYNDICATE</b>\n\nУличные дуэли, тюнинг, рынок, кланы и турниры. Открой игру и выбери машину.`,
        { replyTo: message.message_id, parseMode: 'HTML', keyboard: [[{ text: 'Открыть AutoSyndicate', url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?startapp` }]] }
      );
    }
    return { command: parsed.command };
  }

  if (message.reply_to_message?.from && ['group','supergroup'].includes(message.chat.type) && await isDuelTrigger(message.text)) {
    try {
      await enforceRateLimit(`tg_${message.from.id}`, 'bot-duel-challenge', 4, 60);
      await createChatDuelChallenge(message, message.reply_to_message.from);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Не удалось создать дуэль.';
      await sendTelegramMessage(message.chat.id, `Не удалось создать дуэль: ${text}`, { replyTo: message.message_id });
    }
    return { duel: true };
  }

  return { ignored: true };
}
