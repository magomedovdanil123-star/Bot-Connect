import { openRouterConfig } from "../openrouter-config";

export type LongformVoice = {
  sceneId: number;
  startTime: number | null;
  endTime: number | null;
  text: string;
  isFullVoice?: boolean;
};

export type LongformMicroBeat = {
  index: number;
  sceneId: number;
  startMs: number;
  endMs: number;
  voiceExcerpt: string;
};

export const LONGFORM_VISUAL_FORMS = [
  "hero-object",
  "kinetic-type",
  "cinematic-interface",
  "data-chart",
  "network-map",
  "timeline",
  "split-screen",
  "process-flow",
  "abstract-field",
] as const;

export const LONGFORM_COMPOSITIONS = [
  "left-heavy",
  "right-heavy",
  "centered",
  "diagonal",
  "split",
  "high",
  "low",
] as const;

export const LONGFORM_ENTRIES = [
  "impact",
  "sweep-left",
  "sweep-right",
  "rise",
  "unmask",
  "shatter",
  "zoom",
  "particle-burst",
] as const;

export const LONGFORM_MOVEMENTS = [
  "punch-in",
  "pull-back",
  "whip-left",
  "whip-right",
  "orbit",
  "parallax",
  "overshoot",
  "micro-shake",
  "rotate",
  "drift-up",
] as const;

export const LONGFORM_EXITS = [
  "whip-left",
  "whip-right",
  "collapse",
  "scatter",
  "fade",
  "flash",
  "fold",
] as const;

export const LONGFORM_TRANSITIONS = [
  "whip-left",
  "whip-right",
  "flash-cut",
  "glitch-cut",
  "swipe",
  "snap-cut",
  "mask-reveal",
] as const;

export const LONGFORM_FOCAL_POINTS = [
  "left",
  "center",
  "right",
  "upper",
  "lower",
] as const;

export type LongformVisualForm = typeof LONGFORM_VISUAL_FORMS[number];
export type LongformComposition = typeof LONGFORM_COMPOSITIONS[number];
export type LongformEntry = typeof LONGFORM_ENTRIES[number];
export type LongformMovement = typeof LONGFORM_MOVEMENTS[number];
export type LongformExit = typeof LONGFORM_EXITS[number];
export type LongformTransition = typeof LONGFORM_TRANSITIONS[number];
export type LongformFocalPoint = typeof LONGFORM_FOCAL_POINTS[number];

export type LongformVisualBeat = LongformMicroBeat & {
  mainIdea: string;
  visualConcept: string;
  assetDescription: string;
  visualForm: LongformVisualForm;
  composition: LongformComposition;
  entry: LongformEntry;
  movement: LongformMovement;
  exit: LongformExit;
  transition: LongformTransition;
  kineticText: string;
  focalPoint: LongformFocalPoint;
};

type TimedWord = {
  text: string;
  startMs: number;
  endMs: number;
};

const IDEAL_BEAT_MS = 1_550;
const MIN_BEAT_MS = 850;
const MAX_BEAT_MS = 2_000;

function normalizedText(value: string): string {
  return value.toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function allocateWordTimes(voice: LongformVoice, durationMs: number): TimedWord[] {
  const words = voice.text.trim().split(/\s+/u).filter(Boolean);
  const startMs = Math.max(0, Math.round(voice.startTime ?? 0));
  const endMs = Math.min(durationMs, Math.round(voice.endTime ?? durationMs));
  const availableMs = Math.max(0, endMs - startMs);
  if (!words.length || availableMs <= 0) return [];

  const weights = words.map((word) =>
    Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, "").length),
  );
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  let accumulatedWeight = 0;
  return words.map((text, index) => {
    const wordStart = startMs + availableMs * accumulatedWeight / weightTotal;
    accumulatedWeight += weights[index]!;
    const wordEnd = startMs + availableMs * accumulatedWeight / weightTotal;
    return {
      text,
      startMs: Math.round(wordStart),
      endMs: Math.round(wordEnd),
    };
  });
}

