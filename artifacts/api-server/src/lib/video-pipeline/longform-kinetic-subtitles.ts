export type KineticSubtitleVoice = {
  sceneId?: number;
  text: string;
  startTime: number | null;
  endTime: number | null;
  isFullVoice?: boolean;
};

export type KineticSubtitleTranscriptWord = {
  text: string;
  start?: number;
  end?: number;
  type?: string;
};

export type KineticSubtitleWord = {
  text: string;
  startMs: number;
  endMs: number;
};

export type KineticSubtitleAlignment = {
  words: KineticSubtitleWord[];
  expectedWordCount: number;
  matchedWordCount: number;
  interpolatedWordCount: number;
  matchCoverage: number;
};

type ExpectedWord = KineticSubtitleWord & {
  normalized: string;
  numericValue: number | null;
  voiceStartMs: number;
  voiceEndMs: number;
};

type ObservedWord = KineticSubtitleWord & {
  normalized: string;
};

const MIN_MATCH_COVERAGE = 0.88;
const MAX_WORDS_PER_PHRASE = 3;
const MAX_PHRASE_DURATION_MS = 1_450;
const MAX_RUSSIAN_NUMBER_WORDS = 16;
const MAX_RUSSIAN_NUMBER_WORD_GAP_MS = 800;

const RUSSIAN_CARDINAL_UNITS = new Map<string, number>([
  ["ноль", 0], ["нуля", 0],
  ["один", 1], ["одна", 1], ["одно", 1], ["одного", 1], ["одной", 1], ["одну", 1], ["одним", 1], ["одном", 1],
  ["два", 2], ["две", 2], ["двух", 2],
  ["три", 3], ["трех", 3],
  ["четыре", 4], ["четырех", 4],
  ["пять", 5], ["пяти", 5],
  ["шесть", 6], ["шести", 6],
  ["семь", 7], ["семи", 7],
  ["восемь", 8], ["восьми", 8],
  ["девять", 9], ["девяти", 9],
]);

const RUSSIAN_CARDINAL_TEENS = new Map<string, number>([
  ["десять", 10], ["десяти", 10],
  ["одиннадцать", 11], ["одиннадцати", 11],
  ["двенадцать", 12], ["двенадцати", 12],
  ["тринадцать", 13], ["тринадцати", 13],
  ["четырнадцать", 14], ["четырнадцати", 14],
  ["пятнадцать", 15], ["пятнадцати", 15],
  ["шестнадцать", 16], ["шестнадцати", 16],
  ["семнадцать", 17], ["семнадцати", 17],
  ["восемнадцать", 18], ["восемнадцати", 18],
  ["девятнадцать", 19], ["девятнадцати", 19],
]);

const RUSSIAN_CARDINAL_TENS = new Map<string, number>([
  ["двадцать", 20], ["двадцати", 20],
  ["тридцать", 30], ["тридцати", 30],
  ["сорок", 40], ["сорока", 40],
  ["пятьдесят", 50], ["пятидесяти", 50],
  ["шестьдесят", 60], ["шестидесяти", 60],
  ["семьдесят", 70], ["семидесяти", 70],
  ["восемьдесят", 80], ["восьмидесяти", 80],
  ["девяносто", 90], ["девяноста", 90],
]);

const RUSSIAN_CARDINAL_HUNDREDS = new Map<string, number>([
  ["сто", 100], ["ста", 100],
  ["двести", 200], ["двухсот", 200],
  ["триста", 300], ["трехсот", 300],
  ["четыреста", 400], ["четырехсот", 400],
  ["пятьсот", 500], ["пятисот", 500],
  ["шестьсот", 600], ["шестисот", 600],
  ["семьсот", 700], ["семисот", 700],
  ["восемьсот", 800], ["восьмисот", 800],
  ["девятьсот", 900], ["девятисот", 900],
]);

const RUSSIAN_CARDINAL_SCALES = new Map<string, number>([
  ["тысяча", 1_000], ["тысячи", 1_000], ["тысяч", 1_000], ["тысячу", 1_000],
  ["тысячей", 1_000], ["тысячам", 1_000], ["тысячами", 1_000], ["тысячах", 1_000],
  ["миллион", 1_000_000], ["миллиона", 1_000_000], ["миллионов", 1_000_000],
  ["миллиону", 1_000_000], ["миллионом", 1_000_000], ["миллионе", 1_000_000], ["миллионы", 1_000_000],
  ["миллиард", 1_000_000_000], ["миллиарда", 1_000_000_000], ["миллиардов", 1_000_000_000],
  ["миллиарду", 1_000_000_000], ["миллиардом", 1_000_000_000], ["миллиарде", 1_000_000_000],
  ["триллион", 1_000_000_000_000], ["триллиона", 1_000_000_000_000], ["триллионов", 1_000_000_000_000],
]);

const RUSSIAN_CARDINAL_WORDS = new Set([
  ...RUSSIAN_CARDINAL_UNITS.keys(),
  ...RUSSIAN_CARDINAL_TEENS.keys(),
  ...RUSSIAN_CARDINAL_TENS.keys(),
  ...RUSSIAN_CARDINAL_HUNDREDS.keys(),
  ...RUSSIAN_CARDINAL_SCALES.keys(),
]);

