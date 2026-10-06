import { readFile } from "node:fs/promises";
import { transcribeSpeechWithTimestamps } from "../audio-generation/elevenlabs-client";
import {
  resolveCoinOverviewMarketData,
  type CoinOverviewMarketData,
} from "../coin-overview-data";
import { alignKineticSubtitleWords } from "./longform-kinetic-subtitles";
import { renderLongformVisualVideo } from "./longform-visual-renderer";
import {
  alignPremiumFinanceV2SfxEvents,
  buildPremiumFinanceV2SubtitleEmphasisEvents,
  classifyPremiumFinanceV2ProductionVisualType,
  type PremiumFinanceV2ProductionResearchContext,
  type PremiumFinanceV2ProductionVisualEvent,
} from "./premium-dynamic-finance-v2-cinematic-visuals";
import {
  LONGFORM_COMPOSITIONS,
  LONGFORM_FOCAL_POINTS,
  LONGFORM_TRANSITIONS,
  LONGFORM_VISUAL_FORMS,
  buildLongformMicroBeats,
  validateLongformVisualPlan,
  type LongformVoice,
  type LongformVisualBeat,
} from "./longform-visual-director";
import type { KineticSubtitleWord } from "./longform-kinetic-subtitles";
import type { KineticSubtitleEmphasisEvent } from "./longform-kinetic-subtitles";

export type PremiumFinanceIntensity = "restrained" | "dynamic" | "impact";
export type PremiumFinanceSfxKind = "whoosh" | "impact";

export type PremiumDynamicFinanceBeat = LongformVisualBeat & {
  intensity: PremiumFinanceIntensity;
  keyWords: string[];
  emphasisWord?: string;
  sfxEvent?: PremiumFinanceSfxKind;
};

export type PremiumFinanceSfxEvent = {
  sceneId: number;
  startMs: number;
  kind: PremiumFinanceSfxKind;
  query: string;
  volume: number;
};

export type PremiumFinanceV2ProductionVisualPlan = {
  version: "PREMIUM_DYNAMIC_FINANCE_V2_FINAL";
  mode: "PRODUCTION";
  planId: string;
  createdAt: string;
  topic: string | null;
  entity: { id: string; name: string; symbol: string } | null;
  durationMs: number;
  aspectRatio: "16:9";
  dimensions: { width: 1920; height: 1080; fps: 30 };
  dataAsOf: string | null;
  dataSource: string | null;
  researchContext: PremiumFinanceV2ProductionResearchContext | null;
  factualMarketSnapshot: null | {
    currentPriceUsd: number;
    lowPriceUsd7d: number;
    highPriceUsd7d: number;
    changePercent7d: number;
    marketCapUsd: number | null;
    activity: { kind: string; valueUsd: number; sourceLabel: string; sourceUrl: string } | null;
    priceSamples: Array<{ timestamp: number; priceUsd: number }>;
    benchmarks: Array<{ id: string; name: string; symbol: string; changePercent7d: number }>;
  };
  sourceReferences: Array<{ label: string; url: string }>;
  events: PremiumFinanceV2ProductionVisualEvent[];
  sfxEvents: Array<{ sceneId: number; startMs: number; kind: PremiumFinanceSfxKind; volume: number }>;
  subtitlePolicy: {
    provider: "ElevenLabs Scribe";
    exactWordMatchesRequired: true;
    expectedWordCount: number;
    interpolatedWordCount: 0;
  };
  assetPolicy: "Use available scene assets when relevant; otherwise compose original V2 graphics.";
};

export type PremiumDynamicFinanceEditPlan = {
  beats: PremiumDynamicFinanceBeat[];
  sfxEvents: PremiumFinanceSfxEvent[];
  intensityCounts: Record<PremiumFinanceIntensity, number>;
};