function splitVoiceWords(words: TimedWord[]): TimedWord[][] {
  const groups: TimedWord[][] = [];
  let group: TimedWord[] = [];

  const flush = () => {
    if (group.length) groups.push(group);
    group = [];
  };

  for (const word of words) {
    const currentStart = group[0]?.startMs ?? word.startMs;
    const wouldEnd = word.endMs;
    const punctuationBreak = /[.!?…;:]$/u.test(word.text)
      || (/[,:]$/u.test(word.text) && group.length >= 3);
    if (
      group.length
      && (wouldEnd - currentStart > MAX_BEAT_MS || group.length >= 6)
    ) {
      flush();
    }
    group.push(word);
    const elapsed = word.endMs - group[0]!.startMs;
    if (elapsed >= IDEAL_BEAT_MS || punctuationBreak) flush();
  }
  flush();

  for (let index = groups.length - 1; index > 0; index -= 1) {
    const current = groups[index]!;
    const previous = groups[index - 1]!;
    const currentDuration = current.at(-1)!.endMs - current[0]!.startMs;
    const combinedDuration = current.at(-1)!.endMs - previous[0]!.startMs;
    if (currentDuration < MIN_BEAT_MS && combinedDuration <= MAX_BEAT_MS) {
      previous.push(...current);
      groups.splice(index, 1);
    }
  }
  return groups;
}

function appendPauseBeats(
  beats: LongformMicroBeat[],
  startMs: number,
  endMs: number,
  sceneId: number,
): void {
  const duration = endMs - startMs;
  if (duration < 300) return;
  const count = Math.max(1, Math.ceil(duration / IDEAL_BEAT_MS));
  const segmentDuration = duration / count;
  for (let index = 0; index < count; index += 1) {
    beats.push({
      index: -1,
      sceneId,
      startMs: Math.round(startMs + segmentDuration * index),
      endMs: Math.round(startMs + segmentDuration * (index + 1)),
      voiceExcerpt: "",
    });
  }
}

export function buildLongformMicroBeats(input: {
  voices: LongformVoice[];
  durationMs: number;
}): LongformMicroBeat[] {
  if (!Number.isFinite(input.durationMs) || input.durationMs <= 0) {
    throw new Error("Long-form visual duration must be a positive number");
  }
  const durationMs = Math.round(input.durationMs);
  const voices = input.voices
    .filter((voice) => !voice.isFullVoice && voice.text.trim())
    .filter((voice) => voice.startTime !== null && voice.endTime !== null)
    .filter((voice) => Number.isFinite(voice.startTime) && Number.isFinite(voice.endTime))
    .sort((left, right) => (left.startTime ?? 0) - (right.startTime ?? 0));
  if (!voices.length) throw new Error("Long-form visual director requires timed narration");

  const beats: LongformMicroBeat[] = [];
  let cursorMs = 0;
  for (const voice of voices) {
    const voiceStartMs = Math.max(0, Math.min(durationMs, Math.round(voice.startTime!)));
    const voiceEndMs = Math.max(voiceStartMs, Math.min(durationMs, Math.round(voice.endTime!)));
    if (voiceStartMs > cursorMs + 300) appendPauseBeats(beats, cursorMs, voiceStartMs, voice.sceneId);
    const words = allocateWordTimes(voice, durationMs);
    for (const group of splitVoiceWords(words)) {
      const startMs = Math.max(cursorMs, group[0]!.startMs);
      const endMs = Math.min(durationMs, group.at(-1)!.endMs);
      if (endMs <= startMs) continue;
      beats.push({
        index: -1,
        sceneId: voice.sceneId,
        startMs,
        endMs,
        voiceExcerpt: group.map((word) => word.text).join(" "),
      });
      cursorMs = endMs;
    }
    cursorMs = Math.max(cursorMs, voiceEndMs);
  }
  if (cursorMs < durationMs - 300) {
    appendPauseBeats(beats, cursorMs, durationMs, voices.at(-1)!.sceneId);
  }

  const ordered = beats
    .filter((beat) => beat.endMs > beat.startMs)
    .sort((left, right) => left.startMs - right.startMs);
  let previousEnd = 0;
  return ordered.map((beat, index) => {
    const startMs = Math.max(previousEnd, beat.startMs);
    const endMs = Math.max(startMs, beat.endMs);
    previousEnd = endMs;
    return { ...beat, index, startMs, endMs };
  }).filter((beat) => beat.endMs > beat.startMs);
}

