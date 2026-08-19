import { logger } from "./logger";
import {
  db,
  generatedImagesTable,
  projectsTable,
  telegramChatPreferencesTable,
  videoGenerationJobsTable,
  voiceGenerationsTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { startProjectImageGeneration } from "./image-generation/service";
import {
  ElevenLabsNotConfiguredError,
  getElevenLabsModel,
  listElevenLabsVoices,
} from "./audio-generation/elevenlabs-client";
import { startProjectVoiceGeneration } from "./audio-generation/service";
import { generateVideoScript } from "./script-generator";
import { startVideoGeneration } from "./video-pipeline/service";
import { readAudioAsset } from "./audio-design/storage";

const TELEGRAM_API = "https://api.telegram.org";
const POLL_TIMEOUT_SECONDS = 30;
const RETRY_DELAY_MS = 5_000;
const MAX_MESSAGE_LENGTH = 4_096;
const MAX_SCRIPT_INSTRUCTIONS = 2_000;
const VOICES_PER_PAGE = 6;

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
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
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

async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string, showAlert = false): Promise<void> {
  await telegramRequest(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
    show_alert: showAlert,
  });
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

function mainMenu(): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "🎬 Создать видео", callback_data: "menu:create" }],
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
  try {
    await sendMessage(token, chatId, "⏳ Тема получена. Проверяю настройки и готовлю запуск…");
    const preferences = await getChatPreferences(chatId);
    const preset = preferences.stylePreset && preferences.stylePreset in STYLE_PRESETS
      ? STYLE_PRESETS[preferences.stylePreset as StylePresetId]
      : STYLE_PRESETS.cinematic_realism;
    const selectedStyle = preferences.customStyle || preset.style;
    const selectedTone = preferences.tone || preset.tone;
    const selectedDuration = preferences.duration || 60;
    const selectedPlatform = preferences.platform || PLATFORM_PRESETS.youtube_shorts.format;
    await sendMessage(
      token,
      chatId,
      [
        "Принял тему. Запускаю полный pipeline: сценарий → изображения → ElevenLabs → музыка → SFX → субтитры → MP4.",
        "",
        `📝 Пожелания: ${preferences.scriptInstructions ? "учитываются" : "стандартные"}`,
        `🎙 Голос: ${preferences.voiceName || "автоматический"}`,
        `🎨 Стиль: ${preferences.customStyle || preset.label}`,
        `⏱ Длительность: ${selectedDuration} секунд`,
        `📱 Платформа: ${selectedPlatform}`,
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
      status: "completed",
    }).returning({ id: projectsTable.id });
    lastProjectByChat.set(chatId, project.id);
    const job = await startVideoGeneration(project.id, {
      format: "9:16",
      duration: selectedDuration,
      style: selectedStyle,
      tone: selectedTone,
      voiceId: preferences.voiceId || undefined,
      voiceName: preferences.voiceName || undefined,
    });
    await sendMessage(token, chatId, `🎬 Pipeline запущен.\nПроект: ${project.id}\nГотово: ${job.progress}%`);
    void monitorVideoJob(token, chatId, project.id, job.id);
  } catch (error) {
    logger.error({ err: error, chatId }, "Failed to start Telegram video pipeline");
    await sendMessage(token, chatId, `Не получилось запустить видео pipeline: ${error instanceof Error ? error.message : "unknown error"}`);
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
    } else if (data === "menu:create") {
      await updateChatPreferences(chatId, { pendingAction: "video_topic" });
      await sendMessage(token, chatId, "🎬 Отправьте тему будущего ролика одним сообщением.\n\nНапример: Курьер получил странный заказ в 2 часа ночи");
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
          ],
          [{ text: "⬅️ Настройки", callback_data: "menu:settings" }],
        ],
      });
    } else if (data.startsWith("duration:")) {
      const duration = Number.parseInt(data.slice("duration:".length), 10);
      if (![30, 60, 90].includes(duration)) throw new Error("Недоступная длительность");
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
  const text = update.message?.text?.trim();
  const chatId = update.message?.chat.id;
  if (!text || chatId === undefined) return;

  if (text === "/start") {
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
    await updateChatPreferences(chatId, { pendingAction: null });
    await sendMainMenu(token, chatId, "Действие отменено.");
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
      void monitorImageJob(token, chatId, projectId, ids);
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
      void monitorVoiceJob(token, chatId, projectId, ids);
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
      await sendMessage(token, chatId, `❌ Pipeline остановлен на стадии ${job.currentStage}: ${job.error || "unknown error"}`);
      return;
    }
    if (job.status === "completed" && job.videoStoragePath) {
      await sendVideo(token, chatId, await readAudioAsset(job.videoStoragePath), "✅ Видео готово. Ниже финальный MP4.");
      await sendMainMenu(token, chatId, "Можно создать следующий ролик с теми же настройками.");
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