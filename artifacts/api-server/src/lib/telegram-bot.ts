import { logger } from "./logger";
import { formatScriptForTelegram, generateVideoScript } from "./script-generator";

const TELEGRAM_API = "https://api.telegram.org";
const POLL_TIMEOUT_SECONDS = 30;
const RETRY_DELAY_MS = 5_000;
const MAX_MESSAGE_LENGTH = 4_096;

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
  };
};

type TelegramMessage = {
  message_id: number;
};

async function telegramRequest<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as TelegramResponse<T>;

  if (!response.ok || !data.ok || data.result === undefined) {
    throw new Error(data.description ?? `Telegram request failed (${response.status})`);
  }

  return data.result;
}

async function sendMessage(token: string, chatId: number, text: string): Promise<void> {
  for (let start = 0; start < text.length; start += MAX_MESSAGE_LENGTH) {
    await telegramRequest<TelegramMessage>(token, "sendMessage", {
      chat_id: chatId,
      text: text.slice(start, start + MAX_MESSAGE_LENGTH),
    });
  }
}

async function handleUpdate(token: string, update: TelegramUpdate): Promise<void> {
  const text = update.message?.text?.trim();
  const chatId = update.message?.chat.id;
  if (!text || chatId === undefined) return;

  if (text === "/start") {
    await sendMessage(
      token,
      chatId,
      [
        "Привет! Я AI-сценарист коротких вертикальных видео.",
        "",
        "Отправьте мне тему будущего ролика обычным текстовым сообщением, и я подготовлю готовый сценарий для Shorts, Reels или TikTok.",
      ].join("\n"),
    );
    return;
  }

  if (text.startsWith("/")) {
    await sendMessage(
      token,
      chatId,
      "Сейчас я умею создавать сценарии. Отправьте тему будущего ролика обычным текстовым сообщением.",
    );
    return;
  }

  await sendMessage(token, chatId, "Принял тему. Генерирую сценарий — это займёт немного времени.");

  try {
    const script = await generateVideoScript({
      topic: text,
      format: "Shorts",
      duration: 60,
      style: "realistic",
      tone: "intriguing",
    });
    await sendMessage(token, chatId, formatScriptForTelegram(script));
  } catch (error) {
    logger.error({ err: error }, "Failed to generate Telegram video script");
    await sendMessage(
      token,
      chatId,
      "Не получилось создать сценарий. Попробуйте ещё раз через несколько секунд.",
    );
  }
}

export async function startTelegramBot(): Promise<void> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN is not configured; Telegram bot is disabled");
    return;
  }

  try {
    await telegramRequest(token, "deleteWebhook", { drop_pending_updates: false });
    const bot = await telegramRequest<{ username?: string }>(token, "getMe");
    logger.info({ username: bot.username }, "Telegram bot connected");
  } catch (error) {
    logger.error({ err: error }, "Telegram bot startup failed");
    return;
  }

  let offset = 0;
  while (true) {
    try {
      const updates = await telegramRequest<TelegramUpdate[]>(token, "getUpdates", {
        offset,
        timeout: POLL_TIMEOUT_SECONDS,
        allowed_updates: ["message"],
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(token, update);
      }
    } catch (error) {
      logger.error({ err: error }, "Telegram polling failed; retrying");
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}