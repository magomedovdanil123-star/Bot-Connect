import { openRouterConfig } from "./openrouter-config";
import {
  FINANCE_BACKGROUND_LIBRARY,
  FINANCE_OBJECT_LIBRARY,
  type FinanceBackgroundId,
  type FinanceChartKind,
  type FinanceObjectKind,
} from "./finance-style-dna";
import {
  renderFinancialTopicShort,
  type FinancialConcept,
  type FinancialShortBeat,
  type FinancialShortRenderPlan,
  type FinancialVisualKind,
} from "./financial-short-renderer";

const MAX_TOPIC_LENGTH = 180;
const MIN_DURATION_SECONDS = 45;
const MAX_DURATION_SECONDS = 150;

type FinancialAiScene = {
  scene_number?: unknown;
  duration_seconds?: unknown;
  voice_text?: unknown;
  screen_text?: unknown;
  visual_hint?: unknown;
  visual_action?: unknown;
  objects?: unknown;
  camera_action?: unknown;
  text_animation?: unknown;
  sound_effect?: unknown;
  chart_type?: unknown;
};

type FinancialAiResponse = {
  title?: unknown;
  hook?: unknown;
  description?: unknown;
  duration_seconds?: unknown;
  scenes?: unknown;
  ending?: unknown;
  cta?: unknown;
  visual_concept?: unknown;
};

type TopicProfile = {
  entityLabel: string;
  metricLabel: string;
  maturityLabel: string;
  concept: FinancialConcept;
  definitionCaption: string;
  summaryItems: Array<[string, string]>;
  objectKinds: FinanceObjectKind[];
};

export type FinancialTopicPlan = FinancialShortRenderPlan & {
  topic: string;
  hook: string;
  description: string;
  targetDurationMs: number;
  visualConcept: FinancialConcept;
  objects: FinanceObjectKind[];
  backgroundLabel: string;
};

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseJson(content: string): FinancialAiResponse {
  const cleaned = content.trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "");
  try {
    return JSON.parse(cleaned) as FinancialAiResponse;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Финансовый AI не вернул JSON-план.");
    return JSON.parse(cleaned.slice(start, end + 1)) as FinancialAiResponse;
  }
}