function enumValue<T extends readonly string[]>(
  value: unknown,
  values: T,
  label: string,
): T[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new Error(`Long-form visual plan has invalid ${label}`);
  }
  return value as T[number];
}

function boundedString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`Long-form visual plan is missing ${label}`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) {
    throw new Error(`Long-form visual plan has invalid ${label}`);
  }
  return cleaned;
}

export function validateLongformVisualPlan(
  microBeats: LongformMicroBeat[],
  rawPlan: unknown,
): LongformVisualBeat[] {
  if (!rawPlan || typeof rawPlan !== "object" || !Array.isArray((rawPlan as { beats?: unknown }).beats)) {
    throw new Error("Long-form visual director did not return a beats array");
  }
  const rawBeats = (rawPlan as { beats: unknown[] }).beats;
  if (rawBeats.length !== microBeats.length) {
    throw new Error(`Long-form visual plan expected ${microBeats.length} beats, received ${rawBeats.length}`);
  }

  const result = rawBeats.map((rawBeat, index): LongformVisualBeat => {
    if (!rawBeat || typeof rawBeat !== "object") {
      throw new Error(`Long-form visual plan beat ${index + 1} is invalid`);
    }
    const candidate = rawBeat as Record<string, unknown>;
    if (candidate["index"] !== index) {
      throw new Error(`Long-form visual plan beat ${index + 1} is out of order`);
    }
    const source = microBeats[index]!;
    const kineticText = typeof candidate["kineticText"] === "string"
      ? candidate["kineticText"].trim()
      : "";
    if (
      kineticText
      && !normalizedText(source.voiceExcerpt).includes(normalizedText(kineticText))
    ) {
      throw new Error(`Long-form visual plan beat ${index + 1} invented or rewrote on-screen text`);
    }
    return {
      ...source,
      mainIdea: boundedString(candidate["mainIdea"], "mainIdea", 80),
      visualConcept: boundedString(candidate["visualConcept"], "visualConcept", 180),
      assetDescription: boundedString(candidate["assetDescription"], "assetDescription", 160),
      visualForm: enumValue(candidate["visualForm"], LONGFORM_VISUAL_FORMS, "visualForm"),
      composition: enumValue(candidate["composition"], LONGFORM_COMPOSITIONS, "composition"),
      entry: enumValue(candidate["entry"], LONGFORM_ENTRIES, "entry"),
      movement: enumValue(candidate["movement"], LONGFORM_MOVEMENTS, "movement"),
      exit: enumValue(candidate["exit"], LONGFORM_EXITS, "exit"),
      transition: enumValue(candidate["transition"], LONGFORM_TRANSITIONS, "transition"),
      kineticText,
      focalPoint: enumValue(candidate["focalPoint"], LONGFORM_FOCAL_POINTS, "focalPoint"),
    };
  });

  for (let index = 1; index < result.length; index += 1) {
    const previous = result[index - 1]!;
    const current = result[index]!;
    if (current.transition === previous.transition) {
      throw new Error(`Long-form visual plan repeats a transition at beat ${index + 1}`);
    }
    if (current.composition === previous.composition) {
      throw new Error(`Long-form visual plan repeats a composition at beat ${index + 1}`);
    }
    if (current.movement === previous.movement) {
      throw new Error(`Long-form visual plan repeats a movement at beat ${index + 1}`);
    }
    if (current.visualForm === previous.visualForm) {
      throw new Error(`Long-form visual plan repeats a visual form at beat ${index + 1}`);
    }
  }
  return result;
}

function parseJsonResponse(content: string): unknown {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("OpenRouter returned an invalid visual plan");
    return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  }
}

