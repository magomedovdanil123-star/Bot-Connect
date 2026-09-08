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
  youtubeConnectionsTable,
  videoGenerationJobsTable,
  voiceGenerationsTable,
} from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { startProjectImageGeneration, storeUploadedImage } from "./image-generation/service";
import {
  ElevenLabsNotConfiguredError,
  getElevenLabsModel,
  getSpeechProvider,
  listElevenLabsVoices,
} from "./audio-generation/elevenlabs-client";
import { startProjectVoiceGeneration } from "./audio-generation/service";
import {
  estimateSpokenDurationSeconds,
  formatScriptForTelegram,
  generateVideoScript,
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
import {
  createYoutubeThumbnail,
  createYoutubeAuthorizationUrl,
  postYoutubeComment,
  generateYoutubeMetadata,
  listYoutubeConnections,
  syncYoutubeChannels,
  uploadYoutubeShort,
  youtubeConnectionStatus,
  type YoutubeMetadata,
} from "./youtube";

const TELEGRAM_API = "https://api.telegram.org";
const POLL_TIMEOUT_SECONDS = 30;
const RETRY_DELAY_MS = 5_000;
const MAX_MESSAGE_LENGTH = 4_096;
const MAX_SCRIPT_INSTRUCTIONS = 2_000;
const VOICES_PER_PAGE = 6;
const TELEGRAM_DOWNLOAD_LIMIT_BYTES = 20 * 1024 * 1024;
const DEFAULT_RECRUITMENT_CTA =
  "Узнай, сколько платят курьерам в твоём городе, и присоединяйся. Оплата — до 7 000 рублей за смену. Пригласи друга — работайте вместе и получи дополнительное вознаграждение. Оставляй заявку в Telegram, ссылка в шапке профиля канала.";

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
const pendingYoutubeByChat = new Map<number, {
  projectId: number | null;
  connectionIds: number[];
  videoStoragePath: string;
  metadata: YoutubeMetadata;
  thumbnail: Buffer;
}>();
const pendingVideoReviewByChat = new Map<number, {
  projectId: number;
  jobId: number;
  videoStoragePath: string;
}>();
const pendingImageSceneByChat = new Map<number, { projectId: number; sceneId: number }>();

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

function runTelegramBackgroundTask(
  task: Promise<void>,
  context: Record<string, unknown>,
): void {
  void task.catch((error) => {
    logger.error({ err: error, ...context }, "Telegram background task failed");
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

function mainMenu(): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "🎬 Создать видео", callback_data: "menu:create" }],
      [{ text: "💬 Чат-переписка — 30 секунд", callback_data: "menu:chat" }],
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
        { text: "📺 Каналы", callback_data: "menu:youtube_channels" },
        { text: "📤 Подготовить публикацию", callback_data: "menu:youtube" },
      ],
    ],
  };
}

async function sendMainMenu(token: string, chatId: number, text = "Что хотите сделать?"): Promise<void> {
  await sendMessage(token, chatId, text, mainMenu());
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

function summarizeScriptForYoutube(scriptText: string): string {
  try {
    const parsed = JSON.parse(scriptText) as {
      title?: unknown;
      hook?: unknown;
      description?: unknown;
      ending?: unknown;
      scenes?: unknown;
    };
    if (!parsed || typeof parsed !== "object") return scriptText.slice(0, 12_000);
    const sceneVoice = Array.isArray(parsed.scenes)
      ? parsed.scenes
        .map((scene) => typeof scene === "object" && scene !== null && "voice_text" in scene
          ? (scene as { voice_text?: unknown }).voice_text
          : null)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join(" ")
      : "";
    return [
      typeof parsed.title === "string" ? `Название: ${parsed.title}` : "",
      typeof parsed.hook === "string" ? `Завязка: ${parsed.hook}` : "",
      typeof parsed.description === "string" ? `Сюжет: ${parsed.description}` : "",
      sceneVoice ? `Что происходит в ролике: ${sceneVoice}` : "",
      typeof parsed.ending === "string" ? `Финал: ${parsed.ending}` : "",
    ].filter(Boolean).join("\n\n").slice(0, 12_000);
  } catch {
    return scriptText.slice(0, 12_000);
  }
}

async function prepareYoutubePublication(token: string, chatId: number): Promise<void> {
  const projectId = lastProjectByChat.get(chatId);
  if (!projectId) throw new Error("Сначала создайте видео.");
  const preferences = await getChatPreferences(chatId);
  let connectionId = preferences.activeYoutubeConnectionId;
  if (!connectionId) {
    const connections = await listYoutubeConnections();
    if (connections.length === 1) {
      connectionId = connections[0].id;
      await updateChatPreferences(chatId, { activeYoutubeConnectionId: connectionId });
    }
  }
  const status = await youtubeConnectionStatus(connectionId || undefined);
  if (!status.connected) {
    await showYoutubeChannels(token, chatId, "Сначала подключите и выберите YouTube-канал.");
    return;
  }
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
    connectionId!,
  );
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
    ? `${message}\n\nАктивный канал используется для следующей публикации.`
    : "Каналы пока не подключены. Подключите первый канал.", { inline_keyboard: rows });
}

