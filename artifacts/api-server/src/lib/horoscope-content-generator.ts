import { createHash } from "node:crypto";
import {
  createHoroscopeCurrentContext,
  generateHoroscopeMetadata,
  generateVideoScript,
  type HoroscopeCurrentContext,
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

type HoroscopeIdentityPreset = Omit<HoroscopeChannelConfig, "channel_name" | "formats"> & {
  match: RegExp;
  formats: [string, string, string];
};

const PROFILE_PRESETS: HoroscopeIdentityPreset[] = [
  {
    match: /недел|week/iu,
    category: "Horoscope",
    niche: "недельные прогнозы, ключевые дни и развитие событий в течение недели",
    tone: "обзорный, уверенный, последовательный, интригующий",
    topics: ["главное событие недели", "ключевой день", "отношения", "работа", "решение недели"],
    formats: ["Главный поворот недели", "День, который изменит ход недели", "Предупреждение и шанс на этой неделе"],
    video_length: 30,
    hook_style: "обещание недельной перспективы, ключевой день и конкретный ориентир",
    target_audience: "зрители, которые планируют неделю с помощью короткого астрологического обзора",
    visual_mode: "AUTO",
  },
  {
    match: /завтра|tomorrow|будущ/iu,
    category: "Horoscope",
    niche: "персональные прогнозы на завтра, решения и ближайшие перемены",
    tone: "предвкушающий, конкретный, интригующий, динамичный",
    topics: ["события завтра", "решения", "предупреждения", "возможности", "перемены"],
    formats: ["Что ждёт знак завтра", "Главное предупреждение на завтра", "Неожиданное событие завтрашнего дня"],
    video_length: 30,
    hook_style: "обещание события завтрашнего дня, интрига и конкретный сигнал",
    target_audience: "зрители, которые заранее планируют день и ищут короткий прогноз на завтра",
    visual_mode: "AUTO",
  },
  {
    match: /любов|отношен|сердц|роман|love/iu,
    category: "Horoscope",
    niche: "любовь, отношения и эмоциональные связи между знаками",
    tone: "эмоциональный, близкий, интригующий, романтичный",
    topics: ["любовь", "отношения", "человек из прошлого", "признание", "совместимость"],
    formats: ["Кто думает о тебе", "Человек из прошлого", "Неожиданное признание"],
    video_length: 30,
    hook_style: "личное обращение, эмоциональная тайна и обещание ответа",
    target_audience: "зрители 18–44 лет, которым интересны любовь, отношения и совместимость знаков",
    visual_mode: "AUTO",
  },
  {
    match: /деньг|финанс|богат|доход|карьер|работ|money/iu,
    category: "Horoscope",
    niche: "деньги, карьера, доход и финансовые решения по знакам",
    tone: "уверенный, напряжённый, практичный, мотивирующий",
    topics: ["деньги", "карьера", "дополнительный доход", "расходы", "финансовые решения"],
    formats: ["Денежный шанс", "Финансовое предупреждение", "Неожиданная возможность дохода"],
    video_length: 30,
    hook_style: "конкретный денежный сигнал, риск или возможность без гарантии результата",
    target_audience: "зрители, которые ищут астрологические подсказки о работе, доходах и расходах",
    visual_mode: "AUTO",
  },
  {
    match: /лун|вселен|мист|маг|тайн|косм|moon/iu,
    category: "Horoscope",
    niche: "Луна, мистические прогнозы, интуиция и знаки Вселенной",
    tone: "мистический, спокойный, гипнотический, таинственный",
    topics: ["Луна", "интуиция", "знаки Вселенной", "скрытый смысл", "внутренние перемены"],
    formats: ["Послание Вселенной для знака", "Лунный сигнал, который нельзя игнорировать", "Скрытая перемена уже началась"],
    video_length: 30,
    hook_style: "загадка, личный знак и тихое предупреждение",
    target_audience: "зрители, которым интересны лунные циклы, интуиция и мистические интерпретации",
    visual_mode: "AUTO",
  },
  {
    match: /судьб|предназнач|поворот|карм|fate/iu,
    category: "Horoscope",
    niche: "судьбоносные решения, жизненные повороты и личное предназначение",
    tone: "серьёзный, вдохновляющий, интригующий, судьбоносный",
    topics: ["важное решение", "поворот судьбы", "новый этап", "выбор", "предназначение"],
    formats: ["Поворот судьбы для знака", "Выбор, который изменит направление", "Событие, открывающее новый этап"],
    video_length: 30,
    hook_style: "судьбоносный выбор, ясная ставка и обещание перемены",
    target_audience: "зрители, которые ищут ориентиры перед важными жизненными решениями",
    visual_mode: "AUTO",
  },
  {
    match: /сегодня|дневн|каждый день|daily|today/iu,
    category: "Horoscope",
    niche: "ежедневные персональные прогнозы и практические ориентиры на текущий день",
    tone: "ясный, живой, полезный, эмоциональный",
    topics: ["главное событие дня", "предупреждение", "отношения", "работа", "решение"],
    formats: ["Главное событие дня", "Предупреждение до конца дня", "Неожиданный шанс сегодня"],
    video_length: 30,
    hook_style: "актуальная дата, прямое обращение и конкретная польза на сегодня",
    target_audience: "зрители, которые ежедневно смотрят короткие персональные прогнозы",
    visual_mode: "AUTO",
  },
];

const DEFAULT_PROFILE: Omit<HoroscopeIdentityPreset, "match"> = {
  category: "Horoscope",
  niche: "персональные прогнозы для знаков зодиака с фокусом на решения, события и отношения",
  tone: "ясный, интригующий, эмоциональный, полезный",
  topics: ["событие дня", "отношения", "деньги", "решение", "предупреждение"],
  formats: ["Главный сигнал для знака", "То, чего сегодня лучше избежать", "Неожиданный поворот и лучший шаг"],
  video_length: 30,
  hook_style: "прямое обращение, интрига и конкретное обещание прогноза",
  target_audience: "зрители, которые регулярно смотрят короткие персональные прогнозы",
  visual_mode: "AUTO",
};

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
  const channelName = channelNameOf(connection);
  const matched = PROFILE_PRESETS.find((preset) => preset.match.test(channelName));
  const preset = matched || DEFAULT_PROFILE;
  const formats = preset.formats.map((format) => `${format} — «${channelName}»`);
  return {
    category: preset.category,
    niche: preset.niche,
    tone: preset.tone,
    topics: [...preset.topics],
    formats,
    video_length: preset.video_length,
    hook_style: preset.hook_style,
    target_audience: preset.target_audience,
    visual_mode: preset.visual_mode,
    channel_name: channelName,
  };
}

