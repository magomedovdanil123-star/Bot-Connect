import { readFile } from "node:fs/promises";
import { transcribeSpeechWithTimestamps } from "../audio-generation/elevenlabs-client";
import { resolveCoinOverviewMarketData, type CoinOverviewMarketData } from "../coin-overview-data";
import { alignKineticSubtitleWords } from "./longform-kinetic-subtitles";
import { renderLongformVisualVideo } from "./longform-visual-renderer";
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

export type PremiumDynamicFinanceEditPlan = {
  beats: PremiumDynamicFinanceBeat[];
  sfxEvents: PremiumFinanceSfxEvent[];
  intensityCounts: Record<PremiumFinanceIntensity, number>;
};

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
  visualAssets: Array<{ sceneId: number; buffer: Buffer }>;
}): Promise<{ outputPath: string; durationMs: number }> {
  const editPlan = buildPremiumDynamicFinanceEditPlan({
    voices: input.voices,
    durationMs: input.durationMs,
    topic: input.topic,
  });
  if (!input.visualAssets.length) {
    throw new Error("PREMIUM_DYNAMIC_FINANCE_V2_FINAL requires scene images; refusing a vector-only or legacy render");
  }
  let marketData: CoinOverviewMarketData | undefined;
  const requestedCoinSymbol = extractFinanceLongCoinSymbolFromTopic(input.topic);
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

  const routeTag = input.customScriptProduction
    ? "[FINANCE PRODUCTION] [PREMIUM_DYNAMIC_FINANCE_V2_FINAL] [CUSTOM SCRIPT] [RENDERER: renderLongformVisualVideo]"
    : "[FINANCE PRODUCTION] [PREMIUM_DYNAMIC_FINANCE_V2_FINAL] [RENDERER: renderLongformVisualVideo]";
  console.info(`${routeTag} Starting the approved long-form render.`);
  return renderLongformVisualVideo({
    beats: editPlan.beats,
    durationMs: input.durationMs,
    sourceAudioPath: input.sourceAudioPath,
    outputPath: input.outputPath,
    kineticSubtitleWords: subtitleWords,
    kineticSubtitleEmphasis: buildPremiumFinanceEmphasisEvents(editPlan.beats, subtitleWords),
    profile: "PREMIUM_DYNAMIC_FINANCE_V2_FINAL",
    visualAssets: input.visualAssets,
    ...(marketData ? { marketData } : {}),
  });
}

export function extractFinanceLongCoinSymbolFromTopic(topic: string | undefined): string | undefined {
  const match = topic?.match(
    /(?:обзор|история)\s+монеты\s+.+?\s+\(([A-Z0-9._-]{1,12})\)/iu,
  );
  return match?.[1]?.toLocaleUpperCase("en-US");
}