async function requestFinancialScript(topic: string): Promise<FinancialAiResponse> {
  if (!openRouterConfig.apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  const system = [
    "Ты создаёшь образовательные русскоязычные YouTube Shorts о финансах.",
    "Работай только внутри fixed premium fintech style: dark navy, neon green, white typography, geometric motion graphics.",
    "Не давай индивидуальных инвестиционных рекомендаций и не обещай доход.",
    "Объясняй одну тему максимально ясно, разговорно и без воды.",
    "Пиши как редактор финансового медиа для новичка: используй «компания», «государство», «инвестор» и простые глаголы. Не используй искусственные слова вроде «госзаказчик», канцелярит и буквальный перевод англоязычных терминов.",
    "Сценарий должен укладываться в 45–150 секунд и содержать 6–8 визуальных сцен.",
    "voice_text — только произносимый текст. screen_text — короткая надпись до 45 символов.",
    "visual_concept выбирай по смыслу: bond_flow, equity_split, fund_pool, profit_distribution или generic_finance.",
    "Каждая сцена — отдельный смысловой сегмент с собственным действием, а не только смена подписи.",
    "visual_hint — что движется в сцене: money flow, document, share tiles, ownership pie, fund pool, asset cards, chart, coupon, calendar, warning или summary.",
    "visual_action — конкретное действие объектов в кадре. objects — массив из 2–6 object kinds. chart_type выбирай по смыслу: line, area, candlestick, bar, horizontal_bar, donut, waterfall, portfolio, timeline или sparkline.",
    "camera_action — push_in, pan_left, pan_right, follow_flow, orbit, pull_back или locked.",
    "text_animation — reveal, count_up, stamp, split или fade. sound_effect — короткий cue вроде whoosh, click, coin_tick, soft_riser или none; не добавляй громкие эффекты.",
    "Конкретные ставки и цифры используй только как явно помеченный учебный пример.",
    "Не повторяй одну и ту же мысль в ending и последней сцене. Ending должен быть коротким выводом, а cta обычно оставляй пустым.",
    "Верни только JSON без markdown в формате:",
    JSON.stringify({
      title: "Короткое название темы",
      hook: "Первая фраза, удерживающая внимание",
      description: "Что объясняет ролик",
      duration_seconds: 75,
      visual_concept: "bond_flow",
      scenes: [
        {
          scene_number: 1,
          duration_seconds: 9,
          voice_text: "Естественный текст для озвучки.",
          screen_text: "Короткий экранный текст",
          visual_hint: "investor → company, animated money flow",
          visual_action: "company card assembles, then money particles travel from investors to company",
          objects: ["investor", "company", "money_flow", "bond"],
           chart_type: "line",
          camera_action: "follow_flow",
          text_animation: "reveal",
          sound_effect: "whoosh",
        },
      ],
      ending: "Короткий образовательный вывод.",
      cta: "",
    }),
    "Финальная сцена должна завершать объяснение, а не добавлять новый факт.",
  ].join("\n");
  const user = `Тема финансового Shorts: ${topic}`;
  const models = Array.from(new Set([openRouterConfig.model, openRouterConfig.fallbackModel]));
  let lastError = "неизвестная ошибка";

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(openRouterConfig.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openRouterConfig.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://replit.com",
            "X-Title": "AI Content Factory Finance",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            max_completion_tokens: 5_000,
            response_format: { type: "json_object" },
            ...(model.startsWith("openai/gpt-5") ? { reasoning: { effort: "minimal" } } : {}),
          }),
          signal: AbortSignal.timeout(180_000),
        });
        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
        if (!response.ok) throw new Error(data.error?.message || `OpenRouter API error (${response.status})`);
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error("OpenRouter вернул пустой финансовый сценарий.");
        return parseJson(content);
      } catch (error) {
        lastError = error instanceof Error ? error.message : "ошибка запроса к OpenRouter";
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
      }
    }
  }
  throw new Error(`Не удалось создать финансовый AI-сценарий: ${lastError}`);
}

function topicProfile(topic: string): TopicProfile {
  const normalized = topic.toLocaleLowerCase("ru-RU");
  if (normalized.includes("дивиденд")) {
    return {
      entityLabel: "ДИВИДЕНД",
      metricLabel: "ВЫПЛАТА АКЦИОНЕРУ",
      maturityLabel: "ДОХОД ОТ АКЦИИ",
      concept: "profit_distribution",
      definitionCaption: "выплата владельцу",
      summaryItems: [["01", "Прибыль компании"], ["02", "Решение о выплате"], ["03", "Дата выплаты"], ["04", "Риск"]],
      objectKinds: ["investor", "company", "stock", "dividend", "percentage", "payment", "chart_up", "warning"],
    };
  }
  if (normalized.includes("акци")) {
    return {
      entityLabel: "АКЦИЯ",
      metricLabel: "ЦЕНА НА БИРЖЕ",
      maturityLabel: "ДОЛЯ В КОМПАНИИ",
      concept: "equity_split",
      definitionCaption: "часть компании",
      summaryItems: [["01", "Бизнес"], ["02", "Цена"], ["03", "Дивиденды"], ["04", "Риск"]],
      objectKinds: ["investor", "company", "stock", "money", "chart_up", "chart_down", "portfolio", "warning"],
    };
  }
  if (normalized.includes("паев") || normalized.includes("бпиф") || normalized.includes("фонд")) {
    return {
      entityLabel: normalized.includes("бпиф") ? "БПИФ" : "ПАЕВОЙ ФОНД",
      metricLabel: "СТОИМОСТЬ ПАЯ",
      maturityLabel: "ДОЛЯ В ПОРТФЕЛЕ",
      concept: "fund_pool",
      definitionCaption: "общий портфель",
      summaryItems: [["01", "Состав фонда"], ["02", "Активы"], ["03", "Комиссия"], ["04", "Риск"]],
      objectKinds: ["investor", "broker", "stock", "bond", "gold", "portfolio", "percentage", "chart_up", "warning"],
    };
  }
  if (normalized.includes("облига") || normalized.includes("офз") || normalized.includes("купон")) {
    return {
      entityLabel: normalized.includes("офз") ? "ОФЗ" : "ОБЛИГАЦИЯ",
      metricLabel: normalized.includes("офз") ? "КУПОН ГОСУДАРСТВА" : "18% ГОДОВЫХ",
      maturityLabel: "ВОЗВРАТ НОМИНАЛА",
      concept: "bond_flow",
      definitionCaption: "вернуть деньги",
      summaryItems: [["01", "Срок"], ["02", "Доходность"], ["03", "Рейтинг"], ["04", "Риск"]],
      objectKinds: ["investor", "company", "government", "bond", "money", "coupon", "percentage", "calendar", "warning"],
    };
  }
  return {
    entityLabel: topic.toLocaleUpperCase("ru-RU").slice(0, 24),
    metricLabel: "ФИНАНСОВЫЙ ПОКАЗАТЕЛЬ",
    maturityLabel: "ГЛАВНЫЙ ВЫВОД",
    concept: "generic_finance",
    definitionCaption: "как это работает",
    summaryItems: [["01", "Механика"], ["02", "Срок"], ["03", "Доход"], ["04", "Риск"]],
    objectKinds: ["investor", "money", "document", "percentage", "chart_up", "warning", "calculator"],
  };
}

