import { openRouterConfig } from "./openrouter-config";
import {
  FINANCE_BACKGROUND_LIBRARY,
  FINANCE_BRAND_PROFILE,
  FINANCE_OBJECT_LIBRARY,
  type FinanceBackgroundId,
  type FinanceChartKind,
  type FinanceObjectKind,
} from "./finance-style-dna";
import {
  renderFinancialTopicShort,
  type FinancialComposition,
  type FinancialConcept,
  type FinancialEntryAnimation,
  type FinancialExitAnimation,
  type FinancialMicroBeatKind,
  type FinancialMicroBeatPosition,
  type FinancialShortBeat,
  type FinancialShortRenderPlan,
  type FinancialSceneTransition,
  type FinancialVisualMoment,
  type FinancialVisualMomentKind,
  type FinancialVisualPresentation,
  type FinancialVisualPosition,
  type FinancialVisualMicroBeat,
  type PresenterLayout,
  type FinancialVisualKind,
} from "./financial-short-renderer";
import {
  FINANCIAL_PRESENTER_POSES,
  getSpeechWordTimings,
  type PresenterPose,
} from "./financial-presenter";
import { resolveFinancialVisualAssets } from "./financial-visual-assets";

export const MAX_FINANCIAL_TOPIC_LENGTH = 180;
export const MAX_FINANCIAL_CTA_LENGTH = 240;
const MIN_DURATION_SECONDS = 45;
const MAX_DURATION_SECONDS = 150;
const MIN_SCENES = 6;
const MAX_SCENES = 12;
const MAX_VISUAL_MOMENTS_PER_SCENE = 16;
const MAX_WORDS_PER_VISUAL_MOMENT = 6;
const ESTIMATED_SPEECH_WORDS_PER_SECOND = 2.4;

type FinancialAiScene = {
  scene_number?: unknown;
  duration_seconds?: unknown;
  voice_text?: unknown;
  screen_text?: unknown;
  visual_hint?: unknown;
  visual_action?: unknown;
  objects?: unknown;
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

type FinancialVisualPlanResponse = {
  scenes?: unknown;
};

type FinancialVisualPlanScene = {
  scene_number?: unknown;
  composition?: unknown;
  presenter_layout?: unknown;
  presenter_pose?: unknown;
  camera_action?: unknown;
  transition_in?: unknown;
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
  presentation_style?: unknown;
  position?: unknown;
  enter_animation?: unknown;
  exit_animation?: unknown;
  micro_beats?: unknown;
};

type FinancialVisualPlanMicroBeat = {
  type?: unknown;
  cue_excerpt?: unknown;
  text?: unknown;
  position?: unknown;
  enter_animation?: unknown;
  exit_animation?: unknown;
  hold_words?: unknown;
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
  brandStyleLabel: string;
  visualMediaNotice: string;
  visualMediaCredits: string[];
};

export type FinancialTopicPlanOptions = {
  targetDurationSeconds?: number;
};

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function stableChoiceIndex(seed: string, count: number): number {
  let hash = 2_166_136_261;
  for (const character of seed) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619);
  }
  return (hash >>> 0) % count;
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

