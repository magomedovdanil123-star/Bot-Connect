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
  voiceStartMs: number;
  voiceEndMs: number;
};

type ObservedWord = KineticSubtitleWord & {
  normalized: string;
};

const MIN_MATCH_COVERAGE = 0.88;
const MAX_WORDS_PER_PHRASE = 3;
const MAX_PHRASE_DURATION_MS = 1_450;

function normalizedWord(value: string): string {
  return value.toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]/gu, "");
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
      visible.push({
        text,
        normalized: normalizedWord(text),
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
      table[expectedIndex]![observedIndex] =
        expected[expectedIndex]!.normalized === alignedObserved[observedIndex]!.normalized
          ? table[expectedIndex + 1]![observedIndex + 1]! + 1
          : Math.max(
            table[expectedIndex + 1]![observedIndex]!,
            table[expectedIndex]![observedIndex + 1]!,
          );
    }
  }

  const matchedObservedByExpected = new Map<number, number>();
  let expectedIndex = 0;
  let observedIndex = 0;
  while (expectedIndex < expected.length && observedIndex < alignedObserved.length) {
    if (expected[expectedIndex]!.normalized === alignedObserved[observedIndex]!.normalized) {
      matchedObservedByExpected.set(expectedIndex, observedIndex);
      expectedIndex += 1;
      observedIndex += 1;
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

  const aligned = new Map<number, KineticSubtitleWord>();
  for (const [approvedIndex, transcriptIndex] of matchedObservedByExpected) {
    const transcriptWord = alignedObserved[transcriptIndex]!;
    aligned.set(approvedIndex, {
      text: expected[approvedIndex]!.text,
      startMs: transcriptWord.startMs,
      endMs: transcriptWord.endMs,
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
    const leftObservedIndex = matchedObservedByExpected.get(leftExpectedIndex);
    const rightObservedIndex = matchedObservedByExpected.get(rightExpectedIndex);
    const leftWord = leftExpectedIndex >= 0 ? aligned.get(leftExpectedIndex) : undefined;
    const rightWord = rightExpectedIndex < expected.length ? aligned.get(rightExpectedIndex) : undefined;
    const unmatchedTranscript = alignedObserved.slice(
      leftObservedIndex === undefined ? 0 : leftObservedIndex + 1,
      rightObservedIndex === undefined ? observed.length : rightObservedIndex,
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

type SubtitleTone = "white" | "green" | "gold" | "red" | "accent";

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

export function classifyKineticSubtitleTone(value: string): SubtitleTone {
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

function splitIntoPhrases(words: KineticSubtitleWord[]): KineticSubtitleWord[][] {
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
        || current.length >= MAX_WORDS_PER_PHRASE
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

const TONE_COLORS: Record<SubtitleTone, string> = {
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
  preset: number,
  x: number,
  y: number,
  durationMs: number,
): string {
  const animationEnd = Math.max(75, Math.min(180, durationMs));
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
  return `${entrance}\\fscx42\\fscy42\\alpha&HFF&\\blur4` +
    `\\t(0,${animationEnd},\\fscx108\\fscy108\\alpha&H00&\\blur0.35)` +
    `\\t(${animationEnd},${animationEnd + 65},\\fscx100\\fscy100)`;
}

export function buildLongformKineticSubtitleAss(input: {
  words: KineticSubtitleWord[];
  durationMs: number;
  width: number;
  height: number;
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
  const words = input.words
    .filter((word) => word.text.trim() && word.endMs > word.startMs)
    .map((word) => ({
      text: word.text,
      startMs: Math.max(0, Math.min(input.durationMs, word.startMs)),
      endMs: Math.max(0, Math.min(input.durationMs, word.endMs)),
    }))
    .filter((word) => word.endMs > word.startMs);
  if (!words.length) throw new Error("Kinetic subtitle render has no valid visible words");

  const phrases = splitIntoPhrases(words);
  const dialogues: string[] = [];
  phrases.forEach((phrase, phraseIndex) => {
    const layout = LAYOUTS[phraseIndex % LAYOUTS.length]!;
    const focusIndex = focusWordIndex(phrase);
    const units = phrase.reduce((sum, word, index) =>
      sum + Math.max(1, word.text.toLocaleUpperCase("ru-RU").length) * 0.7 + (index ? 0.8 : 0),
    0);
    const safeWidth = input.width * 0.84;
    const fontSize = Math.max(70, Math.min(132, Math.floor(safeWidth / Math.max(1, units))));
    const totalWidth = units * fontSize;
    const left = layout.kind === "left"
      ? input.width * 0.11
      : layout.kind === "right"
        ? input.width * 0.89 - totalWidth
        : (input.width - totalWidth) / 2;
    const y = Math.round(input.height * layout.y);
    let cursorX = left;
    const phraseEndMs = phrase.at(-1)!.endMs;

    phrase.forEach((word, wordIndex) => {
      const upperWord = word.text.toLocaleUpperCase("ru-RU");
      const wordWidth = Math.max(1, upperWord.length) * fontSize * 0.7;
      const x = Math.round(cursorX + wordWidth / 2);
      const tone = classifyKineticSubtitleTone(word.text);
      const chosenTone: SubtitleTone = tone !== "white"
        ? tone
        : wordIndex === focusIndex
          ? "accent"
          : "white";
      const color = assColor(TONE_COLORS[chosenTone]);
      const animation = animationOverride(phraseIndex, x, y, word.endMs - word.startMs);
      const overrides =
        `{\\an5\\fs${fontSize}\\b1\\1c${color}\\3c&H00101822&\\bord5\\shad2\\blur4` +
        `${animation}\\fad(0,75)}`;
      const visibleEndMs = Math.max(word.startMs + 1, phraseEndMs);
      dialogues.push(
        `Dialogue: 1,${assTime(word.startMs)},${assTime(visibleEndMs)},Kinetic,,0,0,0,,${overrides}${assText(upperWord)}`,
      );
      cursorX += wordWidth + fontSize * 0.8;
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