export function buildPremiumFinanceV2ProductionVisualPlan(input: {
  topic?: string;
  durationMs: number;
  beats: PremiumDynamicFinanceBeat[];
  marketData?: CoinOverviewMarketData;
  coinResearchContext?: PremiumFinanceV2ProductionResearchContext;
  assetSceneIds?: number[];
  scribeWordCount: number;
  sfxEvents?: PremiumFinanceSfxEvent[];
}): PremiumFinanceV2ProductionVisualPlan {
  const market = input.marketData;
  const marketSourceReferences = market
    ? [
        { label: market.sourceLabel, url: market.coin.sourceUrl },
        ...(market.activity ? [{ label: market.activity.sourceLabel, url: market.activity.sourceUrl }] : []),
      ]
    : [];
  const research = input.coinResearchContext;
  const researchSourceReferences = research
    ? research.sourceUrls.map((url) => ({ label: research.sourceLabel, url }))
    : [];
  const sourceReferences = [...marketSourceReferences, ...researchSourceReferences]
    .filter((reference, index, all) => all.findIndex((item) => item.url === reference.url) === index);
  const assetSceneIds = new Set(input.assetSceneIds ?? []);
  const events = input.beats.map((beat): PremiumFinanceV2ProductionVisualEvent => {
    const visualType = classifyPremiumFinanceV2ProductionVisualType(
      `${beat.voiceExcerpt} ${beat.mainIdea} ${beat.visualConcept}`,
      beat.index,
    );
    const narrationText = beat.voiceExcerpt.toLocaleLowerCase("ru-RU");
    const narrationTokens = new Set(beat.voiceExcerpt.toLocaleUpperCase("ru-RU").split(/[^A-Z0-9]+/u));
    const comparisonSymbols = visualType === "COIN_COMPARISON" && market
      ? market.benchmarks
        .filter((benchmark) =>
          benchmark.symbol.toLocaleUpperCase("en-US") !== market.coin.symbol.toLocaleUpperCase("en-US")
          && (
            narrationTokens.has(benchmark.symbol.toLocaleUpperCase("en-US"))
            || narrationText.includes(benchmark.name.toLocaleLowerCase("ru-RU"))
          ),
        )
        .map((benchmark) => benchmark.symbol.toLocaleUpperCase("en-US"))
      : [];
    const factualData: Record<string, number | string | null> = {};
    if (market && visualType === "PRICE_MOVEMENT") {
      factualData.currentPriceUsd = market.currentPriceUsd;
      factualData.changePercent7d = market.changePercent7d;
      factualData.lowPriceUsd7d = market.lowPriceUsd7d;
      factualData.highPriceUsd7d = market.highPriceUsd7d;
    } else if (market && visualType === "MARKET_CAP") {
      factualData.marketCapUsd = market.marketCapUsd;
    } else if (market && visualType === "MARKET_ACTIVITY") {
      factualData.activityUsd = market.activity?.valueUsd ?? null;
    } else if (market && visualType === "COIN_COMPARISON" && comparisonSymbols.length) {
      factualData.changePercent7d = market.changePercent7d;
      for (const benchmark of market.benchmarks.filter((item) => comparisonSymbols.includes(item.symbol.toLocaleUpperCase("en-US")))) {
        factualData[`${benchmark.symbol.toLocaleLowerCase("en-US")}ChangePercent7d`] = benchmark.changePercent7d;
      }
    }
    const marketDependentVisual = visualType === "PRICE_MOVEMENT"
      || visualType === "MARKET_CAP"
      || visualType === "MARKET_ACTIVITY"
      || (visualType === "COIN_COMPARISON" && comparisonSymbols.length > 0);
    return {
      beatIndex: beat.index,
      sceneId: beat.sceneId,
      startMs: beat.startMs,
      endMs: beat.endMs,
      visualType,
      narration: beat.voiceExcerpt,
      mainIdea: beat.mainIdea,
      visualConcept: beat.visualConcept,
      assetDescription: beat.assetDescription,
      keyWords: beat.keyWords,
      comparisonSymbols,
      transition: beat.transition,
      movement: beat.movement,
      intensity: beat.intensity,
      sfxEvent: beat.sfxEvent ?? null,
      factualData,
      sourceReferences: marketDependentVisual
        ? marketSourceReferences
        : visualType === "QUOTE" || visualType === "NEWS_EDITORIAL"
          ? []
          : researchSourceReferences,
      assetPlan: assetSceneIds.has(beat.sceneId)
        ? { status: "available", reason: "Existing scene asset is available; use only when relevant to this visual." }
        : { status: "original-graphic", reason: "No suitable scene asset is required; compose the V2 visual from verified context or narration." },
    };
  });
  const uniqueId = `${market?.coin.symbol ?? "FINANCE"}-${Date.now()}`;
  return {
    version: "PREMIUM_DYNAMIC_FINANCE_V2_FINAL",
    mode: "PRODUCTION",
    planId: uniqueId,
    createdAt: new Date().toISOString(),
    topic: input.topic ?? null,
    entity: market ? {
      id: market.coin.id,
      name: market.coin.name,
      symbol: market.coin.symbol,
    } : null,
    durationMs: input.durationMs,
    aspectRatio: "16:9",
    dimensions: { width: 1920, height: 1080, fps: 30 },
    dataAsOf: market?.dataAsOf ?? null,
    dataSource: market?.sourceLabel ?? null,
    researchContext: research ? {
      sourceLabel: research.sourceLabel,
      description: research.description,
      categories: research.categories,
      genesisDate: research.genesisDate,
      hashingAlgorithm: research.hashingAlgorithm,
      sourceUrls: research.sourceUrls,
      sourceExcerpts: research.sourceExcerpts,
      historyFirstObservedAt: research.historyFirstObservedAt,
      historyLastObservedAt: research.historyLastObservedAt,
      historySourceUrl: research.historySourceUrl,
      historicalReturns: research.historicalReturns,
    } : null,
    factualMarketSnapshot: market ? {
      currentPriceUsd: market.currentPriceUsd,
      lowPriceUsd7d: market.lowPriceUsd7d,
      highPriceUsd7d: market.highPriceUsd7d,
      changePercent7d: market.changePercent7d,
      marketCapUsd: market.marketCapUsd,
      activity: market.activity ?? null,
      priceSamples: market.priceSamples.map(({ timestamp, priceUsd }) => ({ timestamp, priceUsd })),
      benchmarks: market.benchmarks.map((benchmark) => ({ ...benchmark })),
    } : null,
    sourceReferences,
    events,
    sfxEvents: (input.sfxEvents ?? []).map(({ sceneId, startMs, kind, volume }) => ({
      sceneId,
      startMs,
      kind,
      volume,
    })),
    subtitlePolicy: {
      provider: "ElevenLabs Scribe",
      exactWordMatchesRequired: true,
      expectedWordCount: input.scribeWordCount,
      interpolatedWordCount: 0,
    },
    assetPolicy: "Use available scene assets when relevant; otherwise compose original V2 graphics.",
  };
}