async function requestFinancialScript(
  topic: string,
  expectedConcept: FinancialConcept,
  targetDurationSeconds?: number,
  ctaInput = "",
): Promise<FinancialAiResponse> {
  const futuresTopic = topicProfile(topic).concept === "futures_contract";
  const sceneInstruction = targetDurationSeconds
    ? `Сгенерируй ровно ${MIN_SCENES} самостоятельных смысловых сцен для короткого тестового ролика. Не используй фиксированный порядок сцен и не копируй последовательность другого ролика.`
    : `Сгенерируй от ${MIN_SCENES} до ${MAX_SCENES} самостоятельных смысловых сцен по логике именно этой темы. Не используй фиксированный порядок сцен и не копируй последовательность другого ролика.`;
  const targetWordCount = targetDurationSeconds
    ? Math.max(
        1,
        Math.round(targetDurationSeconds * ESTIMATED_SPEECH_WORDS_PER_SECOND) - wordsIn(ctaInput).length,
      )
    : undefined;
  const countScriptWords = (candidate: FinancialAiResponse): number => {
    const responseScenes = Array.isArray(candidate.scenes)
      ? candidate.scenes as FinancialAiScene[]
      : [];
    return wordsIn([
      ...responseScenes.map((scene) => textValue(scene.voice_text)),
      textValue(candidate.ending),
    ].join(" ")).length;
  };
  const system = [
    "Ты создаёшь образовательные русскоязычные YouTube Shorts о финансах.",
    "Не давай индивидуальных инвестиционных рекомендаций и не обещай доход.",
    "Объясняй одну тему максимально ясно, разговорно и без воды.",
    "Пиши как редактор финансового медиа для новичка: используй «компания», «государство», «инвестор» и простые глаголы.",
    `Точная визуальная концепция пользовательской темы: ${expectedConcept}. Не подменяй объяснение другим финансовым инструментом.`,
    sceneInstruction,
    ...(isDigitalAssetSupplyTopic(topic) ? [
      "Для Bitcoin: максимальное предложение — 21 миллион BTC; награда за блок уменьшается вдвое каждые 210 000 блоков, примерно раз в четыре года.",
      "Не говори, что халвинг уменьшает награду «в полтора раза»: она становится вдвое меньше. Ограниченное предложение не гарантирует рост цены.",
      "Объясняй изменение правил протокола аккуратно: одна компания не может единолично увеличить лимит; для изменения правила требуется принятие новой версии сетью.",
    ] : []),
    ...(targetDurationSeconds && targetWordCount
      ? [
          `Целевая длительность озвучки — около ${targetDurationSeconds} секунд: весь voice_text вместе с ending должен содержать примерно ${targetWordCount} слов (допуск ±4 слова при скорости 2.4 слова/секунду).`,
          `Пользовательский CTA будет добавлен отдельно и содержит ${wordsIn(ctaInput).length} слов; он уже учтён в целевой длительности.`,
          "Распредели этот общий объём по шести коротким сценам; ending входит в лимит и остаётся коротким. Не растягивай текст повторениями.",
        ]
      : []),
    "Каждая сцена — короткий связный смысловой блок озвучки. Визуальные поля здесь только черновые подсказки: после сценария отдельный AI visual director разобьёт речь на микро-сегменты и создаст полноценный Visual Plan.",
    "voice_text — только произносимый текст. screen_text — короткая надпись до 45 символов.",
    "visual_concept выбирай по смыслу: bond_flow, equity_split, fund_pool, profit_distribution, compound_interest, futures_contract или generic_finance.",
    "visual_hint — только краткая смысловая подсказка, не готовый шаблон сцены.",
    "visual_action — конкретное действие объектов в кадре. objects — массив из 2–6 object kinds. chart_type выбирай по смыслу: line, area, candlestick, bar, horizontal_bar, donut, waterfall, portfolio, timeline или sparkline.",
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
      duration_seconds: targetDurationSeconds ?? 60,
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
    `Тема финансового Shorts: ${topic}. Создай сценарий заново под эту тему, без фиксированной сценной последовательности.`,
    "финансовый сценарий",
  );
  let selectedResponse = response;
  let spokenWordCount = countScriptWords(response);
  if (
    targetDurationSeconds !== undefined
    && (
      !Array.isArray(response.scenes)
      || response.scenes.length !== MIN_SCENES
      || Math.abs(spokenWordCount - (targetWordCount ?? 0)) > 4
      || (isBitcoinSupplyTopic(topic) && !isBitcoinSupplyScriptSemanticallySafe(response))
    )
  ) {
    const repairSystem = [
      system,
      `Предыдущий вариант отклонён: в нём ${spokenWordCount} слов в voice_text и ending и ${Array.isArray(response.scenes) ? response.scenes.length : 0} сцен.`,
      `Перепиши текст строго под ${targetDurationSeconds} секунд: ровно ${MIN_SCENES} сцен и от ${(targetWordCount ?? 0) - 4} до ${(targetWordCount ?? 0) + 4} слов суммарно в voice_text всех сцен и ending.`,
      "Сократи повторы, не меняй проверяемые факты и не добавляй новых утверждений. Ending должен завершать мысль, а не повторять последнюю сцену.",
      "Верни полный JSON по исходной схеме, не объясняй исправление.",
    ].join("\n");
    selectedResponse = await requestOpenRouterJson<FinancialAiResponse>(
      repairSystem,
      JSON.stringify({
        topic,
        target_duration_seconds: targetDurationSeconds,
        target_script_word_count: targetWordCount,
        current_word_count: spokenWordCount,
        current_script: response,
      }),
      "сценарий финансового Shorts нужной длительности",
    );
    spokenWordCount = countScriptWords(selectedResponse);
    const repairedSceneCount = Array.isArray(selectedResponse.scenes)
      ? selectedResponse.scenes.length
      : 0;
    if (
      repairedSceneCount !== MIN_SCENES
      || Math.abs(spokenWordCount - (targetWordCount ?? 0)) > 4
      || (isBitcoinSupplyTopic(topic) && !isBitcoinSupplyScriptSemanticallySafe(selectedResponse))
    ) {
      const editorialFallback = bitcoinSupplyScript();
      const fallbackWordCount = countScriptWords(editorialFallback);
      if (
        isBitcoinSupplyTopic(topic)
        && Math.abs(fallbackWordCount - (targetWordCount ?? 0)) <= 4
        && isBitcoinSupplyScriptSemanticallySafe(editorialFallback)
      ) {
        console.warn(
          `[financial-script-director] AI script failed duration or Bitcoin fact checks; using a concise, fact-checked editorial script (${fallbackWordCount} words).`,
        );
        selectedResponse = editorialFallback;
        spokenWordCount = fallbackWordCount;
      } else {
        throw new Error(
          `AI-сценарий после сокращения содержит ${spokenWordCount} слов и ${repairedSceneCount} сцен; требуется ${targetWordCount ?? "целевой объём"}±4 слова и ровно ${MIN_SCENES} сцен.`,
        );
      }
    }
  }
  if (expectedConcept === "futures_contract" && targetDurationSeconds === undefined) {
    return selectedResponse;
  }
  return {
    ...selectedResponse,
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
const CHART_TYPES_BY_CONCEPT: Record<FinancialConcept, FinanceChartKind[]> = {
  bond_flow: ["line", "candlestick", "bar", "timeline", "sparkline"],
  equity_split: ["line", "candlestick", "bar", "sparkline"],
  fund_pool: ["area", "portfolio", "donut", "bar", "line", "sparkline"],
  profit_distribution: ["waterfall", "bar", "line", "timeline", "sparkline"],
  compound_interest: ["area", "line", "bar", "timeline", "sparkline"],
  futures_contract: ["line", "candlestick", "bar", "sparkline"],
  generic_finance: ["line", "area", "candlestick", "bar", "horizontal_bar", "donut", "waterfall", "portfolio", "timeline", "sparkline"],
};
const VISUAL_ENTRY_ANIMATIONS: FinancialEntryAnimation[] = [
  "card_pop", "sticker_pop", "bounce", "slide_left", "slide_right", "slide_top",
  "slide_bottom", "scale_pop", "elastic_pop", "rotate_scale", "flip", "swipe",
  "spring", "floating", "notification", "overshoot",
];
const VISUAL_PRESENTATION_STYLES: FinancialVisualPresentation[] = [
  "card", "sticker", "image_sticker", "cutout_object", "document", "infographic",
  "notification", "icon_bubble", "highlighted_word", "number_counter",
];
const VISUAL_EXIT_ANIMATIONS: FinancialExitAnimation[] = [
  "slide_left", "slide_right", "slide_top", "slide_bottom", "shrink", "fade", "hold",
];
const MICRO_BEAT_KINDS: FinancialMicroBeatKind[] = [
  "keyword", "object", "sticker", "arrow", "number", "highlight",
];
const MICRO_BEAT_POSITIONS: FinancialMicroBeatPosition[] = [
  "left", "right", "upper_left", "upper_right",
];
const MICRO_BEAT_EXIT_ANIMATIONS: FinancialExitAnimation[] = [
  "slide_left", "slide_right", "slide_top", "slide_bottom", "shrink", "fade",
];
const CAMERA_ACTIONS = [
  "push_in", "pull_back", "pan_left", "pan_right", "follow_flow",
  "tracking", "orbit", "parallax", "focus_shift", "locked",
] as const;
const SCENE_TRANSITIONS: FinancialSceneTransition[] = [
  "cut", "light_flash", "radial_wipe", "center_split_wipe",
  "horizontal_sweep", "vertical_wipe", "zoom_blur",
];
const VISUAL_COMPOSITIONS: FinancialComposition[] = [
  "center", "presenter_left", "presenter_right", "feature_card",
];
const PRESENTER_LAYOUTS: PresenterLayout[] = ["center", "left", "right", "large"];
const MOMENT_KINDS_BY_CONCEPT: Record<FinancialConcept, FinancialVisualMomentKind[]> = {
  bond_flow: ["concept_card", "document", "money_flow", "metric", "market_chart", "timeline", "distribution", "comparison", "risk", "sticker"],
  equity_split: ["concept_card", "ownership", "market_chart", "distribution", "comparison", "risk", "metric", "sticker"],
  fund_pool: ["concept_card", "portfolio", "market_chart", "comparison", "distribution", "risk", "metric", "sticker"],
  profit_distribution: ["concept_card", "distribution", "timeline", "market_chart", "metric", "risk", "comparison", "sticker"],
  compound_interest: ["concept_card", "compound_growth", "reinvestment", "comparison", "metric", "market_chart", "timeline", "sticker"],
  futures_contract: ["concept_card", "money_flow", "market_chart", "payoff", "comparison", "risk", "timeline", "metric", "sticker"],
  generic_finance: VISUAL_MOMENT_KINDS,
};
const CONCEPT_VISUAL_GUIDES: Record<FinancialConcept, string> = {
  bond_flow: "Показывай именно облигацию: документ или саму облигацию, перевод денег от инвестора эмитенту (компании или государству, только если это сказано), купонные денежные выплаты, срок на временной шкале и возврат номинала при погашении. Доходность и риск показывай без выдуманных ставок и сумм.",
  equity_split: "Показывай акцию как долю в компании: компанию, акции-доли и акционеров, график цены акции; дивиденды — только когда о них говорит этот фрагмент. Не подменяй акцию облигацией: не используй купон, погашение и возврат номинала как визуальную метафору. Не придумывай проценты владения или цену.",
  fund_pool: "Показывай нескольких инвесторов, общий фонд, портфель с отдельными категориями АКЦИИ, ОБЛИГАЦИИ, ЗОЛОТО и ДРУГИЕ АКТИВЫ, схематичное распределение долей портфеля и график самого фонда. Не придумывай проценты распределения и не выдавай схему за фактические веса.",
  profit_distribution: "Показывай цепочку: прибыль компании → решение о распределении → денежные дивиденды акционерам → календарь даты выплаты. Отличай дивиденд от купона облигации. Не выдумывай суммы и календарные даты.",
  compound_interest: "В основной сцене используй условную последовательность капитала 100 000 ₽ → 110 000 ₽ → 121 000 ₽: процент добавляется к капиталу, следующий процент считается на новую сумму, видны повторное вложение и растущий график. Это учебная схема, не прогноз. Не копируй эти числа в label/value/detail микро-момента, если их нет в voice_text или screen_text; не добавляй ставку или сроки, которых нет в речи.",
  futures_contract: "Показывай фьючерсный контракт, стороны, срок, позиции лонг/шорт, обеспечение и график результата; не подменяй фьючерс облигацией, акцией или депозитом.",
  generic_finance: "Подбирай предметы и графики только из текущей темы и точного фрагмента речи. Не переноси визуальные метафоры соседних финансовых тем.",
};
const FALLBACK_KIND_CUES: Record<FinancialConcept, Array<[RegExp, FinancialVisualMomentKind]>> = {
  bond_flow: [
    [/купон|купонн|выплат/iu, "distribution"],
    [/доходност|ставк|процент/iu, "metric"],
    [/погаш|возврат номинал|срок/iu, "timeline"],
    [/инвестор|компани|государств|деньг|переда|получ|влож/iu, "money_flow"],
    [/облигац|долг|расписк|эмитент/iu, "document"],
    [/риск|потер/iu, "risk"],
  ],
  equity_split: [
    [/цен|бирж|график|рынок|раст/iu, "market_chart"],
    [/дивиденд|прибыл|выплат/iu, "distribution"],
    [/доля|владе|акци|акционер|компани/iu, "ownership"],
    [/риск|потер/iu, "risk"],
  ],
  fund_pool: [
    [/цен|график|рынок/iu, "market_chart"],
    [/дол|распредел/iu, "distribution"],
    [/портфел|фонд|пай|актив|золото|облигац|акци/iu, "portfolio"],
    [/риск/iu, "risk"],
  ],
  profit_distribution: [
    [/дат|срок|год|период/iu, "timeline"],
    [/дивиденд|прибыл|выплат|акционер|доход/iu, "distribution"],
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

function conceptVisualKindCue(
  concept: FinancialConcept,
  excerpt: string,
): [RegExp, FinancialVisualMomentKind] | undefined {
  const allowed = MOMENT_KINDS_BY_CONCEPT[concept];
  return FALLBACK_KIND_CUES[concept].find(([pattern, kind]) =>
    allowed.includes(kind) && pattern.test(excerpt));
}

function wordsIn(value: string): string[] {
  return value.toLocaleLowerCase("ru-RU").match(/[\p{L}\p{N}]+/gu) ?? [];
}

function isBitcoinSupplyTopic(topic: string): boolean {
  return /bitcoin|\bbtc\b|биткоин/iu.test(topic)
    && /лимит|огранич|предлож|выпуск/iu.test(topic);
}

function bitcoinSupplyVisualKindForExcerpt(
  excerpt: string,
  avoidKind?: FinancialVisualMomentKind,
): FinancialVisualMomentKind {
  const source = excerpt.toLocaleLowerCase("ru-RU");
  let kind: FinancialVisualMomentKind = "concept_card";

  if (/21\s*(?:млн|миллион)|двадцать один миллион|максимум|предел|лимит/iu.test(source)) {
    kind = "metric";
  } else if (/раз в четыре|примерно.{0,20}четыре|каждые.{0,20}года|210\s*000|года/iu.test(source)) {
    kind = "timeline";
  } else if (/халвинг|вдвое|пополам|половин/iu.test(source)) {
    kind = "metric";
  } else if (/цен[аы]|спрос|рыночн|стоимост|рост|редкост|гарант/iu.test(source)) {
    kind = "comparison";
  } else if (/протокол|правил|компани|сет[ьи]|участник|верс|принят/iu.test(source)) {
    kind = "document";
  } else if (/награда|блок|новые биткоин|новые монет/iu.test(source)) {
    kind = "money_flow";
  } else if (/график|выпуск|предсказуем|эмисси/iu.test(source)) {
    kind = "timeline";
  }

  if (kind !== avoidKind) return kind;
  if (kind === "metric") return "timeline";
  if (kind === "timeline") return "metric";
  return "concept_card";
}

function visualGuideForTopic(topic: string, concept: FinancialConcept): string {
  if (isBitcoinSupplyTopic(topic)) {
    return "Для лимита предложения Bitcoin показывай 21 млн BTC как верхний предел, награду за блок как источник новых монет, халвинг примерно раз в четыре года, отдельно выпуск и меняющуюся рыночную цену, правила протокола и принятие изменений участниками сети. Не показывай инвестиционный чек-лист, доходность или растущий ценовой график. Дефицит не гарантирует рост цены.";
  }
  return CONCEPT_VISUAL_GUIDES[concept];
}

function bitcoinSupplyScript(): FinancialAiResponse {
  const scenes: FinancialAiScene[] = [
    {
      scene_number: 1,
      voice_text: "У биткоина есть предел выпуска: максимум — 21 миллион монет.",
      screen_text: "21 млн BTC — максимум",
      visual_hint: "finite supply of Bitcoin",
      visual_action: "show a clear capped coin supply",
      objects: [],
      chart_type: "line",
      text_animation: "reveal",
      sound_effect: "coin_tick",
    },
    {
      scene_number: 2,
      voice_text: "Новые биткоины появляются как награда за каждый найденный блок; размер награды задан протоколом.",
      screen_text: "Награда за блок",
      visual_hint: "new coins enter through block rewards",
      visual_action: "connect a new block to a small coin reward",
      objects: [],
      chart_type: "line",
      text_animation: "reveal",
      sound_effect: "click",
    },
    {
      scene_number: 3,
      voice_text: "Примерно раз в четыре года халвинг уменьшает награду вдвое, замедляя выпуск новых монет.",
      screen_text: "Награда уменьшается вдвое",
      visual_hint: "halving reduces each block reward",
      visual_action: "show the same reward becoming half as large",
      objects: [],
      chart_type: "timeline",
      text_animation: "count_up",
      sound_effect: "soft_riser",
    },
    {
      scene_number: 4,
      voice_text: "График выпуска предсказуем, но он не фиксирует рыночную цену биткоина: спрос тоже меняется.",
      screen_text: "Спрос и цена меняются",
      visual_hint: "distinguish predictable issuance from market price",
      visual_action: "hold the issuance schedule steady while demand shifts",
      objects: [],
      chart_type: "line",
      text_animation: "reveal",
      sound_effect: "whoosh",
    },
    {
      scene_number: 5,
      voice_text: "Лимит основан на правилах протокола: отдельная компания не может просто добавить новые монеты.",
      screen_text: "Правила протокола",
      visual_hint: "the supply rule belongs to the network protocol",
      visual_action: "show participants following one shared rule",
      objects: [],
      chart_type: "line",
      text_animation: "stamp",
      sound_effect: "click",
    },
    {
      scene_number: 6,
      voice_text: "Новую версию должны принять участники сети.",
      screen_text: "Правило принимает сеть",
      visual_hint: "protocol changes require network adoption",
      visual_action: "show the same rule spreading between network participants",
      objects: [],
      chart_type: "line",
      text_animation: "reveal",
      sound_effect: "soft_riser",
    },
  ];
  const ending = "Редкость сама по себе не гарантирует роста стоимости.";
  const spokenWordCount = wordsIn([
    ...scenes.map((scene) => textValue(scene.voice_text)),
    ending,
  ].join(" ")).length;
  return {
    title: "Почему у Bitcoin ограничено предложение",
    hook: "У биткоина есть предел выпуска — но это не обещание роста цены.",
    description: "Объясняем лимит предложения, награду за блок и халвинг Bitcoin.",
    duration_seconds: spokenWordCount / ESTIMATED_SPEECH_WORDS_PER_SECOND,
    visual_concept: "generic_finance",
    scenes,
    ending,
    cta: "",
  };
}

function isBitcoinSupplyScriptSemanticallySafe(candidate: FinancialAiResponse): boolean {
  const responseScenes = Array.isArray(candidate.scenes)
    ? candidate.scenes as FinancialAiScene[]
    : [];
  const script = [
    ...responseScenes.map((scene) => textValue(scene.voice_text)),
    textValue(candidate.ending),
  ].join(" ").toLocaleLowerCase("ru-RU");
  const hasSupplyCap = /21\s*(?:миллион|млн)|двадцать один миллион|21[,. ]?000[,. ]?000/iu.test(script);
  const describesHalving = /халвинг|пополам|вдвое/iu.test(script);
  const halvesReward = /вдвое|пополам|на\s*50\s*%|половин/iu.test(script)
    && !/полтора раза|в полтора|1[,.]5\s*раза/iu.test(script);
  const rejectsPriceGuarantee = /не\s+(?:гарантирует|обещает|означает).{0,40}(?:рост|цен|доход|стоимост)|(?:рост|цена|доход|стоимость).{0,40}не\s+(?:гарантирует|обещает)/iu.test(script);
  return hasSupplyCap && describesHalving && halvesReward && rejectsPriceGuarantee;
}

function targetVisualMomentCount(
  wordCount: number,
  wordsPerMoment = MAX_WORDS_PER_VISUAL_MOMENT,
  minimumMomentCount = 1,
): number {
  return Math.max(
    1,
    Math.min(
      MAX_VISUAL_MOMENTS_PER_SCENE,
      Math.max(Math.min(minimumMomentCount, wordCount), Math.ceil(wordCount / wordsPerMoment)),
    ),
  );
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
  avoidKind?: FinancialVisualMomentKind,
): FinancialVisualMomentKind {
  const allowed = MOMENT_KINDS_BY_CONCEPT[concept];
  const cue = conceptVisualKindCue(concept, excerpt);
  if (cue && cue[1] !== avoidKind) return cue[1];
  const text = excerpt.toLocaleLowerCase("ru-RU");
  let hash = ordinal;
  for (const character of text) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  const alternatives = allowed.filter((kind) => kind !== avoidKind && kind !== "sticker");
  return alternatives[hash % alternatives.length] ?? cue?.[1] ?? allowed[hash % allowed.length]!;
}

const DIGITAL_ASSET_VISUAL_KINDS = new Set<FinancialVisualMomentKind>([
  "concept_card", "market_chart", "metric", "risk", "sticker",
]);

function isDigitalAssetSupplyTopic(topic: string): boolean {
  return /bitcoin|\bbtc\b|биткоин|криптовалют|блокчейн|майнинг/iu.test(topic);
}

function fallbackVisualKindForTopic(
  topic: string,
  concept: FinancialConcept,
  excerpt: string,
  ordinal: number,
  avoidKind?: FinancialVisualMomentKind,
): FinancialVisualMomentKind {
  if (isBitcoinSupplyTopic(topic)) {
    return bitcoinSupplyVisualKindForExcerpt(excerpt, avoidKind);
  }
  if (!isDigitalAssetSupplyTopic(topic)) {
    return fallbackVisualKind(concept, excerpt, ordinal, avoidKind);
  }
  const allowed = MOMENT_KINDS_BY_CONCEPT[concept].filter((kind) =>
    DIGITAL_ASSET_VISUAL_KINDS.has(kind) && kind !== avoidKind);
  const source = excerpt.toLocaleLowerCase("ru-RU");
  if (/\d/u.test(source) && allowed.includes("metric")) return "metric";
  if (/рис|угроз|потер|опас|волатил/iu.test(source) && allowed.includes("risk")) return "risk";
  return allowed[ordinal % Math.max(1, allowed.length)]
    ?? allowed[0]
    ?? "concept_card";
}

function fallbackVisualPresentation(
  kind: FinancialVisualMomentKind,
  ordinal: number,
): FinancialVisualPresentation {
  if (kind === "document") return "document";
  if (kind === "sticker") return "sticker";
  if (kind === "metric") return "number_counter";
  const styles: FinancialVisualPresentation[] = [
    "sticker", "cutout_object", "infographic", "notification", "highlighted_word", "card", "icon_bubble",
  ];
  return styles[ordinal % styles.length]!;
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

const ENTRY_ANIMATION_ALIASES: Record<string, FinancialEntryAnimation> = {
  float: "floating",
};

function normalizeCosmeticEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
  fallback: T,
  aliases: Record<string, T> = {},
): T {
  const candidate = textValue(value).toLocaleLowerCase("en-US");
  const normalized = aliases[candidate] ?? candidate;
  if (allowed.includes(normalized as T)) return allowedEnum(normalized, allowed, label);
  console.warn(
    `[financial-visual-director] Unsupported ${label} ${JSON.stringify(candidate)}; using ${fallback}.`,
  );
  return fallback;
}

function normalizeVisualKind(
  value: unknown,
  concept: FinancialConcept,
  excerpt: string,
  fallbackOrdinal: number,
): FinancialVisualMomentKind {
  const allowed = MOMENT_KINDS_BY_CONCEPT[concept];
  const candidate = textValue(value) as FinancialVisualMomentKind;
  if (allowed.includes(candidate)) return allowedEnum(candidate, allowed, "visual_kind");
  const fallback = fallbackVisualKind(concept, excerpt, fallbackOrdinal);
  console.warn(
    `[financial-visual-director] Unsupported visual_kind ${JSON.stringify(candidate)}; using ${fallback} for ${concept}.`,
  );
  return fallback;
}

function normalizeEntryAnimation(
  value: unknown,
  fallback: FinancialEntryAnimation,
): FinancialEntryAnimation {
  return normalizeCosmeticEnum(
    value,
    VISUAL_ENTRY_ANIMATIONS,
    "enter_animation",
    fallback,
    ENTRY_ANIMATION_ALIASES,
  );
}

function normalizeExitAnimation(
  value: unknown,
  fallback: FinancialExitAnimation,
): FinancialExitAnimation {
  return normalizeCosmeticEnum(value, VISUAL_EXIT_ANIMATIONS, "exit_animation", fallback);
}

function microBeatTiming(
  voiceExcerpt: string,
  cueExcerpt: string,
  holdWords: number,
  expectedStartWord = 0,
): { from: number; to: number } {
  const source = getSpeechWordTimings(voiceExcerpt);
  const cueWords = getSpeechWordTimings(cueExcerpt).words.map((word) => word.normalized);
  const sourceWords = source.words.map((word) => word.normalized);
  const startWord = findWordSequence(sourceWords, cueWords, expectedStartWord)
    >= 0
    ? findWordSequence(sourceWords, cueWords, expectedStartWord)
    : findWordSequence(sourceWords, cueWords, 0);
  if (startWord < 0 || !source.totalWeight) {
    throw new Error(`Micro-beat cue «${cueExcerpt}» отсутствует в voice_excerpt «${voiceExcerpt}».`);
  }
  const startTiming = source.words[startWord]!;
  const endWord = Math.min(source.words.length, startWord + holdWords) - 1;
  const endTiming = source.words[endWord]!;
  const from = clampUnit(startTiming.start / source.totalWeight);
  const to = clampUnit(Math.max(
    endTiming.end / source.totalWeight,
    from + Math.min(0.42, 1 - from),
  ));
  if (to <= from) throw new Error(`Micro-beat cue «${cueExcerpt}» имеет пустую длительность.`);
  return { from, to };
}

const MICRO_BEAT_STOP_WORDS = new Set([
  "был", "быть", "будет", "будут", "весь", "всё", "всех", "делает", "если",
  "есть", "это", "когда", "может", "могут", "много", "можно", "новый", "новые",
  "один", "одна", "они", "после", "почему", "просто", "самый", "такой", "также",
]);
const SPOKEN_NUMBER_WORDS = new Set([
  "один", "одна", "одно", "два", "две", "три", "четыре", "пять", "шесть",
  "семь", "восемь", "девять", "десять", "двадцать", "тысяча", "тысячи",
  "миллион", "миллиона", "миллионов",
]);

function fallbackMicroBeats(
  voiceExcerpt: string,
  location: string,
): FinancialVisualMicroBeat[] {
  const source = getSpeechWordTimings(voiceExcerpt);
  if (!source.words.length) throw new Error(`Момент ${location} не содержит слов для micro-beats.`);
  const meaningful = source.words
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => word.normalized.length >= 3 && !MICRO_BEAT_STOP_WORDS.has(word.normalized));
  const candidates = meaningful.length >= 2
    ? meaningful
    : source.words.map((word, index) => ({ word, index }));
  const firstPosition = Math.floor((candidates.length - 1) * 0.18);
  const secondPosition = candidates.length > 1
    ? Math.max(firstPosition + 1, Math.ceil((candidates.length - 1) * 0.72))
    : firstPosition;
  const first = candidates[firstPosition]!;
  const second = candidates[Math.min(candidates.length - 1, secondPosition)]!;
  const numericCue = /\d/u.test(second.word.word)
    || SPOKEN_NUMBER_WORDS.has(second.word.normalized);
  const topicalKinds: FinancialMicroBeatKind[] = numericCue
    ? ["number", "object", "sticker", "arrow", "highlight"]
    : ["object", "sticker", "arrow", "highlight"];
  const secondKind = topicalKinds[stableChoiceIndex(location, topicalKinds.length)]!;
  const positionPairs: Array<[FinancialMicroBeatPosition, FinancialMicroBeatPosition]> = [
    ["upper_left", "upper_right"],
    ["left", "right"],
    ["upper_right", "left"],
    ["right", "upper_left"],
  ];
  const [firstPositionName, secondPositionName] =
    positionPairs[stableChoiceIndex(`${location}:position`, positionPairs.length)]!;
  const animationPairs: Array<[FinancialEntryAnimation, FinancialEntryAnimation]> = [
    ["sticker_pop", "spring"],
    ["slide_left", "elastic_pop"],
    ["bounce", "notification"],
    ["card_pop", "overshoot"],
  ];
  const [firstAnimation, secondAnimation] =
    animationPairs[stableChoiceIndex(`${location}:entry`, animationPairs.length)]!;
  const exitPairs: Array<[FinancialExitAnimation, FinancialExitAnimation]> = [
    ["slide_left", "shrink"],
    ["slide_right", "fade"],
    ["slide_top", "slide_bottom"],
    ["shrink", "slide_left"],
  ];
  const [firstExit, secondExit] =
    exitPairs[stableChoiceIndex(`${location}:exit`, exitPairs.length)]!;
  const firstCue = first.word.word;
  const secondCue = second.word.word;
  const firstTiming = microBeatTiming(voiceExcerpt, firstCue, 2, first.index);
  const secondTiming = microBeatTiming(voiceExcerpt, secondCue, 2, second.index);
  const sameCue = first.index === second.index;
  const secondFrom = sameCue
    ? clampUnit(Math.min(0.94, firstTiming.from + 0.18))
    : secondTiming.from;
  const secondTo = clampUnit(Math.max(secondTiming.to, secondFrom + Math.min(0.2, 1 - secondFrom)));
  return [
    {
      id: `micro-${location.replaceAll(".", "-")}-1`,
      kind: "keyword",
      cueExcerpt: firstCue,
      text: firstCue,
      ...firstTiming,
      position: firstPositionName,
      enterAnimation: firstAnimation,
      exitAnimation: firstExit,
      holdWords: 2,
    },
    {
      id: `micro-${location.replaceAll(".", "-")}-2`,
      kind: secondKind,
      cueExcerpt: secondCue,
      text: secondKind === "arrow" ? "" : secondCue,
      from: secondFrom,
      to: secondTo > secondFrom ? secondTo : Math.min(1, secondFrom + 0.08),
      position: secondPositionName,
      enterAnimation: secondAnimation,
      exitAnimation: secondExit,
      holdWords: 2,
    },
  ];
}

function normalizeMicroBeats(
  candidate: unknown,
  voiceExcerpt: string,
  location: string,
): FinancialVisualMicroBeat[] {
  try {
    if (!Array.isArray(candidate) || candidate.length !== 2) {
      throw new Error(`ожидалось ровно 2 события, получено ${Array.isArray(candidate) ? candidate.length : "не массив"}`);
    }
    const microBeats = candidate.map((value, index): FinancialVisualMicroBeat => {
      if (!value || typeof value !== "object") {
        throw new Error(`micro-beat ${index + 1} имеет неверный формат`);
      }
      const raw = value as FinancialVisualPlanMicroBeat;
      const kind = textValue(raw.type) as FinancialMicroBeatKind;
      if (!MICRO_BEAT_KINDS.includes(kind)) throw new Error(`неизвестный тип события ${String(raw.type)}`);
      const cueExcerpt = textValue(raw.cue_excerpt).trim();
      const cueWordCount = getSpeechWordTimings(cueExcerpt).words.length;
      if (!cueWordCount || cueWordCount > 3) throw new Error(`cue ${index + 1} должен содержать 1–3 слова`);
      const text = textValue(raw.text).trim().slice(0, 32);
      const textWords = getSpeechWordTimings(text).words.map((word) => word.normalized);
      const cueWords = getSpeechWordTimings(cueExcerpt).words.map((word) => word.normalized);
      if (kind !== "arrow" && !textWords.length) throw new Error(`событие ${index + 1} требует короткий текст`);
      if (textWords.length && findWordSequence(cueWords, textWords, 0) < 0) {
        throw new Error(`текст события ${index + 1} не взят из его cue`);
      }
      const rawPosition = textValue(raw.position) as FinancialMicroBeatPosition;
      if (!MICRO_BEAT_POSITIONS.includes(rawPosition)) throw new Error(`недопустимая позиция события ${index + 1}`);
      const holdWords = Number(raw.hold_words);
      if (!Number.isInteger(holdWords) || holdWords < 2 || holdWords > 3) {
        throw new Error(`hold_words события ${index + 1} должен быть 2 или 3`);
      }
      const enterAnimation = textValue(raw.enter_animation) as FinancialEntryAnimation;
      if (!VISUAL_ENTRY_ANIMATIONS.includes(enterAnimation)) {
        throw new Error(`неизвестная entrance-анимация у события ${index + 1}`);
      }
      const exitAnimation = textValue(raw.exit_animation) as FinancialExitAnimation;
      if (!MICRO_BEAT_EXIT_ANIMATIONS.includes(exitAnimation)) {
        throw new Error(`событие ${index + 1} должно иметь короткую exit-анимацию`);
      }
      return {
        id: `micro-${location.replaceAll(".", "-")}-${index + 1}`,
        kind,
        cueExcerpt,
        text,
        ...microBeatTiming(voiceExcerpt, cueExcerpt, holdWords),
        position: rawPosition,
        enterAnimation,
        exitAnimation,
        holdWords,
      };
    });
    if (new Set(microBeats.map((microBeat) => microBeat.kind)).size !== 2) {
      throw new Error("нужно два разных типа события");
    }
    if (new Set(microBeats.map((microBeat) => microBeat.position)).size !== 2) {
      throw new Error("события должны быть в разных позициях");
    }
    if (microBeats[1]!.from <= microBeats[0]!.from) throw new Error("события должны следовать за речью по порядку");
    if (microBeats[1]!.enterAnimation === microBeats[0]!.enterAnimation) {
      throw new Error("события должны использовать разные entrance-анимации");
    }
    if (!microBeats.some((microBeat) => microBeat.kind !== "keyword")) {
      throw new Error("нужна topical-вставка, а не только kinetic text");
    }
    return microBeats;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid AI micro-beat data";
    console.warn(`[financial-visual-director] Rebuilding micro-beats for ${location} from exact spoken words: ${reason}.`);
    return fallbackMicroBeats(voiceExcerpt, location);
  }
}

function retimeMicroBeats(
  microBeats: FinancialVisualMicroBeat[],
  voiceExcerpt: string,
  location: string,
): FinancialVisualMicroBeat[] {
  try {
    const sourceWordCount = getSpeechWordTimings(voiceExcerpt).words.length;
    return microBeats.map((microBeat, index) => ({
      ...microBeat,
      id: `micro-${location.replaceAll(".", "-")}-${index + 1}`,
      ...microBeatTiming(
        voiceExcerpt,
        microBeat.cueExcerpt,
        microBeat.holdWords,
        Math.min(sourceWordCount - 1, Math.floor(microBeat.from * sourceWordCount)),
      ),
    }));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unmatched cue";
    console.warn(`[financial-visual-director] Rebuilding micro-beats for ${location} after excerpt alignment: ${reason}.`);
    return fallbackMicroBeats(voiceExcerpt, location);
  }
}

function normalizeVisualPlan(
  topic: string,
  response: FinancialVisualPlanResponse,
  scriptScenes: FinancialAiScene[],
  concept: FinancialConcept,
  targetDurationSeconds?: number,
): Array<{
  moments: FinancialVisualMoment[];
  composition: FinancialComposition;
  presenterLayout: PresenterLayout;
  presenterPose: PresenterPose;
  cameraAction: string;
  transitionIn: FinancialSceneTransition;
}> {
  if (
    !Array.isArray(response.scenes)
    || response.scenes.length !== scriptScenes.length
  ) {
    const actualCount = Array.isArray(response.scenes) ? response.scenes.length : "не массив";
    throw new Error(`AI Visual Plan должен описывать ровно ${scriptScenes.length} входных сцен, получено: ${actualCount}.`);
  }

  const indexedScenes = new Map<number, FinancialVisualPlanScene>();
  response.scenes.forEach((candidate, responseIndex) => {
    if (!candidate || typeof candidate !== "object") {
      throw new Error(`AI Visual Plan: сцена ${responseIndex + 1} имеет неверный формат.`);
    }
    const scene = candidate as FinancialVisualPlanScene;
    const rawNumber = Number(scene.scene_number);
    const sceneIndex = Number.isInteger(rawNumber) ? rawNumber - 1 : responseIndex;
    if (sceneIndex < 0) throw new Error("AI Visual Plan: номер сцены должен быть не меньше 1.");
    if (sceneIndex >= scriptScenes.length) return;
    if (indexedScenes.has(sceneIndex)) throw new Error("AI Visual Plan: номер входной сцены повторяется.");
    indexedScenes.set(sceneIndex, scene);
  });

  let sideLayoutCount = 0;
  const normalizedScenes = scriptScenes.map((scriptScene, sceneIndex) => {
    const planScene = indexedScenes.get(sceneIndex);
    if (!planScene) throw new Error(`AI Visual Plan: отсутствует сцена ${sceneIndex + 1}.`);
    const rawMoments = Array.isArray(planScene.moments) ? planScene.moments : [];
    const voice = textValue(scriptScene.voice_text);
    const voiceWords = wordsIn(voice);
    if (!voiceWords.length) throw new Error(`Сцена ${sceneIndex + 1} не содержит текста для синхронизации.`);
    const desiredMomentCount = targetVisualMomentCount(
      voiceWords.length,
      MAX_WORDS_PER_VISUAL_MOMENT,
      targetDurationSeconds === undefined ? 1 : 3,
    );
    if (rawMoments.length !== desiredMomentCount) {
      throw new Error(`AI Visual Plan: сцена ${sceneIndex + 1} должна содержать ровно ${desiredMomentCount} visual moments, получено ${rawMoments.length}.`);
    }
    const parsedMoments = rawMoments.map((candidate, momentIndex) => {
      if (!candidate || typeof candidate !== "object") {
        throw new Error(`AI Visual Plan: визуальный момент ${sceneIndex + 1}.${momentIndex + 1} имеет неверный формат.`);
      }
      const rawMoment = candidate as FinancialVisualPlanMoment;
      const requestedExcerpt = textValue(rawMoment.voice_excerpt);
      const excerptWords = wordsIn(requestedExcerpt);
      if (!excerptWords.length) {
        throw new Error(`AI Visual Plan: визуальный момент ${sceneIndex + 1}.${momentIndex + 1} не содержит voice_excerpt.`);
      }
      const expectedStart = Math.floor(momentIndex * voiceWords.length / rawMoments.length);
      const exactWordStart = findWordSequence(voiceWords, excerptWords, expectedStart);
      const range = exactWordStart >= 0
        ? { start: exactWordStart, end: exactWordStart + excerptWords.length }
        : closestWordRange(
          voiceWords,
          excerptWords,
          expectedStart,
        );
      const wordStart = range.start;
      const wordEnd = range.end;
      const voiceExcerpt = wordExcerpt(voice, wordStart, wordEnd);
      const fallbackSeed = `${topic}:${voice}:${sceneIndex}:${momentIndex}:${voiceExcerpt}`;
      const fallbackOrdinal = stableChoiceIndex(fallbackSeed, 2_147_483_647);

      const requestedKind = normalizeVisualKind(
        rawMoment.visual_kind,
        concept,
        voiceExcerpt,
        fallbackOrdinal,
      );
      const cueKind = conceptVisualKindCue(concept, voiceExcerpt)?.[1];
      const kind = isBitcoinSupplyTopic(topic)
        ? bitcoinSupplyVisualKindForExcerpt(voiceExcerpt)
        : isDigitalAssetSupplyTopic(topic)
          ? cueKind && DIGITAL_ASSET_VISUAL_KINDS.has(cueKind)
            ? cueKind
            : DIGITAL_ASSET_VISUAL_KINDS.has(requestedKind)
              ? requestedKind
              : fallbackVisualKindForTopic(topic, concept, voiceExcerpt, fallbackOrdinal)
          : cueKind ?? requestedKind;
      const requestedPresentation = textValue(rawMoment.presentation_style) as FinancialVisualPresentation;
      const presentationStyle = VISUAL_PRESENTATION_STYLES.includes(requestedPresentation)
        ? requestedPresentation
        : fallbackVisualPresentation(kind, fallbackOrdinal);
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
        presentationStyle,
        label,
        value,
        detail,
        sourceLabel: textValue(rawMoment.source_label).slice(0, 24),
        targetLabel: textValue(rawMoment.target_label).slice(0, 24),
        position: normalizeCosmeticEnum(
          rawMoment.position,
          VISUAL_POSITIONS,
          "position",
          VISUAL_POSITIONS[stableChoiceIndex(`${fallbackSeed}:position`, VISUAL_POSITIONS.length)]!,
        ),
        enterAnimation: normalizeEntryAnimation(
          rawMoment.enter_animation,
          VISUAL_ENTRY_ANIMATIONS[fallbackOrdinal % VISUAL_ENTRY_ANIMATIONS.length]!,
        ),
        exitAnimation: normalizeExitAnimation(
          rawMoment.exit_animation,
          VISUAL_EXIT_ANIMATIONS[(fallbackOrdinal + 1) % VISUAL_EXIT_ANIMATIONS.length]!,
        ),
        microBeats: normalizeMicroBeats(
          rawMoment.micro_beats,
          voiceExcerpt,
          `${sceneIndex + 1}.${momentIndex + 1}`,
        ),
      };
    });
    parsedMoments.sort((left, right) => left.wordStart - right.wordStart);
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
      const match = parsedMoments
        .map((moment, candidateIndex) => ({ moment, candidateIndex }))
        .filter(({ moment, candidateIndex }) =>
          !assignedMomentIndexes.has(candidateIndex)
          && moment.wordStart < endWord
          && moment.wordEnd > startWord)
        .map((candidate) => ({
          ...candidate,
          overlap: Math.max(
            0,
            Math.min(candidate.moment.wordEnd, endWord) - Math.max(candidate.moment.wordStart, startWord),
          ),
        }))
        .filter((candidate) =>
          candidate.overlap / Math.max(1, Math.min(
            candidate.moment.wordEnd - candidate.moment.wordStart,
            endWord - startWord,
          )) >= 0.5)
        .sort((left, right) =>
          right.overlap - left.overlap
          || Math.abs(left.moment.wordStart - startWord) - Math.abs(right.moment.wordStart - startWord))[0];
      const sourceMoment = match?.moment;
      if (match) assignedMomentIndexes.add(match.candidateIndex);
      const from = clampUnit(startWord / voiceWords.length);
      const to = clampUnit(endWord / voiceWords.length);
      const kind = sourceMoment?.kind ?? fallbackVisualKindForTopic(
        topic,
        concept,
        excerpt,
        stableChoiceIndex(`${topic}:${voice}:${sceneIndex}:${momentIndex}:${excerpt}:kind`, 2_147_483_647),
      );
      const presentationStyle = sourceMoment?.presentationStyle
        ?? fallbackVisualPresentation(
          kind,
          stableChoiceIndex(`${topic}:${voice}:${sceneIndex}:${momentIndex}:${excerpt}:presentation`, 2_147_483_647),
        );
      const fallbackSeed = `${topic}:${voice}:${sceneIndex}:${momentIndex}:${excerpt}`;
      const estimatedSeconds = (to - from) * voiceWords.length / ESTIMATED_SPEECH_WORDS_PER_SECOND;
      if (estimatedSeconds > 3) {
        throw new Error(`AI Visual Plan: момент ${sceneIndex + 1}.${momentIndex + 1} длится около ${estimatedSeconds.toFixed(1)} с; требуется разбивка до 3 с.`);
      }
      if (voiceWords.length >= 5 && estimatedSeconds < 1) {
        throw new Error(`AI Visual Plan: момент ${sceneIndex + 1}.${momentIndex + 1} длится около ${estimatedSeconds.toFixed(1)} с; короткие визуальные вставки должны длиться не менее 1 с.`);
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
        kind,
        presentationStyle,
        label,
        value: sourceMomentSafe ? sourceMoment?.value || undefined : undefined,
        detail: sourceMomentSafe ? sourceMoment?.detail || undefined : undefined,
        sourceLabel: sourceMoment?.sourceLabel || undefined,
        targetLabel: sourceMoment?.targetLabel || undefined,
        position: sourceMoment?.position
          ?? fallbackPositions[stableChoiceIndex(`${fallbackSeed}:position`, fallbackPositions.length)]!,
        enterAnimation: sourceMoment?.enterAnimation
          ?? VISUAL_ENTRY_ANIMATIONS[stableChoiceIndex(`${fallbackSeed}:enter`, VISUAL_ENTRY_ANIMATIONS.length)]!,
        exitAnimation: sourceMoment?.exitAnimation
          ?? VISUAL_EXIT_ANIMATIONS[stableChoiceIndex(`${fallbackSeed}:exit`, VISUAL_EXIT_ANIMATIONS.length)]!,
        microBeats: sourceMoment
          ? retimeMicroBeats(
              sourceMoment.microBeats ?? [],
              excerpt,
              `${sceneIndex + 1}.${momentIndex + 1}`,
            )
          : [],
      };
    });
    const missingMicroBeatMoments = moments.filter((moment) => moment.microBeats?.length !== 2);
    if (missingMicroBeatMoments.length > 0) {
      throw new Error(
        `AI Visual Plan: ${missingMicroBeatMoments.length} visual moments сцены ${sceneIndex + 1} не получили 2 синхронных micro-beats.`,
      );
    }
    const fallbackMomentCount = desiredMomentCount - assignedMomentIndexes.size;
    if (fallbackMomentCount > 0 || rawMoments.length !== desiredMomentCount) {
      console.warn(
        `[financial-visual-director] ${topic}, scene ${sceneIndex + 1}: AI moments ${rawMoments.length}/${desiredMomentCount}; narration-derived fallback moments ${fallbackMomentCount}.`,
      );
    }
    const meaningSignature = (moment: FinancialVisualMoment) => [
      moment.kind,
      moment.presentationStyle,
      moment.position,
      moment.value || "",
      moment.detail?.toLocaleLowerCase("ru-RU") || "",
      moment.sourceLabel?.toLocaleLowerCase("ru-RU") || "",
      moment.targetLabel?.toLocaleLowerCase("ru-RU") || "",
    ].join("|");
    let duplicateFallbackCount = 0;
    for (let momentIndex = 1; momentIndex < moments.length; momentIndex += 1) {
      if (meaningSignature(moments[momentIndex - 1]!) === meaningSignature(moments[momentIndex]!)) {
        const current = moments[momentIndex]!;
        const previous = moments[momentIndex - 1]!;
        const fallbackSeed = `${topic}:${voice}:${sceneIndex}:${momentIndex}:${current.voiceExcerpt}:distinct`;
        const kind = fallbackVisualKindForTopic(
          topic,
          concept,
          current.voiceExcerpt,
          stableChoiceIndex(fallbackSeed, 2_147_483_647),
          previous.kind,
        );
        moments[momentIndex] = {
          ...current,
          kind,
          presentationStyle: fallbackVisualPresentation(
            kind,
            stableChoiceIndex(`${fallbackSeed}:presentation`, 2_147_483_647),
          ),
          value: undefined,
          detail: undefined,
          sourceLabel: undefined,
          targetLabel: undefined,
          position: fallbackPositions[stableChoiceIndex(`${fallbackSeed}:position`, fallbackPositions.length)]!,
        };
        duplicateFallbackCount += 1;
        if (meaningSignature(previous) === meaningSignature(moments[momentIndex]!)) {
          throw new Error(`AI Visual Plan: не удалось создать новый визуальный смысл для момента ${sceneIndex + 1}.${momentIndex + 1}.`);
        }
      }
    }
    if (duplicateFallbackCount > 0) {
      console.warn(
        `[financial-visual-director] ${topic}, scene ${sceneIndex + 1}: replaced ${duplicateFallbackCount} repeated visual moments with concept-specific visuals.`,
      );
    }
    let repositionedMomentCount = 0;
    for (let momentIndex = 1; momentIndex < moments.length; momentIndex += 1) {
      const previousPosition = moments[momentIndex - 1]!.position;
      if (moments[momentIndex]!.position !== previousPosition) continue;
      const alternatives = fallbackPositions.filter((position) => position !== previousPosition);
      const fallbackSeed = `${topic}:${voice}:${sceneIndex}:${momentIndex}:position`;
      moments[momentIndex] = {
        ...moments[momentIndex]!,
        position: alternatives[stableChoiceIndex(fallbackSeed, alternatives.length)]!,
      };
      repositionedMomentCount += 1;
    }
    if (repositionedMomentCount > 0) {
      console.warn(
        `[financial-visual-director] ${topic}, scene ${sceneIndex + 1}: shifted ${repositionedMomentCount} adjacent visual moments to different positions.`,
      );
    }

    const presenterPose = textValue(planScene.presenter_pose) as PresenterPose;
    if (!FINANCIAL_PRESENTER_POSES.includes(presenterPose)) {
      throw new Error(`AI Visual Plan: сцена ${sceneIndex + 1} должна выбрать позу ведущего из ${FINANCIAL_PRESENTER_POSES.join(", ")}.`);
    }
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

    return {
      moments,
      composition,
      presenterLayout,
      presenterPose,
      cameraAction: normalizeCosmeticEnum(
        planScene.camera_action,
        CAMERA_ACTIONS,
        "camera_action",
        "locked",
      ),
      transitionIn: normalizeCosmeticEnum(
        planScene.transition_in,
        SCENE_TRANSITIONS,
        "transition_in",
        SCENE_TRANSITIONS[stableChoiceIndex(`${topic}:${voice}:${sceneIndex}:transition`, SCENE_TRANSITIONS.length)]!,
      ),
    };
  });
  if (targetDurationSeconds !== undefined && normalizedScenes.length > 1) {
    let activePose = normalizedScenes[0]!.presenterPose;
    let lastPoseChangeAtMs = 0;
    let sceneStartAtMs = 0;
    for (let sceneIndex = 1; sceneIndex < normalizedScenes.length; sceneIndex += 1) {
      sceneStartAtMs += wordsIn(textValue(scriptScenes[sceneIndex - 1]!.voice_text)).length
        / ESTIMATED_SPEECH_WORDS_PER_SECOND * 1_000;
      const scene = normalizedScenes[sceneIndex]!;
      if (sceneStartAtMs - lastPoseChangeAtMs < 5_000) {
        scene.presenterPose = activePose;
        continue;
      }
      let nextPose = scene.presenterPose;
      if (nextPose === activePose) {
        const alternatives = FINANCIAL_PRESENTER_POSES.filter((pose) => pose !== activePose);
        nextPose = alternatives[
          stableChoiceIndex(`${topic}:${sceneIndex}:pose-cooldown`, alternatives.length)
        ]!;
      }
      scene.presenterPose = nextPose;
      activePose = nextPose;
      lastPoseChangeAtMs = sceneStartAtMs;
    }
  }
  const poseChangeCount = normalizedScenes.slice(1).filter(
    (scene, index) => scene.presenterPose !== normalizedScenes[index]!.presenterPose,
  ).length;
  const minimumPoseChanges = targetDurationSeconds === undefined
    ? Math.min(1, normalizedScenes.length - 1)
    : Math.min(4, normalizedScenes.length - 1);
  const maximumPoseChanges = targetDurationSeconds === undefined
    ? normalizedScenes.length - 1
    : Math.min(6, normalizedScenes.length - 1);
  if (poseChangeCount < minimumPoseChanges || poseChangeCount > maximumPoseChanges) {
    throw new Error(`AI Visual Plan: позы ведущего должны смениться ${minimumPoseChanges}–${maximumPoseChanges} раз, получено ${poseChangeCount}.`);
  }
  const movingCameraSceneCount = normalizedScenes.filter((scene) => scene.cameraAction !== "locked").length;
  const maximumMovingCameraScenes = Math.max(1, Math.floor(normalizedScenes.length / 4));
  if (movingCameraSceneCount > maximumMovingCameraScenes) {
    throw new Error(`AI Visual Plan: камера должна оставаться locked в большинстве сцен; движений камеры ${movingCameraSceneCount}, максимум ${maximumMovingCameraScenes}.`);
  }
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

function buildNarrationDrivenVisualPlan(
  topic: string,
  concept: FinancialConcept,
  scriptScenes: FinancialAiScene[],
  targetDurationSeconds?: number,
): FinancialVisualPlanResponse {
  const requiredPoseChanges = Math.min(5, Math.max(0, scriptScenes.length - 1));
  const poseOffset = stableChoiceIndex(
    `${topic}:fallback-presenter-poses`,
    FINANCIAL_PRESENTER_POSES.length,
  );
  let previousTransition: FinancialSceneTransition | undefined;

  return {
    scenes: scriptScenes.map((scriptScene, sceneIndex) => {
      const voice = textValue(scriptScene.voice_text);
      const voiceWords = wordsIn(voice);
      if (!voiceWords.length) {
        throw new Error(`Сцена ${sceneIndex + 1} не содержит текста для narration-driven visual plan.`);
      }
      const momentCount = targetVisualMomentCount(
        voiceWords.length,
        MAX_WORDS_PER_VISUAL_MOMENT,
        targetDurationSeconds === undefined ? 1 : 3,
      );
      const moments = Array.from({ length: momentCount }, (_, momentIndex) => {
        const startWord = Math.floor(momentIndex * voiceWords.length / momentCount);
        const endWord = Math.max(
          startWord + 1,
          Math.floor((momentIndex + 1) * voiceWords.length / momentCount),
        );
        const excerpt = wordExcerpt(voice, startWord, endWord);
        const seed = `${topic}:${voice}:${sceneIndex}:${momentIndex}:${excerpt}:narration-fallback`;
        const ordinal = stableChoiceIndex(seed, 2_147_483_647);
        const kind = fallbackVisualKindForTopic(topic, concept, excerpt, ordinal);
        const microBeats = fallbackMicroBeats(
          excerpt,
          `${sceneIndex + 1}.${momentIndex + 1}`,
        ).map((microBeat) => ({
          type: microBeat.kind,
          cue_excerpt: microBeat.cueExcerpt,
          text: microBeat.text,
          position: microBeat.position,
          enter_animation: microBeat.enterAnimation,
          exit_animation: microBeat.exitAnimation,
          hold_words: microBeat.holdWords,
        }));

        return {
          voice_excerpt: excerpt,
          visual_kind: kind,
          label: excerpt.slice(0, 48),
          value: "",
          detail: "",
          source_label: "",
          target_label: "",
          presentation_style: fallbackVisualPresentation(kind, ordinal),
          position: VISUAL_POSITIONS[stableChoiceIndex(`${seed}:position`, VISUAL_POSITIONS.length)],
          enter_animation: VISUAL_ENTRY_ANIMATIONS[
            stableChoiceIndex(`${seed}:enter`, VISUAL_ENTRY_ANIMATIONS.length)
          ],
          exit_animation: VISUAL_EXIT_ANIMATIONS[
            stableChoiceIndex(`${seed}:exit`, VISUAL_EXIT_ANIMATIONS.length)
          ],
          micro_beats: microBeats,
        };
      });

      const transitionIndex = sceneIndex === 0
        ? SCENE_TRANSITIONS.indexOf("cut")
        : stableChoiceIndex(
            `${topic}:${sceneIndex}:${voice}:fallback-transition`,
            SCENE_TRANSITIONS.length,
          );
      let transition = SCENE_TRANSITIONS[transitionIndex] ?? SCENE_TRANSITIONS[0]!;
      if (sceneIndex > 0 && transition === previousTransition) {
        transition = SCENE_TRANSITIONS[(transitionIndex + 1) % SCENE_TRANSITIONS.length]!;
      }
      previousTransition = transition;

      const poseStep = Math.min(sceneIndex, requiredPoseChanges);
      const presenterPose = FINANCIAL_PRESENTER_POSES[
        (poseOffset + poseStep) % FINANCIAL_PRESENTER_POSES.length
      ]!;
      return {
        scene_number: sceneIndex + 1,
        duration_seconds: voiceWords.length / ESTIMATED_SPEECH_WORDS_PER_SECOND,
        target_moment_count: momentCount,
        camera_action: "locked",
        transition_in: transition,
        composition: "center",
        presenter_layout: "center",
        presenter_pose: presenterPose,
        moments,
      };
    }),
  };
}

async function requestFinancialVisualPlan(
  topic: string,
  concept: FinancialConcept,
  scriptScenes: FinancialAiScene[],
  targetDurationSeconds?: number,
): Promise<Array<{
  moments: FinancialVisualMoment[];
  composition: FinancialComposition;
  presenterLayout: PresenterLayout;
  presenterPose: PresenterPose;
  cameraAction: string;
  transitionIn: FinancialSceneTransition;
}>> {
  const permittedKinds = MOMENT_KINDS_BY_CONCEPT[concept];
  const microBeatSchema = () => [{
    type: `one of: ${MICRO_BEAT_KINDS.join(", ")}`,
    cue_excerpt: "exact consecutive spoken words from this visual moment",
    text: "short exact fragment of cue_excerpt; empty only for arrow",
    position: `one of: ${MICRO_BEAT_POSITIONS.join(", ")}`,
    enter_animation: `one of: ${VISUAL_ENTRY_ANIMATIONS.join(", ")}`,
    exit_animation: `one of: ${MICRO_BEAT_EXIT_ANIMATIONS.join(", ")}`,
    hold_words: "2 or 3",
  }, {
    type: `one of: ${MICRO_BEAT_KINDS.join(", ")}`,
    cue_excerpt: "a later exact phrase from this visual moment",
    text: "short exact fragment of cue_excerpt; empty only for arrow",
    position: `one of: ${MICRO_BEAT_POSITIONS.join(", ")}`,
    enter_animation: `one of: ${VISUAL_ENTRY_ANIMATIONS.join(", ")}`,
    exit_animation: `one of: ${MICRO_BEAT_EXIT_ANIMATIONS.join(", ")}`,
    hold_words: "2 or 3",
  }];
  const visualMomentSchema = (momentIndex: number) => ({
    voice_excerpt: `exact consecutive words for moment ${momentIndex + 1}`,
    visual_kind: `one of: ${permittedKinds.join(", ")}`,
    label: "short, topic-specific label",
    value: "only a value literally stated in this exact narration or screen text",
    detail: "brief explanation grounded in this exact moment",
    source_label: "participant stated in this exact moment, or empty",
    target_label: "participant stated in this exact moment, or empty",
    presentation_style: `one of: ${VISUAL_PRESENTATION_STYLES.join(", ")}`,
    position: `one of: ${VISUAL_POSITIONS.join(", ")}`,
    enter_animation: `one of: ${VISUAL_ENTRY_ANIMATIONS.join(", ")}`,
    exit_animation: `one of: ${VISUAL_EXIT_ANIMATIONS.join(", ")}`,
    micro_beats: microBeatSchema(),
  });
  const visualPlanSchema = {
    scenes: scriptScenes.map((scene, sceneIndex) => {
      const wordCount = wordsIn(textValue(scene.voice_text)).length;
      const momentCount = targetVisualMomentCount(
        wordCount,
        MAX_WORDS_PER_VISUAL_MOMENT,
        targetDurationSeconds === undefined ? 1 : 3,
      );
      return {
        scene_number: sceneIndex + 1,
        duration_seconds: "number matching the input narration",
        target_moment_count: momentCount,
        camera_action: `one of: ${CAMERA_ACTIONS.join(", ")}`,
        transition_in: `one of: ${SCENE_TRANSITIONS.join(", ")}`,
        composition: `one of: ${VISUAL_COMPOSITIONS.join(", ")}`,
        presenter_layout: `one of: ${PRESENTER_LAYOUTS.join(", ")}`,
        presenter_pose: `one of: ${FINANCIAL_PRESENTER_POSES.join(", ")}`,
        moments: Array.from({ length: momentCount }, (_, momentIndex) =>
          visualMomentSchema(momentIndex)),
      };
    }),
  };
  const system = [
    "Ты — отдельный AI visual director финансовых YouTube Shorts. До рендера создай план того, что, где, когда и как появляется, и когда уходит.",
    "Сценарий и voice_text уже утверждены. Не переписывай их, не добавляй фразы и не меняй финансовый смысл.",
    "Постоянная фирменная система ограничена ведущим, палитрой, типографикой, качеством кадра и safe zones. Она не задаёт карточки, изображения, графики, композицию, движение камеры, анимацию, переходы или последовательность.",
    "Создай visuals, карточки, изображения, схемы, графики, композицию, камеру, анимацию, переходы и последовательность заново для точной темы и речи этого ролика. Не копируй прошлые планы, фиксированные порядки или повторяющийся набор карточек.",
    `Ответ обязан содержать ровно ${scriptScenes.length} сцен: по одной на каждую входную сцену, с scene_number от 1 до ${scriptScenes.length}. Не добавляй новые сцены и не разбивай входные сцены — дополнительные визуальные события должны быть moments внутри исходной сцены. Не возвращай только пример первой сцены.`,
    "В каждой сцене создай ровно target_moment_count моментов. Разбей весь voice_text на последовательные точные voice_excerpt — копируй речь дословно, без пропусков и повторов.",
        `Каждый визуальный момент рассчитан примерно на 1–3 секунды речи: используй не более ${MAX_WORDS_PER_VISUAL_MOMENT} слов при скорости около 2.4 слова/секунду. Не объединяй длинные фрагменты; если схема запросила несколько моментов даже для короткой сцены, точно раздели текст на соответствующее число последовательных фрагментов.`,
    "ВНУТРИ каждого visual moment создай ровно 2 micro_beats в хронологическом порядке. Каждый cue_excerpt — точные 1–3 последовательных слова из voice_excerpt, text — точный фрагмент cue_excerpt; число и финансовый факт не добавляй. События должны быть разного типа и в разных позициях; используй как минимум один object, sticker, arrow, number или highlight, а не только kinetic text. Для каждого события выбери разные быстрые entrance-анимации и короткий exit; hold_words — 2 или 3. Эти события происходят внутри исходной сцены и не создают новых сцен.",
    "Каждый момент добавляет новый визуальный смысл из voice_excerpt, а не только новую подпись, цвет или fade. Не повторяй соседнюю комбинацию объекта, состояния, композиции и подписи: показывай новую сторону механики, действие, участника, поток или результат. Если visual_kind остаётся тем же, измени видимое состояние/отношение и detail, value, source_label или target_label.",
    "Варьируй карточки, документ, поток денег, график, шкалу, сравнение и sticker по смыслу. Используй быстрый cut, match transition или morph только когда сохраняется тот же объект; иначе замени сцену через slide, swipe, spring или zoom. Визуальный переход должен нести новый смысл, а не быть единственным изменением.",
    `Обязательное направление визуалов для выбранной темы: ${visualGuideForTopic(topic, concept)}`,
    "На всём ролике сохраняй предметную последовательность этой темы и показывай только относящиеся к ней инструменты; не переноси купоны и погашение облигаций в визуал акций или дивидендов. Если существенного факта нет в текущем фрагменте речи, не выдумывай сумму, ставку, дату, вес актива или участника.",
    "Для money_flow, distribution и reinvestment заполняй source_label и target_label участниками именно текущей фразы voice_excerpt. Не переноси участников из соседних фраз и не придумывай их; если сторону нельзя определить по этой фразе, оставь поле пустым.",
    `Для visual_kind используй только эти значения: ${permittedKinds.join(", ")}.`,
    "label и detail должны быть короткими. value можно заполнять только цифрой или коротким значением, которое буквально присутствует в screen_text; не выдумывай доходность, цену, тикер или число.",
    "Для каждого момента выбери position: top_left, top_center, top_right, center_left, center, center_right или hero. Не занимай нижнюю зону титров и лицо ведущего. Внутри сцены меняй сторону и размер верхней вставки: не повторяй position подряд, используй разные позиции и hero только для акцентного кадра.",
    "Для каждого момента выбери presentation_style из card, sticker, image_sticker, cutout_object, document, infographic, notification, icon_bubble, highlighted_word, number_counter. Не используй один прямоугольный card для всех моментов; меняй форму вставки по смыслу и не повторяй соседний стиль. image_sticker используй для графической иллюстрации с белой обводкой-стикером, highlighted_word — для короткого ключевого слова без большой панели.",
    "Для каждого момента выбери enter_animation из card_pop, sticker_pop, bounce, slide_left, slide_right, slide_top, slide_bottom, scale_pop, elastic_pop, rotate_scale, flip, swipe, spring, floating, notification, overshoot. Не повторяй тип анимации подряд. Motion blur допускается только на быстром переходе и не должен смазывать титр.",
    "Для каждого момента выбери exit_animation из slide_left, slide_right, slide_top, slide_bottom, shrink, fade, hold. Укажи, как элемент покидает кадр.",
    `Для каждого visual moment выбери presenter_pose из ${FINANCIAL_PRESENTER_POSES.join(", ")} по смыслу сцены. Меняй позу только при смысловом переходе; соседние сцены должны иметь разные pose cue. Короткий тест на 30–40 секунд должен содержать 4–6 реальных смен позы.`,
    "Сохраняй camera_action locked почти во всех сценах; не более одной сцены из четырёх может иметь движение камеры. Не используй zoom или pan как источник основной динамики: её создают micro_beats, kinetic text и смены позы.",
    "Сохраняй три раздельные зоны: тематические вставки сверху, короткое ключевое слово/фраза между вставками и ведущим, ведущий внизу. Не превращай ролик в один большой инфографический кадр; меняй верхний объект по мере смены фрагмента речи.",
    "Для каждой сцены выбери composition строго только из center, presenter_left, presenter_right, feature_card, а presenter_layout строго только из center, left, right, large. Не помещай в composition название визуального объекта — объекты указывай только в moments[].visual_kind. Ведущий остаётся снизу; обычно он по центру, боковые варианты используй максимум в двух сценах и не в первой или последней. Для бокового ведущего размещай главный визуал с противоположной стороны.",
    `Для каждой сцены выбери camera_action из ${CAMERA_ACTIONS.join(", ")} исходя из движения смыслового объекта; не назначай камеру по номеру сцены и не повторяй соседнее движение без причины.`,
    `Для каждой сцены выбери transition_in из ${SCENE_TRANSITIONS.join(", ")} исходя из визуальной непрерывности; не используй циклический порядок и не повторяй соседний переход без причины. Для первой сцены обычно выбирай cut.`,
    `При ${MIN_SCENES} и более сценах хотя бы одна средняя сцена должна отличаться от center: presenter_left, presenter_right или feature_card. Выбери её по смыслу, не копируй фиксированный порядок.`,
    "Не используй одинаковую компоновку карточек или визуальный ритм во всех роликах. presentation_style — один из доступных инструментов, а не постоянный каркас.",
    `Следующий JSON показывает ровно ${scriptScenes.length} входных сцен и точное число moments в каждой. Сохрани эти количества, замени описания реальными значениями, а voice_excerpt и cue_excerpt скопируй из текста сцены. Это не дизайн-шаблон.`,
    "Верни только JSON без markdown:",
    JSON.stringify(visualPlanSchema),
  ].join("\n");
  const user = JSON.stringify({
    topic,
    concept,
    target_duration_seconds: targetDurationSeconds ?? null,
    expected_scene_count: scriptScenes.length,
    conceptVisualGuide: visualGuideForTopic(topic, concept),
    brandStyle: FINANCE_BRAND_PROFILE,
    allowedVisualKinds: permittedKinds,
    scenes: scriptScenes.map((scene, index) => ({
      scene_number: index + 1,
      target_moment_count: targetVisualMomentCount(wordsIn(textValue(scene.voice_text)).length),
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
      12_000,
    );
    try {
      return normalizeVisualPlan(topic, response, scriptScenes, concept, targetDurationSeconds);
    } catch (error) {
      previousResponse = response;
      previousError = error instanceof Error ? error.message : "неизвестная ошибка проверки";
      if (attempt === 1) {
        console.warn(
          `[financial-visual-director] AI plan remained invalid after repair (${previousError}); rebuilding visuals from exact narration.`,
        );
        try {
          return normalizeVisualPlan(
            topic,
            buildNarrationDrivenVisualPlan(topic, concept, scriptScenes, targetDurationSeconds),
            scriptScenes,
            concept,
            targetDurationSeconds,
          );
        } catch (fallbackError) {
          const fallbackReason = fallbackError instanceof Error
            ? fallbackError.message
            : "неизвестная ошибка narration fallback";
          throw new Error(
            `AI Visual Plan и narration fallback не прошли проверку: ${previousError}; ${fallbackReason}`,
          );
        }
      }
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
      objectKinds: ["investor", "company", "stock", "dividend", "payment", "money", "chart_up", "chart_down", "portfolio", "warning"],
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
      metricLabel: normalized.includes("офз") ? "КУПОН ГОСУДАРСТВА" : "КУПОННАЯ ДОХОДНОСТЬ",
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

function backgroundForScene(topic: string, scene: FinancialAiScene, index: number): FinanceBackgroundId {
  const sceneCue = [
    textValue(scene.voice_text),
    textValue(scene.visual_hint),
    textValue(scene.visual_action),
  ].join(":");
  const seed = `${topic}:${sceneCue}:${index}`;
  return FINANCE_BACKGROUND_LIBRARY[stableChoiceIndex(seed, FINANCE_BACKGROUND_LIBRARY.length)]!.id;
}

function chartKindForScene(
  scene: FinancialAiScene,
  visual: FinancialVisualKind,
  index: number,
  concept: FinancialConcept,
): FinanceChartKind {
  const requested = textValue(scene.chart_type) as FinanceChartKind;
  if (CHART_TYPES_BY_CONCEPT[concept].includes(requested)) return requested;
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

export async function createFinancialTopicPlan(
  topicInput: string,
  ctaInput = "",
  options: FinancialTopicPlanOptions = {},
): Promise<FinancialTopicPlan> {
  const topic = topicInput.trim().replace(/\s+/g, " ").slice(0, MAX_FINANCIAL_TOPIC_LENGTH);
  if (!topic) throw new Error("Укажите тему финансового ролика.");
  const cta = normalizeFinancialCta(ctaInput);
  const targetDurationSeconds = options.targetDurationSeconds;
  if (
    targetDurationSeconds !== undefined
    && (!Number.isFinite(targetDurationSeconds) || targetDurationSeconds < 30 || targetDurationSeconds > 40)
  ) {
    throw new Error("Целевая длительность тестового финансового ролика должна быть от 30 до 40 секунд.");
  }
  const profile = topicProfile(topic);
  const ai = await requestFinancialScript(topic, profile.concept, targetDurationSeconds, cta);
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
    .slice(0, MAX_SCENES);
  const requiredSceneCount = MIN_SCENES;
  if (aiScenes.length < requiredSceneCount) {
    throw new Error(`AI-сценарий вернул ${aiScenes.length} сцен; требуется не менее ${requiredSceneCount}.`);
  }
  const scenes = aiScenes;
  const ending = textValue(ai.ending);
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
  const requestedDuration = targetDurationSeconds ?? Math.max(
    MIN_DURATION_SECONDS,
    Math.min(MAX_DURATION_SECONDS, numberValue(ai.duration_seconds, totalSceneSeconds)),
  );
  const visualPlans = await requestFinancialVisualPlan(
    topic,
    selectedConcept,
    plannedScenes,
    targetDurationSeconds,
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
      cameraAction: visualPlans[index]!.cameraAction,
      transitionIn: visualPlans[index]!.transitionIn,
      textAnimation: textValue(scene.text_animation, "reveal"),
      soundEffect: textValue(scene.sound_effect, "none"),
      concept: selectedConcept,
      composition: visualPlans[index]!.composition,
      presenterLayout: visualPlans[index]!.presenterLayout,
      presenterPose: visualPlans[index]!.presenterPose,
      visualMoments: visualPlans[index]!.moments,
      objectKinds: stringArray(scene.objects),
      background: backgroundForScene(topic, scene, index),
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
  const visualMedia = await resolveFinancialVisualAssets(beats, selectedConcept);
  const background = backgroundForTopic(topic);
  const backgroundLabel = FINANCE_BACKGROUND_LIBRARY.find((item) => item.id === background)?.label || background;
  return {
    topic,
    cta,
    title: textValue(ai.title, `Финансы: ${topic}`).slice(0, 100),
    mainTitle: textValue(ai.title, topic).toLocaleUpperCase("ru-RU").slice(0, 54),
    script,
    targetDurationMs: requestedDuration * 1_000,
    visualConcept: selectedConcept,
    beats: visualMedia.beats,
    visualAssets: visualMedia.assets,
    visualMediaNotice: visualMedia.notice,
    visualMediaCredits: visualMedia.credits,
    background,
    visualTheme: "premium_creator",
    hook: textValue(ai.hook, beats[0]?.subtitle || topic),
    description: textValue(ai.description, `Образовательный ролик о теме «${topic}».`),
    objects: collectObjects(profile, beats),
    backgroundLabel,
    brandStyleLabel: FINANCE_BRAND_PROFILE.label,
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