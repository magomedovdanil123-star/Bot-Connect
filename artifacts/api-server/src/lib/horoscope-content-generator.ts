import { createHash } from "node:crypto";
import {
  generateHoroscopeMetadata,
  generateVideoScript,
  type HoroscopeContentPlanItem,
  type VideoScript,
} from "./script-generator";
import { collectHoroscopeStockMedia, type StoredStockMedia } from "./stock-media";

export type HoroscopeChannelConfig = {
  channel_name: string;
  category: "Horoscope";
  niche: string;
  tone: string;
  topics: string[];
  formats: string[];
  video_length: number;
  hook_style: string;
  target_audience: string;
  visual_mode: "AUTO" | "STOCK" | "AI_IMAGE";
};

export type HoroscopeContentPackage = {
  config: HoroscopeChannelConfig;
  idea: string;
  topic: string;
  format: string;
  hook: string;
  script: VideoScript;
  title: string;
  titleVariants: string[];
  description: string;
  keywords: string[];
  tags: string[];
  hashtags: string[];
  visualMode: "AUTO" | "STOCK" | "AI_IMAGE";
  visualSearchQueries: string[];
  visualPrompt: string;
  stockAssets: StoredStockMedia[];
  stockStatus: "ready" | "partial" | "failed";
  stockError: string | null;
  voiceoverText: string;
  bannerId: string | null;
  contentHash: string;
};

const PROFILE_PRESETS: Array<Omit<HoroscopeChannelConfig, "channel_name">> = [
  {
    category: "Horoscope",
    niche: "знаки зодиака, судьба, любовь и отношения",
    tone: "загадочный, интригующий, эмоциональный, динамичный",
    topics: ["любовь", "отношения", "совместимость", "судьба", "характер"],
    formats: ["3 знака зодиака, которым...", "Кто скоро встретит любовь?", "Секрет характера этого знака"],
    video_length: 45,
    hook_style: "интрига, предупреждение и обещание конкретного прогноза",
    target_audience: "зрители 18–44 лет, интересующиеся астрологией и отношениями",
    visual_mode: "AUTO",
  },
  {
    category: "Horoscope",
    niche: "финансовая удача, карьера и важные решения",
    tone: "уверенный, напряжённый, мотивирующий, интригующий",
    topics: ["деньги", "карьера", "удача", "предупреждения", "судьба"],
    formats: ["Кому улыбнётся финансовая удача?", "Эти знаки скоро...", "Вселенная предупреждает..."],
    video_length: 40,
    hook_style: "неожиданность, вопрос и предупреждение",
    target_audience: "зрители, которые ищут астрологические подсказки о работе и деньгах",
    visual_mode: "AI_IMAGE",
  },
  {
    category: "Horoscope",
    niche: "Луна, мистические прогнозы и знаки Вселенной",
    tone: "мистический, спокойный, гипнотический, таинственный",
    topics: ["Луна", "полнолуние", "новолуние", "мистика", "знаки Вселенной"],
    formats: ["Знак Вселенной для тебя", "Не игнорируй этот знак...", "Что изменится в жизни..."],
    video_length: 45,
    hook_style: "загадка, обещание и тихое предупреждение",
    target_audience: "зрители, которым интересны лунные циклы и мистические интерпретации",
    visual_mode: "STOCK",
  },
  {
    category: "Horoscope",
    niche: "ежедневные прогнозы для конкретных знаков зодиака",
    tone: "ясный, живой, эмоциональный, полезный",
    topics: ["конкретные знаки зодиака", "характер", "удача", "отношения", "предупреждения"],
    formats: ["Что ждёт этот знак", "Если ты родился под этим знаком...", "Почему именно эти знаки..."],
    video_length: 35,
    hook_style: "прямой вопрос, неожиданность и конкретное обещание",
    target_audience: "зрители, которые регулярно смотрят короткие персональные прогнозы",
    visual_mode: "AUTO",
  },
];

function channelNameOf(connection: { channelTitle?: string | null; id: number }): string {
  return connection.channelTitle?.trim() || `Канал #${connection.id}`;
}

export function buildHoroscopeChannelConfig(connection: { channelTitle?: string | null; id: number }): HoroscopeChannelConfig {
  const preset = PROFILE_PRESETS[Math.abs(connection.id) % PROFILE_PRESETS.length]!;
  return { ...preset, channel_name: channelNameOf(connection) };
}

