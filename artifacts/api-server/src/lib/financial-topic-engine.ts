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
  type FinancialComposition,
  type FinancialConcept,
  type FinancialEntryAnimation,
  type FinancialExitAnimation,
  type FinancialShortBeat,
  type FinancialShortRenderPlan,
  type FinancialVisualMoment,
  type FinancialVisualMomentKind,
  type FinancialVisualPosition,
  type PresenterLayout,
  type FinancialVisualKind,
} from "./financial-short-renderer";

export const MAX_FINANCIAL_TOPIC_LENGTH = 180;
export const MAX_FINANCIAL_CTA_LENGTH = 240;
const MIN_DURATION_SECONDS = 45;
const MAX_DURATION_SECONDS = 150;
const MIN_SCENES = 6;
const MAX_SCENES = 12;
const MAX_VISUAL_MOMENTS_PER_SCENE = 12;
const WORDS_PER_VISUAL_MOMENT = 8;
const ESTIMATED_SPEECH_WORDS_PER_SECOND = 2.4;

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
  reason?: unknown;
};

type FinancialVisualPlanResponse = {
  scenes?: unknown;
};

type FinancialVisualPlanScene = {
  scene_number?: unknown;
  composition?: unknown;
  presenter_layout?: unknown;
  moments?: unknown;
};

type FinancialVisualPlanMoment = {
  voice_excerpt?: unknown;
  visual_kind?: unknown;
  label?: unknown;
  value?: unknown;
  detail?: unknown;
  source_label?: unknown;
  target_label?: unknown;
  position?: unknown;
  enter_animation?: unknown;
  exit_animation?: unknown;
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
    .map((template) => `${template.id}: ${template.label}; ${template.description}`)
    .join("\n");
}

async function requestFinancialTemplate(topic: string): Promise<{
  id: FinanceTemplateId;
  reason: string;
}> {
  const system = [
    "Ты — арт-директор финансовых YouTube Shorts.",
    "Выбери один визуальный стиль оформления из каталога. Он задаёт только подачу карточек и данных внутри единого бренда.",
    "Стиль НЕ задаёт число сцен, визуалы, последовательность, композицию, движения камеры, анимацию или монтаж — это будет придумано отдельно под конкретную тему.",
    "Не пиши сценарий и не выбирай случайно. Объясни выбор через читаемость и соответствие бренду.",
    "Верни только JSON без markdown:",
    JSON.stringify({
      template_id: "market_dashboard",
      reason: "Почему этот визуальный стиль подходит теме и сохраняет единый бренд.",
    }),
    "",
    "Доступные шаблоны:",
    templateCatalog(),
  ].join("\n");
  const response = await requestOpenRouterJson<FinancialTemplateResponse>(
    system,
    `Тема финансового Shorts: ${topic}`,
    "выбор визуального стиля",
    1_500,
  );
  const requestedId = textValue(response.template_id) as FinanceTemplateId;
  const template = FINANCE_TEMPLATE_LIBRARY.find((candidate) => candidate.id === requestedId)
    ?? FINANCE_TEMPLATE_LIBRARY.find((candidate) => candidate.id === "minimal_explainer")!;
  return {
    id: template.id,
    reason: textValue(response.reason, template.description).slice(0, 240),
  };
}