const STOP_WORDS = new Set([
  "а", "без", "бы", "в", "во", "вы", "для", "до", "её", "ее", "если", "же", "за",
  "и", "из", "или", "к", "как", "ко", "ли", "на", "над", "не", "но", "о", "об",
  "от", "по", "под", "при", "с", "со", "у", "что", "это", "этот", "эта", "так",
]);

const RISK_STEMS = [
  "риск", "опас", "угроз", "пад", "снижен", "просад", "убыт", "волатил",
  "коррекц", "ликвидац", "обвал",
];
const CONCLUSION_STEMS = [
  "итог", "вывод", "значит", "следовательно", "главн", "результат", "поэтому",
];
const FINANCE_STEMS = [
  "капитализац", "объем", "объём", "ликвид", "доход", "прибыл", "дивиденд",
  "выруч", "токен", "монет", "акци", "облигац", "ставк", "инфляц", "биткоин",
  "эфир", "ethereum", "bitcoin", "ton", "solana", "xrp", "процент",
];
const POSITIVE_STEMS = [
  "рост", "вырос", "увелич", "сильн", "поддерж", "восстанов", "положительн",
];
const CONTRAST_WORDS = new Set(["но", "однако", "вместо", "тогда", "напротив"]);
const NUMBER_WORDS = new Set([
  "ноль", "один", "одна", "одно", "два", "две", "три", "четыре", "пять", "шесть",
  "семь", "восемь", "девять", "десять", "одиннадцать", "двенадцать", "тринадцать",
  "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать",
  "девятнадцать", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят",
  "семьдесят", "восемьдесят", "девяносто", "сто", "тысяча", "тысячи", "тысяч",
  "миллион", "миллиона", "миллионов", "миллиард", "миллиарда", "миллиардов",
]);