function voiceoverText(script: VideoScript): string {
  return [
    ...script.scenes.map((scene) => scene.voice_text.trim()),
    script.ending.trim(),
    script.cta.trim(),
  ].filter(Boolean).join(" ");
}

function cleanHoroscopeSpokenText(value: string): string {
  return value
    .replace(/(?:^|\n)\s*(?:КОНЕЦ СЕРИИ|ПРОДОЛЖЕНИЕ СЛЕДУЕТ[.!…]*|ТЕКСТ НА ЭКРАНЕ\s*:.*)\s*(?=\n|$)/giu, "\n")
    .replace(/\s*(?:КОНЕЦ СЕРИИ|ПРОДОЛЖЕНИЕ СЛЕДУЕТ[.!…]*)\s*$/giu, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
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
  currentContext?: HoroscopeCurrentContext;
}): Promise<HoroscopeContentPackage> {
  const currentContext = input.currentContext || createHoroscopeCurrentContext();
  const date = currentContext.current_date;
  const dateLabel = currentContext.forecast_date;
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
  const generatedScript = await generateVideoScript({
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
    antiRepetition: true,
    minimumScenes: 3,
    finalSceneMode: "forecast",
    allowRecoverableValidationFallback: true,
    instructions: [
      "СПЕЦИАЛЬНЫЙ РЕЖИМ: КОРОТКИЙ ДНЕВНОЙ ГОРОСКОП.",
      "Это не история и не фильм. Не создавай героя, сюжет, заказ, поездку, расследование, конфликт или кульминацию.",
      "Сценарий должен быть прямым прогнозом для указанного знака и даты.",
      `Первая произносимая фраза должна начинаться дословно: «Вы нашли это видео ${planItem?.forecast_date || dateLabel}, и это не просто так…»`,
      planItem ? `Сразу после обязательной фразы продолжи уникальным hook этого ролика: «${planItem.hook}».` : "",
      "Дай две короткие прогнозные мысли: что ждёт знак и второй дополнительный совет/предупреждение.",
      "Для ролика на 30 секунд используй минимум 3 отдельные сцены: обязательное вступление, основная прогнозная мысль и дополнительный совет. Не объединяй всё в одну или две сцены.",
      "Каждая сцена должна добавлять новую мысль. Не повторяй одну и ту же фразу и не используй одно содержательное слово более трёх раз в озвучке.",
      "Каждая сцена должна показывать отдельную тему прогноза или её короткое развитие; визуалы — знак зодиака, созвездие, планеты, луна, абстрактный космос.",
      "Не добавляй рекламный текст, рекрутинг, NOX, курьеров, логотипы, водяные знаки или текст на изображениях.",
      "Финал — короткое резюме прогноза или совет. В последней сцене story_beat укажи «итоговый совет», «резюме прогноза» или «вывод». CTA оставь пустым.",
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
  const sanitizedScript: VideoScript = {
    ...generatedScript,
    scenes: generatedScript.scenes.map((scene) => ({
      ...scene,
      voice_text: cleanHoroscopeSpokenText(scene.voice_text),
    })),
    ending: cleanHoroscopeSpokenText(generatedScript.ending),
    cta: "",
  };
  const opening = `Вы нашли это видео ${planItem?.forecast_date || dateLabel}, и это не просто так…`;
  const plannedHook = planItem?.hook.trim() || generatedScript.hook.trim();
  const firstScene = sanitizedScript.scenes[0];
  const firstVoice = firstScene?.voice_text.trim() || "";
  const voiceAfterOpening = firstVoice.startsWith(opening)
    ? firstVoice.slice(opening.length).trim()
    : firstVoice;
  const voiceWithUniqueHook = voiceAfterOpening.toLocaleLowerCase("ru-RU")
    .startsWith(plannedHook.toLocaleLowerCase("ru-RU"))
    ? voiceAfterOpening
    : `${plannedHook}${voiceAfterOpening ? ` ${voiceAfterOpening}` : ""}`;
  const script: VideoScript = firstScene
    ? {
      ...generatedScript,
      ending: sanitizedScript.ending,
      cta: "",
      hook: `${opening} ${plannedHook}`.trim(),
      scenes: [
        {
          ...firstScene,
          voice_text: `${opening} ${voiceWithUniqueHook}`.trim(),
        },
        ...sanitizedScript.scenes.slice(1),
      ],
    }
    : sanitizedScript;
  const metadata = await generateHoroscopeMetadata({
    topic: planItem
      ? `${planItem.zodiac_sign}, ${planItem.forecast_date || dateLabel}: ${planItem.topic} — ${planItem.subtopic}`
      : input.topic,
    channelName: input.config.channel_name,
    niche: input.config.niche,
    targetAudience: input.config.target_audience,
    hook: script.hook,
    script,
    planItem,
    currentContext,
    tone: input.config.tone,
    format: planItem?.format || format,
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
    description: metadata.description,
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