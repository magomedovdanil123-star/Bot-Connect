import {
  buildCoinOverviewLongPhraseBeats,
  getCoinOverviewLongMotionPalette,
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
  const words = voice.text.trim().split(/\s+/).filter(Boolean);
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
      current.length >= 3
      || text.length >= 22
      || (punctuationEndsPhrase && current.length >= 2)
    ) {
      flush();
    }
  }
  flush();
  return phrases;
}

function karaokeText(phrase: WordTiming[]): string {
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
    return `{\\kf${wordCentiseconds}}${assText(word.text.toLocaleUpperCase("ru-RU"))}`;
  }).join(" ");
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
      const fontSize = Math.max(
        56,
        Math.min(108, Math.floor(input.width * 0.78 / Math.max(1, phraseText.length * 0.65))),
      );
      const layoutIndex = (voiceIndex + phraseIndex) % 3;
      const accent = ACCENTS[(voiceIndex + phraseIndex) % ACCENTS.length]!;
      const y = Math.round(input.height * [0.68, 0.77, 0.59][layoutIndex]!);
      const alignment = layoutIndex === 0 ? 4 : layoutIndex === 1 ? 2 : 6;
      const x = layoutIndex === 0
        ? Math.round(input.width * 0.085)
        : layoutIndex === 1
          ? Math.round(input.width / 2)
          : Math.round(input.width * 0.915);
      const override = `{\\an${alignment}\\pos(${x},${y})\\fs${fontSize}\\fad(90,120)\\fscx86\\fscy86\\bord5\\shad3\\blur0.2\\fsp1.5\\t(0,180,\\fscx100\\fscy100)}`;
      const text = `${override}${karaokeText(phrase)}`;
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

const KINETIC_STOP_WORDS = new Set([
  "а", "без", "бы", "в", "во", "все", "для", "до", "же", "за", "и", "из",
  "или", "к", "как", "когда", "ли", "между", "мы", "на", "над", "но", "о",
  "об", "от", "по", "под", "при", "про", "с", "со", "так", "также", "то",
  "только", "у", "уже", "что", "это", "этого", "эта", "эти", "этот", "я",
  "the", "a", "an", "and", "as", "at", "for", "from", "in", "into", "of",
  "on", "or", "to", "with",
]);

function kineticWordGroups(value: string): string[][] {
  const allWords = value.match(/[\p{L}\p{N}]+(?:[-‑–][\p{L}\p{N}]+)*/gu) ?? [];
  const contentWords = allWords.filter((word) =>
    !KINETIC_STOP_WORDS.has(word.toLocaleLowerCase("ru-RU")),
  );
  const words = contentWords.length ? contentWords : allWords;
  if (!words.length) return [];
  if (words.length <= 2) return [words];
  const first = words.slice(0, 2);
  const last = words.slice(-2);
  return [
    first,
    first.join(" ") === last.join(" ") ? [] : last,
  ].filter((group) => group.length > 0);
}

function assColor(rgb: string): string {
  const hex = rgb.replace(/^0x/iu, "").padStart(6, "0").slice(-6);
  const [red, green, blue] = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)];
  return `&H00${blue}${green}${red}&`;
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
  const maxCharacters = Math.max(10, Math.round(input.width / 120));
  const dialogues: Array<{ startMs: number; text: string }> = [];
  const beats = buildCoinOverviewLongPhraseBeats({
    voices: input.voices,
    durationMs: input.durationMs,
  });

  for (const beat of beats) {
    if (!beat.text) continue;
    const groups = kineticWordGroups(beat.text);
    if (!groups.length) continue;
    const beatDurationMs = beat.endMs - beat.startMs;

    groups.forEach((group, groupIndex) => {
      const groupStartMs = beat.startMs + Math.round(beatDurationMs * groupIndex / groups.length);
      const groupEndMs = beat.startMs + Math.round(beatDurationMs * (groupIndex + 1) / groups.length);
      const visibleStartMs = Math.max(chunkStartMs, groupStartMs);
      const visibleEndMs = Math.min(chunkEndMs, groupEndMs);
      if (visibleEndMs <= visibleStartMs) return;

      const layout = beat.beatIndex % 6;
      const palette = getCoinOverviewLongMotionPalette(beat, layout);
      const wrapped = wrapMotionCaption(
        group.join(" ").toLocaleUpperCase("ru-RU"),
        maxCharacters,
      );
      const lines = wrapped.split("\u0000");
      const longestLine = Math.max(...lines.map((line) => line.length), 1);
      const fontSize = Math.max(
        Math.round(input.height * 0.08),
        Math.min(
          Math.round(input.height * 0.21),
          Math.floor(input.width * 0.82 / Math.max(1, longestLine * 0.61)),
        ),
      );
      const leftSide = layout % 2 === 0;
      const x = Math.round(input.width * (leftSide ? 0.075 : 0.925));
      const y = Math.round(input.height * 0.91);
      const alignment = leftSide ? 1 : 3;
      const titleColor = assColor(palette.title);
      const outlineColor = assColor(
        palette.darkBackground
          ? palette.primary
          : palette.title === "0x111218" ? "0xfbfaf6" : "0x111218",
      );
      const rotation = groupIndex % 2 === 0 ? -1 : 1;
      const override =
        `{\\an${alignment}\\pos(${x},${y})\\fs${fontSize}` +
        `\\1c${titleColor}\\3c${outlineColor}\\bord4\\shad4\\fad(55,90)` +
        `\\fscx80\\fscy84\\frz${rotation}\\fsp-1\\t(0,170,\\fscx100\\fscy100\\frz0)}`;
      dialogues.push({
        startMs: visibleStartMs,
        text: `Dialogue: 1,${assTime(visibleStartMs - chunkStartMs)},${assTime(visibleEndMs - chunkStartMs)},Hit,,0,0,0,,${override}${assText(wrapped).replaceAll("\u0000", "\\N")}`,
      });
    });
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
    "Style: Hit,DejaVu Sans,180,&H00FBFAF6,&H0000FFEE,&H00111218,&HA6111218,-1,0,1,4,4,2,80,80,0,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...dialogues.sort((a, b) => a.startMs - b.startMs).map((dialogue) => dialogue.text),
    "",
  ].join("\n");
}