function inferVisualKind(
  topic: string,
  scene: FinancialAiScene,
  index: number,
  total: number,
  concept: FinancialConcept,
): FinancialVisualKind {
  const source = [
    topic,
    textValue(scene.voice_text),
    textValue(scene.screen_text),
    textValue(scene.visual_hint),
  ].join(" ").toLocaleLowerCase("ru-RU");
  if (index === 0) return "hook";
  if (index === total - 1) return "summary";
  if (index === 1) {
    if (concept === "equity_split") return "ownership";
    if (concept === "fund_pool") return "fund";
    if (concept === "profit_distribution") return "distribution";
    return "definition";
  }
  if (concept === "equity_split") {
    if (index === 2) return "ownership";
    if (index === 3 || /цен[аы]|бирж|график|раст[её]т|пада/iu.test(source)) return "market";
    if (index === 4 && /дивиденд|выплат|доход/iu.test(source)) return "coupon";
  }
  if (concept === "fund_pool") {
    if (index === 2) return "fund";
    if (index === 3 && /график|стоим|доход|индекс|показател/iu.test(source)) return "market";
    if (index === 4) return "fund";
  }
  if (concept === "profit_distribution") {
    if (index === 2) return "distribution";
    if (index === 3) return /дата|срок|период|календар/iu.test(source) ? "calendar" : "distribution";
    if (index === 4) return "distribution";
  }
  if (/итого|вывод|перед покуп|проверь|важно помнить|риск/iu.test(source)) return "summary";
  if (concept === "equity_split" && /акци|дол[яи]|совлад|част[ьи]|дол[юя]/iu.test(source)) return "ownership";
  if (concept === "fund_pool" && /фонд|па[йя]|актив|портфел|инвестор|золот|облигац|акци/iu.test(source)) return "fund";
  if (concept === "profit_distribution" && /прибыл|распредел|выплат|акционер|дивиденд/iu.test(source)) return "distribution";
  if (/дивиденд|купон|процент|выплат|доход/iu.test(source)) return "coupon";
  if (/цен[аы]|бирж|раст[её]т|пада|график|волатил|рын[окке]/iu.test(source)) return "market";
  if (/срок|дата|месяц|год|период|календар/iu.test(source)) return "calendar";
  if (/покуп|инвест|деньг|переда|влож|капитал|сч[её]т/iu.test(source)) return "flow";
  return index % 2 === 0 ? "definition" : "flow";
}