function normalizedWord(value: string): string {
  return value.toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function arabicIntegerValue(value: string): number | null {
  const token = value.trim().replace(/[.,!?;:]+$/gu, "");
  const match = token.match(/^([+-]?)(\d+)%?$/u);
  if (!match) return null;
  const amount = Number(match[2]);
  if (!Number.isSafeInteger(amount)) return null;
  return match[1] === "-" ? -amount : amount;
}

function parseRussianCardinalGroup(words: string[]): number | null {
  let index = 0;
  let value = 0;
  const hundred = RUSSIAN_CARDINAL_HUNDREDS.get(words[index]!);
  if (hundred !== undefined) {
    value += hundred;
    index += 1;
  }
  if (index >= words.length) return value;

  const teen = RUSSIAN_CARDINAL_TEENS.get(words[index]!);
  if (teen !== undefined) {
    return index === words.length - 1 ? value + teen : null;
  }

  const ten = RUSSIAN_CARDINAL_TENS.get(words[index]!);
  if (ten !== undefined) {
    value += ten;
    index += 1;
    if (index < words.length) {
      const unit = RUSSIAN_CARDINAL_UNITS.get(words[index]!);
      if (unit === undefined || unit === 0 || unit > 9) return null;
      value += unit;
      index += 1;
    }
    return index === words.length ? value : null;
  }

  const unit = RUSSIAN_CARDINAL_UNITS.get(words[index]!);
  return unit !== undefined && index === words.length - 1 ? value + unit : null;
}

function parseRussianCardinalWords(words: string[]): number | null {
  let total = 0;
  let group: string[] = [];
  let previousScale = Number.POSITIVE_INFINITY;

  for (const word of words) {
    const scale = RUSSIAN_CARDINAL_SCALES.get(word);
    if (scale !== undefined) {
      if (scale >= previousScale) return null;
      const groupValue = group.length ? parseRussianCardinalGroup(group) : 1;
      if (groupValue === null || groupValue >= 1_000) return null;
      total += groupValue * scale;
      group = [];
      previousScale = scale;
      continue;
    }
    if (!RUSSIAN_CARDINAL_UNITS.has(word)
      && !RUSSIAN_CARDINAL_TEENS.has(word)
      && !RUSSIAN_CARDINAL_TENS.has(word)
      && !RUSSIAN_CARDINAL_HUNDREDS.has(word)) {
      return null;
    }
    group.push(word);
  }

  const remainder = group.length ? parseRussianCardinalGroup(group) : 0;
  if (remainder === null || remainder >= 1_000) return null;
  return total + remainder;
}

function matchingObservedSpanLengths(
  expected: ExpectedWord[],
  expectedIndex: number,
  observed: ObservedWord[],
  startIndex: number,
): number[] {
  const expectedWord = expected[expectedIndex]!;
  if (expectedWord.normalized === observed[startIndex]!.normalized) return [1];
  const expectedNumber = expectedWord.numericValue;
  if (expectedNumber === null) return [];

  const numberWords: string[] = [];
  const matches: number[] = [];
  let previous: ObservedWord | undefined;
  for (
    let index = startIndex;
    index < observed.length && numberWords.length < MAX_RUSSIAN_NUMBER_WORDS;
    index += 1
  ) {
    const word = observed[index]!;
    if (!RUSSIAN_CARDINAL_WORDS.has(word.normalized)) break;
    if (previous && (
      word.startMs - previous.endMs > MAX_RUSSIAN_NUMBER_WORD_GAP_MS
      || /[.,!?;:]$/u.test(previous.text)
    )) break;
    numberWords.push(word.normalized);
    const observedNumber = parseRussianCardinalWords(numberWords);
    if (observedNumber === expectedNumber) {
      const nextWord = observed[index + 1];
      const nextContinuesNumber = Boolean(
        nextWord
        && RUSSIAN_CARDINAL_WORDS.has(nextWord.normalized)
        && nextWord.startMs - word.endMs <= MAX_RUSSIAN_NUMBER_WORD_GAP_MS
        && !/[.,!?;:]$/u.test(word.text),
      );
      const nextIsSeparateScale = Boolean(
        nextContinuesNumber
        && nextWord
        && RUSSIAN_CARDINAL_SCALES.has(nextWord.normalized)
        && expected[expectedIndex + 1]?.normalized === nextWord.normalized,
      );
      if (!nextContinuesNumber || nextIsSeparateScale) matches.push(numberWords.length);
    }
    previous = word;
  }
  return matches;
}

function wordsFromText(value: string): string[] {
  return value.trim()
    .split(/\s+/u)
    .map((word) => word.trim())
    .filter((word) => normalizedWord(word).length > 0 && !/^[—–-]+$/u.test(word));
}

function mergeHyphenatedTranscriptWords(
  observed: ObservedWord[],
  expectedCompounds: Set<string>,
): ObservedWord[] {
  if (!expectedCompounds.size) return observed;
  const merged: ObservedWord[] = [];
  for (let index = 0; index < observed.length; index += 1) {
    const first = observed[index]!;
    let combined = first.normalized;
    let matchedThrough = -1;
    for (let nextIndex = index + 1; nextIndex < observed.length && nextIndex <= index + 2; nextIndex += 1) {
      const next = observed[nextIndex]!;
      if (next.startMs - observed[nextIndex - 1]!.endMs > 450) break;
      combined += next.normalized;
      if (expectedCompounds.has(combined)) {
        matchedThrough = nextIndex;
        merged.push({
          text: observed.slice(index, nextIndex + 1).map((word) => word.text).join(" "),
          normalized: combined,
          startMs: first.startMs,
          endMs: next.endMs,
        });
        break;
      }
    }
    if (matchedThrough >= 0) index = matchedThrough;
    else merged.push(first);
  }
  return merged;
}

export function alignKineticSubtitleWords(input: {
  voices: KineticSubtitleVoice[];
  transcriptWords: KineticSubtitleTranscriptWord[];
  durationMs: number;
  minimumMatchCoverage?: number;
  requireExactMatches?: boolean;
}): KineticSubtitleAlignment {
  if (!Number.isFinite(input.durationMs) || input.durationMs <= 0) {
    throw new Error("Kinetic subtitle alignment requires a positive duration");
  }
  const durationMs = Math.round(input.durationMs);
  const voices = input.voices
    .filter((voice) =>
      !voice.isFullVoice
      && voice.text.trim()
      && Number.isFinite(voice.startTime)
      && Number.isFinite(voice.endTime)
      && voice.endTime! > voice.startTime!,
    )
    .sort((left, right) => left.startTime! - right.startTime!);
  const expected: ExpectedWord[] = voices.flatMap((voice) => {
    const voiceStartMs = Math.max(0, Math.round(voice.startTime!));
    const originalVoiceEndMs = Math.round(voice.endTime!);
    const voiceEndMs = Math.min(durationMs, originalVoiceEndMs);
    const tokens = wordsFromText(voice.text);
    const weights = tokens.map((text) => Math.max(1, normalizedWord(text).length));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let accumulatedWeight = 0;
    const visible: ExpectedWord[] = [];
    tokens.forEach((text, index) => {
      const estimatedStartMs = voiceStartMs
        + Math.max(0, originalVoiceEndMs - voiceStartMs) * accumulatedWeight / Math.max(1, totalWeight);
      accumulatedWeight += weights[index]!;
      if (estimatedStartMs >= durationMs) return;
      const numericValue = arabicIntegerValue(text);
      visible.push({
        text,
        normalized: numericValue === null ? normalizedWord(text) : String(numericValue),
        numericValue,
        startMs: 0,
        endMs: 0,
        voiceStartMs,
        voiceEndMs,
      });
    });
    return visible;
  });
  const observed: ObservedWord[] = input.transcriptWords
    .filter((word) =>
      word.type === undefined || word.type === "word",
    )
    .filter((word) =>
      typeof word.text === "string"
      && Number.isFinite(word.start)
      && Number.isFinite(word.end)
      && word.end! > word.start!,
    )
    .map((word) => ({
      text: word.text,
      normalized: normalizedWord(word.text),
      startMs: Math.max(0, Math.round(word.start! * 1_000)),
      endMs: Math.min(durationMs, Math.round(word.end! * 1_000)),
    }))
    .filter((word) => word.normalized && word.endMs > word.startMs)
    .sort((left, right) => left.startMs - right.startMs);

  if (!expected.length) throw new Error("Kinetic subtitle alignment found no approved narration words");
  if (!observed.length) throw new Error("Kinetic subtitle alignment found no timestamped speech words");
  const expectedCompounds = new Set(
    expected
      .filter((word) => /[\u002d\u2010-\u2015]/u.test(word.text))
      .map((word) => word.normalized),
  );
  const alignedObserved = mergeHyphenatedTranscriptWords(observed, expectedCompounds);

  const table = Array.from(
    { length: expected.length + 1 },
    () => new Uint16Array(alignedObserved.length + 1),
  );
  for (let expectedIndex = expected.length - 1; expectedIndex >= 0; expectedIndex -= 1) {
    for (let observedIndex = alignedObserved.length - 1; observedIndex >= 0; observedIndex -= 1) {
      const matchedSpanLengths = matchingObservedSpanLengths(expected, expectedIndex, alignedObserved, observedIndex);
      const matchScore = matchedSpanLengths.reduce(
        (best, spanLength) => Math.max(best, table[expectedIndex + 1]![observedIndex + spanLength]! + 1),
        0,
      );
      table[expectedIndex]![observedIndex] = Math.max(
        matchScore,
        table[expectedIndex + 1]![observedIndex]!,
        table[expectedIndex]![observedIndex + 1]!,
      );
    }
  }

  const matchedObservedByExpected = new Map<number, { startIndex: number; endIndex: number }>();
  let expectedIndex = 0;
  let observedIndex = 0;
  while (expectedIndex < expected.length && observedIndex < alignedObserved.length) {
    const matchedSpanLength = matchingObservedSpanLengths(expected, expectedIndex, alignedObserved, observedIndex)
      .find((spanLength) =>
        table[expectedIndex]![observedIndex] === table[expectedIndex + 1]![observedIndex + spanLength]! + 1);
    if (matchedSpanLength !== undefined) {
      matchedObservedByExpected.set(expectedIndex, {
        startIndex: observedIndex,
        endIndex: observedIndex + matchedSpanLength - 1,
      });
      expectedIndex += 1;
      observedIndex += matchedSpanLength;
    } else if (
      table[expectedIndex + 1]![observedIndex]!
      >= table[expectedIndex]![observedIndex + 1]!
    ) {
      expectedIndex += 1;
    } else {
      observedIndex += 1;
    }
  }

  const matchedWordCount = matchedObservedByExpected.size;
  const matchCoverage = matchedWordCount / expected.length;
  const minimumMatchCoverage = input.minimumMatchCoverage ?? MIN_MATCH_COVERAGE;
  if (matchCoverage < minimumMatchCoverage) {
    throw new Error(
      `Kinetic subtitle transcript matched only ${(matchCoverage * 100).toFixed(1)}% of approved narration; minimum is ${(minimumMatchCoverage * 100).toFixed(1)}%`,
    );
  }
  if (input.requireExactMatches && matchedWordCount !== expected.length) {
    const unmatched = expected
      .filter((_, index) => !matchedObservedByExpected.has(index))
      .map((word) => word.text);
    throw new Error(
      `Kinetic subtitle alignment requires exact Scribe timestamps; matched ${matchedWordCount}/${expected.length} words, missing exact matches for: ${unmatched.join(", ")}`,
    );
  }

  const aligned = new Map<number, KineticSubtitleWord>();
  for (const [approvedIndex, span] of matchedObservedByExpected) {
    const firstTranscriptWord = alignedObserved[span.startIndex]!;
    const lastTranscriptWord = alignedObserved[span.endIndex]!;
    aligned.set(approvedIndex, {
      text: expected[approvedIndex]!.text,
      startMs: firstTranscriptWord.startMs,
      endMs: lastTranscriptWord.endMs,
    });
  }

  let interpolatedWordCount = 0;
  expectedIndex = 0;
  while (expectedIndex < expected.length) {
    if (aligned.has(expectedIndex)) {
      expectedIndex += 1;
      continue;
    }
    const runStart = expectedIndex;
    while (expectedIndex < expected.length && !aligned.has(expectedIndex)) expectedIndex += 1;
    const runEnd = expectedIndex - 1;
    const leftExpectedIndex = runStart - 1;
    const rightExpectedIndex = expectedIndex;
    const leftObservedSpan = matchedObservedByExpected.get(leftExpectedIndex);
    const rightObservedSpan = matchedObservedByExpected.get(rightExpectedIndex);
    const leftWord = leftExpectedIndex >= 0 ? aligned.get(leftExpectedIndex) : undefined;
    const rightWord = rightExpectedIndex < expected.length ? aligned.get(rightExpectedIndex) : undefined;
    const unmatchedTranscript = alignedObserved.slice(
      leftObservedSpan === undefined ? 0 : leftObservedSpan.endIndex + 1,
      rightObservedSpan === undefined ? observed.length : rightObservedSpan.startIndex,
    );
    const transcriptStart = unmatchedTranscript[0]?.startMs;
    const transcriptEnd = unmatchedTranscript.at(-1)?.endMs;
    const voiceStart = expected[runStart]!.voiceStartMs;
    const voiceEnd = expected[runEnd]!.voiceEndMs;
    const startMs = transcriptStart
      ?? leftWord?.endMs
      ?? voiceStart;
    const endMs = transcriptEnd
      ?? rightWord?.startMs
      ?? voiceEnd;
    const missingCount = runEnd - runStart + 1;
    const spanMs = endMs - startMs;
    if (spanMs < missingCount * 35) {
      throw new Error(
        `Kinetic subtitle alignment cannot place ${missingCount} unmatched approved word(s) in a ${Math.max(0, spanMs)} ms speech interval`,
      );
    }
    const weights = expected
      .slice(runStart, runEnd + 1)
      .map((word) => Math.max(1, normalizedWord(word.text).length));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let elapsedWeight = 0;
    for (let index = runStart; index <= runEnd; index += 1) {
      const wordWeight = weights[index - runStart]!;
      const wordStartMs = Math.round(startMs + spanMs * elapsedWeight / totalWeight);
      elapsedWeight += wordWeight;
      const wordEndMs = Math.round(startMs + spanMs * elapsedWeight / totalWeight);
      aligned.set(index, {
        text: expected[index]!.text,
        startMs: wordStartMs,
        endMs: wordEndMs,
      });
      interpolatedWordCount += 1;
    }
  }

  const words = expected.map((word, index) => {
    const timing = aligned.get(index)!;
    const startMs = Math.max(0, Math.min(durationMs - 1, timing.startMs));
    const endMs = Math.max(startMs + 1, Math.min(durationMs, timing.endMs));
    if (endMs <= startMs) {
      throw new Error(`Kinetic subtitle word has invalid timing: ${word.text}`);
    }
    return { text: word.text, startMs, endMs };
  });

  return {
    words,
    expectedWordCount: expected.length,
    matchedWordCount,
    interpolatedWordCount,
    matchCoverage,
  };
}

export type KineticSubtitleTone = "white" | "green" | "gold" | "red" | "accent";

export type KineticSubtitleAnimationPreset =
  | "WORD_POP"
  | "WORD_SLIDE"
  | "WORD_SCALE"
  | "WORD_MASK_REVEAL"
  | "WORD_SHRINK"
  | "WORD_RISE"
  | "WORD_DROP"
  | "WORD_PUNCH"
  | "WORD_TRACK"
  | "WORD_FLY_IN"
  | "WORD_STAGGER"
  | "PHRASE_REVEAL"
  | "PHRASE_WIPE";

export type KineticSubtitleLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  alignment: "left" | "center" | "right";
};

