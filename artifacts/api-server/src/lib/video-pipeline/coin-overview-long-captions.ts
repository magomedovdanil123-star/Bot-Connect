import {
  getCoinOverviewLongMotionPalette,
  type CoinOverviewLongBeat,
} from "./coin-overview-long-edit";

type CaptionVoice = {
  sceneId: number;
  startTime: number | null;
  endTime: number | null;
  text: string;
  isFullVoice?: boolean;
};

type WordTiming = {
  text: string;
  startMs: number;
  endMs: number;
};

const ACCENTS = [
  { style: "KineticYellow", color: "&H0000FFE8" },
  { style: "KineticCyan", color: "&H00F7D810" },
  { style: "KineticPink", color: "&H007655FF" },
] as const;

function assTime(milliseconds: number): string {
  const centiseconds = Math.max(0, Math.floor(milliseconds / 10));
  const seconds = Math.floor(centiseconds / 100);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
}

function assText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("\n", " ");
}

function wordTimings(voice: CaptionVoice, durationMs: number): WordTiming[] {
  const words = voice.text
    .trim()
    .split(/\s+/)
    .filter((word) => Boolean(word) && !/^[—–-]+$/u.test(word));
  const startMs = Math.max(0, voice.startTime ?? 0);
  const endMs = Math.min(durationMs, voice.endTime ?? durationMs);
  const availableMs = Math.max(0, endMs - startMs);
  if (!words.length || availableMs <= 0) return [];

  const weights = words.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, "").length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let previousWeight = 0;

  return words.map((text, index) => {
    const nextWeight = previousWeight + weights[index]!;
    const timing = {
      text,
      startMs: Math.round(startMs + availableMs * (previousWeight / totalWeight)),
      endMs: Math.round(startMs + availableMs * (nextWeight / totalWeight)),
    };
    previousWeight = nextWeight;
    return timing;
  });
}

function splitPhrases(words: WordTiming[]): WordTiming[][] {
  const phrases: WordTiming[][] = [];
  let current: WordTiming[] = [];

  const flush = () => {
    if (current.length) phrases.push(current);
    current = [];
  };

  for (const word of words) {
    current.push(word);
    const text = current.map((item) => item.text).join(" ");
    const punctuationEndsPhrase = /[,;:.!?…]$/u.test(word.text);
    if (
      current.length >= 2
      || text.length >= 18
      || (punctuationEndsPhrase && current.length >= 2)
    ) {
      flush();
    }
  }
  flush();
  return phrases;
}

const CAPTION_STOP_WORDS = new Set([
  "а", "без", "бы", "в", "во", "для", "до", "если", "же", "за", "и", "из", "или",
  "к", "ко", "ли", "на", "над", "не", "но", "о", "об", "от", "по", "под", "при",
  "с", "со", "у", "что", "это",
]);

function assColor(color: string): string {
  const rgb = color.match(/^0x([0-9a-f]{6})$/iu)?.[1];
  if (!rgb) throw new Error(`Invalid infographic caption color: ${color}`);
  return `&H00${rgb.slice(4, 6)}${rgb.slice(2, 4)}${rgb.slice(0, 2)}&`;
}

function headlineWordIndex(phrase: WordTiming[]): number {
  const contentWord = phrase.findIndex((word) => {
    const normalized = word.text.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]/gu, "");
    return normalized.length > 2 && !CAPTION_STOP_WORDS.has(normalized);
  });
  return contentWord >= 0 ? contentWord : 0;
}

function fontSizeForWord(
  word: WordTiming,
  width: number,
  height: number,
  heightRatio: number,
): number {
  const letters = Math.max(1, word.text.replace(/[^\p{L}\p{N}]/gu, "").length);
  return Math.max(
    26,
    Math.min(
      Math.round(height * heightRatio),
      Math.floor(width * 0.76 / (letters * 0.67)),
    ),
  );
}