function fallbackTitle(topic: string, scene: FinancialAiScene, profile: TopicProfile, index: number): string {
  const screen = textValue(scene.screen_text);
  if (screen) return screen.toLocaleUpperCase("ru-RU").slice(0, 64);
  if (index === 0) return `ЧТО ТАКОЕ ${profile.entityLabel}?`;
  if (index === 1) return `${profile.entityLabel}: ГЛАВНАЯ ИДЕЯ`;
  if (index >= 5) return "ПРОВЕРЬ РИСК";
  return topic.toLocaleUpperCase("ru-RU").slice(0, 64);
}

function fallbackSubtitle(scene: FinancialAiScene, kind: FinancialVisualKind, profile: TopicProfile): string {
  const screen = textValue(scene.screen_text);
  if (screen && screen.length <= 110) return screen;
  const voice = textValue(scene.voice_text);
  if (voice) return voice.length <= 120 ? voice : `${voice.slice(0, 117).trim()}…`;
  if (kind === "coupon") return profile.metricLabel;
  if (kind === "market") return "Цена и риск могут меняться.";
  return `Разбираем тему: ${profile.entityLabel.toLocaleLowerCase("ru-RU")}.`;
}

function backgroundForTopic(topic: string): FinanceBackgroundId {
  const hash = [...topic].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return FINANCE_BACKGROUND_LIBRARY[hash % FINANCE_BACKGROUND_LIBRARY.length]!.id;
}

function backgroundForScene(topic: string, index: number): FinanceBackgroundId {
  const hash = [...topic].reduce((sum, character) => sum + character.charCodeAt(0), index * 37);
  return FINANCE_BACKGROUND_LIBRARY[Math.abs(hash) % FINANCE_BACKGROUND_LIBRARY.length]!.id;
}

function chartKindForScene(scene: FinancialAiScene, visual: FinancialVisualKind, index: number, concept: FinancialConcept): FinanceChartKind {
  const requested = textValue(scene.chart_type) as FinanceChartKind;
  const supported: FinanceChartKind[] = [
    "line", "area", "candlestick", "bar", "horizontal_bar", "donut",
    "waterfall", "portfolio", "timeline", "sparkline",
  ];
  if (supported.includes(requested)) return requested;
  if (visual === "ownership" || visual === "fund") return visual === "fund" ? "portfolio" : "donut";
  if (visual === "distribution") return concept === "profit_distribution" ? "waterfall" : "bar";
  if (visual === "market") {
    if (concept === "bond_flow") return index % 2 ? "line" : "candlestick";
    if (concept === "fund_pool") return "area";
    return index % 2 ? "candlestick" : "line";
  }
  return index % 2 ? "sparkline" : "line";
}

function collectObjects(profile: TopicProfile, beats: FinancialShortBeat[]): FinanceObjectKind[] {
  const inferred = new Set<FinanceObjectKind>(profile.objectKinds);
  beats.forEach((beat) => {
    if (beat.visual === "market") inferred.add("chart_up");
    if (beat.visual === "coupon") inferred.add("percentage");
    if (beat.visual === "calendar") inferred.add("calendar");
    if (beat.visual === "summary") inferred.add("warning");
    if (beat.visual === "flow") inferred.add("money_flow");
    for (const kind of beat.objectKinds ?? []) {
      if (FINANCE_OBJECT_LIBRARY.some((definition) => definition.kind === kind)) {
        inferred.add(kind as FinanceObjectKind);
      }
    }
  });
  return FINANCE_OBJECT_LIBRARY
    .map((definition) => definition.kind)
    .filter((kind) => inferred.has(kind));
}

