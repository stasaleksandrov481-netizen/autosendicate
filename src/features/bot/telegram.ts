import 'server-only';
import { getServerEnv } from '@/lib/env';

interface InlineButton { text: string; callback_data?: string; url?: string; }

async function telegramCall<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = getServerEnv().TELEGRAM_BOT_TOKEN;
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store'
  });
  const json = await response.json() as { ok: boolean; result?: T; description?: string };
  if (!response.ok || !json.ok) throw new Error(json.description ?? `Telegram ${method} failed`);
  return json.result as T;
}

export function sendTelegramMessage(chatId: number, text: string, options?: { replyTo?: number; parseMode?: 'HTML'|'MarkdownV2'; keyboard?: InlineButton[][] }) {
  return telegramCall('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: options?.parseMode,
    reply_parameters: options?.replyTo ? { message_id: options.replyTo, allow_sending_without_reply: true } : undefined,
    reply_markup: options?.keyboard ? { inline_keyboard: options.keyboard } : undefined,
    disable_web_page_preview: true
  });
}

export function editTelegramMessage(chatId: number, messageId: number, text: string, keyboard?: InlineButton[][]) {
  return telegramCall('editMessageText', {
    chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML',
    reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
    disable_web_page_preview: true
  });
}

export function answerTelegramCallback(callbackQueryId: string, text?: string, showAlert = false) {
  return telegramCall('answerCallbackQuery', { callback_query_id: callbackQueryId, text, show_alert: showAlert });
}

export function setTelegramWebhook() {
  const env = getServerEnv();
  return telegramCall('setWebhook', {
    url: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/api/telegram/webhook`,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message','callback_query'],
    drop_pending_updates: false,
    max_connections: 40
  });
}