function normalize(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replaceAll("ё", "е").replace(/[^\p{L}\p{N}%$€₽.-]/gu, "");
}

function tokenize(value: string): string[] {
  return value.match(/[\p{L}\p{N}]+(?:[.,/-][\p{L}\p{N}]+)*%?/gu) ?? [];
}

function startsWithAny(value: string, stems: string[]): boolean {
  return stems.some((stem) => value.startsWith(stem));
}

function keywordPriority(word: string, topicTerms: Set<string>, previousWord?: string): number {
  const normalized = normalize(word);
  if (!normalized || STOP_WORDS.has(normalized)) return 0;
  if (topicTerms.has(normalized)) return 120;
  if (/\d/u.test(normalized) || /[%$€₽]/u.test(normalized) || NUMBER_WORDS.has(normalized)) return 110;
  if (startsWithAny(normalized, RISK_STEMS)) return 95;
  if (startsWithAny(normalized, CONCLUSION_STEMS)) return 82;
  if (CONTRAST_WORDS.has(normalized)) return 72;
  if (startsWithAny(normalized, POSITIVE_STEMS)) return 68;
  if (startsWithAny(normalized, FINANCE_STEMS)) return 58;
  if (previousWord && CONTRAST_WORDS.has(normalize(previousWord))) return 48;
  return 0;
}

function getKeyWords(text: string, topicTerms: Set<string>): Array<{ text: string; priority: number }> {
  const words = tokenize(text);
  const candidates = words.flatMap((word, index) => {
    const priority = keywordPriority(word, topicTerms, words[index - 1]);
    return priority > 0 ? [{ text: word, priority, index }] : [];
  });
  candidates.sort((left, right) => right.priority - left.priority || left.index - right.index);
  return candidates.slice(0, 2).map(({ text, priority }) => ({ text, priority }));
}

function hasNumberedFact(words: string[]): boolean {
  return words.some((word) => /\d/u.test(word) || /[%$€₽]/u.test(word) || NUMBER_WORDS.has(normalize(word)));
}

function selectVisualForm(words: string[], index: number): typeof LONGFORM_VISUAL_FORMS[number] {
  const joined = words.map(normalize).join(" ");
  if (hasNumberedFact(words)) return "data-chart";
  if (/(?:истор|раньше|год|этап|период)/u.test(joined)) return "timeline";
  if (/(?:сравн|против|вместо|однако)/u.test(joined)) return "split-screen";
  if (/(?:сеть|блокчейн|ончейн|узел|протокол)/u.test(joined)) return "network-map";
  if (/(?:риск|угроз|пад|слаб)/u.test(joined)) return "abstract-field";
  if (words.length && index % 3 === 0) return "cinematic-interface";
  if (words.length && index % 3 === 1) return "process-flow";
  return LONGFORM_VISUAL_FORMS[index % LONGFORM_VISUAL_FORMS.length]!;
}

function wordTone(word: string): "green" | "red" | "gold" | "accent" {
  const normalized = normalize(word);
  if (/\d/u.test(normalized) || /[%$€₽]/u.test(normalized) || NUMBER_WORDS.has(normalized)) return "gold";
  if (startsWithAny(normalized, RISK_STEMS)) return "red";
  if (startsWithAny(normalized, POSITIVE_STEMS)) return "green";
  return "accent";
}