function karaokeText(
  phrase: WordTiming[],
  input: {
    width: number;
    height: number;
    headlineIndex: number;
    headlineSize: number;
    supportSize: number;
  },
): string {
  const totalWeight = phrase.reduce((sum, word) => sum + Math.max(1, word.endMs - word.startMs), 0);
  const totalCentiseconds = Math.max(
    phrase.length,
    Math.round((phrase.at(-1)!.endMs - phrase[0]!.startMs) / 10),
  );
  let cumulativeWeight = 0;
  let previousCentiseconds = 0;

  return phrase.map((word, index) => {
    cumulativeWeight += Math.max(1, word.endMs - word.startMs);
    const cumulativeCentiseconds = index === phrase.length - 1
      ? totalCentiseconds
      : Math.round(totalCentiseconds * cumulativeWeight / totalWeight);
    const wordCentiseconds = Math.max(1, cumulativeCentiseconds - previousCentiseconds);
    previousCentiseconds = cumulativeCentiseconds;
    const upperWord = word.text.toLocaleUpperCase("ru-RU");
    const fontSize = index === input.headlineIndex
      ? input.headlineSize
      : phrase.length === 1
        ? input.headlineSize
        : Math.min(
          input.supportSize,
          fontSizeForWord(word, input.width, input.height, 0.09),
        );
    return `${index > 0 ? "\\N" : ""}{\\kf${wordCentiseconds}\\fs${fontSize}}${assText(upperWord)}`;
  }).join("");
}

export function buildCoinOverviewLongCaptions(input: {
  voices: CaptionVoice[];
  durationMs: number;
  width: number;
  height: number;
  chunkStartMs?: number;
  chunkEndMs?: number;
}): string {
  const chunkStartMs = Math.max(0, input.chunkStartMs ?? 0);
  const chunkEndMs = Math.min(input.durationMs, input.chunkEndMs ?? input.durationMs);
  const dialogues: Array<{ startMs: number; text: string }> = [];

  const voices = input.voices
    .filter((voice) => !voice.isFullVoice && voice.text.trim())
    .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));

  voices.forEach((voice, voiceIndex) => {
    const phrases = splitPhrases(wordTimings(voice, input.durationMs));
    phrases.forEach((phrase, phraseIndex) => {
      const phraseStartMs = phrase[0]!.startMs;
      const phraseEndMs = phrase.at(-1)!.endMs;
      const visibleStartMs = Math.max(chunkStartMs, phraseStartMs);
      const visibleEndMs = Math.min(chunkEndMs, phraseEndMs);
      if (visibleEndMs <= visibleStartMs) return;

      const phraseText = phrase.map((word) => word.text).join(" ");
      const headlineIndex = headlineWordIndex(phrase);
      const headlineSize = fontSizeForWord(phrase[headlineIndex]!, input.width, input.height, 0.14);
      const supportSize = Math.round(input.height * 0.075);
      const layoutIndex = (voiceIndex + phraseIndex) % 3;
      const accent = ACCENTS[(voiceIndex + phraseIndex) % ACCENTS.length]!;
      const visualBeat = input.beats?.find((beat) =>
        phraseStartMs >= beat.startMs && phraseStartMs < beat.endMs,
      );
      const paletteBeat: CoinOverviewLongBeat = visualBeat ?? {
        sceneId: voice.sceneId,
        beatIndex: voiceIndex + phraseIndex,
        startMs: phraseStartMs,
        endMs: phraseEndMs,
        text: phraseText,
        motif: "asset",
      };
      const palette = getCoinOverviewLongMotionPalette(paletteBeat, paletteBeat.beatIndex % 6);
      const primaryColor = assColor(palette.title);
      const accentColor = assColor(palette.primary);
      const outlineColor = palette.title.toLowerCase() === "0xfbfaf6"
        ? "&H00101012&"
        : "&H00F7F4EC&";
      const y = Math.round(input.height * [0.58, 0.72, 0.63][layoutIndex]!);
      const alignment = layoutIndex === 0 ? 4 : layoutIndex === 1 ? 2 : 6;
      const x = layoutIndex === 0
        ? Math.round(input.width * 0.085)
        : layoutIndex === 1
          ? Math.round(input.width / 2)
          : Math.round(input.width * 0.915);
      const override =
        `{\\an${alignment}\\pos(${x},${y})\\fs${headlineSize}` +
        `\\1c${primaryColor}\\2c${accentColor}\\3c${outlineColor}` +
        `\\fad(70,90)\\fscx86\\fscy86\\bord3\\shad2\\blur0.1\\fsp0` +
        `\\t(0,150,\\fscx108\\fscy108)\\t(150,260,\\fscx100\\fscy100)}`;
      const text = `${override}${karaokeText(phrase, {
        width: input.width,
        height: input.height,
        headlineIndex,
        headlineSize,
        supportSize,
      })}`;
      dialogues.push({
        startMs: visibleStartMs,
        text: `Dialogue: 0,${assTime(visibleStartMs - chunkStartMs)},${assTime(visibleEndMs - chunkStartMs)},${accent.style},,0,0,0,,${text}`,
      });
    });
  });

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${input.width}`,
    `PlayResY: ${input.height}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    ...ACCENTS.map(({ style, color }) =>
      `Style: ${style},DejaVu Sans,96,&H00FFFFFF,${color},&H00000000,&HAA101018,-1,0,1,5,3,5,96,96,0,1`,
    ),
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...dialogues.sort((a, b) => a.startMs - b.startMs).map((dialogue) => dialogue.text),
    "",
  ].join("\n");
}