export async function prepareYoutubePublicationForStorage(
  token: string,
  chatId: number,
  videoStoragePath: string,
  title: string,
  scriptText: string,
  topic: string,
  connectionId: number,
): Promise<void> {
  if (!connectionId) {
    const preferences = await getChatPreferences(chatId);
    connectionId = preferences.activeYoutubeConnectionId || 0;
    if (!connectionId) {
      const connections = await listYoutubeConnections();
      if (connections.length === 1) connectionId = connections[0].id;
    }
  }
  if (!connectionId) throw new Error("Сначала подключите и выберите YouTube-канал.");
  await sendMessage(token, chatId, "⏳ Готовлю SEO, хэштеги и обложку для YouTube…");
  const storySummary = summarizeScriptForYoutube(scriptText);
  const metadata = await generateYoutubeMetadata({
    title,
    topic,
    description: storySummary,
    scriptText: storySummary,
  });
  const thumbnail = await createYoutubeThumbnail({ topic, title, description: storySummary });
  pendingYoutubeByChat.set(chatId, { projectId: null, connectionIds: [connectionId], videoStoragePath, metadata, thumbnail });
  await sendPhoto(token, chatId, thumbnail, youtubePreview(metadata), {
    inline_keyboard: [
      [{ text: "✅ Перейти к выбору публикации", callback_data: "youtube:approve" }],
      [{ text: "✏️ Изменить SEO", callback_data: "youtube:edit" }, { text: "❌ Отмена", callback_data: "youtube:cancel" }],
    ],
  });
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
      [{ text: "⬅️ Вернуться к SEO", callback_data: "menu:youtube" }],
    ],
  });
}