export function buildPremiumDynamicFinanceEditPlan(input: {
  voices: LongformVoice[];
  durationMs: number;
  topic?: string;
}): PremiumDynamicFinanceEditPlan {
  const microBeats = buildLongformMicroBeats({
    voices: input.voices,
    durationMs: input.durationMs,
  });
  if (!microBeats.length) throw new Error("Premium Finance Director produced no micro-beats");

  const topicTerms = new Set(tokenize(input.topic ?? "").map(normalize).filter(Boolean));
  const keyWordsByIndex = new Map<number, Array<{ text: string; priority: number }>>();
  for (const beat of microBeats) {
    keyWordsByIndex.set(beat.index, getKeyWords(beat.voiceExcerpt, topicTerms));
  }
  const eligible = microBeats
    .flatMap((beat) => {
      const top = keyWordsByIndex.get(beat.index)?.[0];
      return top ? [{ index: beat.index, priority: top.priority }] : [];
    })
    .sort((left, right) => right.priority - left.priority || left.index - right.index);
  const impactBudget = microBeats.length >= 10 ? Math.floor(microBeats.length * 0.1) : 0;
  const dynamicBudget = microBeats.length >= 5 ? Math.floor(microBeats.length * 0.2) : 0;
  const intensityByIndex = new Map<number, PremiumFinanceIntensity>();
  eligible.slice(0, impactBudget).forEach(({ index }) => intensityByIndex.set(index, "impact"));
  eligible.slice(impactBudget, impactBudget + dynamicBudget).forEach(({ index }) => {
    intensityByIndex.set(index, "dynamic");
  });

  let previousVisualForm: typeof LONGFORM_VISUAL_FORMS[number] | undefined;
  const rawBeats = microBeats.map((beat) => {
    const candidates = keyWordsByIndex.get(beat.index) ?? [];
    const intensity = intensityByIndex.get(beat.index) ?? "restrained";
    const emphasisWord = candidates[0]?.text;
    const words = tokenize(beat.voiceExcerpt);
    let visualForm = selectVisualForm(words, beat.index);
    if (visualForm === previousVisualForm) {
      const currentFormIndex = LONGFORM_VISUAL_FORMS.indexOf(visualForm);
      visualForm = LONGFORM_VISUAL_FORMS[(currentFormIndex + 1) % LONGFORM_VISUAL_FORMS.length]!;
    }
    previousVisualForm = visualForm;
    const transition = LONGFORM_TRANSITIONS[beat.index % LONGFORM_TRANSITIONS.length]!;
    const entry = intensity === "impact"
      ? "impact"
      : intensity === "dynamic"
        ? beat.index % 2 === 0 ? "sweep-left" : "sweep-right"
        : "rise";
    const movement = intensity === "impact"
      ? beat.index % 2 === 0 ? "overshoot" : "micro-shake"
      : intensity === "dynamic"
        ? beat.index % 2 === 0 ? "punch-in" : "whip-left"
        : beat.index % 2 === 0 ? "drift-up" : "pull-back";
    const exit = intensity === "impact"
      ? "flash"
      : intensity === "dynamic"
        ? beat.index % 2 === 0 ? "whip-left" : "whip-right"
        : "fade";
    const kineticText = intensity === "restrained" || !emphasisWord ? "" : emphasisWord;
    const mainIdea = beat.voiceExcerpt.trim().slice(0, 80) || "Короткая пауза";
    const visualConcept = intensity === "restrained"
      ? `Сдержанная ${visualForm} с лёгким движением; факты только из озвучки.`
      : `${intensity === "impact" ? "Акцентный" : "Динамичный"} ${visualForm} с дословным акцентом «${emphasisWord}».`;
    const assetDescription = "Оригинальная тёмная fintech-графика; не добавлять числа и факты сверх озвучки.";
    return {
      index: beat.index,
      mainIdea,
      visualConcept,
      assetDescription,
      visualForm,
      composition: LONGFORM_COMPOSITIONS[beat.index % LONGFORM_COMPOSITIONS.length]!,
      entry,
      movement,
      exit,
      transition,
      kineticText,
      focalPoint: LONGFORM_FOCAL_POINTS[beat.index % LONGFORM_FOCAL_POINTS.length]!,
    };
  });

  const validated = validateLongformVisualPlan(microBeats, { beats: rawBeats });
  const beats: PremiumDynamicFinanceBeat[] = validated.map((beat) => {
    const intensity = intensityByIndex.get(beat.index) ?? "restrained";
    const candidates = keyWordsByIndex.get(beat.index) ?? [];
    const emphasisWord = candidates[0]?.text;
    const sfxEvent: PremiumFinanceSfxKind | undefined = intensity === "impact"
      ? "impact"
      : intensity === "dynamic" && (beat.transition === "whip-left" || beat.transition === "whip-right")
        ? "whoosh"
        : undefined;
    return {
      ...beat,
      // Preserve the restrained/impact ratio even though the generic director
      // validates adjacent variety for its broader, LLM-authored plans.
      transition: intensity === "impact"
        ? "flash-cut"
        : intensity === "dynamic"
          ? beat.index % 2 === 0 ? "whip-left" : "whip-right"
          : "snap-cut",
      intensity,
      keyWords: candidates.map(({ text }) => text),
      ...(emphasisWord ? { emphasisWord } : {}),
      ...(sfxEvent ? { sfxEvent } : {}),
    };
  });

  const sfxEvents: PremiumFinanceSfxEvent[] = [];
  const sceneCounts = new Map<number, number>();
  let lastSfxAtMs = -12_000;
  for (const beat of beats) {
    if (!beat.sfxEvent || sfxEvents.length >= 6) continue;
    if (beat.startMs - lastSfxAtMs < 8_000) continue;
    const sceneCount = sceneCounts.get(beat.sceneId) ?? 0;
    if (sceneCount >= 2) continue;
    const kind = beat.sfxEvent;
    sfxEvents.push({
      sceneId: beat.sceneId,
      startMs: beat.startMs,
      kind,
      query: kind === "impact"
        ? "subtle short cinematic low impact sound effect"
        : "soft short cinematic whoosh transition sound effect",
      volume: kind === "impact" ? 0.16 : 0.12,
    });
    sceneCounts.set(beat.sceneId, sceneCount + 1);
    lastSfxAtMs = beat.startMs;
  }

  const intensityCounts = beats.reduce<Record<PremiumFinanceIntensity, number>>(
    (counts, beat) => {
      counts[beat.intensity] += 1;
      return counts;
    },
    { restrained: 0, dynamic: 0, impact: 0 },
  );
  return { beats, sfxEvents, intensityCounts };
}