async function requestVisualPlan(input: {
  context: string;
  microBeats: LongformMicroBeat[];
}): Promise<unknown> {
  if (!openRouterConfig.apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  const allowed = {
    visualForm: LONGFORM_VISUAL_FORMS,
    composition: LONGFORM_COMPOSITIONS,
    entry: LONGFORM_ENTRIES,
    movement: LONGFORM_MOVEMENTS,
    exit: LONGFORM_EXITS,
    transition: LONGFORM_TRANSITIONS,
    focalPoint: LONGFORM_FOCAL_POINTS,
  };
  const system = [
    "Ты — Visual Director для длинного русскоязычного YouTube-видео.",
    "Спроектируй монтаж с нуля: premium cinematic, high-end, dark fintech/crypto, дорогая типографика, свет, глубина и профессиональный compositing.",
    "Не используй шаблоны коротких финансовых роликов, их прежние сцены или композиции.",
    "Планируй каждый micro-beat как новый визуальный стимул: предмет, графика, крупный текст, интерфейс или новая композиция.",
    "Для каждого beat верни все 10 решений: основная мысль, образ, нужный asset, вход, движение, выход, переход, kinetic text и фокус; точный фрагмент диктора уже задан в исходных данных.",
    "Не переписывай narration. Не добавляй факты, числа, даты, подписи или торговые рекомендации.",
    "kineticText должен быть дословным фрагментом voiceExcerpt или пустой строкой.",
    "Asset — только оригинальная чистая графика без псевдотекста и без логотипов, если их нет в narration.",
    "Не повторяй соседние visualForm, composition, movement или transition. Не используй один zoom для всего монтажа.",
    "Верни только JSON вида {\"beats\":[...]}; все перечисления должны точно совпадать с допустимыми значениями.",
    `Допустимые значения: ${JSON.stringify(allowed)}.`,
  ].join("\n");
  const user = JSON.stringify({
    context: input.context,
    narrationIsImmutable: true,
    target: "16:9 landscape YouTube pilot; one visual event every 1–2 seconds",
    microBeats: input.microBeats.map((beat) => ({
      index: beat.index,
      startMs: beat.startMs,
      endMs: beat.endMs,
      voiceExcerpt: beat.voiceExcerpt,
      isPause: !beat.voiceExcerpt,
    })),
    requiredFields: [
      "index",
      "mainIdea",
      "visualConcept",
      "assetDescription",
      "visualForm",
      "composition",
      "entry",
      "movement",
      "exit",
      "transition",
      "kineticText",
      "focalPoint",
    ],
  });

  const models = Array.from(new Set([openRouterConfig.model, openRouterConfig.fallbackModel]));
  let lastError = "unknown error";
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(openRouterConfig.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openRouterConfig.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://replit.com",
            "X-Title": "AI Content Factory Long-form Visual Director",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            max_completion_tokens: Math.min(8_000, 1_000 + input.microBeats.length * 240),
            response_format: { type: "json_object" },
            ...(model.startsWith("openai/gpt-5") ? { reasoning: { effort: "minimal" } } : {}),
          }),
          signal: AbortSignal.timeout(180_000),
        });
        const data = await response.json() as {
          choices?: Array<{ message?: { content?: string } }>;
          error?: { message?: string };
        };
        if (!response.ok) throw new Error(data.error?.message || `OpenRouter API error (${response.status})`);
        const content = data.choices?.[0]?.message?.content;
        if (!content?.trim()) throw new Error("OpenRouter returned an empty visual plan");
        return parseJsonResponse(content);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
      }
    }
  }
  throw new Error(`Could not generate the long-form visual plan: ${lastError}`);
}

export async function createLongformVisualPlan(input: {
  voices: LongformVoice[];
  durationMs: number;
  context: string;
}): Promise<LongformVisualBeat[]> {
  const microBeats = buildLongformMicroBeats({
    voices: input.voices,
    durationMs: input.durationMs,
  });
  if (!microBeats.length) throw new Error("Long-form visual director created no micro-beats");
  const rawPlan = await requestVisualPlan({
    context: input.context,
    microBeats,
  });
  return validateLongformVisualPlan(microBeats, rawPlan);
}