async function showYoutubeChannelChoice(token: string, chatId: number): Promise<void> {
  const pending = pendingYoutubeByChat.get(chatId);
  if (!pending) {
    await prepareYoutubePublication(token, chatId);
    return;
  }
  const connections = await listYoutubeConnections();
  if (!connections.length) throw new Error("Нет подключённых YouTube-каналов.");
  const rows: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: "📡 Опубликовать на всех каналах", callback_data: "youtube:target:all" }],
  ];
  for (const connection of connections) {
    rows.push([{
      text: `📺 ${connection.channelTitle || `Канал #${connection.id}`}`,
      callback_data: `youtube:target:${connection.id}`,
    }]);
  }
  rows.push([{ text: "⬅️ Вернуться к SEO", callback_data: "youtube:cancel" }]);
  await sendMessage(token, chatId, "На какой YouTube-канал отправить видео?", { inline_keyboard: rows });
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
    const preferences = await getChatPreferences(chatId);
    let connectionId = preferences.activeYoutubeConnectionId;
    if (!connectionId) {
      const connections = await listYoutubeConnections();
      if (connections.length === 1) {
        connectionId = connections[0].id;
        await updateChatPreferences(chatId, { activeYoutubeConnectionId: connectionId });
      }
    }
    const status = await youtubeConnectionStatus(connectionId || undefined);
    if (!status.connected) {
      await showYoutubeChannels(token, chatId, "Сначала подключите и выберите канал для этого ролика.");
      return;
    }
    await sendMessage(token, chatId, "⏳ Получил готовый ролик. Сохраняю его и готовлю SEO с обложкой…");
    if (fileSize && fileSize > TELEGRAM_DOWNLOAD_LIMIT_BYTES) {
      const uploadToken = createLargeVideoUploadToken(chatId, fileName, caption);
      const uploadUrl = `${uploadBaseUrl()}/api/upload/${uploadToken}`;
      await sendMessage(token, chatId, "Видео больше лимита Telegram для скачивания. Загрузите его по защищённой одноразовой ссылке:", {
        inline_keyboard: [[{ text: "📤 Загрузить ролик для SEO", url: uploadUrl }]],
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
      connectionId!,
    );
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to prepare uploaded Telegram video");
    await sendMessage(token, chatId, `❌ Не удалось подготовить ролик: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  }
}

function parseYoutubeEdit(text: string, current: YoutubeMetadata): YoutubeMetadata {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let title = current.title;
  let description = current.description;
  let tags = current.tags;
  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator < 0) {
      if (title === current.title) title = line;
      continue;
    }
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "заголовок" || key === "title") title = value;
    else if (key === "описание" || key === "description") description = value;
    else if (key === "теги" || key === "tags") tags = value.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
  return {
    title: (title || current.title).slice(0, 100),
    description: (description || current.description).slice(0, 5000),
    tags: (tags.length ? tags : current.tags).slice(0, 30),
    hashtags: current.hashtags,
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
    const selectedDuration = selectedPlatform.toLowerCase().includes("chat") ? 30 : preferences.duration || 60;
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
        `⏱ Длительность: ${selectedDuration} секунд`,
         `📱 Платформа: ${selectedPlatform}`,
         selectedPlatform.toLowerCase().includes("chat") ? "💬 Сообщения будут появляться по очереди прямо в чате." : "",
      ].join("\n"),
    );
    const script = await generateVideoScript({
      topic,
      format: selectedPlatform,
      duration: selectedDuration,
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
    await sendMessage(token, chatId, `Не получилось запустить видео pipeline: ${error instanceof Error ? error.message : "unknown error"}`);
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

async function handleCallbackQuery(token: string, update: TelegramUpdate): Promise<void> {
  const callback = update.callback_query;
  const chatId = callback?.message?.chat.id;
  const data = callback?.data;
  if (!callback || chatId === undefined || !data) return;
  try {
    if (data === "menu:home") {
      await sendMainMenu(token, chatId);
    } else if (data === "menu:create") {
       await updateChatPreferences(chatId, { pendingAction: "video_topic" });
      await sendMessage(token, chatId, "🎬 Отправьте тему будущего ролика одним сообщением.\n\nНапример: Курьер получил странный заказ в 2 часа ночи");
    } else if (data === "menu:chat") {
      await updateChatPreferences(chatId, {
        platform: "Chat 9:16",
        duration: 30,
        pendingAction: "video_topic",
      });
      await sendMessage(token, chatId, "💬 Режим чата включён — ролик будет на 30 секунд.\n\nОтправьте тему переписки одним сообщением.\n\nНапример: два незнакомца случайно поняли, что работают в одном месте.");
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
      if (!pendingYoutubeByChat.has(chatId)) await prepareYoutubePublication(token, chatId);
      await updateChatPreferences(chatId, { pendingAction: "youtube_edit" });
      await sendMessage(
        token,
        chatId,
        [
          "✏️ Отправьте изменения для YouTube.",
          "",
          "Формат:",
          "Заголовок: новый заголовок",
          "Описание: новое описание",
          "Теги: тег 1, тег 2, тег 3",
          "",
          "Можно отправить только новый заголовок.",
          "Для отмены отправьте /cancel.",
        ].join("\n"),
      );
    } else if (data === "youtube:cancel") {
      pendingYoutubeByChat.delete(chatId);
      await updateChatPreferences(chatId, { pendingAction: null });
      await sendMainMenu(token, chatId, "Публикация на YouTube отменена.");
    } else if (data === "youtube:approve") {
      await showYoutubeChannelChoice(token, chatId);
    } else if (data === "youtube:target:all" || data.startsWith("youtube:target:")) {
      const pending = pendingYoutubeByChat.get(chatId);
      if (!pending) throw new Error("Нет публикации для согласования.");
      const connections = await listYoutubeConnections();
      if (data === "youtube:target:all") {
        pending.connectionIds = connections.map((connection) => connection.id);
      } else {
        const connectionId = Number.parseInt(data.slice("youtube:target:".length), 10);
        if (!connections.some((connection) => connection.id === connectionId)) throw new Error("Канал не найден.");
        pending.connectionIds = [connectionId];
      }
      if (!pending.connectionIds.length) throw new Error("Нет подключённых YouTube-каналов.");
      await showYoutubePrivacyChoice(token, chatId);
    } else if (data === "youtube:privacy:private" || data === "youtube:privacy:public") {
      const pending = pendingYoutubeByChat.get(chatId);
      if (!pending) throw new Error("Нет публикации для согласования.");
      const privacyStatus = data.endsWith(":public") ? "public" : "private";
      await sendMessage(token, chatId, `⏳ Загружаю видео на ${pending.connectionIds.length === 1 ? "выбранный канал" : `все каналы (${pending.connectionIds.length})`} как ${privacyStatus}…`);
      const results: string[] = [];
      for (const connectionId of pending.connectionIds) {
        const connection = (await listYoutubeConnections()).find((item) => item.id === connectionId);
        try {
          const result = await uploadYoutubeShort({
            videoStoragePath: pending.videoStoragePath,
            title: pending.metadata.title,
            description: pending.metadata.description,
            tags: pending.metadata.tags,
            thumbnail: pending.thumbnail,
            connectionId,
            privacyStatus,
          });
           const videoUrl = `https://youtu.be/${result.videoId}`;
           let commentResult = "Комментарий не создан";
           try {
             await postYoutubeComment({ videoId: result.videoId, connectionId });
             commentResult = "комментарий добавлен — закрепите его вручную";
           } catch (commentError) {
             commentResult = `комментарий не добавлен: ${commentError instanceof Error ? commentError.message : "ошибка доступа"}`;
           }
           results.push(`✅ ${connection?.channelTitle || `Канал #${connectionId}`}: ${videoUrl}\n   💬 ${commentResult}`);
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
      pendingVideoReviewByChat.delete(chatId);
      await sendMessage(token, chatId, "✅ Видео принято. Автоматически готовлю SEO, хэштеги и обложку…");
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
              [{ text: "✅ Всё ок — готовить SEO", callback_data: `video:review:approve:${jobId}:${projectId}` }],
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

  if (text.startsWith("/")) {
    await sendMainMenu(token, chatId, "Неизвестная команда. Используйте кнопки меню или отправьте тему ролика.");
    return;
  }

  const preferences = await getChatPreferences(chatId);
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
          [{ text: "✅ Согласовать и опубликовать", callback_data: "youtube:approve" }],
          [{ text: "✏️ Изменить SEO", callback_data: "youtube:edit" }, { text: "❌ Отмена", callback_data: "youtube:cancel" }],
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

async function monitorVideoJob(token: string, chatId: number, projectId: number, jobId: number): Promise<void> {
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
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) {
        await sendMessage(token, chatId, "✅ Видео готово, но проект для подготовки SEO не найден.");
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
            [{ text: "✅ Всё ок — готовить SEO", callback_data: `video:review:approve:${jobId}:${projectId}` }],
            [{ text: "🔄 Переделать", callback_data: `video:review:redo:${jobId}:${projectId}` }],
          ],
        },
      );
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
    const resumedJobs = await resumeInterruptedVideoJobs();
    for (const job of resumedJobs) {
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