export function buildPremiumFinanceEmphasisEvents(
  beats: PremiumDynamicFinanceBeat[],
  subtitleWords?: KineticSubtitleWord[],
): KineticSubtitleEmphasisEvent[] {
  return beats.flatMap((beat) => {
    if (!beat.emphasisWord || beat.intensity === "restrained") return [];
    const matchingWord = subtitleWords?.find((word) =>
      normalize(word.text) === normalize(beat.emphasisWord!)
      && word.startMs < beat.endMs
      && word.endMs > beat.startMs,
    );
    return [{
      word: beat.emphasisWord,
      startMs: matchingWord?.startMs ?? beat.startMs,
      endMs: matchingWord?.endMs ?? beat.endMs,
      intensity: beat.intensity,
      tone: wordTone(beat.emphasisWord),
    }];
  });
}

export function estimatePremiumFinanceSubtitleWords(
  voices: LongformVoice[],
  durationMs: number,
): KineticSubtitleWord[] {
  const sorted = voices
    .filter((voice) => !voice.isFullVoice && voice.text.trim())
    .filter((voice) => voice.startTime !== null && voice.endTime !== null)
    .sort((left, right) => (left.startTime ?? 0) - (right.startTime ?? 0));
  return sorted.flatMap((voice) => {
    const words = voice.text.trim().split(/\s+/u).filter(Boolean);
    const startMs = Math.max(0, Math.round(voice.startTime ?? 0));
    const endMs = Math.min(durationMs, Math.round(voice.endTime ?? durationMs));
    const availableMs = Math.max(0, endMs - startMs);
    if (!words.length || availableMs < words.length) return [];
    const weights = words.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, "").length));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let cursorWeight = 0;
    return words.flatMap((text, index) => {
      const wordStart = startMs + Math.round(availableMs * cursorWeight / totalWeight);
      cursorWeight += weights[index]!;
      const wordEnd = Math.min(endMs, startMs + Math.round(availableMs * cursorWeight / totalWeight));
      return wordEnd > wordStart ? [{ text, startMs: wordStart, endMs: wordEnd }] : [];
    });
  });
}