async function requestFinancialScript(
  topic: string,
  template: { id: FinanceTemplateId; reason: string },
  expectedConcept: FinancialConcept,
  fixedSceneCount?: number,
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
    `Точная визуальная концепция пользовательской темы: ${expectedConcept}. Не подменяй объяснение другим финансовым инструментом.`,
    `Фирменный визуальный стиль: ${selectedTemplate.id} — ${selectedTemplate.label}. ${selectedTemplate.description}`,
    `Причина выбора стиля: ${template.reason}. Стиль не задаёт содержание и порядок кадров.`,
    fixedSceneCount
      ? `Сгенерируй ровно ${fixedSceneCount} самостоятельных смысловых сцен для сохранения проверенной структуры этой темы.`
      : `Сгенерируй от ${MIN_SCENES} до ${MAX_SCENES} самостоятельных смысловых сцен по логике именно этой темы. Не копируй последовательность других роликов.`,
    "Каждая сцена — короткий связный смысловой блок озвучки. Визуальные поля здесь только черновые подсказки: после сценария отдельный AI visual director разобьёт речь на микро-сегменты и создаст полноценный Visual Plan.",
    "voice_text — только произносимый текст. screen_text — короткая надпись до 45 символов.",
    "visual_concept выбирай по смыслу: bond_flow, equity_split, fund_pool, profit_distribution, compound_interest, futures_contract или generic_finance.",
    "visual_hint — только краткая смысловая подсказка, не готовый шаблон сцены.",
    "visual_action — конкретное действие объектов в кадре. objects — массив из 2–6 object kinds. chart_type выбирай по смыслу: line, area, candlestick, bar, horizontal_bar, donut, waterfall, portfolio, timeline или sparkline.",
    "camera_action — push_in, pan_left, pan_right, follow_flow, orbit, pull_back или locked.",
    "text_animation — reveal, count_up, stamp, split или fade. sound_effect — короткий cue вроде whoosh, click, coin_tick, soft_riser или none.",
    "Не повторяй один и тот же visual_hint или chart_type в соседних сценах, если этого не требует смысл темы.",
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
      duration_seconds: 60,
      visual_concept: expectedConcept,
      scenes: [
        {
          scene_number: 1,
          duration_seconds: 8,
          voice_text: "Естественный текст для озвучки.",
          screen_text: "Короткий экранный текст",
          visual_hint: "show the topic-specific financial mechanism step by step",
          visual_action: "animate the entities and value flow described in narration",
          objects: ["investor", "money", "chart_up"],
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
  const response = await requestOpenRouterJson<FinancialAiResponse>(
    system,
    `Тема финансового Shorts: ${topic}. Создай сценарий строго под выбранный шаблон.`,
    "финансовый сценарий",
  );
  if (expectedConcept === "futures_contract") return response;
  const responseScenes = Array.isArray(response.scenes)
    ? response.scenes as FinancialAiScene[]
    : [];
  const spokenWordCount = wordsIn([
    ...responseScenes.map((scene) => textValue(scene.voice_text)),
    textValue(response.ending),
  ].join(" ")).length;
  return {
    ...response,
    duration_seconds: spokenWordCount / ESTIMATED_SPEECH_WORDS_PER_SECOND,
  };
}

const VISUAL_MOMENT_KINDS: FinancialVisualMomentKind[] = [
  "concept_card", "document", "money_flow", "metric", "market_chart", "comparison",
  "timeline", "ownership", "portfolio", "distribution", "risk", "compound_growth",
  "reinvestment", "payoff", "sticker",
];
const VISUAL_POSITIONS: FinancialVisualPosition[] = [
  "top_left", "top_center", "top_right", "center_left", "center", "center_right", "hero",
];
const VISUAL_ENTRY_ANIMATIONS: FinancialEntryAnimation[] = [
  "card_pop", "sticker_pop", "bounce", "slide_left", "slide_right", "slide_top",
  "slide_bottom", "scale_pop", "elastic_pop", "rotate_scale", "flip", "swipe",
  "spring", "floating", "notification",
];
const VISUAL_EXIT_ANIMATIONS: FinancialExitAnimation[] = [
  "slide_left", "slide_right", "slide_top", "slide_bottom", "shrink", "fade", "hold",
];
const VISUAL_COMPOSITIONS: FinancialComposition[] = [
  "center", "presenter_left", "presenter_right", "feature_card",
];
const PRESENTER_LAYOUTS: PresenterLayout[] = ["center", "left", "right", "large"];
const MOMENT_KINDS_BY_CONCEPT: Record<FinancialConcept, FinancialVisualMomentKind[]> = {
  bond_flow: ["concept_card", "document", "money_flow", "metric", "market_chart", "timeline", "comparison", "risk", "sticker"],
  equity_split: ["concept_card", "ownership", "market_chart", "distribution", "comparison", "risk", "metric", "sticker"],
  fund_pool: ["concept_card", "portfolio", "market_chart", "comparison", "distribution", "risk", "metric", "sticker"],
  profit_distribution: ["concept_card", "distribution", "timeline", "market_chart", "metric", "risk", "comparison", "sticker"],
  compound_interest: ["concept_card", "compound_growth", "reinvestment", "comparison", "metric", "market_chart", "timeline", "sticker"],
  futures_contract: ["concept_card", "money_flow", "market_chart", "payoff", "comparison", "risk", "timeline", "metric", "sticker"],
  generic_finance: VISUAL_MOMENT_KINDS,
};
const FALLBACK_KIND_CUES: Record<FinancialConcept, Array<[RegExp, FinancialVisualMomentKind]>> = {
  bond_flow: [
    [/облигац|долг|расписк|эмитент/iu, "document"],
    [/купон|процент|выплат|доходност/iu, "metric"],
    [/инвестор|компани|государств|деньг|переда|получ|влож/iu, "money_flow"],
    [/срок|год|дат|период/iu, "timeline"],
    [/риск|потер/iu, "risk"],
  ],
  equity_split: [
    [/доля|владе|акци|акционер|компани/iu, "ownership"],
    [/цен|бирж|график|рынок|раст/iu, "market_chart"],
    [/дивиденд|прибыл|выплат/iu, "distribution"],
    [/риск|потер/iu, "risk"],
  ],
  fund_pool: [
    [/портфел|фонд|пай|актив|золото|облигац|акци/iu, "portfolio"],
    [/дол|распредел/iu, "distribution"],
    [/цен|график|рынок/iu, "market_chart"],
    [/риск/iu, "risk"],
  ],
  profit_distribution: [
    [/дивиденд|прибыл|выплат|акционер|доход/iu, "distribution"],
    [/дат|срок|год|период/iu, "timeline"],
    [/цен|график|рынок/iu, "market_chart"],
    [/риск/iu, "risk"],
  ],
  compound_interest: [
    [/реинвест|добавля|снова влож/iu, "reinvestment"],
    [/рост|раст|капитал|сумм|процент|доход/iu, "compound_growth"],
    [/сравн|обычн|прост/iu, "comparison"],
    [/год|срок|период/iu, "timeline"],
    [/график|кривая/iu, "market_chart"],
  ],
  futures_contract: [
    [/лонг|шорт|позици|цена|рынок/iu, "market_chart"],
    [/прибыл|убыт|экспирац|расчёт/iu, "payoff"],
    [/залог|марж|риск/iu, "risk"],
    [/срок|дат|период/iu, "timeline"],
  ],
  generic_finance: [
    [/график|цен|рынок|рост/iu, "market_chart"],
    [/сравн|разниц/iu, "comparison"],
    [/процент|сумм|показател/iu, "metric"],
  ],
};

function wordsIn(value: string): string[] {
  return value.toLocaleLowerCase("ru-RU").match(/[\p{L}\p{N}]+/gu) ?? [];
}

function wordExcerpt(value: string, startWord: number, endWord: number): string {
  const matches = [...value.matchAll(/[\p{L}\p{N}]+/gu)];
  const start = matches[startWord]?.index;
  const last = matches[endWord - 1];
  if (start === undefined || last?.index === undefined) return "";
  return value.slice(start, last.index + last[0].length).trim();
}

function fallbackVisualKind(
  concept: FinancialConcept,
  excerpt: string,
  ordinal: number,
): FinancialVisualMomentKind {
  const allowed = MOMENT_KINDS_BY_CONCEPT[concept];
  const cue = FALLBACK_KIND_CUES[concept].find(([pattern, kind]) => pattern.test(excerpt) && allowed.includes(kind));
  if (cue) return cue[1];
  const text = excerpt.toLocaleLowerCase("ru-RU");
  let hash = ordinal;
  for (const character of text) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return allowed[hash % allowed.length]!;
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function findWordSequence(haystack: string[], needle: string[], fromIndex: number): number {
  if (!needle.length) return -1;
  for (let start = fromIndex; start <= haystack.length - needle.length; start += 1) {
    if (needle.every((word, offset) => haystack[start + offset] === word)) return start;
  }
  return -1;
}

function closestWordRange(
  sourceWords: string[],
  requestedWords: string[],
  expectedStart: number,
): { start: number; end: number } {
  const span = Math.max(1, Math.min(sourceWords.length, requestedWords.length || 4));
  const significantWords = [...new Set(requestedWords.filter((word) => word.length >= 4))];
  const maxStart = Math.max(0, sourceWords.length - span);
  let bestStart = Math.max(0, Math.min(maxStart, expectedStart));
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let start = 0; start <= maxStart; start += 1) {
    const window = new Set(sourceWords.slice(start, start + span));
    const overlap = significantWords.filter((word) => window.has(word)).length;
    const distance = Math.abs(start - expectedStart) / Math.max(1, sourceWords.length);
    const score = overlap * 10 - distance;
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }
  return { start: bestStart, end: Math.min(sourceWords.length, bestStart + span) };
}

function allowedEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  const candidate = textValue(value) as T;
  if (!allowed.includes(candidate)) {
    throw new Error(`AI Visual Plan: недопустимое значение ${label}: ${String(value)}.`);
  }
  return candidate;
}

function normalizeVisualPlan(
  response: FinancialVisualPlanResponse,
  scriptScenes: FinancialAiScene[],
  concept: FinancialConcept,
): Array<{
  moments: FinancialVisualMoment[];
  composition: FinancialComposition;
  presenterLayout: PresenterLayout;
}> {
  if (!Array.isArray(response.scenes) || response.scenes.length !== scriptScenes.length) {
    const actualCount = Array.isArray(response.scenes) ? response.scenes.length : "не массив";
    throw new Error(`AI Visual Plan должен содержать ${scriptScenes.length} сцен, получено: ${actualCount}.`);
  }

  const indexedScenes = new Map<number, FinancialVisualPlanScene>();
  response.scenes.forEach((candidate, responseIndex) => {
    if (!candidate || typeof candidate !== "object") {
      throw new Error(`AI Visual Plan: сцена ${responseIndex + 1} имеет неверный формат.`);
    }
    const scene = candidate as FinancialVisualPlanScene;
    const rawNumber = Number(scene.scene_number);
    const sceneIndex = Number.isInteger(rawNumber) ? rawNumber - 1 : responseIndex;
    if (sceneIndex < 0 || sceneIndex >= scriptScenes.length || indexedScenes.has(sceneIndex)) {
      throw new Error("AI Visual Plan: номера сцен отсутствуют, повторяются или выходят за диапазон.");
    }
    indexedScenes.set(sceneIndex, scene);
  });

  let sideLayoutCount = 0;
  const normalizedScenes = scriptScenes.map((scriptScene, sceneIndex) => {
    const planScene = indexedScenes.get(sceneIndex);
    if (!planScene) throw new Error(`AI Visual Plan: отсутствует сцена ${sceneIndex + 1}.`);
    const rawMoments = Array.isArray(planScene.moments) ? planScene.moments : [];
    if (rawMoments.length < 1 || rawMoments.length > MAX_VISUAL_MOMENTS_PER_SCENE) {
      throw new Error(`AI Visual Plan: сцена ${sceneIndex + 1} должна содержать 1–${MAX_VISUAL_MOMENTS_PER_SCENE} визуальных моментов.`);
    }

    const voice = textValue(scriptScene.voice_text);
    const voiceWords = wordsIn(voice);
    if (!voiceWords.length) throw new Error(`Сцена ${sceneIndex + 1} не содержит текста для синхронизации.`);
    const parsedMoments = rawMoments.map((candidate, momentIndex) => {
      if (!candidate || typeof candidate !== "object") {
        throw new Error(`AI Visual Plan: визуальный момент ${sceneIndex + 1}.${momentIndex + 1} имеет неверный формат.`);
      }
      const rawMoment = candidate as FinancialVisualPlanMoment;
      const requestedExcerpt = textValue(rawMoment.voice_excerpt);
      const excerptWords = wordsIn(requestedExcerpt);
      const exactWordStart = findWordSequence(voiceWords, excerptWords, 0);
      const range = exactWordStart >= 0
        ? { start: exactWordStart, end: exactWordStart + excerptWords.length }
        : closestWordRange(
          voiceWords,
          excerptWords,
          Math.floor(momentIndex * voiceWords.length / rawMoments.length),
        );
      const wordStart = range.start;
      const wordEnd = range.end;
      const voiceExcerpt = wordExcerpt(voice, wordStart, wordEnd);

      const kind = allowedEnum(rawMoment.visual_kind, MOMENT_KINDS_BY_CONCEPT[concept], "visual_kind");
      const value = textValue(rawMoment.value).slice(0, 30);
      const sourceText = `${voice} ${textValue(scriptScene.screen_text)}`.toLocaleLowerCase("ru-RU");
      const label = textValue(rawMoment.label, textValue(scriptScene.screen_text, voiceExcerpt)).slice(0, 48);
      const detail = textValue(rawMoment.detail).slice(0, 56);
      const displayNumbers = `${label} ${value} ${detail}`.match(/\d+(?:[.,]\d+)?/gu) ?? [];
      if (displayNumbers.some((number) => !sourceText.includes(number))) {
        throw new Error(`AI Visual Plan: момент ${sceneIndex + 1}.${momentIndex + 1} добавил число, которого нет в сценарии.`);
      }
      return {
        voiceExcerpt,
        wordStart,
        wordEnd,
        kind,
        label,
        value,
        detail,
        sourceLabel: textValue(rawMoment.source_label).slice(0, 24),
        targetLabel: textValue(rawMoment.target_label).slice(0, 24),
        position: allowedEnum(rawMoment.position, VISUAL_POSITIONS, "position"),
        enterAnimation: allowedEnum(rawMoment.enter_animation, VISUAL_ENTRY_ANIMATIONS, "enter_animation"),
        exitAnimation: allowedEnum(rawMoment.exit_animation, VISUAL_EXIT_ANIMATIONS, "exit_animation"),
      };
    });
    parsedMoments.sort((left, right) => left.wordStart - right.wordStart);
    const nonOverlappingMoments: typeof parsedMoments = parsedMoments.length ? [parsedMoments[0]!] : [];
    for (let momentIndex = 1; momentIndex < parsedMoments.length; momentIndex += 1) {
      const moment = parsedMoments[momentIndex]!;
      const previous = nonOverlappingMoments.at(-1);
      if (previous && moment.wordStart < previous.wordEnd) {
        if (moment.wordEnd <= previous.wordEnd) continue;
        moment.wordStart = previous.wordEnd;
        moment.voiceExcerpt = wordExcerpt(voice, moment.wordStart, moment.wordEnd);
      }
      if (wordsIn(moment.voiceExcerpt).length) nonOverlappingMoments.push(moment);
    }
    if (!nonOverlappingMoments.length) {
      throw new Error(`AI Visual Plan: сцена ${sceneIndex + 1} не содержит непересекающихся фраз.`);
    }

    const desiredMomentCount = Math.min(
      MAX_VISUAL_MOMENTS_PER_SCENE,
      voiceWords.length,
      Math.max(1, Math.ceil(voiceWords.length / WORDS_PER_VISUAL_MOMENT)),
    );
    const assignedMomentIndexes = new Set<number>();
    const fallbackPositions: FinancialVisualPosition[] = [
      "top_center", "top_left", "top_right", "center_left", "center_right", "hero",
    ];
    const moments: FinancialVisualMoment[] = Array.from({ length: desiredMomentCount }, (_, momentIndex) => {
      const startWord = Math.floor(momentIndex * voiceWords.length / desiredMomentCount);
      const endWord = Math.max(
        startWord + 1,
        Math.floor((momentIndex + 1) * voiceWords.length / desiredMomentCount),
      );
      const excerpt = wordExcerpt(voice, startWord, endWord);
      const matchingMoments = nonOverlappingMoments
        .map((moment, candidateIndex) => ({ moment, candidateIndex }))
        .filter(({ moment, candidateIndex }) =>
          !assignedMomentIndexes.has(candidateIndex)
          && moment.wordStart >= startWord
          && moment.wordStart < endWord)
        .sort((left, right) =>
          Math.abs(left.moment.wordStart - startWord)
          - Math.abs(right.moment.wordStart - startWord));
      const match = matchingMoments[0];
      const sourceMoment = match?.moment;
      if (match) assignedMomentIndexes.add(match.candidateIndex);
      const from = clampUnit(startWord / voiceWords.length);
      const to = clampUnit(endWord / voiceWords.length);
      const estimatedSeconds = (to - from) * voiceWords.length / ESTIMATED_SPEECH_WORDS_PER_SECOND;
      if (estimatedSeconds > 4) {
        throw new Error(`AI Visual Plan: момент ${sceneIndex + 1}.${momentIndex + 1} длится около ${estimatedSeconds.toFixed(1)} с; требуется разбивка до 4 с.`);
      }
      if (to <= from) throw new Error(`AI Visual Plan: пустой интервал у момента ${sceneIndex + 1}.${momentIndex + 1}.`);
      const segmentSource = `${excerpt} ${textValue(scriptScene.screen_text)}`.toLocaleLowerCase("ru-RU");
      const sourceDisplayNumbers = `${sourceMoment?.label ?? ""} ${sourceMoment?.value ?? ""} ${sourceMoment?.detail ?? ""}`
        .match(/\d+(?:[.,]\d+)?/gu) ?? [];
      const sourceMomentSafe = sourceDisplayNumbers.every((number) => segmentSource.includes(number));
      const label = sourceMomentSafe && sourceMoment?.label
        ? sourceMoment.label
        : excerpt.slice(0, 48);
      return {
        id: `visual-${sceneIndex + 1}-${momentIndex + 1}`,
        voiceExcerpt: excerpt,
        from,
        to,
        kind: sourceMoment?.kind ?? fallbackVisualKind(concept, excerpt, sceneIndex + momentIndex),
        label,
        value: sourceMomentSafe ? sourceMoment?.value || undefined : undefined,
        detail: sourceMomentSafe ? sourceMoment?.detail || undefined : undefined,
        sourceLabel: sourceMoment?.sourceLabel || undefined,
        targetLabel: sourceMoment?.targetLabel || undefined,
        position: sourceMoment?.position ?? fallbackPositions[(sceneIndex + momentIndex) % fallbackPositions.length]!,
        enterAnimation: sourceMoment?.enterAnimation
          ?? VISUAL_ENTRY_ANIMATIONS[(sceneIndex + momentIndex) % VISUAL_ENTRY_ANIMATIONS.length]!,
        exitAnimation: sourceMoment?.exitAnimation
          ?? VISUAL_EXIT_ANIMATIONS[(sceneIndex + momentIndex) % VISUAL_EXIT_ANIMATIONS.length]!,
      };
    });

    const rawComposition = textValue(planScene.composition) as FinancialComposition;
    const rawPresenterLayout = textValue(planScene.presenter_layout) as PresenterLayout;
    const validComposition = VISUAL_COMPOSITIONS.includes(rawComposition);
    const validPresenterLayout = PRESENTER_LAYOUTS.includes(rawPresenterLayout);
    let composition = validComposition
      ? rawComposition
      : rawPresenterLayout === "left"
        ? "presenter_left"
        : rawPresenterLayout === "right"
          ? "presenter_right"
          : rawPresenterLayout === "large"
            ? "feature_card"
            : "center";
    let presenterLayout = validPresenterLayout
      ? rawPresenterLayout
      : composition === "presenter_left"
        ? "left"
        : composition === "presenter_right"
          ? "right"
          : composition === "feature_card"
            ? "large"
            : "center";
    if (composition === "presenter_left" || presenterLayout === "left") composition = "presenter_left";
    if (composition === "presenter_right" || presenterLayout === "right") composition = "presenter_right";
    if (composition === "presenter_left" || composition === "presenter_right") {
      if (sceneIndex === 0 || sceneIndex === scriptScenes.length - 1 || sideLayoutCount >= 2) {
        composition = "center";
        presenterLayout = "center";
      } else {
        sideLayoutCount += 1;
        presenterLayout = composition === "presenter_left" ? "left" : "right";
      }
    } else if (composition === "feature_card") {
      presenterLayout = presenterLayout === "large" ? "large" : "center";
    } else {
      presenterLayout = presenterLayout === "large" ? "large" : "center";
      composition = "center";
    }

    return { moments, composition, presenterLayout };
  });
  if (normalizedScenes.length >= MIN_SCENES && normalizedScenes.every((scene) => scene.composition === "center")) {
    const middleCandidates = normalizedScenes.slice(1, -1).map((scene, offset) => ({
      scene,
      sceneIndex: offset + 1,
      sideScore: scene.moments.filter((moment) =>
        ["money_flow", "market_chart", "portfolio", "ownership", "distribution"].includes(moment.kind)).length,
      featureScore: scene.moments.filter((moment) =>
        ["concept_card", "document", "metric", "compound_growth", "payoff"].includes(moment.kind)).length,
    }));
    const selected = middleCandidates.reduce((best, candidate) =>
      candidate.sideScore + candidate.featureScore > best.sideScore + best.featureScore
        ? candidate
        : best);
    const useFeatureCard = selected.featureScore > selected.sideScore;
    if (useFeatureCard) {
      normalizedScenes[selected.sceneIndex] = {
        ...selected.scene,
        composition: "feature_card",
        presenterLayout: "large",
      };
    } else {
      const leftVisuals = selected.scene.moments.filter((moment) => moment.position.endsWith("left")).length;
      const rightVisuals = selected.scene.moments.filter((moment) => moment.position.endsWith("right")).length;
      const voiceHash = wordsIn(textValue(scriptScenes[selected.sceneIndex]?.voice_text))
        .join("")
        .split("")
        .reduce((sum, character) => sum + character.charCodeAt(0), 0);
      const presenterSide = leftVisuals > rightVisuals
        ? "right"
        : rightVisuals > leftVisuals
          ? "left"
          : voiceHash % 2 === 0
            ? "left"
            : "right";
      normalizedScenes[selected.sceneIndex] = {
        ...selected.scene,
        composition: presenterSide === "left" ? "presenter_left" : "presenter_right",
        presenterLayout: presenterSide,
      };
    }
  }
  return normalizedScenes;
}

async function requestFinancialVisualPlan(
  topic: string,
  concept: FinancialConcept,
  scriptScenes: FinancialAiScene[],
  template: { id: FinanceTemplateId; reason: string },
): Promise<Array<{
  moments: FinancialVisualMoment[];
  composition: FinancialComposition;
  presenterLayout: PresenterLayout;
}>> {
  const permittedKinds = MOMENT_KINDS_BY_CONCEPT[concept];
  const visualPlanExample = {
    scenes: scriptScenes.map((scene, sceneIndex) => {
      const voice = textValue(scene.voice_text);
      const wordCount = wordsIn(voice).length;
      const desiredMomentCount = Math.min(
        MAX_VISUAL_MOMENTS_PER_SCENE,
        wordCount,
        Math.max(1, Math.ceil(wordCount / WORDS_PER_VISUAL_MOMENT)),
      );
      return {
        scene_number: sceneIndex + 1,
        composition: "center",
        presenter_layout: "center",
        duration_seconds: wordCount / ESTIMATED_SPEECH_WORDS_PER_SECOND,
        moments: Array.from({ length: desiredMomentCount }, (_, momentIndex) => {
          const startWord = Math.floor(momentIndex * wordCount / desiredMomentCount);
          const endWord = Math.max(startWord + 1, Math.floor((momentIndex + 1) * wordCount / desiredMomentCount));
          return {
            voice_excerpt: wordExcerpt(voice, startWord, endWord),
            visual_kind: permittedKinds[(sceneIndex + momentIndex) % permittedKinds.length],
            label: "КЛЮЧЕВОЙ ФАКТ",
            value: "",
            detail: "",
            source_label: "",
            target_label: "",
            position: momentIndex % 2 === 0 ? "top_center" : "center",
            enter_animation: VISUAL_ENTRY_ANIMATIONS[(sceneIndex + momentIndex) % VISUAL_ENTRY_ANIMATIONS.length],
            exit_animation: VISUAL_EXIT_ANIMATIONS[(sceneIndex + momentIndex) % VISUAL_EXIT_ANIMATIONS.length],
          };
        }),
      };
    }),
  };
  const system = [
    "Ты — отдельный AI visual director финансовых YouTube Shorts. До рендера создай план того, что, где, когда и как появляется, и когда уходит.",
    "Сценарий и voice_text уже утверждены. Не переписывай их, не добавляй фразы и не меняй финансовый смысл.",
    `Ответ обязан содержать ровно ${scriptScenes.length} сцен: по одной на каждую входную сцену, с scene_number от 1 до ${scriptScenes.length}. Не возвращай только пример первой сцены.`,
    "В каждой сцене разбей voice_text на последовательные точные voice_excerpt — копируй фрагменты дословно и строго по порядку.",
    "Один визуальный момент должен занимать примерно 2–4 секунды речи. Если сцена длиннее 4 секунд, создай достаточно моментов, чтобы ни один не держался дольше 4 секунд. Короткую фразу не дроби искусственно.",
    "Каждый момент показывает новый смысл, связанный с его voice_excerpt, а не просто меняет цвет или делает fade. Варьируй карточки, документ, поток денег, график, шкалу, сравнение, sticker и цифры по теме.",
    "Для money_flow, distribution и reinvestment заполняй source_label и target_label участниками именно текущей фразы voice_excerpt. Не переноси участников из соседних фраз и не придумывай их; если сторону нельзя определить по этой фразе, оставь поле пустым.",
    `Для visual_kind используй только эти значения: ${permittedKinds.join(", ")}.`,
    "label и detail должны быть короткими. value можно заполнять только цифрой или коротким значением, которое буквально присутствует в screen_text; не выдумывай доходность, цену, тикер или число.",
    "Для каждого момента выбери position: top_left, top_center, top_right, center_left, center, center_right или hero. Не занимай нижнюю зону титров и лицо ведущего.",
    "Для каждого момента выбери enter_animation из card_pop, sticker_pop, bounce, slide_left, slide_right, slide_top, slide_bottom, scale_pop, elastic_pop, rotate_scale, flip, swipe, spring, floating, notification. Не повторяй тип анимации подряд.",
    "Для каждого момента выбери exit_animation из slide_left, slide_right, slide_top, slide_bottom, shrink, fade, hold. Укажи, как элемент покидает кадр.",
    "Для каждой сцены выбери composition строго только из center, presenter_left, presenter_right, feature_card, а presenter_layout строго только из center, left, right, large. Не помещай в composition название визуального объекта — объекты указывай только в moments[].visual_kind. Ведущий остаётся снизу; обычно он по центру, боковые варианты используй максимум в двух сценах и не в первой или последней. Для бокового ведущего размещай главный визуал с противоположной стороны.",
    `При ${MIN_SCENES} и более сценах хотя бы одна средняя сцена должна отличаться от center: presenter_left, presenter_right или feature_card. Выбери её по смыслу, не копируй фиксированный порядок.`,
    "Визуальный стиль из шаблона ниже влияет только на форму карточек и фирменную подачу, но не на sequence/content. Каждый ролик и порядок визуалов уникальны для своей темы.",
    "Верни только JSON без markdown:",
    JSON.stringify(visualPlanExample),
  ].join("\n");
  const user = JSON.stringify({
    topic,
    concept,
    brandStyle: {
      id: template.id,
      description: FINANCE_TEMPLATE_LIBRARY.find((candidate) => candidate.id === template.id)?.description,
      reason: template.reason,
    },
    allowedVisualKinds: permittedKinds,
    scenes: scriptScenes.map((scene, index) => ({
      scene_number: index + 1,
      duration_seconds: Math.max(
        1,
        wordsIn(textValue(scene.voice_text)).length / ESTIMATED_SPEECH_WORDS_PER_SECOND,
      ),
      voice_text: textValue(scene.voice_text),
      screen_text: textValue(scene.screen_text),
      visual_hint: textValue(scene.visual_hint),
      visual_action: textValue(scene.visual_action),
      objects: stringArray(scene.objects),
    })),
  });
  let previousResponse: FinancialVisualPlanResponse | undefined;
  let previousError = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const repairContext = attempt === 0
      ? { system, user }
      : {
          system: `${system}\nПредыдущий ответ не прошёл проверку: ${previousError}. Исправь только ошибки формата и синхронизации, сохранив точный сценарий.`,
          user: JSON.stringify({ task: user, invalid_plan: previousResponse }),
        };
    const response = await requestOpenRouterJson<FinancialVisualPlanResponse>(
      repairContext.system,
      repairContext.user,
      "AI Visual Plan",
      8_000,
    );
    try {
      return normalizeVisualPlan(response, scriptScenes, concept);
    } catch (error) {
      previousResponse = response;
      previousError = error instanceof Error ? error.message : "неизвестная ошибка проверки";
      if (attempt === 1) throw new Error(`AI Visual Plan не прошёл проверку после исправления: ${previousError}`);
    }
  }
  throw new Error("AI Visual Plan: не удалось создать валидный план.");
}

