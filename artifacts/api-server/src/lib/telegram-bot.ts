import { logger } from "./logger";
import { db, generatedImagesTable, projectsTable, videoGenerationJobsTable, voiceGenerationsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { startProjectImageGeneration } from "./image-generation/service";
import { getElevenLabsModel } from "./audio-generation/elevenlabs-client";
import { startProjectVoiceGeneration } from "./audio-generation/service";
import { formatScriptForTelegram, generateVideoScript } from "./script-generator";
import { startVideoGeneration } from "./video-pipeline/service";
import { readAudioAsset } from "./audio-design/storage";

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

const lastProjectByChat = new Map<number, number>();

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

async function sendVideo(token: string, chatId: number, buffer: Buffer, caption: string): Promise<void> {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("video", new Blob([new Uint8Array(buffer)], { type: "video/mp4" }), "final_video.mp4");
  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendVideo`, { method: "POST", body: form });
  const data = (await response.json()) as TelegramResponse<unknown>;
  if (!response.ok || !data.ok) throw new Error(data.description ?? `Telegram video upload failed (${response.status})`);
}

async function handleVideoTopic(token: string, chatId: number, topic: string): Promise<void> {
  await sendMessage(token, chatId, "Принял тему. Запускаю полный pipeline: сценарий → изображения → ElevenLabs → музыка → SFX → субтитры → MP4.");
  try {
    const script = await generateVideoScript({
      topic,
      format: "Shorts",
      duration: 60,
      style: "realistic",
      tone: "intriguing",
    });
    const [project] = await db.insert(projectsTable).values({
      title: script.title,
      topic,
      format: "Shorts",
      duration: 60,
      style: "realistic",
      tone: "intriguing",
      scriptJson: script,
      status: "completed",
    }).returning({ id: projectsTable.id });
    lastProjectByChat.set(chatId, project.id);
    const job = await startVideoGeneration(project.id, { format: "9:16", duration: 60, style: "cinematic", tone: "suspense" });
    await sendMessage(token, chatId, `🎬 Pipeline запущен.\nПроект: ${project.id}\nГотово: ${job.progress}%`);
    void monitorVideoJob(token, chatId, project.id, job.id);
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to start Telegram video pipeline");
    await sendMessage(token, chatId, `Не получилось запустить видео pipeline: ${error instanceof Error ? error.message : "unknown error"}`);
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

  if (text === "/images") {
    const projectId = lastProjectByChat.get(chatId);
    if (!projectId) {
      await sendMessage(token, chatId, "Сначала отправьте тему ролика, чтобы создать сценарий.");
      return;
    }
    try {
      const ids = await startProjectImageGeneration(projectId, {
        count: 10,
        aspectRatio: "9:16",
        visualStyle: "cinematic realistic",
        realism: "high",
        people: "optional",
        colorAtmosphere: "natural cinematic",
        consistentCharacter: true,
      });
      await sendMessage(token, chatId, `Генерирую изображения...\nСцен: ${ids.length}\nГотово: 0/${ids.length}`);
      void monitorImageJob(token, chatId, projectId, ids);
    } catch (error) {
      logger.error({ err: error, chatId }, "Failed to start Telegram image generation");
      await sendMessage(token, chatId, "Не удалось запустить генерацию изображений.");
    }
    return;
  }

  if (text === "/voice") {
    const projectId = lastProjectByChat.get(chatId);
    const voiceId = process.env["ELEVENLABS_VOICE_ID"];
    if (!projectId) {
      await sendMessage(token, chatId, "Сначала отправьте тему ролика, чтобы создать сценарий.");
      return;
    }
    if (!process.env["ELEVENLABS_API_KEY"] || !voiceId) {
      await sendMessage(token, chatId, "ElevenLabs не настроен. Добавьте ELEVENLABS_API_KEY и ELEVENLABS_VOICE_ID в Secrets.");
      return;
    }
    try {
      const ids = await startProjectVoiceGeneration(projectId, {
        voiceId,
        modelId: getElevenLabsModel(),
        speed: 1,
        stability: 0.65,
        similarity: 0.75,
        style: 0.15,
        speakerBoost: true,
        tone: "storytelling",
      });
      await sendMessage(token, chatId, `Создаю озвучку ElevenLabs...\nГотово: 0/${ids.length}`);
      void monitorVoiceJob(token, chatId, projectId, ids);
    } catch (error) {
      logger.error({ err: error, chatId }, "Failed to start Telegram voice generation");
      await sendMessage(token, chatId, "Не удалось запустить генерацию озвучки.");
    }
    return;
  }

  if (text === "/video") {
    await sendMessage(token, chatId, "Используйте `/video ваша тема` или отправьте тему обычным сообщением.");
    return;
  }

  if (text.startsWith("/video ")) {
    await handleVideoTopic(token, chatId, text.slice("/video ".length).trim());
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

  await handleVideoTopic(token, chatId, text);
}

async function monitorImageJob(token: string, chatId: number, projectId: number, ids: number[]): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    const rows = await db.select({ status: generatedImagesTable.status })
      .from(generatedImagesTable)
      .where(and(eq(generatedImagesTable.projectId, projectId), inArray(generatedImagesTable.id, ids)));
    const completed = rows.filter((row) => row.status === "completed").length;
    const failed = rows.filter((row) => row.status === "failed").length;
    if (completed + failed === ids.length) {
      await sendMessage(token, chatId, failed ? `Готово: ${completed}/${ids.length}. Ошибок: ${failed}.` : `Все изображения готовы.\nГотово: ${completed}/${ids.length}`);
      return;
    }
    if (attempt % 2 === 0) {
      await sendMessage(token, chatId, `Генерирую изображения...\nГотово: ${completed}/${ids.length}`);
    }
  }
}

async function monitorVoiceJob(token: string, chatId: number, projectId: number, ids: number[]): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    const rows = await db.select({ status: voiceGenerationsTable.status })
      .from(voiceGenerationsTable)
      .where(and(eq(voiceGenerationsTable.projectId, projectId), inArray(voiceGenerationsTable.id, ids)));
    const completed = rows.filter((row) => row.status === "completed").length;
    const failed = rows.filter((row) => row.status === "failed").length;
    if (completed + failed === ids.length) {
      await sendMessage(token, chatId, failed ? `Озвучка завершена: ${completed}/${ids.length}. Ошибок: ${failed}.` : `Озвучка готова.\nГотово: ${completed}/${ids.length}`);
      return;
    }
    if (attempt % 2 === 0) await sendMessage(token, chatId, `Создаю озвучку ElevenLabs...\nГотово: ${completed}/${ids.length}`);
  }
}

async function monitorVideoJob(token: string, chatId: number, projectId: number, jobId: number): Promise<void> {
  for (let attempt = 0; attempt < 360; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    const [job] = await db.select().from(videoGenerationJobsTable).where(eq(videoGenerationJobsTable.id, jobId));
    if (!job) {
      await sendMessage(token, chatId, "Видео job не найден. Pipeline остановлен.");
      return;
    }
    if (job.status === "failed") {
      await sendMessage(token, chatId, `❌ Pipeline остановлен на стадии ${job.currentStage}: ${job.error || "unknown error"}`);
      return;
    }
    if (job.status === "completed" && job.videoStoragePath) {
      await sendVideo(token, chatId, await readAudioAsset(job.videoStoragePath), "✅ Видео готово. Ниже финальный MP4.");
      return;
    }
    if (attempt % 2 === 0) await sendMessage(token, chatId, `🎬 Создание видео: ${job.currentStage} · ${job.progress}%`);
  }
  await sendMessage(token, chatId, `Pipeline проекта ${projectId} превысил лимит ожидания. Можно повторить render через web.`);
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