export async function renderPremiumDynamicFinanceProduction(input: {
  voices: LongformVoice[];
  durationMs: number;
  topic?: string;
  sourceAudioPath: string;
  outputPath: string;
  customScriptProduction?: boolean;
  coinResearchContext?: PremiumFinanceV2ProductionResearchContext;
  visualAssets?: Array<{ sceneId: number; buffer: Buffer }>;
  onVisualPlanCreated?: (plan: PremiumFinanceV2ProductionVisualPlan) => Promise<void>;
}): Promise<{
  outputPath: string;
  durationMs: number;
  visualPlan: PremiumFinanceV2ProductionVisualPlan;
}> {
  const editPlan = buildPremiumDynamicFinanceEditPlan({
    voices: input.voices,
    durationMs: input.durationMs,
    topic: input.topic,
  });
  let marketData: CoinOverviewMarketData | undefined;
  const requestedCoinSymbol = extractFinanceLongCoinSymbolFromTopic(input.topic);
  if (input.customScriptProduction && !requestedCoinSymbol) {
    throw new Error("PREMIUM_DYNAMIC_FINANCE_V2_FINAL cannot render a Telegram author script without a verified coin ticker");
  }
  if (requestedCoinSymbol) {
    marketData = await resolveCoinOverviewMarketData(
      requestedCoinSymbol,
      globalThis.fetch,
      undefined,
      { preferredSource: "CoinPaprika" },
    );
    if (marketData.coin.symbol.toLocaleUpperCase("en-US") !== requestedCoinSymbol) {
      throw new Error(
        `Verified market identity mismatch: requested ${requestedCoinSymbol}, received ${marketData.coin.symbol}`,
      );
    }
    console.info(JSON.stringify({
      render: "PREMIUM_DYNAMIC_FINANCE_V2_FINAL",
      event: "verified-coin-market-snapshot",
      coinId: marketData.coin.id,
      symbol: marketData.coin.symbol,
      source: marketData.sourceLabel,
      dataAsOf: marketData.dataAsOf,
    }));
  }
  const transcription = await transcribeSpeechWithTimestamps(await readFile(input.sourceAudioPath));
  const alignment = alignKineticSubtitleWords({
    voices: input.voices,
    transcriptWords: transcription.words,
    durationMs: input.durationMs,
    requireExactMatches: true,
  });
  if (
    alignment.matchCoverage !== 1
    || alignment.matchedWordCount !== alignment.expectedWordCount
    || alignment.interpolatedWordCount !== 0
  ) {
    throw new Error(
      `PREMIUM_DYNAMIC_FINANCE_V2_FINAL requires exact Scribe word timings: matched=${alignment.matchedWordCount}/${alignment.expectedWordCount}, interpolated=${alignment.interpolatedWordCount}`,
    );
  }
  const subtitleWords = alignment.words;
  console.info(JSON.stringify({
    render: "PREMIUM_DYNAMIC_FINANCE_V2_FINAL",
    event: "exact-scribe-word-alignment",
    matchedWords: alignment.matchedWordCount,
    expectedWords: alignment.expectedWordCount,
    interpolatedWords: alignment.interpolatedWordCount,
  }));

  const beatsByScene = new Map<number, PremiumDynamicFinanceBeat[]>();
  for (const beat of editPlan.beats) {
    const beats = beatsByScene.get(beat.sceneId) ?? [];
    beats.push(beat);
    beatsByScene.set(beat.sceneId, beats);
  }
  const subtitleEmphasis = buildPremiumFinanceV2SubtitleEmphasisEvents(
    subtitleWords,
    buildPremiumFinanceEmphasisEvents(editPlan.beats, subtitleWords),
  );
  const sfxWindows = [...beatsByScene.entries()].map(([sceneId, beats]) => {
    const ordered = [...beats].sort((left, right) => left.startMs - right.startMs);
    return {
      sceneId,
      startMs: ordered[0]!.startMs,
      endMs: ordered.at(-1)!.endMs,
      narration: ordered.map((beat) => beat.voiceExcerpt).join(" "),
      semanticType: "finance",
    };
  });
  const alignedSfxEvents = alignPremiumFinanceV2SfxEvents(
    editPlan.sfxEvents,
    sfxWindows,
    subtitleEmphasis,
  );

  const visualPlan = buildPremiumFinanceV2ProductionVisualPlan({
    topic: input.topic,
    durationMs: input.durationMs,
    beats: editPlan.beats,
    ...(marketData ? { marketData } : {}),
    ...(input.coinResearchContext ? { coinResearchContext: input.coinResearchContext } : {}),
    assetSceneIds: (input.visualAssets ?? []).map((asset) => asset.sceneId),
    scribeWordCount: alignment.expectedWordCount,
    sfxEvents: alignedSfxEvents,
  });
  await input.onVisualPlanCreated?.(visualPlan);

  const coinTag = marketData
    ? `[COIN: ${marketData.coin.symbol.toLocaleUpperCase("en-US")}]`
    : "[COIN: UNRESOLVED]";
  const routeTag = input.customScriptProduction
    ? `[FINANCE PRODUCTION] [PREMIUM_DYNAMIC_FINANCE_V2_FINAL] [CUSTOM SCRIPT] ${coinTag}`
    : `[FINANCE PRODUCTION] [PREMIUM_DYNAMIC_FINANCE_V2_FINAL] ${coinTag}`;
  console.info(JSON.stringify({
    event: "RENDER START",
    routeTag,
    planId: visualPlan.planId,
    visualEvents: visualPlan.events.length,
    sceneAssets: input.visualAssets?.length ?? 0,
  }));
  try {
    const rendered = await renderLongformVisualVideo({
      beats: editPlan.beats,
      durationMs: input.durationMs,
      sourceAudioPath: input.sourceAudioPath,
      outputPath: input.outputPath,
      kineticSubtitleWords: subtitleWords,
      kineticSubtitleEmphasis: buildPremiumFinanceEmphasisEvents(editPlan.beats, subtitleWords),
      profile: "PREMIUM_DYNAMIC_FINANCE_V2_FINAL",
      visualAssets: input.visualAssets ?? [],
      premiumFinanceV2VisualEvents: visualPlan.events,
      ...(input.coinResearchContext ? { premiumFinanceV2ResearchContext: visualPlan.researchContext ?? undefined } : {}),
      premiumFinanceV2SfxEvents: alignedSfxEvents,
      ...(marketData ? { marketData } : {}),
    });
    console.info(JSON.stringify({
      event: "RENDER COMPLETE",
      routeTag,
      planId: visualPlan.planId,
      outputPath: rendered.outputPath,
      durationMs: rendered.durationMs,
    }));
    return { ...rendered, visualPlan };
  } catch (error) {
    console.error(JSON.stringify({
      event: "RENDER FAILED",
      routeTag,
      planId: visualPlan.planId,
      reason: error instanceof Error ? error.message : String(error),
    }));
    throw error;
  }
}

export function extractFinanceLongCoinSymbolFromTopic(topic: string | undefined): string | undefined {
  const match = topic?.match(
    /(?:обзор|история)\s+монеты\s+.+?\s+\(([A-Z0-9._-]{1,12})\)/iu,
  );
  return match?.[1]?.toLocaleUpperCase("en-US");
}