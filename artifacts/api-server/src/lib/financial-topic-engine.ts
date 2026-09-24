import { openRouterConfig } from "./openrouter-config";
import {
  FINANCE_BACKGROUND_LIBRARY,
  FINANCE_OBJECT_LIBRARY,
  FINANCE_TEMPLATE_LIBRARY,
  type FinanceBackgroundId,
  type FinanceChartKind,
  type FinanceObjectKind,
  type FinanceTemplateId,
} from "./finance-style-dna";
import {
  renderFinancialTopicShort,
  type FinancialConcept,
  type FinancialShortBeat,
  type FinancialShortRenderPlan,
  type FinancialVisualKind,
} from "./financial-short-renderer";

export const MAX_FINANCIAL_TOPIC_LENGTH = 180;
export const MAX_FINANCIAL_CTA_LENGTH = 240;
const MIN_DURATION_SECONDS = 45;
const MAX_DURATION_SECONDS = 150;
const MIN_SCENES = 6;
const MAX_SCENES = 12;

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

type FinancialTemplateResponse = {
  template_id?: unknown;
  scene_count?: unknown;
  reason?: unknown;
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
  cta: string;
  hook: string;
  description: string;
  targetDurationMs: number;
  visualConcept: FinancialConcept;
  objects: FinanceObjectKind[];
  backgroundLabel: string;
  templateId: FinanceTemplateId;
  templateLabel: string;
  templateReason: string;
};

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

export function normalizeFinancialCta(value: string): string {
  const cta = value.trim().replace(/\s+/g, " ");
  if (cta.length > MAX_FINANCIAL_CTA_LENGTH) {
    throw new Error(`CTA должен быть не длиннее ${MAX_FINANCIAL_CTA_LENGTH} символов.`);
  }
  return cta;
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

async function requestOpenRouterJson<T>(
  system: string,
  user: string,
  errorLabel: string,
  maxCompletionTokens = 5_000,
): Promise<T> {
  if (!openRouterConfig.apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
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
            max_completion_tokens: maxCompletionTokens,
            response_format: { type: "json_object" },
            ...(model.startsWith("openai/gpt-5") ? { reasoning: { effort: "minimal" } } : {}),
          }),
          signal: AbortSignal.timeout(180_000),
        });
        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
        if (!response.ok) throw new Error(data.error?.message || `OpenRouter API error (${response.status})`);
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error(`OpenRouter вернул пустой ответ: ${errorLabel}.`);
        return parseJson(content) as T;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "ошибка запроса к OpenRouter";
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
      }
    }
  }
  throw new Error(`Не удалось получить ${errorLabel}: ${lastError}`);
}

function templateCatalog(): string {
  return FINANCE_TEMPLATE_LIBRARY
    .map((template) => `${template.id}: ${template.label}; ${template.description}; ${template.minScenes}–${template.maxScenes} сцен; последовательность: ${template.sequence.join(" → ")}`)
    .join("\n");
}

async function requestFinancialTemplate(topic: string): Promise<{
  id: FinanceTemplateId;
  sceneCount: number;
  reason: string;
}> {
  const system = [
    "Ты — visual director финансовых YouTube Shorts.",
    "Сначала выбери один шаблон визуальной драматургии для темы. Не пиши сценарий и не выбирай случайно.",
    "Оцени смысл темы: контракт, рынок, портфель, риск, время, сравнение, денежный поток или payoff.",
    "Количество сцен должно быть осмысленным и находиться в диапазоне 6–12. Не выбирай всегда 6.",
    "Верни только JSON без markdown:",
    JSON.stringify({
      template_id: "market_dashboard",
      scene_count: 9,
      reason: "Почему эта визуальная структура лучше объясняет тему.",
    }),
    "",
    "Доступные шаблоны:",
    templateCatalog(),
  ].join("\n");
  const response = await requestOpenRouterJson<FinancialTemplateResponse>(
    system,
    `Тема финансового Shorts: ${topic}`,
    "выбор визуального шаблона",
    1_500,
  );
  const requestedId = textValue(response.template_id) as FinanceTemplateId;
  const template = FINANCE_TEMPLATE_LIBRARY.find((candidate) => candidate.id === requestedId)
    ?? FINANCE_TEMPLATE_LIBRARY.find((candidate) => candidate.id === "minimal_explainer")!;
  const requestedCount = Math.round(numberValue(response.scene_count, template.minScenes));
  const sceneCount = Math.max(template.minScenes, Math.min(template.maxScenes, requestedCount));
  return {
    id: template.id,
    sceneCount,
    reason: textValue(response.reason, template.description).slice(0, 240),
  };
}