function topicProfile(topic: string): TopicProfile {
  const normalized = topic.toLocaleLowerCase("ru-RU");
  if (/сложн.{0,16}процент|капитализац|реинвест/iu.test(normalized)) {
    return {
      entityLabel: "СЛОЖНЫЙ ПРОЦЕНТ",
      metricLabel: "РОСТ НА РОСТ",
      maturityLabel: "КАПИТАЛ ЗА ПЕРИОД",
      concept: "compound_interest",
      definitionCaption: "проценты прибавляются к капиталу",
      summaryItems: [["01", "Стартовый капитал"], ["02", "Ставка"], ["03", "Реинвестирование"], ["04", "Срок и риск"]],
      objectKinds: ["money", "percentage", "calculator", "chart_up", "calendar", "wallet", "warning"],
    };
  }
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
): FinancialVisualKind {
  const source = [
    topic,
    textValue(scene.voice_text),
    textValue(scene.screen_text),
    textValue(scene.visual_hint),
    textValue(scene.visual_action),
  ].join(" ").toLocaleLowerCase("ru-RU");
  if (index === 0) return "hook";
  if (index === total - 1) return "summary";
  if (/итого|вывод|перед покуп|проверь|важно помнить|риск/iu.test(source)) return "risk";

  if (concept === "futures_contract") {
    if (/залог|обеспечен|марж|плеч/iu.test(source)) return "leverage";
    if (/лонг|шорт|результат|payoff|прибыл|убыт/iu.test(source)) return "payoff";
    if (/цен[аы]|бирж|график|рын[окке]/iu.test(source)) return "market";
    if (/срок|дата|исполн|расч[её]т/iu.test(source)) return "calendar";
    if (/контракт|спецификац|обязательств/iu.test(source)) return "contract";
    return "definition";
  }

  if (concept === "compound_interest") {
    if (/риск|инфляц|срок|год|период/iu.test(source)) return /риск|инфляц/iu.test(source) ? "risk" : "calendar";
    if (/капитал|реинвест|сложн|процент|рост|сумм/iu.test(source)) return "compound_growth";
    if (/сравн|прост(ой|ые) процент/iu.test(source)) return "comparison";
    return "definition";
  }

  if (concept === "equity_split") {
    if (/доля|владел|совлад|акционер|голос/iu.test(source)) return "ownership";
    if (/цен[аы]|бирж|график|раст[её]т|пада|рын[окке]/iu.test(source)) return "market";
    if (/дивиденд|выплат|прибыл/iu.test(source)) return "coupon";
    return "definition";
  }

  if (concept === "fund_pool") {
    if (/график|стоим|индекс|рын[окке]/iu.test(source)) return "market";
    if (/комисс|состав|актив|портфел|фонд|па[йя]|золот|облигац|акци/iu.test(source)) return "fund";
    if (/риск|сниж|паден/iu.test(source)) return "risk";
    return "definition";
  }

  if (concept === "profit_distribution") {
    if (/дата|срок|период|календар/iu.test(source)) return "calendar";
    if (/прибыл|распредел|выплат|акционер|дивиденд/iu.test(source)) return "distribution";
    if (/график|цена|рын[окке]/iu.test(source)) return "market";
    return "coupon";
  }

  if (concept === "bond_flow") {
    if (/срок|погаш|возврат номинал/iu.test(source)) return "maturity";
    if (/купон|процент|выплат|доходност/iu.test(source)) return "coupon";
    if (/дата|месяц|год|период|календар/iu.test(source)) return "calendar";
    if (/цен[аы]|бирж|график|рын[окке]/iu.test(source)) return "market";
    if (/деньг|переда|инвестор|влож|капитал/iu.test(source)) return "flow";
    return "definition";
  }

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
): FinanceChartKind {
  const supported: FinanceChartKind[] = [
    "line", "area", "candlestick", "bar", "horizontal_bar", "donut",
    "waterfall", "portfolio", "timeline", "sparkline",
  ];
  const requested = textValue(scene.chart_type) as FinanceChartKind;
  if (supported.includes(requested)) return requested;
  if (visual === "compound_growth" || concept === "compound_interest") return "area";
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
    if (beat.visual === "compound_growth") {
      inferred.add("chart_up");
      inferred.add("percentage");
      inferred.add("calculator");
      inferred.add("calendar");
    }
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
    for (const moment of beat.visualMoments ?? []) {
      if (moment.kind === "compound_growth" || moment.kind === "market_chart") inferred.add("chart_up");
      if (moment.kind === "money_flow" || moment.kind === "reinvestment") inferred.add("money_flow");
      if (moment.kind === "risk") inferred.add("warning");
      if (moment.kind === "document") inferred.add("document");
      if (moment.kind === "portfolio") inferred.add("portfolio");
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
        reason: "Для фьючерсов нужен отдельный разбор контракта, плеча, графика payoff и риска.",
      }
    : requestedTemplate;
  const selectedTemplate = FINANCE_TEMPLATE_LIBRARY.find((candidate) => candidate.id === templateDecision.id)
    ?? FINANCE_TEMPLATE_LIBRARY.find((candidate) => candidate.id === "minimal_explainer")!;
  const ai = await requestFinancialScript(
    topic,
    templateDecision,
    profile.concept,
    profile.concept === "futures_contract" ? FUTURES_SCENE_COPY.length : undefined,
  );
  const rawScenes = Array.isArray(ai.scenes) ? ai.scenes : [];
  const concept = (textValue(ai.visual_concept) as FinancialConcept) || profile.concept;
  const aiConcept: FinancialConcept = [
    "bond_flow",
    "equity_split",
    "fund_pool",
    "profit_distribution",
    "compound_interest",
    "futures_contract",
    "generic_finance",
  ].includes(concept) ? concept : profile.concept;
  const selectedConcept: FinancialConcept = profile.concept === "generic_finance" ? aiConcept : profile.concept;
  const aiScenes = rawScenes
    .filter((scene): scene is FinancialAiScene => Boolean(scene && typeof scene === "object"))
    .slice(0, profile.concept === "futures_contract" ? FUTURES_SCENE_COPY.length : MAX_SCENES);
  const requiredSceneCount = profile.concept === "futures_contract" ? FUTURES_SCENE_COPY.length : MIN_SCENES;
  if (aiScenes.length < requiredSceneCount) {
    throw new Error(`AI-сценарий вернул ${aiScenes.length} сцен; требуется не менее ${requiredSceneCount}.`);
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
  const isFuturesTopic = selectedConcept === "futures_contract";
  const ending = isFuturesTopic ? "" : textValue(ai.ending);
  const finalVoice = [textValue(scenes.at(-1)?.voice_text), ending, cta].filter(Boolean).join("\n\n").trim();
  const extraVoiceSeconds = Math.min(12, wordsIn([ending, cta].filter(Boolean).join(" ")).length / 2.4);
  const plannedScenes = scenes.map((scene, index) => index === scenes.length - 1
    ? {
        ...scene,
        voice_text: finalVoice,
        duration_seconds: numberValue(scene.duration_seconds, 8) + extraVoiceSeconds,
      }
    : scene);
  const totalSceneSeconds = plannedScenes.reduce((sum, scene, index) => sum + Math.max(4, numberValue(scene.duration_seconds, index === 0 ? 8 : 9)), 0);
  const requestedDuration = Math.max(
    MIN_DURATION_SECONDS,
    Math.min(MAX_DURATION_SECONDS, numberValue(ai.duration_seconds, totalSceneSeconds)),
  );
  const visualPlans = await requestFinancialVisualPlan(
    topic,
    selectedConcept,
    plannedScenes,
    templateDecision,
  );
  let cursor = 0;
  const beats: FinancialShortBeat[] = plannedScenes.map((scene, index) => {
    const rawDuration = Math.max(4, numberValue(scene.duration_seconds, index === 0 ? 8 : 9));
    const durationRatio = rawDuration / totalSceneSeconds;
    const from = cursor;
    const to = index === plannedScenes.length - 1 ? 1 : Math.min(1, cursor + durationRatio);
    cursor = to;
    const visual = inferVisualKind(topic, scene, index, plannedScenes.length, selectedConcept);
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
      composition: visualPlans[index]!.composition,
      presenterLayout: visualPlans[index]!.presenterLayout,
      visualMoments: visualPlans[index]!.moments,
      objectKinds: stringArray(scene.objects),
      background: backgroundForScene(topic, index, selectedTemplate.id),
      chartKind: chartKindForScene(scene, visual, index, selectedConcept),
      entityLabel: profile.entityLabel,
      metricLabel: profile.metricLabel,
      maturityLabel: profile.maturityLabel,
      definitionCaption: profile.definitionCaption,
      summaryItems: profile.summaryItems,
    };
  });
  const voiceParts = plannedScenes.map((scene) => textValue(scene.voice_text)).filter(Boolean);
  const script = voiceParts.join("\n\n").trim();
  if (!script) throw new Error("AI-сценарий финансового ролика не содержит текста для озвучки.");
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
    visualTemplate: selectedTemplate.id,
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