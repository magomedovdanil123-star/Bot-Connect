import { createHash } from "node:crypto";
import {
  generateHoroscopeMetadata,
  generateVideoScript,
  type HoroscopeContentPlanItem,
  type VideoScript,
} from "./script-generator";
import type { StoredStockMedia } from "./stock-media";
import { logger } from "./logger";

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
    video_length: 30,
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
    video_length: 30,
    hook_style: "неожиданность, вопрос и предупреждение",
    target_audience: "зрители, которые ищут астрологические подсказки о работе и деньгах",
    visual_mode: "STOCK",
  },
  {
    category: "Horoscope",
    niche: "Луна, мистические прогнозы и знаки Вселенной",
    tone: "мистический, спокойный, гипнотический, таинственный",
    topics: ["Луна", "полнолуние", "новолуние", "мистика", "знаки Вселенной"],
    formats: ["Знак Вселенной для тебя", "Не игнорируй этот знак...", "Что изменится в жизни..."],
    video_length: 30,
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
    video_length: 30,
    hook_style: "прямой вопрос, неожиданность и конкретное обещание",
    target_audience: "зрители, которые регулярно смотрят короткие персональные прогнозы",
    visual_mode: "AUTO",
  },
];

const HOROSCOPE_WEB_SLUGS: Record<string, string> = {
  "Овен": "aries",
  "Телец": "taurus",
  "Близнецы": "gemini",
  "Рак": "cancer",
  "Лев": "leo",
  "Дева": "virgo",
  "Весы": "libra",
  "Скорпион": "scorpio",
  "Стрелец": "sagittarius",
  "Козерог": "capricorn",
  "Водолей": "aquarius",
  "Рыбы": "pisces",
};

function stripHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&#39;/giu, "'")
    .replace(/&quot;/giu, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWebForecast(sign: string): Promise<{ url: string; text: string } | null> {
  const normalizedSign = Object.keys(HOROSCOPE_WEB_SLUGS).find((name) =>
    sign.toLocaleLowerCase("ru-RU").includes(name.toLocaleLowerCase("ru-RU")),
  );
  const slug = normalizedSign ? HOROSCOPE_WEB_SLUGS[normalizedSign] : null;
  if (!slug) return null;
  const url = `https://theastrotime.com/horoscopes/daily-horoscope/${slug}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "AI Content Factory horoscope planner/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = stripHtml(await response.text());
    const overviewIndex = text.toLocaleLowerCase("en-US").indexOf("overview");
    const excerpt = overviewIndex >= 0 ? text.slice(overviewIndex, overviewIndex + 1_600) : text.slice(0, 1_600);
    if (!excerpt.trim()) return null;
    return { url, text: excerpt };
  } catch (error) {
    logger.warn({ err: error, sign, url }, "Current horoscope web source unavailable");
    return null;
  }
}

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
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Novosibirsk",
  }).format(new Date());
  const planItem = input.planItem || null;
  const format = planItem?.format
    || input.config.formats[Math.abs(input.config.channel_name.length) % input.config.formats.length]!;
  const plannedTopic = planItem
    ? [
      `Дата прогноза: ${planItem.forecast_date || dateLabel}`,
      `Знак: ${planItem.zodiac_sign}`,
      `Основная тема: ${planItem.topic}`,
      `Подтема: ${planItem.subtopic}`,
      `Основной короткий прогноз: ${planItem.forecast_text || ""}`,
      `Второй короткий прогноз: ${planItem.second_forecast_text || ""}`,
      `Угол подачи: ${planItem.angle}`,
      `Плановый hook: ${planItem.hook}`,
      `Структура двух прогнозных мыслей: ${planItem.story_outline}`,
      `Эмоциональная подача: ${planItem.emotional_tone}`,
    ].join("\n")
    : input.topic;
  const webForecast = planItem ? await fetchWebForecast(planItem.zodiac_sign) : null;
  const script = await generateVideoScript({
    topic: [
      `Родительская тема запуска: ${input.topic}`,
      plannedTopic,
      `Канал: ${input.config.channel_name}.`,
      `Ниша: ${input.config.niche}.`,
      `Темы канала: ${input.config.topics.join(", ")}.`,
      `Форматы канала: ${input.config.formats.join(" | ")}.`,
      `Текущая дата: ${date}.`,
      webForecast
        ? [
          `Короткая справка из открытого интернет-источника (${webForecast.url}):`,
          webForecast.text,
          "Используй её только как справочный материал и перескажи своими словами в двух коротких прогнозных мыслях.",
        ].join("\n")
        : "Открытая веб-справка сейчас недоступна: не выдумывай ссылки и всё равно дай аккуратный общий прогноз по плану.",
    ].join("\n"),
    format: `YouTube Shorts — ${format}`,
    duration: input.config.video_length,
    style: "clean vertical horoscope bulletin, cosmic zodiac visuals, no advertising, no story scenes",
    tone: input.config.tone,
    instructions: [
      "СПЕЦИАЛЬНЫЙ РЕЖИМ: КОРОТКИЙ ДНЕВНОЙ ГОРОСКОП.",
      "Это не история и не фильм. Не создавай героя, сюжет, заказ, поездку, расследование, конфликт или кульминацию.",
      "Сценарий должен быть прямым прогнозом для указанного знака и даты.",
      `Начни с формулы «${planItem?.zodiac_sign || "Знак"}, ${planItem?.forecast_date || dateLabel}: ...» или с очень близкой естественной формулировки.`,
      "Дай две короткие прогнозные мысли: что ждёт знак и второй дополнительный совет/предупреждение.",
      "Каждая сцена должна показывать отдельную тему прогноза или её короткое развитие; визуалы — знак зодиака, созвездие, планеты, луна, абстрактный космос.",
      "Не добавляй рекламный текст, рекрутинг, NOX, курьеров, логотипы, водяные знаки или текст на изображениях.",
      "Финал — короткое резюме прогноза или совет. CTA оставь пустым.",
      "Это отдельный канал с собственной аудиторией. Не копируй контент других каналов.",
      `Hook должен соответствовать стилю: ${input.config.hook_style}.`,
      `Целевая аудитория: ${input.config.target_audience}.`,
      "Используй тему + формат + знак/знаки + hook, но не выдавай астрологию за медицинскую, финансовую или юридическую гарантию.",
      "Не добавляй рекрутинг, курьерскую, рекламную или несвязанную CTA-тему.",
      "Текст voice_text должен быть готов для TTS и содержать только произносимую речь.",
      planItem
        ? "Строго сохрани дату, знак, две прогнозные мысли и тему Content Plan. Не заменяй их историей."
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
    topic: planItem
      ? `${planItem.zodiac_sign}, ${planItem.forecast_date || dateLabel}: ${planItem.topic} — ${planItem.subtopic}`
      : input.topic,
    channelName: input.config.channel_name,
    niche: input.config.niche,
    targetAudience: input.config.target_audience,
    hook: script.hook,
    script,
    recentContent: input.recentContent,
  });
  const packageData = {
    config: input.config,
    idea: planItem
      ? `${planItem.zodiac_sign}: ${planItem.subtopic} — ${planItem.angle}`
      : metadata.idea,
    topic: planItem
      ? `${planItem.zodiac_sign}, ${planItem.forecast_date || dateLabel}: ${planItem.topic}`
      : input.topic,
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
    visualSearchQueries: [],
    visualPrompt: "Использовать только визуалы из пользовательской библиотеки horoscope.",
    stockAssets: [] as StoredStockMedia[],
    stockStatus: "ready" as const,
    stockError: null,
    voiceoverText: voiceoverText(script),
    bannerId: null,
  };
  return { ...packageData, contentHash: stableHash(packageData) };
}