async function requestFinancialScript(
  topic: string,
  template: { id: FinanceTemplateId; sceneCount: number; reason: string },
): Promise<FinancialAiResponse> {
  const selectedTemplate = FINANCE_TEMPLATE_LIBRARY.find((candidate) => candidate.id === template.id)
    ?? FINANCE_TEMPLATE_LIBRARY.find((candidate) => candidate.id === "minimal_explainer")!;
  const futuresTopic = topicProfile(topic).concept === "futures_contract";
  const system = [
    "Ты создаёшь образовательные русскоязычные YouTube Shorts о финансах.",
    futuresTopic
      ? "Для фьючерсов используй светлую премиальную студию, крупного иллюстрированного ведущего по пояс, выразительные жесты, короткие акцентные надписи и чистые векторные финансовые пиктограммы; обязательно сохрани крупные графики."
      : "Работай внутри dark navy fintech style с яркими scene-specific accent colors, white typography и geometric motion graphics.",
    "Не давай индивидуальных инвестиционных рекомендаций и не обещай доход.",
    "Объясняй одну тему максимально ясно, разговорно и без воды.",
    "Пиши как редактор финансового медиа для новичка: используй «компания», «государство», «инвестор» и простые глаголы.",
    `Визуальный шаблон уже выбран до написания сценария: ${selectedTemplate.id} — ${selectedTemplate.label}.`,
    `Логика шаблона: ${selectedTemplate.description}. Рекомендуемая последовательность: ${selectedTemplate.sequence.join(" → ")}.`,
    `Причина выбора шаблона: ${template.reason}.`,
    `Сгенерируй ровно ${template.sceneCount} сцен. Не сокращай до шести и не объединяй разные смысловые шаги.`,
    "Каждая сцена должна быть отдельным смысловым сегментом с собственным объектом, действием, композицией и движением.",
    "Сценарий должен укладываться в 45–150 секунд. voice_text — только произносимый текст. screen_text — короткая надпись до 45 символов.",
    "visual_concept выбирай по смыслу: bond_flow, equity_split, fund_pool, profit_distribution, futures_contract или generic_finance.",
    "visual_hint — что движется в сцене: money flow, document, share tiles, ownership pie, fund pool, asset cards, chart, coupon, calendar, warning, comparison, leverage, payoff или summary.",
    "visual_action — конкретное действие объектов в кадре. objects — массив из 2–6 object kinds. chart_type выбирай по смыслу: line, area, candlestick, bar, horizontal_bar, donut, waterfall, portfolio, timeline или sparkline.",
    "camera_action — push_in, pan_left, pan_right, follow_flow, orbit, pull_back или locked.",
    "text_animation — reveal, count_up, stamp, split или fade. sound_effect — короткий cue вроде whoosh, click, coin_tick, soft_riser или none.",
    "Не повторяй один и тот же visual_hint или chart_type в соседних сценах, если это не требуется смыслом шаблона.",
    "Конкретные ставки и цифры используй только как явно помеченный учебный пример.",
    ...(futuresTopic ? [
      "Для фьючерсов объясни обязательства сторон, позицию лонг/шорт, гарантийное обеспечение и payoff-график. Не утверждай, что любой контракт всегда заканчивается физической поставкой или что убыток всегда ограничен размером залога.",
      "Если используешь цифры, явно назови их условным учебным примером; не выдавай выдуманную котировку за рыночную.",
    ] : []),
    "Не повторяй одну и ту же мысль в ending и последней сцене. Ending должен быть коротким образовательным выводом.",
    "Не вставляй подписку, рекламу, просьбу о лайке или другой CTA внутрь voice_text. Поле cta оставляй пустым: пользовательский CTA добавляется отдельно после последней сцены.",
    "Верни только JSON без markdown в формате:",
    JSON.stringify({
      title: "Короткое название темы",
      hook: "Первая фраза, удерживающая внимание",
      description: "Что объясняет ролик",
      duration_seconds: 85,
      visual_concept: "bond_flow",
      scenes: [
        {
          scene_number: 1,
          duration_seconds: 8,
          voice_text: "Естественный текст для озвучки.",
          screen_text: "Короткий экранный текст",
          visual_hint: "document assembles, then money flow starts",
          visual_action: "objects enter separately and animate a concrete financial action",
          objects: ["investor", "company", "money_flow"],
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
  return requestOpenRouterJson<FinancialAiResponse>(
    system,
    `Тема финансового Shorts: ${topic}. Создай сценарий строго под выбранный шаблон.`,
    "финансовый сценарий",
  );
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
  if (normalized.includes("фьючерс")) {
    return {
      entityLabel: "ФЬЮЧЕРС",
      metricLabel: "ЦЕНА КОНТРАКТА",
      maturityLabel: "ИСПОЛНЕНИЕ В БУДУЩЕМ",
      concept: "futures_contract",
      definitionCaption: "обязательство на будущее",
      summaryItems: [["01", "Актив"], ["02", "Срок"], ["03", "Плечо"], ["04", "Риск"]],
      objectKinds: ["investor", "broker", "stock", "money", "percentage", "calendar", "chart_up", "chart_down", "calculator", "warning"],
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
  templateId: FinanceTemplateId,
): FinancialVisualKind {
  const source = [
    topic,
    textValue(scene.voice_text),
    textValue(scene.screen_text),
    textValue(scene.visual_hint),
  ].join(" ").toLocaleLowerCase("ru-RU");
  if (index === 0) return "hook";
  if (index === total - 1) return "summary";
  if (concept === "futures_contract" && templateId === "payoff_lab") {
    const futuresSequence: FinancialVisualKind[] = [
      "contract", "leverage", "market", "payoff", "payoff", "calendar", "risk",
    ];
    return futuresSequence[index - 1] ?? "definition";
  }
  const template = FINANCE_TEMPLATE_LIBRARY.find((candidate) => candidate.id === templateId)
    ?? FINANCE_TEMPLATE_LIBRARY.find((candidate) => candidate.id === "minimal_explainer")!;
  const sequence = template.sequence.slice(1, -1);
  const templateStep = sequence[(index - 1) % Math.max(1, sequence.length)] ?? "definition";
  const templateVisual: Record<string, FinancialVisualKind> = {
    contract: concept === "futures_contract" ? "contract" : "definition",
    flow: "flow",
    timeline: "calendar",
    market: "market",
    payoff: "payoff",
    fund: concept === "fund_pool" ? "fund" : "definition",
    donut: concept === "equity_split" ? "ownership" : "fund",
    portfolio: "fund",
    leverage: concept === "futures_contract" ? "leverage" : "market",
    comparison: "comparison",
    bar: "market",
    risk: "risk",
    coupon: "coupon",
    maturity: "maturity",
    definition: "definition",
  };
  if (templateVisual[templateStep]) return templateVisual[templateStep]!;
  if (index === 1) {
    if (concept === "equity_split") return "ownership";
    if (concept === "fund_pool") return "fund";
    if (concept === "profit_distribution") return "distribution";
    if (concept === "futures_contract") return "contract";
    return "definition";
  }
  if (concept === "futures_contract") {
    if (index === 2) return "leverage";
    if (index === 3) return "market";
    if (index === 4) return "payoff";
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

function backgroundForScene(topic: string, index: number, templateId: FinanceTemplateId): FinanceBackgroundId {
  const hash = [...`${topic}:${templateId}`].reduce((sum, character) => sum + character.charCodeAt(0), index * 37);
  return FINANCE_BACKGROUND_LIBRARY[Math.abs(hash) % FINANCE_BACKGROUND_LIBRARY.length]!.id;
}

function chartKindForScene(
  scene: FinancialAiScene,
  visual: FinancialVisualKind,
  index: number,
  concept: FinancialConcept,
  templateId: FinanceTemplateId,
): FinanceChartKind {
  const supported: FinanceChartKind[] = [
    "line", "area", "candlestick", "bar", "horizontal_bar", "donut",
    "waterfall", "portfolio", "timeline", "sparkline",
  ];
  const template = FINANCE_TEMPLATE_LIBRARY.find((candidate) => candidate.id === templateId);
  const templateSteps = template?.sequence.slice(1, -1) ?? [];
  const templateStep = templateSteps[(index - 1) % Math.max(1, templateSteps.length)];
  if (templateStep === "donut") return "donut";
  if (templateStep === "portfolio") return "portfolio";
  if (templateStep === "bar" || templateStep === "comparison") return "bar";
  if (templateStep === "timeline") return "timeline";
  if (templateStep === "payoff") return "area";
  const requested = textValue(scene.chart_type) as FinanceChartKind;
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
    if (beat.visual === "risk") inferred.add("warning");
    if (beat.visual === "comparison") {
      inferred.add("chart_up");
      inferred.add("chart_down");
    }
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

type FuturesSceneCopy = {
  voiceText: string;
  screenText: string;
  visualHint: string;
  visualAction: string;
  chartType: FinanceChartKind;
  cameraAction: string;
  objects: FinanceObjectKind[];
};

const FUTURES_SCENE_COPY: FuturesSceneCopy[] = [
  {
    voiceText: "Фьючерс — биржевой контракт, который обязывает стороны купить или продать актив на согласованных условиях и в установленный срок.",
    screenText: "КОНТРАКТ С ОБЯЗАТЕЛЬСТВОМ",
    visualHint: "a futures contract card opens beside an asset and settlement date",
    visualAction: "assemble the contract, asset and date into one clear agreement",
    chartType: "timeline",
    cameraAction: "push_in",
    objects: ["investor", "broker", "calendar", "stock"],
  },
  {
    voiceText: "В спецификации указаны базовый актив, размер контракта, срок и способ исполнения. Условия стандартизированы, но у разных контрактов они отличаются.",
    screenText: "АКТИВ · РАЗМЕР · СРОК · РАСЧЁТ",
    visualHint: "contract terms align as underlying asset, contract size, expiry and settlement",
    visualAction: "highlight the four fields in a futures contract specification",
    chartType: "timeline",
    cameraAction: "pan_right",
    objects: ["broker", "stock", "calendar", "calculator"],
  },
  {
    voiceText: "Для позиции обычно вносят гарантийное обеспечение. Это залог, а не покупка всего актива и не предел возможного убытка.",
    screenText: "ЗАЛОГ ≠ СТОИМОСТЬ АКТИВА",
    visualHint: "collateral card appears beside a larger notional position",
    visualAction: "show margin as collateral beside a larger futures position without implying capped losses",
    chartType: "bar",
    cameraAction: "push_in",
    objects: ["investor", "broker", "money", "percentage"],
  },
  {
    voiceText: "Цена фьючерса меняется вместе с рынком. Поэтому результат открытой позиции тоже меняется; на многих площадках его пересчитывают ежедневно.",
    screenText: "ЦЕНА МЕНЯЕТ РЕЗУЛЬТАТ",
    visualHint: "futures price line moves around a fixed entry marker",
    visualAction: "animate a market line across the entry price and update the position result",
    chartType: "line",
    cameraAction: "follow_flow",
    objects: ["chart_up", "chart_down", "calculator"],
  },
  {
    voiceText: "Учебный пример без комиссий: вход — 100, расчётная цена — 105. У лонга результат плюс 5 пунктов на единицу; сумма зависит от спецификации контракта.",
    screenText: "ВХОД 100 → РАСЧЁТ 105",
    visualHint: "illustrative payoff chart shows a long position from entry 100 to settlement 105 before fees",
    visualAction: "trace the long payoff from 100 to 105 and label the example illustrative",
    chartType: "line",
    cameraAction: "push_in",
    objects: ["chart_up", "chart_down", "calculator"],
  },
  {
    voiceText: "Если расчётная цена — 95, в этом же условном примере шорт получает плюс 5 пунктов, а лонг — минус 5, до комиссий. Это схема, не прогноз.",
    screenText: "ВХОД 100 → РАСЧЁТ 95",
    visualHint: "mirrored payoff chart compares long and short at entry 100 and settlement 95",
    visualAction: "show the short-side payoff at 95 as the inverse of the long example",
    chartType: "line",
    cameraAction: "pan_left",
    objects: ["chart_up", "chart_down", "calculator"],
  },
  {
    voiceText: "Одни контракты предусматривают поставку актива, другие — денежный расчёт. Срок и порядок исполнения указаны в спецификации конкретного фьючерса.",
    screenText: "ПОСТАВКА ИЛИ ДЕНЕЖНЫЙ РАСЧЁТ",
    visualHint: "settlement timeline branches into physical delivery and cash settlement",
    visualAction: "split the expiry path into delivery and cash settlement, both tied to contract terms",
    chartType: "timeline",
    cameraAction: "follow_flow",
    objects: ["calendar", "stock", "money"],
  },
  {
    voiceText: "Плечо усиливает и возможную прибыль, и убыток. По правилам площадки или брокера потери могут превысить начальное обеспечение, а позицию могут закрыть принудительно.",
    screenText: "УБЫТОК МОЖЕТ БЫТЬ ВЫШЕ ЗАЛОГА",
    visualHint: "risk meter shows margin call and possible losses beyond initial collateral",
    visualAction: "raise a clear warning as losses pass the initial margin threshold",
    chartType: "candlestick",
    cameraAction: "push_in",
    objects: ["warning", "money", "percentage"],
  },
  {
    voiceText: "Перед сделкой проверьте размер контракта, срок, способ расчёта, требования к обеспечению и возможный убыток. Фьючерс — это обязательство, а не просто прогноз цены.",
    screenText: "ПРОВЕРЬ СРОК · РАЗМЕР · РИСК",
    visualHint: "a final futures checklist confirms size, expiry, settlement and collateral",
    visualAction: "reveal a concise checklist beside the completed payoff diagram",
    chartType: "sparkline",
    cameraAction: "pull_back",
    objects: ["warning", "calendar", "calculator"],
  },
];

export async function createFinancialTopicPlan(
  topicInput: string,
  ctaInput = "",
): Promise<FinancialTopicPlan> {
  const topic = topicInput.trim().replace(/\s+/g, " ").slice(0, MAX_FINANCIAL_TOPIC_LENGTH);
  if (!topic) throw new Error("Укажите тему финансового ролика.");
  const cta = normalizeFinancialCta(ctaInput);
  const profile = topicProfile(topic);
  const requestedTemplate = await requestFinancialTemplate(topic);
  const payoffTemplate = FINANCE_TEMPLATE_LIBRARY.find((candidate) => candidate.id === "payoff_lab");
  const templateDecision = profile.concept === "futures_contract" && payoffTemplate
    ? {
        ...requestedTemplate,
        id: payoffTemplate.id,
        sceneCount: Math.max(
          payoffTemplate.minScenes,
          Math.min(payoffTemplate.maxScenes, FUTURES_SCENE_COPY.length),
        ),
        reason: "Для фьючерсов нужен отдельный разбор контракта, плеча, графика payoff и риска.",
      }
    : requestedTemplate;
  const selectedTemplate = FINANCE_TEMPLATE_LIBRARY.find((candidate) => candidate.id === templateDecision.id)
    ?? FINANCE_TEMPLATE_LIBRARY.find((candidate) => candidate.id === "minimal_explainer")!;
  const ai = await requestFinancialScript(topic, templateDecision);
  const rawScenes = Array.isArray(ai.scenes) ? ai.scenes : [];
  const concept = (textValue(ai.visual_concept) as FinancialConcept) || profile.concept;
  const aiConcept: FinancialConcept = [
    "bond_flow",
    "equity_split",
    "fund_pool",
    "profit_distribution",
    "futures_contract",
    "generic_finance",
  ].includes(concept) ? concept : profile.concept;
  const selectedConcept: FinancialConcept = profile.concept === "futures_contract"
    ? "futures_contract"
    : aiConcept;
  const aiScenes = rawScenes
    .filter((scene): scene is FinancialAiScene => Boolean(scene && typeof scene === "object"))
    .slice(0, templateDecision.sceneCount);
  if (aiScenes.length < templateDecision.sceneCount) {
    throw new Error(`AI-сценарий вернул ${aiScenes.length} сцен вместо запрошенных ${templateDecision.sceneCount}.`);
  }
  const scenes = profile.concept === "futures_contract"
    ? aiScenes.map((scene, index) => {
        const copy = FUTURES_SCENE_COPY[Math.min(index, FUTURES_SCENE_COPY.length - 1)]!;
        return {
          ...scene,
          voice_text: copy.voiceText,
          screen_text: copy.screenText,
          visual_hint: copy.visualHint,
          visual_action: copy.visualAction,
          chart_type: copy.chartType,
          camera_action: copy.cameraAction,
          objects: copy.objects,
        };
      })
    : aiScenes;
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
    const visual = inferVisualKind(topic, scene, index, scenes.length, selectedConcept, selectedTemplate.id);
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
      background: backgroundForScene(topic, index, selectedTemplate.id),
      chartKind: chartKindForScene(scene, visual, index, selectedConcept, selectedTemplate.id),
      entityLabel: profile.entityLabel,
      metricLabel: profile.metricLabel,
      maturityLabel: profile.maturityLabel,
      definitionCaption: profile.definitionCaption,
      summaryItems: profile.summaryItems,
    };
  });
  const voiceParts = scenes.map((scene) => textValue(scene.voice_text)).filter(Boolean);
  const isFuturesTopic = selectedConcept === "futures_contract";
  const ending = isFuturesTopic ? "" : textValue(ai.ending);
  const script = [...voiceParts, ending, cta].filter(Boolean).join("\n\n").trim();
  if (!script) throw new Error("AI-сценарий финансового ролика не содержит текста для озвучки.");
  const lastBeat = beats.at(-1);
  if (lastBeat) {
    lastBeat.voiceText = [lastBeat.voiceText, ending, cta].filter(Boolean).join("\n\n").trim();
  }
  const background = backgroundForTopic(topic);
  const backgroundLabel = selectedConcept === "futures_contract"
    ? "Зелёная студия с перспективной сеткой"
    : FINANCE_BACKGROUND_LIBRARY.find((item) => item.id === background)?.label || background;
  return {
    topic,
    cta,
    title: isFuturesTopic
      ? "Фьючерсы: контракт, график и риск"
      : textValue(ai.title, `Финансы: ${topic}`).slice(0, 100),
    mainTitle: isFuturesTopic
      ? "КАК РАБОТАЮТ ФЬЮЧЕРСЫ"
      : textValue(ai.title, topic).toLocaleUpperCase("ru-RU").slice(0, 54),
    script,
    targetDurationMs: requestedDuration * 1_000,
    visualConcept: selectedConcept,
    beats,
    background,
    visualTheme: "premium_creator",
    hook: isFuturesTopic
      ? beats[0]?.voiceText || "Как работает фьючерс?"
      : textValue(ai.hook, beats[0]?.subtitle || topic),
    description: isFuturesTopic
      ? "Объясняет обязательства по контракту, позиции лонг и шорт, график прибыли и убытка, гарантийное обеспечение и основные риски."
      : textValue(ai.description, `Образовательный ролик о теме «${topic}».`),
    objects: collectObjects(profile, beats),
    backgroundLabel,
    templateId: selectedTemplate.id,
    templateLabel: selectedTemplate.label,
    templateReason: templateDecision.reason,
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