export type KineticSubtitleCinematicTypography = {
  bodyMinPx: number;
  bodyMaxPx: number;
  keyMinPx: number;
  keyMaxPx: number;
  keyScale: number;
};

const RUSSIAN_NUMBERS = new Set([
  "ноль", "один", "одна", "одно", "одни", "две", "два", "три", "четыре", "пять",
  "шесть", "семь", "восемь", "девять", "десять", "одиннадцать", "двенадцать",
  "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать",
  "восемнадцать", "девятнадцать", "двадцать", "тридцать", "сорок", "пятьдесят",
  "шестьдесят", "семьдесят", "восемьдесят", "девяносто", "сто", "тысяча",
  "тысячи", "тысяч", "миллион", "миллиона", "миллионов", "миллиард",
  "миллиарда", "миллиардов",
]);

const POSITIVE_STEMS = [
  "вырос", "рост", "прибав", "повыс", "поддерж", "сильн", "увелич", "доход",
  "прибыл", "укреп", "восстанов", "положительн",
];
const NEGATIVE_STEMS = [
  "пад", "снижен", "сниз", "сократ", "просад", "убыт", "риск", "слаб",
  "потер", "негатив", "волатил", "дефицит", "угроз", "ухудш", "коррекц",
];
const DOMAIN_STEMS = [
  "hype", "hyperliquid", "монет", "токен", "ликвид", "бирж", "протокол",
  "блокчейн", "дериватив", "перпету", "фьючерс", "децентрализ", "ончеин",
  "ончейн", "криптовалют", "капитализац",
];
const STOP_WORDS = new Set([
  "а", "без", "бы", "в", "во", "для", "до", "её", "ее", "если", "же", "за",
  "и", "из", "или", "к", "как", "ко", "ли", "на", "над", "не", "но", "о",
  "об", "от", "по", "под", "при", "с", "со", "у", "что", "это",
]);