function voiceoverText(script: VideoScript): string {
  return [
    ...script.scenes.map((scene) => scene.voice_text.trim()),
    script.ending.trim(),
    script.cta.trim(),
  ].filter(Boolean).join(" ");
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function generateHoroscopeContent(input: {
  topic: string;
  config: HoroscopeChannelConfig;
  recentContent?: string[];
  ideaLibrary?: string[];
  planItem?: HoroscopeContentPlanItem | null;
}): Promise<HoroscopeContentPackage> {
  const date = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "full",
    timeZone: "Asia/Novosibirsk",
  }).format(new Date());
  const planItem = input.planItem || null;
  const format = planItem?.format
    || input.config.formats[Math.abs(input.config.channel_name.length) % input.config.formats.length]!;
  const plannedTopic = planItem
    ? [
      `Знак: ${planItem.zodiac_sign}`,
      `Основная тема: ${planItem.topic}`,
      `Подтема: ${planItem.subtopic}`,
      `Угол подачи: ${planItem.angle}`,
      `Плановый hook: ${planItem.hook}`,
      `Сюжетный outline: ${planItem.story_outline}`,
      `Эмоциональная подача: ${planItem.emotional_tone}`,
    ].join("\n")
    : input.topic;
  const script = await generateVideoScript({
    topic: [
      `Родительская тема запуска: ${input.topic}`,
      plannedTopic,
      `Канал: ${input.config.channel_name}.`,
      `Ниша: ${input.config.niche}.`,
      `Темы канала: ${input.config.topics.join(", ")}.`,
      `Форматы канала: ${input.config.formats.join(" | ")}.`,
      `Текущая дата: ${date}.`,
    ].join("\n"),
    format: `YouTube Shorts — ${format}`,
    duration: input.config.video_length,
    style: "cinematic mystical vertical astrology",
    tone: input.config.tone,
    instructions: [
      "Это отдельный канал с собственной аудиторией. Не копируй контент других каналов.",
      `Hook должен соответствовать стилю: ${input.config.hook_style}.`,
      `Целевая аудитория: ${input.config.target_audience}.`,
      "Используй тему + формат + знак/знаки + hook, но не выдавай астрологию за медицинскую, финансовую или юридическую гарантию.",
      "Не добавляй рекрутинг, курьерскую, рекламную или несвязанную CTA-тему.",
      "Текст voice_text должен быть готов для TTS и содержать только произносимую речь.",
      planItem
        ? "Строго сохрани зафиксированные параметры Content Plan, но развивай их в самостоятельный сценарий. Не копируй плановый hook дословно, если это ухудшает естественность."
        : "",
      input.recentContent?.length
        ? `Анти-повтор. Не повторяй эти недавние идеи:\n- ${input.recentContent.join("\n- ")}`
        : "",
      input.ideaLibrary?.length
        ? `Внутренняя библиотека форматов и идей для вдохновения, не копируй дословно:\n- ${input.ideaLibrary.join("\n- ")}`
        : "",
    ].filter(Boolean).join("\n\n"),
  });
  const metadata = await generateHoroscopeMetadata({
    topic: planItem ? `${planItem.zodiac_sign}: ${planItem.topic} — ${planItem.subtopic}` : input.topic,
    channelName: input.config.channel_name,
    niche: input.config.niche,
    targetAudience: input.config.target_audience,
    hook: script.hook,
    script,
    recentContent: input.recentContent,
  });
  const stockResult = await collectHoroscopeStockMedia(metadata.visual_search_queries);
  const packageData = {
    config: input.config,
    idea: planItem
      ? `${planItem.zodiac_sign}: ${planItem.subtopic} — ${planItem.angle}`
      : metadata.idea,
    topic: planItem ? `${planItem.zodiac_sign}: ${planItem.topic}` : input.topic,
    format: planItem?.format || metadata.format,
    hook: script.hook,
    script,
    title: metadata.selected_title,
    titleVariants: metadata.title_variants,
    description: script.description,
    keywords: metadata.keywords,
    tags: metadata.tags,
    hashtags: metadata.hashtags,
    visualMode: "STOCK" as const,
    visualSearchQueries: metadata.visual_search_queries,
    visualPrompt: metadata.visual_prompt,
    stockAssets: stockResult.assets,
    stockStatus: stockResult.assets.length === 2 ? "ready" as const : stockResult.assets.length ? "partial" as const : "failed" as const,
    stockError: stockResult.errors.length ? stockResult.errors.join("; ") : null,
    voiceoverText: voiceoverText(script),
    bannerId: null,
  };
  return { ...packageData, contentHash: stableHash(packageData) };
}