function wrapMotionCaption(value: string, maxCharacters: number): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && candidate.length > maxCharacters) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.join("\u0000");
}

function subtitlePhrases(words: WordTiming[]): WordTiming[][] {
  const phrases: WordTiming[][] = [];
  let current: WordTiming[] = [];
  const flush = () => {
    if (current.length) phrases.push(current);
    current = [];
  };

  for (const word of words) {
    const candidate = [...current, word];
    const text = candidate.map((item) => item.text).join(" ");
    const elapsedMs = current.length
      ? word.endMs - current[0]!.startMs
      : 0;
    if (
      current.length
      && (text.length > 56 || elapsedMs > 4_200 || current.length >= 10)
    ) {
      flush();
    }
    current.push(word);
    if (/[.!?…]$/u.test(word.text) && current.length >= 3) flush();
  }
  flush();
  return phrases;
}

export function buildCoinOverviewLongPhraseCaptions(input: {
  voices: CaptionVoice[];
  durationMs: number;
  width: number;
  height: number;
  chunkStartMs?: number;
  chunkEndMs?: number;
}): string {
  const chunkStartMs = Math.max(0, input.chunkStartMs ?? 0);
  const chunkEndMs = Math.min(input.durationMs, input.chunkEndMs ?? input.durationMs);
  const dialogues: Array<{ startMs: number; text: string }> = [];
  const voices = input.voices
    .filter((voice) => !voice.isFullVoice && voice.text.trim())
    .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));

  for (const voice of voices) {
    for (const phrase of subtitlePhrases(wordTimings(voice, input.durationMs))) {
      const phraseStartMs = phrase[0]!.startMs;
      const phraseEndMs = phrase.at(-1)!.endMs;
      const visibleStartMs = Math.max(chunkStartMs, phraseStartMs);
      const visibleEndMs = Math.min(chunkEndMs, phraseEndMs);
      if (visibleEndMs <= visibleStartMs) continue;

      const wrapped = wrapMotionCaption(
        phrase.map((word) => word.text).join(" "),
        48,
      );
      const longestLine = Math.max(
        ...wrapped.split("\u0000").map((line) => line.length),
        1,
      );
      const fontSize = Math.max(
        18,
        Math.min(
          48,
          Math.round(input.height * 0.045),
          Math.floor(input.width * 0.78 / (longestLine * 0.56)),
        ),
      );
      const x = Math.round(input.width / 2);
      const y = Math.round(input.height * 0.91);
      const override =
        `{\\an2\\pos(${x},${y})\\fs${fontSize}` +
        `\\1c&H00F7F4EC&\\3c&H00101012&\\bord2.5\\shad1.5\\fad(90,110)}`;
      dialogues.push({
        startMs: visibleStartMs,
        text: `Dialogue: 0,${assTime(visibleStartMs - chunkStartMs)},${assTime(visibleEndMs - chunkStartMs)},Subtitle,,0,0,0,,${override}${assText(wrapped).replaceAll("\u0000", "\\N")}`,
      });
    }
  }

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${input.width}`,
    `PlayResY: ${input.height}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Subtitle,DejaVu Sans,48,&H00F7F4EC,&H00F7F4EC,&H00101012,&H6407080C,0,0,1,2,1,2,96,96,0,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...dialogues.sort((a, b) => a.startMs - b.startMs).map((dialogue) => dialogue.text),
    "",
  ].join("\n");
}