function startsWithStem(value: string, stems: string[]): boolean {
  return stems.some((stem) => value.startsWith(stem));
}

export function classifyKineticSubtitleTone(value: string): KineticSubtitleTone {
  const normalized = normalizedWord(value);
  if (/\d/u.test(value) || /[%‰]/u.test(value) || RUSSIAN_NUMBERS.has(normalized)
    || normalized.startsWith("процент")) {
    return "gold";
  }
  if (startsWithStem(normalized, NEGATIVE_STEMS)) return "red";
  if (startsWithStem(normalized, POSITIVE_STEMS)) return "green";
  if (startsWithStem(normalized, DOMAIN_STEMS)) return "accent";
  return "white";
}

function isImpactWord(value: string): boolean {
  const tone = classifyKineticSubtitleTone(value);
  return tone === "gold" || tone === "red" || tone === "green";
}

function splitIntoPhrases(
  words: KineticSubtitleWord[],
  maxWordsPerPhrase = MAX_WORDS_PER_PHRASE,
): KineticSubtitleWord[][] {
  const sorted = [...words].sort((left, right) => left.startMs - right.startMs);
  const phrases: KineticSubtitleWord[][] = [];
  let current: KineticSubtitleWord[] = [];
  const flush = () => {
    if (current.length) phrases.push(current);
    current = [];
  };

  for (const word of sorted) {
    const previous = current.at(-1);
    if (
      previous
      && (word.startMs - previous.endMs > 260
        || word.startMs - current[0]!.startMs > MAX_PHRASE_DURATION_MS
        || current.length >= maxWordsPerPhrase
        || /[.!?…]$/u.test(previous.text)
        || (isImpactWord(word.text) && current.length >= 2))
    ) {
      flush();
    }
    current.push(word);
    if (isImpactWord(word.text) || (/[.!?…]$/u.test(word.text) && current.length >= 2)) {
      flush();
    }
  }
  flush();
  return phrases;
}