export async function createFinancialTopicPlan(topicInput: string): Promise<FinancialTopicPlan> {
  const topic = topicInput.trim().replace(/\s+/g, " ").slice(0, MAX_TOPIC_LENGTH);
  if (!topic) throw new Error("Укажите тему финансового ролика.");
  const ai = await requestFinancialScript(topic);
  const rawScenes = Array.isArray(ai.scenes) ? ai.scenes : [];
  if (rawScenes.length < 4) throw new Error("AI-сценарий финансового ролика содержит слишком мало сцен.");
  const profile = topicProfile(topic);
  const concept = (textValue(ai.visual_concept) as FinancialConcept) || profile.concept;
  const selectedConcept: FinancialConcept = [
    "bond_flow",
    "equity_split",
    "fund_pool",
    "profit_distribution",
    "generic_finance",
  ].includes(concept) ? concept : profile.concept;
  const scenes = rawScenes
    .filter((scene): scene is FinancialAiScene => Boolean(scene && typeof scene === "object"))
    .slice(0, 8);
  const totalSceneSeconds = scenes.reduce((sum, scene, index) => sum + Math.max(4, numberValue(scene.duration_seconds, index === 0 ? 8 : 9)), 0);
  const requestedDuration = Math.max(
    MIN_DURATION_SECONDS,
    Math.min(MAX_DURATION_SECONDS, numberValue(ai.duration_seconds, totalSceneSeconds)),
  );
  let cursor = 0;
  const beats: FinancialShortBeat[] = scenes.map((scene, index) => {
    const rawDuration = Math.max(4, numberValue(scene.duration_seconds, 8));
    const durationRatio = rawDuration / totalSceneSeconds;
    const from = cursor;
    const to = index === scenes.length - 1 ? 1 : Math.min(1, cursor + durationRatio);
    cursor = to;
    const visual = inferVisualKind(topic, scene, index, scenes.length, selectedConcept);
    const sceneVoice = textValue(scene.voice_text);
    return {
      id: `financial-${index + 1}`,
      from,
      to,
      visual,
      title: fallbackTitle(topic, scene, profile, index),
      subtitle: fallbackSubtitle(scene, visual, profile),
      voiceText: sceneVoice,
      visualAction: textValue(scene.visual_action, textValue(scene.visual_hint)),
      cameraAction: textValue(scene.camera_action, "locked"),
      textAnimation: textValue(scene.text_animation, "reveal"),
      soundEffect: textValue(scene.sound_effect, "none"),
      concept: selectedConcept,
      objectKinds: stringArray(scene.objects),
      background: backgroundForScene(topic, index),
      chartKind: chartKindForScene(scene, visual, index, selectedConcept),
      entityLabel: profile.entityLabel,
      metricLabel: profile.metricLabel,
      maturityLabel: profile.maturityLabel,
      definitionCaption: profile.definitionCaption,
      summaryItems: profile.summaryItems,
    };
  });
  const voiceParts = scenes.map((scene) => textValue(scene.voice_text)).filter(Boolean);
  const ending = textValue(ai.ending);
  const cta = textValue(ai.cta);
  const script = [...voiceParts, ending, cta].filter(Boolean).join("\n\n").trim();
  if (!script) throw new Error("AI-сценарий финансового ролика не содержит текста для озвучки.");
  const lastBeat = beats.at(-1);
  if (lastBeat) {
    lastBeat.voiceText = [lastBeat.voiceText, ending, cta].filter(Boolean).join("\n\n").trim();
  }
  const background = backgroundForTopic(topic);
  const backgroundLabel = FINANCE_BACKGROUND_LIBRARY.find((item) => item.id === background)?.label || background;
  return {
    topic,
    title: textValue(ai.title, `Финансы: ${topic}`).slice(0, 100),
    mainTitle: textValue(ai.title, topic).toLocaleUpperCase("ru-RU").slice(0, 54),
    script,
    targetDurationMs: requestedDuration * 1_000,
    visualConcept: selectedConcept,
    beats,
    background,
    hook: textValue(ai.hook, beats[0]?.subtitle || topic),
    description: textValue(ai.description, `Образовательный ролик о теме «${topic}».`),
    objects: collectObjects(profile, beats),
    backgroundLabel,
  };
}

export async function renderFinancialTopicFromTheme(topic: string): Promise<{
  plan: FinancialTopicPlan;
  buffer: Buffer;
  durationMs: number;
}> {
  const plan = await createFinancialTopicPlan(topic);
  const rendered = await renderFinancialTopicShort(plan);
  return { plan, buffer: rendered.buffer, durationMs: rendered.durationMs };
}