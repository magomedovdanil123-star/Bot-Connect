import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "./logger";
import {
  db,
  ctaProfilesTable,
  generatedImagesTable,
  projectsTable,
  seriesEpisodesTable,
  seriesTable,
  seasonsTable,
  telegramChatPreferencesTable,
  chatVideoBatchesTable,
  chatVideoBatchItemsTable,
  chatDayBatchesTable,
  chatDayBatchItemsTable,
  storyBatchesTable,
  storyBatchItemsTable,
  storyChannelVisualsTable,
  storyAutomationsTable,
  youtubeConnectionsTable,
  videoGenerationJobsTable,
  voiceGenerationsTable,
  instagramConnectionsTable,
} from "@workspace/db";
import { eq, and, desc, inArray, isNull, isNotNull } from "drizzle-orm";
import { generateStandaloneImage, startProjectImageGeneration, storeUploadedImage } from "./image-generation/service";
import {
  ElevenLabsNotConfiguredError,
  getElevenLabsModel,
  getSpeechProvider,
  getConfiguredVoiceId,
  listElevenLabsVoices,
} from "./audio-generation/elevenlabs-client";
import { startProjectVoiceGeneration } from "./audio-generation/service";
import { CHAT_INTRO_DURATION_SECONDS } from "./video-pipeline/chat-renderer";
import {
  estimateSpokenDurationSeconds,
  formatScriptForTelegram,
  generateVideoScript,
  generateYoutubeMetadataVariants,
  MAX_SCRIPT_DURATION_SECONDS,
  shortenAuthorScriptToLimit,
  videoScriptSchema,
  type VideoScript,
} from "./script-generator";
import { extractSeriesDirectives, formatSeriesConcept, generateSeriesConcept, type SeriesConcept } from "./series-generator";
import { rebuildVideoWithExistingAssets, resumeInterruptedVideoJobs, retryVideoGeneration, startVideoGeneration } from "./video-pipeline/service";
import { readAudioAsset, storeAudioAsset } from "./audio-design/storage";
import { saveSeriesMemory, saveSeriesSnapshot } from "./supabase";
import { createLargeVideoUploadToken, uploadBaseUrl } from "./large-video-upload";
import { adaptVideoAsset, createVideoEditAsset, type VideoEditOptions } from "./video-adaptation";
import { addReactionImageOverlay, addReactionOverlay } from "./video-reaction";
import { createVideoCuts, type VideoCut } from "./video-cutter";
import { analyzeAdBrief, type AdPlan } from "./ad-constructor";
import { openRouterConfig } from "./openrouter-config";
import {
  createYoutubeThumbnail,
  createYoutubeAuthorizationUrl,
  generateYoutubeMetadata,
  postYoutubeComment,
  listYoutubeConnections,
  listYoutubeVideosPublishedSince,
  syncYoutubeChannels,
  uploadYoutubeShort,
  youtubeConnectionStatus,
  ensureYoutubeBrandMarkers,
  type YoutubeMetadata,
} from "./youtube";
import {
  buildChannelMetadataVariant,
  createYoutubeChannelVariant,
} from "./youtube-channel-variant";
import {
  createInstagramAuthorizationUrl,
  listInstagramConnections,
} from "./instagram";

const TELEGRAM_API = "https://api.telegram.org";
const POLL_TIMEOUT_SECONDS = 30;
const RETRY_DELAY_MS = 5_000;
const MAX_MESSAGE_LENGTH = 4_096;
const MAX_SCRIPT_INSTRUCTIONS = 2_000;
const VOICES_PER_PAGE = 6;
const TELEGRAM_DOWNLOAD_LIMIT_BYTES = 20 * 1024 * 1024;
const CHAT_MIN_DURATION_SECONDS = 30;
const CHAT_MAX_DURATION_SECONDS = 120;
const CHAT_CUSTOM_SCRIPT_MAX_CHARS = 20_000;
const STORY_CUSTOM_SCRIPT_MAX_CHARS = 20_000;
const STORY_DURATION_SECONDS = 60;
// Story variants use one channel-specific image for the whole script.
// The scripts stay unique per channel, while image generation remains fast and predictable.
const STORY_VISUAL_POOL_SIZE = 1;
const STORY_AUTOMATION_INTERVAL_MINUTES = 120;
const STORY_AUTOMATION_TICK_MS = 60_000;
const TELEGRAM_PROGRESS_DELAY_MS = 700;
const TELEGRAM_PROGRESS_INTERVAL_MS = 4_000;
const DEFAULT_RECRUITMENT_CTA = "Больше подробностей — в профиле канала.";
const WORKSPACE_ROOT = existsSync(join(process.cwd(), "attached_assets"))
  ? process.cwd()
  : join(process.cwd(), "..", "..");
const DEFAULT_STORY_BACKGROUND_PATH = join(
  WORKSPACE_ROOT,
  "attached_assets/generated_images/channel-proposals/11-trend-story.png",
);
const DEFAULT_NOX_BANNER_PATH = join(WORKSPACE_ROOT, "attached_assets", "NOX_2_1789450329119.mp4");
let cachedDefaultVideoCutBanner: PendingVideoCutBanner | null | undefined;
let telegramProgressToken: string | undefined;
const REACTION_IMAGE_TEMPLATES = {
  "photo-male": {
    name: "Фото: парень",
    path: join(WORKSPACE_ROOT, "attached_assets/generated_images/facecam-male-streamer.png"),
  },
  "photo-two-male": {
    name: "Фото: два парня",
    path: join(WORKSPACE_ROOT, "attached_assets/generated_images/facecam-two-male-creators.png"),
  },
} as const;

const STYLE_PRESETS = {
  cinematic_realism: {
    label: "Киношный реализм",
    style: "cinematic realistic",
    tone: "suspense",
    description: "натуральные лица, кинематографичный свет",
  },
  dark_thriller: {
    label: "Тёмный триллер",
    style: "dark cinematic thriller",
    tone: "suspense",
    description: "ночные сцены, холодные цвета, тревожная атмосфера",
  },
  comedy: {
    label: "Комедийный ролик",
    style: "bright comedic",
    tone: "funny",
    description: "яркие цвета, быстрый темп, ироничная подача",
  },
  documentary: {
    label: "Документальный",
    style: "documentary realistic",
    tone: "educational",
    description: "реалистичная подача, спокойный рассказ, факты",
  },
  anime: {
    label: "Аниме",
    style: "anime cinematic",
    tone: "emotional",
    description: "рисованные персонажи, выразительные эмоции",
  },
  cyberpunk: {
    label: "Неон / киберпанк",
    style: "neon cyberpunk",
    tone: "suspense",
    description: "ночной город, неон, футуристичные детали",
  },
} as const;

const PLATFORM_PRESETS = {
  tiktok: {
    label: "TikTok",
    format: "TikTok",
    description: "быстрый hook, короткие фразы, динамичный CTA",
  },
  instagram_reels: {
    label: "Instagram Reels",
    format: "Instagram Reels",
    description: "визуальный hook, короткий caption-friendly финал",
  },
  youtube_shorts: {
    label: "YouTube Shorts",
    format: "YouTube Shorts",
    description: "сильное удержание, понятный финал, призыв к действию",
  },
  chat: {
    label: "💬 Чат-переписка",
    format: "Chat 9:16",
    description: "сообщения появляются по очереди в интерфейсе мобильного чата",
  },
} as const;

type StylePresetId = keyof typeof STYLE_PRESETS;
type PlatformId = keyof typeof PLATFORM_PRESETS;
type ToneId = "suspense" | "funny" | "emotional" | "educational" | "intriguing";

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
    caption?: string;
    video?: {
      file_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
    document?: {
      file_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
    photo?: Array<{
      file_id: string;
      width: number;
      height: number;
      file_size?: number;
    }>;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      message_id: number;
      chat: { id: number };
    };
  };
};

type TelegramMessage = {
  message_id: number;
};

type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
};

type ChatPreferencePatch = Partial<Pick<
  typeof telegramChatPreferencesTable.$inferInsert,
  | "scriptInstructions"
  | "voiceId"
  | "voiceName"
  | "stylePreset"
  | "customStyle"
  | "tone"
  | "duration"
  | "platform"
   | "activeSeriesId"
   | "activeCtaProfileId"
   | "activeYoutubeConnectionId"
  | "pendingAction"
>>;

type ElevenLabsVoiceOption = {
  id: string;
  name: string;
  gender: string | null;
  accent: string | null;
  language: string | null;
  previewUrl: string | null;
};

type CtaPlacement = "opening" | "middle" | "ending";

type ChatBatchStatus = "collecting" | "queued" | "processing" | "paused" | "completed" | "cancelled";
type ChatDayBatchStatus =
  | "collecting_scripts"
  | "generating_variants"
  | "awaiting_review"
  | "processing"
  | "awaiting_video_review"
  | "awaiting_metadata"
  | "scheduled"
  | "completed"
  | "cancelled";

type ChatDayBatchMetadata = YoutubeMetadata & {
  variants?: YoutubeMetadata[];
  metadataMode?: "manual" | "auto";
  [key: string]: unknown;
};

const lastProjectByChat = new Map<number, number>();
const pendingSeriesByChat = new Map<number, { concept: SeriesConcept; seriesId: number; seasonId: number; ctaText: string }>();
const activeSeriesEpisodeByChat = new Map<number, number>();
const pendingSeriesStyleByChat = new Map<number, string>();
const pendingSeriesTitleByChat = new Map<number, string>();
const pendingSeriesEpisodeTargetByChat = new Map<number, number>();
const pendingCustomScriptByChat = new Map<number, string>();
const pendingCtaEditByChat = new Map<number, number>();
const pendingCtaDraftByChat = new Map<number, {
  profileId?: number;
  name: string;
  city: string;
  profession: string;
  ctaText: string;
  telegramUrl: string | null;
  placement: CtaPlacement;
}>();
type PendingYoutubePublication = {
  projectId: number | null;
  connectionIds: number[];
  videoStoragePath: string;
  topic: string;
  metadata: YoutubeMetadata;
  thumbnail: Buffer;
  privacyStatus?: "private" | "public";
  commentText?: string;
  channelBranding?: boolean;
};
const pendingYoutubeByChat = new Map<number, PendingYoutubePublication>();
type PendingVideoEditSession = {
  sourceStoragePath: string;
  title: string;
  scriptText: string;
  topic: string;
  options?: VideoEditOptions;
};
const pendingVideoEditByChat = new Map<number, PendingVideoEditSession>();
const pendingVideoReviewByChat = new Map<number, {
  projectId: number;
  jobId: number;
  videoStoragePath: string;
}>();
const pendingImageSceneByChat = new Map<number, { projectId: number; sceneId: number }>();
const pendingReactionByChat = new Map<number, {
  streamerName: string;
  reactionMode: "video" | "image";
  reactionImagePath?: string;
  mainVideoStoragePath?: string;
}>();
type PendingVideoCutBatch = {
  id: string;
  sourceUrl: string;
  cuts: Map<number, VideoCut>;
  channelIdBySequence: Map<number, number>;
  kept: Set<number>;
  reviewed: Set<number>;
  finished?: boolean;
  banner?: PendingVideoCutBanner;
  sourceTitle?: string;
  sourceDescription?: string;
};
const pendingVideoCutBatchByChat = new Map<number, PendingVideoCutBatch>();
const pendingVideoCutCountByChat = new Map<number, number>();
type PendingVideoCutSourceRequest = {
  sourceUrl: string;
  sourceStoragePath?: string;
  connectionIds: number[];
  banner?: PendingVideoCutBanner;
};
const pendingVideoCutSourceByChat = new Map<number, PendingVideoCutSourceRequest>();
type PendingVideoCutEditSession = {
  batchId: string;
  sequences: number[];
  options?: VideoEditOptions;
};
const pendingVideoCutEditByChat = new Map<number, PendingVideoCutEditSession>();
type PendingCutMetadataSession = {
  batchId: string;
  sequences: number[];
  index: number;
  metadataBySequence: Map<number, YoutubeMetadata>;
};
const pendingCutMetadataByChat = new Map<number, PendingCutMetadataSession>();
type PendingVideoCutBanner = {
  storagePath: string;
  kind: "image" | "video";
};
const pendingVideoCutBannerByChat = new Map<number, PendingVideoCutBanner>();
let cachedStoryBackgroundStoragePath: string | undefined;
const NOX_PROFILE_COMMENT = "Сервис поиска в профиле";

async function getDefaultVideoCutBanner(): Promise<PendingVideoCutBanner | undefined> {
  if (cachedDefaultVideoCutBanner !== undefined) return cachedDefaultVideoCutBanner || undefined;
  try {
    const buffer = await readFile(DEFAULT_NOX_BANNER_PATH);
    const storagePath = await storeAudioAsset(buffer, "video", "video/mp4", "mp4");
    cachedDefaultVideoCutBanner = { storagePath, kind: "video" };
  } catch (error) {
    cachedDefaultVideoCutBanner = null;
    logger.warn({ err: error, path: DEFAULT_NOX_BANNER_PATH }, "Default NOX video cut banner is unavailable");
  }
  return cachedDefaultVideoCutBanner || undefined;
}
type PendingVideoCutReaction = {
  batchId: string;
  sequences: number[];
  streamerName: string;
  reactionMode: "video" | "image";
  reactionImagePath?: string;
};
const pendingVideoCutReactionByChat = new Map<number, PendingVideoCutReaction>();
type PendingAdAsset = {
  kind: "image" | "video";
  storagePath: string;
  name: string;
};
type PendingAdSession = {
  brief: string;
  assets: PendingAdAsset[];
  plan?: AdPlan;
};
const pendingAdByChat = new Map<number, PendingAdSession>();
const storyAutomationRunningChats = new Set<number>();

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

async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  replyMarkup?: InlineKeyboard,
): Promise<void> {
  for (let start = 0; start < text.length; start += MAX_MESSAGE_LENGTH) {
    const isLastChunk = start + MAX_MESSAGE_LENGTH >= text.length;
    await telegramRequest<TelegramMessage>(token, "sendMessage", {
      chat_id: chatId,
      text: text.slice(start, start + MAX_MESSAGE_LENGTH),
      ...(isLastChunk && replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }
}

async function editMessageText(
  token: string,
  chatId: number,
  messageId: number,
  text: string,
): Promise<void> {
  await telegramRequest(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
  });
}

function progressMessage(frame: number, startedAt: number): string {
  const dots = ".".repeat(frame % 4);
  const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const elapsed = elapsedSeconds >= 60
    ? `${Math.floor(elapsedSeconds / 60)} мин ${elapsedSeconds % 60} сек`
    : `${elapsedSeconds} сек`;
  return `⏳ Процесс идёт${dots}\nПрошло: ${elapsed}`;
}

function runTelegramBackgroundTask(
  task: Promise<void>,
  context: Record<string, unknown>,
): void {
  const token = telegramProgressToken;
  const chatId = typeof context.chatId === "number" ? context.chatId : undefined;
  const startedAt = Date.now();
  let progressMessageId: number | undefined;
  let progressTimer: ReturnType<typeof setInterval> | undefined;
  let progressStarting = false;
  let frame = 0;
  let finished = false;
  let failed = false;

  const startProgress = async (): Promise<void> => {
    if (!token || !chatId || finished || progressStarting) return;
    progressStarting = true;
    try {
      const message = await telegramRequest<TelegramMessage>(token, "sendMessage", {
        chat_id: chatId,
        text: progressMessage(frame, startedAt),
      });
      if (finished) {
        await editMessageText(token, chatId, message.message_id, "✅ Процесс завершён.");
        return;
      }
      progressMessageId = message.message_id;
      progressTimer = setInterval(() => {
        if (finished || !progressMessageId) return;
        frame += 1;
        void editMessageText(token, chatId, progressMessageId, progressMessage(frame, startedAt))
          .catch((error) => {
            logger.debug({ err: error, chatId }, "Telegram progress update failed");
          });
      }, TELEGRAM_PROGRESS_INTERVAL_MS);
      progressTimer.unref?.();
    } catch (error) {
      logger.debug({ err: error, chatId }, "Telegram progress message failed");
    } finally {
      progressStarting = false;
    }
  };

  const progressDelay = token && chatId
    ? setTimeout(() => void startProgress(), TELEGRAM_PROGRESS_DELAY_MS)
    : undefined;
  progressDelay?.unref?.();

  void task
    .catch((error) => {
      failed = true;
      logger.error({ err: error, ...context }, "Telegram background task failed");
    })
    .finally(() => {
      finished = true;
      if (progressDelay) clearTimeout(progressDelay);
      if (progressTimer) clearInterval(progressTimer);
      if (token && chatId && progressMessageId) {
        void editMessageText(
          token,
          chatId,
          progressMessageId,
          failed ? "⚠️ Процесс завершён с ошибкой." : "✅ Процесс завершён.",
        ).catch((error) => {
          logger.debug({ err: error, chatId }, "Telegram progress completion failed");
        });
      }
    });
}

async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string, showAlert = false): Promise<void> {
  try {
    await telegramRequest(token, "answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
      show_alert: showAlert,
    });
  } catch (error) {
    if (error instanceof Error && /query is too old|query ID is invalid/i.test(error.message)) {
      logger.warn({ callbackQueryId }, "Ignoring stale Telegram callback query");
      return;
    }
    throw error;
  }
}

async function getChatPreferences(chatId: number) {
  const [existing] = await db.select().from(telegramChatPreferencesTable)
    .where(eq(telegramChatPreferencesTable.chatId, chatId));
  if (existing) return existing;
  const [created] = await db.insert(telegramChatPreferencesTable)
    .values({ chatId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [concurrent] = await db.select().from(telegramChatPreferencesTable)
    .where(eq(telegramChatPreferencesTable.chatId, chatId));
  if (!concurrent) throw new Error("Could not load Telegram chat preferences");
  return concurrent;
}

async function updateChatPreferences(chatId: number, patch: ChatPreferencePatch) {
  const [row] = await db.insert(telegramChatPreferencesTable)
    .values({ chatId, ...patch })
    .onConflictDoUpdate({
      target: telegramChatPreferencesTable.chatId,
      set: { ...patch, updatedAt: new Date() },
    })
    .returning();
  return row;
}

function ctaWithUrl(text: string, url: string | null): string {
  return url ? `${text} ${url}` : text;
}

function applyCtaPlacement(
  script: Awaited<ReturnType<typeof generateVideoScript>>,
  cta: string,
  placement: CtaPlacement,
) {
  script.cta = cta;
  if (!cta.trim() || !script.scenes.length) return script;
  const index = placement === "opening"
    ? 0
    : placement === "middle" ? Math.floor(script.scenes.length / 2) : script.scenes.length - 1;
  const scene = script.scenes[index];
  if (scene && !scene.voice_text.includes(cta)) {
    scene.voice_text = placement === "opening"
      ? `${cta} ${scene.voice_text}`
      : placement === "ending"
        ? `${scene.voice_text} ${cta}`
        : `${scene.voice_text} ${cta}`;
  }
  return script;
}

function parseCtaProfileInput(input: string): {
  name: string;
  city: string;
  profession: string;
  ctaText: string;
  telegramUrl: string | null;
  placement: CtaPlacement;
} {
  const get = (key: string) => input.match(new RegExp(`(?:^|\\n)${key}\\s*:\\s*([^\\n]+)`, "iu"))?.[1]?.trim();
  const url = input.match(/https?:\/\/t\.me\/[A-Za-z0-9_+/?=-]+/iu)?.[0] || null;
  const placementValue = (get("Позиция") || get("Placement") || "").toLowerCase();
  const placement: CtaPlacement = /начал|opening|вступлен/.test(placementValue)
    ? "opening"
    : /середин|middle|внутри/.test(placementValue) ? "middle" : "ending";
  const city = get("Город") || "Новосибирск";
  const profession = get("Направление") || get("Профессия") || "курьер";
  return {
    name: (get("Название") || `${profession} — ${city}`).slice(0, 100),
    city: city.slice(0, 100),
    profession: profession.slice(0, 100),
    ctaText: (get("Текст") || DEFAULT_RECRUITMENT_CTA).slice(0, 500),
    telegramUrl: url,
    placement,
  };
}

async function showCtaProfiles(token: string, chatId: number): Promise<void> {
  const profiles = await db.select().from(ctaProfilesTable)
    .where(eq(ctaProfilesTable.chatId, chatId))
    .orderBy(desc(ctaProfilesTable.updatedAt));
  const preferences = await getChatPreferences(chatId);
  const rows = profiles.map((profile) => [
    {
      text: `${profile.id === preferences.activeCtaProfileId ? "✅ " : ""}${profile.name} · ${profile.city}`,
      callback_data: `cta:select:${profile.id}`,
    },
    { text: "✏️", callback_data: `cta:edit:${profile.id}` },
    { text: "🗑", callback_data: `cta:delete:${profile.id}` },
  ]);
  rows.push([{ text: "➕ Создать CTA-профиль", callback_data: "cta:new" }]);
  rows.push([{ text: "⬅️ Главное меню", callback_data: "menu:home" }]);
  await sendMessage(token, chatId, profiles.length
    ? "📣 CTA-профили. Выбранный профиль будет использован при создании нового сериала."
    : "📣 CTA-профилей пока нет. Создайте первый профиль.", {
    inline_keyboard: rows,
  });
  if (profiles.length) {
    await sendMessage(token, chatId, profiles.map((profile) =>
      `${profile.id === preferences.activeCtaProfileId ? "✅ " : ""}${profile.name}\n${profile.ctaText}${profile.telegramUrl ? `\n${profile.telegramUrl}` : ""}\nПозиция: ${profile.placement}`,
    ).join("\n\n"));
  }
}

async function handleCtaProfileInput(token: string, chatId: number, input: string): Promise<void> {
  if (input.length > 2_000) {
    await sendMessage(token, chatId, "Описание CTA-профиля слишком длинное. Максимум 2000 символов.");
    return;
  }
  const profile = parseCtaProfileInput(input);
  const profileId = pendingCtaEditByChat.get(chatId);
  pendingCtaEditByChat.delete(chatId);
  pendingCtaDraftByChat.set(chatId, { profileId, ...profile });
  await updateChatPreferences(chatId, { pendingAction: "cta_profile_preview" });
  await sendMessage(token, chatId, [
    "👀 Предпросмотр CTA-профиля",
    "",
    `Название: ${profile.name}`,
    `Город: ${profile.city}`,
    `Направление: ${profile.profession}`,
    `Текст: ${profile.ctaText}`,
    `Ссылка: ${profile.telegramUrl || "не указана"}`,
    `Позиция: ${profile.placement === "opening" ? "начало" : profile.placement === "middle" ? "середина" : "конец"} серии`,
    "",
    `В серии: ${ctaWithUrl(profile.ctaText, profile.telegramUrl)}`,
  ].join("\n"), {
    inline_keyboard: [
      [{ text: "✅ Сохранить", callback_data: "cta:save_preview" }],
      [{ text: "✏️ Вернуться к редактированию", callback_data: "cta:cancel_preview" }],
    ],
  });
}

async function showSeriesStylePicker(token: string, chatId: number): Promise<void> {
  await updateChatPreferences(chatId, { pendingAction: "series_style" });
  await sendMessage(token, chatId, "🎨 Выберите визуальный стиль нового сериала:", {
    inline_keyboard: [
      [{ text: "📷 Реалистичный", callback_data: "series:style:realistic" }],
      [{ text: "✨ Pixar", callback_data: "series:style:pixar" }],
      [{ text: "🌸 Аниме", callback_data: "series:style:anime" }],
      [{ text: "🎨 Мультфильм", callback_data: "series:style:cartoon" }],
    ],
  });
}

function formatSeriesEpisodeForTelegram(script: VideoScript): string {
  const scenes = script.scenes.map((scene) =>
    `СЦЕНА ${scene.scene_number}\n${scene.voice_text}`,
  ).join("\n\n");
  return [
    `🎬 ${script.title}`,
    "",
    scenes,
    "",
    `ФИНАЛ\n${script.ending}`,
  ].join("\n");
}

async function getActiveSeries(chatId: number) {
  const preferences = await getChatPreferences(chatId);
  let seriesId = preferences.activeSeriesId;
  if (!seriesId) {
    const [latestSeries] = await db.select({ id: seriesTable.id })
      .from(seriesTable)
      .where(eq(seriesTable.chatId, chatId))
      .orderBy(desc(seriesTable.createdAt))
      .limit(1);
    seriesId = latestSeries?.id;
    if (seriesId) await updateChatPreferences(chatId, { activeSeriesId: seriesId });
  }
  if (!seriesId) return null;
  const [series] = await db.select().from(seriesTable).where(and(
    eq(seriesTable.id, seriesId),
    eq(seriesTable.chatId, chatId),
  ));
  return series || null;
}

async function showSeriesPlan(token: string, chatId: number): Promise<boolean> {
  const series = await getActiveSeries(chatId);
  if (!series) return false;
  const [season] = await db.select().from(seasonsTable)
    .where(eq(seasonsTable.seriesId, series.id))
    .orderBy(desc(seasonsTable.seasonNumber));
  if (!season) return false;
  const episodes = await db.select().from(seriesEpisodesTable)
    .where(eq(seriesEpisodesTable.seasonId, season.id))
    .orderBy(seriesEpisodesTable.episodeNumber);
  const statusLabel: Record<string, string> = {
    planned: "⏳ запланирована",
    draft: "✍️ сценарий готов к проверке",
    approved: "🎬 производство",
    completed: "✅ готова",
  };
  const plan = episodes.map((episode) => [
    `${episode.episodeNumber}. ${episode.title}`,
    `${statusLabel[episode.status] || episode.status}`,
    episode.synopsis,
  ].join("\n")).join("\n\n");
  await sendMessage(token, chatId, [
    `📋 ПЛАН СЕЗОНА ${season.seasonNumber}`,
    `«${series.title}»`,
    "",
    `Серий: ${episodes.length}`,
    "",
    plan || "План серий пока пуст.",
  ].join("\n"), {
    inline_keyboard: [
      [{ text: "⬅️ К текущему сериалу", callback_data: "series:back" }],
      [{ text: "➕ Новый сериал", callback_data: "series:new" }],
    ],
  });
  return true;
}

async function showSeriesBible(token: string, chatId: number): Promise<boolean> {
  const series = await getActiveSeries(chatId);
  if (!series) return false;
  const bible = (series.bibleJson || {}) as Partial<SeriesConcept>;
  const characters = Array.isArray(bible.characters)
    ? bible.characters.map((character) => `• ${character.name} — ${character.role}; ${character.motivation}`).join("\n")
    : "Персонажи пока не указаны.";
  await sendMessage(token, chatId, [
    `👥 БИБЛИЯ СЕРИАЛА`,
    `«${series.title}»`,
    "",
    `Концепция: ${series.premise}`,
    `Город: ${series.city}`,
    `Профессия: ${series.profession}`,
    `Визуальный стиль: ${series.style}`,
    "",
    "Герои:",
    characters,
    "",
    `Правила мира: ${Array.isArray(bible.world_rules) ? bible.world_rules.join("; ") : "не указаны"}`,
    `Локации: ${Array.isArray(series.locationsJson) ? series.locationsJson.join(", ") : "не указаны"}`,
  ].join("\n"), {
    inline_keyboard: [
      [{ text: "⬅️ К текущему сериалу", callback_data: "series:back" }],
      [{ text: "📋 План сезона", callback_data: "series:plan" }],
    ],
  });
  return true;
}

async function showActiveSeriesMenu(token: string, chatId: number): Promise<boolean> {
  const preferences = await getChatPreferences(chatId);
  const explicitlyStartingNewSeries = ["series_style", "series_prompt", "series_edit"].includes(preferences.pendingAction || "");
  if (explicitlyStartingNewSeries) return false;
  const series = await getActiveSeries(chatId);
  if (!series) {
    await updateChatPreferences(chatId, { activeSeriesId: null });
    return false;
  }
  if (series.status !== "approved") {
    await sendMessage(token, chatId, [
      `📺 Текущий сериал: «${series.title}»`,
      "",
      "Библия и план сезона ещё не утверждены.",
      "Завершите утверждение текущего сериала или начните новый.",
    ].join("\n"), {
      inline_keyboard: [
        [{ text: "✅ Утвердить библию и план", callback_data: "series:approve" }],
        [{ text: "✏️ Изменить концепцию", callback_data: "series:edit" }, { text: "🔄 Новый вариант", callback_data: "series:regenerate" }],
        [{ text: "📋 План сезона", callback_data: "series:plan" }, { text: "👥 Библия", callback_data: "series:bible" }],
        [{ text: "➕ Новый сериал", callback_data: "series:new" }],
        [{ text: "🗑 Удалить сериал", callback_data: "series:delete" }],
        [{ text: "⬅️ Главное меню", callback_data: "menu:home" }],
      ],
    });
    return true;
  }
  const [season] = await db.select().from(seasonsTable)
    .where(eq(seasonsTable.seriesId, series.id))
    .orderBy(desc(seasonsTable.seasonNumber));
  if (!season) return false;
  const episodes = await db.select({
    episodeNumber: seriesEpisodesTable.episodeNumber,
    title: seriesEpisodesTable.title,
    status: seriesEpisodesTable.status,
  }).from(seriesEpisodesTable)
    .where(eq(seriesEpisodesTable.seasonId, season.id))
    .orderBy(seriesEpisodesTable.episodeNumber);
  const completedCount = episodes.filter((episode) => episode.status === "completed").length;
  const inProgress = episodes.find((episode) => episode.status === "draft" || episode.status === "approved");
  const nextEpisode = episodes.find((episode) => episode.status === "planned");
  const lines = [
    `📺 Текущий сериал: «${series.title}»`,
    `🎞 Сезон ${season.seasonNumber}`,
    `✅ Серий готово: ${completedCount} из ${episodes.length}`,
  ];
  if (inProgress) {
    lines.push(`⏳ В работе: серия ${inProgress.episodeNumber} — «${inProgress.title}»`);
  } else if (nextEpisode) {
    lines.push(`Следующая: серия ${nextEpisode.episodeNumber} — «${nextEpisode.title}»`);
  } else {
    lines.push("✅ Все серии сезона подготовлены.");
  }
  await sendMessage(token, chatId, lines.join("\n"), {
    inline_keyboard: [
      ...(inProgress?.status === "draft"
        ? [[{ text: `✍️ Написать серию ${inProgress.episodeNumber}`, callback_data: "series:episode:continue" }]]
        : nextEpisode
          ? [[{ text: `✍️ Написать серию ${nextEpisode.episodeNumber}`, callback_data: "series:episode:generate" }]]
          : []),
      [{ text: "📝 Мой сценарий", callback_data: "series:custom_script" }],
      [{ text: "➕ Добавить серии", callback_data: "series:add_episodes" }],
      [{ text: "📋 План сезона", callback_data: "series:plan" }, { text: "👥 Библия", callback_data: "series:bible" }],
      ...(inProgress ? [[{ text: "🔄 Обновить статус", callback_data: "series:refresh" }]] : []),
      [{ text: "➕ Новый сериал", callback_data: "series:new" }],
      [{ text: "🗑 Удалить сериал", callback_data: "series:delete" }],
      [{ text: "⬅️ Главное меню", callback_data: "menu:home" }],
    ],
  });
  return true;
}

async function addEpisodesToActiveSeason(chatId: number, targetCount: number): Promise<number> {
  const series = await getActiveSeries(chatId);
  if (!series) throw new Error("Активный сериал не найден.");
  const [season] = await db.select().from(seasonsTable)
    .where(eq(seasonsTable.seriesId, series.id))
    .orderBy(desc(seasonsTable.seasonNumber));
  if (!season || season.status !== "approved") throw new Error("Сначала утвердите библию и план сезона.");
  const episodes = await db.select().from(seriesEpisodesTable)
    .where(eq(seriesEpisodesTable.seasonId, season.id))
    .orderBy(seriesEpisodesTable.episodeNumber);
  const currentCount = episodes.length;
  if (targetCount <= currentCount) return 0;
  const newEpisodes = Array.from({ length: targetCount - currentCount }, (_, index) => {
    const episodeNumber = currentCount + index + 1;
    return {
      episode_number: episodeNumber,
      title: `Серия ${episodeNumber}`,
      synopsis: "Новая серия для продолжения авторской истории.",
      hook: "История получает новое развитие.",
      local_location: series.city,
      cliffhanger: "История продолжается в следующей серии.",
      dramatic_goal: "",
      episode_conflict: "",
      turning_point: "",
      entry_state: "",
      exit_state: "",
      next_episode_bridge: "",
    };
  });
  await db.insert(seriesEpisodesTable).values(newEpisodes.map((episode) => ({
    seasonId: season.id,
    episodeNumber: episode.episode_number,
    title: episode.title,
    synopsis: episode.synopsis,
    hook: episode.hook,
    cliffhanger: episode.cliffhanger,
    localLocation: episode.local_location,
    status: "planned" as const,
  })));
  const bible = (series.bibleJson || {}) as Partial<SeriesConcept>;
  const existingPlan = Array.isArray(bible.episodes) ? bible.episodes : [];
  await db.update(seriesTable).set({
    episodeCount: targetCount,
    bibleJson: { ...bible, episodes: [...existingPlan, ...newEpisodes] },
  }).where(eq(seriesTable.id, series.id));
  await db.update(seasonsTable).set({
    planJson: [...(Array.isArray(season.planJson) ? season.planJson : []), ...newEpisodes],
  }).where(eq(seasonsTable.id, season.id));
  await saveSeriesMemory({
    seriesId: series.id,
    eventType: "episodes_added",
    payload: { seasonNumber: season.seasonNumber, from: currentCount + 1, to: targetCount },
  });
  return newEpisodes.length;
}

function storyConnectionIds(batch: typeof storyBatchesTable.$inferSelect): number[] {
  return Array.isArray(batch.connectionIds)
    ? batch.connectionIds.filter((value): value is number => typeof value === "number")
    : [];
}

async function getActiveStoryBatch(chatId: number) {
  const [batch] = await db.select().from(storyBatchesTable)
    .where(and(
      eq(storyBatchesTable.chatId, chatId),
      inArray(storyBatchesTable.status, [
        "collecting",
        "choosing_channels",
        "choosing_banner",
        "generating",
        "processing",
        "awaiting_review",
      ]),
    ))
    .orderBy(desc(storyBatchesTable.updatedAt))
    .limit(1);
  return batch;
}

function storyAutomationConnectionIds(automation: typeof storyAutomationsTable.$inferSelect): number[] {
  return Array.isArray(automation.connectionIds)
    ? automation.connectionIds.filter((value): value is number => typeof value === "number")
    : [];
}

function storyBatchAutomationSettings(batch: typeof storyBatchesTable.$inferSelect): {
  enabled: boolean;
  privacyStatus: "public" | "private";
} {
  const metadata = batch.metadata && typeof batch.metadata === "object"
    ? batch.metadata as Record<string, unknown>
    : {};
  return {
    enabled: metadata.automated === true,
    privacyStatus: metadata.automationPrivacyStatus === "private" ? "private" : "public",
  };
}

async function getStoryAutomation(chatId: number) {
  const [automation] = await db.select().from(storyAutomationsTable)
    .where(eq(storyAutomationsTable.chatId, chatId));
  return automation;
}

async function ensureStoryAutomation(chatId: number) {
  const existing = await getStoryAutomation(chatId);
  if (existing) return existing;
  const activeBatch = await getActiveStoryBatch(chatId);
  const connectionIds = activeBatch ? storyConnectionIds(activeBatch) : [];
  if (!connectionIds.length) {
    throw new Error("Сначала выберите каналы в разделе «📖 История».");
  }
  const [created] = await db.insert(storyAutomationsTable).values({
    chatId,
    connectionIds,
    intervalMinutes: STORY_AUTOMATION_INTERVAL_MINUTES,
    source: "ai",
    privacyStatus: "public",
    enabled: false,
  }).onConflictDoNothing().returning();
  return created || await getStoryAutomation(chatId);
}

async function showStoryAutomationMenu(token: string, chatId: number, prefix?: string): Promise<void> {
  const automation = await ensureStoryAutomation(chatId);
  if (!automation) throw new Error("Не удалось загрузить настройки автовыпуска.");
  const connections = await listYoutubeConnections();
  const selectedIds = storyAutomationConnectionIds(automation);
  const selectedTitles = selectedIds.map((id) =>
    connections.find((connection) => connection.id === id)?.channelTitle || `канал #${id}`,
  );
  const nextRun = automation.nextRunAt
    ? automation.nextRunAt.toLocaleString("ru-RU", { timeZone: "Asia/Novosibirsk" })
    : "после включения";
  await sendMessage(token, chatId, [
    prefix || "🤖 АВТОВЫПУСК ИСТОРИЙ",
    "",
    automation.enabled ? "Статус: ✅ включён" : "Статус: ⏸ выключен",
    "Источник: AI придумывает новую историю",
    "Интервал: каждые 2 часа",
    "Публикация: открыто",
    `Следующий запуск: ${nextRun}`,
    "",
    `Каналов: ${selectedTitles.length}`,
    selectedTitles.length ? selectedTitles.map((title) => `• ${title}`).join("\n") : "Каналы не выбраны.",
    automation.lastError ? `\nПоследняя ошибка: ${automation.lastError}` : "",
    "",
    "Для каждого запуска создаются разные сценарии, по одной картинке на ролик, затем весь пакет публикуется автоматически.",
  ].join("\n"), {
    inline_keyboard: [
      [automation.enabled
        ? { text: "⏸ Остановить автовыпуск", callback_data: "story:auto:disable" }
        : { text: "▶️ Включить автовыпуск", callback_data: "story:auto:enable" }],
      [{ text: "📖 Открыть текущую историю", callback_data: "menu:story" }],
      [{ text: "⬅️ Главное меню", callback_data: "menu:home" }],
    ],
  });
}

async function enableStoryAutomation(token: string, chatId: number): Promise<void> {
  const automation = await ensureStoryAutomation(chatId);
  if (!automation) throw new Error("Не удалось сохранить настройки автовыпуска.");
  await db.update(storyAutomationsTable).set({
    enabled: true,
    source: "ai",
    privacyStatus: "public",
    nextRunAt: new Date(),
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(storyAutomationsTable.chatId, chatId));
  await showStoryAutomationMenu(token, chatId, "✅ Автовыпуск включён. Первый автоматический запуск поставлен в очередь.");
}

async function disableStoryAutomation(token: string, chatId: number): Promise<void> {
  await db.update(storyAutomationsTable).set({
    enabled: false,
    nextRunAt: null,
    updatedAt: new Date(),
  }).where(eq(storyAutomationsTable.chatId, chatId));
  await showStoryAutomationMenu(token, chatId, "⏸ Автовыпуск остановлен. Уже запущенные ролики продолжат подготовку.");
}

async function getStoryBackgroundStoragePath(): Promise<string> {
  if (cachedStoryBackgroundStoragePath) return cachedStoryBackgroundStoragePath;
  if (!existsSync(DEFAULT_STORY_BACKGROUND_PATH)) {
    throw new Error("Фоновая картинка для историй не найдена.");
  }
  cachedStoryBackgroundStoragePath = await storeUploadedImage(
    await readFile(DEFAULT_STORY_BACKGROUND_PATH),
    "image/png",
  );
  return cachedStoryBackgroundStoragePath;
}

async function showStoryChannelChoice(token: string, chatId: number, batchId: number): Promise<void> {
  const [batch] = await db.select().from(storyBatchesTable).where(and(
    eq(storyBatchesTable.id, batchId),
    eq(storyBatchesTable.chatId, chatId),
    eq(storyBatchesTable.status, "choosing_channels"),
  ));
  if (!batch) throw new Error("Черновик истории не найден.");
  const connections = await listYoutubeConnections();
  if (!connections.length) throw new Error("Нет подключённых YouTube-каналов.");
  const selectedIds = new Set(storyConnectionIds(batch));
  const rows: Array<Array<{ text: string; callback_data: string }>> = connections.map((connection) => [{
    text: `${selectedIds.has(connection.id) ? "✅ " : ""}${connection.channelTitle || `Канал #${connection.id}`}`,
    callback_data: `story:channel:${batchId}:${connection.id}`,
  }]);
  rows.push([{ text: `➡️ Готово (${selectedIds.size})`, callback_data: `story:channels:done:${batchId}` }]);
  rows.push([{ text: "❌ Отмена", callback_data: `story:cancel:${batchId}` }]);
  await sendMessage(token, chatId, [
    "📖 Выберите YouTube-каналы.",
    "Для каждого выбранного канала будет создан отдельный текст, голос и MP4.",
    "",
    selectedIds.size ? `Выбрано: ${selectedIds.size}` : "Пока ничего не выбрано.",
  ].join("\n"), { inline_keyboard: rows });
}

async function showStoryBannerChoice(token: string, chatId: number, batchId: number): Promise<void> {
  await updateChatPreferences(chatId, { pendingAction: null });
  await sendMessage(token, chatId, [
    "🖼 Выберите баннер для историй.",
    "",
    "Фоновая картинка ролика общая для всех вариантов и уже сохранена.",
    "NOX — стандартный зелёный баннер сверху по центру на протяжении ролика.",
  ].join("\n"), {
    inline_keyboard: [
      [{ text: "🟩 NOX по умолчанию", callback_data: `story:banner:default:${batchId}` }],
      [{ text: "⬅️ Вернуться к каналам", callback_data: `story:channels:back:${batchId}` }],
    ],
  });
}

async function showStoryBatchStatus(
  token: string,
  chatId: number,
  batch: typeof storyBatchesTable.$inferSelect,
): Promise<void> {
  const items = await db.select().from(storyBatchItemsTable)
    .where(eq(storyBatchItemsTable.batchId, batch.id))
    .orderBy(storyBatchItemsTable.sequence);
  const statusLabel: Record<string, string> = {
    starting: "запускается",
    processing: "готовится",
    awaiting_review: "ждёт проверки",
    awaiting_publish: "одобрена, ждёт публикации",
    published: "опубликована",
    failed: "ошибка",
  };
  const retryRows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (const item of items) {
    if (item.status === "failed") {
      retryRows.push([{
        text: `🔁 Повторить: ${item.channelTitle}`,
        callback_data: `story:retry:${item.id}`,
      }]);
    } else if (item.status === "awaiting_publish") {
      retryRows.push([
        { text: `🌍 Опубликовать: ${item.channelTitle}`, callback_data: `story:publish:public:${item.id}` },
        { text: "🔒 Приватно", callback_data: `story:publish:private:${item.id}` },
      ]);
    }
  }
  const allReadyForBatchPublish = items.length > 0
    && items.every((item) => ["awaiting_publish", "published"].includes(item.status))
    && items.some((item) => item.status === "awaiting_publish");
  if (allReadyForBatchPublish) {
    retryRows.length = 0;
    retryRows.push(
      [{ text: "🌍 Опубликовать всё открыто", callback_data: `story:publish_all:public:${batch.id}` }],
      [{ text: "🔒 Опубликовать всё приватно", callback_data: `story:publish_all:private:${batch.id}` }],
    );
  }
  retryRows.push([{ text: "➕ Начать новую историю", callback_data: "story:new" }]);
  retryRows.push([{ text: "⬅️ Главное меню", callback_data: "menu:home" }]);
  await sendMessage(token, chatId, [
    `📖 История: «${batch.title}»`,
    "",
    ...items.map((item) => `${item.sequence}. ${item.channelTitle} — ${statusLabel[item.status] || item.status}`),
    "",
    items.some((item) => item.status === "failed")
      ? "Один или несколько вариантов не прошли подготовку. Их можно запустить повторно."
      : allReadyForBatchPublish
        ? "Все варианты готовы. Одной кнопкой можно загрузить их на все выбранные каналы."
        : "Идёт подготовка всех вариантов. После завершения появится общая публикация.",
  ].join("\n"), retryRows.length ? { inline_keyboard: retryRows } : undefined);
}

async function startNewStoryDraft(token: string, chatId: number): Promise<void> {
  const backgroundStoragePath = await getStoryBackgroundStoragePath();
  const [batch] = await db.insert(storyBatchesTable).values({
    chatId,
    title: "Новая история",
    baseScript: "",
    duration: STORY_DURATION_SECONDS,
    backgroundStoragePath,
    status: "choosing_channels",
  }).returning();
  if (!batch) throw new Error("Не удалось создать черновик истории.");
  await updateChatPreferences(chatId, {
    platform: "YouTube Shorts",
    duration: STORY_DURATION_SECONDS,
    pendingAction: null,
  });
  await sendMessage(token, chatId, [
    "📖 НОВАЯ ИСТОРИЯ",
    "",
    "Сначала выберите YouTube-каналы для этой истории.",
    `Длительность каждого варианта — ${STORY_DURATION_SECONDS} секунд.`,
    "Старая история останется в списке и не будет изменена.",
    "Для отмены отправьте /cancel.",
  ].join("\n"));
  await showStoryChannelChoice(token, chatId, batch.id);
}

function shuffled<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

async function prepareStoryChannelVisuals(
  token: string,
  chatId: number,
  batchId: number,
  connectionId: number,
  channelTitle: string,
  script: VideoScript,
  fallbackStoragePath?: string,
): Promise<Array<typeof storyChannelVisualsTable.$inferSelect>> {
  const existing = await db.select().from(storyChannelVisualsTable)
    .where(and(
      eq(storyChannelVisualsTable.batchId, batchId),
      eq(storyChannelVisualsTable.connectionId, connectionId),
    ))
    .orderBy(storyChannelVisualsTable.sequence);
  const visuals = [...existing];
  for (let index = visuals.length; index < STORY_VISUAL_POOL_SIZE; index += 1) {
    const scene = script.scenes[index % script.scenes.length]!;
    if (index === visuals.length || index % 3 === 0) {
      await sendMessage(token, chatId, `🖼 «${channelTitle}»: сохраняю визуал ${index + 1}/${STORY_VISUAL_POOL_SIZE}…`);
    }
    const prompt = [
      "Vertical 9:16 cinematic still image for a short Russian story.",
      `Channel identity: ${channelTitle}.`,
      `Story title: ${script.title}.`,
      `Scene idea: ${scene.visual_description}.`,
      `Visual variation ${index + 1}: use a distinct camera angle, composition, lighting, or moment while preserving the same story world.`,
      "Create a recognizable channel-specific visual identity, natural realistic details, expressive but believable faces.",
      "No text, captions, logos, watermarks, UI, borders, or collages.",
    ].join(" ");
    let storagePath: string;
    try {
      const generated = await generateStandaloneImage(prompt, {
        aspectRatio: "9:16",
        visualStyle: "cinematic realistic storytelling",
        realism: "high",
        people: "optional",
        colorAtmosphere: "channel-specific cinematic",
      });
      storagePath = await storeUploadedImage(generated.buffer, generated.contentType);
    } catch (error) {
      if (!fallbackStoragePath) throw error;
      logger.warn({ err: error, batchId, connectionId }, "Story visual generation failed; using shared story background");
      storagePath = fallbackStoragePath;
    }
    const [visual] = await db.insert(storyChannelVisualsTable).values({
      batchId,
      connectionId,
      sequence: index + 1,
      storagePath,
      prompt,
      status: "completed",
    }).returning();
    if (!visual) throw new Error(`Не удалось сохранить визуал ${index + 1} для канала «${channelTitle}»`);
    visuals.push(visual);
  }
  return visuals;
}

function buildFallbackStoryVariantScript(
  title: string,
  baseScript: string,
  channelTitle: string,
): VideoScript {
  const sentences = baseScript
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const fallbackLines = [
    "Сначала всё выглядело как обычный день.",
    "Но одна неожиданная деталь заставила героя остановиться.",
    "Он решил проверить, что происходит, хотя мог просто пройти мимо.",
    "Постепенно стало ясно, что случайность связана с его прошлым.",
    "Ответ оказался совсем не таким, какого он ожидал.",
    "Иногда одна встреча меняет не только день, но и весь следующий шаг.",
  ];
  const scenes = Array.from({ length: 6 }, (_, index) => {
    const voiceText = sentences[index] || sentences.at(-1) || fallbackLines[index]!;
    return {
      scene_number: index + 1,
      duration_seconds: 10,
      voice_text: voiceText,
      visual_description: `Кинематографичный вертикальный кадр для истории «${title}», вариант для канала «${channelTitle}».`,
      image_prompt: `Cinematic realistic vertical still for a short story, channel identity ${channelTitle}, scene ${index + 1}, no text.`,
      scene_purpose: index === 0 ? "hook" : index === 5 ? "ending" : "story development",
      story_beat: voiceText,
      cause: "",
      action: "",
      obstacle: "",
      change: "",
      continuity: "",
      transition: "",
    };
  });
  return {
    title: `${title} · ${channelTitle}`.slice(0, 180),
    hook: scenes[0]!.voice_text,
    description: `Отдельная версия истории для канала ${channelTitle}.`,
    duration_seconds: STORY_DURATION_SECONDS,
    scenes,
    ending: scenes.at(-1)!.voice_text,
    cta: "",
  };
}

async function attachStoryVisualsToProject(
  projectId: number,
  script: VideoScript,
  visuals: Array<typeof storyChannelVisualsTable.$inferSelect>,
): Promise<string> {
  if (!visuals.length) throw new Error("Для варианта истории не созданы визуалы.");
  const selected = shuffled(visuals);
  const sceneImages = script.scenes.map((scene, index) => {
    const visual = selected[index % selected.length]!;
    return {
      projectId,
      sceneId: scene.scene_number,
      prompt: visual.prompt,
      negativePrompt: "text, captions, logos, watermarks, UI, collage",
      provider: "story-channel-pool",
      model: "persisted-channel-visual",
      aspectRatio: "9:16",
      width: 1080,
      height: 1920,
      status: "completed" as const,
      imageUrl: `/api/storage${visual.storagePath}`,
      storagePath: visual.storagePath,
      error: null,
      version: 1,
      isPrimary: true,
    };
  });
  await db.insert(generatedImagesTable).values(sceneImages);
  return selected[Math.floor(Math.random() * selected.length)]!.storagePath;
}

type StoryProgressEntry = {
  channelTitle: string;
  status: "pending" | "working" | "ready" | "failed";
  phase: string;
};

type StoryProgressState = {
  token: string;
  chatId: number;
  batchId: number;
  startedAt: number;
  messageId: number;
  entries: StoryProgressEntry[];
};

const storyProgressByBatch = new Map<number, StoryProgressState>();

function storyProgressText(state: StoryProgressState): string {
  const readyCount = state.entries.filter((entry) => entry.status === "ready").length;
  const failedCount = state.entries.filter((entry) => entry.status === "failed").length;
  const elapsedSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
  const elapsed = elapsedSeconds >= 60
    ? `${Math.floor(elapsedSeconds / 60)} мин ${elapsedSeconds % 60} сек`
    : `${elapsedSeconds} сек`;
  const rows = state.entries.map((entry, index) => {
    const icon = entry.status === "ready"
      ? "✅"
      : entry.status === "failed" ? "❌" : entry.status === "working" ? "🔄" : "⏳";
    return `${icon} Вариант ${index + 1}/${state.entries.length} — ${entry.channelTitle}\n   ${entry.phase}`;
  });
  return [
    "📖 ИСТОРИЯ — подготовка вариантов",
    "",
    `Готово: ${readyCount}/${state.entries.length}${failedCount ? ` · ошибок: ${failedCount}` : ""}`,
    `Прошло: ${elapsed}`,
    "",
    ...rows,
    "",
    "Статус обновляется автоматически. Процесс не завис.",
  ].join("\n");
}

async function createStoryProgress(
  token: string,
  chatId: number,
  batchId: number,
  channelTitles: string[],
): Promise<StoryProgressState> {
  const state: StoryProgressState = {
    token,
    chatId,
    batchId,
    startedAt: Date.now(),
    messageId: 0,
    entries: channelTitles.map((channelTitle) => ({
      channelTitle,
      status: "pending",
      phase: "ожидает запуска",
    })),
  };
  const message = await telegramRequest<TelegramMessage>(token, "sendMessage", {
    chat_id: chatId,
    text: storyProgressText(state),
  });
  state.messageId = message.message_id;
  storyProgressByBatch.set(batchId, state);
  return state;
}

async function updateStoryProgress(
  batchId: number,
  sequence: number,
  phase: string,
  status: StoryProgressEntry["status"] = "working",
): Promise<void> {
  const state = storyProgressByBatch.get(batchId);
  const entry = state?.entries[sequence - 1];
  if (!state || !entry) return;
  entry.phase = phase;
  entry.status = status;
  await editMessageText(state.token, state.chatId, state.messageId, storyProgressText(state))
    .catch((error) => logger.debug({ err: error, batchId }, "Story progress update failed"));
}

async function completeStoryProgress(batchId: number, text?: string): Promise<void> {
  const state = storyProgressByBatch.get(batchId);
  if (!state) return;
  await editMessageText(
    state.token,
    state.chatId,
    state.messageId,
    text || storyProgressText(state),
  ).catch((error) => logger.debug({ err: error, batchId }, "Story progress completion failed"));
  storyProgressByBatch.delete(batchId);
}

function runStoryBatchGenerationInBackground(token: string, chatId: number, batchId: number): void {
  void startStoryBatchGeneration(token, chatId, batchId).catch(async (error) => {
    logger.error({ err: error, chatId, batchId }, "Story batch generation failed");
    const message = error instanceof Error ? error.message : "Не удалось запустить подготовку истории.";
    await completeStoryProgress(batchId, `⚠️ Подготовка истории остановлена.\n${message}`);
    await sendMessage(token, chatId, `❌ Не удалось запустить историю: ${message}`).catch(() => undefined);
  });
}

function runStoryMonitorInBackground(
  task: Promise<unknown>,
  context: Record<string, unknown>,
): void {
  void task.catch((error) => {
    logger.error({ err: error, ...context }, "Story video monitor failed");
  });
}

async function startStoryBatchGeneration(token: string, chatId: number, batchId: number): Promise<void> {
  const [batch] = await db.select().from(storyBatchesTable).where(and(
    eq(storyBatchesTable.id, batchId),
    eq(storyBatchesTable.chatId, chatId),
    eq(storyBatchesTable.status, "choosing_banner"),
  ));
  if (!batch) throw new Error("Черновик истории не найден.");
  const selectedIds = storyConnectionIds(batch);
  if (!selectedIds.length) throw new Error("Выберите хотя бы один YouTube-канал.");
  const connections = await listYoutubeConnections();
  const selectedConnections = selectedIds
    .map((id) => connections.find((connection) => connection.id === id))
    .filter((connection): connection is (typeof connections)[number] => Boolean(connection));
  if (!selectedConnections.length) throw new Error("Выбранные YouTube-каналы больше не подключены.");

  await db.update(storyBatchesTable).set({ status: "generating", updatedAt: new Date() })
    .where(eq(storyBatchesTable.id, batchId));
  const preferences = await getChatPreferences(chatId);
  const automationSettings = storyBatchAutomationSettings(batch);
  await createStoryProgress(
    token,
    chatId,
    batchId,
    selectedConnections.map((connection) => connection.channelTitle || `канал #${connection.id}`),
  );
  const existingItems = await db.select().from(storyBatchItemsTable)
    .where(eq(storyBatchItemsTable.batchId, batchId));
  const existingByConnection = new Map(existingItems.map((item) => [item.connectionId, item]));
  for (const item of existingItems) {
    if (["awaiting_publish", "published"].includes(item.status)) {
      await updateStoryProgress(batchId, item.sequence, "MP4 готов к проверке", "ready");
    }
  }

  for (const [index, connection] of selectedConnections.entries()) {
    const [currentBatch] = await db.select({ status: storyBatchesTable.status })
      .from(storyBatchesTable)
      .where(eq(storyBatchesTable.id, batchId));
    if (currentBatch?.status === "cancelled") {
      await completeStoryProgress(batchId, "⏹ Подготовка истории отменена.");
      return;
    }
    const channelTitle = connection.channelTitle || `канал #${connection.id}`;
    const sequence = index + 1;
    const existingItem = existingByConnection.get(connection.id);
    if (existingItem && ["awaiting_publish", "published", "processing", "starting"].includes(existingItem.status)) {
      continue;
    }
    try {
      await updateStoryProgress(batchId, sequence, "пишу отдельную версию сценария…");
      let script: VideoScript;
      try {
        script = await generateVideoScript({
          topic: `${batch.title} · версия для канала ${channelTitle}`,
          format: "Story 9:16",
          duration: batch.duration,
          style: "cinematic realistic storytelling with a channel-specific visual identity",
          tone: preferences.tone || "emotional and natural",
          instructions: storyVariantInstructions(batch.title, batch.baseScript, channelTitle),
        });
      } catch (error) {
        if (!automationSettings.enabled) throw error;
        logger.warn({ err: error, batchId, connectionId: connection.id }, "Story variant AI failed; using fallback variant");
        await sendMessage(token, chatId, `⚠️ AI-вариант для «${channelTitle}» не ответил вовремя. Продолжаю с резервной редактурой.`);
        script = buildFallbackStoryVariantScript(batch.title, batch.baseScript, channelTitle);
      }
      script.cta = "";
      await updateStoryProgress(batchId, sequence, "делаю название, описание и теги…");
      const metadata = await generateYoutubeMetadata({
        title: script.title,
        topic: `${batch.title}. Канал: ${channelTitle}`,
        description: script.description,
        scriptText: script.scenes.map((scene) => scene.voice_text).join("\n"),
      });
      await updateStoryProgress(batchId, sequence, "генерирую отдельное изображение на весь ролик…");
      const visuals = await prepareStoryChannelVisuals(token, chatId, batchId, connection.id, channelTitle, script, batch.backgroundStoragePath);
      const scriptJson = {
        ...script,
        story_banner_storage_path: batch.bannerStoragePath,
        story_banner_kind: batch.bannerKind,
        story_channel_visual_pool_size: visuals.length,
        story_channel_connection_id: connection.id,
      };
      const [project] = await db.insert(projectsTable).values({
        title: script.title.slice(0, 180),
        topic: `История: ${batch.title} · ${channelTitle}`,
        format: "Story 9:16",
        duration: batch.duration,
        style: "cinematic realistic storytelling with a channel-specific visual identity",
        tone: preferences.tone || "emotional and natural",
        scriptJson,
        status: "completed",
      }).returning({ id: projectsTable.id });
      const avatarStoragePath = await attachStoryVisualsToProject(project.id, script, visuals);
      const finalScriptJson = { ...scriptJson, story_avatar_storage_path: avatarStoragePath };
      await db.update(projectsTable).set({ scriptJson: finalScriptJson }).where(eq(projectsTable.id, project.id));
      const [item] = existingItem
        ? await db.update(storyBatchItemsTable).set({
          channelTitle,
          scriptJson: finalScriptJson,
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          hashtags: metadata.hashtags,
          avatarStoragePath,
          projectId: project.id,
          status: "starting",
          error: null,
          updatedAt: new Date(),
        }).where(eq(storyBatchItemsTable.id, existingItem.id)).returning()
        : await db.insert(storyBatchItemsTable).values({
          batchId,
          sequence: index + 1,
          connectionId: connection.id,
          channelTitle,
          scriptJson: finalScriptJson,
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          hashtags: metadata.hashtags,
          avatarStoragePath,
          projectId: project.id,
          status: "starting",
        }).returning();
      const job = await startVideoGeneration(project.id, {
        format: "9:16",
        duration: batch.duration,
        style: "cinematic realistic storytelling with a channel-specific visual identity",
        tone: preferences.tone || "emotional and natural",
        voiceId: preferences.voiceId || undefined,
        voiceName: preferences.voiceName || undefined,
        chatId,
      });
      await db.update(storyBatchItemsTable).set({ jobId: job.id, status: "processing", updatedAt: new Date() })
        .where(eq(storyBatchItemsTable.id, item.id));
      await updateStoryProgress(batchId, sequence, "озвучка и MP4 запущены…");
      const monitorResult = await monitorStoryVideoJob(token, chatId, batchId, item.id, project.id, job.id);
      if (monitorResult !== "ready") {
        await db.update(storyBatchesTable).set({ status: "processing", updatedAt: new Date() })
          .where(eq(storyBatchesTable.id, batchId));
        if (monitorResult === "failed") {
          await completeStoryProgress(
            batchId,
            `⚠️ Подготовка остановлена на варианте ${sequence}/${selectedConnections.length}.\nНажмите «Повторить этот вариант», чтобы продолжить с него.`,
          );
        }
        return;
      }
    } catch (error) {
      await updateStoryProgress(batchId, sequence, "вариант не создан", "failed");
      logger.error({ err: error, chatId, batchId, connectionId: connection.id }, "Story variant generation failed");
      const [failedItem] = existingItem
        ? await db.update(storyBatchItemsTable).set({
          status: "failed",
          error: error instanceof Error ? error.message : "Не удалось создать вариант истории",
          updatedAt: new Date(),
        }).where(eq(storyBatchItemsTable.id, existingItem.id)).returning({ id: storyBatchItemsTable.id })
        : await db.insert(storyBatchItemsTable).values({
          batchId,
          sequence: index + 1,
          connectionId: connection.id,
          channelTitle,
          scriptJson: {},
          title: batch.title,
          description: "",
          tags: [],
          hashtags: [],
          status: "failed",
          error: error instanceof Error ? error.message : "Не удалось создать вариант истории",
        }).returning({ id: storyBatchItemsTable.id });
      await sendMessage(token, chatId, `❌ Вариант для ${connection.channelTitle || `канала #${connection.id}`} не создан: ${error instanceof Error ? error.message : "неизвестная ошибка"}`, {
        inline_keyboard: [[{
          text: "🔁 Повторить этот вариант",
          callback_data: `story:retry:${failedItem?.id ?? 0}`,
        }]],
      });
      await db.update(storyBatchesTable).set({ status: "processing", updatedAt: new Date() })
        .where(eq(storyBatchesTable.id, batchId));
      await completeStoryProgress(
        batchId,
        `⚠️ Подготовка остановлена на варианте ${sequence}/${selectedConnections.length}.\nДругие каналы не запускались. Повторите этот вариант после исправления ошибки.`,
      );
      return;
    }
  }
  await db.update(storyBatchesTable).set({ status: "processing", updatedAt: new Date() })
    .where(eq(storyBatchesTable.id, batchId));
  await maybeFinalizeStoryBatch(token, chatId, batchId);
}

async function releaseStoryAutomationBatch(batchId: number, lastError: string | null = null): Promise<void> {
  const [automation] = await db.select().from(storyAutomationsTable)
    .where(eq(storyAutomationsTable.activeBatchId, batchId));
  if (!automation) return;
  await db.update(storyAutomationsTable).set({
    activeBatchId: null,
    lastError,
    nextRunAt: new Date(Date.now() + automation.intervalMinutes * 60_000),
    updatedAt: new Date(),
  }).where(eq(storyAutomationsTable.chatId, automation.chatId));
}

const AUTOMATIC_FALLBACK_STORIES = [
  {
    title: "Записка в старой книге",
    baseScript: "В маленьком букинистическом магазине девушка купила старую книгу без обложки. Дома между страницами она нашла записку с сегодняшней датой и короткой просьбой: «Если ты это читаешь, не возвращай книгу на полку». Она решила выяснить, кто её написал. Продавец узнал почерк и рассказал, что эту книгу много лет назад оставил человек, который так и не вернулся за ней. Внутри девушка нашла второй лист с адресом. По адресу оказался закрытый дом, но сосед передал ей конверт, который хранил для неизвестного получателя. В конверте была фотография её матери в молодости и фраза: «Теперь ты знаешь, где началась наша история».",
  },
  {
    title: "Последний звонок",
    baseScript: "Мужчина случайно ответил на звонок с номера, которого не было в его контактах. На другом конце молчали, а потом тихо спросили: «Ты всё-таки пришёл?» Он решил, что это ошибка, но звонки повторялись каждый вечер в одно и то же время. Наконец он назвал адрес, который услышал в разговоре, и приехал туда. Это был старый вокзал, закрытый много лет назад. На скамейке лежал конверт с его детской фотографией и письмом от отца, которого он считал погибшим. Последняя строка объясняла, почему письмо пришло именно сейчас: его отец всё это время ждал, когда сын перестанет бояться узнать правду.",
  },
  {
    title: "Человек из соседнего окна",
    baseScript: "Каждое утро женщина видела в соседнем окне человека, который записывал что-то в блокнот. Однажды окно оказалось пустым, а на её подоконнике появилась записка: «Спасибо, что каждый день включали свет». Она спросила у соседей и узнала, что в квартире никто не жил уже несколько месяцев. Вечером женщина нашла в почтовом ящике старую фотографию своего дома. На обороте был адрес больницы и имя незнакомого человека. В больнице ей рассказали, что этот человек наблюдал за окнами, чтобы не забыть, ради чего он хочет вернуться домой. Но вернуться он уже не успел, а его последняя запись была о ней.",
  },
];

function fallbackAutomaticStorySeed(): { title: string; baseScript: string } {
  const index = Math.floor(Date.now() / (STORY_AUTOMATION_INTERVAL_MINUTES * 60_000))
    % AUTOMATIC_FALLBACK_STORIES.length;
  return AUTOMATIC_FALLBACK_STORIES[index]!;
}

async function generateAutomaticStorySeed(): Promise<{ title: string; baseScript: string }> {
  const prompt = [
    "Придумай новую короткую жизненную историю на русском языке для вертикального видео на 60 секунд.",
    "Нужен один понятный конфликт, развитие и неожиданный логичный финал.",
    "Не используй доставку, курьеров, рекламу, CTA, YouTube или AI, если это не является естественной частью сюжета.",
    "Верни только JSON: {\"title\":\"...\",\"story\":\"...\"}. История должна быть связным текстом для закадровой озвучки.",
  ].join("\n");
  if (openRouterConfig.apiKey) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(openRouterConfig.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openRouterConfig.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://replit.com",
            "X-Title": "AI Content Factory Story Automation",
          },
          body: JSON.stringify({
            model: openRouterConfig.model,
            messages: [
              { role: "system", content: "Ты быстро придумываешь короткие русские истории и возвращаешь только JSON." },
              { role: "user", content: prompt },
            ],
            max_tokens: 2_000,
            temperature: 0.9,
            response_format: { type: "json_object" },
          }),
          signal: AbortSignal.timeout(45_000),
        });
        if (!response.ok) throw new Error(`OpenRouter API error (${response.status})`);
        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error("AI returned an empty story");
        const start = content.indexOf("{");
        const end = content.lastIndexOf("}");
        const parsed = JSON.parse(start >= 0 && end > start ? content.slice(start, end + 1) : content) as {
          title?: unknown;
          story?: unknown;
        };
        if (typeof parsed.title !== "string" || typeof parsed.story !== "string"
          || parsed.title.trim().length < 2 || parsed.story.trim().length < 80) {
          throw new Error("AI returned an incomplete story");
        }
        return {
          title: parsed.title.trim().slice(0, 180),
          baseScript: parsed.story.trim().slice(0, STORY_CUSTOM_SCRIPT_MAX_CHARS),
        };
      } catch (error) {
        logger.warn({ err: error, attempt }, "Automatic story seed AI request failed; retrying");
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
  }
  logger.warn("Using built-in automatic story seed fallback");
  return fallbackAutomaticStorySeed();
}

async function runStoryAutomationOnce(token: string, automation: typeof storyAutomationsTable.$inferSelect): Promise<void> {
  if (automation.activeBatchId) {
    const [trackedBatch] = await db.select({ status: storyBatchesTable.status })
      .from(storyBatchesTable)
      .where(eq(storyBatchesTable.id, automation.activeBatchId));
    if (trackedBatch && !["completed", "cancelled"].includes(trackedBatch.status)) {
      await db.update(storyAutomationsTable).set({
        nextRunAt: new Date(Date.now() + automation.intervalMinutes * 60_000),
        updatedAt: new Date(),
      }).where(eq(storyAutomationsTable.chatId, automation.chatId));
      return;
    }
    await db.update(storyAutomationsTable).set({
      activeBatchId: null,
      updatedAt: new Date(),
    }).where(eq(storyAutomationsTable.chatId, automation.chatId));
  }
  const currentBatch = await getActiveStoryBatch(automation.chatId);
  if (currentBatch) {
    await db.update(storyAutomationsTable).set({
      nextRunAt: new Date(Date.now() + automation.intervalMinutes * 60_000),
      lastError: "Пропущен запуск: предыдущая история ещё готовится.",
      updatedAt: new Date(),
    }).where(eq(storyAutomationsTable.chatId, automation.chatId));
    return;
  }

  const connections = await listYoutubeConnections();
  const connectionIds = storyAutomationConnectionIds(automation);
  const selectedConnections = connectionIds
    .map((id) => connections.find((connection) => connection.id === id))
    .filter((connection): connection is (typeof connections)[number] => Boolean(connection));
  if (!selectedConnections.length) {
    throw new Error("Сохранённые YouTube-каналы больше не подключены.");
  }

  await sendMessage(token, automation.chatId, "🤖 Автовыпуск: придумываю новую историю для выбранных каналов…");
  const seed = await generateAutomaticStorySeed();
  const backgroundStoragePath = await getStoryBackgroundStoragePath();
  const banner = await getDefaultVideoCutBanner();
  if (!banner) throw new Error("Обязательный NOX-баннер недоступен.");
  const [batch] = await db.insert(storyBatchesTable).values({
    chatId: automation.chatId,
    title: seed.title,
    baseScript: seed.baseScript,
    duration: STORY_DURATION_SECONDS,
    backgroundStoragePath,
    bannerStoragePath: banner.storagePath,
    bannerKind: banner.kind,
    connectionIds,
    status: "choosing_banner",
    metadata: {
      automated: true,
      automationPrivacyStatus: automation.privacyStatus === "private" ? "private" : "public",
    },
  }).returning();
  if (!batch) throw new Error("Не удалось создать автоматический batch истории.");
  await db.update(storyAutomationsTable).set({
    activeBatchId: batch.id,
    lastRunAt: new Date(),
    nextRunAt: new Date(Date.now() + automation.intervalMinutes * 60_000),
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(storyAutomationsTable.chatId, automation.chatId));
  await sendMessage(
    token,
    automation.chatId,
    `🤖 История «${seed.title}» запущена.\nКаналов: ${selectedConnections.length}.\nПосле подготовки весь пакет будет опубликован автоматически.`,
  );
  await startStoryBatchGeneration(token, automation.chatId, batch.id);
}

async function runStoryAutomationScheduler(token: string): Promise<void> {
  const now = Date.now();
  const automations = await db.select().from(storyAutomationsTable)
    .where(eq(storyAutomationsTable.enabled, true));
  for (const automation of automations) {
    if (storyAutomationRunningChats.has(automation.chatId)) continue;
    if (automation.nextRunAt && automation.nextRunAt.getTime() > now) continue;
    storyAutomationRunningChats.add(automation.chatId);
    runTelegramBackgroundTask(
      runStoryAutomationOnce(token, automation)
        .catch(async (error) => {
          const message = error instanceof Error ? error.message : "Автоматический выпуск не удалось запустить.";
          await db.update(storyAutomationsTable).set({
            lastError: message,
            nextRunAt: new Date(Date.now() + automation.intervalMinutes * 60_000),
            updatedAt: new Date(),
          }).where(eq(storyAutomationsTable.chatId, automation.chatId));
          await sendMessage(token, automation.chatId, `❌ Автовыпуск не запущен: ${message}`).catch(() => undefined);
        })
        .finally(() => {
          storyAutomationRunningChats.delete(automation.chatId);
        }),
      { chatId: automation.chatId, task: "story-automation" },
    );
  }
}

async function resumeInterruptedStoryBatches(token: string): Promise<void> {
  const batches = await db.select().from(storyBatchesTable)
    .where(eq(storyBatchesTable.status, "generating"));
  for (const batch of batches) {
    const items = await db.select({ id: storyBatchItemsTable.id })
      .from(storyBatchItemsTable)
      .where(eq(storyBatchItemsTable.batchId, batch.id))
      .limit(1);
    if (items.length > 0) continue;
    const banner = batch.bannerStoragePath
      ? { storagePath: batch.bannerStoragePath, kind: batch.bannerKind === "video" ? "video" as const : "image" as const }
      : await getDefaultVideoCutBanner();
    if (!banner) {
      logger.error({ batchId: batch.id }, "Cannot recover story batch because mandatory banner is unavailable");
      continue;
    }
    await db.update(storyBatchesTable).set({
      status: "choosing_banner",
      bannerStoragePath: banner.storagePath,
      bannerKind: banner.kind,
      updatedAt: new Date(),
    }).where(eq(storyBatchesTable.id, batch.id));
    await sendMessage(
      token,
      batch.chatId,
      "🔄 После перезапуска API продолжаю подготовку истории с первого варианта.",
    );
    runStoryBatchGenerationInBackground(token, batch.chatId, batch.id);
  }
}

async function resumeInterruptedStoryItemMonitors(token: string): Promise<void> {
  const items = await db.select().from(storyBatchItemsTable)
    .where(and(
      eq(storyBatchItemsTable.status, "processing"),
      isNotNull(storyBatchItemsTable.jobId),
      isNotNull(storyBatchItemsTable.projectId),
    ));
  for (const item of items) {
    if (!item.jobId || !item.projectId) continue;
    const [batch] = await db.select({
      chatId: storyBatchesTable.chatId,
      status: storyBatchesTable.status,
    })
      .from(storyBatchesTable)
      .where(eq(storyBatchesTable.id, item.batchId));
    if (!batch) continue;
    if (["cancelled", "completed"].includes(batch.status)) {
      await db.update(storyBatchItemsTable).set({
        status: "cancelled",
        updatedAt: new Date(),
      }).where(eq(storyBatchItemsTable.id, item.id));
      continue;
    }
    runStoryMonitorInBackground(
      monitorStoryVideoJob(token, batch.chatId, item.batchId, item.id, item.projectId, item.jobId),
      { chatId: batch.chatId, projectId: item.projectId, jobId: item.jobId, task: "story-video-monitor-recovery" },
    );
  }
}

async function isStoryProject(projectId: number): Promise<boolean> {
  const [item] = await db.select({ id: storyBatchItemsTable.id })
    .from(storyBatchItemsTable)
    .where(eq(storyBatchItemsTable.projectId, projectId))
    .limit(1);
  return Boolean(item);
}

function storyVariantInstructions(title: string, baseScript: string, channelTitle: string): string {
  return [
    "Пользователь прислал готовое название и исходную историю. Сделай самостоятельный вариант только на её основе.",
    "Сохрани основную суть, ключевую причинно-следственную связь и финальный смысл.",
    "Перефразируй текст, слегка измени имена персонажей и второстепенные детали, но не добавляй новый главный конфликт или факты.",
    "Это не чат-переписка: voice_text каждой сцены — связный текст закадрового рассказчика.",
    "Не добавляй рекламу, CTA, упоминание канала, YouTube, баннера или генерации изображений.",
    "Каждая сцена должна иметь положительную целую длительность, а сумма duration_seconds сцен должна быть ровно 60.",
    `Название пользователя: ${title}`,
    `Исходная история пользователя:\n${baseScript}`,
    `Канал-вариант: ${channelTitle}. Сделай формулировки и заголовок отличающимися от других вариантов.`,
  ].join("\n\n");
}

async function retryStoryVariant(token: string, chatId: number, itemId: number): Promise<void> {
  const item = await getStoryItemForChat(chatId, itemId, ["failed"]);
  if (!item) throw new Error("Не найден вариант истории для повторной подготовки.");
  const [batch] = await db.select().from(storyBatchesTable).where(and(
    eq(storyBatchesTable.id, item.batchId),
    eq(storyBatchesTable.chatId, chatId),
  ));
  if (!batch) throw new Error("Пакет истории не найден.");
  const connections = await listYoutubeConnections();
  const connection = connections.find((candidate) => candidate.id === item.connectionId);
  if (!connection) throw new Error("Выбранный YouTube-канал больше не подключён.");
  const preferences = await getChatPreferences(chatId);

  await db.update(storyBatchItemsTable).set({
    status: "starting",
    error: null,
    updatedAt: new Date(),
  }).where(eq(storyBatchItemsTable.id, itemId));

  try {
    await sendMessage(token, chatId, `🔁 Повторно готовлю вариант для «${item.channelTitle}»…`);
    const script = await generateVideoScript({
      topic: `${batch.title} · версия для канала ${item.channelTitle}`,
      format: "Story 9:16",
      duration: batch.duration,
      style: "cinematic realistic storytelling with a channel-specific visual identity",
      tone: preferences.tone || "emotional and natural",
      instructions: storyVariantInstructions(batch.title, batch.baseScript, item.channelTitle),
    });
    script.cta = "";
    const metadata = await generateYoutubeMetadata({
      title: script.title,
      topic: `${batch.title}. Канал: ${item.channelTitle}`,
      description: script.description,
      scriptText: script.scenes.map((scene) => scene.voice_text).join("\n"),
    });
    const visuals = await prepareStoryChannelVisuals(
      token,
      chatId,
      batch.id,
      item.connectionId,
      item.channelTitle,
      script,
      batch.backgroundStoragePath,
    );
    const scriptJson = {
      ...script,
      story_banner_storage_path: batch.bannerStoragePath,
      story_banner_kind: batch.bannerKind,
      story_channel_visual_pool_size: visuals.length,
      story_channel_connection_id: item.connectionId,
    };
    const [project] = await db.insert(projectsTable).values({
      title: script.title.slice(0, 180),
      topic: `История: ${batch.title} · ${item.channelTitle}`,
      format: "Story 9:16",
      duration: batch.duration,
      style: "cinematic realistic storytelling with a channel-specific visual identity",
      tone: preferences.tone || "emotional and natural",
      scriptJson,
      status: "completed",
    }).returning({ id: projectsTable.id });
    const avatarStoragePath = await attachStoryVisualsToProject(project.id, script, visuals);
    const finalScriptJson = { ...scriptJson, story_avatar_storage_path: avatarStoragePath };
    await db.update(projectsTable).set({ scriptJson: finalScriptJson }).where(eq(projectsTable.id, project.id));
    await db.update(storyBatchItemsTable).set({
      scriptJson: finalScriptJson,
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      hashtags: metadata.hashtags,
      avatarStoragePath,
      projectId: project.id,
      jobId: null,
      status: "starting",
      updatedAt: new Date(),
    }).where(eq(storyBatchItemsTable.id, itemId));
    const job = await startVideoGeneration(project.id, {
      format: "9:16",
      duration: batch.duration,
      style: "cinematic realistic storytelling with a channel-specific visual identity",
      tone: preferences.tone || "emotional and natural",
      voiceId: preferences.voiceId || undefined,
      voiceName: preferences.voiceName || undefined,
      chatId,
    });
    await db.update(storyBatchItemsTable).set({
      jobId: job.id,
      status: "processing",
      updatedAt: new Date(),
    }).where(eq(storyBatchItemsTable.id, itemId));
    const monitorResult = await monitorStoryVideoJob(token, chatId, batch.id, itemId, project.id, job.id);
    if (monitorResult === "ready") {
      await db.update(storyBatchesTable).set({
        status: "choosing_banner",
        updatedAt: new Date(),
      }).where(eq(storyBatchesTable.id, batch.id));
      runStoryBatchGenerationInBackground(token, chatId, batch.id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось повторить вариант истории";
    await db.update(storyBatchItemsTable).set({
      status: "failed",
      error: message,
      updatedAt: new Date(),
    }).where(eq(storyBatchItemsTable.id, itemId));
    await sendMessage(token, chatId, `❌ Повторная подготовка не удалась: ${message}`, {
      inline_keyboard: [[{ text: "🔁 Повторить ещё раз", callback_data: `story:retry:${itemId}` }]],
    });
  }
}

async function maybeFinalizeStoryBatch(token: string, chatId: number, batchId: number): Promise<void> {
  const [batch] = await db.select().from(storyBatchesTable).where(and(
    eq(storyBatchesTable.id, batchId),
    eq(storyBatchesTable.chatId, chatId),
  ));
  if (!batch) return;
  if (["cancelled", "completed"].includes(batch.status)) return;
  const items = await db.select().from(storyBatchItemsTable)
    .where(eq(storyBatchItemsTable.batchId, batchId))
    .orderBy(storyBatchItemsTable.sequence);
  const expectedItemCount = storyConnectionIds(batch).length;
  if (!items.length || items.length < expectedItemCount || items.some((item) => !["awaiting_publish", "published"].includes(item.status))) return;
  if (items.every((item) => item.status === "published")) {
    await db.update(storyBatchesTable).set({ status: "completed", updatedAt: new Date() })
      .where(eq(storyBatchesTable.id, batchId));
    await completeStoryProgress(batchId, "✅ Все варианты истории опубликованы.");
    await releaseStoryAutomationBatch(batchId);
    return;
  }
  const [lockedBatch] = await db.update(storyBatchesTable).set({
    status: "awaiting_publish",
    updatedAt: new Date(),
  }).where(and(
    eq(storyBatchesTable.id, batchId),
    eq(storyBatchesTable.status, "processing"),
  )).returning();
  if (!lockedBatch) return;
  await completeStoryProgress(
    batchId,
    `✅ Все ${items.length} вариантов истории готовы к публикации.\n\nТеперь выберите публикацию для всех каналов кнопкой ниже.`,
  );
  const automation = storyBatchAutomationSettings(batch);
  if (automation.enabled) {
    await sendMessage(token, chatId, [
      `✅ Все ${items.length} вариантов истории готовы.`,
      "",
      "🤖 Автовыпуск включён — начинаю открытую публикацию всего пакета.",
    ].join("\n"));
    await publishStoryBatch(token, chatId, batchId, automation.privacyStatus);
    return;
  }
  await sendMessage(token, chatId, [
    `✅ Все ${items.length} вариантов истории готовы.`,
    "",
    ...items.map((item) => `• ${item.channelTitle} — ${item.title}`),
    "",
    "Для каждого канала сохранены свой заголовок, описание, хэштеги и собственная картинка на весь ролик.",
    "Выберите режим — бот загрузит весь пакет разом на выбранные каналы:",
  ].join("\n"), {
    inline_keyboard: [
      [{ text: "🌍 Опубликовать всё открыто", callback_data: `story:publish_all:public:${batchId}` }],
      [{ text: "🔒 Опубликовать всё приватно", callback_data: `story:publish_all:private:${batchId}` }],
    ],
  });
}

async function publishStoryBatch(
  token: string,
  chatId: number,
  batchId: number,
  privacy: "public" | "private",
): Promise<void> {
  const [batch] = await db.select().from(storyBatchesTable).where(and(
    eq(storyBatchesTable.id, batchId),
    eq(storyBatchesTable.chatId, chatId),
    inArray(storyBatchesTable.status, ["awaiting_publish", "processing"]),
  ));
  if (!batch) throw new Error("Пакет истории уже опубликован или не готов.");
  const items = await db.select().from(storyBatchItemsTable)
    .where(and(
      eq(storyBatchItemsTable.batchId, batchId),
      eq(storyBatchItemsTable.status, "awaiting_publish"),
    ))
    .orderBy(storyBatchItemsTable.sequence);
  if (!items.length) throw new Error("Нет готовых вариантов для публикации.");

  await db.update(storyBatchesTable).set({ status: "publishing", updatedAt: new Date() })
    .where(eq(storyBatchesTable.id, batchId));
  await sendMessage(token, chatId, `🚀 Начинаю общую загрузку ${items.length} вариантов на YouTube…`);

  for (const [index, item] of items.entries()) {
    try {
      if (!item.projectId || !item.jobId) throw new Error("У варианта нет готового проекта или job.");
      const [job] = await db.select().from(videoGenerationJobsTable).where(and(
        eq(videoGenerationJobsTable.id, item.jobId),
        eq(videoGenerationJobsTable.projectId, item.projectId),
        eq(videoGenerationJobsTable.status, "completed"),
      ));
      if (!job?.videoStoragePath) throw new Error("Готовый MP4 не найден.");
      const metadata = {
        title: item.title,
        description: item.description,
        tags: Array.isArray(item.tags) ? item.tags.filter((value): value is string => typeof value === "string") : [],
        hashtags: Array.isArray(item.hashtags) ? item.hashtags.filter((value): value is string => typeof value === "string") : [],
      };
      const thumbnail = item.avatarStoragePath ? await readAudioAsset(item.avatarStoragePath) : undefined;
      await sendMessage(token, chatId, `⏳ ${index + 1}/${items.length}: загружаю «${item.channelTitle}»…`);
      const result = await uploadYoutubeShort({
        videoStoragePath: job.videoStoragePath,
        title: metadata.title,
        description: `${metadata.description}\n\n${metadata.hashtags.join(" ")}`,
        tags: metadata.tags,
        thumbnail,
        thumbnailContentType: "image/png",
        connectionId: item.connectionId,
        privacyStatus: privacy,
        preserveDescription: false,
      });
      await updateStoryProgress(batchId, item.sequence, "видео опубликовано", "ready");
      await db.update(storyBatchItemsTable).set({
        status: "published",
        publishedVideoId: result.videoId,
        publishedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(storyBatchItemsTable.id, item.id));
      await sendMessage(token, chatId, `✅ ${item.channelTitle}: https://youtu.be/${result.videoId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ошибка публикации";
      await db.update(storyBatchItemsTable).set({
        status: "awaiting_publish",
        error: message,
        updatedAt: new Date(),
      }).where(eq(storyBatchItemsTable.id, item.id));
      await sendMessage(token, chatId, `❌ ${item.channelTitle}: ${message}`);
    }
  }
  await db.update(storyBatchesTable).set({ status: "processing", updatedAt: new Date() })
    .where(eq(storyBatchesTable.id, batchId));
  await maybeFinalizeStoryBatch(token, chatId, batchId);
  const remainingAwaiting = await db.select({ id: storyBatchItemsTable.id })
    .from(storyBatchItemsTable)
    .where(and(
      eq(storyBatchItemsTable.batchId, batchId),
      eq(storyBatchItemsTable.status, "awaiting_publish"),
    ));
  if (remainingAwaiting.length) {
    await releaseStoryAutomationBatch(batchId, "Часть автоматических публикаций не прошла.");
  }
}

async function monitorStoryVideoJob(
  token: string,
  chatId: number,
  batchId: number,
  itemId: number,
  projectId: number,
  jobId: number,
): Promise<"ready" | "failed" | "cancelled"> {
  for (let attempt = 0; attempt < 360; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    const [batchState] = await db.select({ status: storyBatchesTable.status })
      .from(storyBatchesTable)
      .where(eq(storyBatchesTable.id, batchId));
    if (batchState?.status === "cancelled") {
      await db.update(storyBatchItemsTable).set({
        status: "cancelled",
        updatedAt: new Date(),
      }).where(eq(storyBatchItemsTable.id, itemId));
      return "cancelled";
    }
    const [job] = await db.select().from(videoGenerationJobsTable).where(eq(videoGenerationJobsTable.id, jobId));
    if (!job) return "failed";
    if (job.status === "failed") {
      const [failedItem] = await db.select({ sequence: storyBatchItemsTable.sequence })
        .from(storyBatchItemsTable)
        .where(eq(storyBatchItemsTable.id, itemId));
      if (failedItem) {
        await updateStoryProgress(batchId, failedItem.sequence, "подготовка MP4 завершилась с ошибкой", "failed");
      }
      await db.update(storyBatchItemsTable).set({
        status: "failed",
        error: job.error || "Pipeline истории завершился с ошибкой",
        updatedAt: new Date(),
      }).where(eq(storyBatchItemsTable.id, itemId));
      await sendMessage(token, chatId, `❌ Вариант истории для канала не собран.\n${formatPipelineError(job.currentStage, job.error)}`);
      return "failed";
    }
    if (job.status === "completed" && job.videoStoragePath) {
      const [item] = await db.select().from(storyBatchItemsTable).where(and(
        eq(storyBatchItemsTable.id, itemId),
        eq(storyBatchItemsTable.batchId, batchId),
      ));
       if (!item) return "failed";
      const [batch] = await db.select().from(storyBatchesTable)
        .where(eq(storyBatchesTable.id, batchId));
       if (!batch) return "failed";
      let bannerStoragePath = batch.bannerStoragePath;
      let bannerKind = batch.bannerKind === "video" ? "video" as const : "image" as const;
      if (!bannerStoragePath) {
        const defaultBanner = await getDefaultVideoCutBanner();
        if (!defaultBanner) {
          await db.update(storyBatchItemsTable).set({
            status: "failed",
            error: "Обязательный NOX-баннер недоступен.",
            updatedAt: new Date(),
          }).where(eq(storyBatchItemsTable.id, itemId));
          await sendMessage(token, chatId, "❌ Не удалось добавить обязательный NOX-баннер к ролику.");
           return "failed";
        }
        bannerStoragePath = defaultBanner.storagePath;
        bannerKind = defaultBanner.kind;
        await db.update(storyBatchesTable).set({
          bannerStoragePath,
          bannerKind,
          updatedAt: new Date(),
        }).where(eq(storyBatchesTable.id, batchId));
      }
      const [project] = await db.select().from(projectsTable)
        .where(eq(projectsTable.id, projectId));
      const projectMetadata = project?.scriptJson && typeof project.scriptJson === "object"
        ? project.scriptJson as Record<string, unknown>
        : {};
      if (project && projectMetadata.story_banner_storage_path !== bannerStoragePath) {
        const updatedScriptJson = {
          ...projectMetadata,
          story_banner_storage_path: bannerStoragePath,
          story_banner_kind: bannerKind,
        };
        await db.update(projectsTable).set({ scriptJson: updatedScriptJson })
          .where(eq(projectsTable.id, projectId));
        await updateStoryProgress(batchId, item.sequence, "добавляю обязательный баннер и пересобираю MP4…");
        const rebuiltJob = await rebuildVideoWithExistingAssets(projectId, jobId);
        await db.update(storyBatchItemsTable).set({
          jobId: rebuiltJob.id,
          status: "processing",
          error: null,
          updatedAt: new Date(),
        }).where(eq(storyBatchItemsTable.id, itemId));
        await sendMessage(token, chatId, `🟩 Добавляю обязательный NOX-баннер в ролик для «${item.channelTitle}» и пересобираю MP4 без повторной генерации исходных материалов.`);
         return monitorStoryVideoJob(token, chatId, batchId, itemId, projectId, rebuiltJob.id);
      }
      await updateStoryProgress(batchId, item.sequence, "MP4 готов к проверке", "ready");
      await db.update(storyBatchItemsTable).set({ status: "awaiting_publish", updatedAt: new Date() })
        .where(eq(storyBatchItemsTable.id, itemId));
      await sendMessage(token, chatId, `✅ Вариант для «${item.channelTitle}» подготовлен: ${item.title}`);
      await maybeFinalizeStoryBatch(token, chatId, batchId);
       return "ready";
    }
    if (attempt % 4 === 0) await sendMessage(token, chatId, `⏳ История для канала готовится: ${job.progress}%`);
  }
  await updateStoryProgress(batchId, (await db.select({ sequence: storyBatchItemsTable.sequence })
    .from(storyBatchItemsTable)
    .where(eq(storyBatchItemsTable.id, itemId)))[0]?.sequence || 1, "подготовка заняла слишком много времени", "failed");
  await sendMessage(token, chatId, "⏳ Подготовка истории заняла слишком много времени. Проверьте состояние позже.");
  return "failed";
}

async function getStoryItemForChat(
  chatId: number,
  itemId: number,
  statuses: string[],
) {
  const [item] = await db.select().from(storyBatchItemsTable).where(and(
    eq(storyBatchItemsTable.id, itemId),
    inArray(storyBatchItemsTable.status, statuses),
  ));
  if (!item) return undefined;
  const [batch] = await db.select({ chatId: storyBatchesTable.chatId })
    .from(storyBatchesTable)
    .where(and(
      eq(storyBatchesTable.id, item.batchId),
      eq(storyBatchesTable.chatId, chatId),
    ));
  return batch ? item : undefined;
}

function mainMenu(): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "🧩 Рекламный конструктор", callback_data: "menu:ad_constructor" }],
      [{ text: "💬 Чат-переписка — до 2 минут", callback_data: "menu:chat" }],
      [{ text: "📖 История", callback_data: "menu:story" }],
      [{ text: "✨ Уникализировать видео", callback_data: "menu:adapt_video" }],
      [{ text: "🎭 Добавить стримера", callback_data: "menu:reaction" }],
      [{ text: "✂️ Нарезка видео", callback_data: "menu:video_cuts" }],
      [{ text: "📺 Каналы", callback_data: "menu:youtube_channels" }],
      [{ text: "📷 Instagram", callback_data: "menu:instagram_accounts" }],
      [{ text: "🗑 Мусор / Дополнительно", callback_data: "menu:trash" }],
    ],
  };
}

function trashMenu(): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "🎬 Создать видео", callback_data: "menu:create" }],
      [{ text: "🎞 Длинное видео — до 20 минут", callback_data: "menu:long_video" }],
      [{ text: "📺 Сериал", callback_data: "menu:series" }],
      [
        { text: "📝 Пожелания к сценарию", callback_data: "menu:script" },
        { text: "🎙 Выбрать голос", callback_data: "menu:voice" },
      ],
      [
        { text: "🎨 Стиль", callback_data: "menu:style" },
        { text: "⏱ Длительность", callback_data: "menu:duration" },
      ],
      [
        { text: "🎭 Настроение", callback_data: "menu:tone" },
        { text: "⚙️ Текущие настройки", callback_data: "menu:settings" },
      ],
      [{ text: "📱 Платформа", callback_data: "menu:platform" }],
      [
        { text: "📤 Подготовить публикацию", callback_data: "menu:youtube" },
      ],
      [{ text: "⬅️ Главное меню", callback_data: "menu:home" }],
    ],
  };
}

async function sendMainMenu(token: string, chatId: number, text = "Что хотите сделать?"): Promise<void> {
  await sendMessage(token, chatId, text, mainMenu());
}

function adRouteLabel(route: AdPlan["route"]): string {
  return {
    create: "создать ролик с нуля",
    process: "обработать готовое видео",
    cuts: "сделать нарезку",
    hybrid: "гибрид: готовые материалы + новые сцены",
  }[route];
}

function formatAdPlan(plan: AdPlan, assetCount: number): string {
  return [
    "🧩 РЕКЛАМНЫЙ КОНСТРУКТОР",
    "",
    `💡 Идея: ${plan.idea}`,
    "",
    `🛣 Маршрут: ${adRouteLabel(plan.route)}`,
    `⏱ Длительность: ${plan.duration_seconds} сек.`,
    `🎙 Озвучка: ${plan.voiceover === "synthetic" ? "синтетическая" : plan.voiceover === "original" ? "сохранить оригинальную" : "без озвучки"}`,
    plan.cta ? `📣 CTA: ${plan.cta}` : "📣 CTA: не задан",
    "",
    `Почему так: ${plan.rationale}`,
    "",
    "Что получится:",
    ...plan.deliverables.map((item) => `• ${item}`),
    "",
    "Шаги производства:",
    ...plan.production_steps.map((item, index) => `${index + 1}. ${item}`),
    "",
    `Материалов загружено: ${assetCount}`,
    plan.required_assets.length ? `Нужно ещё: ${plan.required_assets.join("; ")}` : "Дополнительные материалы не обязательны.",
    plan.risks.length ? `\nОграничения: ${plan.risks.join("; ")}` : "",
    "",
    "Запуск начнётся только после подтверждения маршрута.",
  ].join("\n");
}

async function showAdConstructorStart(token: string, chatId: number): Promise<void> {
  pendingAdByChat.set(chatId, { brief: "", assets: [] });
  await updateChatPreferences(chatId, { pendingAction: "ad_brief" });
  await sendMessage(token, chatId, [
    "🧩 Рекламный конструктор",
    "",
    "Отправьте рекламное ТЗ одним сообщением: продукт, аудитория, цель, оффер, стиль, ограничения и желаемый CTA.",
    "",
    "После этого можно прислать баннеры, фото и исходные MP4. Я сначала предложу идею и маршрут: с нуля, готовое видео, нарезка или гибрид.",
    "Производство начнётся только после вашего подтверждения.",
    "",
    "Для отмены отправьте /cancel.",
  ].join("\n"));
}

async function showAdAssetsPrompt(token: string, chatId: number): Promise<void> {
  const session = pendingAdByChat.get(chatId);
  if (!session) throw new Error("Сессия рекламного конструктора не найдена.");
  await updateChatPreferences(chatId, { pendingAction: "ad_assets" });
  await sendMessage(token, chatId, [
    "✅ ТЗ принято.",
    "",
    "Теперь отправьте изображения, баннеры или готовые MP4 по одному сообщению.",
    `Уже загружено: ${session.assets.length}.`,
    "Когда закончите, нажмите «Разобрать ТЗ». Можно продолжить без материалов.",
  ].join("\n"), {
    inline_keyboard: [
      [{ text: "🧠 Разобрать ТЗ и предложить маршрут", callback_data: "ad:analyze" }],
      [{ text: "❌ Отмена", callback_data: "ad:cancel" }],
    ],
  });
}

async function analyzePendingAd(token: string, chatId: number): Promise<void> {
  const session = pendingAdByChat.get(chatId);
  if (!session?.brief.trim()) throw new Error("Сначала отправьте рекламное ТЗ.");
  await updateChatPreferences(chatId, { pendingAction: null });
  await sendMessage(token, chatId, "🧠 Анализирую ТЗ и материалы, выбираю лучший маршрут производства…");
  const plan = await analyzeAdBrief({
    brief: session.brief,
    assets: session.assets.map(({ kind, name }) => ({ kind, name })),
  });
  session.plan = plan;
  await sendMessage(token, chatId, formatAdPlan(plan, session.assets.length), {
    inline_keyboard: [
      [{ text: "✅ Подтвердить маршрут и собрать MP4", callback_data: "ad:confirm" }],
      [{ text: "✏️ Изменить ТЗ", callback_data: "ad:edit" }],
      [{ text: "❌ Отмена", callback_data: "ad:cancel" }],
    ],
  });
}

async function attachAdImagesToProject(projectId: number, assets: PendingAdAsset[], script: VideoScript): Promise<void> {
  const images = assets.filter((asset) => asset.kind === "image");
  if (!images.length || !script.scenes.length) return;
  await db.insert(generatedImagesTable).values(images.slice(0, script.scenes.length).map((asset, index) => {
    const scene = script.scenes[index % script.scenes.length]!;
    return {
      projectId,
      sceneId: scene.scene_number,
      prompt: scene.image_prompt || scene.visual_description || "Изображение из рекламного ТЗ",
      negativePrompt: "",
      provider: "telegram-upload",
      model: "ad-constructor",
      aspectRatio: "9:16",
      width: 1080,
      height: 1920,
      status: "completed" as const,
      imageUrl: `/api/storage${asset.storagePath}`,
      storagePath: asset.storagePath,
      error: null,
      version: 1,
      isPrimary: true,
    };
  }));
}

async function runAdCreate(token: string, chatId: number, session: PendingAdSession, plan: AdPlan): Promise<void> {
  const preferences = await getChatPreferences(chatId);
  const script = await generateVideoScript({
    topic: plan.idea,
    format: "Ad 9:16",
    duration: plan.duration_seconds,
    style: "commercial cinematic",
    tone: "persuasive and clear",
    instructions: [
      `Рекламное ТЗ пользователя:\n${session.brief}`,
      `Креативная идея:\n${plan.idea}`,
      `Оффер и CTA:\n${plan.cta || "без отдельного CTA"}`,
      "Сделай короткий вертикальный рекламный ролик. Не добавляй факты, цены и обещания, которых нет в ТЗ.",
      "Визуальные указания держи в visual_description и image_prompt, а в voice_text оставляй только произносимый текст.",
      "Учитывай загруженные пользователем изображения как референсы продукта и бренда.",
    ].join("\n\n"),
  });
  script.cta = plan.cta;
  const [project] = await db.insert(projectsTable).values({
    title: plan.idea.slice(0, 180),
    topic: session.brief.slice(0, 500),
    format: "Ad 9:16",
    duration: plan.duration_seconds,
    style: "commercial cinematic",
    tone: "persuasive and clear",
    scriptJson: script,
    status: "completed",
  }).returning({ id: projectsTable.id });
  await attachAdImagesToProject(project.id, session.assets, script);
  lastProjectByChat.set(chatId, project.id);
  const job = await startVideoGeneration(project.id, {
    format: "9:16",
    duration: plan.duration_seconds,
    style: "commercial cinematic",
    tone: "persuasive and clear",
    voiceId: plan.voiceover === "none" ? undefined : preferences.voiceId || undefined,
    voiceName: preferences.voiceName || undefined,
    chatId,
  });
  await sendMessage(token, chatId, `✅ Маршрут подтверждён: ${adRouteLabel(plan.route)}.\n🎬 Сборка рекламного ролика запущена.\nГотово: ${job.progress}%`);
  runTelegramBackgroundTask(monitorVideoJob(token, chatId, project.id, job.id), {
    chatId,
    projectId: project.id,
    jobId: job.id,
    task: "ad-constructor-create",
  });
}

async function runAdProcess(token: string, chatId: number, session: PendingAdSession, plan: AdPlan): Promise<void> {
  const source = session.assets.find((asset) => asset.kind === "video");
  if (!source) throw new Error("Для этого маршрута нужен готовый MP4. Отправьте его в рекламный конструктор.");
  await sendMessage(token, chatId, "🎬 Обрабатываю готовое видео по утверждённому рекламному маршруту…");
  const output = await adaptVideoAsset(source.storagePath);
  await sendVideo(token, chatId, await readAudioAsset(output), "✅ Рекламный MP4 готов. Перехожу к подготовке публикации.");
  await prepareYoutubePublicationForStorage(
    token,
    chatId,
    output,
    plan.idea,
    `${session.brief}\n\n${plan.cta}`.slice(0, 5000),
    plan.idea,
    0,
  );
}

async function runAdCuts(token: string, chatId: number, session: PendingAdSession, plan: AdPlan): Promise<void> {
  const source = session.assets.find((asset) => asset.kind === "video");
  if (!source) throw new Error("Для нарезки нужен готовый MP4. Отправьте его в рекламный конструктор.");
  const requestedCount = Math.min(Math.max(Number(plan.deliverables.find((item) => /\d+/.test(item))?.match(/\d+/)?.[0] || 3), 1), 15);
  pendingVideoCutCountByChat.set(chatId, requestedCount);
  pendingVideoCutSourceByChat.set(chatId, {
    sourceUrl: "uploaded://ad-constructor-video",
    sourceStoragePath: source.storagePath,
    connectionIds: [],
  });
  await updateChatPreferences(chatId, { pendingAction: "cut_channel_choice" });
  await sendMessage(token, chatId, `✅ Маршрут подтверждён: ${adRouteLabel(plan.route)}.\nВыберите каналы для ${requestedCount} отдельных рекламных фрагментов.`);
  await showVideoCutChannelChoice(token, chatId);
}

async function confirmAdRoute(token: string, chatId: number): Promise<void> {
  const session = pendingAdByChat.get(chatId);
  const plan = session?.plan;
  if (!session || !plan) throw new Error("План рекламного конструктора устарел. Запустите анализ ТЗ заново.");
  pendingAdByChat.delete(chatId);
  await updateChatPreferences(chatId, { pendingAction: null });
  if (plan.route === "create" || (plan.route === "hybrid" && !session.assets.some((asset) => asset.kind === "video"))) {
    await runAdCreate(token, chatId, session, plan);
  } else if (plan.route === "cuts") {
    await runAdCuts(token, chatId, session, plan);
  } else {
    await runAdProcess(token, chatId, session, plan);
  }
}

export async function handleLargeAdVideoUpload(chatId: number, storagePath: string, fileName: string): Promise<void> {
  const session = pendingAdByChat.get(chatId);
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!session || !token) throw new Error("Сессия рекламного конструктора устарела.");
  session.assets.push({ kind: "video", storagePath, name: fileName || "uploaded-video.mp4" });
  await updateChatPreferences(chatId, { pendingAction: "ad_assets" });
  await sendMessage(token, chatId, `✅ Большой MP4 добавлен в рекламный конструктор: ${fileName || "uploaded-video.mp4"}.\nМатериалов: ${session.assets.length}.`);
}

export async function handleLargeVideoCutUpload(chatId: number, storagePath: string, fileName: string): Promise<void> {
  const request = pendingVideoCutSourceByChat.get(chatId);
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!request || !token) throw new Error("Сессия нарезки закончилась. Начните нарезку заново.");
  request.sourceUrl = "uploaded://web-video";
  request.sourceStoragePath = storagePath;
  await updateChatPreferences(chatId, { pendingAction: "cut_channel_choice" });
  await sendMessage(token, chatId, [
    `✅ Исходный MP4 загружен: ${fileName || "cut-source.mp4"}.`,
    "Продолжаю нарезку без повторного выбора сохранённых каналов.",
  ].join("\n"));
  await showVideoCutChannelChoice(token, chatId);
}

async function showTrashMenu(token: string, chatId: number): Promise<void> {
  await sendMessage(
    token,
    chatId,
    "🗑 Дополнительные функции. Ничего не удалено — разделы просто убраны с главного меню.",
    trashMenu(),
  );
}

function summarizeInstructions(value: string | null): string {
  if (!value) return "не заданы";
  return value.length > 240 ? `${value.slice(0, 237)}…` : value;
}

function formatPipelineError(stage: string | null, error: string | null): string {
  const raw = error || "неизвестная ошибка";
  if (/quota_exceeded|0 credits remaining|exceeds your quota/i.test(raw)) {
    return [
      "❌ Pipeline остановлен на озвучке.",
      "У ElevenLabs закончилась доступная квота, поэтому аудио создать нельзя.",
      "Пополните квоту или выберите другой рабочий voice/API key, затем запустите ролик повторно.",
    ].join("\n");
  }
  if (/GEMINI_API_KEY|API key not valid|Google Gemini/i.test(raw)) {
    return [
      "❌ Google AI не смог создать изображение.",
      "Ключ GEMINI_API_KEY недействителен или не имеет доступа к Gemini image model.",
      "Создайте ключ в Google AI Studio и замените его в Secrets, затем повторите запуск.",
    ].join("\n");
  }
  if (/rate limit|429|too many requests/i.test(raw)) {
    return `❌ Pipeline временно ограничен провайдером на стадии ${stage || "unknown"}. Попробуйте Retry через минуту.`;
  }
  if (/timeout|timed out|operation was aborted/i.test(raw)) {
    return [
      `❌ Pipeline остановлен на стадии ${stage || "unknown"}.`,
      "Музыкальный провайдер не ответил вовремя, поэтому ролик не выпускается без обязательной музыки.",
      "Нажмите «▶️ Продолжить с места сбоя» — готовые сценарий и озвучка будут переиспользованы.",
    ].join("\n");
  }
  return `❌ Pipeline остановлен на стадии ${stage || "unknown"}: ${raw}`;
}

async function showSettings(token: string, chatId: number): Promise<void> {
  const preferences = await getChatPreferences(chatId);
  const preset = preferences.stylePreset && preferences.stylePreset in STYLE_PRESETS
    ? STYLE_PRESETS[preferences.stylePreset as StylePresetId]
    : null;
  await sendMessage(
    token,
    chatId,
    [
      "⚙️ Текущие настройки",
      "",
      `📝 Пожелания к сценарию: ${summarizeInstructions(preferences.scriptInstructions)}`,
      `🎙 Голос: ${preferences.voiceName || "автоматический"}`,
      `🎨 Стиль: ${preset?.label || preferences.customStyle || "Киношный реализм"}`,
      `🎭 Настроение: ${preferences.tone || preset?.tone || "suspense"}`,
      `⏱ Длительность: ${preferences.duration} секунд`,
      `📱 Платформа: ${preferences.platform || "YouTube Shorts"}`,
    ].join("\n"),
    {
      inline_keyboard: [
        [
          { text: "📝 Изменить сценарий", callback_data: "menu:script" },
          { text: "🎙 Изменить голос", callback_data: "menu:voice" },
        ],
        [
          { text: "🎨 Стиль", callback_data: "menu:style" },
          { text: "🎭 Настроение", callback_data: "menu:tone" },
        ],
        [{ text: "⏱ Длительность", callback_data: "menu:duration" }],
        [{ text: "📱 Платформа", callback_data: "menu:platform" }],
        [
          { text: "🧹 Сбросить пожелания", callback_data: "script:clear" },
          { text: "🤖 Автовыбор голоса", callback_data: "voice:auto" },
        ],
        [{ text: "⬅️ Главное меню", callback_data: "menu:home" }],
      ],
    },
  );
}

function normalizeVoice(row: unknown): ElevenLabsVoiceOption | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  const labels = value.labels && typeof value.labels === "object"
    ? value.labels as Record<string, unknown>
    : {};
  const id = value.voiceId ?? value.voice_id;
  if (typeof id !== "string" || !id) return null;
  const name = value.name ?? value.voiceName ?? value.voice_name;
  return {
    id,
    name: typeof name === "string" && name ? name : "Unnamed voice",
    gender: typeof labels.gender === "string" ? labels.gender : null,
    accent: typeof labels.accent === "string" ? labels.accent : null,
    language: typeof (labels.language ?? labels.language_code) === "string"
      ? String(labels.language ?? labels.language_code)
      : null,
    previewUrl: typeof (value.previewUrl ?? value.preview_url) === "string"
      ? String(value.previewUrl ?? value.preview_url)
      : null,
  };
}

async function loadVoiceOptions(): Promise<ElevenLabsVoiceOption[]> {
  return (await listElevenLabsVoices())
    .map(normalizeVoice)
    .filter((voice): voice is ElevenLabsVoiceOption => voice !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function voiceButtonLabel(voice: ElevenLabsVoiceOption): string {
  const details = [voice.gender, voice.accent, voice.language].filter(Boolean).join(", ");
  const label = details ? `${voice.name} · ${details}` : voice.name;
  return label.length > 48 ? `${label.slice(0, 45)}…` : label;
}

async function showVoicePage(token: string, chatId: number, requestedPage = 0): Promise<void> {
  const voices = await loadVoiceOptions();
  if (!voices.length) {
    await sendMainMenu(token, chatId, "ElevenLabs не вернул доступных голосов.");
    return;
  }
  const pageCount = Math.max(1, Math.ceil(voices.length / VOICES_PER_PAGE));
  const page = Math.min(Math.max(0, requestedPage), pageCount - 1);
  const pageVoices = voices.slice(page * VOICES_PER_PAGE, (page + 1) * VOICES_PER_PAGE);
  const rows = pageVoices.map((voice) => [
    {
      text: `✅ ${voiceButtonLabel(voice)}`,
      callback_data: `voice:set:${voice.id}`,
    },
    ...(voice.previewUrl ? [{
      text: "▶️",
      callback_data: `voice:preview:${voice.id}`,
    }] : []),
  ]);
  const navigation: Array<{ text: string; callback_data: string }> = [];
  if (page > 0) navigation.push({ text: "⬅️", callback_data: `voice:page:${page - 1}` });
  navigation.push({ text: `${page + 1}/${pageCount}`, callback_data: `voice:page:${page}` });
  if (page + 1 < pageCount) navigation.push({ text: "➡️", callback_data: `voice:page:${page + 1}` });
  rows.push(navigation);
  rows.push([{ text: "🤖 Автовыбор", callback_data: "voice:auto" }]);
  rows.push([{ text: "⬅️ Главное меню", callback_data: "menu:home" }]);
  await sendMessage(
    token,
    chatId,
    "🎙 Выберите голос ElevenLabs. Выбор сохранится и будет использоваться в следующих роликах.",
    { inline_keyboard: rows },
  );
}

async function sendVideo(
  token: string,
  chatId: number,
  buffer: Buffer,
  caption: string,
  replyMarkup?: InlineKeyboard,
): Promise<void> {
  if (buffer.length > 49 * 1024 * 1024) {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("caption", `${caption}\n\nФайл отправлен как документ из-за размера.`);
    if (replyMarkup) form.append("reply_markup", JSON.stringify(replyMarkup));
    form.append("document", new Blob([new Uint8Array(buffer)], { type: "video/mp4" }), "final_video.mp4");
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendDocument`, { method: "POST", body: form });
    const data = (await response.json()) as TelegramResponse<unknown>;
    if (!response.ok || !data.ok) throw new Error(data.description ?? `Telegram document upload failed (${response.status})`);
    return;
  }
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  if (replyMarkup) form.append("reply_markup", JSON.stringify(replyMarkup));
  form.append("video", new Blob([new Uint8Array(buffer)], { type: "video/mp4" }), "final_video.mp4");
  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendVideo`, { method: "POST", body: form });
  const data = (await response.json()) as TelegramResponse<unknown>;
  if (!response.ok || !data.ok) throw new Error(data.description ?? `Telegram video upload failed (${response.status})`);
}

async function sendPhoto(token: string, chatId: number, buffer: Buffer, caption: string, replyMarkup?: InlineKeyboard): Promise<void> {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption.slice(0, 1024));
  if (replyMarkup) form.append("reply_markup", JSON.stringify(replyMarkup));
  form.append("photo", new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }), "youtube-thumbnail.jpg");
  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendPhoto`, { method: "POST", body: form });
  const data = (await response.json()) as TelegramResponse<unknown>;
  if (!response.ok || !data.ok) throw new Error(data.description ?? `Telegram photo upload failed (${response.status})`);
}

function youtubePreview(metadata: YoutubeMetadata): string {
  return [
    "📺 ПРЕДПРОСМОТР YOUTUBE",
    "",
    `Заголовок: ${metadata.title}`,
    "",
    `Описание:\n${metadata.description.slice(0, 900)}`,
    "",
    `Теги: ${metadata.tags.join(", ")}`,
    `Хэштеги: ${metadata.hashtags.join(" ")}`,
  ].join("\n");
}

async function prepareYoutubePublication(token: string, chatId: number): Promise<void> {
  const projectId = lastProjectByChat.get(chatId);
  if (!projectId) throw new Error("Сначала создайте видео.");
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const [job] = await db.select().from(videoGenerationJobsTable)
    .where(eq(videoGenerationJobsTable.projectId, projectId))
    .orderBy(desc(videoGenerationJobsTable.createdAt));
  if (!project || !job?.videoStoragePath || job.status !== "completed") {
    await sendMainMenu(token, chatId, "📺 YouTube доступен после завершения готового MP4.");
    return;
  }
  await prepareYoutubePublicationForStorage(
    token,
    chatId,
    job.videoStoragePath,
    project.title,
    typeof project.scriptJson === "string" ? project.scriptJson : JSON.stringify(project.scriptJson || {}),
    project.topic,
    0,
  );
}

async function restorePendingYoutubePublication(chatId: number): Promise<PendingYoutubePublication | null> {
  const [job] = await db.select().from(videoGenerationJobsTable).where(and(
    eq(videoGenerationJobsTable.chatId, chatId),
    eq(videoGenerationJobsTable.status, "completed"),
    isNotNull(videoGenerationJobsTable.videoStoragePath),
  )).orderBy(desc(videoGenerationJobsTable.updatedAt)).limit(1);
  if (!job?.videoStoragePath) return null;
  const [project] = await db.select({
    id: projectsTable.id,
    topic: projectsTable.topic,
    title: projectsTable.title,
  }).from(projectsTable).where(eq(projectsTable.id, job.projectId));
  const pending: PendingYoutubePublication = {
    projectId: job.projectId,
    connectionIds: [],
    videoStoragePath: job.videoStoragePath,
    topic: project?.topic || job.topic || project?.title || "Готовый ролик",
    metadata: { title: "", description: "", tags: [], hashtags: [] },
    thumbnail: Buffer.alloc(0),
  };
  pendingYoutubeByChat.set(chatId, pending);
  return pending;
}

async function showYoutubeChannels(token: string, chatId: number, message = "📺 Выберите активный YouTube-канал."): Promise<void> {
  const connections = await listYoutubeConnections();
  const preferences = await getChatPreferences(chatId);
  const rows: Array<Array<{ text: string; callback_data?: string; url?: string }>> = connections.map((connection) => [
    {
      text: `${connection.id === preferences.activeYoutubeConnectionId ? "✅ " : ""}${connection.channelTitle || "Канал без названия"}`,
      callback_data: `youtube:select:${connection.id}`,
    },
    { text: "🗑", callback_data: `youtube:delete:${connection.id}` },
  ]);
  rows.push([{ text: "➕ Подключить новый канал", url: createYoutubeAuthorizationUrl() }]);
  rows.push([{ text: "🔄 Синхронизировать каналы", callback_data: "youtube:sync" }]);
  rows.push([{ text: "⬅️ Главное меню", callback_data: "menu:home" }]);
  await sendMessage(token, chatId, connections.length
    ? `${message}\n\nПри публикации можно выбрать один или несколько подключённых каналов.`
    : "Каналы пока не подключены. Подключите первый канал.", { inline_keyboard: rows });
}

async function showInstagramAccounts(
  token: string,
  chatId: number,
  message = "📷 Подключённые Instagram-аккаунты.",
): Promise<void> {
  const accounts = await listInstagramConnections();
  const rows: Array<Array<{ text: string; callback_data?: string; url?: string }>> = accounts.map((account) => [
    {
      text: account.username
        ? `@${account.username}`
        : account.displayName || "Instagram-аккаунт",
      callback_data: `instagram:account:${account.id}`,
    },
    { text: "🗑", callback_data: `instagram:delete:${account.id}` },
  ]);
  rows.push([{ text: "➕ Подключить Instagram", callback_data: "instagram:connect" }]);
  rows.push([{ text: "⬅️ Главное меню", callback_data: "menu:home" }]);
  await sendMessage(token, chatId, accounts.length
    ? `${message}\n\nМожно добавить ещё аккаунты — новое подключение не заменяет предыдущие.`
    : "Instagram-аккаунты пока не подключены.", { inline_keyboard: rows });
}

export async function prepareYoutubePublicationForStorage(
  token: string,
  chatId: number,
  videoStoragePath: string,
  title: string,
  scriptText: string,
  topic: string,
  connectionId = 0,
  commentText?: string,
  channelBranding = false,
  offerEdit = false,
): Promise<void> {
  const initialMetadata: YoutubeMetadata = {
    title: "",
    description: "",
    tags: [],
    hashtags: [],
  };
  pendingYoutubeByChat.set(chatId, {
    projectId: null,
    connectionIds: connectionId ? [connectionId] : [],
    videoStoragePath,
    topic: topic || title,
    metadata: initialMetadata,
    thumbnail: Buffer.alloc(0),
    commentText,
    channelBranding,
  });
  if (offerEdit) {
    pendingVideoEditByChat.set(chatId, {
      sourceStoragePath: videoStoragePath,
      title,
      scriptText,
      topic: topic || title,
    });
  }
  await updateChatPreferences(chatId, { pendingAction: "youtube_metadata" });
  await sendMessage(token, chatId, [
    "✅ Видео готово к публикации.",
    "",
    "Введите данные для YouTube вручную одним сообщением:",
    "",
    "Название: цепляющий заголовок ролика",
    "Описание:",
    "Текст описания ролика",
    "Теги: история, переписка, shorts",
    "Хэштеги: #shorts #история",
    "",
    "Название и описание обязательны. Теги и хэштеги можно оставить пустыми.",
    "После этого я покажу предпросмотр, затем предложу выбрать канал и способ публикации.",
    "Для отмены отправьте /cancel.",
  ].join("\n"), offerEdit
    ? { inline_keyboard: [[{ text: "🎬 Сделать edit", callback_data: "edit:start" }]] }
    : undefined);
}

async function showYoutubePrivacyChoice(token: string, chatId: number): Promise<void> {
  if (!pendingYoutubeByChat.has(chatId)) {
    await prepareYoutubePublication(token, chatId);
    return;
  }
  await sendMessage(token, chatId, "Как опубликовать видео на YouTube?", {
    inline_keyboard: [
      [{ text: "🔒 Приватно — доступно только мне", callback_data: "youtube:privacy:private" }],
      [{ text: "🌍 Открыто — доступно всем", callback_data: "youtube:privacy:public" }],
      [{ text: "⬅️ Вернуться к публикации", callback_data: "menu:youtube" }],
    ],
  });
}

async function showYoutubeScheduleChoice(
  token: string,
  chatId: number,
  privacyStatus: "private" | "public",
): Promise<void> {
  const pending = pendingYoutubeByChat.get(chatId);
  if (!pending) {
    await prepareYoutubePublication(token, chatId);
    return;
  }
  pending.privacyStatus = privacyStatus;
  await sendMessage(token, chatId, [
    `✅ Режим публикации: ${privacyStatus === "public" ? "открыто" : "приватно"}.`,
    "",
    "Выберите интервал между каналами:",
  ].join("\n"), {
    inline_keyboard: [
      [{ text: "🚀 Опубликовать сразу", callback_data: "youtube:schedule:0" }],
      [{ text: "⏱ Каждые 15 минут", callback_data: "youtube:schedule:15" }],
      [{ text: "⏱ Каждые 30 минут", callback_data: "youtube:schedule:30" }],
      [{ text: "⬅️ Вернуться к выбору приватности", callback_data: "youtube:privacy:back" }],
    ],
  });
}

function waitForYoutubeSchedule(minutes: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, minutes) * 60_000));
}

async function publishYoutubeToChannels(
  token: string,
  chatId: number,
  pending: PendingYoutubePublication,
  delayMinutes: number,
): Promise<void> {
  const privacyStatus = pending.privacyStatus || "private";
  const results: string[] = [];
  const preferences = await getChatPreferences(chatId);
  const connections = await listYoutubeConnections();

  for (let index = 0; index < pending.connectionIds.length; index += 1) {
    if (pendingYoutubeByChat.get(chatId) !== pending) {
      await sendMessage(token, chatId, "⏹️ Запланированная публикация отменена.");
      return;
    }
    if (index > 0 && delayMinutes > 0) {
      await sendMessage(
        token,
        chatId,
        `⏳ Следующий канал будет опубликован через ${delayMinutes} минут.`,
      );
      await waitForYoutubeSchedule(delayMinutes);
      if (pendingYoutubeByChat.get(chatId) !== pending) {
        await sendMessage(token, chatId, "⏹️ Запланированная публикация отменена.");
        return;
      }
    }

    const connectionId = pending.connectionIds[index]!;
    const connection = connections.find((item) => item.id === connectionId);
    try {
      const channelTitle = connection?.channelTitle || `Канал #${connectionId}`;
      const includeChannelBranding = pending.channelBranding !== false;
      const channelMetadata = includeChannelBranding
        ? buildChannelMetadataVariant(
            pending.metadata,
            channelTitle,
            connectionId,
          )
        : pending.metadata;
      const channelVideoStoragePath = includeChannelBranding
        ? await createYoutubeChannelVariant({
            sourceStoragePath: pending.videoStoragePath,
            channelTitle,
            connectionId,
            voiceId: preferences.voiceId || getConfiguredVoiceId(),
          })
        : pending.videoStoragePath;
      const result = await uploadYoutubeShort({
        videoStoragePath: channelVideoStoragePath,
        title: channelMetadata.title,
        description: channelMetadata.description,
        tags: channelMetadata.tags,
        thumbnail: pending.thumbnail,
        connectionId,
        privacyStatus,
        preserveDescription: !includeChannelBranding,
      });
      const videoUrl = `https://youtu.be/${result.videoId}`;
      let commentResult = "Комментарий не создан";
      try {
        await postYoutubeComment({
          videoId: result.videoId,
          connectionId,
          text: pending.commentText,
        });
        commentResult = "комментарий добавлен — закрепите его вручную";
      } catch (commentError) {
        commentResult = `комментарий не добавлен: ${commentError instanceof Error ? commentError.message : "ошибка доступа"}`;
      }
      const thumbnailResult = result.thumbnailSet
        ? "обложка установлена"
        : `обложка не установлена${result.thumbnailError ? `: ${result.thumbnailError}` : ""}`;
      results.push(`✅ ${channelTitle}: ${videoUrl}\n   💬 ${commentResult}\n   🖼 ${thumbnailResult}`);
    } catch (error) {
      results.push(`❌ ${connection?.channelTitle || `Канал #${connectionId}`}: ${error instanceof Error ? error.message : "ошибка загрузки"}`);
    }
  }

  pendingYoutubeByChat.delete(chatId);
  await updateChatPreferences(chatId, { pendingAction: null });
  await sendMainMenu(
    token,
    chatId,
    [
      "📺 Результат публикации на YouTube:",
      ...results,
    ].join("\n"),
  );
  if (results.some((result) => /invalid_grant|authorization expired|was revoked/i.test(result))) {
    await sendMessage(
      token,
      chatId,
      "🔐 Доступ к YouTube истёк или был отозван. Переподключите канал, затем снова выберите «📤 Подготовить публикацию».",
      {
        inline_keyboard: [[
          { text: "🔗 Переподключить YouTube", url: createYoutubeAuthorizationUrl() },
        ]],
      },
    );
  }
}

async function showYoutubeChannelChoice(token: string, chatId: number): Promise<void> {
  const pending = pendingYoutubeByChat.get(chatId);
  if (!pending) {
    await prepareYoutubePublication(token, chatId);
    return;
  }
  const connections = await listYoutubeConnections();
  if (!connections.length) throw new Error("Нет подключённых YouTube-каналов.");
  const selectedIds = new Set(pending.connectionIds);
  const rows: Array<Array<{ text: string; callback_data: string }>> = [
    [
      { text: "☑️ Выбрать все", callback_data: "youtube:target:all" },
      { text: "◻️ Снять все", callback_data: "youtube:target:none" },
    ],
  ];
  for (const connection of connections) {
    rows.push([{
      text: `${selectedIds.has(connection.id) ? "✅" : "⬜"} ${connection.channelTitle || `Канал #${connection.id}`}`,
      callback_data: `youtube:target:${connection.id}`,
    }]);
  }
  rows.push([{
    text: `✅ Готово — выбрано: ${selectedIds.size}`,
    callback_data: "youtube:targets:done",
  }]);
  rows.push([{ text: "⬅️ Вернуться к публикации", callback_data: "youtube:cancel" }]);
  await sendMessage(token, chatId, [
    "📺 Выберите каналы для публикации.",
    "",
    "Нажимайте на каналы, чтобы поставить или снять галочку.",
    `Выбрано: ${selectedIds.size} из ${connections.length}.`,
  ].join("\n"), { inline_keyboard: rows });
}

async function downloadTelegramVideo(
  token: string,
  fileId: string,
  fileSize?: number,
): Promise<Buffer> {
  if (fileSize && fileSize > TELEGRAM_DOWNLOAD_LIMIT_BYTES) {
    throw new Error(
      "Telegram не позволяет этому боту скачать видео больше 20 МБ. " +
      "Сожмите ролик до 20 МБ или загрузите его через веб-приложение.",
    );
  }
  const file = await telegramRequest<{ file_path?: string }>(token, "getFile", { file_id: fileId });
  if (!file.file_path) throw new Error("Telegram не вернул путь к видео.");
  const response = await fetch(`${TELEGRAM_API}/file/bot${token}/${file.file_path}`, {
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    if (response.status === 400) {
      throw new Error(
        "Telegram не смог передать этот файл боту: размер видео превышает лимит 20 МБ. " +
        "Сожмите ролик или загрузите его через веб-приложение.",
      );
    }
    throw new Error(`Не удалось скачать видео из Telegram (${response.status}).`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("Telegram вернул пустой видеофайл.");
  return buffer;
}

async function downloadTelegramFile(token: string, fileId: string, fileSize?: number): Promise<Buffer> {
  if (fileSize && fileSize > 20 * 1024 * 1024) {
    throw new Error("Изображение слишком большое. Загрузите файл не больше 20 МБ.");
  }
  const file = await telegramRequest<{ file_path?: string }>(token, "getFile", { file_id: fileId });
  if (!file.file_path) throw new Error("Telegram не вернул путь к изображению.");
  const response = await fetch(`${TELEGRAM_API}/file/bot${token}/${file.file_path}`, {
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`Не удалось скачать изображение из Telegram (${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("Telegram вернул пустое изображение.");
  return buffer;
}

async function showImageScenePicker(token: string, chatId: number, projectId: number): Promise<void> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) throw new Error("Проект сценария не найден.");
  const script = videoScriptSchema.parse(project.scriptJson);
  await sendMessage(token, chatId, "🖼 Выберите сцену, к которой добавить вашу фотографию:", {
    inline_keyboard: [
      ...script.scenes.map((scene) => [{
        text: `Сцена ${scene.scene_number}`,
        callback_data: `image:scene:${scene.scene_number}`,
      }]),
      [{ text: "⬅️ Назад к сценарию", callback_data: "image:cancel" }],
    ],
  });
}

async function handleUploadedSceneImage(
  token: string,
  chatId: number,
  fileId: string,
  fileSize: number | undefined,
  contentType: string,
): Promise<void> {
  const selected = pendingImageSceneByChat.get(chatId);
  if (!selected) return;
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, selected.projectId));
    if (!project || project.status !== "draft") throw new Error("Своё изображение можно добавить до утверждения сценария.");
    const buffer = await downloadTelegramFile(token, fileId, fileSize);
    const storagePath = await storeUploadedImage(buffer, contentType);
    const script = videoScriptSchema.parse(project.scriptJson);
    const scene = script.scenes.find((item) => item.scene_number === selected.sceneId);
    if (!scene) throw new Error("Сцена не найдена.");
    await db.transaction(async (tx) => {
      await tx.update(generatedImagesTable).set({ isPrimary: false, updatedAt: new Date() }).where(and(
        eq(generatedImagesTable.projectId, selected.projectId),
        eq(generatedImagesTable.sceneId, selected.sceneId),
        eq(generatedImagesTable.isPrimary, true),
      ));
      await tx.insert(generatedImagesTable).values({
        projectId: selected.projectId,
        sceneId: selected.sceneId,
        prompt: scene.image_prompt || scene.visual_description || "Изображение пользователя",
        negativePrompt: "",
        provider: "telegram-upload",
        model: "user-upload",
        aspectRatio: "9:16",
        width: 1080,
        height: 1920,
        status: "completed",
        imageUrl: `/api/storage${storagePath}`,
        storagePath,
        error: null,
        version: 1,
        isPrimary: true,
      });
    });
    pendingImageSceneByChat.delete(chatId);
    await updateChatPreferences(chatId, { pendingAction: null });
    await sendMessage(token, chatId, `✅ Изображение для сцены ${selected.sceneId} сохранено.\nПри запуске видео оно будет использовано вместо сгенерированной картинки.`, {
      inline_keyboard: [
        [{ text: "🖼 Добавить изображение к другой сцене", callback_data: "image:add" }],
        [{ text: "✅ Утвердить сценарий", callback_data: "draft:approve" }],
      ],
    });
  } catch (error) {
    logger.error({ err: error, chatId, projectId: selected.projectId, sceneId: selected.sceneId }, "Failed to save uploaded scene image");
    await sendMessage(token, chatId, `❌ Не удалось сохранить изображение: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  }
}

async function handleUploadedVideo(
  token: string,
  chatId: number,
  fileId: string,
  fileName: string | undefined,
  caption: string | undefined,
  fileSize?: number,
): Promise<void> {
  try {
    await sendMessage(token, chatId, "⏳ Получил готовый ролик. Сохраняю его и запрашиваю данные для публикации…");
    if (fileSize && fileSize > TELEGRAM_DOWNLOAD_LIMIT_BYTES) {
      const uploadToken = createLargeVideoUploadToken(chatId, fileName, caption);
      const uploadUrl = `${uploadBaseUrl()}/api/upload/${uploadToken}`;
      await sendMessage(token, chatId, "Видео больше лимита Telegram для скачивания. Загрузите его по защищённой одноразовой ссылке:", {
        inline_keyboard: [[{ text: "📤 Загрузить ролик для публикации", url: uploadUrl }]],
      });
      return;
    }
    const buffer = await downloadTelegramVideo(token, fileId, fileSize);
    const videoStoragePath = await storeAudioAsset(buffer, "video", "video/mp4", "mp4");
    const fallbackTitle = (fileName || "Готовый ролик").replace(/\.(mp4|mov|mkv|webm)$/iu, "").replace(/[_-]+/g, " ").trim();
    const topic = caption?.trim() || fallbackTitle || "Готовый вертикальный ролик";
    await prepareYoutubePublicationForStorage(
      token,
      chatId,
      videoStoragePath,
      fallbackTitle || "Готовый ролик",
      caption?.trim() || fallbackTitle || "Готовый ролик для публикации на YouTube Shorts.",
      topic,
      0,
      undefined,
      false,
      true,
    );
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to prepare uploaded Telegram video");
    await sendMessage(token, chatId, `❌ Не удалось подготовить ролик: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  }
}

async function handleAdaptUploadedVideo(
  token: string,
  chatId: number,
  fileId: string,
  fileName: string | undefined,
  fileSize?: number,
): Promise<void> {
  try {
    await sendMessage(token, chatId, [
      "⏳ Получил видео. Делаю брендированную адаптацию Kliply.",
      "Сохраняю исходную речь и текст, добавляю новую музыкальную подложку, цветокоррекцию, переразметку кадра и брендированный слой.",
    ].join("\n"));
    if (fileSize && fileSize > TELEGRAM_DOWNLOAD_LIMIT_BYTES) {
      await sendMessage(token, chatId, "Видео больше 20 МБ — Telegram не позволяет боту скачать его напрямую. Для адаптации сейчас отправьте файл до 20 МБ.");
      return;
    }
    const buffer = await downloadTelegramVideo(token, fileId, fileSize);
    const sourceStoragePath = await storeAudioAsset(buffer, "video", "video/mp4", "mp4");
    const adaptedStoragePath = await adaptVideoAsset(sourceStoragePath);
    const adaptedBuffer = await readAudioAsset(adaptedStoragePath);
    await sendVideo(
      token,
      chatId,
      adaptedBuffer,
      `✨ Адаптация Kliply готова.\n\nИсходный текст и речь сохранены. Добавлены брендирование, новая музыкальная подложка, цветокоррекция и переработка кадра.`,
      {
        inline_keyboard: [
          [{ text: "🔁 Сделать ещё один вариант", callback_data: "adapt:repeat" }],
          [{ text: "📺 Перейти к публикации", callback_data: "adapt:publish" }],
        ],
      },
    );
    await prepareYoutubePublicationForStorage(
      token,
      chatId,
      adaptedStoragePath,
      (fileName || "Адаптированное видео Kliply").replace(/\.(mp4|mov|mkv|webm)$/iu, ""),
      "Адаптированное рекламное видео Kliply.",
      "Kliply",
      0,
    );
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to adapt Telegram video");
    await sendMessage(token, chatId, `❌ Не удалось адаптировать видео: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  }
}

async function handleReactionMainVideo(
  token: string,
  chatId: number,
  fileId: string,
  fileSize?: number,
): Promise<void> {
  const pending = pendingReactionByChat.get(chatId);
  if (!pending) {
    await sendMainMenu(token, chatId, "Сессия реакции закончилась. Начните заново через меню.");
    return;
  }
  if (fileSize && fileSize > TELEGRAM_DOWNLOAD_LIMIT_BYTES) {
    await sendMessage(token, chatId, "Основное видео больше 20 МБ. Отправьте файл до 20 МБ.");
    return;
  }
  const buffer = await downloadTelegramVideo(token, fileId, fileSize);
  pending.mainVideoStoragePath = await storeAudioAsset(buffer, "video", "video/mp4", "mp4");
  if (pending.reactionMode === "image" && pending.reactionImagePath) {
    try {
      await sendMessage(token, chatId, "⏳ Накладываю выбранное фото снизу и сохраняю звук основного видео.");
      const outputStoragePath = await addReactionImageOverlay(
        pending.mainVideoStoragePath,
        pending.reactionImagePath,
      );
      const outputBuffer = await readAudioAsset(outputStoragePath);
      await sendVideo(token, chatId, outputBuffer, [
        `📸 Фото-реакция ${pending.streamerName} добавлена.`,
        "",
        "Фото размещено снизу. Звук основного видео сохранён.",
      ].join("\n"), {
        inline_keyboard: [
          [{ text: "📸 Выбрать другое фото", callback_data: "menu:reaction" }],
          [{ text: "⬅️ Главное меню", callback_data: "menu:home" }],
        ],
      });
      pendingReactionByChat.delete(chatId);
      await updateChatPreferences(chatId, { pendingAction: null });
    } catch (error) {
      logger.error({ err: error, chatId }, "Failed to add reaction image overlay");
      await sendMessage(token, chatId, `❌ Не удалось добавить фото-реакцию: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
    }
    return;
  }
  pendingReactionByChat.set(chatId, pending);
  await updateChatPreferences(chatId, { pendingAction: "reaction_clip_upload" });
  await sendMessage(token, chatId, [
    `✅ Основное видео получено для реакции: ${pending.streamerName}.`,
    "",
    "Теперь отправьте разрешённый видеоклип с реакцией.",
    "Звук reaction-клипа будет удалён, останется только молчаливая реакция лица внизу кадра.",
    "Для отмены отправьте /cancel.",
  ].join("\n"));
}

async function handleReactionClip(
  token: string,
  chatId: number,
  fileId: string,
  fileSize?: number,
): Promise<void> {
  const pending = pendingReactionByChat.get(chatId);
  if (!pending?.mainVideoStoragePath) {
    await sendMainMenu(token, chatId, "Сначала выберите реакцию и отправьте основное видео.");
    return;
  }
  try {
    if (fileSize && fileSize > TELEGRAM_DOWNLOAD_LIMIT_BYTES) {
      await sendMessage(token, chatId, "Reaction-клип больше 20 МБ. Отправьте файл до 20 МБ.");
      return;
    }
    await sendMessage(token, chatId, "⏳ Накладываю молчаливую реакцию снизу и сохраняю звук основного видео.");
    const buffer = await downloadTelegramVideo(token, fileId, fileSize);
    const reactionStoragePath = await storeAudioAsset(buffer, "video", "video/mp4", "mp4");
    const outputStoragePath = await addReactionOverlay(pending.mainVideoStoragePath, reactionStoragePath);
    const outputBuffer = await readAudioAsset(outputStoragePath);
    await sendVideo(token, chatId, outputBuffer, [
      `🎭 Реакция ${pending.streamerName} добавлена.`,
      "",
      "Звук reaction-клипа удалён. Сохранён звук основного видео.",
    ].join("\n"), {
      inline_keyboard: [
        [{ text: "🎭 Добавить другую реакцию", callback_data: "menu:reaction" }],
        [{ text: "⬅️ Главное меню", callback_data: "menu:home" }],
      ],
    });
    pendingReactionByChat.delete(chatId);
    await updateChatPreferences(chatId, { pendingAction: null });
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to add reaction overlay");
    await sendMessage(token, chatId, `❌ Не удалось добавить реакцию: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  }
}

function formatCutTimestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function isYoutubeSourceUrl(sourceUrl: string): boolean {
  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase();
    return hostname === "youtube.com"
      || hostname.endsWith(".youtube.com")
      || hostname === "youtu.be";
  } catch {
    return false;
  }
}

function publicVideoCutError(sourceUrl: string, errorMessage: string): string {
  const service = (() => {
    try {
      return new URL(sourceUrl).hostname.replace(/^www\./i, "");
    } catch {
      return "видеосервис";
    }
  })();
  if (/HTTP Error 404|404 Not Found|video.*not found|не найден/iu.test(errorMessage)) {
    return `Сервис ${service} не нашёл видео по этой ссылке. Проверь, что ролик не удалён, ссылка полная, а видео доступно без входа в аккаунт.`;
  }
  if (/HTTP Error 403|403 Forbidden|forbidden|access denied|доступ запрещён/iu.test(errorMessage)) {
    return `Сервис ${service} запретил скачивание этого видео. Проверь, что ролик публичный и доступен без авторизации.`;
  }
  if (/AI (?:нашёл|не нашёл)|AI-анализ|подходящих моментов/iu.test(errorMessage)) {
    return `AI-анализ ${service} не смог подобрать достаточно отдельных моментов для нарезки. Попробуй меньше каналов или другое видео.`;
  }
  return `Сервис ${service} не смог скачать видео по этой ссылке. Проверь, что ссылка публичная и ведёт прямо на доступный ролик.`;
}

function videoCutKeyboard(batchId: string, sequence: number): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "✅ Оставить", callback_data: `cut:keep:${batchId}:${sequence}` },
        { text: "❌ Пропустить", callback_data: `cut:skip:${batchId}:${sequence}` },
      ],
      [{ text: "🏁 Завершить выбор", callback_data: `cut:finish:${batchId}` }],
    ],
  };
}

async function showVideoCutCountPrompt(
  token: string,
  chatId: number,
  banner?: PendingVideoCutBanner,
): Promise<void> {
  pendingVideoCutBannerByChat.delete(chatId);
  if (banner) pendingVideoCutBannerByChat.set(chatId, banner);
  await updateChatPreferences(chatId, { pendingAction: "cut_count" });
  await sendMessage(token, chatId, [
    "✂️ Нарезка видео",
    banner ? "🖼 Баннер выбран и будет наложен сверху по центру на каждый фрагмент." : "Баннер не добавлен.",
    "",
    "Сколько нарезок подготовить?",
    "Каждая будет отдельным Shorts-роликом длиной 60–120 секунд.",
    "",
    "Используй только свои видео или материалы, на которые у тебя есть разрешение.",
    "Для отмены отправь /cancel.",
  ].join("\n"), {
    inline_keyboard: [
      [
        { text: "1 ролик", callback_data: "cut:count:1" },
        { text: "3 ролика", callback_data: "cut:count:3" },
        { text: "5 роликов", callback_data: "cut:count:5" },
      ],
      [
        { text: "10 роликов", callback_data: "cut:count:10" },
        { text: "15 роликов", callback_data: "cut:count:15" },
      ],
      [{ text: "🖼️ Вставить баннер", callback_data: "cut:banner:add" }],
    ],
  });
}

async function showVideoCutSourcePrompt(
  token: string,
  chatId: number,
  banner?: PendingVideoCutBanner,
): Promise<void> {
  pendingVideoCutSourceByChat.delete(chatId);
  pendingVideoCutBannerByChat.delete(chatId);
  if (banner) pendingVideoCutBannerByChat.set(chatId, banner);
  await updateChatPreferences(chatId, { pendingAction: "cut_source_url" });
  await sendMessage(token, chatId, [
    "✂️ Нарезка видео",
    "",
    "Отправь публичную ссылку на сериал, фильм, стрим или другое видео.",
    "После ссылки я предложу выбрать YouTube-каналы.",
    "Для каждого выбранного канала создам свой неповторяющийся фрагмент.",
    "",
    banner ? "Рекламный баннер будет сохранён в роликах." : "Без рекламного баннера.",
    "Оригинальный звук видео сохраняется. Новая озвучка не добавляется.",
    "Для отмены отправь /cancel.",
  ].join("\n"));
}

async function showVideoCutChannelChoice(token: string, chatId: number): Promise<void> {
  const request = pendingVideoCutSourceByChat.get(chatId);
  if (!request) throw new Error("Ссылка на исходное видео не найдена. Запусти нарезку заново.");
  const connections = await listYoutubeConnections();
  if (!connections.length) throw new Error("Нет подключённых YouTube-каналов.");
  const selectedIds = new Set(request.connectionIds);
  const rows: Array<Array<{ text: string; callback_data: string }>> = [
    [
      { text: "☑️ Выбрать все", callback_data: "cut:target:all" },
      { text: "◻️ Снять все", callback_data: "cut:target:none" },
    ],
  ];
  for (const connection of connections) {
    rows.push([{
      text: `${selectedIds.has(connection.id) ? "✅" : "⬜"} ${connection.channelTitle || `Канал #${connection.id}`}`,
      callback_data: `cut:target:${connection.id}`,
    }]);
  }
  rows.push([{
    text: `✅ Начать нарезку — выбрано: ${selectedIds.size}`,
    callback_data: "cut:targets:done",
  }]);
  rows.push([{ text: "❌ Отмена", callback_data: "cut:targets:cancel" }]);
  await sendMessage(token, chatId, [
    "📺 На какие каналы сделать нарезку?",
    "",
    "Каждый выбранный канал получит отдельный фрагмент без повторов.",
    `Выбрано: ${selectedIds.size} из ${connections.length}.`,
  ].join("\n"), { inline_keyboard: rows });
}

async function handleUploadedVideoCutBanner(
  token: string,
  chatId: number,
  fileId: string,
  fileSize?: number,
): Promise<void> {
  try {
    const buffer = await downloadTelegramVideo(token, fileId, fileSize);
    const storagePath = await storeAudioAsset(buffer, "video", "video/mp4", "mp4");
    await showVideoCutCountPrompt(token, chatId, { storagePath, kind: "video" });
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to save video cut banner video");
    await sendMessage(token, chatId, `❌ Не удалось сохранить видео-баннер: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  }
}

async function handleUploadedVideoCutSource(
  token: string,
  chatId: number,
  fileId: string,
  fileSize?: number,
): Promise<void> {
  try {
    if (fileSize && fileSize > TELEGRAM_DOWNLOAD_LIMIT_BYTES) {
      await sendMessage(token, chatId, "Исходный MP4 больше 20 МБ. Для этого режима отправь файл до 20 МБ.");
      return;
    }
    await sendMessage(token, chatId, "⏳ Сохраняю исходный MP4 и открываю выбор каналов…");
    const buffer = await downloadTelegramVideo(token, fileId, fileSize);
    const sourceStoragePath = await storeAudioAsset(buffer, "video", "video/mp4", "mp4");
    const banner = pendingVideoCutBannerByChat.get(chatId);
    const previousRequest = pendingVideoCutSourceByChat.get(chatId);
    pendingVideoCutSourceByChat.set(chatId, {
      sourceUrl: "uploaded://telegram-video",
      sourceStoragePath,
      connectionIds: previousRequest?.connectionIds || [],
      banner,
    });
    await updateChatPreferences(chatId, { pendingAction: "cut_channel_choice" });
    await showVideoCutChannelChoice(token, chatId);
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to save uploaded video cut source");
    await sendMessage(token, chatId, `❌ Не удалось сохранить исходный MP4: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  }
}

async function handleUploadedImageCutBanner(
  token: string,
  chatId: number,
  fileId: string,
  fileSize: number | undefined,
  contentType: string,
): Promise<void> {
  try {
    const buffer = await downloadTelegramFile(token, fileId, fileSize);
    const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const storagePath = await storeAudioAsset(buffer, "video", contentType || "image/jpeg", extension);
    await showVideoCutCountPrompt(token, chatId, { storagePath, kind: "image" });
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to save video cut banner image");
    await sendMessage(token, chatId, `❌ Не удалось сохранить фото-баннер: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  }
}

async function handleUploadedStoryBanner(
  token: string,
  chatId: number,
  fileId: string,
  fileSize: number | undefined,
  contentType: string,
  kind: "image" | "video",
): Promise<void> {
  try {
    const batch = await getActiveStoryBatch(chatId);
    if (!batch || batch.status !== "choosing_banner") {
      throw new Error("Черновик истории не найден. Начните раздел «История» заново.");
    }
    const buffer = kind === "video"
      ? await downloadTelegramVideo(token, fileId, fileSize)
      : await downloadTelegramFile(token, fileId, fileSize);
    const storagePath = kind === "video"
      ? await storeAudioAsset(buffer, "video", "video/mp4", "mp4")
      : await storeAudioAsset(buffer, "video", contentType || "image/png", contentType.includes("png") ? "png" : "jpg");
    await db.update(storyBatchesTable).set({
      bannerStoragePath: storagePath,
      bannerKind: kind,
      updatedAt: new Date(),
    }).where(eq(storyBatchesTable.id, batch.id));
    await sendMessage(token, chatId, "✅ Баннер сохранён. Запускаю варианты истории для выбранных каналов.");
    runStoryBatchGenerationInBackground(token, chatId, batch.id);
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to save story banner");
    await sendMessage(token, chatId, `❌ Не удалось сохранить баннер: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  }
}

async function runVideoCutBatch(
  token: string,
  chatId: number,
  sourceUrl: string,
  requestedCount: number,
  banner?: PendingVideoCutBanner,
  channelIds: number[] = [],
  sourceStoragePath?: string,
): Promise<void> {
  const batch: PendingVideoCutBatch = {
    id: randomUUID().replace(/-/gu, "").slice(0, 16),
    sourceUrl,
    cuts: new Map(),
    channelIdBySequence: new Map(),
    kept: new Set(),
    reviewed: new Set(),
    banner,
  };
  pendingVideoCutBatchByChat.set(chatId, batch);

  try {
    await sendMessage(token, chatId, [
      "✂️ Нарезка видео запущена.",
      "",
      `Скачиваю исходник, AI найдёт до ${requestedCount} самых интересных фрагментов длиной 60–120 секунд.`,
      banner
        ? "Выбранный баннер будет наложен на каждый фрагмент. После анализа готовые MP4 будут приходить по одному."
        : "После анализа готовые MP4 будут приходить по одному.",
    ].join("\n"));
    await sendMessage(token, chatId, `✂️ Подготовлено нарезок: 0/${requestedCount}.`);
    const cuts = await createVideoCuts(sourceUrl, {
      count: requestedCount,
      onClipStart: async (current, total) => {
        await sendMessage(token, chatId, `🔄 Кодирую нарезку ${current}/${total}...`);
      },
      onProgress: async (completed, total) => {
        if (completed === 1 || completed === total || completed % 3 === 0) {
          await sendMessage(token, chatId, `✂️ Подготовлено нарезок: ${completed}/${total}.`);
        }
      },
      onAnalysisProgress: async (message) => {
        await sendMessage(token, chatId, `🔎 ${message}`);
      },
      onSourceInfo: async (info) => {
        batch.sourceTitle = info.title;
        batch.sourceDescription = info.description;
      },
      banner,
      sourceStoragePath,
    });
    const missingCuts = Math.max(0, channelIds.length - cuts.length);
    if (missingCuts) {
      await sendMessage(
        token,
        chatId,
        `⚠️ AI нашёл ${cuts.length} неповторяющихся фрагментов из ${channelIds.length}. Продолжаю с ${cuts.length} готовыми роликами.`,
      );
    }
    for (const cut of cuts) {
      batch.cuts.set(cut.sequence, cut);
      const channelId = channelIds[cut.sequence - 1];
      if (channelId) batch.channelIdBySequence.set(cut.sequence, channelId);
    }
    const connections = channelIds.length ? await listYoutubeConnections() : [];
    for (const cut of cuts) {
      const connection = connections.find((item) => item.id === batch.channelIdBySequence.get(cut.sequence));
      const clipBuffer = await readAudioAsset(cut.storagePath);
      await sendVideo(
        token,
        chatId,
        clipBuffer,
        [
          `✂️ Нарезка ${cut.sequence}/${cuts.length}`,
          connection ? `📺 Канал: ${connection.channelTitle || `#${connection.id}`}` : "",
          `⏱ ${formatCutTimestamp(cut.startSeconds)}–${formatCutTimestamp(cut.startSeconds + cut.durationSeconds)}`,
          cut.reason ? `💡 ${cut.reason}` : "",
          "",
          "Выбери, оставлять ли этот ролик для дальнейшей подготовки.",
        ].join("\n"),
        videoCutKeyboard(batch.id, cut.sequence),
      );
    }
    await sendMessage(token, chatId, [
      `✅ Все нарезки отправлены: ${cuts.length}.`,
      "Отметь нужные кнопкой «Оставить», затем нажми «Завершить выбор».",
      "После подтверждения я сам создам название, короткое описание и теги для каждого канала.",
    ].join("\n"), {
      inline_keyboard: [[{ text: "🏁 Завершить выбор", callback_data: `cut:finish:${batch.id}` }]],
    });
  } catch (error) {
    pendingVideoCutBatchByChat.delete(chatId);
    logger.error({ err: error, chatId, sourceUrl }, "Failed to create Telegram video cuts");
    const errorMessage = error instanceof Error ? error.message : "неизвестная ошибка";
    if (isYoutubeSourceUrl(sourceUrl) && /YouTube временно заблокировал скачивание|Не удалось скачать видео по этой ссылке|Не удалось скачать или нарезать видео/iu.test(errorMessage)) {
      pendingVideoCutSourceByChat.set(chatId, {
        sourceUrl,
        connectionIds: [...channelIds],
        banner,
      });
      if (banner) pendingVideoCutBannerByChat.set(chatId, banner);
      await updateChatPreferences(chatId, { pendingAction: "cut_source_url" });
      let uploadUrl: string | undefined;
      try {
        const uploadToken = createLargeVideoUploadToken(chatId, "cut-source.mp4", undefined, "cut_source");
        uploadUrl = `${uploadBaseUrl()}/api/upload/${uploadToken}`;
      } catch (uploadError) {
        logger.warn({ err: uploadError, chatId }, "Large cut source upload link is unavailable");
      }
      await sendMessage(token, chatId, [
        "⚠️ YouTube не разрешил серверу скачать эту ссылку.",
        "",
        "Отправь исходный MP4-файл прямо сюда — до 20 МБ.",
        uploadUrl ? "Если файл больше 20 МБ, используй защищённую загрузку ниже." : "",
        "Выбранные YouTube-каналы сохранятся, повторно выбирать их не нужно.",
        "Или отправь другую публичную ссылку.",
      ].filter(Boolean).join("\n"), uploadUrl
        ? { inline_keyboard: [[{ text: "📤 Загрузить исходный MP4", url: uploadUrl }]] }
        : undefined);
    } else {
      await sendMessage(token, chatId, `❌ Не удалось подготовить нарезку.\n\n${publicVideoCutError(sourceUrl, errorMessage)}`);
    }
  }
}

async function finishVideoCutSelection(token: string, chatId: number, batchId: string): Promise<void> {
  const batch = pendingVideoCutBatchByChat.get(chatId);
  if (!batch || batch.id !== batchId) {
    await sendMessage(token, chatId, "Сессия выбора нарезок закончилась. Запусти нарезку заново через меню.");
    return;
  }
  if (batch.finished) return;
  const selected = [...batch.kept].sort((a, b) => a - b);
  if (!selected.length) {
    await sendMessage(token, chatId, "Пока не выбрана ни одна нарезка. Нажми «✅ Оставить» под нужными видео.");
    return;
  }
  batch.finished = true;
  await sendMessage(token, chatId, [
    `✅ Выбрано нарезок: ${selected.length}.`,
    "",
    "🧠 Теперь сам анализирую содержание и готовлю отдельные название, описание и теги для каждого канала.",
    "Оригинальный звук сохраняется, новая озвучка не добавляется. Обложка не создаётся.",
  ].join("\n"), {
    inline_keyboard: [[{ text: "🚀 Запустить подготовку", callback_data: `cut:auto_publish:${batchId}` }]],
  });
}

async function showCutReactionChoice(token: string, chatId: number, batchId: string): Promise<void> {
  const batch = pendingVideoCutBatchByChat.get(chatId);
  if (!batch || batch.id !== batchId) {
    await sendMessage(token, chatId, "Сессия выбора нарезок закончилась. Запусти нарезку заново через меню.");
    return;
  }
  await sendMessage(token, chatId, "Выберите реакцию для всех выбранных нарезок:", {
    inline_keyboard: [
      [
        { text: "📸 Парень (фото)", callback_data: `cut:reaction:select:${batchId}:photo-male` },
        { text: "📸 Два парня (фото)", callback_data: `cut:reaction:select:${batchId}:photo-two-male` },
      ],
      [
        { text: "Бустер", callback_data: `cut:reaction:select:${batchId}:buster` },
        { text: "Егор Крид", callback_data: `cut:reaction:select:${batchId}:egor-krid` },
      ],
      [
        { text: "Братишкин", callback_data: `cut:reaction:select:${batchId}:bratishkin` },
        { text: "Эвелон", callback_data: `cut:reaction:select:${batchId}:evelone` },
      ],
      [
        { text: "Моргенштерн", callback_data: `cut:reaction:select:${batchId}:morgenshtern` },
        { text: "Другой клип", callback_data: `cut:reaction:select:${batchId}:other` },
      ],
    ],
  });
}

async function showCutSeoMenu(token: string, chatId: number, batchId: string): Promise<void> {
  await startCutMetadataFlow(token, chatId, batchId);
}

function parseCutTags(text: string): string[] {
  return [...new Set(
    text.split(/[,;\n]+/u)
      .map((tag) => tag.trim().replace(/^#+/u, ""))
      .filter(Boolean),
  )].slice(0, 30);
}

function cutHashtags(tags: string[]): string[] {
  const hashtags = tags
    .map((tag) => `#${tag.replace(/[^\p{L}\p{N}_]+/gu, "")}`)
    .filter((tag) => tag.length > 1);
  return [...new Set(["#shorts", ...hashtags])].slice(0, 3);
}

async function sendCutMetadataPrompt(token: string, chatId: number): Promise<void> {
  const session = pendingCutMetadataByChat.get(chatId);
  if (!session) throw new Error("Сессия SEO нарезки закончилась.");
  const sequence = session.sequences[session.index];
  if (!sequence) throw new Error("Нарезка для SEO не найдена.");
  const metadata = session.metadataBySequence.get(sequence);
  const stage = metadata?.title
    ? metadata.description
      ? "tags"
      : "description"
    : "title";
  const prompts = {
    title: `📝 Нарезка ${session.index + 1}/${session.sequences.length}\n\nНапишите название ролика.`,
    description: "Теперь напишите описание ролика.",
    tags: "Теперь напишите теги через запятую.",
  };
  await updateChatPreferences(chatId, { pendingAction: `cut_metadata_${stage}` });
  await sendMessage(token, chatId, prompts[stage]);
}

async function startCutMetadataFlow(token: string, chatId: number, batchId: string): Promise<void> {
  const batch = pendingVideoCutBatchByChat.get(chatId);
  if (!batch || batch.id !== batchId) {
    await sendMessage(token, chatId, "Сессия выбора нарезок закончилась. Запусти нарезку заново через меню.");
    return;
  }
  const selected = [...batch.kept].sort((a, b) => a - b);
  if (!selected.length) {
    await sendMessage(token, chatId, "Сначала оставь хотя бы одну нарезку.");
    return;
  }
  pendingCutMetadataByChat.set(chatId, {
    batchId,
    sequences: selected,
    index: 0,
    metadataBySequence: new Map(),
  });
  await sendMessage(token, chatId, [
    `✅ Выбрано нарезок: ${selected.length}.`,
    "",
    "Для каждой выбранной нарезки я последовательно спрошу название, описание и теги.",
    "После последнего ответа сразу опубликую все ролики на все подключённые YouTube-каналы.",
  ].join("\n"), {
    inline_keyboard: [
      [{ text: "🎬 Сделать edit выбранным нарезкам", callback_data: `cut:edit:start:${batchId}` }],
      [{ text: "➡️ Перейти к SEO без edit", callback_data: `cut:edit:skip:${batchId}` }],
    ],
  });
  await sendCutMetadataPrompt(token, chatId);
}

async function publishCutBatchWithMetadata(token: string, chatId: number): Promise<void> {
  const session = pendingCutMetadataByChat.get(chatId);
  const batch = session && pendingVideoCutBatchByChat.get(chatId);
  if (!session || !batch || batch.id !== session.batchId) {
    throw new Error("Сессия публикации нарезок закончилась.");
  }
  const connections = await listYoutubeConnections();
  if (!connections.length) throw new Error("Нет подключённых YouTube-каналов.");

  await sendMessage(token, chatId, [
    `🚀 Начинаю публикацию ${session.sequences.length} нарезок.`,
    `Каналов: ${connections.length}.`,
    "Публикация будет открытой и без интервалов.",
  ].join("\n"));

  let uploaded = 0;
  let failed = 0;
  const report: string[] = [];
  for (const sequence of session.sequences) {
    const cut = batch.cuts.get(sequence);
    const metadata = session.metadataBySequence.get(sequence);
    if (!cut || !metadata) {
      failed += connections.length;
      report.push(`❌ Нарезка ${sequence}: SEO-данные не найдены`);
      continue;
    }
    for (const connection of connections) {
      const channelTitle = connection.channelTitle || `Канал #${connection.id}`;
      try {
        const result = await uploadYoutubeShort({
          videoStoragePath: cut.storagePath,
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          connectionId: connection.id,
          privacyStatus: "public",
          preserveDescription: true,
        });
        try {
          await postYoutubeComment({
            videoId: result.videoId,
            connectionId: connection.id,
            text: NOX_PROFILE_COMMENT,
          });
        } catch (commentError) {
          logger.warn({ err: commentError, chatId, sequence, connectionId: connection.id }, "Cut comment creation failed");
        }
        uploaded += 1;
        report.push(`✅ ${sequence} → ${channelTitle}: https://youtu.be/${result.videoId}`);
      } catch (error) {
        failed += 1;
        report.push(`❌ ${sequence} → ${channelTitle}: ${error instanceof Error ? error.message : "ошибка загрузки"}`);
      }
    }
  }

  pendingCutMetadataByChat.delete(chatId);
  pendingVideoCutBatchByChat.delete(chatId);
  await updateChatPreferences(chatId, { pendingAction: null });
  await sendMainMenu(token, chatId, [
    "📺 Публикация нарезок завершена.",
    `Успешно: ${uploaded}. Ошибок: ${failed}.`,
    "",
    ...report.slice(0, 30),
    report.length > 30 ? `… ещё ${report.length - 30} результатов.` : "",
  ].filter(Boolean).join("\n"));
}

async function publishUniqueCutBatch(token: string, chatId: number, batchId: string): Promise<void> {
  const batch = pendingVideoCutBatchByChat.get(chatId);
  if (!batch || batch.id !== batchId) {
    throw new Error("Сессия нарезок закончилась. Запусти нарезку заново.");
  }
  const connections = await listYoutubeConnections();
  const selectedSequences = [...batch.kept].sort((a, b) => a - b);
  if (!selectedSequences.length) throw new Error("Не выбрана ни одна нарезка.");

  await sendMessage(token, chatId, [
    `🧠 Анализирую ${selectedSequences.length} фрагментов.`,
    "Придумаю отдельные заголовки, описания и теги для каналов.",
    "Новая озвучка и обложки отключены — сохраняю оригинальный звук и кадр.",
  ].join("\n"));

  let uploaded = 0;
  let failed = 0;
  const report: string[] = [];
  for (const sequence of selectedSequences) {
    const cut = batch.cuts.get(sequence);
    const connectionId = batch.channelIdBySequence.get(sequence);
    const connection = connections.find((item) => item.id === connectionId);
    if (!cut || !connection) {
      failed += 1;
      report.push(`❌ Нарезка ${sequence}: канал для этого фрагмента не найден.`);
      continue;
    }
    const channelTitle = connection.channelTitle || `Канал #${connection.id}`;
    try {
      const metadata = await generateYoutubeMetadata({
        title: batch.sourceTitle || "Нарезка из видео",
        topic: [
          `Исходник: ${batch.sourceTitle || "неизвестное видео"}`,
          `Канал назначения: ${channelTitle}`,
          "Это отдельный фрагмент для данного канала.",
        ].join("\n"),
        description: batch.sourceDescription || cut.reason || "Интересный момент из исходного видео.",
        scriptText: [
          `Название исходника: ${batch.sourceTitle || "неизвестно"}`,
          `Описание исходника: ${batch.sourceDescription || "нет описания"}`,
          `Что заметил AI при выборе момента: ${cut.reason || "самостоятельный динамичный фрагмент"}`,
          `Временной диапазон: ${formatCutTimestamp(cut.startSeconds)}–${formatCutTimestamp(cut.startSeconds + cut.durationSeconds)}`,
        ].join("\n"),
      });
      const channelMetadata = buildChannelMetadataVariant(
        metadata,
        channelTitle,
        connection.id,
        { includeChannelLead: false },
      );
      const result = await uploadYoutubeShort({
        videoStoragePath: cut.storagePath,
        title: channelMetadata.title,
        description: channelMetadata.description,
        tags: channelMetadata.tags,
        connectionId: connection.id,
        privacyStatus: "public",
        preserveDescription: true,
      });
      uploaded += 1;
      report.push(`✅ ${channelTitle}: ${channelMetadata.title}\nhttps://youtu.be/${result.videoId}`);
    } catch (error) {
      failed += 1;
      report.push(`❌ ${channelTitle}: ${error instanceof Error ? error.message : "ошибка подготовки или публикации"}`);
    }
  }

  pendingCutMetadataByChat.delete(chatId);
  pendingVideoCutBatchByChat.delete(chatId);
  await updateChatPreferences(chatId, { pendingAction: null });
  await sendMainMenu(token, chatId, [
    "📺 Индивидуальные нарезки готовы.",
    `Успешно: ${uploaded}. Ошибок: ${failed}.`,
    "",
    ...report.slice(0, 30),
    report.length > 30 ? `… ещё ${report.length - 30} результатов.` : "",
  ].filter(Boolean).join("\n"));
}

async function applyCutReactionBatch(
  token: string,
  chatId: number,
  pending: PendingVideoCutReaction,
  reactionStoragePath?: string,
): Promise<void> {
  const batch = pendingVideoCutBatchByChat.get(chatId);
  if (!batch || batch.id !== pending.batchId) {
    throw new Error("Сессия выбранных нарезок закончилась.");
  }
  if (pending.reactionMode === "image" && !pending.reactionImagePath) {
    throw new Error("Фото реакции не найдено.");
  }
  if (pending.reactionMode === "video" && !reactionStoragePath) {
    throw new Error("Reaction-клип не найден.");
  }

  for (let index = 0; index < pending.sequences.length; index += 1) {
    const sequence = pending.sequences[index]!;
    const cut = batch.cuts.get(sequence);
    if (!cut) throw new Error(`Нарезка ${sequence} не найдена.`);
    const outputStoragePath = pending.reactionMode === "image"
      ? await addReactionImageOverlay(cut.storagePath, pending.reactionImagePath!)
      : await addReactionOverlay(cut.storagePath, reactionStoragePath!);
    cut.storagePath = outputStoragePath;
    const outputBuffer = await readAudioAsset(outputStoragePath);
    await sendVideo(
      token,
      chatId,
      outputBuffer,
      [
        `🎭 Реакция ${pending.streamerName}: готова нарезка ${sequence} (${index + 1}/${pending.sequences.length}).`,
        "",
        pending.reactionMode === "image"
          ? "Фото размещено справа снизу. Звук исходной нарезки сохранён."
          : "Звук reaction-клипа удалён. Звук исходной нарезки сохранён.",
      ].join("\n"),
    );
  }
  pendingVideoCutReactionByChat.delete(chatId);
  await updateChatPreferences(chatId, { pendingAction: null });
  await sendMessage(token, chatId, "✅ Реакция добавлена ко всем выбранным нарезкам. Теперь можно перейти к SEO.");
  await showCutSeoMenu(token, chatId, pending.batchId);
}

async function handleCutReactionClip(
  token: string,
  chatId: number,
  fileId: string,
  fileSize?: number,
): Promise<void> {
  const pending = pendingVideoCutReactionByChat.get(chatId);
  if (!pending || pending.reactionMode !== "video") {
    await sendMainMenu(token, chatId, "Сессия реакции для нарезок закончилась. Начните выбор заново.");
    return;
  }
  try {
    if (fileSize && fileSize > TELEGRAM_DOWNLOAD_LIMIT_BYTES) {
      await sendMessage(token, chatId, "Reaction-клип больше 20 МБ. Отправьте файл до 20 МБ.");
      return;
    }
    await sendMessage(token, chatId, `⏳ Накладываю реакцию ${pending.streamerName} на ${pending.sequences.length} выбранных нарезок.`);
    const buffer = await downloadTelegramVideo(token, fileId, fileSize);
    const reactionStoragePath = await storeAudioAsset(buffer, "video", "video/mp4", "mp4");
    await applyCutReactionBatch(token, chatId, pending, reactionStoragePath);
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to add reaction to selected video cuts");
    await sendMessage(token, chatId, `❌ Не удалось добавить реакцию к нарезкам: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  }
}

function parseYoutubeEdit(
  text: string,
  current: YoutubeMetadata,
  options: { preserveDescription?: boolean; preserveBrandMarkers?: boolean } = {},
): YoutubeMetadata {
  const lines = text.split(/\r?\n/);
  const nonEmptyLines = lines.map((line) => line.trim()).filter(Boolean);
  let title = current.title;
  let description = current.description;
  let tags = current.tags;
  let hashtags = current.hashtags;
  let activeField: "title" | "description" | "tags" | "hashtags" | null = null;
  const descriptionLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = line.match(/^(название|title|описание|description|теги|tags|ключевые слова|keywords|хэштеги|hashtags)\s*:\s*(.*)$/iu);
    if (match) {
      const key = match[1].toLowerCase();
      const value = match[2].trim();
      if (key === "название" || key === "title") {
        title = value;
        activeField = "title";
      } else if (key === "описание" || key === "description") {
        descriptionLines.length = 0;
        if (value) descriptionLines.push(value);
        activeField = "description";
      } else if (key === "теги" || key === "tags" || key === "ключевые слова" || key === "keywords") {
        tags = value.split(/[,;]/).map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean);
        activeField = "tags";
      } else {
        hashtags = value.split(/[\s,;]+/)
          .map((tag) => tag.trim().replace(/^#?/, "#"))
          .filter((tag) => tag.length > 1);
        activeField = "hashtags";
      }
      continue;
    }
    if (activeField === "description" && line) descriptionLines.push(line);
    else if (!activeField && line && !title) title = line;
  }

  if (descriptionLines.length) {
    description = descriptionLines.join("\n").trim();
  }
  if (!current.title && !current.description && !title && !description && nonEmptyLines.length) {
    title = nonEmptyLines[0] || "";
    description = nonEmptyLines.slice(1).join("\n");
  } else if (!current.title && !current.description && nonEmptyLines.length && !description && !nonEmptyLines.some((line) => /^(?:название|title|описание|description|теги|tags|ключевые слова|keywords|хэштеги|hashtags)\s*:/iu.test(line))) {
    title = nonEmptyLines[0] || "";
    description = nonEmptyLines.slice(1).join("\n");
  }

  const descriptionHashtags = description.match(/#[\p{L}\p{N}_]+/gu) || [];
  hashtags = [...hashtags, ...descriptionHashtags];
  const normalizedHashtags = [...new Set(hashtags)].slice(0, 20);
  const withoutDuplicateHashtags = description
    .replace(/(?:^|\s)#\S+/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  const descriptionWithHashtags = options.preserveDescription
    ? description.trim()
    : normalizedHashtags.length
      ? `${withoutDuplicateHashtags}\n\n${normalizedHashtags.join(" ")}`.trim()
      : description.trim();
  return {
    title: (title || current.title).slice(0, 100),
    description: (options.preserveBrandMarkers
      ? descriptionWithHashtags
      : ensureYoutubeBrandMarkers(descriptionWithHashtags || current.description)
    ).slice(0, 5000),
    tags: (tags.length ? tags : current.tags).slice(0, 30),
    hashtags: normalizedHashtags.length ? normalizedHashtags : current.hashtags,
  };
}

async function handleVideoTopic(token: string, chatId: number, topic: string): Promise<void> {
  try {
    await sendMessage(token, chatId, "⏳ Тема получена. Проверяю настройки и готовлю запуск…");
    const preferences = await getChatPreferences(chatId);
    const preset = preferences.stylePreset && preferences.stylePreset in STYLE_PRESETS
      ? STYLE_PRESETS[preferences.stylePreset as StylePresetId]
      : STYLE_PRESETS.cinematic_realism;
    const selectedStyle = preferences.customStyle || preset.style;
    const selectedTone = preferences.tone || preset.tone;
    const selectedPlatform = preferences.platform || PLATFORM_PRESETS.youtube_shorts.format;
    const chatMode = selectedPlatform.toLowerCase().includes("chat");
    const selectedDuration = chatMode
      ? Math.min(Math.max(preferences.duration || CHAT_MIN_DURATION_SECONDS, CHAT_MIN_DURATION_SECONDS), CHAT_MAX_DURATION_SECONDS)
      : preferences.duration || 60;
    const scriptDuration = chatMode
      ? Math.max(1, selectedDuration - CHAT_INTRO_DURATION_SECONDS)
      : selectedDuration;
    const speechLabel = getSpeechProvider() === "google_free" ? "бесплатная русская озвучка Google" : "ElevenLabs";
     await sendMessage(
       token,
       chatId,
       [
         "📝 Тема получена. Сначала подготовлю черновик сценария — озвучка и остальные stages пока НЕ запускаются.",
        "",
        `📝 Пожелания: ${preferences.scriptInstructions ? "учитываются" : "стандартные"}`,
        `🎙 Голос: ${preferences.voiceName || "автоматический"}`,
        `🎨 Стиль: ${preferences.customStyle || preset.label}`,
          `⏱ Общая длительность: до ${selectedDuration} секунд${chatMode ? ` (включая вступление ${CHAT_INTRO_DURATION_SECONDS} секунд)` : ""}`,
         `📱 Платформа: ${selectedPlatform}`,
         selectedPlatform.toLowerCase().includes("chat") ? "💬 Сообщения будут появляться по очереди прямо в чате." : "",
      ].join("\n"),
    );
    const script = await generateVideoScript({
      topic,
      format: selectedPlatform,
      duration: scriptDuration,
      style: selectedStyle,
      tone: selectedTone,
      instructions: preferences.scriptInstructions,
    });
    const [project] = await db.insert(projectsTable).values({
      title: script.title,
      topic,
      format: selectedPlatform,
        duration: selectedDuration,
      style: selectedStyle,
      tone: selectedTone,
      scriptJson: script,
       status: "draft",
    }).returning({ id: projectsTable.id });
    lastProjectByChat.set(chatId, project.id);
    await updateChatPreferences(chatId, { pendingAction: null });
    await sendMessage(token, chatId, formatScriptForTelegram(script), {
      inline_keyboard: [
        [{ text: "🖼 Добавить изображение к сцене", callback_data: "image:add" }],
        [{ text: "✅ Утвердить и создать видео", callback_data: "draft:approve" }],
        [{ text: "✏️ Внести правки", callback_data: "draft:edit" }, { text: "🔄 Новый вариант", callback_data: "draft:regenerate" }],
      ],
    });
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to start Telegram video pipeline");
    const errorMessage = error instanceof Error ? error.message : "unknown error";
    if (/timeout|operation was aborted/i.test(errorMessage)) {
      await sendMessage(token, chatId, "⏱️ Сценарий не успел сгенерироваться за отведённое время. Настройки чата сохранены — отправьте тему ещё раз, повторный запрос будет компактнее.");
    } else {
      await sendMessage(token, chatId, `Не получилось запустить видео pipeline: ${errorMessage}`);
    }
  }
}

type CustomChatMessage = {
  text: string;
  sender: "anonymous" | "contact";
};

function parseCustomChatScript(text: string, requestedMaxMessages: number): CustomChatMessage[] {
  const sourceLines = text
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lines = sourceLines.length > 1
    ? sourceLines
    : text
      .split(/(?<=[.!?…])\s+/u)
      .map((line) => line.trim())
      .filter(Boolean);
  const messages: CustomChatMessage[] = [];
  const speakerPattern = /^(аноним|собеседник|собеседница|я|он|она|a|b|1|2)\s*[:—-]\s*(.+)$/iu;

  for (const [index, line] of lines.entries()) {
    const match = line.match(speakerPattern);
    const label = match?.[1]?.toLocaleLowerCase();
    const messageText = (match?.[2] || line)
      .replace(/^["«]|["»]$/gu, "")
      .trim();
    if (!messageText) continue;
    const sender = match
      ? /^(аноним|я|он|она|a|1)$/iu.test(label || "") ? "anonymous" : "contact"
      : index % 2 === 0 ? "contact" : "anonymous";
    messages.push({ text: messageText, sender });
  }

  const maxMessages = Math.min(24, Math.max(5, requestedMaxMessages));
  if (messages.length > maxMessages) {
    const kept = messages.slice(0, maxMessages - 1);
    kept.push({
      sender: messages[maxMessages - 1]!.sender,
      text: messages.slice(maxMessages - 1).map((message) => message.text).join(" "),
    });
    return kept;
  }
  return messages;
}

function allocateChatSceneDurations(messages: CustomChatMessage[], totalSeconds: number): number[] {
  const safeTotal = Math.max(messages.length, totalSeconds);
  const weights = messages.map((message) => Math.max(1, message.text.split(/\s+/u).filter(Boolean).length));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const durations = weights.map((weight) => Math.max(1, Math.floor((safeTotal * weight) / weightTotal)));
  let difference = safeTotal - durations.reduce((sum, duration) => sum + duration, 0);
  for (let index = 0; difference > 0; index = (index + 1) % durations.length) {
    durations[index]! += 1;
    difference -= 1;
  }
  for (let index = durations.length - 1; difference < 0; index = (index - 1 + durations.length) % durations.length) {
    if (durations[index]! <= 1) continue;
    durations[index]! -= 1;
    difference += 1;
  }
  return durations;
}

async function createChatVideoJobFromScript(chatId: number, text: string): Promise<{
  projectId: number;
  jobId: number;
  storyDuration: number;
}> {
  if (text.length > CHAT_CUSTOM_SCRIPT_MAX_CHARS) {
    throw new Error(`Сценарий слишком длинный. Максимум ${CHAT_CUSTOM_SCRIPT_MAX_CHARS.toLocaleString("ru-RU")} символов.`);
  }
  const preferences = await getChatPreferences(chatId);
  const totalDuration = Math.min(
    Math.max(preferences.duration || CHAT_MIN_DURATION_SECONDS, CHAT_MIN_DURATION_SECONDS),
    CHAT_MAX_DURATION_SECONDS,
  );
  const storyDuration = Math.max(1, totalDuration - CHAT_INTRO_DURATION_SECONDS);
  const messages = parseCustomChatScript(text, Math.min(24, Math.max(5, storyDuration)));
  if (messages.length < 2) {
    throw new Error("Нужно минимум две реплики. Разделите сообщения переносами строк или подпишите их: «Аноним: …» и «Собеседник: …».");
  }

  const durations = allocateChatSceneDurations(messages, storyDuration);
  const script: VideoScript = {
    title: `Чат: ${messages[0]!.text.slice(0, 80)}`,
    hook: messages[0]!.text,
    description: "Авторская история в формате чат-переписки.",
    duration_seconds: storyDuration,
    scenes: messages.map((message, index) => ({
      scene_number: index + 1,
      duration_seconds: durations[index]!,
      voice_text: message.text,
      visual_description: message.sender === "contact" ? "Сообщение Собеседника в чате" : "Сообщение Анонима в чате",
      image_prompt: "Не используется: сцена отображается динамическим интерфейсом чат-переписки.",
      scene_purpose: index === 0 ? "Открывающая реплика" : "Развитие авторской переписки",
      story_beat: index === messages.length - 1 ? "Финальная реплика истории" : "Следующая реплика диалога",
      cause: index === 0 ? "Авторский сценарий пользователя" : "Ответ на предыдущую реплику",
      action: "Сообщение появляется в интерфейсе чата",
      obstacle: "",
      change: "Меняется состояние переписки",
      continuity: "Продолжение одной переписки",
      transition: "Следующая реплика появляется после паузы",
    })),
    ending: messages.at(-1)!.text,
    cta: "",
  };

  const [project] = await db.insert(projectsTable).values({
    title: script.title,
    topic: text.slice(0, 500),
    format: "Chat 9:16",
    duration: totalDuration,
    style: preferences.customStyle || "chat interface",
    tone: preferences.tone || "emotional",
    scriptJson: script,
    status: "completed",
  }).returning({ id: projectsTable.id });
  lastProjectByChat.set(chatId, project.id);
  const job = await startVideoGeneration(project.id, {
    format: "Chat 9:16",
    duration: totalDuration,
    style: preferences.customStyle || "chat interface",
    tone: preferences.tone || "emotional",
    voiceId: preferences.voiceId || undefined,
    voiceName: preferences.voiceName || undefined,
    chatId,
  });
  return { projectId: project.id, jobId: job.id, storyDuration };
}

const CHAT_DAY_VARIATION_INSTRUCTIONS = [
  "Сделай другой hook и начальную реплику, но сохрани тот же конфликт и финальный смысл.",
  "Сохрани героев и факты, но измени темп, порядок раскрытия информации и формулировки реплик.",
  "Сделай более напряжённую альтернативу с теми же событиями, без новых фактов и персонажей.",
  "Сделай более бытовую и естественную альтернативу, сохранив основную историю и развязку.",
  "Сделай динамичную короткую альтернативу с другим входом в историю и тем же смысловым финалом.",
];

function generatedChatScriptToText(script: VideoScript): string {
  const scenes = script.scenes
    .map((scene) => scene.voice_text.trim())
    .filter(Boolean);
  if (scenes.length < 2) {
    throw new Error("Не удалось получить минимум две реплики для варианта дневного пакета.");
  }
  return scenes.map((text, index) => `${index % 2 === 0 ? "Аноним" : "Собеседник"}: ${text}`).join("\n");
}

async function getActiveChatDayBatch(
  chatId: number,
  statuses?: ChatDayBatchStatus[],
) {
  const where = statuses?.length
    ? and(eq(chatDayBatchesTable.chatId, chatId), inArray(chatDayBatchesTable.status, statuses))
    : eq(chatDayBatchesTable.chatId, chatId);
  const [batch] = await db.select().from(chatDayBatchesTable)
    .where(where)
    .orderBy(desc(chatDayBatchesTable.updatedAt))
    .limit(1);
  return batch || null;
}

async function generateChatDayVariants(token: string, chatId: number, baseScript: string): Promise<string[]> {
  const preferences = await getChatPreferences(chatId);
  const totalDuration = Math.min(
    Math.max(preferences.duration || CHAT_MIN_DURATION_SECONDS, CHAT_MIN_DURATION_SECONDS),
    CHAT_MAX_DURATION_SECONDS,
  );
  const storyDuration = Math.max(1, totalDuration - CHAT_INTRO_DURATION_SECONDS);
  const variants: string[] = [];

  for (const [offset, variation] of CHAT_DAY_VARIATION_INSTRUCTIONS.slice(1).entries()) {
    const index = offset + 1;
    await sendMessage(
      token,
      chatId,
      `✍️ Анализирую исходник и готовлю вариант сценария ${index + 1}/5…`,
    );
    let script: VideoScript | null = null;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2 && !script; attempt += 1) {
      try {
        script = await generateVideoScript({
          topic: `Авторская чат-переписка для варианта ${index + 1}`,
          format: "Chat 9:16",
          duration: storyDuration,
          style: preferences.customStyle || "chat interface",
          tone: preferences.tone || "emotional",
          instructions: [
            "Пользователь уже прислал полностью готовый авторский сценарий. Не проси тему, формат или краткое описание — анализируй именно этот текст.",
            "Создай близкий альтернативный сценарий короткой чат-переписки на основе исходника пользователя.",
            variation,
            "Это не новая история и не пересказ: сохрани исходных участников, ключевые события, причинно-следственную связь и общий финал.",
            "Можно добавить одну-две новые изюминки, реакцию или небольшой поворот только так, чтобы они логично вытекали из исходника и не ломали его смысл.",
            "Не добавляй рекламу, CTA, третьих персонажей и новые факты.",
            "Дай минимум две и максимум 24 последовательные реплики.",
            "В voice_text пиши только текст реплик, без слов «Аноним» и «Собеседник».",
            attempt === 2
              ? "Это повторная попытка после таймаута. Отвечай компактно: 6–10 коротких реплик, без длинных описаний и повторов."
              : "",
            `Исходный сценарий пользователя:\n${baseScript}`,
          ].filter(Boolean).join("\n\n"),
        });
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await sendMessage(token, chatId, `⏳ Вариант ${index + 1}/5 не успел ответить. Повторяю запрос в компактном формате…`);
        }
      }
    }
    if (!script) {
      throw lastError instanceof Error
        ? lastError
        : new Error(`Не удалось подготовить вариант ${index + 1}/5.`);
    }
    variants.push(generatedChatScriptToText(script));
  }
  return variants;
}

async function createChatDayBatchFromScript(
  token: string,
  chatId: number,
  baseScript: string,
): Promise<void> {
  if (baseScript.length > CHAT_CUSTOM_SCRIPT_MAX_CHARS) {
    throw new Error(`Сценарий слишком длинный. Максимум ${CHAT_CUSTOM_SCRIPT_MAX_CHARS.toLocaleString("ru-RU")} символов.`);
  }
  const parsedBase = parseCustomChatScript(baseScript, 24);
  if (parsedBase.length < 2) {
    throw new Error("Нужно минимум две реплики. Используйте «Аноним: …» и «Собеседник: …».");
  }

  const [batch] = await db.insert(chatDayBatchesTable).values({
    chatId,
    totalCount: 5,
    intervalMinutes: 180,
    status: "generating_variants",
    baseScript,
  }).returning();
  if (!batch) throw new Error("Не удалось создать дневной пакет.");

  try {
    const generatedVariants = await generateChatDayVariants(token, chatId, baseScript);
    const variants = [baseScript, ...generatedVariants];
    await db.insert(chatDayBatchItemsTable).values(variants.map((scriptText, index) => ({
      batchId: batch.id,
      sequence: index + 1,
      scriptText,
      status: "pending",
    })));
    await db.update(chatDayBatchesTable).set({ status: "awaiting_review", updatedAt: new Date() })
      .where(eq(chatDayBatchesTable.id, batch.id));
    await sendMessage(token, chatId, [
      "📦 Пять вариантов сценария готовы.",
      "",
      ...variants.map((variant, index) => {
        const firstLine = variant.split(/\r?\n/)[0] || "Без названия";
        return `${index + 1}. ${index === 0 ? "Ваш исходный сценарий" : "Новая вариация"} — ${firstLine.slice(0, 150)}`;
      }),
      "",
      "Первый ролик будет создан по вашему тексту без переписывания. Остальные четыре — близкие вариации с новыми деталями.",
    ].join("\n"), {
      inline_keyboard: [
        [{ text: "✅ Утвердить пять вариантов", callback_data: `chat_day:approve_variants:${batch.id}` }],
        [{ text: "❌ Отменить", callback_data: `chat_day:cancel:${batch.id}` }],
      ],
    });
  } catch (error) {
    await db.update(chatDayBatchesTable).set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(chatDayBatchesTable.id, batch.id));
    throw error;
  }
}

async function createManualChatDayBatch(token: string, chatId: number): Promise<void> {
  const existing = await getActiveChatDayBatch(chatId, ["generating_variants", "awaiting_review", "processing", "awaiting_video_review", "awaiting_metadata"]);
  if (existing) throw new Error("У вас уже есть незавершённый дневной пакет. Завершите его или отправьте /cancel.");
  const [batch] = await db.insert(chatDayBatchesTable).values({
    chatId,
    totalCount: 5,
    intervalMinutes: 180,
    status: "collecting_scripts",
    baseScript: "",
  }).returning();
  if (!batch) throw new Error("Не удалось создать дневной пакет.");
  await updateChatPreferences(chatId, { pendingAction: "chat_day_manual_script" });
  await sendMessage(token, chatId, [
    "📝 Ручной ввод пяти сценариев.",
    "",
    "Отправьте сценарий для видео 1/5.",
    "Затем я по очереди попрошу видео 2/5, 3/5, 4/5 и 5/5.",
    "",
    "Каждый сценарий должен содержать минимум две реплики. Можно присылать полный текст с подписями говорящих.",
    "Для отмены отправьте /cancel.",
  ].join("\n"));
}

async function waitForChatDayVideo(jobId: number): Promise<string> {
  for (let attempt = 0; attempt < 360; attempt += 1) {
    const [job] = await db.select({
      status: videoGenerationJobsTable.status,
      videoStoragePath: videoGenerationJobsTable.videoStoragePath,
      error: videoGenerationJobsTable.error,
    }).from(videoGenerationJobsTable).where(eq(videoGenerationJobsTable.id, jobId));
    if (!job) throw new Error("Видео job дневного пакета не найден.");
    if (job.status === "failed") throw new Error(job.error || "Видео дневного пакета не создано.");
    if (job.status === "completed" && job.videoStoragePath) return job.videoStoragePath;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error("Создание видео дневного пакета превысило лимит ожидания.");
}

async function runChatDayBatch(token: string, chatId: number, batchId: number): Promise<void> {
  const batch = await db.select().from(chatDayBatchesTable).where(and(
    eq(chatDayBatchesTable.id, batchId),
    eq(chatDayBatchesTable.chatId, chatId),
  )).limit(1);
  if (!batch[0]) throw new Error("Дневной пакет не найден.");
  await db.update(chatDayBatchesTable).set({ status: "processing", updatedAt: new Date() })
    .where(eq(chatDayBatchesTable.id, batchId));

  const items = await db.select().from(chatDayBatchItemsTable)
    .where(eq(chatDayBatchItemsTable.batchId, batchId))
    .orderBy(chatDayBatchItemsTable.sequence);
  for (const item of items) {
    if (item.status === "ready" || item.status === "published") continue;
    try {
      await db.update(chatDayBatchesTable).set({ currentIndex: item.sequence, updatedAt: new Date() })
        .where(eq(chatDayBatchesTable.id, batchId));
      const retryingFailedItem = item.status === "failed";
      if (retryingFailedItem) {
        await db.update(chatDayBatchItemsTable).set({
          projectId: null,
          jobId: null,
          sourceVideoStoragePath: null,
          status: "pending",
          error: null,
          updatedAt: new Date(),
        }).where(eq(chatDayBatchItemsTable.id, item.id));
      }
      let projectId = retryingFailedItem ? null : item.projectId;
      let jobId = retryingFailedItem ? null : item.jobId;
      if (!projectId || !jobId) {
        const created = await createChatVideoJobFromScript(chatId, item.scriptText);
        projectId = created.projectId;
        jobId = created.jobId;
        await db.update(chatDayBatchItemsTable).set({ projectId, jobId, status: "processing", updatedAt: new Date() })
          .where(eq(chatDayBatchItemsTable.id, item.id));
      }
      const sourceVideoStoragePath = item.sourceVideoStoragePath || await waitForChatDayVideo(jobId);
      await db.update(chatDayBatchItemsTable).set({
        sourceVideoStoragePath,
        status: "ready",
        error: null,
        updatedAt: new Date(),
      }).where(eq(chatDayBatchItemsTable.id, item.id));
      const videoBuffer = await readAudioAsset(sourceVideoStoragePath);
      await sendVideo(token, chatId, videoBuffer, `✅ Дневной пакет: ролик ${item.sequence}/5 готов.`);
      await db.update(videoGenerationJobsTable).set({ telegramDeliveredAt: new Date() })
        .where(eq(videoGenerationJobsTable.id, jobId));
    } catch (error) {
      await db.update(chatDayBatchItemsTable).set({
        status: "failed",
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
        updatedAt: new Date(),
      }).where(eq(chatDayBatchItemsTable.id, item.id));
      await sendMessage(token, chatId, `❌ Ролик ${item.sequence}/5 не создан: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
    }
  }

  const finishedItems = await db.select().from(chatDayBatchItemsTable)
    .where(eq(chatDayBatchItemsTable.batchId, batchId));
  const failed = finishedItems.filter((item) => item.status === "failed");
  if (failed.length) {
    await db.update(chatDayBatchesTable).set({ status: "awaiting_video_review", updatedAt: new Date() })
      .where(eq(chatDayBatchesTable.id, batchId));
    await sendMessage(token, chatId, `⚠️ Дневной пакет завершён с ошибками: готово ${finishedItems.length - failed.length}/5. Готовые ролики сохранены. Повторить можно только ошибки.`, {
      inline_keyboard: [
        [{ text: "🔁 Повторить ошибки", callback_data: `chat_day:retry_failed:${batchId}` }],
        [{ text: "❌ Отменить пакет", callback_data: `chat_day:cancel:${batchId}` }],
      ],
    });
    return;
  }
  await db.update(chatDayBatchesTable).set({ status: "awaiting_video_review", updatedAt: new Date() })
    .where(eq(chatDayBatchesTable.id, batchId));
  await sendMessage(token, chatId, "✅ Все пять роликов готовы. Проверьте их выше и подтвердите пакет для публикации.", {
    inline_keyboard: [
      [{ text: "✅ Всё хорошо — перейти к SEO", callback_data: `chat_day:approve_videos:${batchId}` }],
      [{ text: "❌ Отменить пакет", callback_data: `chat_day:cancel:${batchId}` }],
    ],
  });
}

async function showChatDayChannelChoice(token: string, chatId: number, batchId: number): Promise<void> {
  const [batch] = await db.select().from(chatDayBatchesTable).where(and(
    eq(chatDayBatchesTable.id, batchId),
    eq(chatDayBatchesTable.chatId, chatId),
  ));
  if (!batch) throw new Error("Дневной пакет не найден.");
  const connections = await listYoutubeConnections();
  if (!connections.length) throw new Error("Нет подключённых YouTube-каналов.");
  const selectedIds = new Set(Array.isArray(batch.connectionIds) ? batch.connectionIds as number[] : []);
  const rows: Array<Array<{ text: string; callback_data: string }>> = [
    [
      { text: "☑️ Выбрать все", callback_data: `chat_day:target:all:${batchId}` },
      { text: "◻️ Снять все", callback_data: `chat_day:target:none:${batchId}` },
    ],
  ];
  for (const connection of connections) {
    rows.push([{
      text: `${selectedIds.has(connection.id) ? "✅" : "⬜"} ${connection.channelTitle || `Канал #${connection.id}`}`,
      callback_data: `chat_day:target:${connection.id}:${batchId}`,
    }]);
  }
  rows.push([{ text: `✅ Готово — выбрано: ${selectedIds.size}`, callback_data: `chat_day:targets:done:${batchId}` }]);
  rows.push([{ text: "❌ Отмена", callback_data: `chat_day:cancel:${batchId}` }]);
  await sendMessage(token, chatId, [
    "📺 Выберите каналы для пяти роликов.",
    "",
    "Каждый ролик будет отдельно уникализирован под каждый выбранный канал.",
    `Выбрано: ${selectedIds.size} из ${connections.length}.`,
  ].join("\n"), { inline_keyboard: rows });
}

async function prepareChatDayMetadata(
  token: string,
  chatId: number,
  batchId: number,
  exampleText?: string,
): Promise<void> {
  const [batch] = await db.select().from(chatDayBatchesTable).where(and(
    eq(chatDayBatchesTable.id, batchId),
    eq(chatDayBatchesTable.chatId, chatId),
    eq(chatDayBatchesTable.status, "awaiting_metadata"),
  ));
  if (!batch) throw new Error("Дневной пакет не найден.");
  const items = await db.select().from(chatDayBatchItemsTable)
    .where(eq(chatDayBatchItemsTable.batchId, batchId))
    .orderBy(chatDayBatchItemsTable.sequence);
  if (items.length !== 5 || items.some((item) => !item.scriptText.trim())) {
    throw new Error("Для SEO нужно пять готовых сценариев.");
  }
  const trimmedExample = exampleText?.trim();
  const example = trimmedExample && !/^(нет|авто|автоматически|без примера)$/iu.test(trimmedExample)
    ? parseYoutubeEdit(trimmedExample, { title: "", description: "", tags: [], hashtags: [] })
    : null;
  await sendMessage(token, chatId, "🧠 Анализирую пять сценариев и готовлю отдельные заголовки, описания и теги…");
  const variants = await generateYoutubeMetadataVariants({
    scripts: items.map((item) => item.scriptText),
    example,
  });
  await db.update(chatDayBatchesTable).set({
    metadata: {
      ...variants[0],
      variants,
      metadataMode: "auto",
    },
    updatedAt: new Date(),
  }).where(eq(chatDayBatchesTable.id, batchId));
  await updateChatPreferences(chatId, { pendingAction: null });
  await showChatDayChannelChoice(token, chatId, batchId);
}

async function collectChatDayMetadata(
  token: string,
  chatId: number,
  batchId: number,
  text: string,
): Promise<void> {
  const [batch] = await db.select().from(chatDayBatchesTable).where(and(
    eq(chatDayBatchesTable.id, batchId),
    eq(chatDayBatchesTable.chatId, chatId),
    eq(chatDayBatchesTable.status, "awaiting_metadata"),
  ));
  if (!batch) throw new Error("Дневной пакет не найден.");

  const metadata = (batch.metadata || {}) as ChatDayBatchMetadata;
  const variants = Array.isArray(metadata.variants)
    ? metadata.variants.filter((variant): variant is YoutubeMetadata => Boolean(variant && typeof variant === "object"))
    : [];
  const sequence = variants.length + 1;
  if (sequence > 5) {
    await updateChatPreferences(chatId, { pendingAction: null });
    await showChatDayChannelChoice(token, chatId, batchId);
    return;
  }

  const parsed = parseYoutubeEdit(
    text,
    { title: "", description: "", tags: [], hashtags: [] },
    { preserveDescription: true, preserveBrandMarkers: true },
  );
  if (!parsed.title.trim()) throw new Error(`Не указан заголовок выпуска ${sequence}/5.`);
  if (!parsed.description.trim()) throw new Error(`Не указано описание выпуска ${sequence}/5.`);
  if (!parsed.tags.length) throw new Error(`Не указаны теги выпуска ${sequence}/5.`);
  if (!parsed.hashtags.length) throw new Error(`Не указаны хэштеги выпуска ${sequence}/5.`);

  const updatedVariants = [...variants, parsed];
  await db.update(chatDayBatchesTable).set({
    metadata: {
      ...parsed,
      variants: updatedVariants,
      metadataMode: "manual",
    },
    updatedAt: new Date(),
  }).where(eq(chatDayBatchesTable.id, batchId));

  if (sequence < 5) {
    await sendMessage(token, chatId, [
      `✅ Данные выпуска ${sequence}/5 сохранены.`,
      "",
      `Теперь отправьте SEO для выпуска ${sequence + 1}/5 в том же формате:`,
      "Название: ...",
      "Описание: ...",
      "Теги: тег 1, тег 2",
      "Хэштеги: #shorts #история",
    ].join("\n"));
    return;
  }

  await updateChatPreferences(chatId, { pendingAction: null });
  await sendMessage(token, chatId, "✅ Данные для всех пяти выпусков сохранены. Теперь выберите YouTube-каналы.");
  await showChatDayChannelChoice(token, chatId, batchId);
}

async function scheduleChatDayBatch(token: string, chatId: number, batchId: number, privacyStatus: "private" | "public"): Promise<void> {
  const now = Date.now();
  const items = await db.select().from(chatDayBatchItemsTable)
    .where(eq(chatDayBatchItemsTable.batchId, batchId))
    .orderBy(chatDayBatchItemsTable.sequence);
  for (const item of items) {
    await db.update(chatDayBatchItemsTable).set({
      scheduledAt: new Date(now + (item.sequence - 1) * 180 * 60_000),
      status: "scheduled",
      updatedAt: new Date(),
    }).where(eq(chatDayBatchItemsTable.id, item.id));
  }
  await db.update(chatDayBatchesTable).set({
    privacyStatus,
    status: "scheduled",
    updatedAt: new Date(),
  }).where(eq(chatDayBatchesTable.id, batchId));
  await sendMessage(token, chatId, "⏳ Готовлю и загружаю пять роликов с приветствиями каналов.\nВсе загрузятся сразу в закрытом доступе, затем YouTube автоматически откроет их по расписанию каждые 3 часа.");
  runTelegramBackgroundTask(
    runScheduledChatDayBatch(token, chatId, batchId),
    { chatId, batchId, task: "chat-day-schedule" },
  );
}

async function runScheduledChatDayBatch(token: string, chatId: number, batchId: number): Promise<void> {
  const [batch] = await db.select().from(chatDayBatchesTable).where(and(
    eq(chatDayBatchesTable.id, batchId),
    eq(chatDayBatchesTable.chatId, chatId),
  ));
  if (!batch) return;
  const items = await db.select().from(chatDayBatchItemsTable)
    .where(eq(chatDayBatchItemsTable.batchId, batchId))
    .orderBy(chatDayBatchItemsTable.sequence);
  const connectionIds = Array.isArray(batch.connectionIds) ? batch.connectionIds as number[] : [];
  const metadata = (batch.metadata || {}) as ChatDayBatchMetadata;
  const preferences = await getChatPreferences(chatId);
  const connections = await listYoutubeConnections();

  for (const item of items) {
    if (item.status === "published") continue;
    try {
      await db.update(chatDayBatchItemsTable).set({ status: "publishing", updatedAt: new Date() })
        .where(eq(chatDayBatchItemsTable.id, item.id));
      const results: string[] = [];
      const storedVariant = Array.isArray(metadata.variants)
        ? metadata.variants[item.sequence - 1] as YoutubeMetadata | undefined
        : undefined;
      const itemMetadata: YoutubeMetadata = storedVariant || {
        title: `${String(metadata.title || "Дневная история")} — выпуск ${item.sequence}`.slice(0, 100),
        description: String(metadata.description || ""),
        tags: Array.isArray(metadata.tags) ? metadata.tags as string[] : [],
        hashtags: Array.isArray(metadata.hashtags) ? metadata.hashtags as string[] : [],
      };
      const thumbnail = await createYoutubeThumbnail({
        topic: batch.baseScript || item.scriptText,
        title: itemMetadata.title,
        description: itemMetadata.description,
      });
      const publishAt = item.scheduledAt && item.scheduledAt.getTime() > Date.now()
        ? item.scheduledAt
        : undefined;
      for (const connectionId of connectionIds) {
        const connection = connections.find((candidate) => candidate.id === connectionId);
        const channelTitle = connection?.channelTitle || `Канал #${connectionId}`;
        const channelMetadata = metadata.metadataMode === "manual"
          ? itemMetadata
          : buildChannelMetadataVariant(itemMetadata, channelTitle, connectionId);
        const channelVideoStoragePath = await createYoutubeChannelVariant({
          sourceStoragePath: item.sourceVideoStoragePath!,
          channelTitle,
          connectionId,
          voiceId: preferences.voiceId || getConfiguredVoiceId(),
        });
        const result = await uploadYoutubeShort({
          videoStoragePath: channelVideoStoragePath,
          title: channelMetadata.title,
          description: channelMetadata.description,
          tags: channelMetadata.tags,
          thumbnail,
          connectionId,
          privacyStatus: (batch.privacyStatus as "private" | "public") || "private",
          preserveDescription: metadata.metadataMode === "manual",
          publishAt,
        });
        results.push(`✅ ${channelTitle}: https://youtu.be/${result.videoId}`);
      }
      await db.update(chatDayBatchItemsTable).set({
        status: "published",
        publishedAt: new Date(),
        error: null,
        updatedAt: new Date(),
      }).where(eq(chatDayBatchItemsTable.id, item.id));
      await sendMessage(token, chatId, [
        publishAt
          ? `📺 Выпуск ${item.sequence}/5 загружен и поставлен на отложенную публикацию.`
          : `📺 Выпуск ${item.sequence}/5 опубликован.`,
        "",
        ...results,
      ].join("\n"));
    } catch (error) {
      await db.update(chatDayBatchItemsTable).set({
        status: "failed",
        error: error instanceof Error ? error.message : "Ошибка публикации",
        updatedAt: new Date(),
      }).where(eq(chatDayBatchItemsTable.id, item.id));
      await sendMessage(token, chatId, `❌ Выпуск ${item.sequence}/5 не опубликован: ${error instanceof Error ? error.message : "ошибка загрузки"}`);
    }
  }
  await db.update(chatDayBatchesTable).set({ status: "completed", updatedAt: new Date() })
    .where(eq(chatDayBatchesTable.id, batchId));
  await sendMessage(token, chatId, "✅ Дневной пакет завершён.");
}

async function handleCustomChatScript(token: string, chatId: number, text: string): Promise<void> {
  try {
    await sendMessage(token, chatId, "✅ Авторский сценарий принят. Запускаю озвучку и оформление переписки без генерации новой истории…");
    const { projectId, jobId, storyDuration } = await createChatVideoJobFromScript(chatId, text);
    await updateChatPreferences(chatId, { platform: "Chat 9:16", pendingAction: null });
    await sendMessage(token, chatId, `🎬 Производство запущено.\nЗаставка Vibe: ${CHAT_INTRO_DURATION_SECONDS} сек.\nПереписка: ${storyDuration} сек.`);
    runTelegramBackgroundTask(
      monitorVideoJob(token, chatId, projectId, jobId),
      { chatId, projectId, jobId },
    );
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to start custom chat video pipeline");
    await sendMessage(token, chatId, `❌ Не удалось запустить авторский чат: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  }
}

async function getActiveChatVideoBatch(
  chatId: number,
  statuses: ChatBatchStatus[] = ["collecting", "queued", "processing", "paused"],
) {
  const [batch] = await db.select().from(chatVideoBatchesTable).where(and(
    eq(chatVideoBatchesTable.chatId, chatId),
    inArray(chatVideoBatchesTable.status, statuses),
  )).orderBy(desc(chatVideoBatchesTable.updatedAt)).limit(1);
  return batch || null;
}

async function sendChatBatchPreview(token: string, chatId: number, batchId: number): Promise<void> {
  const batch = await db.select().from(chatVideoBatchesTable).where(eq(chatVideoBatchesTable.id, batchId)).limit(1);
  const items = await db.select().from(chatVideoBatchItemsTable)
    .where(eq(chatVideoBatchItemsTable.batchId, batchId))
    .orderBy(chatVideoBatchItemsTable.sequence);
  if (!batch[0]) throw new Error("Пакет роликов не найден.");
  await sendMessage(token, chatId, [
    `📦 Пакет из ${batch[0].totalCount} роликов принят.`,
    "",
    ...items.map((item) => `${item.sequence}. ${item.scriptText.split(/\r?\n/)[0]!.slice(0, 90)}`),
    "",
    "После подтверждения ролики будут создаваться по одному. Готовые видео будут приходить в этот чат автоматически.",
  ].join("\n"), {
    inline_keyboard: [
      [{ text: "✅ Запустить пакет", callback_data: `chat_batch:approve:${batchId}` }],
      [{ text: "❌ Отменить пакет", callback_data: `chat_batch:cancel:${batchId}` }],
    ],
  });
}

async function runChatVideoBatch(token: string, chatId: number, batchId: number): Promise<void> {
  while (true) {
    const batch = await getActiveChatVideoBatch(chatId);
    if (!batch || batch.id !== batchId || batch.status === "paused" || batch.status === "cancelled") return;
    const [inProgressItem] = await db.select().from(chatVideoBatchItemsTable).where(and(
      eq(chatVideoBatchItemsTable.batchId, batchId),
      eq(chatVideoBatchItemsTable.status, "processing"),
    )).orderBy(chatVideoBatchItemsTable.sequence).limit(1);
    const [item] = inProgressItem
      ? [inProgressItem]
      : await db.select().from(chatVideoBatchItemsTable).where(and(
      eq(chatVideoBatchItemsTable.batchId, batchId),
      eq(chatVideoBatchItemsTable.status, "pending"),
    )).orderBy(chatVideoBatchItemsTable.sequence).limit(1);
    if (!item) {
      await db.update(chatVideoBatchesTable).set({ status: "completed", currentIndex: batch.totalCount, updatedAt: new Date() })
        .where(eq(chatVideoBatchesTable.id, batchId));
      const results = await db.select({ status: chatVideoBatchItemsTable.status })
        .from(chatVideoBatchItemsTable).where(eq(chatVideoBatchItemsTable.batchId, batchId));
      const failed = results.filter((result) => result.status === "failed").length;
      await sendMessage(token, chatId, [
        `✅ Пакет завершён: ${batch.totalCount - failed}/${batch.totalCount} готово.`,
        failed ? `❌ Ошибок: ${failed}. Их можно будет повторить отдельно.` : "Все ролики отправлены в этот чат.",
      ].join("\n"));
      return;
    }

    try {
      let projectId = item.projectId;
      let jobId = item.jobId;
      if (item.status === "pending") {
        await db.update(chatVideoBatchesTable).set({ status: "processing", currentIndex: item.sequence, updatedAt: new Date() })
          .where(eq(chatVideoBatchesTable.id, batchId));
        await db.update(chatVideoBatchItemsTable).set({ status: "processing", updatedAt: new Date() })
          .where(eq(chatVideoBatchItemsTable.id, item.id));
        await sendMessage(token, chatId, `📦 Пакет: ${item.sequence}/${batch.totalCount}\n🎬 Запускаю следующий ролик. Готовое видео отправлю сюда автоматически.`, {
          inline_keyboard: [[{ text: "⏸ Поставить пакет на паузу", callback_data: `chat_batch:pause:${batchId}` }]],
        });
        const created = await createChatVideoJobFromScript(chatId, item.scriptText);
        projectId = created.projectId;
        jobId = created.jobId;
        await db.update(chatVideoBatchItemsTable).set({ projectId, jobId, updatedAt: new Date() })
          .where(eq(chatVideoBatchItemsTable.id, item.id));
      }
      if (!projectId || !jobId) throw new Error("Не удалось восстановить job пакетного ролика.");
      await monitorVideoJob(token, chatId, projectId, jobId);
      const [job] = await db.select({ status: videoGenerationJobsTable.status, error: videoGenerationJobsTable.error })
        .from(videoGenerationJobsTable).where(eq(videoGenerationJobsTable.id, jobId));
      if (job?.status === "completed") {
        await db.update(chatVideoBatchItemsTable).set({ status: "completed", updatedAt: new Date() })
          .where(eq(chatVideoBatchItemsTable.id, item.id));
      } else {
        await db.update(chatVideoBatchItemsTable).set({
          status: "failed",
          error: job?.error || "Видео не было завершено.",
          updatedAt: new Date(),
        }).where(eq(chatVideoBatchItemsTable.id, item.id));
      }
    } catch (error) {
      await db.update(chatVideoBatchItemsTable).set({
        status: "failed",
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
        updatedAt: new Date(),
      }).where(eq(chatVideoBatchItemsTable.id, item.id));
      await sendMessage(token, chatId, `❌ Ролик ${item.sequence}/${batch.totalCount} не запустился. Перехожу к следующему.`);
    }
  }
}

async function handleLongVideoPrompt(token: string, chatId: number, prompt: string): Promise<void> {
  try {
    if (prompt.length > 3_500) {
      await sendMessage(token, chatId, "Промт слишком длинный. Сократи его до 3500 символов.");
      return;
    }
    const preferences = await getChatPreferences(chatId);
    await sendMessage(token, chatId, "⏳ Промт принят. Пишу сценарий большого видео на 20 минут…");
    const script = await generateVideoScript({
      topic: "Полноценное длинное видео",
      format: "YouTube Long Video 16:9",
      duration: 1_200,
      style: preferences.customStyle || "cinematic documentary, detailed, natural pacing",
      tone: preferences.tone || "educational",
      instructions: [
        "Это длинное видео длительностью ровно 20 минут.",
        "Разбей историю на последовательные сцены с общей длительностью ровно 1200 секунд.",
        "Сделай полноценную структуру: вступление, главы, переходы, развитие, кульминация и вывод.",
        "Не сжимай содержание до Shorts. Дай достаточно текста для естественной русской озвучки на 20 минут.",
        "Полный авторский промт пользователя:",
        prompt,
      ].join("\n\n"),
    });
    const [project] = await db.insert(projectsTable).values({
      title: script.title,
      topic: prompt.slice(0, 500),
      format: "YouTube Long Video",
      duration: 1_200,
      style: preferences.customStyle || "cinematic documentary",
      tone: preferences.tone || "educational",
      scriptJson: script,
      status: "draft",
    }).returning({ id: projectsTable.id });
    lastProjectByChat.set(chatId, project.id);
    await updateChatPreferences(chatId, { pendingAction: null });
    await sendMessage(token, chatId, [
      "🎞 Черновик длинного видео готов.",
      "⏱ Длительность: 20 минут",
      "🖥 Формат: 16:9",
      "",
      formatScriptForTelegram(script),
    ].join("\n"), {
      inline_keyboard: [
        [{ text: "🖼 Добавить изображение к сцене", callback_data: "image:add" }],
        [{ text: "✅ Утвердить и запустить производство", callback_data: "draft:approve" }],
        [{ text: "✏️ Внести правки", callback_data: "draft:edit" }, { text: "🔄 Новый вариант", callback_data: "draft:regenerate" }],
      ],
    });
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to create long video script");
    await sendMessage(token, chatId, `❌ Не удалось написать длинный сценарий: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  }
}

async function handleSeriesPrompt(token: string, chatId: number, prompt: string): Promise<void> {
  try {
    if (prompt.length > 3_500) {
      await sendMessage(token, chatId, "Промт слишком длинный. Сократи его до 3500 символов.");
      return;
    }
    const directives = extractSeriesDirectives(prompt);
    const city = directives.city || "Новосибирск";
    const profession = directives.profession || "курьер";
    const selectedSeriesStyle = pendingSeriesStyleByChat.get(chatId) || "realistic";
    const ctaText = directives.ctaText || DEFAULT_RECRUITMENT_CTA;
    const ctaUrl = prompt.match(/https?:\/\/t\.me\/[A-Za-z0-9_+/?=-]+/iu)?.[0] || null;
    const ctaPlacement = (directives.ctaPlacement || "ending") as CtaPlacement;
    const fullCta = ctaWithUrl(ctaText, ctaUrl);
    await sendMessage(token, chatId, "⏳ Создаю библию сериала, героев и план первого сезона…");
    const concept = await generateSeriesConcept({
      prompt,
      city,
      profession,
      episodeDuration: directives.episodeDuration,
      episodeCount: directives.episodeCount,
      locations: directives.locations,
      ctaText: fullCta,
      visualStyle: selectedSeriesStyle,
    });
    const [series] = await db.insert(seriesTable).values({
      chatId,
      title: concept.title,
      premise: concept.premise,
      city,
      profession,
      style: concept.visual_style,
      episodeDuration: directives.episodeDuration || 120,
      episodeCount: concept.episodes.length,
      locationsJson: concept.locations,
      ctaText,
      ctaUrl,
      ctaPlacement,
      bibleJson: concept,
      status: "draft",
    }).returning({ id: seriesTable.id });
    const [season] = await db.insert(seasonsTable).values({
      seriesId: series.id,
      seasonNumber: 1,
      title: `Сезон 1 — ${concept.title}`,
      planJson: concept.episodes,
      status: "draft",
    }).returning({ id: seasonsTable.id });
    await db.insert(seriesEpisodesTable).values(concept.episodes.map((episode) => ({
      seasonId: season.id,
      episodeNumber: episode.episode_number,
      title: episode.title,
      synopsis: episode.synopsis,
      hook: episode.hook,
      cliffhanger: episode.cliffhanger,
      localLocation: episode.local_location,
      status: "planned",
    })));
    await saveSeriesSnapshot({
      seriesId: series.id,
      bible: concept,
      continuity: {
        city,
        profession,
        locations: concept.locations,
        characters: concept.characters,
        worldRules: concept.world_rules,
      },
    });
    await saveSeriesMemory({
      seriesId: series.id,
      eventType: "series_created",
      payload: { prompt, title: concept.title, seasonNumber: 1, episodeCount: concept.episodes.length },
    });
    await updateChatPreferences(chatId, { activeSeriesId: series.id, pendingAction: null });
    pendingSeriesByChat.set(chatId, { concept, seriesId: series.id, seasonId: season.id, ctaText: fullCta });
    pendingSeriesStyleByChat.delete(chatId);
    await sendMessage(token, chatId, formatSeriesConcept(concept, fullCta), {
      inline_keyboard: [
        [{ text: "✅ Утвердить библию и план сезона", callback_data: "series:approve" }],
        [{ text: "✏️ Изменить концепцию", callback_data: "series:edit" }, { text: "🔄 Новый вариант", callback_data: "series:regenerate" }],
      ],
    });
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to create series concept");
    await sendMessage(token, chatId, `❌ Не удалось создать сериал: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  }
}

async function saveSeriesTitleOnly(chatId: number, title: string, requestedEpisodeCount = 1): Promise<void> {
  const normalizedTitle = title.trim();
  if (normalizedTitle.length < 1 || normalizedTitle.length > 200) {
    throw new Error("Название сериала должно содержать от 1 до 200 символов.");
  }
  const episodeCount = Math.min(Math.max(Math.floor(requestedEpisodeCount), 1), 24);

  const style = pendingSeriesStyleByChat.get(chatId) || "realistic cinematic";
  const city = "Новосибирск";
  const profession = "курьер";
  const ctaText = DEFAULT_RECRUITMENT_CTA;
  const concept = {
    author_prompt: normalizedTitle,
    title: normalizedTitle,
    premise: normalizedTitle,
    logline: normalizedTitle,
    genre: "жизненная история",
    audience: "широкая аудитория",
    main_conflict: "бытовые ситуации и выбор героя",
    season_arc: "самостоятельные истории героя",
    world_rules: ["Реальный современный город", "Жизненные бытовые ситуации", "Последовательное развитие событий"],
    characters: [{
      name: "Главный герой",
      role: profession,
      age: "взрослый",
      appearance: "обычная внешность",
      clothing: "одежда по ситуации",
      personality: "живой и наблюдательный",
      motivation: "заработать и справиться с задачами",
      secret: "",
    }],
    locations: [city],
    visual_style: style,
    episodes: Array.from({ length: episodeCount }, (_, index) => ({
      episode_number: index + 1,
      title: `Серия ${index + 1}`,
      synopsis: "Авторская история пользователя.",
      hook: "История начинается с обычной жизненной ситуации.",
      local_location: city,
      cliffhanger: "История получает естественное продолжение.",
      dramatic_goal: "",
      episode_conflict: "",
      turning_point: "",
      entry_state: "",
      exit_state: "",
      next_episode_bridge: "",
    })),
  } as SeriesConcept;

  const [series] = await db.insert(seriesTable).values({
    chatId,
    title: normalizedTitle,
    premise: normalizedTitle,
    city,
    profession,
    style,
    episodeDuration: 120,
    episodeCount,
    locationsJson: [city],
    ctaText,
    ctaUrl: null,
    ctaPlacement: "ending",
    bibleJson: concept,
    status: "approved",
  }).returning({ id: seriesTable.id });
  const [season] = await db.insert(seasonsTable).values({
    seriesId: series.id,
    seasonNumber: 1,
    title: `Сезон 1 — ${normalizedTitle}`,
    planJson: concept.episodes,
    status: "approved",
  }).returning({ id: seasonsTable.id });
  await db.insert(seriesEpisodesTable).values(concept.episodes.map((episode) => ({
    seasonId: season.id,
    episodeNumber: episode.episode_number,
    title: episode.title,
    synopsis: episode.synopsis,
    hook: episode.hook,
    cliffhanger: episode.cliffhanger,
    localLocation: episode.local_location,
    status: "planned" as const,
  })));
  await saveSeriesSnapshot({
    seriesId: series.id,
    bible: concept,
    continuity: {
      city,
      profession,
      locations: [city],
      characters: concept.characters,
      worldRules: concept.world_rules,
    },
  });
  await saveSeriesMemory({
    seriesId: series.id,
    eventType: "series_created",
    payload: { title: normalizedTitle, seasonNumber: 1, episodeCount, source: "title_only" },
  });
  await updateChatPreferences(chatId, { activeSeriesId: series.id, pendingAction: null });
  pendingSeriesStyleByChat.delete(chatId);
  pendingSeriesTitleByChat.delete(chatId);
}

async function generateNextSeriesEpisode(token: string, chatId: number): Promise<void> {
  const preferences = await getChatPreferences(chatId);
  if (!preferences.activeSeriesId) throw new Error("Сначала создайте сериал.");
  const [series] = await db.select().from(seriesTable).where(eq(seriesTable.id, preferences.activeSeriesId));
  if (!series || series.status !== "approved") throw new Error("Сначала утвердите библию и план сезона.");
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.seriesId, series.id)).orderBy(desc(seasonsTable.seasonNumber));
  if (!season || season.status !== "approved") throw new Error("Сначала утвердите план сезона.");
  const [episode] = await db.select().from(seriesEpisodesTable)
    .where(and(eq(seriesEpisodesTable.seasonId, season.id), eq(seriesEpisodesTable.status, "planned")))
    .orderBy(seriesEpisodesTable.episodeNumber);
  if (!episode) {
    await sendMainMenu(token, chatId, "✅ Все серии первого сезона уже подготовлены или выпущены.");
    return;
  }
  const completedEpisodes = await db.select({
    episodeNumber: seriesEpisodesTable.episodeNumber,
    title: seriesEpisodesTable.title,
    synopsis: seriesEpisodesTable.synopsis,
    cliffhanger: seriesEpisodesTable.cliffhanger,
  }).from(seriesEpisodesTable)
    .where(and(
      eq(seriesEpisodesTable.seasonId, season.id),
      inArray(seriesEpisodesTable.status, ["completed", "approved"]),
    ));
  const concept = series.bibleJson as SeriesConcept;
  const episodeDuration = Math.min(Math.max(series.episodeDuration, 30), MAX_SCRIPT_DURATION_SECONDS);
  await sendMessage(token, chatId, `⏳ Пишу сценарий серии ${episode.episodeNumber}: «${episode.title}»…`);
  const script = await generateVideoScript({
    topic: `${series.title}, серия ${episode.episodeNumber}: ${episode.title}`,
    format: "Series 9:16",
    duration: episodeDuration,
    style: series.style,
    tone: "жизненный, тёплый, реалистичный",
    instructions: [
      `Библия сериала:\n${JSON.stringify(concept)}`,
      `Авторская завязка, которой нужно следовать буквально по смыслу:\n${concept.author_prompt || series.premise}`,
      `Предыдущие утверждённые серии:\n${JSON.stringify(completedEpisodes)}`,
      `Синопсис текущей серии: ${episode.synopsis}`,
      `Цель героя в серии: ${(concept.episodes.find((item) => item.episode_number === episode.episodeNumber)?.dramatic_goal || "")}`,
      `Конфликт серии: ${(concept.episodes.find((item) => item.episode_number === episode.episodeNumber)?.episode_conflict || "")}`,
      `Поворот серии: ${(concept.episodes.find((item) => item.episode_number === episode.episodeNumber)?.turning_point || "")}`,
      `Состояние героя на входе: ${(concept.episodes.find((item) => item.episode_number === episode.episodeNumber)?.entry_state || "")}`,
      `Ожидаемое состояние героя на выходе: ${(concept.episodes.find((item) => item.episode_number === episode.episodeNumber)?.exit_state || "")}`,
      `Мост в следующую серию: ${(concept.episodes.find((item) => item.episode_number === episode.episodeNumber)?.next_episode_bridge || "")}`,
      `Обязательный hook: ${episode.hook}`,
      `Обязательный cliffhanger в финале: ${episode.cliffhanger}`,
      `Локальная локация: ${episode.localLocation || series.city}`,
      "Сохраняй identity anchor главного героя, его одежду, возраст, характер и все факты из библии.",
      "Пиши как жизненную историю, а не как триллер или трейлер. Не добавляй тайные алгоритмы, заговоры, невозможные адреса и внезапные загадочные организации, если их нет в авторской завязке.",
      "Показывай конкретные действия и последовательность: куда герой приехал, что забрал, кому отдал, сколько ждал, что почувствовал и какое решение принял.",
      "Не меняй имя героя, район, профессию, локации и порядок ключевых событий из авторской завязки. Если факт не указан, добавь только нейтральную бытовую деталь, а не новую тайну или фантастическое объяснение.",
      "Пиши сценарий как живой рассказ от первого лица героя, простым разговорным русским языком. Начни с естественного знакомства героя и его обычной жизни, например: «Привет, я Максим. Живу на Красном проспекте, учусь в РАНХиГС и подрабатываю курьером…». Не превращай текст в трейлер, набор загадочных фраз или описание кадров.",
       `Сценарий серии должен быть рассчитан максимум на 3 минуты (${Math.min(series.episodeDuration, MAX_SCRIPT_DURATION_SECONDS)} секунд).`,
      "Каждый заказ — отдельная понятная история с конкретным адресом или местом Новосибирска, клиентом, задачей, бытовым препятствием и последствием. Используй реальные районы и места из библии сериала, не придумывай несуществующие улицы и события.",
      "Не вставляй CTA в voice_text самостоятельно — CTA будет добавлен отдельно после генерации в нужную позицию.",
    ].join("\n\n"),
  });
  applyCtaPlacement(
    script,
    ctaWithUrl(series.ctaText || "", series.ctaUrl),
    (series.ctaPlacement || "ending") as CtaPlacement,
  );
  const [project] = await db.insert(projectsTable).values({
    title: `${series.title} — серия ${episode.episodeNumber}: ${episode.title}`,
    topic: `${series.premise}. Город: ${series.city}. Локация: ${episode.localLocation || series.city}`,
    format: "Series 9:16",
    duration: episodeDuration,
    style: series.style,
    tone: "жизненный, тёплый, реалистичный",
    scriptJson: script,
    status: "draft",
  }).returning({ id: projectsTable.id });
  await db.update(seriesEpisodesTable).set({ scriptJson: script, projectId: project.id, status: "draft" }).where(eq(seriesEpisodesTable.id, episode.id));
  await saveSeriesMemory({
    seriesId: series.id,
    episodeId: episode.id,
    eventType: "episode_script_drafted",
    payload: { projectId: project.id, episodeNumber: episode.episodeNumber, script },
  });
  lastProjectByChat.set(chatId, project.id);
  activeSeriesEpisodeByChat.set(chatId, episode.id);
  await sendMessage(token, chatId, [
    `📺 ${series.title}`,
    `Серия ${episode.episodeNumber}: ${episode.title}`,
    "",
    formatSeriesEpisodeForTelegram(script),
  ].join("\n"), {
    inline_keyboard: [
      [{ text: "🖼 Добавить изображение к сцене", callback_data: "image:add" }],
      [{ text: "✅ Утвердить серию и запустить производство", callback_data: "series:episode:approve" }],
      [{ text: "✏️ Внести правки", callback_data: "series:episode:edit" }, { text: "🔄 Новый вариант", callback_data: "series:episode:regenerate" }],
    ],
  });
}

async function generateCustomSeriesEpisode(token: string, chatId: number, authorText: string): Promise<void> {
  const preferences = await getChatPreferences(chatId);
  if (!preferences.activeSeriesId) throw new Error("Сначала создайте сериал.");
  const [series] = await db.select().from(seriesTable).where(eq(seriesTable.id, preferences.activeSeriesId));
  if (!series || series.status !== "approved") throw new Error("Сначала утвердите библию и план сезона.");
  const [season] = await db.select().from(seasonsTable)
    .where(eq(seasonsTable.seriesId, series.id))
    .orderBy(desc(seasonsTable.seasonNumber));
  if (!season || season.status !== "approved") throw new Error("Сначала утвердите план сезона.");
  const [episode] = await db.select().from(seriesEpisodesTable)
    .where(and(eq(seriesEpisodesTable.seasonId, season.id), eq(seriesEpisodesTable.status, "planned")))
    .orderBy(seriesEpisodesTable.episodeNumber);
  if (!episode) throw new Error("Все серии сезона уже подготовлены или выпущены.");
  const activeDraftEpisode = await db.select({ id: seriesEpisodesTable.id })
    .from(seriesEpisodesTable)
    .where(and(
      eq(seriesEpisodesTable.seasonId, season.id),
      eq(seriesEpisodesTable.status, "draft"),
    ))
    .limit(1);
  if (activeDraftEpisode.length) throw new Error("Сначала утвердите текущий черновик серии, которая уже находится в работе.");
  const concept = series.bibleJson as SeriesConcept;
  const episodeDuration = Math.min(Math.max(series.episodeDuration, 30), MAX_SCRIPT_DURATION_SECONDS);
  const estimatedDuration = estimateSpokenDurationSeconds(authorText);
  const preparedAuthorText = estimatedDuration > MAX_SCRIPT_DURATION_SECONDS
    ? await shortenAuthorScriptToLimit(authorText, MAX_SCRIPT_DURATION_SECONDS)
    : authorText;
  const wasShortened = preparedAuthorText.trim() !== authorText.trim();
  if (wasShortened) {
    await sendMessage(token, chatId, `✂️ Ваш сценарий рассчитан примерно на ${estimatedDuration} секунд. Сокращаю его до 3 минут, сохраняя основную историю, ключевые реплики и финал…`);
  }
  await sendMessage(token, chatId, `⏳ Превращаю ваш текст в сценарий серии ${episode.episodeNumber}: «${episode.title}»…`);
  const script = await generateVideoScript({
    topic: `${series.title}, серия ${episode.episodeNumber}: ${episode.title}`,
    format: "Series 9:16",
    duration: episodeDuration,
    style: series.style,
    tone: "живой, разговорный, реалистичный",
    instructions: [
      `Библия сериала:\n${JSON.stringify(concept)}`,
      `Город и локальный контекст: ${series.city}. Используй только реальные места этого города.`,
      `План серии: ${episode.synopsis}`,
      `Обязательный hook: ${episode.hook}`,
      `Обязательный cliffhanger: ${episode.cliffhanger}`,
      "Ниже авторский текст пользователя. Это канон серии: сохрани его сюжет, героя, факты, порядок событий и разговорный стиль. Не придумывай другую историю и не заменяй текст рекламным трейлером.",
       wasShortened
         ? "Исходный текст уже сокращён редактором до 3 минут. Используй именно этот сокращённый вариант, не добавляй новые события и не расширяй его."
         : "Авторский текст нельзя переписывать, сокращать, пересказывать или заменять своими словами. Все факты, события, реплики, имена, места и порядок событий должны остаться такими же.",
       "Раздели авторский текст максимум на 7 крупных последовательных сцен-эпизодов, объединяя связанные действия и весь диалог одной сцены вместе. Не делай отдельную сцену для каждой фразы или реплики. В voice_text используй исходные фразы и реплики дословно. Разрешены только технические изменения, необходимые для озвучки: пробелы, переносы строк, пунктуация и удаление служебных заголовков вроде «СЦЕНА 1», «ДИМА:» или «КОНЕЦ СЕРИИ», если они не должны произноситься вслух.",
      "Не добавляй в voice_text новых событий, шуток, описаний, диалогов или рекламных фраз. CTA будет добавлен отдельно системой после авторской истории.",
      "Для каждой сцены отдельно создай визуальное описание и image_prompt, чтобы по этому тексту можно было сделать картинку. Эти технические поля не должны попадать в voice_text.",
       `Авторский текст серии:\n${preparedAuthorText}`,
    ].join("\n\n"),
  });
  const authorSceneTexts = splitAuthorScriptIntoScenes(preparedAuthorText, 7);
  const protectedScript: VideoScript = {
    ...script,
    scenes: authorSceneTexts.map((voiceText, index) => {
      const referenceScene = script.scenes[index % script.scenes.length]!;
      return {
        ...referenceScene,
        scene_number: index + 1,
        duration_seconds: 1,
        voice_text: voiceText,
      };
    }),
  };
  const durationPerScene = Math.floor(episodeDuration / protectedScript.scenes.length);
  const durationRemainder = episodeDuration % protectedScript.scenes.length;
  protectedScript.scenes.forEach((scene, index) => {
    scene.duration_seconds = durationPerScene + (index < durationRemainder ? 1 : 0);
  });
  applyCtaPlacement(
    protectedScript,
    ctaWithUrl(series.ctaText || "", series.ctaUrl),
    (series.ctaPlacement || "ending") as CtaPlacement,
  );
  const [project] = await db.insert(projectsTable).values({
    title: `${series.title} — серия ${episode.episodeNumber}: ${episode.title}`,
    topic: `${series.premise}. Город: ${series.city}. Авторский сценарий серии.`,
    format: "Series 9:16",
    duration: episodeDuration,
    style: series.style,
    tone: "живой, разговорный, реалистичный",
    scriptJson: protectedScript,
    status: "draft",
  }).returning({ id: projectsTable.id });
  await db.update(seriesEpisodesTable).set({
    scriptJson: protectedScript,
    projectId: project.id,
    status: "draft",
  }).where(eq(seriesEpisodesTable.id, episode.id));
  lastProjectByChat.set(chatId, project.id);
  activeSeriesEpisodeByChat.set(chatId, episode.id);
  await updateChatPreferences(chatId, { pendingAction: null });
  await sendMessage(token, chatId, [
    `📺 ${series.title}`,
    `Серия ${episode.episodeNumber}: ${episode.title}`,
    "",
    formatSeriesEpisodeForTelegram(protectedScript),
  ].join("\n"), {
    inline_keyboard: [
      [{ text: "🖼 Добавить изображение к сцене", callback_data: "image:add" }],
      [{ text: "✅ Утвердить серию и запустить производство", callback_data: "series:episode:approve" }],
      [{ text: "✏️ Внести правки", callback_data: "series:episode:edit" }, { text: "🔄 Новый вариант", callback_data: "series:episode:regenerate" }],
    ],
  });
}

function splitAuthorScriptIntoScenes(authorText: string, maxScenes: number): string[] {
  const paragraphs = authorText
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (!paragraphs.length) return [authorText.trim()];
  if (paragraphs.length <= maxScenes) return paragraphs;

  const scenes: string[] = [];
  const paragraphsPerScene = Math.ceil(paragraphs.length / maxScenes);
  for (let index = 0; index < maxScenes && index * paragraphsPerScene < paragraphs.length; index += 1) {
    const start = index * paragraphsPerScene;
    const end = index === maxScenes - 1
      ? paragraphs.length
      : Math.min(paragraphs.length, start + paragraphsPerScene);
    scenes.push(paragraphs.slice(start, end).join("\n\n"));
  }
  return scenes;
}

async function beginVideoEdit(token: string, chatId: number): Promise<void> {
  const session = pendingVideoEditByChat.get(chatId);
  if (!session) {
    await sendMessage(token, chatId, "Исходное видео для edit уже не найдено. Отправьте его заново.");
    return;
  }
  pendingYoutubeByChat.delete(chatId);
  session.options = undefined;
  await updateChatPreferences(chatId, { pendingAction: "edit_music_source" });
  await sendMessage(token, chatId, [
    "🎬 Настраиваем edit",
    "",
    "Какую музыку использовать?",
    "• генерация — уникальная инструментальная подложка;",
    "• бесплатная библиотека — ищу трек с лицензией;",
    "• без музыки — оставляю звук исходного видео.",
  ].join("\n"), {
    inline_keyboard: [
      [{ text: "🎛 Сгенерировать музыку", callback_data: "edit:music:generated" }],
      [{ text: "🎵 Бесплатная библиотека", callback_data: "edit:music:library" }],
      [{ text: "🔇 Без музыки", callback_data: "edit:music:none" }],
    ],
  });
}

async function askVideoEditMood(token: string, chatId: number, musicSource: VideoEditOptions["musicSource"]): Promise<void> {
  const session = pendingVideoEditByChat.get(chatId);
  if (!session) {
    await sendMessage(token, chatId, "Сессия edit закончилась. Отправьте видео заново.");
    return;
  }
  session.options = { musicSource, musicMood: "energetic", editStyle: "hype" };
  if (musicSource === "none") {
    await askVideoEditStyle(token, chatId);
    return;
  }
  await updateChatPreferences(chatId, { pendingAction: "edit_music_mood" });
  await sendMessage(token, chatId, "Выберите настроение музыки:", {
    inline_keyboard: [
      [{ text: "⚡ Энергично / phonk", callback_data: "edit:mood:energetic" }],
      [{ text: "🌑 Dark / dramatic", callback_data: "edit:mood:dark" }],
      [{ text: "🎞 Cinematic", callback_data: "edit:mood:cinematic" }],
      [{ text: "😄 Meme / funny", callback_data: "edit:mood:funny" }],
    ],
  });
}

async function askVideoEditStyle(token: string, chatId: number): Promise<void> {
  const session = pendingVideoEditByChat.get(chatId);
  if (!session?.options) {
    await sendMessage(token, chatId, "Сессия edit закончилась. Отправьте видео заново.");
    return;
  }
  await updateChatPreferences(chatId, { pendingAction: "edit_style" });
  await sendMessage(token, chatId, "Какой стиль монтажа сделать?", {
    inline_keyboard: [
      [{ text: "🔥 Hype / быстрый", callback_data: "edit:style:hype" }],
      [{ text: "🎬 Cinematic / атмосферный", callback_data: "edit:style:cinematic" }],
      [{ text: "😂 Meme / резкий", callback_data: "edit:style:meme" }],
    ],
  });
}

async function askVideoEditFocus(token: string, chatId: number): Promise<void> {
  await updateChatPreferences(chatId, { pendingAction: "edit_focus" });
  await sendMessage(token, chatId, [
    "Кого или что выделить в edit?",
    "",
    "Например: «главный герой», «момент с машиной», «реакция ведущего».",
    "Это появится короткой подписью в начале ролика. Если подпись не нужна, нажмите кнопку ниже.",
  ].join("\n"), {
    inline_keyboard: [[{ text: "Без подписи", callback_data: "edit:focus:none" }]],
  });
}

async function runVideoEdit(token: string, chatId: number): Promise<void> {
  const session = pendingVideoEditByChat.get(chatId);
  if (!session?.options) {
    await sendMessage(token, chatId, "Сессия edit закончилась. Отправьте видео заново.");
    return;
  }
  try {
    await sendMessage(token, chatId, [
      "⏳ Собираю edit…",
      `Музыка: ${session.options.musicSource === "library" ? "бесплатная библиотека" : session.options.musicSource === "none" ? "без музыки" : "генерация"}.`,
      `Стиль: ${session.options.editStyle}.`,
      "Нарезаю монтажные фрагменты, синхронизирую темп и рендерю MP4.",
    ].join("\n"));
    const editStoragePath = await createVideoEditAsset(session.sourceStoragePath, session.options);
    const editBuffer = await readAudioAsset(editStoragePath);
    await sendVideo(
      token,
      chatId,
      editBuffer,
      "🎬 Edit готов.\n\nПроверьте ролик. После этого можно ввести данные для публикации.",
      { inline_keyboard: [[{ text: "🔁 Повторить с теми же настройками", callback_data: "edit:repeat" }]] },
    );
    await updateChatPreferences(chatId, { pendingAction: null });
    await prepareYoutubePublicationForStorage(
      token,
      chatId,
      editStoragePath,
      `${session.title} — edit`,
      session.scriptText,
      session.topic,
    );
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to create video edit");
    await sendMessage(token, chatId, `❌ Не удалось собрать edit: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
    await updateChatPreferences(chatId, { pendingAction: null });
  }
}

async function beginVideoCutEdit(token: string, chatId: number, batchId: string): Promise<void> {
  const metadataSession = pendingCutMetadataByChat.get(chatId);
  const batch = pendingVideoCutBatchByChat.get(chatId);
  if (!metadataSession || !batch || batch.id !== batchId) {
    await sendMessage(token, chatId, "Сессия выбранных нарезок закончилась. Запусти нарезку заново через меню.");
    return;
  }
  pendingVideoCutEditByChat.set(chatId, {
    batchId,
    sequences: [...metadataSession.sequences],
  });
  await updateChatPreferences(chatId, { pendingAction: "cut_edit_music_source" });
  await sendMessage(token, chatId, "🎬 Настраиваем edit для выбранных нарезок.\n\nВыберите музыку:", {
    inline_keyboard: [
      [{ text: "🎛 Сгенерировать музыку", callback_data: `cut:edit:music:generated:${batchId}` }],
      [{ text: "🎵 Бесплатная библиотека", callback_data: `cut:edit:music:library:${batchId}` }],
      [{ text: "🔇 Без музыки", callback_data: `cut:edit:music:none:${batchId}` }],
    ],
  });
}

async function askVideoCutEditMood(
  token: string,
  chatId: number,
  batchId: string,
  musicSource: VideoEditOptions["musicSource"],
): Promise<void> {
  const session = pendingVideoCutEditByChat.get(chatId);
  if (!session || session.batchId !== batchId) throw new Error("Сессия edit нарезок закончилась.");
  session.options = { musicSource, musicMood: "energetic", editStyle: "hype" };
  if (musicSource === "none") {
    await askVideoCutEditStyle(token, chatId, batchId);
    return;
  }
  await updateChatPreferences(chatId, { pendingAction: "cut_edit_music_mood" });
  await sendMessage(token, chatId, "Выберите настроение музыки:", {
    inline_keyboard: [
      [{ text: "⚡ Энергично / phonk", callback_data: `cut:edit:mood:energetic:${batchId}` }],
      [{ text: "🌑 Dark / dramatic", callback_data: `cut:edit:mood:dark:${batchId}` }],
      [{ text: "🎞 Cinematic", callback_data: `cut:edit:mood:cinematic:${batchId}` }],
      [{ text: "😄 Meme / funny", callback_data: `cut:edit:mood:funny:${batchId}` }],
    ],
  });
}

async function askVideoCutEditStyle(token: string, chatId: number, batchId: string): Promise<void> {
  const session = pendingVideoCutEditByChat.get(chatId);
  if (!session?.options || session.batchId !== batchId) throw new Error("Сессия edit нарезок закончилась.");
  await updateChatPreferences(chatId, { pendingAction: "cut_edit_style" });
  await sendMessage(token, chatId, "Какой стиль монтажа сделать?", {
    inline_keyboard: [
      [{ text: "🔥 Hype / быстрый", callback_data: `cut:edit:style:hype:${batchId}` }],
      [{ text: "🎬 Cinematic / атмосферный", callback_data: `cut:edit:style:cinematic:${batchId}` }],
      [{ text: "😂 Meme / резкий", callback_data: `cut:edit:style:meme:${batchId}` }],
    ],
  });
}

async function askVideoCutEditFocus(token: string, chatId: number, batchId: string): Promise<void> {
  await updateChatPreferences(chatId, { pendingAction: "cut_edit_focus" });
  await sendMessage(token, chatId, "Кого или что выделить подписью в начале edit?", {
    inline_keyboard: [[{ text: "Без подписи", callback_data: `cut:edit:focus:none:${batchId}` }]],
  });
}

async function runVideoCutEdit(token: string, chatId: number, batchId: string): Promise<void> {
  const session = pendingVideoCutEditByChat.get(chatId);
  const batch = pendingVideoCutBatchByChat.get(chatId);
  if (!session?.options || !batch || session.batchId !== batchId || batch.id !== batchId) {
    await sendMessage(token, chatId, "Сессия edit нарезок закончилась. Запусти нарезку заново через меню.");
    return;
  }
  try {
    await sendMessage(token, chatId, `⏳ Собираю edit для ${session.sequences.length} выбранных нарезок…`);
    for (let index = 0; index < session.sequences.length; index += 1) {
      const sequence = session.sequences[index]!;
      const cut = batch.cuts.get(sequence);
      if (!cut) throw new Error(`Нарезка ${sequence} не найдена.`);
      const editStoragePath = await createVideoEditAsset(cut.storagePath, session.options);
      cut.storagePath = editStoragePath;
      await sendVideo(
        token,
        chatId,
        await readAudioAsset(editStoragePath),
        `🎬 Edit готов: нарезка ${sequence} (${index + 1}/${session.sequences.length}).`,
      );
    }
    pendingVideoCutEditByChat.delete(chatId);
    await updateChatPreferences(chatId, { pendingAction: null });
    await sendMessage(token, chatId, "✅ Edit готов. Продолжаю обычный ввод SEO-данных.");
    await sendCutMetadataPrompt(token, chatId);
  } catch (error) {
    logger.error({ err: error, chatId, batchId }, "Failed to create edit for selected video cuts");
    await sendMessage(token, chatId, `❌ Не удалось собрать edit нарезок: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
    await updateChatPreferences(chatId, { pendingAction: null });
  }
}

async function handleCallbackQuery(token: string, update: TelegramUpdate): Promise<void> {
  const callback = update.callback_query;
  const chatId = callback?.message?.chat.id;
  const data = callback?.data;
  if (!callback || chatId === undefined || !data) return;
  try {
    if (data === "menu:home") {
      await sendMainMenu(token, chatId);
    } else if (data === "menu:ad_constructor") {
      await showAdConstructorStart(token, chatId);
    } else if (data === "ad:analyze") {
      await analyzePendingAd(token, chatId);
    } else if (data === "ad:edit") {
      const session = pendingAdByChat.get(chatId);
      if (!session) throw new Error("Сессия рекламного конструктора закончилась.");
      await updateChatPreferences(chatId, { pendingAction: "ad_brief" });
      await sendMessage(token, chatId, "✏️ Отправьте обновлённое рекламное ТЗ одним сообщением.");
    } else if (data === "ad:confirm") {
      await confirmAdRoute(token, chatId);
    } else if (data === "ad:cancel") {
      pendingAdByChat.delete(chatId);
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMainMenu(token, chatId, "Рекламный конструктор отменён.");
    } else if (data === "menu:trash") {
      await showTrashMenu(token, chatId);
    } else if (data === "menu:create") {
       await updateChatPreferences(chatId, { pendingAction: "video_topic" });
      await sendMessage(token, chatId, "🎬 Отправьте тему будущего ролика одним сообщением.\n\nНапример: Курьер получил странный заказ в 2 часа ночи");
    } else if (data === "menu:adapt_video") {
      await updateChatPreferences(chatId, { pendingAction: "adapt_video_upload" });
      await sendMessage(token, chatId, [
        "✨ Уникализация видео Kliply",
        "",
        "Отправьте готовый MP4-файл рекламодателя следующим сообщением.",
        "Я сохраню исходный текст и речь, добавлю новую музыкальную подложку, цветокоррекцию, переработку кадра и брендированный слой Kliply.",
        "",
        "Для стабильной загрузки отправляйте видео до 20 МБ.",
        "Для отмены отправьте /cancel.",
      ].join("\n"));
    } else if (data === "edit:start") {
      await beginVideoEdit(token, chatId);
    } else if (data.startsWith("edit:music:")) {
      const source = data.slice("edit:music:".length);
      if (!["generated", "library", "none"].includes(source)) throw new Error("Неизвестный источник музыки.");
      await askVideoEditMood(token, chatId, source as VideoEditOptions["musicSource"]);
    } else if (data.startsWith("edit:mood:")) {
      const session = pendingVideoEditByChat.get(chatId);
      const mood = data.slice("edit:mood:".length);
      if (!session?.options || !["energetic", "dark", "cinematic", "funny"].includes(mood)) {
        throw new Error("Сессия выбора музыки закончилась.");
      }
      session.options.musicMood = mood;
      await askVideoEditStyle(token, chatId);
    } else if (data.startsWith("edit:style:")) {
      const session = pendingVideoEditByChat.get(chatId);
      const style = data.slice("edit:style:".length);
      if (!session?.options || !["hype", "cinematic", "meme"].includes(style)) {
        throw new Error("Сессия выбора стиля закончилась.");
      }
      session.options.editStyle = style;
      await askVideoEditFocus(token, chatId);
    } else if (data === "edit:focus:none") {
      const session = pendingVideoEditByChat.get(chatId);
      if (!session?.options) throw new Error("Сессия edit закончилась.");
      session.options.focusLabel = undefined;
      await updateChatPreferences(chatId, { pendingAction: null });
      runTelegramBackgroundTask(runVideoEdit(token, chatId), { chatId, task: "video-edit" });
    } else if (data === "edit:repeat") {
      if (!pendingVideoEditByChat.has(chatId)) throw new Error("Исходное видео для повтора не найдено.");
      runTelegramBackgroundTask(runVideoEdit(token, chatId), { chatId, task: "video-edit-repeat" });
    } else if (data === "menu:video_cuts") {
      const defaultBanner = await getDefaultVideoCutBanner();
      await showVideoCutSourcePrompt(token, chatId, defaultBanner);
    } else if (data === "cut:banner:add") {
      await updateChatPreferences(chatId, { pendingAction: "cut_banner_upload" });
      await sendMessage(token, chatId, [
        "🖼️ Вставить баннер",
        "",
        "Отправь фото баннера или видео MP4.",
        "Баннер будет наложен снизу по центру на каждый готовый фрагмент.",
        "",
        "После загрузки я верну тебя к выбору количества нарезок.",
        "Для отмены отправь /cancel.",
      ].join("\n"), {
        inline_keyboard: [[{ text: "➡️ Без баннера", callback_data: "cut:banner:skip" }]],
      });
    } else if (data === "cut:banner:skip") {
      await showVideoCutCountPrompt(token, chatId);
    } else if (data.startsWith("cut:count:")) {
      const requestedCount = Number.parseInt(data.slice("cut:count:".length), 10);
      if (![1, 3, 5, 10, 15].includes(requestedCount)) {
        throw new Error("Можно выбрать 1, 3, 5, 10 или 15 нарезок.");
      }
      pendingVideoCutCountByChat.set(chatId, requestedCount);
      await updateChatPreferences(chatId, { pendingAction: "cut_source_url" });
      await sendMessage(token, chatId, [
        `✂️ Выбрано нарезок: ${requestedCount}.`,
        "",
        "Теперь отправь публичную ссылку на исходное видео.",
        `Я подготовлю ${requestedCount} отдельных Shorts-роликов длиной 60–120 секунд и отправлю их по одному для выбора.`,
        "",
        "Для отмены отправь /cancel.",
      ].join("\n"));
    } else if (
      data === "cut:target:all"
      || data === "cut:target:none"
      || data === "cut:targets:done"
      || data === "cut:targets:cancel"
      || data.startsWith("cut:target:")
    ) {
      const request = pendingVideoCutSourceByChat.get(chatId);
      if (!request) throw new Error("Ссылка на исходное видео устарела. Начни нарезку заново.");
      const connections = await listYoutubeConnections();
      if (data === "cut:target:all") {
        request.connectionIds = connections.map((connection) => connection.id);
        await showVideoCutChannelChoice(token, chatId);
      } else if (data === "cut:target:none") {
        request.connectionIds = [];
        await showVideoCutChannelChoice(token, chatId);
      } else if (data === "cut:targets:cancel") {
        pendingVideoCutSourceByChat.delete(chatId);
        pendingVideoCutBannerByChat.delete(chatId);
        await updateChatPreferences(chatId, { pendingAction: null });
        await sendMainMenu(token, chatId, "Нарезка отменена.");
      } else if (data === "cut:targets:done") {
        if (!request.connectionIds.length) throw new Error("Выбери хотя бы один YouTube-канал.");
        const selectedIds = [...request.connectionIds];
        const sourceUrl = request.sourceUrl;
        const sourceStoragePath = request.sourceStoragePath;
        const banner = request.banner;
        pendingVideoCutSourceByChat.delete(chatId);
        pendingVideoCutBannerByChat.delete(chatId);
        await updateChatPreferences(chatId, { pendingAction: null });
        await sendMessage(token, chatId, [
          `✅ Выбрано каналов: ${selectedIds.length}.`,
          "Для каждого канала подготовлю свой неповторяющийся фрагмент.",
          "Оригинальный звук сохраню, озвучку добавлять не буду.",
        ].join("\n"));
        runTelegramBackgroundTask(
          runVideoCutBatch(token, chatId, sourceUrl, selectedIds.length, banner, selectedIds, sourceStoragePath),
          { chatId, task: "video-cuts", channelIds: selectedIds, sourceUrl },
        );
      } else {
        const connectionId = Number.parseInt(data.slice("cut:target:".length), 10);
        if (!connections.some((connection) => connection.id === connectionId)) {
          throw new Error("YouTube-канал не найден.");
        }
        request.connectionIds = request.connectionIds.includes(connectionId)
          ? request.connectionIds.filter((id) => id !== connectionId)
          : [...request.connectionIds, connectionId];
        await showVideoCutChannelChoice(token, chatId);
      }
    } else if (data === "menu:reaction") {
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMessage(token, chatId, "🎭 Добавить реакцию стримера к видео?", {
        inline_keyboard: [
          [{ text: "✅ Да, выбрать", callback_data: "reaction:yes" }],
          [{ text: "❌ Нет", callback_data: "reaction:no" }],
        ],
      });
    } else if (data === "reaction:yes") {
      await sendMessage(token, chatId, "Выберите, чью разрешённую реакцию хотите добавить:", {
        inline_keyboard: [
          [
            { text: "📸 Парень (фото)", callback_data: "reaction:select:photo-male" },
            { text: "📸 Два парня (фото)", callback_data: "reaction:select:photo-two-male" },
          ],
          [
            { text: "Бустер", callback_data: "reaction:select:buster" },
            { text: "Егор Крид", callback_data: "reaction:select:egor-krid" },
          ],
          [
            { text: "Братишкин", callback_data: "reaction:select:bratishkin" },
            { text: "Эвелон", callback_data: "reaction:select:evelone" },
          ],
          [
            { text: "Моргенштерн", callback_data: "reaction:select:morgenshtern" },
            { text: "Другой клип", callback_data: "reaction:select:other" },
          ],
        ],
      });
    } else if (data === "reaction:no") {
      await sendMainMenu(token, chatId, "Хорошо, реакцию не добавляем.");
    } else if (data.startsWith("reaction:select:")) {
      const streamerBySlug: Record<string, string> = {
        buster: "Бустер",
        "egor-krid": "Егор Крид",
        bratishkin: "Братишкин",
        evelone: "Эвелон",
        morgenshtern: "Моргенштерн",
        other: "Другой автор",
        "photo-male": REACTION_IMAGE_TEMPLATES["photo-male"].name,
        "photo-two-male": REACTION_IMAGE_TEMPLATES["photo-two-male"].name,
      };
      const slug = data.slice("reaction:select:".length);
      const streamerName = streamerBySlug[slug];
      if (!streamerName) throw new Error("Неизвестный автор реакции");
      const imageTemplate = REACTION_IMAGE_TEMPLATES[slug as keyof typeof REACTION_IMAGE_TEMPLATES];
      pendingReactionByChat.set(chatId, {
        streamerName,
        reactionMode: imageTemplate ? "image" : "video",
        reactionImagePath: imageTemplate?.path,
      });
      await updateChatPreferences(chatId, { pendingAction: "reaction_main_upload" });
      await sendMessage(token, chatId, [
        `🎭 Выбрано: ${streamerName}`,
        "",
        "Сначала отправьте основное видео, на которое нужно добавить реакцию.",
        imageTemplate
          ? "Выбранное фото будет автоматически размещено снизу без звука."
          : "Затем я попрошу прислать разрешённый reaction-клип без звука.",
        "",
        "Для отмены отправьте /cancel.",
      ].join("\n"));
    } else if (data.startsWith("cut:edit:start:")) {
      await beginVideoCutEdit(token, chatId, data.slice("cut:edit:start:".length));
    } else if (data.startsWith("cut:edit:skip:")) {
      const batchId = data.slice("cut:edit:skip:".length);
      if (!pendingVideoCutBatchByChat.get(chatId) || pendingVideoCutBatchByChat.get(chatId)?.id !== batchId) {
        throw new Error("Сессия выбранных нарезок закончилась.");
      }
      await sendCutMetadataPrompt(token, chatId);
    } else if (data.startsWith("cut:edit:music:")) {
      const [, , , source, batchId] = data.split(":");
      if (!source || !batchId || !["generated", "library", "none"].includes(source)) {
        throw new Error("Неизвестный источник музыки для edit.");
      }
      await askVideoCutEditMood(token, chatId, batchId, source as VideoEditOptions["musicSource"]);
    } else if (data.startsWith("cut:edit:mood:")) {
      const [, , , mood, batchId] = data.split(":");
      const session = pendingVideoCutEditByChat.get(chatId);
      if (!session || session.batchId !== batchId || !session.options || !mood
        || !["energetic", "dark", "cinematic", "funny"].includes(mood)) {
        throw new Error("Сессия выбора музыки для edit закончилась.");
      }
      session.options.musicMood = mood;
      await askVideoCutEditStyle(token, chatId, batchId);
    } else if (data.startsWith("cut:edit:style:")) {
      const [, , , style, batchId] = data.split(":");
      const session = pendingVideoCutEditByChat.get(chatId);
      if (!session || session.batchId !== batchId || !session.options || !style
        || !["hype", "cinematic", "meme"].includes(style)) {
        throw new Error("Сессия выбора стиля для edit закончилась.");
      }
      session.options.editStyle = style;
      await askVideoCutEditFocus(token, chatId, batchId);
    } else if (data.startsWith("cut:edit:focus:none:")) {
      const batchId = data.slice("cut:edit:focus:none:".length);
      const session = pendingVideoCutEditByChat.get(chatId);
      if (!session || session.batchId !== batchId || !session.options) {
        throw new Error("Сессия edit нарезок закончилась.");
      }
      session.options.focusLabel = undefined;
      await updateChatPreferences(chatId, { pendingAction: null });
      runTelegramBackgroundTask(runVideoCutEdit(token, chatId, batchId), { chatId, batchId, task: "video-cut-edit" });
    } else if (data.startsWith("cut:auto_publish:")) {
      const batchId = data.slice("cut:auto_publish:".length);
      const batch = pendingVideoCutBatchByChat.get(chatId);
      if (!batch || batch.id !== batchId) {
        throw new Error("Сессия нарезок закончилась.");
      }
      runTelegramBackgroundTask(
        publishUniqueCutBatch(token, chatId, batchId),
        { chatId, batchId, task: "video-cut-auto-publish" },
      );
    } else if (data.startsWith("cut:reaction:yes:")) {
      await showCutReactionChoice(token, chatId, data.slice("cut:reaction:yes:".length));
    } else if (data.startsWith("cut:reaction:no:")) {
      await showCutSeoMenu(token, chatId, data.slice("cut:reaction:no:".length));
    } else if (data.startsWith("cut:reaction:select:")) {
      const [, , , batchId, slug] = data.split(":");
      const batch = pendingVideoCutBatchByChat.get(chatId);
      if (!batch || batch.id !== batchId || !slug) {
        throw new Error("Сессия выбранных нарезок закончилась.");
      }
      const streamerBySlug: Record<string, string> = {
        buster: "Бустер",
        "egor-krid": "Егор Крид",
        bratishkin: "Братишкин",
        evelone: "Эвелон",
        morgenshtern: "Моргенштерн",
        other: "Другой автор",
      };
      const streamerName = streamerBySlug[slug];
      const imageTemplate = REACTION_IMAGE_TEMPLATES[slug as keyof typeof REACTION_IMAGE_TEMPLATES];
      if (!streamerName && !imageTemplate) throw new Error("Неизвестный автор реакции.");
      const pending: PendingVideoCutReaction = {
        batchId,
        sequences: [...batch.kept].sort((a, b) => a - b),
        streamerName: imageTemplate?.name || streamerName!,
        reactionMode: imageTemplate ? "image" : "video",
        reactionImagePath: imageTemplate?.path,
      };
      pendingVideoCutReactionByChat.set(chatId, pending);
      if (pending.reactionMode === "image") {
        await sendMessage(token, chatId, `⏳ Накладываю ${pending.streamerName} на ${pending.sequences.length} выбранных нарезок.`);
        await applyCutReactionBatch(token, chatId, pending);
      } else {
        await updateChatPreferences(chatId, { pendingAction: "cut_reaction_clip_upload" });
        await sendMessage(token, chatId, [
          `🎭 Выбрано: ${pending.streamerName}.`,
          "",
          "Теперь отправьте разрешённый видеоклип с реакцией.",
          "Его звук будет удалён, а звук каждой исходной нарезки сохранён.",
          `Реакция будет добавлена ко всем выбранным роликам: ${pending.sequences.length}.`,
          "",
          "Для отмены отправьте /cancel.",
        ].join("\n"));
      }
    } else if (data.startsWith("cut:keep:") || data.startsWith("cut:skip:")) {
      const [action, batchId, sequenceText] = data.slice("cut:".length).split(":");
      const sequence = Number.parseInt(sequenceText || "", 10);
      const batch = pendingVideoCutBatchByChat.get(chatId);
      if (!batch || batch.id !== batchId || !Number.isInteger(sequence)) {
        throw new Error("Сессия выбора нарезок закончилась.");
      }
      if (batch.finished) return;
      if (!batch.cuts.has(sequence)) throw new Error("Нарезка не найдена.");
      batch.reviewed.add(sequence);
      if (action === "keep") {
        batch.kept.add(sequence);
        await sendMessage(token, chatId, `✅ Нарезка ${sequence} сохранена для дальнейшей подготовки.`);
      } else {
        batch.kept.delete(sequence);
        await sendMessage(token, chatId, `❌ Нарезка ${sequence} пропущена.`);
      }
      if (batch.reviewed.size >= batch.cuts.size) {
        await finishVideoCutSelection(token, chatId, batchId);
      }
    } else if (data.startsWith("cut:finish:")) {
      await finishVideoCutSelection(token, chatId, data.slice("cut:finish:".length));
    } else if (data.startsWith("cut:seo:")) {
      const [batchId, sequenceText] = data.slice("cut:seo:".length).split(":");
      const sequence = Number.parseInt(sequenceText || "", 10);
      const batch = pendingVideoCutBatchByChat.get(chatId);
      const cut = batch && batch.id === batchId ? batch.cuts.get(sequence) : undefined;
      if (!batch || !cut || !batch.kept.has(sequence)) {
        throw new Error("Выбранная нарезка не найдена.");
      }
      await startCutMetadataFlow(token, chatId, batchId);
    } else if (data === "adapt:repeat") {
      pendingYoutubeByChat.delete(chatId);
      await updateChatPreferences(chatId, { pendingAction: "adapt_video_upload" });
      await sendMessage(token, chatId, [
        "🔁 Сделаем новый вариант.",
        "",
        "Отправьте тот же исходный MP4 ещё раз. Новый запуск выберет другой монтаж, ритм нарезок, переход, цветовой профиль, кадрирование и музыкальную подложку.",
        "Для отмены отправьте /cancel.",
      ].join("\n"));
    } else if (data === "adapt:publish") {
      if (pendingYoutubeByChat.has(chatId)) {
        await updateChatPreferences(chatId, { pendingAction: "youtube_metadata" });
        await sendMessage(token, chatId, "Видео уже готово к публикации. Отправьте название, описание, теги и хэштеги одним сообщением.\n\nДля отмены отправьте /cancel.");
      } else {
        await sendMainMenu(token, chatId, "Срок предпросмотра закончился. Сначала создайте новую адаптацию.");
      }
    } else if (data === "menu:chat") {
      await updateChatPreferences(chatId, {
        platform: "Chat 9:16",
        duration: 30,
        pendingAction: "chat_mode",
      });
      await sendMessage(token, chatId, "💬 Режим чата включён. В начале будет вступление Vibe, затем начнётся переписка.\n\nВыберите формат подготовки:", {
        inline_keyboard: [
          [{ text: "🎬 Один ролик", callback_data: "chat_mode:single" }],
          [{ text: "📦 Несколько роликов", callback_data: "chat_mode:batch" }],
          [{ text: "☀️ Подготовить видео на весь день", callback_data: "chat_mode:daily" }],
        ],
      });
    } else if (data === "menu:story_automation") {
      await showStoryAutomationMenu(token, chatId);
    } else if (data === "story:auto:enable") {
      await enableStoryAutomation(token, chatId);
      void runStoryAutomationScheduler(token);
    } else if (data === "story:auto:disable") {
      await disableStoryAutomation(token, chatId);
    } else if (data === "menu:story") {
      const existing = await getActiveStoryBatch(chatId);
      if (existing) {
        await showStoryBatchStatus(token, chatId, existing);
      } else {
        await startNewStoryDraft(token, chatId);
      }
    } else if (data === "story:new") {
      await startNewStoryDraft(token, chatId);
    } else if (data.startsWith("story:channel:")) {
      const [, , batchIdText, connectionIdText] = data.split(":");
      const batchId = Number.parseInt(batchIdText || "", 10);
      const connectionId = Number.parseInt(connectionIdText || "", 10);
      const [batch] = await db.select().from(storyBatchesTable).where(and(
        eq(storyBatchesTable.id, batchId),
        eq(storyBatchesTable.chatId, chatId),
        eq(storyBatchesTable.status, "choosing_channels"),
      ));
      if (!batch || !Number.isInteger(connectionId)) throw new Error("Черновик истории не найден.");
      const selected = new Set(storyConnectionIds(batch));
      if (selected.has(connectionId)) selected.delete(connectionId);
      else selected.add(connectionId);
      await db.update(storyBatchesTable).set({
        connectionIds: [...selected],
        updatedAt: new Date(),
      }).where(eq(storyBatchesTable.id, batchId));
      await showStoryChannelChoice(token, chatId, batchId);
    } else if (data.startsWith("story:channels:done:")) {
      const batchId = Number.parseInt(data.slice("story:channels:done:".length), 10);
      const [batch] = await db.select().from(storyBatchesTable).where(and(
        eq(storyBatchesTable.id, batchId),
        eq(storyBatchesTable.chatId, chatId),
        eq(storyBatchesTable.status, "choosing_channels"),
      ));
      if (!batch || !storyConnectionIds(batch).length) throw new Error("Выберите хотя бы один YouTube-канал.");
       await db.update(storyBatchesTable).set({ status: "collecting", updatedAt: new Date() })
         .where(eq(storyBatchesTable.id, batchId));
       await updateChatPreferences(chatId, { pendingAction: "story_title" });
       await sendMessage(token, chatId, [
         "✅ Каналы сохранены.",
         "",
         "Теперь отправьте общее название или тему истории одним сообщением.",
         "После этого я попрошу один исходный сценарий.",
         "",
         "Для отмены отправьте /cancel.",
       ].join("\n"));
    } else if (data.startsWith("story:channels:back:")) {
      const batchId = Number.parseInt(data.slice("story:channels:back:".length), 10);
      await db.update(storyBatchesTable).set({ status: "choosing_channels", updatedAt: new Date() })
        .where(and(eq(storyBatchesTable.id, batchId), eq(storyBatchesTable.chatId, chatId)));
      await showStoryChannelChoice(token, chatId, batchId);
    } else if (data.startsWith("story:banner:")) {
      const [, , bannerChoice, batchIdText] = data.split(":");
      const batchId = Number.parseInt(batchIdText || "", 10);
      const [batch] = await db.select().from(storyBatchesTable).where(and(
        eq(storyBatchesTable.id, batchId),
        eq(storyBatchesTable.chatId, chatId),
        eq(storyBatchesTable.status, "choosing_banner"),
      ));
      if (!batch) throw new Error("Черновик истории не найден.");
      if (bannerChoice === "upload") {
        await updateChatPreferences(chatId, { pendingAction: "story_banner_upload" });
        await sendMessage(token, chatId, "📤 Отправьте изображение или MP4 баннера. Он будет наложен сверху по центру.\n\nДля отмены отправьте /cancel.");
      } else {
        let bannerStoragePath: string | null = null;
        let bannerKind: "image" | "video" | null = null;
        if (bannerChoice === "default" || bannerChoice === "none") {
          const banner = await getDefaultVideoCutBanner();
          if (!banner) throw new Error("Стандартный NOX-баннер недоступен.");
          bannerStoragePath = banner.storagePath;
          bannerKind = banner.kind;
        } else if (bannerChoice !== "none") {
          throw new Error("Неизвестный вариант баннера.");
        }
        await db.update(storyBatchesTable).set({
          bannerStoragePath,
          bannerKind,
          status: "choosing_banner",
          updatedAt: new Date(),
        }).where(eq(storyBatchesTable.id, batchId));
        await answerCallbackQuery(token, callback.id, "Запустил подготовку 9 отдельных вариантов.");
        runStoryBatchGenerationInBackground(token, chatId, batchId);
      }
    } else if (data.startsWith("story:cancel:")) {
      const batchId = Number.parseInt(data.slice("story:cancel:".length), 10);
      await db.update(storyBatchesTable).set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(storyBatchesTable.id, batchId), eq(storyBatchesTable.chatId, chatId)));
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMainMenu(token, chatId, "Подготовка истории отменена.");
    } else if (data.startsWith("story:approve:")) {
      const itemId = Number.parseInt(data.slice("story:approve:".length), 10);
      const item = await getStoryItemForChat(chatId, itemId, ["awaiting_review", "awaiting_publish", "published"]);
      if (!item) throw new Error("Готовый вариант истории не найден.");
      if (item.status === "published") {
        await sendMessage(token, chatId, `ℹ️ Вариант для «${item.channelTitle}» уже опубликован.\nhttps://youtu.be/${item.publishedVideoId || ""}`);
        return;
      }
      if (item.status === "awaiting_publish") {
        await sendMessage(token, chatId, `✅ Вариант для «${item.channelTitle}» уже одобрен. Выберите режим публикации:`, {
          inline_keyboard: [
            [{ text: "🌍 Опубликовать открыто", callback_data: `story:publish:public:${itemId}` }],
            [{ text: "🔒 Опубликовать приватно", callback_data: `story:publish:private:${itemId}` }],
          ],
        });
        return;
      }
      await db.update(storyBatchItemsTable).set({ status: "awaiting_publish", updatedAt: new Date() })
        .where(eq(storyBatchItemsTable.id, itemId));
      await sendMessage(token, chatId, `✅ Вариант для «${item.channelTitle}» одобрен. Выберите режим публикации:`, {
        inline_keyboard: [
          [{ text: "🌍 Опубликовать открыто", callback_data: `story:publish:public:${itemId}` }],
          [{ text: "🔒 Опубликовать приватно", callback_data: `story:publish:private:${itemId}` }],
        ],
      });
    } else if (data.startsWith("story:publish_all:")) {
      const [, , privacy, batchIdText] = data.split(":");
      const batchId = Number.parseInt(batchIdText || "", 10);
      if (!["public", "private"].includes(privacy || "") || !Number.isInteger(batchId)) {
        throw new Error("Неизвестный режим массовой публикации.");
      }
      await answerCallbackQuery(token, callback.id, "Начинаю общую загрузку на все выбранные каналы…");
      await publishStoryBatch(token, chatId, batchId, privacy as "public" | "private");
    } else if (data.startsWith("story:publish:")) {
      const [, , privacy, itemIdText] = data.split(":");
      const itemId = Number.parseInt(itemIdText || "", 10);
      if (!["public", "private"].includes(privacy || "")) throw new Error("Неизвестный режим публикации.");
      const item = await getStoryItemForChat(chatId, itemId, ["awaiting_publish"]);
      if (!item?.projectId || !item.jobId) throw new Error("Данные готового варианта не найдены.");
      await answerCallbackQuery(token, callback.id, "Начинаю загрузку на YouTube…");
      await sendMessage(token, chatId, `⏳ Загружаю «${item.title}» на YouTube…`);
      const [job] = await db.select().from(videoGenerationJobsTable).where(and(
        eq(videoGenerationJobsTable.id, item.jobId),
        eq(videoGenerationJobsTable.projectId, item.projectId),
        eq(videoGenerationJobsTable.status, "completed"),
      ));
      if (!job?.videoStoragePath) throw new Error("Готовый MP4 не найден.");
      const metadata = {
        title: item.title,
        description: item.description,
        tags: Array.isArray(item.tags) ? item.tags.filter((value): value is string => typeof value === "string") : [],
        hashtags: Array.isArray(item.hashtags) ? item.hashtags.filter((value): value is string => typeof value === "string") : [],
      };
      const result = await uploadYoutubeShort({
        videoStoragePath: job.videoStoragePath,
        title: metadata.title,
        description: `${metadata.description}\n\n${metadata.hashtags.join(" ")}`,
        tags: metadata.tags,
        connectionId: item.connectionId,
        privacyStatus: privacy as "public" | "private",
        preserveDescription: false,
      });
      await db.update(storyBatchItemsTable).set({
        status: "published",
        publishedVideoId: result.videoId,
        publishedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(storyBatchItemsTable.id, itemId));
      await sendMessage(token, chatId, `🎉 История опубликована на «${item.channelTitle}»:\nhttps://youtu.be/${result.videoId}`);
    } else if (data.startsWith("story:retry:")) {
      const itemId = Number.parseInt(data.slice("story:retry:".length), 10);
      await retryStoryVariant(token, chatId, itemId);
    } else if (data.startsWith("story:redo:")) {
      const itemId = Number.parseInt(data.slice("story:redo:".length), 10);
      const item = await getStoryItemForChat(chatId, itemId, ["awaiting_review"]);
      if (!item?.projectId) throw new Error("Вариант истории не найден.");
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, item.projectId));
      if (!project) throw new Error("Проект истории не найден.");
      const preferences = await getChatPreferences(chatId);
      const job = await startVideoGeneration(item.projectId, {
        format: "9:16",
        duration: project.duration,
        style: project.style,
        tone: project.tone,
        voiceId: preferences.voiceId || undefined,
        voiceName: preferences.voiceName || undefined,
        chatId,
      });
      await db.update(storyBatchItemsTable).set({ jobId: job.id, status: "processing", error: null, updatedAt: new Date() })
        .where(eq(storyBatchItemsTable.id, itemId));
      await sendMessage(token, chatId, `🔄 Переделываю вариант для «${item.channelTitle}».`);
      const batch = await db.select({ batchId: storyBatchItemsTable.batchId }).from(storyBatchItemsTable)
        .where(eq(storyBatchItemsTable.id, itemId)).then((rows) => rows[0]);
      if (!batch) throw new Error("Пакет истории не найден.");
      runStoryMonitorInBackground(
        monitorStoryVideoJob(token, chatId, batch.batchId, itemId, item.projectId, job.id),
        { chatId, projectId: item.projectId, jobId: job.id, task: "story-video-redo" },
      );
    } else if (data === "chat_mode:single") {
      await updateChatPreferences(chatId, { pendingAction: "chat_duration" });
      await sendMessage(token, chatId, "Выберите общую длительность одного ролика:", {
        inline_keyboard: [
          [{ text: "30 сек", callback_data: "chat_duration:30" }, { text: "60 сек", callback_data: "chat_duration:60" }],
          [{ text: "90 сек", callback_data: "chat_duration:90" }, { text: "120 сек", callback_data: "chat_duration:120" }],
        ],
      });
    } else if (data === "chat_mode:batch") {
      await updateChatPreferences(chatId, { pendingAction: "batch_count" });
      await sendMessage(token, chatId, [
        "📦 Пакетная подготовка роликов.",
        "",
        "Сколько роликов хотите сделать? Напишите число от 2 до 20.",
        "После этого выберем длительность, а затем вы отправите готовые сценарии по одному.",
        "",
        "Для отмены отправьте /cancel.",
      ].join("\n"));
      } else if (data === "chat_mode:daily") {
        await updateChatPreferences(chatId, { platform: "Chat 9:16", duration: 60, pendingAction: "chat_day_mode" });
        await sendMessage(token, chatId, [
          "☀️ Подготовка видео на весь день.",
          "",
          "Выберите, как передать сценарии:",
        ].join("\n"), {
          inline_keyboard: [
            [{ text: "🤖 Один сценарий → 5 вариантов", callback_data: "chat_day:mode:variants" }],
            [{ text: "📝 Добавить 5 сценариев вручную", callback_data: "chat_day:mode:manual" }],
          ],
        });
      } else if (data === "chat_day:mode:variants") {
        await updateChatPreferences(chatId, { pendingAction: "chat_day_script" });
        await sendMessage(token, chatId, [
          "Отправьте полностью готовый сценарий — текст, который уже нужно озвучить.",
          "Первый ролик будет сделан по нему без переписывания. Затем я проанализирую исходник и добавлю ещё четыре близких варианта с новыми изюминками.",
          "Тему, формат и краткое описание отправлять не нужно.",
          "",
          "Для переписки удобно подписать реплики: «Аноним: …» и «Собеседник: …».",
          "Для отмены отправьте /cancel.",
        ].join("\n"));
      } else if (data === "chat_day:mode:manual") {
        await createManualChatDayBatch(token, chatId);
    } else if (data.startsWith("chat_duration:")) {
      const duration = Number.parseInt(data.slice("chat_duration:".length), 10);
      if (![30, 60, 90, 120].includes(duration)) throw new Error("Недоступная длительность чата");
      await updateChatPreferences(chatId, {
        platform: "Chat 9:16",
        duration,
        pendingAction: "video_topic",
      });
      await sendMessage(token, chatId, `✅ Общая длительность чата: ${duration} секунд, включая вступление Vibe.\n\nОтправьте тему переписки одним сообщением или выберите авторский сценарий.`, {
        inline_keyboard: [
          [{ text: "📝 Отправить свой сценарий", callback_data: "menu:chat_custom_script" }],
        ],
      });
    } else if (data.startsWith("chat_batch_duration:")) {
      const duration = Number.parseInt(data.slice("chat_batch_duration:".length), 10);
      if (![30, 60, 90, 120].includes(duration)) throw new Error("Недоступная длительность чата");
      const batch = await getActiveChatVideoBatch(chatId, ["collecting"]);
      if (!batch) throw new Error("Пакет роликов не найден. Начните его заново.");
      await updateChatPreferences(chatId, {
        platform: "Chat 9:16",
        duration,
        pendingAction: "batch_script",
      });
      await sendMessage(token, chatId, [
        `✅ Длительность каждого ролика: ${duration} секунд.`,
        "",
        `Отправьте сценарий 1/${batch.totalCount} отдельным сообщением.`,
        "В каждом сценарии должно быть минимум две реплики. Можно использовать формат «Аноним: …» и «Собеседник: …».",
        "Для отмены отправьте /cancel.",
      ].join("\n"));
    } else if (data.startsWith("chat_batch:approve:")) {
      const batchId = Number.parseInt(data.slice("chat_batch:approve:".length), 10);
      const batch = await getActiveChatVideoBatch(chatId, ["collecting"]);
      if (!batch || batch.id !== batchId) throw new Error("Пакет уже завершён или устарел.");
      await db.update(chatVideoBatchesTable).set({ status: "queued", updatedAt: new Date() })
        .where(eq(chatVideoBatchesTable.id, batchId));
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMessage(token, chatId, "✅ Пакет утверждён. Буду создавать ролики по одному и присылать каждый готовый MP4 в этот чат.");
      runTelegramBackgroundTask(
        runChatVideoBatch(token, chatId, batchId),
        { chatId, batchId, task: "chat-video-batch" },
      );
    } else if (data.startsWith("chat_batch:cancel:")) {
      const batchId = Number.parseInt(data.slice("chat_batch:cancel:".length), 10);
      await db.update(chatVideoBatchesTable).set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(chatVideoBatchesTable.id, batchId), eq(chatVideoBatchesTable.chatId, chatId)));
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMainMenu(token, chatId, "Пакет отменён.");
    } else if (data.startsWith("chat_batch:pause:")) {
      const batchId = Number.parseInt(data.slice("chat_batch:pause:".length), 10);
      await db.update(chatVideoBatchesTable).set({ status: "paused", updatedAt: new Date() })
        .where(and(eq(chatVideoBatchesTable.id, batchId), eq(chatVideoBatchesTable.chatId, chatId)));
      await sendMessage(token, chatId, "⏸ Пакет поставлен на паузу. Текущий ролик завершится, новые ролики не запустятся.", {
        inline_keyboard: [[{ text: "▶️ Продолжить пакет", callback_data: `chat_batch:resume:${batchId}` }]],
      });
    } else if (data.startsWith("chat_batch:resume:")) {
      const batchId = Number.parseInt(data.slice("chat_batch:resume:".length), 10);
      const [batch] = await db.select().from(chatVideoBatchesTable).where(and(
        eq(chatVideoBatchesTable.id, batchId),
        eq(chatVideoBatchesTable.chatId, chatId),
        eq(chatVideoBatchesTable.status, "paused"),
      ));
      if (!batch) throw new Error("Пакет не найден или уже выполняется.");
      await db.update(chatVideoBatchesTable).set({ status: "queued", updatedAt: new Date() })
        .where(eq(chatVideoBatchesTable.id, batchId));
      await sendMessage(token, chatId, "▶️ Продолжаю пакет с первого незавершённого ролика.");
      runTelegramBackgroundTask(
        runChatVideoBatch(token, chatId, batchId),
        { chatId, batchId, task: "chat-video-batch-resume" },
      );
      } else if (data.startsWith("chat_day:approve_variants:")) {
        const batchId = Number.parseInt(data.slice("chat_day:approve_variants:".length), 10);
        const [batch] = await db.select().from(chatDayBatchesTable).where(and(
          eq(chatDayBatchesTable.id, batchId),
          eq(chatDayBatchesTable.chatId, chatId),
          eq(chatDayBatchesTable.status, "awaiting_review"),
        ));
        if (!batch) throw new Error("Пакет вариантов не найден или уже запущен.");
        await sendMessage(token, chatId, "✅ Пять вариантов утверждены. Начинаю создавать пять видео по очереди.");
        runTelegramBackgroundTask(
          runChatDayBatch(token, chatId, batchId),
          { chatId, batchId, task: "chat-day-video-batch" },
        );
      } else if (data.startsWith("chat_day:approve_videos:")) {
        const batchId = Number.parseInt(data.slice("chat_day:approve_videos:".length), 10);
        const [batch] = await db.select().from(chatDayBatchesTable).where(and(
          eq(chatDayBatchesTable.id, batchId),
          eq(chatDayBatchesTable.chatId, chatId),
          eq(chatDayBatchesTable.status, "awaiting_video_review"),
        ));
        if (!batch) throw new Error("Готовые ролики дневного пакета не найдены.");
        await db.update(chatDayBatchesTable).set({ status: "awaiting_metadata", updatedAt: new Date() })
          .where(eq(chatDayBatchesTable.id, batchId));
        await updateChatPreferences(chatId, { pendingAction: "chat_day_metadata" });
        await sendMessage(token, chatId, [
          "📝 Заполните данные для пяти публикаций вручную.",
          "",
          "Для каждого выпуска отправьте отдельное сообщение в формате:",
          "Название: заголовок выпуска",
          "Описание: полное описание",
          "Теги: тег 1, тег 2, тег 3",
          "Хэштеги: #shorts #история",
          "",
          "Сейчас заполните SEO для выпуска 1/5. После этого я попрошу данные для 2/5 и так далее.",
          "Ваши данные будут использованы одинаково на всех выбранных каналах без автоматической замены.",
        ].join("\n"), {
          inline_keyboard: [
            [{ text: "✨ Придумать автоматически", callback_data: `chat_day:metadata:auto:${batchId}` }],
          ],
        });
      } else if (data.startsWith("chat_day:retry_failed:")) {
        const batchId = Number.parseInt(data.slice("chat_day:retry_failed:".length), 10);
        const [batch] = await db.select().from(chatDayBatchesTable).where(and(
          eq(chatDayBatchesTable.id, batchId),
          eq(chatDayBatchesTable.chatId, chatId),
          eq(chatDayBatchesTable.status, "awaiting_video_review"),
        ));
        if (!batch) throw new Error("Пакет с ошибками не найден или уже запущен.");
        const [failedItem] = await db.select({ id: chatDayBatchItemsTable.id })
          .from(chatDayBatchItemsTable)
          .where(and(
            eq(chatDayBatchItemsTable.batchId, batchId),
            eq(chatDayBatchItemsTable.status, "failed"),
          ))
          .limit(1);
        if (!failedItem) throw new Error("В пакете нет роликов для повторной генерации.");
        await db.update(chatDayBatchesTable).set({ status: "processing", updatedAt: new Date() })
          .where(eq(chatDayBatchesTable.id, batchId));
        await sendMessage(token, chatId, "🔁 Повторяю только незавершённые ролики. Готовые ролики останутся без изменений.");
        runTelegramBackgroundTask(
          runChatDayBatch(token, chatId, batchId),
          { chatId, batchId, task: "chat-day-failed-items-retry" },
        );
      } else if (data.startsWith("chat_day:metadata:auto:")) {
        const batchId = Number.parseInt(data.slice("chat_day:metadata:auto:".length), 10);
        await prepareChatDayMetadata(token, chatId, batchId);
      } else if (data.startsWith("chat_day:target:")) {
        const parts = data.split(":");
        const action = parts[2];
        const batchId = Number.parseInt(parts[3] || "", 10);
        const value = Number.parseInt(action || "", 10);
        const [batch] = await db.select().from(chatDayBatchesTable).where(and(
          eq(chatDayBatchesTable.id, batchId),
          eq(chatDayBatchesTable.chatId, chatId),
          eq(chatDayBatchesTable.status, "awaiting_metadata"),
        ));
        if (!batch) throw new Error("Дневной пакет не найден.");
        const connections = await listYoutubeConnections();
        let selectedIds = Array.isArray(batch.connectionIds) ? batch.connectionIds as number[] : [];
        if (action === "all") selectedIds = connections.map((connection) => connection.id);
        else if (action === "none") selectedIds = [];
        else {
          if (!connections.some((connection) => connection.id === value)) throw new Error("Канал не найден.");
          selectedIds = selectedIds.includes(value)
            ? selectedIds.filter((id) => id !== value)
            : [...selectedIds, value];
        }
        await db.update(chatDayBatchesTable).set({ connectionIds: selectedIds, updatedAt: new Date() })
          .where(eq(chatDayBatchesTable.id, batchId));
        await showChatDayChannelChoice(token, chatId, batchId);
      } else if (data.startsWith("chat_day:targets:done:")) {
        const batchId = Number.parseInt(data.slice("chat_day:targets:done:".length), 10);
        const [batch] = await db.select().from(chatDayBatchesTable).where(and(
          eq(chatDayBatchesTable.id, batchId),
          eq(chatDayBatchesTable.chatId, chatId),
          eq(chatDayBatchesTable.status, "awaiting_metadata"),
        ));
        if (!batch) throw new Error("Дневной пакет не найден.");
        const selectedIds = Array.isArray(batch.connectionIds) ? batch.connectionIds as number[] : [];
        if (!selectedIds.length) throw new Error("Выберите хотя бы один YouTube-канал.");
        await sendMessage(token, chatId, "Как публиковать пять роликов?", {
          inline_keyboard: [
            [{ text: "🔒 Приватно", callback_data: `chat_day:privacy:private:${batchId}` }],
            [{ text: "🌍 Открыто", callback_data: `chat_day:privacy:public:${batchId}` }],
            [{ text: "⬅️ Вернуться к выбору каналов", callback_data: `chat_day:back_channels:${batchId}` }],
          ],
        });
      } else if (data.startsWith("chat_day:back_channels:")) {
        const batchId = Number.parseInt(data.slice("chat_day:back_channels:".length), 10);
        await showChatDayChannelChoice(token, chatId, batchId);
      } else if (data.startsWith("chat_day:privacy:")) {
        const parts = data.split(":");
        const privacyStatus = parts[2] === "public" ? "public" : "private";
        const batchId = Number.parseInt(parts[3] || "", 10);
        const [batch] = await db.select().from(chatDayBatchesTable).where(and(
          eq(chatDayBatchesTable.id, batchId),
          eq(chatDayBatchesTable.chatId, chatId),
          eq(chatDayBatchesTable.status, "awaiting_metadata"),
        ));
        if (!batch) throw new Error("Дневной пакет не найден.");
        await db.update(chatDayBatchesTable).set({ privacyStatus, updatedAt: new Date() })
          .where(eq(chatDayBatchesTable.id, batchId));
        await sendMessage(token, chatId, [
          `✅ Режим: ${privacyStatus === "public" ? "открыто" : "приватно"}.`,
          "",
          "Расписание:",
          "1-й ролик — сейчас",
          "2-й ролик — через 3 часа",
          "3-й ролик — через 6 часов",
          "4-й ролик — через 9 часов",
          "5-й ролик — через 12 часов",
        ].join("\n"), {
          inline_keyboard: [
            [{ text: "☀️ Запустить публикацию на весь день", callback_data: `chat_day:schedule:${batchId}` }],
            [{ text: "⬅️ Вернуться к каналам", callback_data: `chat_day:back_channels:${batchId}` }],
          ],
        });
      } else if (data.startsWith("chat_day:schedule:")) {
        const batchId = Number.parseInt(data.slice("chat_day:schedule:".length), 10);
        const [batch] = await db.select().from(chatDayBatchesTable).where(and(
          eq(chatDayBatchesTable.id, batchId),
          eq(chatDayBatchesTable.chatId, chatId),
          eq(chatDayBatchesTable.status, "awaiting_metadata"),
        ));
        if (!batch) throw new Error("Дневной пакет не найден.");
        await scheduleChatDayBatch(token, chatId, batchId, (batch.privacyStatus as "private" | "public") || "private");
      } else if (data.startsWith("chat_day:cancel:")) {
        const batchId = Number.parseInt(data.slice("chat_day:cancel:".length), 10);
        await db.update(chatDayBatchesTable).set({ status: "cancelled", updatedAt: new Date() })
          .where(and(eq(chatDayBatchesTable.id, batchId), eq(chatDayBatchesTable.chatId, chatId)));
        await updateChatPreferences(chatId, { pendingAction: null });
        await sendMainMenu(token, chatId, "Дневной пакет отменён.");
    } else if (data === "menu:chat_custom_script") {
      await updateChatPreferences(chatId, {
        platform: "Chat 9:16",
        pendingAction: "chat_custom_script",
      });
      await sendMessage(token, chatId, [
        "📝 Отправьте готовый сценарий переписки одним сообщением.",
        "",
        "Можно писать по репликам:",
        "Аноним: Привет…",
        "Собеседник: Привет, я хотел спросить…",
        "",
        "Если имена не указаны, бот будет чередовать двух собеседников сам.",
        "После отправки я сразу озвучу сценарий, добавлю заставку Vibe и соберу видео без генерации новой истории.",
        "Для отмены отправьте /cancel.",
      ].join("\n"));
    } else if (data === "menu:long_video") {
      await updateChatPreferences(chatId, { pendingAction: "long_video_prompt" });
      await sendMessage(token, chatId, [
        "🎞 ДЛИННОЕ ВИДЕО — до 20 минут",
        "",
        "Вставьте полноценный промт: о чём видео, для кого оно, факты, герои, стиль, структура и желаемый финал.",
        "После утверждения сценария я запущу озвучку, изображения, музыку, монтаж и субтитры.",
        "",
        "Пример: «Сделай документальный фильм о том, как менялась Москва за 100 лет…»",
        "",
        "Для отмены отправьте /cancel.",
      ].join("\n"));
    } else if (data === "menu:series") {
      if (await showActiveSeriesMenu(token, chatId)) return;
      await showSeriesStylePicker(token, chatId);
    } else if (data === "series:refresh") {
      if (await showActiveSeriesMenu(token, chatId)) return;
      await showSeriesStylePicker(token, chatId);
    } else if (data === "series:back") {
      if (await showActiveSeriesMenu(token, chatId)) return;
      await showSeriesStylePicker(token, chatId);
    } else if (data === "series:plan") {
      if (await showSeriesPlan(token, chatId)) return;
      await showSeriesStylePicker(token, chatId);
    } else if (data === "series:bible") {
      if (await showSeriesBible(token, chatId)) return;
      await showSeriesStylePicker(token, chatId);
    } else if (data === "series:delete") {
      const series = await getActiveSeries(chatId);
      if (!series) {
        await showSeriesStylePicker(token, chatId);
        return;
      }
      await sendMessage(token, chatId, [
        `⚠️ Удалить сериал «${series.title}»?`,
        "",
        "Будут удалены библия, план сезона и связанные черновики серий.",
        "Это действие нельзя отменить.",
      ].join("\n"), {
        inline_keyboard: [
          [{ text: "🗑 Да, удалить сериал", callback_data: "series:delete:confirm" }],
          [{ text: "Отмена", callback_data: "series:back" }],
        ],
      });
    } else if (data === "series:delete:confirm") {
      const series = await getActiveSeries(chatId);
      if (!series) {
        await showSeriesStylePicker(token, chatId);
        return;
      }
      const seasons = await db.select({ id: seasonsTable.id })
        .from(seasonsTable)
        .where(eq(seasonsTable.seriesId, series.id));
      const episodeRows = seasons.length
        ? await db.select({ projectId: seriesEpisodesTable.projectId })
          .from(seriesEpisodesTable)
          .where(inArray(seriesEpisodesTable.seasonId, seasons.map((season) => season.id)))
        : [];
      const projectIds = episodeRows
        .map((episode) => episode.projectId)
        .filter((projectId): projectId is number => typeof projectId === "number");
      if (projectIds.length) {
        await db.delete(projectsTable).where(inArray(projectsTable.id, projectIds));
      }
      await db.delete(seriesTable).where(and(
        eq(seriesTable.id, series.id),
        eq(seriesTable.chatId, chatId),
      ));
      pendingSeriesByChat.delete(chatId);
      activeSeriesEpisodeByChat.delete(chatId);
      lastProjectByChat.delete(chatId);
      await updateChatPreferences(chatId, { activeSeriesId: null, pendingAction: null });
      await showSeriesStylePicker(token, chatId);
      await sendMessage(token, chatId, "✅ Сериал удалён. Теперь можно создать новый.");
    } else if (data === "menu:cta_profiles") {
      await showCtaProfiles(token, chatId);
    } else if (data === "cta:new") {
      await updateChatPreferences(chatId, { pendingAction: "cta_profile" });
      await sendMessage(token, chatId, [
        "📣 Новый CTA-профиль",
        "",
        "Отправьте настройки в формате:",
        "Название: Курьеры Новосибирск",
        "Город: Новосибирск",
        "Направление: курьеры",
        `Текст: ${DEFAULT_RECRUITMENT_CTA}`,
        "Ссылка: https://t.me/my_channel",
        "Позиция: конец",
        "",
        "Поля «Ссылка» и «Позиция» можно не указывать.",
      ].join("\n"));
    } else if (data === "cta:save_preview") {
      const draft = pendingCtaDraftByChat.get(chatId);
      if (!draft) throw new Error("Предпросмотр CTA устарел. Создайте профиль заново.");
      let saved;
      if (draft.profileId) {
        [saved] = await db.update(ctaProfilesTable).set({
          name: draft.name,
          city: draft.city,
          profession: draft.profession,
          ctaText: draft.ctaText,
          telegramUrl: draft.telegramUrl,
          placement: draft.placement,
          updatedAt: new Date(),
        }).where(and(eq(ctaProfilesTable.id, draft.profileId), eq(ctaProfilesTable.chatId, chatId))).returning();
        if (!saved) throw new Error("CTA-профиль не найден.");
      } else {
        [saved] = await db.insert(ctaProfilesTable).values({
          chatId,
          name: draft.name,
          city: draft.city,
          profession: draft.profession,
          ctaText: draft.ctaText,
          telegramUrl: draft.telegramUrl,
          placement: draft.placement,
        }).returning();
      }
      pendingCtaDraftByChat.delete(chatId);
      await updateChatPreferences(chatId, { activeCtaProfileId: saved.id, pendingAction: null });
      await sendMainMenu(token, chatId, `✅ CTA-профиль «${saved.name}» сохранён и выбран активным.`);
    } else if (data === "cta:cancel_preview") {
      pendingCtaDraftByChat.delete(chatId);
      pendingCtaEditByChat.delete(chatId);
      await updateChatPreferences(chatId, { pendingAction: null });
      await showCtaProfiles(token, chatId);
    } else if (data.startsWith("cta:select:")) {
      const profileId = Number.parseInt(data.slice("cta:select:".length), 10);
      const [profile] = await db.select().from(ctaProfilesTable)
        .where(and(eq(ctaProfilesTable.id, profileId), eq(ctaProfilesTable.chatId, chatId)));
      if (!profile) throw new Error("CTA-профиль не найден.");
      await updateChatPreferences(chatId, { activeCtaProfileId: profile.id, pendingAction: null });
      await sendMainMenu(token, chatId, `✅ Выбран CTA-профиль: ${profile.name}`);
    } else if (data.startsWith("cta:edit:")) {
      const profileId = Number.parseInt(data.slice("cta:edit:".length), 10);
      const [profile] = await db.select().from(ctaProfilesTable)
        .where(and(eq(ctaProfilesTable.id, profileId), eq(ctaProfilesTable.chatId, chatId)));
      if (!profile) throw new Error("CTA-профиль не найден.");
      pendingCtaEditByChat.set(chatId, profile.id);
      await updateChatPreferences(chatId, { pendingAction: "cta_profile_edit" });
      await sendMessage(token, chatId, [
        `✏️ Редактирование CTA-профиля «${profile.name}»`,
        "",
        "Отправьте обновлённые настройки в формате:",
        `Название: ${profile.name}`,
        `Город: ${profile.city}`,
        `Направление: ${profile.profession}`,
        `Текст: ${profile.ctaText}`,
        `Ссылка: ${profile.telegramUrl || ""}`,
        `Позиция: ${profile.placement === "opening" ? "начало" : profile.placement === "middle" ? "середина" : "конец"}`,
      ].join("\n"));
    } else if (data.startsWith("cta:delete:")) {
      const profileId = Number.parseInt(data.slice("cta:delete:".length), 10);
      const [profile] = await db.select({ id: ctaProfilesTable.id, name: ctaProfilesTable.name })
        .from(ctaProfilesTable)
        .where(and(eq(ctaProfilesTable.id, profileId), eq(ctaProfilesTable.chatId, chatId)));
      if (!profile) throw new Error("CTA-профиль не найден.");
      await sendMessage(token, chatId, `Удалить CTA-профиль «${profile.name}»? Уже созданные сериалы не изменятся.`, {
        inline_keyboard: [
          [{ text: "🗑 Да, удалить", callback_data: `cta:delete_confirm:${profile.id}` }],
          [{ text: "Отмена", callback_data: "menu:cta_profiles" }],
        ],
      });
    } else if (data.startsWith("cta:delete_confirm:")) {
      const profileId = Number.parseInt(data.slice("cta:delete_confirm:".length), 10);
      const [profile] = await db.select().from(ctaProfilesTable)
        .where(and(eq(ctaProfilesTable.id, profileId), eq(ctaProfilesTable.chatId, chatId)));
      if (!profile) throw new Error("CTA-профиль не найден.");
      const preferences = await getChatPreferences(chatId);
      await db.delete(ctaProfilesTable).where(and(eq(ctaProfilesTable.id, profileId), eq(ctaProfilesTable.chatId, chatId)));
      if (preferences.activeCtaProfileId === profileId) {
        const [fallback] = await db.select({ id: ctaProfilesTable.id }).from(ctaProfilesTable)
          .where(eq(ctaProfilesTable.chatId, chatId))
          .orderBy(desc(ctaProfilesTable.updatedAt)).limit(1);
        await updateChatPreferences(chatId, { activeCtaProfileId: fallback?.id || null, pendingAction: null });
      }
      await showCtaProfiles(token, chatId);
    } else if (data === "series:new") {
      await updateChatPreferences(chatId, { activeSeriesId: null });
      await showSeriesStylePicker(token, chatId);
    } else if (data.startsWith("series:style:")) {
      const style = data.slice("series:style:".length);
      const styles: Record<string, string> = {
        realistic: "realistic cinematic",
        pixar: "Pixar-like 3D animated film, expressive stylized characters, warm cinematic lighting",
        anime: "cinematic anime, detailed 2D animation, expressive faces, dynamic composition",
        cartoon: "stylized cartoon animation, clean shapes, colorful expressive characters",
      };
      if (!styles[style]) throw new Error("Неизвестный стиль сериала.");
      pendingSeriesStyleByChat.set(chatId, styles[style]!);
      await updateChatPreferences(chatId, { pendingAction: "series_prompt" });
      await sendMessage(token, chatId, `✅ Стиль выбран: ${styles[style]}\n\n📺 Теперь отправьте только название сериала. Затем я спрошу, сколько серий должно быть в сезоне.`);
    } else if (data === "series:edit" || data === "series:regenerate") {
      await updateChatPreferences(chatId, { pendingAction: data === "series:edit" ? "series_edit" : "series_prompt" });
      await sendMessage(token, chatId, data === "series:edit"
        ? "✏️ Напишите, что изменить в концепции сериала: героев, город, стиль, интригу или финал сезона."
        : "🔄 Отправьте новый промт для другого варианта сериала.");
    } else if (data === "series:approve") {
      const pending = pendingSeriesByChat.get(chatId);
      const seriesId = pending?.seriesId || (await getChatPreferences(chatId)).activeSeriesId;
      if (!seriesId) throw new Error("Черновик сериала не найден.");
      const [series] = await db.update(seriesTable).set({ status: "approved" }).where(eq(seriesTable.id, seriesId)).returning();
      if (!series) throw new Error("Сериал не найден.");
      await db.update(seasonsTable).set({ status: "approved" }).where(eq(seasonsTable.seriesId, seriesId));
      await saveSeriesMemory({
        seriesId,
        eventType: "series_approved",
        payload: { title: series.title, status: "approved" },
      });
      pendingSeriesByChat.delete(chatId);
      await sendMessage(token, chatId, `✅ Библия и план сезона «${series.title}» утверждены.\n\nТеперь создаём серии по одной.`, {
        inline_keyboard: [
          [{ text: "🎬 Написать первую серию", callback_data: "series:episode:generate" }],
          [{ text: "⬅️ Главное меню", callback_data: "menu:home" }],
        ],
      });
    } else if (data === "series:episode:generate") {
      await generateNextSeriesEpisode(token, chatId);
    } else if (data === "series:add_episodes") {
      const series = await getActiveSeries(chatId);
      if (!series) throw new Error("Активный сериал не найден.");
      const [season] = await db.select({ id: seasonsTable.id })
        .from(seasonsTable)
        .where(eq(seasonsTable.seriesId, series.id))
        .orderBy(desc(seasonsTable.seasonNumber));
      if (!season) throw new Error("План сезона не найден.");
      const currentEpisodes = await db.select({ id: seriesEpisodesTable.id })
        .from(seriesEpisodesTable)
        .where(eq(seriesEpisodesTable.seasonId, season.id));
      pendingSeriesEpisodeTargetByChat.set(chatId, currentEpisodes.length);
      await updateChatPreferences(chatId, { pendingAction: "series_add_episodes" });
      await sendMessage(token, chatId, [
        `➕ В сериале сейчас ${currentEpisodes.length} ${currentEpisodes.length === 1 ? "серия" : "серии"}.`,
        "",
        "Сколько серий должно быть всего в сезоне?",
        "Введите число от 1 до 24. Например: 8.",
        "Уже готовые и находящиеся в работе серии сохранятся.",
      ].join("\n"));
    } else if (data === "series:custom_script") {
      pendingCustomScriptByChat.delete(chatId);
      await updateChatPreferences(chatId, { pendingAction: "series_custom_script" });
      await sendMessage(token, chatId, [
        "📝 Пришлите свой сценарий серии несколькими сообщениями или одним большим сообщением.",
        "",
        "Я сохраню вашу историю, разобью текст на сцены, подберу картинки, сделаю озвучку, музыку и монтаж.",
        "Максимальная длительность серии — 3 минуты.",
        "",
        "Можно писать обычным текстом, например от первого лица героя. Технические описания сцен добавлять не нужно.",
        "После последней части нажмите «✅ Сценарий полностью отправлен».",
        "Для отмены отправьте /cancel.",
      ].join("\n"), {
        inline_keyboard: [
          [{ text: "✅ Сценарий полностью отправлен", callback_data: "series:custom_script_done" }],
          [{ text: "❌ Отмена", callback_data: "series:custom_script_cancel" }],
        ],
      });
    } else if (data === "series:custom_script_done") {
      const customScript = pendingCustomScriptByChat.get(chatId)?.trim();
      if (!customScript) {
        await sendMessage(token, chatId, "Сначала отправьте текст сценария, затем нажмите «✅ Сценарий полностью отправлен».");
        return;
      }
      pendingCustomScriptByChat.delete(chatId);
      await updateChatPreferences(chatId, { pendingAction: null });
      try {
        await generateCustomSeriesEpisode(token, chatId, customScript);
      } catch (error) {
        logger.error({ err: error, chatId }, "Failed to create custom series episode");
        await sendMessage(token, chatId, `❌ Не удалось подготовить серию: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
      }
    } else if (data === "series:custom_script_cancel") {
      pendingCustomScriptByChat.delete(chatId);
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMainMenu(token, chatId, "Ввод авторского сценария отменён.");
    } else if (data === "image:add") {
      const projectId = lastProjectByChat.get(chatId);
      if (!projectId) throw new Error("Сначала создайте или откройте черновик сценария.");
      await showImageScenePicker(token, chatId, projectId);
    } else if (data.startsWith("image:scene:")) {
      const projectId = lastProjectByChat.get(chatId);
      const sceneId = Number.parseInt(data.slice("image:scene:".length), 10);
      if (!projectId || !Number.isInteger(sceneId) || sceneId < 1) throw new Error("Сцена не найдена.");
      pendingImageSceneByChat.set(chatId, { projectId, sceneId });
      await updateChatPreferences(chatId, { pendingAction: "image_upload" });
      await sendMessage(token, chatId, `🖼 Отправьте фотографию для сцены ${sceneId} одним сообщением.\n\nОна заменит сгенерированное изображение только в этой сцене.\nДля отмены отправьте /cancel.`);
    } else if (data === "image:cancel") {
      pendingImageSceneByChat.delete(chatId);
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMainMenu(token, chatId, "Добавление изображения отменено.");
    } else if (data === "series:episode:continue") {
      const preferences = await getChatPreferences(chatId);
      if (!preferences.activeSeriesId) throw new Error("Активный сериал не найден.");
      const [season] = await db.select({ id: seasonsTable.id })
        .from(seasonsTable)
        .where(eq(seasonsTable.seriesId, preferences.activeSeriesId))
        .orderBy(desc(seasonsTable.seasonNumber));
      const [episode] = season
        ? await db.select().from(seriesEpisodesTable)
          .where(and(eq(seriesEpisodesTable.seasonId, season.id), eq(seriesEpisodesTable.status, "draft")))
          .orderBy(desc(seriesEpisodesTable.episodeNumber)).limit(1)
        : [];
      if (!episode?.projectId || !episode.scriptJson) throw new Error("Черновик серии не найден.");
      const [series] = await db.select().from(seriesTable).where(eq(seriesTable.id, preferences.activeSeriesId));
      const script = videoScriptSchema.parse(episode.scriptJson);
      activeSeriesEpisodeByChat.set(chatId, episode.id);
      lastProjectByChat.set(chatId, episode.projectId);
      await sendMessage(token, chatId, [
        `📺 ${series?.title || "Текущий сериал"}`,
        `Серия ${episode.episodeNumber}: ${episode.title}`,
        "",
        formatSeriesEpisodeForTelegram(script),
      ].join("\n"), {
        inline_keyboard: [
          [{ text: "🖼 Добавить изображение к сцене", callback_data: "image:add" }],
          [{ text: "✅ Утвердить серию и запустить производство", callback_data: "series:episode:approve" }],
          [{ text: "✏️ Внести правки", callback_data: "series:episode:edit" }, { text: "🔄 Новый вариант", callback_data: "series:episode:regenerate" }],
        ],
      });
    } else if (data === "series:episode:edit" || data === "series:episode:regenerate") {
      await updateChatPreferences(chatId, { pendingAction: data.endsWith(":edit") ? "draft_edit" : "draft_regenerate" });
      await sendMessage(token, chatId, data.endsWith(":edit")
        ? "✏️ Напишите правки к текущей серии одним сообщением."
        : "🔄 Напишите, что изменить в новом варианте серии.");
    } else if (data === "series:episode:approve") {
      let episodeId = activeSeriesEpisodeByChat.get(chatId);
      if (!episodeId) {
        const preferences = await getChatPreferences(chatId);
        if (preferences.activeSeriesId) {
          const [season] = await db.select({ id: seasonsTable.id }).from(seasonsTable)
            .where(eq(seasonsTable.seriesId, preferences.activeSeriesId))
            .orderBy(desc(seasonsTable.seasonNumber));
          const [draftEpisode] = season
            ? await db.select({ id: seriesEpisodesTable.id }).from(seriesEpisodesTable)
              .where(and(eq(seriesEpisodesTable.seasonId, season.id), eq(seriesEpisodesTable.status, "draft")))
              .orderBy(desc(seriesEpisodesTable.episodeNumber)).limit(1)
            : [];
          episodeId = draftEpisode?.id;
          if (episodeId) activeSeriesEpisodeByChat.set(chatId, episodeId);
        }
      }
      if (!episodeId) throw new Error("Черновик серии не найден.");
      const [episode] = await db.select().from(seriesEpisodesTable).where(eq(seriesEpisodesTable.id, episodeId));
      if (!episode?.projectId) throw new Error("У серии нет проекта.");
      const project = (await db.select().from(projectsTable).where(eq(projectsTable.id, episode.projectId)))[0];
      if (!project || project.status !== "draft") throw new Error("Эта серия уже утверждена или не найдена.");
      const preferences = await getChatPreferences(chatId);
      await db.update(projectsTable).set({ status: "completed" }).where(eq(projectsTable.id, project.id));
      await db.update(seriesEpisodesTable).set({ status: "approved" }).where(eq(seriesEpisodesTable.id, episode.id));
      const [season] = await db.select({ seriesId: seasonsTable.seriesId })
        .from(seasonsTable)
        .where(eq(seasonsTable.id, episode.seasonId));
      if (season) {
        await saveSeriesMemory({
          seriesId: season.seriesId,
          episodeId: episode.id,
          eventType: "episode_approved",
          payload: { projectId: project.id, episodeNumber: episode.episodeNumber },
        });
      }
      const job = await startVideoGeneration(project.id, {
        format: "9:16",
        duration: project.duration,
        style: project.style,
        tone: project.tone,
        voiceId: preferences.voiceId || undefined,
        voiceName: preferences.voiceName || undefined,
        chatId,
      });
      await sendMessage(token, chatId, `✅ Серия ${episode.episodeNumber} утверждена.\n🎬 Производство запущено.\nГотово: ${job.progress}%`);
      runTelegramBackgroundTask(
        monitorVideoJob(token, chatId, project.id, job.id),
        { chatId, projectId: project.id, jobId: job.id },
      );
    } else if (data === "menu:script") {
      await updateChatPreferences(chatId, { pendingAction: "script_instructions" });
      await sendMessage(
        token,
        chatId,
        [
          "📝 Опишите пожелания к сценарию одним сообщением.",
          "",
          "Например:",
          "Сделай историю мрачной, без юмора. Главный герой — молодой курьер. В финале должен быть неожиданный поворот. Без призыва подписаться.",
          "",
          "Для отмены отправьте /cancel.",
        ].join("\n"),
      );
    } else if (data === "draft:edit") {
      if (!lastProjectByChat.has(chatId)) throw new Error("Сначала создайте черновик сценария.");
      await updateChatPreferences(chatId, { pendingAction: "draft_edit" });
      await sendMessage(token, chatId, "✏️ Напишите правки к текущему сценарию одним сообщением. Я обновлю черновик, но пока не запущу озвучку или генерацию видео.\n\nДля отмены отправьте /cancel.");
    } else if (data === "draft:regenerate") {
      const projectId = lastProjectByChat.get(chatId);
      if (!projectId) throw new Error("Сначала создайте черновик сценария.");
      const project = (await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)))[0];
      if (!project) throw new Error("Черновик не найден.");
      await updateChatPreferences(chatId, { pendingAction: "draft_regenerate" });
      await sendMessage(token, chatId, "🔄 Напишите, что изменить в новом варианте сценария.");
    } else if (data === "script:clear") {
      await updateChatPreferences(chatId, { scriptInstructions: null, pendingAction: null });
      await sendMainMenu(token, chatId, "🧹 Пожелания к сценарию сброшены.");
    } else if (data === "menu:voice") {
      await showVoicePage(token, chatId);
    } else if (data === "menu:style") {
      await sendMessage(token, chatId, "🎨 Выберите единый визуальный стиль для сценария, изображений и монтажа.", {
        inline_keyboard: [
          ...Object.entries(STYLE_PRESETS).map(([id, preset]) => [{
            text: `${id === "cinematic_realism" ? "🎬" : id === "dark_thriller" ? "🌑" : id === "comedy" ? "😄" : id === "documentary" ? "📹" : id === "anime" ? "🌸" : "🌃"} ${preset.label}`,
            callback_data: `style:preset:${id}`,
          }]),
          [{ text: "✍️ Свой визуальный стиль", callback_data: "style:custom" }],
          [{ text: "⬅️ Настройки", callback_data: "menu:settings" }],
        ],
      });
    } else if (data.startsWith("style:preset:")) {
      const presetId = data.slice("style:preset:".length);
      if (!(presetId in STYLE_PRESETS)) throw new Error("Неизвестный стиль");
      const preset = STYLE_PRESETS[presetId as StylePresetId];
      await updateChatPreferences(chatId, {
        stylePreset: presetId,
        customStyle: null,
        tone: preset.tone,
        pendingAction: null,
      });
      await showSettings(token, chatId);
    } else if (data === "style:custom") {
      await updateChatPreferences(chatId, { pendingAction: "custom_style" });
      await sendMessage(token, chatId, "✍️ Опишите свой визуальный стиль одним сообщением.\n\nНапример: стоп-моушен из бумаги, тёплые пастельные цвета, мягкий свет.\n\nДля отмены отправьте /cancel.");
    } else if (data === "menu:tone") {
      const tones: Array<[ToneId, string]> = [
        ["suspense", "Напряжённое"],
        ["funny", "Комедийное"],
        ["emotional", "Эмоциональное"],
        ["educational", "Познавательное"],
        ["intriguing", "Загадочное"],
      ];
      await sendMessage(token, chatId, "🎭 Выберите настроение повествования.", {
        inline_keyboard: [
          ...tones.map(([id, label]) => [{ text: label, callback_data: `tone:${id}` }]),
          [{ text: "⬅️ Настройки", callback_data: "menu:settings" }],
        ],
      });
    } else if (data.startsWith("tone:")) {
      const tone = data.slice("tone:".length) as ToneId;
      if (!["suspense", "funny", "emotional", "educational", "intriguing"].includes(tone)) {
        throw new Error("Неизвестное настроение");
      }
      await updateChatPreferences(chatId, { tone, pendingAction: null });
      await showSettings(token, chatId);
    } else if (data === "menu:duration") {
      await sendMessage(token, chatId, "⏱ Выберите длительность ролика.", {
        inline_keyboard: [
          [
            { text: "30 секунд", callback_data: "duration:30" },
            { text: "60 секунд", callback_data: "duration:60" },
            { text: "90 секунд", callback_data: "duration:90" },
            { text: "120 секунд", callback_data: "duration:120" },
            { text: "180 секунд", callback_data: "duration:180" },
          ],
          [{ text: "⬅️ Настройки", callback_data: "menu:settings" }],
        ],
      });
    } else if (data.startsWith("duration:")) {
      const duration = Number.parseInt(data.slice("duration:".length), 10);
      if (![30, 60, 90, 120, 180].includes(duration)) throw new Error("Недоступная длительность");
      await updateChatPreferences(chatId, { duration, pendingAction: null });
      await showSettings(token, chatId);
    } else if (data === "menu:platform") {
      await sendMessage(token, chatId, "📱 Выберите платформу. Все варианты используют вертикальный формат 9:16, но сценарий будет адаптирован под привычки аудитории платформы.", {
        inline_keyboard: [
          ...Object.entries(PLATFORM_PRESETS).map(([id, platform]) => [{
            text: platform.label,
            callback_data: `platform:${id}`,
          }]),
          [{ text: "⬅️ Настройки", callback_data: "menu:settings" }],
        ],
      });
    } else if (data.startsWith("platform:")) {
      const platformId = data.slice("platform:".length);
      if (!(platformId in PLATFORM_PRESETS)) throw new Error("Неизвестная платформа");
      await updateChatPreferences(chatId, {
        platform: PLATFORM_PRESETS[platformId as PlatformId].format,
        ...(platformId === "chat" ? { duration: 30 } : {}),
        pendingAction: null,
      });
      await showSettings(token, chatId);
    } else if (data.startsWith("voice:page:")) {
      const page = Number.parseInt(data.slice("voice:page:".length), 10);
      await showVoicePage(token, chatId, Number.isFinite(page) ? page : 0);
    } else if (data.startsWith("voice:set:")) {
      const voiceId = data.slice("voice:set:".length);
      const voice = (await loadVoiceOptions()).find((item) => item.id === voiceId);
      if (!voice) throw new Error("Этот голос больше недоступен. Обновите список.");
      await updateChatPreferences(chatId, {
        voiceId: voice.id,
        voiceName: voice.name,
        pendingAction: null,
      });
      const languageWarning = voice.language && !/(ru|russian|рус)/iu.test(voice.language)
        ? "\n\n⚠️ Этот voice не помечен как русскоязычный. Для русского текста может сохраниться иностранное произношение. Для Chris особенно рекомендую проверить preview перед запуском."
        : "";
      await sendMainMenu(token, chatId, `✅ Выбран голос: ${voice.name}${languageWarning}`);
    } else if (data.startsWith("voice:preview:")) {
      const voiceId = data.slice("voice:preview:".length);
      const voice = (await loadVoiceOptions()).find((item) => item.id === voiceId);
      if (!voice?.previewUrl) throw new Error("Preview этого голоса недоступен.");
      await telegramRequest<TelegramMessage>(token, "sendAudio", {
        chat_id: chatId,
        audio: voice.previewUrl,
        title: `Preview: ${voice.name}`,
      });
    } else if (data === "voice:auto") {
      await updateChatPreferences(chatId, { voiceId: null, voiceName: null, pendingAction: null });
      await sendMainMenu(token, chatId, "🤖 Включён автоматический выбор голоса.");
    } else if (data === "menu:settings") {
      await showSettings(token, chatId);
    } else if (data === "menu:youtube_channels") {
      await showYoutubeChannels(token, chatId);
    } else if (data === "menu:instagram_accounts") {
      await showInstagramAccounts(token, chatId);
    } else if (data === "instagram:connect") {
      try {
        const authorizationUrl = createInstagramAuthorizationUrl();
        await sendMessage(token, chatId, "📷 Откройте Instagram и подтвердите подключение аккаунта:", {
          inline_keyboard: [
            [{ text: "🔗 Войти через Instagram", url: authorizationUrl }],
            [{ text: "⬅️ Instagram-аккаунты", callback_data: "menu:instagram_accounts" }],
          ],
        });
      } catch {
        await sendMessage(token, chatId, [
          "📷 Кнопка Instagram уже добавлена.",
          "",
          "Чтобы авторизация заработала, сначала настройте Instagram App ID и App Secret в Secrets проекта.",
        ].join("\n"), {
          inline_keyboard: [[{ text: "⬅️ Instagram-аккаунты", callback_data: "menu:instagram_accounts" }]],
        });
      }
    } else if (data.startsWith("instagram:delete:")) {
      const connectionId = Number.parseInt(data.slice("instagram:delete:".length), 10);
      const account = (await listInstagramConnections()).find((item) => item.id === connectionId);
      if (!account) throw new Error("Instagram-аккаунт не найден.");
      await sendMessage(token, chatId, `Удалить Instagram-аккаунт «${account.username ? `@${account.username}` : account.displayName || "без названия"}»?`, {
        inline_keyboard: [
          [{ text: "🗑 Да, удалить", callback_data: `instagram:delete_confirm:${connectionId}` }],
          [{ text: "Отмена", callback_data: "menu:instagram_accounts" }],
        ],
      });
    } else if (data.startsWith("instagram:delete_confirm:")) {
      const connectionId = Number.parseInt(data.slice("instagram:delete_confirm:".length), 10);
      const account = (await listInstagramConnections()).find((item) => item.id === connectionId);
      if (!account) throw new Error("Instagram-аккаунт уже удалён или не найден.");
      await db.delete(instagramConnectionsTable).where(eq(instagramConnectionsTable.id, connectionId));
      await showInstagramAccounts(token, chatId, `✅ Instagram-аккаунт «${account.username ? `@${account.username}` : account.displayName || "без названия"}» удалён.`);
    } else if (data === "youtube:sync") {
      await sendMessage(token, chatId, "🔄 Запрашиваю список каналов у YouTube…");
      const preferences = await getChatPreferences(chatId);
      const connections = await syncYoutubeChannels(preferences.activeYoutubeConnectionId || undefined);
      const names = connections.map((connection) => connection.channelTitle || "без названия");
      await showYoutubeChannels(
        token,
        chatId,
        names.length
          ? `✅ Синхронизация завершена. Google вернул каналов: ${names.length}\n\n${names.join("\n")}`
          : "⚠️ Google не вернул ни одного канала.",
      );
    } else if (data.startsWith("youtube:select:")) {
      const connectionId = Number.parseInt(data.slice("youtube:select:".length), 10);
      const connection = (await listYoutubeConnections()).find((item) => item.id === connectionId);
      if (!connection) throw new Error("Канал не найден.");
      await updateChatPreferences(chatId, { activeYoutubeConnectionId: connection.id, pendingAction: null });
      await sendMainMenu(token, chatId, `✅ Активный канал: ${connection.channelTitle || "без названия"}`);
    } else if (data.startsWith("youtube:delete:")) {
      const connectionId = Number.parseInt(data.slice("youtube:delete:".length), 10);
      const connection = (await listYoutubeConnections()).find((item) => item.id === connectionId);
      if (!connection) throw new Error("Канал не найден.");
      await sendMessage(token, chatId, `Удалить подключение канала «${connection.channelTitle || "без названия"}»?`, {
        inline_keyboard: [
          [{ text: "🗑 Да, удалить", callback_data: `youtube:delete_confirm:${connection.id}` }],
          [{ text: "Отмена", callback_data: "menu:youtube_channels" }],
        ],
      });
    } else if (data.startsWith("youtube:delete_confirm:")) {
      const connectionId = Number.parseInt(data.slice("youtube:delete_confirm:".length), 10);
      const connection = (await listYoutubeConnections()).find((item) => item.id === connectionId);
      if (!connection) throw new Error("Канал уже удалён или не найден.");
      const preferences = await getChatPreferences(chatId);
      await db.delete(youtubeConnectionsTable).where(eq(youtubeConnectionsTable.id, connectionId));
      if (preferences.activeYoutubeConnectionId === connectionId) {
        const remaining = await listYoutubeConnections();
        await updateChatPreferences(chatId, {
          activeYoutubeConnectionId: remaining[0]?.id || null,
          pendingAction: null,
        });
      }
      await showYoutubeChannels(token, chatId, `✅ Канал «${connection.channelTitle || "без названия"}» удалён.`);
    } else if (data === "menu:youtube") {
      await prepareYoutubePublication(token, chatId);
    } else if (data === "youtube:edit") {
      if (!pendingYoutubeByChat.has(chatId)) {
        const restored = await restorePendingYoutubePublication(chatId);
        if (!restored) await prepareYoutubePublication(token, chatId);
      }
      await updateChatPreferences(chatId, { pendingAction: "youtube_edit" });
      await sendMessage(
        token,
        chatId,
        [
          "✏️ Отправьте новые данные для YouTube.",
          "",
          "Формат:",
          "Заголовок: новый заголовок",
          "Описание: новое описание",
          "Теги: тег 1, тег 2, тег 3",
          "",
          "Можно изменить только нужные поля — остальные сохранятся.",
          "Для отмены отправьте /cancel.",
        ].join("\n"),
      );
    } else if (data === "youtube:cancel") {
      pendingYoutubeByChat.delete(chatId);
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMainMenu(token, chatId, "Публикация на YouTube отменена.");
    } else if (data === "youtube:approve") {
      await showYoutubeChannelChoice(token, chatId);
    } else if (
      data === "youtube:target:all"
      || data === "youtube:target:none"
      || data === "youtube:targets:done"
      || data.startsWith("youtube:target:")
    ) {
      const pending = pendingYoutubeByChat.get(chatId);
      if (!pending) throw new Error("Нет публикации для согласования.");
      const connections = await listYoutubeConnections();
      if (data === "youtube:target:all") {
        pending.connectionIds = connections.map((connection) => connection.id);
        await showYoutubeChannelChoice(token, chatId);
      } else if (data === "youtube:target:none") {
        pending.connectionIds = [];
        await showYoutubeChannelChoice(token, chatId);
      } else if (data === "youtube:targets:done") {
        if (!pending.connectionIds.length) throw new Error("Выберите хотя бы один YouTube-канал.");
        await showYoutubePrivacyChoice(token, chatId);
      } else {
        const connectionId = Number.parseInt(data.slice("youtube:target:".length), 10);
        if (!connections.some((connection) => connection.id === connectionId)) throw new Error("Канал не найден.");
        pending.connectionIds = pending.connectionIds.includes(connectionId)
          ? pending.connectionIds.filter((id) => id !== connectionId)
          : [...pending.connectionIds, connectionId];
        await showYoutubeChannelChoice(token, chatId);
      }
    } else if (data === "youtube:privacy:back") {
      await showYoutubePrivacyChoice(token, chatId);
    } else if (data === "youtube:privacy:private" || data === "youtube:privacy:public") {
      const pending = pendingYoutubeByChat.get(chatId);
      if (!pending) throw new Error("Нет публикации для согласования.");
      const privacyStatus = data.endsWith(":public") ? "public" : "private";
      await showYoutubeScheduleChoice(token, chatId, privacyStatus);
    } else if (data.startsWith("youtube:schedule:")) {
      const pending = pendingYoutubeByChat.get(chatId);
      if (!pending) throw new Error("Нет публикации для согласования.");
      const delayMinutes = Number.parseInt(data.slice("youtube:schedule:".length), 10);
      if (![0, 15, 30].includes(delayMinutes)) throw new Error("Недоступный интервал публикации.");
      await sendMessage(
        token,
        chatId,
        delayMinutes
          ? `✅ Публикация поставлена в очередь: ${pending.connectionIds.length} каналов, интервал ${delayMinutes} минут.`
          : `✅ Начинаю публикацию на ${pending.connectionIds.length} канал${pending.connectionIds.length === 1 ? "" : "ах"} сразу.`,
      );
      runTelegramBackgroundTask(
        publishYoutubeToChannels(token, chatId, pending, delayMinutes),
        { chatId, connectionIds: pending.connectionIds, delayMinutes },
      );
    } else if (data === "draft:approve") {
      const projectId = lastProjectByChat.get(chatId);
      if (!projectId) throw new Error("Сначала создайте черновик сценария.");
      const project = (await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)))[0];
      if (!project) throw new Error("Черновик не найден.");
      if (project.status !== "draft") throw new Error("Этот сценарий уже утверждён.");
      const preferences = await getChatPreferences(chatId);
      await db.update(projectsTable).set({ status: "completed" }).where(eq(projectsTable.id, projectId));
      const job = await startVideoGeneration(projectId, {
        format: project.format.toLowerCase().includes("chat")
          ? "Chat 9:16"
          : project.format.toLowerCase().includes("long") ? "16:9" : "9:16",
        duration: project.duration,
        style: project.style,
        tone: project.tone,
        voiceId: preferences.voiceId || undefined,
        voiceName: preferences.voiceName || undefined,
        chatId,
      });
      await sendMessage(token, chatId, `✅ Сценарий утверждён.\n🎬 Pipeline запущен.\nПроект: ${projectId}\nГотово: ${job.progress}%`);
      runTelegramBackgroundTask(
        monitorVideoJob(token, chatId, projectId, job.id),
        { chatId, projectId, jobId: job.id },
      );
    } else if (data.startsWith("video:review:approve:")) {
      const [, , , jobIdText, projectIdText] = data.split(":");
      const jobId = Number.parseInt(jobIdText || "", 10);
      const projectId = Number.parseInt(projectIdText || "", 10);
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      const [job] = await db.select().from(videoGenerationJobsTable).where(and(
        eq(videoGenerationJobsTable.id, jobId),
        eq(videoGenerationJobsTable.projectId, projectId),
        eq(videoGenerationJobsTable.status, "completed"),
      ));
      if (!project || !job?.videoStoragePath) throw new Error("Готовое видео не найдено.");
      const [storyItem] = await db.select().from(storyBatchItemsTable).where(and(
        eq(storyBatchItemsTable.projectId, projectId),
        eq(storyBatchItemsTable.status, "awaiting_review"),
      ));
      if (storyItem) {
        const [storyBatch] = await db.select({ chatId: storyBatchesTable.chatId })
          .from(storyBatchesTable)
          .where(and(
            eq(storyBatchesTable.id, storyItem.batchId),
            eq(storyBatchesTable.chatId, chatId),
          ));
        if (storyBatch) {
          await db.update(storyBatchItemsTable).set({ status: "awaiting_publish", updatedAt: new Date() })
            .where(eq(storyBatchItemsTable.id, storyItem.id));
          await sendMessage(token, chatId, `✅ Вариант истории для «${storyItem.channelTitle}» принят. Выберите публикацию:`, {
            inline_keyboard: [
              [{ text: "🌍 Опубликовать открыто", callback_data: `story:publish:public:${storyItem.id}` }],
              [{ text: "🔒 Опубликовать приватно", callback_data: `story:publish:private:${storyItem.id}` }],
            ],
          });
          return;
        }
      }
      pendingVideoReviewByChat.delete(chatId);
      await sendMessage(token, chatId, "✅ Видео принято. Теперь введите название, описание и данные для публикации вручную.");
      await prepareYoutubePublicationForStorage(
        token,
        chatId,
        job.videoStoragePath,
        project.title,
        typeof project.scriptJson === "string" ? project.scriptJson : JSON.stringify(project.scriptJson || {}),
        project.topic,
        0,
      );
    } else if (data.startsWith("video:review:redo:")) {
      const [, , , jobIdText, projectIdText] = data.split(":");
      const legacyProjectId = !projectIdText ? Number.parseInt(jobIdText || "", 10) : null;
      const projectId = Number.parseInt(projectIdText || "", 10) || legacyProjectId || -1;
      const [project] = await db.select().from(projectsTable).where(and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.status, "completed"),
      ));
      if (!project) throw new Error("Утверждённый проект не найден.");
      const preferences = await getChatPreferences(chatId);
      const job = await startVideoGeneration(projectId, {
        format: project.format.toLowerCase().includes("chat")
          ? "Chat 9:16"
          : project.format.toLowerCase().includes("long") ? "16:9" : "9:16",
        duration: project.duration,
        style: project.style,
        tone: project.tone,
        voiceId: preferences.voiceId || undefined,
        voiceName: preferences.voiceName || undefined,
        chatId,
      });
      await sendMessage(token, chatId, `🔄 Переделываю видео.\n🎬 Pipeline запущен заново.\nПроект: ${projectId}\nГотово: ${job.progress}%`);
      runTelegramBackgroundTask(
        monitorVideoJob(token, chatId, projectId, job.id),
        { chatId, projectId, jobId: job.id },
      );
    } else if (data.startsWith("video:review:my-images:")) {
      const [, , , sourceJobIdText, projectIdText] = data.split(":");
      const sourceJobId = Number.parseInt(sourceJobIdText || "", 10);
      const projectId = Number.parseInt(projectIdText || "", 10);
      const [sourceJob] = await db.select({ id: videoGenerationJobsTable.id })
        .from(videoGenerationJobsTable)
        .where(and(
          eq(videoGenerationJobsTable.id, sourceJobId),
          eq(videoGenerationJobsTable.projectId, projectId),
          eq(videoGenerationJobsTable.status, "completed"),
        ));
      if (!sourceJob) throw new Error("Готовый ролик больше недоступен.");
      const [customImage] = await db.select({ id: generatedImagesTable.id })
        .from(generatedImagesTable)
        .where(and(
          eq(generatedImagesTable.projectId, projectId),
          eq(generatedImagesTable.provider, "telegram-upload"),
          eq(generatedImagesTable.status, "completed"),
          eq(generatedImagesTable.isPrimary, true),
        ))
        .limit(1);
      if (!customImage) throw new Error("Сначала добавьте своё фото хотя бы к одной сцене.");
      const job = await rebuildVideoWithExistingAssets(projectId, sourceJobId);
      pendingVideoReviewByChat.delete(chatId);
      await sendMessage(token, chatId, "🔁 Пересобираю ролик с вашими фото.\nОзвучку, музыку и SFX оставляю без изменений.");
      runTelegramBackgroundTask(
        monitorVideoJob(token, chatId, projectId, job.id),
        { chatId, projectId, jobId: job.id },
      );
    } else if (data.startsWith("video:resume:")) {
      const [, , jobIdText, projectIdText] = data.split(":");
      const jobId = Number.parseInt(jobIdText || "", 10);
      const projectId = Number.parseInt(projectIdText || "", 10);
      const [savedJob] = Number.isInteger(jobId)
        ? await db.select({
          id: videoGenerationJobsTable.id,
          projectId: videoGenerationJobsTable.projectId,
          status: videoGenerationJobsTable.status,
          currentStage: videoGenerationJobsTable.currentStage,
          progress: videoGenerationJobsTable.progress,
          videoStoragePath: videoGenerationJobsTable.videoStoragePath,
        })
          .from(videoGenerationJobsTable)
          .where(eq(videoGenerationJobsTable.id, jobId))
        : [];
      if (!savedJob || savedJob.projectId !== projectId) {
        throw new Error("Pipeline не найден для этого чата.");
      }
      if (savedJob.status === "completed" && savedJob.videoStoragePath) {
        pendingVideoReviewByChat.set(chatId, {
          projectId,
          jobId,
          videoStoragePath: savedJob.videoStoragePath,
        });
        const videoBuffer = await readAudioAsset(savedJob.videoStoragePath);
        await sendVideo(
          token,
          chatId,
          videoBuffer,
          "✅ Этот ролик уже готов. Отправляю MP4 ещё раз.",
          {
            inline_keyboard: [
              [{ text: "🔁 Пересобрать с моими фото", callback_data: `video:review:my-images:${jobId}:${projectId}` }],
              [{ text: "✅ Всё ок — ввести данные публикации", callback_data: `video:review:approve:${jobId}:${projectId}` }],
              [{ text: "🔄 Переделать", callback_data: `video:review:redo:${jobId}:${projectId}` }],
            ],
          },
        );
        return;
      }
      if (savedJob.status !== "failed") {
        await sendMessage(token, chatId, `⏳ Pipeline ещё выполняется: ${savedJob.currentStage || "pending"} · ${savedJob.progress || 0}%.`);
        return;
      }
      const job = await retryVideoGeneration(jobId);
      await sendMessage(token, chatId, `▶️ Продолжаю pipeline с сохранённых результатов.\nСтадия: ${job.currentStage || "pending"}`);
      runTelegramBackgroundTask(
        monitorVideoJob(token, chatId, projectId, job.id),
        { chatId, projectId, jobId: job.id },
      );
    } else {
      throw new Error("Неизвестная кнопка. Откройте меню заново через /start.");
    }
    await answerCallbackQuery(token, callback.id);
  } catch (error) {
    logger.error({ err: error, chatId, callbackData: data }, "Telegram callback handling failed");
    if (data.startsWith("story:publish:") || data.startsWith("story:publish_all:")) {
      const [, , privacy, idText] = data.split(":");
      const id = Number.parseInt(idText || "", 10);
      const retryCallback = data.startsWith("story:publish_all:")
        ? `story:publish_all:${privacy}:${id}`
        : `story:publish:${privacy}:${id}`;
      const retryMarkup = Number.isInteger(id) && ["public", "private"].includes(privacy || "")
        ? { inline_keyboard: [[{ text: "🔁 Повторить публикацию", callback_data: retryCallback }]] }
        : undefined;
      await sendMessage(
        token,
        chatId,
        `❌ Не удалось опубликовать вариант: ${error instanceof Error ? error.message : "неизвестная ошибка"}`,
        retryMarkup,
      ).catch(() => undefined);
    }
    await answerCallbackQuery(
      token,
      callback.id,
      error instanceof Error ? error.message.slice(0, 180) : "Не удалось выполнить действие",
      true,
    ).catch(() => undefined);
  }
}

async function handleUpdate(token: string, update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(token, update);
    return;
  }
  const message = update.message;
  if (!message) return;
  const chatId = message?.chat.id;
  if (chatId === undefined) return;

  const selectedImageUpload = (message.photo?.length
    ? message.photo[message.photo.length - 1]
    : message.document && /^image\//u.test(message.document.mime_type || "")
      ? message.document
      : undefined);
  if (selectedImageUpload) {
    const preferences = await getChatPreferences(chatId);
    if (preferences.pendingAction === "story_banner_upload") {
      await handleUploadedStoryBanner(
        token,
        chatId,
        selectedImageUpload.file_id,
        selectedImageUpload.file_size,
        message.document?.mime_type || "image/jpeg",
        "image",
      );
      return;
    }
    if (preferences.pendingAction === "ad_assets") {
      const session = pendingAdByChat.get(chatId);
      if (!session) {
        await sendMainMenu(token, chatId, "Сессия рекламного конструктора закончилась. Откройте её заново.");
        return;
      }
      try {
        const contentType = message.document?.mime_type || "image/jpeg";
        const buffer = await downloadTelegramFile(token, selectedImageUpload.file_id, selectedImageUpload.file_size);
        const storagePath = await storeUploadedImage(buffer, contentType);
        session.assets.push({
          kind: "image",
          storagePath,
          name: message.document?.file_name || `image-${session.assets.length + 1}`,
        });
        await sendMessage(token, chatId, `✅ Изображение добавлено в рекламный конструктор.\nМатериалов: ${session.assets.length}.`, {
          inline_keyboard: [[{ text: "🧠 Разобрать ТЗ", callback_data: "ad:analyze" }]],
        });
      } catch (error) {
        await sendMessage(token, chatId, `❌ Не удалось добавить изображение: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
      }
      return;
    }
    if (preferences.pendingAction === "cut_banner_upload") {
      await handleUploadedImageCutBanner(
        token,
        chatId,
        selectedImageUpload.file_id,
        selectedImageUpload.file_size,
        message.document?.mime_type || "image/jpeg",
      );
      return;
    }
    if (preferences.pendingAction === "image_upload") {
      await handleUploadedSceneImage(
        token,
        chatId,
        selectedImageUpload.file_id,
        selectedImageUpload.file_size,
        message.document?.mime_type || "image/jpeg",
      );
      return;
    }
  }

  const uploadedVideo = message.video
    || (message.document && (
      message.document.mime_type === "video/mp4"
      || /\.mp4$/iu.test(message.document.file_name || "")
    ) ? message.document : undefined);
  if (uploadedVideo) {
    const videoPreferences = await getChatPreferences(chatId);
    if (videoPreferences.pendingAction === "story_banner_upload") {
      await handleUploadedStoryBanner(
        token,
        chatId,
        uploadedVideo.file_id,
        uploadedVideo.file_size,
        "video/mp4",
        "video",
      );
      return;
    }
    if (videoPreferences.pendingAction === "ad_assets") {
      const session = pendingAdByChat.get(chatId);
      if (!session) {
        await sendMainMenu(token, chatId, "Сессия рекламного конструктора закончилась. Откройте её заново.");
        return;
      }
      if (uploadedVideo.file_size && uploadedVideo.file_size > TELEGRAM_DOWNLOAD_LIMIT_BYTES) {
        const uploadToken = createLargeVideoUploadToken(
          chatId,
          uploadedVideo.file_name,
          message.caption,
          "ad_constructor",
        );
        await sendMessage(token, chatId, "MP4 больше 20 МБ. Загрузите его по защищённой одноразовой ссылке:", {
          inline_keyboard: [[{ text: "📤 Загрузить материал", url: `${uploadBaseUrl()}/api/upload/${uploadToken}` }]],
        });
        return;
      }
      try {
        const buffer = await downloadTelegramVideo(token, uploadedVideo.file_id, uploadedVideo.file_size);
        const storagePath = await storeAudioAsset(buffer, "video", "video/mp4", "mp4");
        session.assets.push({
          kind: "video",
          storagePath,
          name: uploadedVideo.file_name || `video-${session.assets.length + 1}.mp4`,
        });
        await sendMessage(token, chatId, `✅ MP4 добавлен в рекламный конструктор.\nМатериалов: ${session.assets.length}.`, {
          inline_keyboard: [[{ text: "🧠 Разобрать ТЗ", callback_data: "ad:analyze" }]],
        });
      } catch (error) {
        await sendMessage(token, chatId, `❌ Не удалось добавить MP4: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
      }
      return;
    }
    if (videoPreferences.pendingAction === "cut_source_url") {
      await handleUploadedVideoCutSource(
        token,
        chatId,
        uploadedVideo.file_id,
        uploadedVideo.file_size,
      );
      return;
    }
    if (videoPreferences.pendingAction === "cut_banner_upload") {
      await handleUploadedVideoCutBanner(
        token,
        chatId,
        uploadedVideo.file_id,
        uploadedVideo.file_size,
      );
      return;
    }
    if (videoPreferences.pendingAction === "reaction_main_upload") {
      await handleReactionMainVideo(
        token,
        chatId,
        uploadedVideo.file_id,
        uploadedVideo.file_size,
      );
      return;
    }
    if (videoPreferences.pendingAction === "reaction_clip_upload") {
      await handleReactionClip(
        token,
        chatId,
        uploadedVideo.file_id,
        uploadedVideo.file_size,
      );
      return;
    }
    if (videoPreferences.pendingAction === "cut_reaction_clip_upload") {
      await handleCutReactionClip(
        token,
        chatId,
        uploadedVideo.file_id,
        uploadedVideo.file_size,
      );
      return;
    }
    if (videoPreferences.pendingAction === "adapt_video_upload") {
      await updateChatPreferences(chatId, { pendingAction: null });
      await handleAdaptUploadedVideo(
        token,
        chatId,
        uploadedVideo.file_id,
        uploadedVideo.file_name,
        uploadedVideo.file_size,
      );
      return;
    }
    await handleUploadedVideo(
      token,
      chatId,
      uploadedVideo.file_id,
      uploadedVideo.file_name,
      message.caption,
      uploadedVideo.file_size,
    );
    return;
  }

  const text = message.text?.trim();
  if (!text) return;

  if (text === "/start") {
    pendingCustomScriptByChat.delete(chatId);
    pendingAdByChat.delete(chatId);
    pendingCutMetadataByChat.delete(chatId);
    pendingVideoEditByChat.delete(chatId);
    pendingVideoCutEditByChat.delete(chatId);
    pendingVideoCutCountByChat.delete(chatId);
    pendingVideoCutSourceByChat.delete(chatId);
    pendingVideoCutBannerByChat.delete(chatId);
    pendingVideoCutReactionByChat.delete(chatId);
    await updateChatPreferences(chatId, { pendingAction: null });
    await sendMainMenu(
      token,
      chatId,
      [
        "Привет! Я создаю готовые вертикальные видео из одной темы.",
        "",
        "Перед запуском можно задать пожелания к сценарию и выбрать голос ElevenLabs.",
      ].join("\n"),
    );
    return;
  }

  if (text === "/cancel") {
    pendingCustomScriptByChat.delete(chatId);
    pendingCutMetadataByChat.delete(chatId);
    pendingVideoEditByChat.delete(chatId);
    pendingVideoCutEditByChat.delete(chatId);
    pendingVideoCutBatchByChat.delete(chatId);
    pendingVideoCutCountByChat.delete(chatId);
    pendingVideoCutSourceByChat.delete(chatId);
    pendingVideoCutBannerByChat.delete(chatId);
    pendingVideoCutReactionByChat.delete(chatId);
    pendingAdByChat.delete(chatId);
    const activeBatch = await getActiveChatVideoBatch(chatId);
    if (activeBatch) {
      await db.update(chatVideoBatchesTable).set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(chatVideoBatchesTable.id, activeBatch.id));
    }
    await db.update(chatDayBatchesTable).set({ status: "cancelled", updatedAt: new Date() })
      .where(and(
        eq(chatDayBatchesTable.chatId, chatId),
        inArray(chatDayBatchesTable.status, [
          "generating_variants",
          "collecting_scripts",
          "awaiting_review",
          "processing",
          "awaiting_video_review",
          "awaiting_metadata",
          "scheduled",
        ]),
      ));
    await db.update(storyBatchesTable).set({ status: "cancelled", updatedAt: new Date() })
      .where(and(
        eq(storyBatchesTable.chatId, chatId),
        inArray(storyBatchesTable.status, [
          "collecting",
          "choosing_channels",
          "choosing_banner",
          "generating",
          "processing",
          "awaiting_review",
        ]),
      ));
    await updateChatPreferences(chatId, { pendingAction: null });
    await sendMainMenu(token, chatId, "Действие отменено.");
    return;
  }

  if (text === "/готово" || text === "/done") {
    const currentPreferences = await getChatPreferences(chatId);
    if (currentPreferences.pendingAction !== "series_custom_script") {
      await sendMainMenu(token, chatId, "Сейчас нет незавершённого сценария.");
      return;
    }
    const customScript = pendingCustomScriptByChat.get(chatId)?.trim();
    if (!customScript) {
      await sendMessage(token, chatId, "Сначала отправьте текст сценария.");
      return;
    }
    pendingCustomScriptByChat.delete(chatId);
    await updateChatPreferences(chatId, { pendingAction: null });
    try {
      await generateCustomSeriesEpisode(token, chatId, customScript);
    } catch (error) {
      logger.error({ err: error, chatId }, "Failed to create custom series episode");
      await sendMessage(token, chatId, `❌ Не удалось подготовить серию: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
    }
    return;
  }

  if (text === "/settings") {
    await showSettings(token, chatId);
    return;
  }

  if (text === "/voices") {
    try {
      await showVoicePage(token, chatId);
    } catch (error) {
      const message = error instanceof ElevenLabsNotConfiguredError
        ? "ElevenLabs API key не настроен."
        : "Не удалось загрузить список голосов ElevenLabs.";
      await sendMainMenu(token, chatId, message);
    }
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
      runTelegramBackgroundTask(
        monitorImageJob(token, chatId, projectId, ids),
        { chatId, projectId, task: "images" },
      );
    } catch (error) {
      logger.error({ err: error, chatId }, "Failed to start Telegram image generation");
      await sendMessage(token, chatId, "Не удалось запустить генерацию изображений.");
    }
    return;
  }

  if (text === "/voice") {
    const projectId = lastProjectByChat.get(chatId);
    const preferences = await getChatPreferences(chatId);
    const voiceId = preferences.voiceId || process.env["ELEVENLABS_VOICE_ID"];
    if (!projectId) {
      await sendMessage(token, chatId, "Сначала отправьте тему ролика, чтобы создать сценарий.");
      return;
    }
    if (!process.env["ELEVENLABS_API_KEY"]) {
      await sendMessage(token, chatId, "ElevenLabs API key не настроен.");
      return;
    }
    if (!voiceId) {
      await showVoicePage(token, chatId);
      return;
    }
    try {
      const ids = await startProjectVoiceGeneration(projectId, {
        voiceId,
        voiceName: preferences.voiceName,
        modelId: getElevenLabsModel(),
        speed: 0.98,
        stability: 0.72,
        similarity: 0.8,
        style: 0.1,
        speakerBoost: true,
        tone: "storytelling",
      });
      await sendMessage(token, chatId, `Создаю озвучку ElevenLabs...\nГотово: 0/${ids.length}`);
      runTelegramBackgroundTask(
        monitorVoiceJob(token, chatId, projectId, ids),
        { chatId, projectId, task: "voice" },
      );
    } catch (error) {
      logger.error({ err: error, chatId }, "Failed to start Telegram voice generation");
      await sendMessage(token, chatId, "Не удалось запустить генерацию озвучки.");
    }
    return;
  }

  if (text === "/video") {
    await updateChatPreferences(chatId, { pendingAction: "video_topic" });
    await sendMessage(token, chatId, "Отправьте тему будущего ролика следующим сообщением.");
    return;
  }

  if (text.startsWith("/video ")) {
    await updateChatPreferences(chatId, { pendingAction: null });
    await handleVideoTopic(token, chatId, text.slice("/video ".length).trim());
    return;
  }

  if (/^сделать\s+edit$/iu.test(text)) {
    const cutMetadataSession = pendingCutMetadataByChat.get(chatId);
    if (cutMetadataSession) {
      await beginVideoCutEdit(token, chatId, cutMetadataSession.batchId);
    } else {
      await beginVideoEdit(token, chatId);
    }
    return;
  }

  if (text.startsWith("/")) {
    await sendMainMenu(token, chatId, "Неизвестная команда. Используйте кнопки меню или отправьте тему ролика.");
    return;
  }

  const preferences = await getChatPreferences(chatId);
  if (preferences.pendingAction === "ad_brief") {
    const session = pendingAdByChat.get(chatId) || { brief: "", assets: [] };
    if (text.length < 10) {
      await sendMessage(token, chatId, "Опишите задачу подробнее: продукт, аудитория, цель и желаемый результат.");
      return;
    }
    session.brief = text.slice(0, 12_000);
    pendingAdByChat.set(chatId, session);
    await showAdAssetsPrompt(token, chatId);
    return;
  }
  if (preferences.pendingAction === "ad_assets") {
    await sendMessage(token, chatId, "Пришлите изображение или MP4, либо нажмите «Разобрать ТЗ», когда материалы закончены.");
    return;
  }
  if (preferences.pendingAction === "cut_edit_focus") {
    const session = pendingVideoCutEditByChat.get(chatId);
    if (!session?.options) {
      await sendMessage(token, chatId, "Сессия edit нарезок закончилась. Отправьте исходное видео заново.");
      return;
    }
    const focusLabel = text.trim().slice(0, 80);
    if (!focusLabel) {
      await sendMessage(token, chatId, "Напишите, кого или что выделить, либо нажмите «Без подписи».");
      return;
    }
    session.options.focusLabel = focusLabel;
    await updateChatPreferences(chatId, { pendingAction: null });
    runTelegramBackgroundTask(
      runVideoCutEdit(token, chatId, session.batchId),
      { chatId, batchId: session.batchId, task: "video-cut-edit" },
    );
    return;
  }
  if (preferences.pendingAction === "edit_focus") {
    const session = pendingVideoEditByChat.get(chatId);
    if (!session?.options) {
      await sendMessage(token, chatId, "Сессия edit закончилась. Отправьте видео заново.");
      return;
    }
    const focusLabel = text.trim().slice(0, 80);
    if (!focusLabel) {
      await sendMessage(token, chatId, "Напишите, кого или что выделить, либо нажмите «Без подписи».");
      return;
    }
    session.options.focusLabel = focusLabel;
    await updateChatPreferences(chatId, { pendingAction: null });
    runTelegramBackgroundTask(runVideoEdit(token, chatId), { chatId, task: "video-edit" });
    return;
  }
  if (preferences.pendingAction === "cut_source_url") {
    const banner = pendingVideoCutBannerByChat.get(chatId);
    const urlText = text.match(/https?:\/\/\S+/iu)?.[0]?.replace(/[),.;]+$/u, "") || text;
    try {
      const parsed = new URL(urlText);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Поддерживаются только http/https-ссылки.");
    } catch (error) {
      await sendMessage(token, chatId, `❌ Это не похоже на публичную ссылку на видео: ${error instanceof Error ? error.message : "проверьте URL"}\n\nОтправьте ссылку ещё раз или используйте /cancel.`);
      return;
    }
    pendingVideoCutSourceByChat.set(chatId, {
      sourceUrl: urlText,
      connectionIds: [],
      banner,
    });
    await updateChatPreferences(chatId, { pendingAction: "cut_channel_choice" });
    await showVideoCutChannelChoice(token, chatId);
    return;
  }
  if (preferences.pendingAction === "story_title") {
    const batch = await getActiveStoryBatch(chatId);
    if (!batch || batch.status !== "collecting") {
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMainMenu(token, chatId, "Черновик истории не найден. Откройте раздел заново.");
      return;
    }
    if (text.length < 2 || text.length > 180) {
      await sendMessage(token, chatId, "Название должно быть длиной от 2 до 180 символов. Отправьте его ещё раз.");
      return;
    }
    await db.update(storyBatchesTable).set({
      title: text,
      updatedAt: new Date(),
    }).where(eq(storyBatchesTable.id, batch.id));
    await updateChatPreferences(chatId, { pendingAction: "story_script" });
    await sendMessage(token, chatId, [
      "✅ Название сохранено.",
      "",
      "Теперь отправьте исходный сценарий одним сообщением.",
      "Я сохраню его смысл, слегка изменю формулировки, имена и второстепенные детали для каждого выбранного канала.",
      "Можно отправить обычный рассказ, диалоги и ремарки. Отдельно озвучиваться будут только произносимые части.",
      "",
      "Для отмены отправьте /cancel.",
    ].join("\n"));
    return;
  }
  if (preferences.pendingAction === "story_script") {
    const batch = await getActiveStoryBatch(chatId);
    if (!batch || batch.status !== "collecting") {
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMainMenu(token, chatId, "Черновик истории не найден. Откройте раздел заново.");
      return;
    }
    if (text.length < 20 || text.length > STORY_CUSTOM_SCRIPT_MAX_CHARS) {
      await sendMessage(token, chatId, `Сценарий должен быть от 20 до ${STORY_CUSTOM_SCRIPT_MAX_CHARS.toLocaleString("ru-RU")} символов.`);
      return;
    }
    const banner = await getDefaultVideoCutBanner();
    if (!banner) {
      await sendMessage(token, chatId, "❌ Стандартный NOX-баннер недоступен. Сценарий сохранён, но запуск остановлен.");
      return;
    }
    await db.update(storyBatchesTable).set({
      baseScript: text,
      bannerStoragePath: banner.storagePath,
      bannerKind: banner.kind,
      status: "choosing_banner",
      updatedAt: new Date(),
    }).where(eq(storyBatchesTable.id, batch.id));
    await updateChatPreferences(chatId, { pendingAction: null });
    await sendMessage(token, chatId, "✅ Исходный сценарий принят. NOX-баннер добавлю автоматически. Начинаю подготовку первого выбранного канала.");
    runStoryBatchGenerationInBackground(token, chatId, batch.id);
    return;
  }
  if (preferences.pendingAction === "chat_day_script") {
    await updateChatPreferences(chatId, { pendingAction: null });
    try {
      await sendMessage(token, chatId, "☀️ Сценарий принят. Готовлю пять похожих, но разных вариантов…");
      await createChatDayBatchFromScript(token, chatId, text);
    } catch (error) {
      logger.error({ err: error, chatId }, "Failed to create chat day batch");
      await sendMessage(token, chatId, `❌ Не удалось подготовить дневной пакет: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
    }
    return;
  }
  if (preferences.pendingAction === "chat_day_manual_script") {
    const batch = await getActiveChatDayBatch(chatId, ["collecting_scripts"]);
    if (!batch) {
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMainMenu(token, chatId, "Пакет сценариев не найден. Начните подготовку заново.");
      return;
    }
    if (text.length > CHAT_CUSTOM_SCRIPT_MAX_CHARS) {
      await sendMessage(token, chatId, `Сценарий слишком длинный. Максимум ${CHAT_CUSTOM_SCRIPT_MAX_CHARS.toLocaleString("ru-RU")} символов.`);
      return;
    }
    const messages = parseCustomChatScript(text, 24);
    if (messages.length < 2) {
      await sendMessage(token, chatId, "В каждом сценарии нужно минимум две реплики. Отправьте полный сценарий ещё раз.");
      return;
    }
    const existingItems = await db.select({ sequence: chatDayBatchItemsTable.sequence })
      .from(chatDayBatchItemsTable)
      .where(eq(chatDayBatchItemsTable.batchId, batch.id));
    const sequence = existingItems.length + 1;
    if (sequence > 5) {
      await sendMessage(token, chatId, "Все пять сценариев уже получены. Подготавливаю видео.");
      return;
    }
    await db.insert(chatDayBatchItemsTable).values({
      batchId: batch.id,
      sequence,
      scriptText: text,
      status: "pending",
    });
    await db.update(chatDayBatchesTable).set({
      currentIndex: sequence,
      baseScript: sequence === 1 ? text : batch.baseScript,
      updatedAt: new Date(),
    }).where(eq(chatDayBatchesTable.id, batch.id));
    if (sequence < 5) {
      await sendMessage(token, chatId, `✅ Сценарий видео ${sequence}/5 принят.\n\nТеперь отправьте сценарий видео ${sequence + 1}/5.`);
    } else {
      await db.update(chatDayBatchesTable).set({ status: "processing", updatedAt: new Date() })
        .where(eq(chatDayBatchesTable.id, batch.id));
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMessage(token, chatId, "✅ Все пять сценариев приняты. Начинаю последовательно готовить пять видео.");
      runTelegramBackgroundTask(
        runChatDayBatch(token, chatId, batch.id),
        { chatId, batchId: batch.id, task: "chat-day-manual-video-batch" },
      );
    }
    return;
  }
  if (preferences.pendingAction === "series_custom_script") {
    const accumulated = pendingCustomScriptByChat.get(chatId) || "";
    const combined = accumulated ? `${accumulated}\n\n${text}` : text;
    if (combined.length > 20_000) {
      await sendMessage(token, chatId, "Текст сценария слишком длинный. Максимум 20 000 символов для одной серии.");
      return;
    }
    pendingCustomScriptByChat.set(chatId, combined);
    await sendMessage(token, chatId, [
      `✅ Получил часть сценария (${combined.length.toLocaleString("ru-RU")} символов).`,
      "Отправляйте продолжение или нажмите «✅ Сценарий полностью отправлен».",
    ].join("\n"), {
      inline_keyboard: [
        [{ text: "✅ Сценарий полностью отправлен", callback_data: "series:custom_script_done" }],
        [{ text: "❌ Отмена", callback_data: "menu:series" }],
      ],
    });
    return;
  }
  if (preferences.pendingAction === "chat_day_metadata") {
    const batch = await getActiveChatDayBatch(chatId, ["awaiting_metadata"]);
    if (!batch) {
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMainMenu(token, chatId, "Данные дневного пакета устарели. Начните подготовку заново.");
      return;
    }
    try {
      await collectChatDayMetadata(token, chatId, batch.id, text);
    } catch (error) {
      await sendMessage(token, chatId, `❌ Не удалось сохранить данные: ${error instanceof Error ? error.message : "неизвестная ошибка"}\n\nПроверьте формат и отправьте данные этого выпуска ещё раз.`);
    }
    return;
  }
  if (preferences.pendingAction === "batch_count") {
    const count = Number.parseInt(text, 10);
    if (!/^\d+$/.test(text) || count < 2 || count > 20) {
      await sendMessage(token, chatId, "Введите целое число от 2 до 20.");
      return;
    }
    const existing = await getActiveChatVideoBatch(chatId, ["collecting"]);
    if (existing) {
      await sendMessage(token, chatId, `У вас уже собирается пакет из ${existing.totalCount} роликов. Продолжите его или отправьте /cancel.`);
      return;
    }
    const [batch] = await db.insert(chatVideoBatchesTable).values({
      chatId,
      totalCount: count,
      currentIndex: 0,
      status: "collecting",
    }).returning();
    await updateChatPreferences(chatId, { pendingAction: "chat_batch_duration" });
    await sendMessage(token, chatId, `📦 Пакет из ${count} роликов создан.\n\nВыберите длительность каждого ролика:`, {
      inline_keyboard: [
        [{ text: "30 сек", callback_data: "chat_batch_duration:30" }, { text: "60 сек", callback_data: "chat_batch_duration:60" }],
        [{ text: "90 сек", callback_data: "chat_batch_duration:90" }, { text: "120 сек", callback_data: "chat_batch_duration:120" }],
        [{ text: "❌ Отменить", callback_data: `chat_batch:cancel:${batch.id}` }],
      ],
    });
    return;
  }
  if (preferences.pendingAction === "batch_script") {
    const batch = await getActiveChatVideoBatch(chatId, ["collecting"]);
    if (!batch) {
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMainMenu(token, chatId, "Пакет не найден. Начните пакетную подготовку заново.");
      return;
    }
    if (text.length > CHAT_CUSTOM_SCRIPT_MAX_CHARS) {
      await sendMessage(token, chatId, `Сценарий слишком длинный. Максимум ${CHAT_CUSTOM_SCRIPT_MAX_CHARS.toLocaleString("ru-RU")} символов.`);
      return;
    }
    const messages = parseCustomChatScript(text, 24);
    if (messages.length < 2) {
      await sendMessage(token, chatId, "В сценарии нужно минимум две реплики. Используйте «Аноним: …» и «Собеседник: …».");
      return;
    }
    const existingItems = await db.select({ sequence: chatVideoBatchItemsTable.sequence })
      .from(chatVideoBatchItemsTable)
      .where(eq(chatVideoBatchItemsTable.batchId, batch.id));
    const sequence = existingItems.length + 1;
    await db.insert(chatVideoBatchItemsTable).values({
      batchId: batch.id,
      sequence,
      scriptText: text,
      status: "pending",
    });
    if (sequence < batch.totalCount) {
      await sendMessage(token, chatId, `✅ Сценарий ${sequence}/${batch.totalCount} принят.\n\nОтправьте следующий сценарий ${sequence + 1}/${batch.totalCount}.`);
    } else {
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendChatBatchPreview(token, chatId, batch.id);
    }
    return;
  }
  if (preferences.pendingAction === "chat_custom_script") {
    await updateChatPreferences(chatId, { pendingAction: null });
    await handleCustomChatScript(token, chatId, text);
    return;
  }
  if (preferences.pendingAction === "cta_profile_preview") {
    await sendMessage(token, chatId, "Используйте кнопки под предпросмотром: сохраните CTA или отмените изменения.");
    return;
  }
  if (preferences.pendingAction === "cta_profile_edit") {
    const profileId = pendingCtaEditByChat.get(chatId);
    if (!profileId) {
      await updateChatPreferences(chatId, { pendingAction: null });
      await showCtaProfiles(token, chatId);
      return;
    }
    const [existing] = await db.select().from(ctaProfilesTable)
      .where(and(eq(ctaProfilesTable.id, profileId), eq(ctaProfilesTable.chatId, chatId)));
    if (!existing) {
      pendingCtaEditByChat.delete(chatId);
      await updateChatPreferences(chatId, { pendingAction: null });
      await showCtaProfiles(token, chatId);
      return;
    }
    const updated = parseCtaProfileInput(text);
    const [saved] = await db.update(ctaProfilesTable).set({
      name: updated.name,
      city: updated.city,
      profession: updated.profession,
      ctaText: updated.ctaText,
      telegramUrl: updated.telegramUrl,
      placement: updated.placement,
      updatedAt: new Date(),
    }).where(and(eq(ctaProfilesTable.id, profileId), eq(ctaProfilesTable.chatId, chatId))).returning();
    pendingCtaEditByChat.delete(chatId);
    await updateChatPreferences(chatId, { pendingAction: null });
    await sendMainMenu(token, chatId, `✅ CTA-профиль «${saved.name}» обновлён. Уже созданные сериалы не изменены.`);
    return;
  }
  if (preferences.pendingAction === "cta_profile") {
    await updateChatPreferences(chatId, { pendingAction: null });
    await handleCtaProfileInput(token, chatId, text);
    return;
  }
  if (preferences.pendingAction === "series_prompt" || preferences.pendingAction === "series_edit") {
    if (preferences.pendingAction === "series_prompt") {
      pendingSeriesTitleByChat.set(chatId, text.trim());
      await updateChatPreferences(chatId, { pendingAction: "series_episode_count" });
      await sendMessage(token, chatId, "🔢 Сколько серий должно быть в первом сезоне?\n\nВведите число от 1 до 24, например: 8.");
    } else {
      await updateChatPreferences(chatId, { pendingAction: null });
      const prompt = `Обнови текущую концепцию сериала. Сохрани удачные элементы, но учти правки пользователя: ${text}`;
      await handleSeriesPrompt(token, chatId, prompt);
    }
    return;
  }
  if (preferences.pendingAction === "series_episode_count") {
    const episodeCount = Number.parseInt(text.trim(), 10);
    if (!/^\d+$/u.test(text.trim()) || episodeCount < 1 || episodeCount > 24) {
      await sendMessage(token, chatId, "Введите целое число от 1 до 24. Например: 8.");
      return;
    }
    const title = pendingSeriesTitleByChat.get(chatId);
    if (!title) {
      await updateChatPreferences(chatId, { pendingAction: "series_prompt" });
      await sendMessage(token, chatId, "Название сериала потерялось. Отправьте его ещё раз.");
      return;
    }
    await updateChatPreferences(chatId, { pendingAction: null });
    await sendMessage(token, chatId, `⏳ Создаю сериал «${title}» на ${episodeCount} серий…`);
    await saveSeriesTitleOnly(chatId, title, episodeCount);
    await showActiveSeriesMenu(token, chatId);
    return;
  }
  if (preferences.pendingAction === "series_add_episodes") {
    const targetCount = Number.parseInt(text.trim(), 10);
    if (!/^\d+$/u.test(text.trim()) || targetCount < 1 || targetCount > 24) {
      await sendMessage(token, chatId, "Введите целое число от 1 до 24. Например: 8.");
      return;
    }
    const currentCount = pendingSeriesEpisodeTargetByChat.get(chatId) || 0;
    if (targetCount <= currentCount) {
      await updateChatPreferences(chatId, { pendingAction: null });
      pendingSeriesEpisodeTargetByChat.delete(chatId);
      await sendMessage(token, chatId, `В сезоне уже ${currentCount} ${currentCount === 1 ? "серия" : "серии"}. Укажите число больше ${currentCount}, если хотите добавить новые.`);
      await showActiveSeriesMenu(token, chatId);
      return;
    }
    await updateChatPreferences(chatId, { pendingAction: null });
    pendingSeriesEpisodeTargetByChat.delete(chatId);
    const addedCount = await addEpisodesToActiveSeason(chatId, targetCount);
    await sendMessage(token, chatId, `✅ Добавлено серий: ${addedCount}. Теперь в сезоне ${targetCount} серий.\nМожно нажать «📝 Мой сценарий», чтобы написать серию ${currentCount + 1}.`);
    await showActiveSeriesMenu(token, chatId);
    return;
  }
  if (preferences.pendingAction === "long_video_prompt") {
    await updateChatPreferences(chatId, { pendingAction: null });
    await handleLongVideoPrompt(token, chatId, text);
    return;
  }
  if (preferences.pendingAction === "draft_edit" || preferences.pendingAction === "draft_regenerate") {
    const projectId = lastProjectByChat.get(chatId);
    if (!projectId) {
      await sendMainMenu(token, chatId, "Черновик не найден. Сначала создайте новую тему.");
      return;
    }
    const project = (await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)))[0];
    if (!project) {
      await sendMainMenu(token, chatId, "Черновик не найден. Сначала создайте новую тему.");
      return;
    }
    try {
      await sendMessage(token, chatId, "🔄 Обновляю черновик сценария. Озвучка и видео пока не запускаются…");
      const seriesEpisodeId = activeSeriesEpisodeByChat.get(chatId);
      const [seriesEpisode] = seriesEpisodeId
        ? await db.select().from(seriesEpisodesTable).where(eq(seriesEpisodesTable.id, seriesEpisodeId))
        : [];
      const [series] = seriesEpisode
        ? await db.select().from(seriesTable)
          .where(eq(seriesTable.id, preferences.activeSeriesId || -1))
        : [];
      const revised = await generateVideoScript({
        topic: project.topic,
        format: project.format,
         duration: project.duration,
        style: project.style,
        tone: project.tone,
        instructions: [
          preferences.scriptInstructions || "",
          "Текущая версия сценария уже была показана пользователю.",
          `Пользовательские правки к текущей версии: ${text}`,
          "Сохрани удачные части текущей версии и внеси только логичные правки.",
          series ? `Это серия сериала. Сохрани continuity библии и предыдущих событий:\n${JSON.stringify(series.bibleJson)}` : "",
        ].filter(Boolean).join("\n\n"),
      });
      await db.update(projectsTable).set({ title: revised.title, scriptJson: revised, status: "draft" }).where(eq(projectsTable.id, projectId));
      await updateChatPreferences(chatId, { pendingAction: null });
      const seriesButtons = seriesEpisode
        ? [
            [{ text: "🖼 Добавить изображение к сцене", callback_data: "image:add" }],
            [{ text: "✅ Утвердить серию и запустить производство", callback_data: "series:episode:approve" }],
            [{ text: "✏️ Внести правки", callback_data: "series:episode:edit" }, { text: "🔄 Новый вариант", callback_data: "series:episode:regenerate" }],
          ]
        : [
            [{ text: "🖼 Добавить изображение к сцене", callback_data: "image:add" }],
            [{ text: "✅ Утвердить и создать видео", callback_data: "draft:approve" }],
            [{ text: "✏️ Внести правки", callback_data: "draft:edit" }, { text: "🔄 Новый вариант", callback_data: "draft:regenerate" }],
          ];
      await sendMessage(token, chatId, seriesEpisode
        ? formatSeriesEpisodeForTelegram(revised)
        : formatScriptForTelegram(revised), {
        inline_keyboard: seriesButtons,
      });
    } catch (error) {
      logger.error({ err: error, chatId, projectId }, "Failed to revise Telegram script draft");
      await sendMessage(token, chatId, "Не удалось обновить черновик. Попробуйте ещё раз.");
    }
    return;
  }
  if (preferences.pendingAction === "script_instructions") {
    if (text.length > MAX_SCRIPT_INSTRUCTIONS) {
      await sendMessage(token, chatId, `Пожелания слишком длинные. Максимум ${MAX_SCRIPT_INSTRUCTIONS} символов.`);
      return;
    }
    await updateChatPreferences(chatId, {
      scriptInstructions: text,
      pendingAction: null,
    });
    await sendMainMenu(token, chatId, `✅ Пожелания сохранены:\n${summarizeInstructions(text)}`);
    return;
  }
  if (preferences.pendingAction === "custom_style") {
    if (text.length > 500) {
      await sendMessage(token, chatId, "Описание стиля слишком длинное. Максимум 500 символов.");
      return;
    }
    await updateChatPreferences(chatId, {
      customStyle: text,
      stylePreset: null,
      pendingAction: null,
    });
    await showSettings(token, chatId);
    return;
  }
  if (
    preferences.pendingAction === "cut_metadata_title"
    || preferences.pendingAction === "cut_metadata_description"
    || preferences.pendingAction === "cut_metadata_tags"
  ) {
    const session = pendingCutMetadataByChat.get(chatId);
    const batch = session && pendingVideoCutBatchByChat.get(chatId);
    const sequence = session?.sequences[session.index];
    if (!session || !batch || batch.id !== session.batchId || !sequence) {
      pendingCutMetadataByChat.delete(chatId);
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMainMenu(token, chatId, "Сессия SEO нарезки закончилась. Запусти нарезку заново.");
      return;
    }
    const current = session.metadataBySequence.get(sequence) || {
      title: "",
      description: "",
      tags: [],
      hashtags: [],
    };
    if (preferences.pendingAction === "cut_metadata_title") {
      current.title = text.slice(0, 100).trim();
      if (!current.title) {
        await sendMessage(token, chatId, "Название не может быть пустым. Напишите название ролика ещё раз.");
        return;
      }
      session.metadataBySequence.set(sequence, current);
      await sendCutMetadataPrompt(token, chatId);
      return;
    }
    if (preferences.pendingAction === "cut_metadata_description") {
      current.description = text.slice(0, 5000).trim();
      if (!current.description) {
        await sendMessage(token, chatId, "Описание не может быть пустым. Напишите описание ролика ещё раз.");
        return;
      }
      session.metadataBySequence.set(sequence, current);
      await sendCutMetadataPrompt(token, chatId);
      return;
    }

    const tags = parseCutTags(text);
    if (!tags.length) {
      await sendMessage(token, chatId, "Не нашёл тегов. Напишите их через запятую, например: история, реакция, shorts.");
      return;
    }
    current.tags = tags;
    current.hashtags = cutHashtags(tags);
    session.metadataBySequence.set(sequence, current);
    if (session.index + 1 < session.sequences.length) {
      session.index += 1;
      await sendCutMetadataPrompt(token, chatId);
      return;
    }

    await updateChatPreferences(chatId, { pendingAction: null });
    try {
      await publishCutBatchWithMetadata(token, chatId);
    } catch (error) {
      logger.error({ err: error, chatId, batchId: session.batchId }, "Failed to publish cut batch with collected metadata");
      await sendMessage(token, chatId, `❌ Не удалось опубликовать нарезки: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
    }
    return;
  }
  if (preferences.pendingAction === "youtube_metadata") {
    const pending = pendingYoutubeByChat.get(chatId) || await restorePendingYoutubePublication(chatId);
    if (!pending) {
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMainMenu(token, chatId, "Данные публикации устарели. Откройте публикацию заново.");
      return;
    }
    try {
      const metadata = parseYoutubeEdit(text, pending.metadata);
      if (!metadata.title.trim()) throw new Error("Не указан заголовок.");
      if (!metadata.description.trim()) throw new Error("Не указано описание.");
      await sendMessage(token, chatId, "⏳ Данные получены. Создаю обложку и готовлю предпросмотр…");
      const thumbnail = await createYoutubeThumbnail({
        topic: pending.topic,
        title: metadata.title,
        description: metadata.description,
      });
      pending.metadata = metadata;
      pending.thumbnail = thumbnail;
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendPhoto(token, chatId, thumbnail, youtubePreview(metadata), {
        inline_keyboard: [
          [{ text: "✅ Перейти к выбору канала", callback_data: "youtube:approve" }],
          [{ text: "✏️ Изменить данные", callback_data: "youtube:edit" }, { text: "❌ Отмена", callback_data: "youtube:cancel" }],
        ],
      });
    } catch (error) {
      await sendMessage(
        token,
        chatId,
        `❌ Не удалось принять данные: ${error instanceof Error ? error.message : "неизвестная ошибка"}\n\nПроверьте формат и отправьте сообщение ещё раз.`,
      );
    }
    return;
  }
    if (preferences.pendingAction === "youtube_edit") {
      const pending = pendingYoutubeByChat.get(chatId);
      if (!pending) {
        await updateChatPreferences(chatId, { pendingAction: null });
        await sendMainMenu(token, chatId, "Предпросмотр YouTube устарел. Откройте публикацию заново.");
        return;
      }
      const metadata = parseYoutubeEdit(text, pending.metadata);
      pending.metadata = metadata;
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendPhoto(token, chatId, pending.thumbnail, youtubePreview(metadata), {
        inline_keyboard: [
          [{ text: "✅ Перейти к выбору канала", callback_data: "youtube:approve" }],
          [{ text: "✏️ Изменить данные", callback_data: "youtube:edit" }, { text: "❌ Отмена", callback_data: "youtube:cancel" }],
        ],
      });
      return;
    }
  if (preferences.pendingAction === "video_topic") {
    await updateChatPreferences(chatId, { pendingAction: null });
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

type PipelineStageStatus = "pending" | "processing" | "completed" | "failed";

function pipelineStatusIcon(status: PipelineStageStatus | undefined): string {
  if (status === "completed") return "✅";
  if (status === "processing") return "🔄";
  if (status === "failed") return "❌";
  return "⏳";
}

async function formatPipelineStatus(
  job: typeof videoGenerationJobsTable.$inferSelect,
  projectId: number,
  telegramStatus?: PipelineStageStatus,
): Promise<string> {
  const stages = (job.stages || {}) as Record<string, { status?: PipelineStageStatus }>;
  const images = await db.select({
    status: generatedImagesTable.status,
    storagePath: generatedImagesTable.storagePath,
  })
    .from(generatedImagesTable)
    .where(eq(generatedImagesTable.projectId, projectId));
  const completedImages = images.filter((image) => image.status === "completed").length;
  const [project] = await db.select({ scriptJson: projectsTable.scriptJson })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));
  const projectScriptJson = project?.scriptJson && typeof project.scriptJson === "object"
    ? project.scriptJson as Record<string, unknown>
    : {};
  const isSingleStoryVisual = projectScriptJson.story_channel_visual_pool_size === 1;
  const imagePaths = isSingleStoryVisual
    ? [...new Set(images.map((image) => image.storagePath).filter(Boolean))]
    : [];
  const displayedTotalImages = isSingleStoryVisual ? imagePaths.length : images.length;
  const displayedCompletedImages = isSingleStoryVisual
    ? new Set(images.filter((image) => image.status === "completed").map((image) => image.storagePath).filter(Boolean)).size
    : completedImages;
  const imageStatus = stages.images?.status || (
    images.length > 0 && completedImages === images.length ? "completed" : "pending"
  );
  const resolvedTelegramStatus = telegramStatus
    || (job.telegramDeliveredAt ? "completed" : job.status === "completed" ? "processing" : "pending");

  return [
    "🎬 Создание видео",
    `Сценарий       ${pipelineStatusIcon(stages.script?.status)}`,
    `Изображения    ${pipelineStatusIcon(imageStatus)} ${displayedCompletedImages}/${displayedTotalImages}`,
    `Озвучка        ${pipelineStatusIcon(stages.voice?.status)}`,
    `Музыка         ${pipelineStatusIcon(stages.music?.status)}`,
    `SFX            ${pipelineStatusIcon(stages.sfx?.status)}`,
    `Монтаж         ${pipelineStatusIcon(stages.rendering?.status)}`,
    `Telegram       ${pipelineStatusIcon(resolvedTelegramStatus)}`,
    `\nОбщий прогресс: ${job.progress}%`,
  ].join("\n");
}

async function monitorVideoJob(token: string, chatId: number, projectId: number, jobId: number): Promise<void> {
  if (await isStoryProject(projectId)) {
    logger.info({ chatId, projectId, jobId }, "Skipping legacy Telegram monitor for story project");
    return;
  }
  logger.info({ chatId, projectId, jobId }, "Started Telegram video delivery monitor");
  for (let attempt = 0; attempt < 360; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    const [job] = await db.select().from(videoGenerationJobsTable).where(eq(videoGenerationJobsTable.id, jobId));
    if (!job) {
      await sendMessage(token, chatId, "Видео job не найден. Pipeline остановлен.");
      return;
    }
    if (job.status === "failed") {
      await sendMessage(token, chatId, formatPipelineError(job.currentStage, job.error), {
        inline_keyboard: [[{
          text: "▶️ Продолжить с места сбоя",
          callback_data: `video:resume:${jobId}:${projectId}`,
        }]],
      });
      return;
    }
    if (job.status === "completed" && job.videoStoragePath) {
      if (job.telegramDeliveredAt) {
        logger.info({ chatId, projectId, jobId }, "Telegram video was already delivered; skipping duplicate upload");
        return;
      }
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) {
        await sendMessage(token, chatId, "✅ Видео готово, но проект для ручной подготовки публикации не найден.");
        return;
      }
      const [episode] = await db.select().from(seriesEpisodesTable).where(eq(seriesEpisodesTable.projectId, projectId));
      if (episode) {
        await db.update(seriesEpisodesTable).set({ status: "completed" }).where(eq(seriesEpisodesTable.id, episode.id));
        const [season] = await db.select({ seriesId: seasonsTable.seriesId })
          .from(seasonsTable)
          .where(eq(seasonsTable.id, episode.seasonId));
        if (season) {
          await saveSeriesMemory({
            seriesId: season.seriesId,
            episodeId: episode.id,
            eventType: "episode_completed",
            payload: { projectId, videoJobId: jobId, videoStoragePath: job.videoStoragePath },
          });
        }
      }
      pendingVideoReviewByChat.set(chatId, {
        projectId,
        jobId,
        videoStoragePath: job.videoStoragePath,
      });
      await sendMessage(token, chatId, await formatPipelineStatus(job, projectId, "processing"));
      const videoBuffer = await readAudioAsset(job.videoStoragePath);
      await sendVideo(
        token,
        chatId,
        videoBuffer,
        episode
          ? `✅ Серия ${episode.episodeNumber} готова.\n\nПосмотри видео и выбери, что делать дальше.`
          : "✅ Видео готово.\n\nПосмотри ролик и выбери, что делать дальше.",
        {
          inline_keyboard: [
            [{ text: "🔁 Пересобрать с моими фото", callback_data: `video:review:my-images:${jobId}:${projectId}` }],
            [{ text: "✅ Всё ок — ввести данные публикации", callback_data: `video:review:approve:${jobId}:${projectId}` }],
            [{ text: "🔄 Переделать", callback_data: `video:review:redo:${jobId}:${projectId}` }],
          ],
        },
      );
      await db.update(videoGenerationJobsTable)
        .set({ telegramDeliveredAt: new Date() })
        .where(eq(videoGenerationJobsTable.id, jobId));
      await sendMessage(token, chatId, await formatPipelineStatus(
        { ...job, telegramDeliveredAt: new Date() },
        projectId,
        "completed",
      ));
      logger.info({ chatId, projectId, jobId }, "Telegram video delivered");
      return;
    }
    if (attempt % 2 === 0) await sendMessage(token, chatId, await formatPipelineStatus(job, projectId));
  }
  await sendMessage(token, chatId, `Pipeline проекта ${projectId} превысил лимит ожидания. Можно повторить render через web.`);
}

const YOUTUBE_MILESTONE_VIEWS = 1_000;
const MOSCOW_TIME_ZONE = "Europe/Moscow";
let lastYoutubeMilestoneScanDay = "";
let youtubeMilestoneScanRunning = false;

function moscowClock(now = new Date()): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    day: `${value.year}-${value.month}-${value.day}`,
    hour: Number(value.hour),
  };
}

function moscowDayStart(now = new Date()): Date {
  const clock = moscowClock(now);
  const [year, month, day] = clock.day.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!, -3, 0, 0));
}

async function runYoutubeMilestoneScanner(token: string): Promise<void> {
  const clock = moscowClock();
  if (clock.hour < 16 || clock.day === lastYoutubeMilestoneScanDay || youtubeMilestoneScanRunning) return;
  lastYoutubeMilestoneScanDay = clock.day;
  youtubeMilestoneScanRunning = true;
  try {
    const connections = await listYoutubeConnections();
    const videos = [];
    for (const connection of connections) {
      try {
        const channelVideos = await listYoutubeVideosPublishedSince(connection.id, moscowDayStart());
        videos.push(...channelVideos.filter((video) => video.viewCount >= YOUTUBE_MILESTONE_VIEWS));
      } catch (error) {
        logger.warn({ err: error, connectionId: connection.id }, "YouTube milestone scan failed for channel");
      }
    }
    if (!videos.length) {
      logger.info({ day: clock.day }, "YouTube milestone scan finished with no videos over threshold");
      return;
    }
    const chats = await db.select({ chatId: telegramChatPreferencesTable.chatId })
      .from(telegramChatPreferencesTable);
    if (!chats.length) return;
    const lines = [
      "🏆 YouTube: ролики достигли 1 000+ просмотров",
      `Проверка за ${clock.day} по московскому времени:`,
      "",
      ...videos.map((video) => [
        `📺 ${video.channelTitle}`,
        `«${video.title}»`,
        `👁 ${video.viewCount.toLocaleString("ru-RU")} просмотров`,
        `https://youtu.be/${video.videoId}`,
      ].join("\n")),
    ];
    for (const chat of chats) {
      let message = "";
      for (const line of lines) {
        if (message && `${message}\n${line}`.length > MAX_MESSAGE_LENGTH) {
          await sendMessage(token, chat.chatId, message);
          message = "";
        }
        message = message ? `${message}\n${line}` : line;
      }
      if (message) await sendMessage(token, chat.chatId, message);
    }
    logger.info({ day: clock.day, videos: videos.length, chats: chats.length }, "YouTube milestone scan notified chats");
  } catch (error) {
    logger.error({ err: error }, "YouTube milestone scan failed");
  } finally {
    youtubeMilestoneScanRunning = false;
  }
}

export async function startTelegramBot(): Promise<void> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN is not configured; Telegram bot is disabled");
    return;
  }
  telegramProgressToken = token;

  try {
    await telegramRequest(token, "deleteWebhook", { drop_pending_updates: false });
    const bot = await telegramRequest<{ username?: string }>(token, "getMe");
    await telegramRequest(token, "setMyCommands", {
      commands: [
        { command: "start", description: "Открыть главное меню" },
        { command: "video", description: "Создать видео" },
        { command: "settings", description: "Текущие настройки" },
        { command: "voices", description: "Выбрать голос" },
        { command: "cancel", description: "Отменить ввод" },
      ],
    });
    logger.info({ username: bot.username }, "Telegram bot connected");
    await resumeInterruptedStoryBatches(token);
    await resumeInterruptedStoryItemMonitors(token);
    void runStoryAutomationScheduler(token);
    const storyAutomationTimer = setInterval(() => {
      void runStoryAutomationScheduler(token).catch((error) => {
        logger.error({ err: error }, "Story automation scheduler failed");
      });
    }, STORY_AUTOMATION_TICK_MS);
    storyAutomationTimer.unref?.();
    void runYoutubeMilestoneScanner(token);
    const youtubeMilestoneTimer = setInterval(() => {
      void runYoutubeMilestoneScanner(token);
    }, 60_000);
    youtubeMilestoneTimer.unref?.();
    const resumedJobs = await resumeInterruptedVideoJobs();
    for (const job of resumedJobs) {
      if (await isStoryProject(job.projectId)) continue;
      if (job.chatId) {
        await sendMessage(token, job.chatId, "🔄 После перезапуска API продолжаю незавершённый pipeline.");
        runTelegramBackgroundTask(
          monitorVideoJob(token, job.chatId, job.projectId, job.id),
          { chatId: job.chatId, projectId: job.projectId, jobId: job.id },
        );
        continue;
      }
      const [episode] = await db.select({ seasonId: seriesEpisodesTable.seasonId })
        .from(seriesEpisodesTable)
        .where(eq(seriesEpisodesTable.projectId, job.projectId))
        .limit(1);
      if (!episode) continue;
      const [series] = await db.select({ chatId: seriesTable.chatId })
        .from(seasonsTable)
        .innerJoin(seriesTable, eq(seasonsTable.seriesId, seriesTable.id))
        .where(eq(seasonsTable.id, episode.seasonId))
        .limit(1);
      if (series) {
        await sendMessage(token, series.chatId, "🔄 После перезапуска API продолжаю незавершённый pipeline.");
        runTelegramBackgroundTask(
          monitorVideoJob(token, series.chatId, job.projectId, job.id),
          { chatId: series.chatId, projectId: job.projectId, jobId: job.id },
        );
      }
    }
    const pendingNotifications = await db.select({
      id: videoGenerationJobsTable.id,
      projectId: videoGenerationJobsTable.projectId,
      chatId: videoGenerationJobsTable.chatId,
    }).from(videoGenerationJobsTable).where(and(
      eq(videoGenerationJobsTable.status, "completed"),
      isNull(videoGenerationJobsTable.telegramDeliveredAt),
      isNotNull(videoGenerationJobsTable.chatId),
    )).orderBy(desc(videoGenerationJobsTable.updatedAt)).limit(10);
    for (const job of pendingNotifications) {
      if (!job.chatId) continue;
      if (await isStoryProject(job.projectId)) continue;
      logger.info({ chatId: job.chatId, projectId: job.projectId, jobId: job.id }, "Retrying undelivered completed Telegram video");
      runTelegramBackgroundTask(
        monitorVideoJob(token, job.chatId, job.projectId, job.id),
        { chatId: job.chatId, projectId: job.projectId, jobId: job.id },
      );
    }
    const activeBatches = await db.select().from(chatVideoBatchesTable).where(inArray(
      chatVideoBatchesTable.status,
      ["queued", "processing"],
    ));
    for (const batch of activeBatches) {
      await sendMessage(token, batch.chatId, `🔄 После перезапуска API продолжаю пакет роликов с позиции ${batch.currentIndex || 1}/${batch.totalCount}.`);
      runTelegramBackgroundTask(
        runChatVideoBatch(token, batch.chatId, batch.id),
        { chatId: batch.chatId, batchId: batch.id, task: "chat-video-batch-recovery" },
      );
    }
    const activeDayBatches = await db.select().from(chatDayBatchesTable).where(inArray(
      chatDayBatchesTable.status,
      ["processing", "scheduled"],
    ));
    for (const batch of activeDayBatches) {
      await sendMessage(
        token,
        batch.chatId,
        batch.status === "scheduled"
          ? "🔄 После перезапуска API продолжаю дневное расписание."
          : `🔄 После перезапуска API продолжаю дневной пакет с позиции ${batch.currentIndex || 1}/5.`,
      );
      const task = batch.status === "scheduled"
        ? runScheduledChatDayBatch(token, batch.chatId, batch.id)
        : runChatDayBatch(token, batch.chatId, batch.id);
      runTelegramBackgroundTask(task, {
        chatId: batch.chatId,
        batchId: batch.id,
        task: batch.status === "scheduled" ? "chat-day-schedule-recovery" : "chat-day-video-recovery",
      });
    }
    const failedReviewDayBatches = await db.select().from(chatDayBatchesTable).where(
      eq(chatDayBatchesTable.status, "awaiting_video_review"),
    );
    for (const batch of failedReviewDayBatches) {
      const [failedItem] = await db.select({ id: chatDayBatchItemsTable.id })
        .from(chatDayBatchItemsTable)
        .where(and(
          eq(chatDayBatchItemsTable.batchId, batch.id),
          eq(chatDayBatchItemsTable.status, "failed"),
        ))
        .limit(1);
      if (!failedItem) continue;
      await db.update(chatDayBatchesTable).set({ status: "processing", updatedAt: new Date() })
        .where(eq(chatDayBatchesTable.id, batch.id));
      await sendMessage(token, batch.chatId, "🔄 После перезапуска API повторяю только незавершённые ролики дневного пакета. Готовые ролики не пересоздаю.");
      runTelegramBackgroundTask(
        runChatDayBatch(token, batch.chatId, batch.id),
        { chatId: batch.chatId, batchId: batch.id, task: "chat-day-failed-items-recovery" },
      );
    }
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
        allowed_updates: ["message", "callback_query"],
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        logger.info({
          updateId: update.update_id,
          chatId: update.message?.chat.id ?? update.callback_query?.message?.chat.id,
          hasText: Boolean(update.message?.text),
          hasCallback: Boolean(update.callback_query),
        }, "Telegram update received");
        try {
          await handleUpdate(token, update);
        } catch (error) {
          logger.error({ err: error, updateId: update.update_id }, "Telegram update handling failed");
          const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
          if (chatId !== undefined) {
            await sendMainMenu(token, chatId, "Не удалось выполнить действие. Попробуйте ещё раз.")
              .catch(() => undefined);
          }
        }
      }
    } catch (error) {
      logger.error({ err: error }, "Telegram polling failed; retrying");
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}