function assTime(milliseconds: number): string {
  const centiseconds = Math.max(0, Math.floor(milliseconds / 10));
  const seconds = Math.floor(centiseconds / 100);
  return `${Math.floor(seconds / 3_600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
}

function assText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("\n", " ");
}

function assColor(hex: string): string {
  const rgb = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/iu.test(rgb)) throw new Error(`Invalid kinetic subtitle color: ${hex}`);
  return `&H00${rgb.slice(4, 6)}${rgb.slice(2, 4)}${rgb.slice(0, 2)}&`;
}

const TONE_COLORS: Record<KineticSubtitleTone, string> = {
  white: "#F5F7FA",
  green: "#55FF74",
  gold: "#FFD166",
  red: "#FF5964",
  accent: "#59CEFF",
};

const LAYOUTS = [
  { kind: "center", y: 0.75 },
  { kind: "left", y: 0.67 },
  { kind: "right", y: 0.81 },
  { kind: "center", y: 0.86 },
] as const;

function focusWordIndex(phrase: KineticSubtitleWord[]): number {
  const domainIndex = phrase.findIndex((word) => classifyKineticSubtitleTone(word.text) === "accent");
  if (domainIndex >= 0) return domainIndex;
  return phrase.reduce((bestIndex, word, index) => {
    const normalized = normalizedWord(word.text);
    const best = bestIndex >= 0 ? normalizedWord(phrase[bestIndex]!.text) : "";
    if (STOP_WORDS.has(normalized) || classifyKineticSubtitleTone(word.text) !== "white") return bestIndex;
    if (normalized.length < 4) return bestIndex;
    return normalized.length > best.length ? index : bestIndex;
  }, -1);
}

function animationOverride(
  preset: number | KineticSubtitleAnimationPreset,
  x: number,
  y: number,
  durationMs: number,
  intensity?: "restrained" | "dynamic" | "impact",
  dimensions?: { width: number; fontSize: number },
): string {
  if (typeof preset === "number") {
    const animationEnd = Math.max(75, Math.min(intensity === "impact" ? 180 : 140, durationMs));
    let entrance: string;
    switch (preset % 5) {
      case 1:
        entrance = `\\move(${x},${y + 24},${x},${y},0,${animationEnd})`;
        break;
      case 2:
        entrance = `\\move(${x - 30},${y + 4},${x},${y},0,${animationEnd})`;
        break;
      case 3:
        entrance = `\\move(${x + 28},${y - 5},${x},${y},0,${animationEnd})`;
        break;
      case 4:
        entrance = `\\move(${x},${y - 17},${x},${y},0,${animationEnd})`;
        break;
      default:
        entrance = `\\pos(${x},${y})`;
    }
    if (intensity === "restrained") {
      return `${entrance}\\fscx98\\fscy98\\alpha&H18&\\blur0.5` +
        `\\t(0,${animationEnd},\\fscx100\\fscy100\\alpha&H00&\\blur0)`;
    }
    if (intensity === "dynamic") {
      return `${entrance}\\fscx82\\fscy82\\alpha&H10&\\blur1.2` +
        `\\t(0,${animationEnd},\\fscx106\\fscy106\\alpha&H00&\\blur0.25)` +
        `\\t(${animationEnd},${animationEnd + 55},\\fscx100\\fscy100)`;
    }
    return `${entrance}\\fscx42\\fscy42\\alpha&HFF&\\blur4` +
      `\\t(0,${animationEnd},\\fscx108\\fscy108\\alpha&H00&\\blur0.35)` +
      `\\t(${animationEnd},${animationEnd + 65},\\fscx100\\fscy100)`;
  }

  const animationEnd = Math.max(35, Math.min(intensity === "impact" ? 220 : 160, durationMs));
  const width = Math.max(dimensions?.fontSize ?? 72, dimensions?.width ?? 120);
  const fontSize = dimensions?.fontSize ?? 72;
  const left = Math.round(x - width / 2);
  const right = Math.round(x + width / 2);
  const top = Math.round(y - fontSize * 0.66);
  const bottom = Math.round(y + fontSize * 0.42);
  const collapsedRight = Math.min(right, left + 1);
  const collapsedLeft = Math.max(left, right - 1);
  const clipOpen = `\\clip(${left},${top},${right},${bottom})`;
  const clipClosedLeft = `\\clip(${left},${top},${collapsedRight},${bottom})`;
  const clipClosedRight = `\\clip(${collapsedLeft},${top},${right},${bottom})`;

  switch (preset) {
    case "WORD_POP":
      return `\\fscx62\\fscy62\\alpha&H20&\\blur1.8` +
        `\\t(0,${animationEnd},\\fscx112\\fscy112\\alpha&H00&\\blur0.2)` +
        `\\t(${animationEnd},${animationEnd + 55},\\fscx100\\fscy100\\blur0)`;
    case "WORD_SLIDE":
      return `\\move(${x + 52},${y + 8},${x},${y},0,${animationEnd})\\alpha&H12&` +
        `\\t(0,${animationEnd},\\alpha&H00&)`;
    case "WORD_SCALE":
      return `\\fscx78\\fscy78\\alpha&H10&` +
        `\\t(0,${animationEnd},\\fscx100\\fscy100\\alpha&H00&)`;
    case "WORD_MASK_REVEAL":
      return `\\alpha&H08&${clipClosedLeft}` +
        `\\t(0,${animationEnd},\\alpha&H00&${clipOpen})`;
    case "WORD_RISE":
      return `\\move(${x},${y + 42},${x},${y},0,${animationEnd})\\alpha&H18&` +
        `\\t(0,${animationEnd},\\alpha&H00&)`;
    case "WORD_DROP":
      return `\\move(${x},${y - 42},${x},${y},0,${animationEnd})\\fscx108\\fscy108\\alpha&H10&` +
        `\\t(0,${animationEnd},\\fscx100\\fscy100\\alpha&H00&)`;
    case "WORD_PUNCH":
      return `\\fscx64\\fscy64\\alpha&HFF&\\blur2.2` +
        `\\t(0,${animationEnd},\\fscx116\\fscy116\\alpha&H00&\\blur0.15)` +
        `\\t(${animationEnd},${animationEnd + 65},\\fscx100\\fscy100\\blur0)`;
    case "WORD_SHRINK":
      return `\\fscx118\\fscy118\\alpha&H00&\\blur0.2` +
        `\\t(0,${animationEnd},\\fscx12\\fscy12\\alpha&HFF&\\blur2)`;
    case "WORD_TRACK":
      return `\\fsp13\\alpha&H16&\\t(0,${animationEnd},\\fsp0\\alpha&H00&)`;
    case "WORD_FLY_IN":
      return `\\move(${x - 110},${y + 12},${x},${y},0,${animationEnd})\\alpha&H08&` +
        `\\t(0,${animationEnd},\\alpha&H00&)`;
    case "WORD_STAGGER":
      return `\\move(${x},${y + 18},${x},${y},0,${animationEnd})\\alpha&H14&` +
        `\\t(0,${animationEnd},\\alpha&H00&)`;
    case "PHRASE_REVEAL":
      return `\\alpha&H08&${clipClosedLeft}` +
        `\\t(0,${animationEnd + 35},\\alpha&H00&${clipOpen})`;
    case "PHRASE_WIPE":
      return `\\alpha&H06&${clipClosedRight}` +
        `\\t(0,${animationEnd + 45},\\alpha&H00&${clipOpen})`;
    default:
      throw new Error(`Unsupported kinetic subtitle animation preset: ${preset}`);
  }
}

export type KineticSubtitleEmphasisEvent = {
  word: string;
  startMs: number;
  endMs: number;
  intensity: "dynamic" | "impact";
  tone: KineticSubtitleTone;
};

export function buildLongformKineticSubtitleAss(input: {
  words: KineticSubtitleWord[];
  durationMs: number;
  width: number;
  height: number;
  emphasisEvents?: KineticSubtitleEmphasisEvent[];
  layoutForPhrase?: (phrase: KineticSubtitleWord[], phraseIndex: number) => KineticSubtitleLayout;
  animationForWord?: (input: {
    word: KineticSubtitleWord;
    tone: KineticSubtitleTone;
    emphasis?: KineticSubtitleEmphasisEvent;
    phraseIndex: number;
    wordIndex: number;
  }) => KineticSubtitleAnimationPreset;
  cinematicTypography?: KineticSubtitleCinematicTypography;
  maxWordsPerPhrase?: number;
}): { ass: string; phraseCount: number; wordCount: number; maxWordsPerPhrase: number } {
  if (!input.words.length) throw new Error("Kinetic subtitle render requires timestamped words");
  if (
    !Number.isFinite(input.durationMs)
    || input.durationMs <= 0
    || !Number.isInteger(input.width)
    || !Number.isInteger(input.height)
    || input.width <= 0
    || input.height <= 0
  ) {
    throw new Error("Kinetic subtitle render requires valid video dimensions and duration");
  }
  if (
    input.maxWordsPerPhrase !== undefined
    && (!Number.isInteger(input.maxWordsPerPhrase) || input.maxWordsPerPhrase < 1 || input.maxWordsPerPhrase > 6)
  ) {
    throw new Error("Kinetic subtitle maxWordsPerPhrase must be an integer from 1 to 6");
  }
  if (input.cinematicTypography) {
    const profile = input.cinematicTypography;
    if (
      ![profile.bodyMinPx, profile.bodyMaxPx, profile.keyMinPx, profile.keyMaxPx, profile.keyScale]
        .every(Number.isFinite)
      || profile.bodyMinPx <= 0
      || profile.bodyMaxPx < profile.bodyMinPx
      || profile.keyMinPx <= 0
      || profile.keyMaxPx < profile.keyMinPx
      || profile.keyScale < 1
    ) {
      throw new Error("Kinetic subtitle cinematic typography profile is invalid");
    }
  }
  const words = input.words
    .filter((word) => word.text.trim() && word.endMs > word.startMs)
    .map((word) => ({
      text: word.text,
      startMs: Math.max(0, Math.min(input.durationMs, word.startMs)),
      endMs: Math.max(0, Math.min(input.durationMs, word.endMs)),
    }))
    .filter((word) => word.endMs > word.startMs);
  if (!words.length) throw new Error("Kinetic subtitle render has no valid visible words");

  const phrases = splitIntoPhrases(words, input.maxWordsPerPhrase);
  const dialogues: string[] = [];
  phrases.forEach((phrase, phraseIndex) => {
    const defaultLayout = LAYOUTS[phraseIndex % LAYOUTS.length]!;
    const layout = input.layoutForPhrase?.(phrase, phraseIndex);
    const focusIndex = input.emphasisEvents ? -1 : focusWordIndex(phrase);
    const phraseEndMs = phrase.at(-1)!.endMs;
    const safeWidth = layout?.width ?? input.width * 0.84;
    const alignment = layout?.alignment ?? defaultLayout.kind;
    const sizeProfile = input.cinematicTypography;

    const emphasisFor = (word: KineticSubtitleWord) => input.emphasisEvents?.find((event) =>
      normalizedWord(event.word) === normalizedWord(word.text)
      && word.startMs < event.endMs
      && word.endMs > event.startMs,
    );

    const lineMetrics = (line: KineticSubtitleWord[]) => {
      const units = line.reduce((sum, word, index) => {
        const isKey = Boolean(sizeProfile && emphasisFor(word));
        const scale = isKey ? sizeProfile!.keyScale : 1;
        return sum
          + Math.max(1, word.text.toLocaleUpperCase("ru-RU").length) * 0.7 * scale
          + (index ? 0.8 : 0);
      }, 0);
      const baseFontSize = sizeProfile
        ? Math.max(sizeProfile.bodyMinPx, Math.min(sizeProfile.bodyMaxPx, Math.floor(safeWidth / Math.max(1, units))))
        : Math.max(70, Math.min(132, Math.floor((input.width * 0.84) / Math.max(1, units))));
      const fontSizes = line.map((word) => {
        if (!sizeProfile || !emphasisFor(word)) return baseFontSize;
        return Math.max(
          sizeProfile.keyMinPx,
          Math.min(sizeProfile.keyMaxPx, Math.round(baseFontSize * sizeProfile.keyScale)),
        );
      });
      const widths = line.map((word, index) => {
        const characterCount = Math.max(1, word.text.toLocaleUpperCase("ru-RU").length);
        let width = characterCount * fontSizes[index]! * 0.7;
        if (sizeProfile && line.length === 1 && width > safeWidth) {
          const fittedFontSize = Math.max(1, Math.floor(safeWidth / (characterCount * 0.7)));
          fontSizes[index] = Math.min(fontSizes[index]!, fittedFontSize);
          width = characterCount * fontSizes[index]! * 0.7;
        }
        return width;
      });
      const gap = sizeProfile ? baseFontSize * 0.8 : baseFontSize * 0.8;
      const totalWidth = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, line.length - 1) * gap;
      return { baseFontSize, fontSizes, widths, totalWidth, gap };
    };

    const lines: KineticSubtitleWord[][] = [];
    if (sizeProfile) {
      let currentLine: KineticSubtitleWord[] = [];
      for (const word of phrase) {
        const candidate = [...currentLine, word];
        if (currentLine.length && lineMetrics(candidate).totalWidth > safeWidth) {
          lines.push(currentLine);
          currentLine = [word];
        } else {
          currentLine = candidate;
        }
      }
      if (currentLine.length) lines.push(currentLine);
      if (lines.length > 2) {
        throw new Error(`Kinetic subtitle phrase ${phraseIndex} requires more than two composition-safe lines`);
      }
    } else {
      lines.push(phrase);
    }

    const zoneX = layout?.x ?? 0;
    const zoneY = layout?.y ?? 0;
    const zoneHeight = layout?.height ?? 0;
    lines.forEach((line, lineIndex) => {
      const metrics = lineMetrics(line);
      const left = layout
        ? alignment === "left"
          ? zoneX
          : alignment === "right"
            ? zoneX + safeWidth - metrics.totalWidth
            : zoneX + (safeWidth - metrics.totalWidth) / 2
        : alignment === "left"
          ? input.width * 0.11
          : alignment === "right"
            ? input.width * 0.89 - metrics.totalWidth
            : (input.width - metrics.totalWidth) / 2;
      const baseY = layout
        ? zoneY + zoneHeight / 2
        : input.height * defaultLayout.y;
      const rowOffset = lines.length > 1
        ? (lineIndex - (lines.length - 1) / 2) * zoneHeight * 0.66
        : 0;
      const y = Math.round(baseY + rowOffset);
      let cursorX = left;

      line.forEach((word, wordIndex) => {
        const upperWord = word.text.toLocaleUpperCase("ru-RU");
        const fontSize = metrics.fontSizes[wordIndex]!;
        const wordWidth = metrics.widths[wordIndex]!;
        const x = Math.round(cursorX + wordWidth / 2);
        const emphasis = emphasisFor(word);
        const tone = classifyKineticSubtitleTone(word.text);
        const chosenTone: KineticSubtitleTone = input.emphasisEvents
          ? emphasis?.tone ?? "white"
          : tone !== "white"
            ? tone
            : wordIndex === focusIndex
              ? "accent"
              : "white";
        const color = assColor(TONE_COLORS[chosenTone]);
        const animationPreset = input.animationForWord
          ? input.animationForWord({ word, tone: chosenTone, emphasis, phraseIndex, wordIndex })
          : phraseIndex;
        const animation = animationOverride(
          animationPreset,
          x,
          y,
          word.endMs - word.startMs,
          input.emphasisEvents ? emphasis?.intensity ?? "restrained" : undefined,
          { width: wordWidth, fontSize },
        );
        const overrides =
          `{\\an5\\fs${fontSize}\\b1\\1c${color}\\3c&H00101822&\\bord5\\shad2\\blur4` +
          `${animation}\\fad(0,75)}`;
        const visibleEndMs = Math.max(word.startMs + 1, phraseEndMs);
        dialogues.push(
          `Dialogue: 1,${assTime(word.startMs)},${assTime(visibleEndMs)},Kinetic,,0,0,0,,${overrides}${assText(upperWord)}`,
        );
        cursorX += wordWidth + metrics.gap;
      });
    });
  });

  return {
    ass: [
      "[Script Info]",
      "ScriptType: v4.00+",
      `PlayResX: ${input.width}`,
      `PlayResY: ${input.height}`,
      "WrapStyle: 2",
      "ScaledBorderAndShadow: yes",
      "",
      "[V4+ Styles]",
      "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
      "Style: Kinetic,DejaVu Sans,96,&H00F5F7FA,&H00F5F7FA,&H00101822,&H00000000,-1,0,1,5,2,5,96,96,0,1",
      "",
      "[Events]",
      "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
      ...dialogues,
      "",
    ].join("\n"),
    phraseCount: phrases.length,
    wordCount: words.length,
    maxWordsPerPhrase: Math.max(...phrases.map((phrase) => phrase.length)),
  };
}