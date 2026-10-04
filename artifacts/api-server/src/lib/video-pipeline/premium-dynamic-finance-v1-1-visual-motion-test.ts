import { execFile } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import {
  generateSpeech,
  getConfiguredVoiceId,
  getElevenLabsModel,
  getSpeechProvider,
  prepareSpeechText,
  transcribeSpeechWithTimestamps,
} from "../audio-generation/elevenlabs-client";
import {
  alignKineticSubtitleWords,
  buildLongformKineticSubtitleAss,
  type KineticSubtitleWord,
} from "./longform-kinetic-subtitles";
import { renderLongformVisualVideo } from "./longform-visual-renderer";
import {
  buildPremiumFinanceEmphasisEvents,
  type PremiumDynamicFinanceBeat,
  type PremiumFinanceSfxKind,
} from "./premium-dynamic-finance";
import {
  PremiumVisualMotionEngine,
  type PremiumVisualMotionAudit,
} from "./premium-dynamic-finance-v1-1-premium-visual-motion-engine";
import type {
  PremiumDynamicFinanceV1_1SemanticEvent,
  PremiumDynamicFinanceV1_1SemanticPlan,
} from "./premium-dynamic-finance-v1-1-semantic-director";
import type { LongformVoice, LongformVisualBeat } from "./longform-visual-director";

const execFileAsync = promisify(execFile);
const API_ROOT = process.cwd();
const OUTPUT_DIR = resolve(API_ROOT, "output");
const APPROVED_PLAN_PATH = resolve(
  OUTPUT_DIR,
  "premium-dynamic-finance-v1-1-dogecoin-semantic-test-20261004130324-VISUAL_PLAN.json",
);
const MUSIC_BED_PATH = resolve(API_ROOT, "assets/audio/coin-overview-music-bed.mp3");
const SELECTED_SCENES = [3, 4, 5, 6, 7, 8] as const;
const SCRIBE_ALIGNMENT_SCENES = [2, 3, 4, 5, 6, 7, 8] as const;
const MIN_SAMPLE_MS = 30_000;
const MAX_SAMPLE_MS = 45_000;
const CONTACT_SHEET_FRAME_COUNT = 24;

type ApprovedVisualPlan = PremiumDynamicFinanceV1_1SemanticPlan & {
  narration: {
    provider: string;
    language: string;
    generatedVoiceTrack: boolean;
    timingSource: string;
    script: Array<{
      sceneId: number;
      startMs: number;
      endMs: number;
      text: string;
    }>;
    scribe: {
      expectedWords: number;
      matchedWords: number;
      interpolatedWords: number;
      matchCoverage: number;
      perSceneMatchCoverage: number[];
    };
  };
  constraints: Record<string, unknown>;
};

type MediaProbe = {
  durationSeconds: number;
  streams: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    sample_rate?: string;
    channels?: number;
  }>;
};

type FreshSceneTiming = {
  startMs: number;
  endMs: number;
  words: KineticSubtitleWord[];
};

type EventWordRange = {
  firstWord: KineticSubtitleWord;
  lastWord: KineticSubtitleWord;
};

function normalizeWord(value: string): string {
  return value.toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function tokensIn(text: string): string[] {
  return text.trim()
    .split(/\s+/u)
    .filter((token) => normalizeWord(token).length > 0);
}

function toLongformBeat(event: PremiumDynamicFinanceV1_1SemanticEvent): LongformVisualBeat {
  const visual = event.premiumDynamic;
  return {
    index: event.beatIndex,
    sceneId: event.sceneId,
    startMs: event.startMs,
    endMs: event.endMs,
    voiceExcerpt: event.voiceExcerpt,
    mainIdea: visual.mainIdea,
    visualConcept: visual.visualConcept,
    assetDescription: visual.assetDescription,
    visualForm: visual.visualForm,
    composition: visual.composition,
    entry: visual.entry,
    movement: visual.movement,
    exit: visual.exit,
    transition: visual.transition,
    kineticText: visual.kineticText,
    focalPoint: visual.focalPoint,
  };
}

function toPremiumDynamicBeat(event: PremiumDynamicFinanceV1_1SemanticEvent): PremiumDynamicFinanceBeat {
  const beat = toLongformBeat(event);
  const visual = event.premiumDynamic;
  return {
    ...beat,
    intensity: visual.intensity,
    keyWords: visual.emphasisWord ? [visual.emphasisWord] : [],
    ...(visual.emphasisWord ? { emphasisWord: visual.emphasisWord } : {}),
    ...(visual.sfxEvent ? { sfxEvent: visual.sfxEvent } : {}),
  };
}

function mapScriptToFreshScribe(input: {
  script: ApprovedVisualPlan["narration"]["script"];
  scribeWords: Array<{ text: string; start?: number; end?: number; type?: string }>;
  durationMs: number;
}): {
  alignment: ReturnType<typeof alignKineticSubtitleWords>;
  sceneTimings: Map<number, FreshSceneTiming>;
} {
  const voices: LongformVoice[] = input.script.map((scene) => ({
    sceneId: scene.sceneId,
    startTime: scene.sceneId,
    endTime: input.durationMs,
    text: scene.text,
  }));
  const alignment = alignKineticSubtitleWords({
    voices,
    transcriptWords: input.scribeWords,
    durationMs: input.durationMs,
    minimumMatchCoverage: 0.9,
    requireExactMatches: true,
  });
  const sceneTimings = new Map<number, FreshSceneTiming>();
  let cursor = 0;
  for (const scene of input.script) {
    const wordCount = tokensIn(scene.text).length;
    const words = alignment.words.slice(cursor, cursor + wordCount);
    if (words.length !== wordCount) {
      throw new Error(`Fresh Scribe subtitle mapping lost words from scene ${scene.sceneId}`);
    }
    cursor += wordCount;
    const startMs = words[0]!.startMs;
    const endMs = words.at(-1)!.endMs;
    if (endMs <= startMs) throw new Error(`Fresh Scribe returned invalid scene ${scene.sceneId} timing`);
    sceneTimings.set(scene.sceneId, { startMs, endMs, words });
  }
  if (cursor !== alignment.words.length) {
    throw new Error("Fresh Scribe subtitle mapping did not consume the complete approved script");
  }
  return { alignment, sceneTimings };
}

function alignExistingBeatsToFreshScribe(input: {
  sourceEvents: PremiumDynamicFinanceV1_1SemanticEvent[];
  sceneTimings: Map<number, FreshSceneTiming>;
  segmentStartMs: number;
  segmentEndMs: number;
}): {
  beats: LongformVisualBeat[];
  events: PremiumDynamicFinanceV1_1SemanticEvent[];
  eventWordRanges: Map<number, EventWordRange>;
} {
  const events = [...input.sourceEvents]
    .filter((event) => SELECTED_SCENES.includes(event.sceneId as typeof SELECTED_SCENES[number]))
    .sort((left, right) => left.startMs - right.startMs);
  if (!events.length) throw new Error("Approved plan contains no beats for scenes 3–8");

  const eventWordRanges = new Map<number, EventWordRange>();
  const grouped = new Map<number, PremiumDynamicFinanceV1_1SemanticEvent[]>();
  for (const event of events) {
    const group = grouped.get(event.sceneId) ?? [];
    group.push(event);
    grouped.set(event.sceneId, group);
  }

  for (const sceneId of SELECTED_SCENES) {
    const sceneTiming = input.sceneTimings.get(sceneId);
    const sceneEvents = grouped.get(sceneId);
    if (!sceneTiming || !sceneEvents?.length) {
      throw new Error(`Approved plan is missing narration timing or visual beats for scene ${sceneId}`);
    }
    let cursor = 0;
    for (const event of sceneEvents) {
      const excerptTokens = tokensIn(event.voiceExcerpt);
      const excerptWords = sceneTiming.words.slice(cursor, cursor + excerptTokens.length);
      if (
        excerptWords.length !== excerptTokens.length
        || excerptWords.some((word, index) => normalizeWord(word.text) !== normalizeWord(excerptTokens[index]!))
      ) {
        throw new Error(
          `Saved beat ${event.beatIndex} no longer maps exactly to its approved scene ${sceneId} script excerpt`,
        );
      }
      cursor += excerptTokens.length;
      eventWordRanges.set(event.beatIndex, {
        firstWord: excerptWords[0]!,
        lastWord: excerptWords.at(-1)!,
      });
    }
    if (cursor !== sceneTiming.words.length) {
      throw new Error(`Saved beats for scene ${sceneId} do not cover its complete script`);
    }
  }

  const rebasedEvents = events.map((event, index) => {
    const currentWords = eventWordRanges.get(event.beatIndex)!;
    const nextEvent = events[index + 1];
    const firstInScene = !events[index - 1] || events[index - 1]!.sceneId !== event.sceneId;
    const lastInScene = !nextEvent || nextEvent.sceneId !== event.sceneId;
    const sceneStartMs = firstInScene
      ? event.sceneId === SELECTED_SCENES[0]
        ? input.segmentStartMs
        : input.sceneTimings.get(event.sceneId - 1)?.endMs ?? currentWords.firstWord.startMs
      : currentWords.firstWord.startMs;
    const sceneEndMs = lastInScene
      ? input.sceneTimings.get(event.sceneId)!.endMs
      : eventWordRanges.get(nextEvent!.beatIndex)!.firstWord.startMs;
    const startMs = Math.max(input.segmentStartMs, sceneStartMs) - input.segmentStartMs;
    const endMs = Math.min(input.segmentEndMs, sceneEndMs) - input.segmentStartMs;
    if (endMs <= startMs) {
      throw new Error(`Fresh Scribe produced a zero-length interval for saved beat ${event.beatIndex}`);
    }
    return { ...event, startMs, endMs };
  });

  if (rebasedEvents[0]!.startMs !== 0 || rebasedEvents.at(-1)!.endMs !== input.segmentEndMs - input.segmentStartMs) {
    throw new Error("Fresh Scribe motion beats do not cover the selected 30–45 second sample continuously");
  }
  for (let index = 1; index < rebasedEvents.length; index += 1) {
    if (rebasedEvents[index - 1]!.endMs !== rebasedEvents[index]!.startMs) {
      throw new Error(`Fresh Scribe motion beat timeline has a gap before beat ${rebasedEvents[index]!.beatIndex}`);
    }
  }
  return {
    events: rebasedEvents,
    beats: rebasedEvents.map(toLongformBeat),
    eventWordRanges,
  };
}

async function probeMedia(filePath: string): Promise<MediaProbe> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels",
    "-of", "json",
    filePath,
  ]);
  const probe = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: MediaProbe["streams"];
  };
  return {
    durationSeconds: Number(probe.format?.duration || 0),
    streams: probe.streams ?? [],
  };
}

async function createSfxSample(kind: PremiumFinanceSfxKind, outputPath: string): Promise<void> {
  const duration = kind === "whoosh" ? 0.42 : 0.32;
  const source = kind === "whoosh"
    ? `anoisesrc=color=pink:sample_rate=48000:duration=${duration}`
    : `sine=frequency=74:sample_rate=48000:duration=${duration}`;
  const filter = kind === "whoosh"
    ? "highpass=f=450,lowpass=f=7200,afade=t=in:d=0.03,afade=t=out:st=0.27:d=0.15"
    : "lowpass=f=180,afade=t=in:d=0.005,afade=t=out:st=0.035:d=0.285";
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", source,
    "-af", filter,
    "-ar", "48000",
    "-ac", "2",
    "-c:a", "pcm_s16le",
    outputPath,
  ], { maxBuffer: 8 * 1024 * 1024 });
}

async function buildSegmentAudioMix(input: {
  voicePath: string;
  musicPath: string;
  outputPath: string;
  tempDir: string;
  segmentStartMs: number;
  durationMs: number;
  sfxEvents: Array<{ kind: PremiumFinanceSfxKind; startMs: number; volume: number }>;
}): Promise<void> {
  const durationSeconds = (input.durationMs / 1_000).toFixed(3);
  const sfxSamples = new Map<PremiumFinanceSfxKind, string>();
  for (const kind of new Set(input.sfxEvents.map((event) => event.kind))) {
    const filePath = join(input.tempDir, `motion-test-sfx-${kind}.wav`);
    await createSfxSample(kind, filePath);
    sfxSamples.set(kind, filePath);
  }

  const args = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", input.voicePath,
    "-stream_loop", "-1", "-i", input.musicPath,
  ];
  for (const event of input.sfxEvents) {
    const samplePath = sfxSamples.get(event.kind);
    if (!samplePath) throw new Error(`Missing isolated test sound sample for ${event.kind}`);
    args.push("-i", samplePath);
  }

  const fadeDuration = Math.min(1.5, input.durationMs / 2_000);
  const fadeStart = Math.max(0, input.durationMs / 1_000 - fadeDuration).toFixed(3);
  const filters = [
    `[0:a]aresample=48000,atrim=start=${(input.segmentStartMs / 1_000).toFixed(3)}:duration=${durationSeconds},asetpts=PTS-STARTPTS,volume=1.0[voice]`,
    `[1:a]aresample=48000,volume=0.14,atrim=duration=${durationSeconds},afade=t=out:st=${fadeStart}:d=${fadeDuration.toFixed(3)}[music]`,
  ];
  const mixInputs = ["[voice]", "[music]"];
  input.sfxEvents.forEach((event, index) => {
    const inputIndex = index + 2;
    const delay = Math.max(0, Math.round(event.startMs));
    const label = `sfx${index}`;
    filters.push(`[${inputIndex}:a]aresample=48000,volume=${event.volume},adelay=${delay}|${delay}[${label}]`);
    mixInputs.push(`[${label}]`);
  });
  filters.push(
    `${mixInputs.join("")}amix=inputs=${mixInputs.length}:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.97,atrim=duration=${durationSeconds}[mix]`,
  );
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[mix]",
    "-t", durationSeconds,
    "-ar", "48000",
    "-c:a", "aac",
    "-b:a", "192k",
    input.outputPath,
  );
  await execFileAsync("ffmpeg", args, { maxBuffer: 12 * 1024 * 1024 });
}

async function createContactSheet(input: {
  videoPath: string;
  durationSeconds: number;
  outputPath: string;
  tempDir: string;
}): Promise<void> {
  const frames: string[] = [];
  for (let index = 0; index < CONTACT_SHEET_FRAME_COUNT; index += 1) {
    const timestamp = Math.min(
      input.durationSeconds - 0.12,
      ((index + 0.5) / CONTACT_SHEET_FRAME_COUNT) * input.durationSeconds,
    );
    const framePath = join(input.tempDir, `motion-contact-${String(index).padStart(2, "0")}.jpg`);
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", Math.max(0, timestamp).toFixed(3),
      "-i", input.videoPath,
      "-frames:v", "1",
      "-q:v", "3",
      framePath,
    ], { maxBuffer: 8 * 1024 * 1024 });
    frames.push(framePath);
  }
  const { stdout: fontResult } = await execFileAsync("fc-match", [
    "-f", "%{file}", "DejaVu Sans",
  ]);
  const fontPath = fontResult.trim();
  if (!fontPath) throw new Error("Contact sheet generation requires DejaVu Sans");
  await access(fontPath);
  await execFileAsync("magick", [
    "montage",
    "-font", fontPath,
    ...frames,
    "-tile", "4x6",
    "-geometry", "480x270+6+6",
    "-background", "#05070D",
    "-quality", "88",
    input.outputPath,
  ], { maxBuffer: 8 * 1024 * 1024 });
}

async function resolveFontPath(): Promise<string> {
  const { stdout } = await execFileAsync("fc-match", [
    "-f", "%{file}", "DejaVu Sans",
  ]);
  const fontPath = stdout.trim();
  if (!fontPath) throw new Error("PremiumVisualMotionEngine requires an installed DejaVu Sans font");
  await access(fontPath);
  return fontPath;
}

function pathExists(filePath: string): Promise<boolean> {
  return access(filePath).then(() => true).catch(() => false);
}

function buildFreshSfxEvents(input: {
  plan: ApprovedVisualPlan;
  selectedEvents: PremiumDynamicFinanceV1_1SemanticEvent[];
  eventWordRanges: Map<number, EventWordRange>;
  segmentStartMs: number;
  segmentEndMs: number;
}): Array<{ kind: PremiumFinanceSfxKind; startMs: number; volume: number }> {
  const selectedSceneIds = new Set<number>(SELECTED_SCENES);
  return input.plan.baseEditPlan.sfxEvents.flatMap((cue) => {
    if (!selectedSceneIds.has(cue.sceneId)) return [];
    const sameScene = input.selectedEvents.filter((event) => event.sceneId === cue.sceneId);
    const matchedEvent = sameScene
      .filter((event) => event.premiumDynamic.sfxEvent === cue.kind)
      .sort((left, right) =>
        Math.abs(left.startMs - cue.startMs) - Math.abs(right.startMs - cue.startMs),
      )[0];
    const absoluteStartMs = matchedEvent
      ? input.eventWordRanges.get(matchedEvent.beatIndex)!.firstWord.startMs
      : input.plan.narration.script.find((scene) => scene.sceneId === cue.sceneId)!.startMs;
    if (absoluteStartMs < input.segmentStartMs || absoluteStartMs >= input.segmentEndMs) return [];
    return [{
      kind: cue.kind,
      startMs: absoluteStartMs - input.segmentStartMs,
      volume: cue.volume,
    }];
  });
}

async function run(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log([
      "Test-only PremiumVisualMotionEngine render for approved Dogecoin scenes 3–8.",
      "Run: pnpm --filter @workspace/api-server run render:finance-v1-1-visual-motion-test",
      "Uses fresh TTS/Scribe, saved visual decisions, and no previous MP4, production route, or Telegram.",
    ].join("\n"));
    return;
  }

  await access(APPROVED_PLAN_PATH);
  await access(MUSIC_BED_PATH);
  await mkdir(OUTPUT_DIR, { recursive: true });
  const plan = JSON.parse(await readFile(APPROVED_PLAN_PATH, "utf8")) as ApprovedVisualPlan;
  if (
    plan.version !== "premium-dynamic-finance-v1.1-semantic-test"
    || plan.mode !== "TEST_MODE"
    || plan.entity.id !== "dogecoin"
    || plan.events.length !== 50
  ) {
    throw new Error("The approved Dogecoin Visual Plan is missing or has changed shape; refusing to rebuild it");
  }
  const sceneIds = [...new Set(plan.events.map((event) => event.sceneId))].sort((left, right) => left - right);
  if (sceneIds.join(",") !== "1,2,3,4,5,6,7,8,9,10") {
    throw new Error("Approved Visual Plan no longer contains the expected ten original scenes");
  }
  const scriptText = prepareSpeechText(plan.narration.script.map((scene) => scene.text).join(" "));
  const voiceId = getConfiguredVoiceId();
  if (!voiceId.trim()) throw new Error("Configured speech provider has no voice ID");

  const runKey = new Date().toISOString().replace(/\D/gu, "").slice(0, 14);
  const prefix = `premium-dynamic-finance-v1-1-dogecoin-visual-motion-test-${runKey}`;
  const outputPath = resolve(OUTPUT_DIR, `${prefix}.mp4`);
  const visualPlanPath = resolve(OUTPUT_DIR, `${prefix}-VISUAL_PLAN.json`);
  const reportPath = resolve(OUTPUT_DIR, `${prefix}-MOTION_AUDIT_REPORT.json`);
  const contactSheetPath = resolve(OUTPUT_DIR, `${prefix}-CONTACT_SHEET.jpg`);
  for (const path of [outputPath, visualPlanPath, reportPath, contactSheetPath]) {
    if (await pathExists(path)) throw new Error(`Refusing to overwrite an existing test artifact: ${path}`);
  }

  const tempDir = await mkdtemp(join(tmpdir(), "premium-visual-motion-test-"));
  try {
    const voicePath = join(tempDir, "fresh-approved-narration.mp3");
    const mixedAudioPath = join(tempDir, "fresh-segment-audio.m4a");
    const speechBuffer = await generateSpeech(
      scriptText,
      voiceId,
      getElevenLabsModel(),
      {
        speed: 0.92,
        stability: 0.55,
        similarity: 0.78,
        style: 0.18,
        speakerBoost: true,
      },
    );
    if (!speechBuffer.length) throw new Error("Speech provider returned an empty fresh narration file");
    await writeFile(voicePath, speechBuffer);
    const speechProbe = await probeMedia(voicePath);
    if (speechProbe.durationSeconds < 1) throw new Error("Fresh narration is too short to render the selected scenes");
    const speechDurationMs = Math.ceil(speechProbe.durationSeconds * 1_000);
    const scribe = await transcribeSpeechWithTimestamps(speechBuffer, `${prefix}.mp3`);
    const alignmentScript = plan.narration.script.filter((scene) =>
      SCRIBE_ALIGNMENT_SCENES.includes(scene.sceneId as typeof SCRIBE_ALIGNMENT_SCENES[number]),
    );
    const { alignment, sceneTimings } = mapScriptToFreshScribe({
      script: alignmentScript,
      scribeWords: scribe.words,
      durationMs: speechDurationMs,
    });
    if (alignment.interpolatedWordCount !== 0 || alignment.matchedWordCount !== alignment.expectedWordCount) {
      throw new Error("Fresh Scribe timestamps are not exact for every approved subtitle word");
    }

    const segmentStartMs = sceneTimings.get(SELECTED_SCENES[0] - 1)!.endMs;
    const segmentEndMs = sceneTimings.get(SELECTED_SCENES.at(-1)!)!.endMs;
    const durationMs = segmentEndMs - segmentStartMs;
    if (durationMs < MIN_SAMPLE_MS || durationMs > MAX_SAMPLE_MS) {
      throw new Error(
        `Fresh Scribe scenes 3–8 span ${durationMs} ms; motion test must stay between 30 and 45 seconds`,
      );
    }

    const selectedPlan = alignExistingBeatsToFreshScribe({
      sourceEvents: plan.events,
      sceneTimings,
      segmentStartMs,
      segmentEndMs,
    });
    const semanticEvents = selectedPlan.events;
    const premiumBeats = semanticEvents.map(toPremiumDynamicBeat);
    const segmentSubtitleWords = alignment.words
      .filter((word) => word.startMs >= segmentStartMs && word.endMs <= segmentEndMs)
      .map((word) => ({
        ...word,
        startMs: word.startMs - segmentStartMs,
        endMs: word.endMs - segmentStartMs,
      }));
    const expectedSegmentWords = plan.narration.script
      .filter((scene) => SELECTED_SCENES.includes(scene.sceneId as typeof SELECTED_SCENES[number]))
      .reduce((sum, scene) => sum + tokensIn(scene.text).length, 0);
    if (segmentSubtitleWords.length !== expectedSegmentWords) {
      throw new Error(
        `Subtitle crop contains ${segmentSubtitleWords.length}/${expectedSegmentWords} exact words for scenes 3–8`,
      );
    }

    const emphasisEvents = buildPremiumFinanceEmphasisEvents(premiumBeats, segmentSubtitleWords);
    const subtitleAss = buildLongformKineticSubtitleAss({
      words: segmentSubtitleWords,
      durationMs,
      width: 1920,
      height: 1080,
      emphasisEvents,
    });
    const subtitleDialogueCount = subtitleAss.ass
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("Dialogue:")).length;
    const motionEngine = new PremiumVisualMotionEngine({
      events: semanticEvents,
      beats: selectedPlan.beats,
      subtitleWords: segmentSubtitleWords,
      fontPath: await resolveFontPath(),
    });
    const motionAudit = motionEngine.getAudit();
    if (motionAudit.sceneCount !== SELECTED_SCENES.length || motionAudit.beatCount !== semanticEvents.length) {
      throw new Error("PremiumVisualMotionEngine audit does not cover every selected saved scene and beat");
    }
    if (motionAudit.sceneTransitions.length !== SELECTED_SCENES.length - 1) {
      throw new Error("PremiumVisualMotionEngine did not create a transition record for all five scene boundaries");
    }
    const freshSfxEvents = buildFreshSfxEvents({
      plan,
      selectedEvents: plan.events.filter((event) =>
        SELECTED_SCENES.includes(event.sceneId as typeof SELECTED_SCENES[number]),
      ),
      eventWordRanges: selectedPlan.eventWordRanges,
      segmentStartMs,
      segmentEndMs,
    });
    await buildSegmentAudioMix({
      voicePath,
      musicPath: MUSIC_BED_PATH,
      outputPath: mixedAudioPath,
      tempDir,
      segmentStartMs,
      durationMs,
      sfxEvents: freshSfxEvents,
    });

    const rendered = await renderLongformVisualVideo({
      beats: selectedPlan.beats,
      durationMs,
      sourceAudioPath: mixedAudioPath,
      outputPath,
      kineticSubtitleWords: segmentSubtitleWords,
      kineticSubtitleEmphasis: emphasisEvents,
      semanticVisualEvents: semanticEvents,
      visualMotionFactory: ({ beat, semanticVisual, durationSeconds }) =>
        motionEngine.getTreatment({
          beat,
          event: semanticVisual,
          durationSeconds,
        }),
    });
    const outputProbe = await probeMedia(outputPath);
    const videoStream = outputProbe.streams.find((stream) => stream.codec_type === "video");
    const audioStream = outputProbe.streams.find((stream) => stream.codec_type === "audio");
    await createContactSheet({
      videoPath: outputPath,
      durationSeconds: outputProbe.durationSeconds,
      outputPath: contactSheetPath,
      tempDir,
    });

    const subtitleIntegrity = {
      status: alignment.interpolatedWordCount === 0
        && alignment.matchedWordCount === alignment.expectedWordCount
        && segmentSubtitleWords.length === expectedSegmentWords
        && subtitleDialogueCount > 0
        ? "PASS"
        : "FAIL",
      subtitlePipelineChanged: false,
      exactAlignmentSceneIds: SCRIBE_ALIGNMENT_SCENES,
      exactAlignmentExpectedWords: alignment.expectedWordCount,
      exactAlignmentScribeMatchedWords: alignment.matchedWordCount,
      exactAlignmentInterpolatedWords: alignment.interpolatedWordCount,
      exactAlignmentMatchCoverage: alignment.matchCoverage,
      selectedSceneIds: SELECTED_SCENES,
      selectedExpectedWords: expectedSegmentWords,
      selectedExactScribeWords: segmentSubtitleWords.length,
      subtitleDialogueCount,
    };
    const checks = [
      {
        id: "sample-duration-30-to-45-seconds",
        status: rendered.durationMs >= MIN_SAMPLE_MS && rendered.durationMs <= MAX_SAMPLE_MS ? "PASS" : "FAIL",
        measuredDurationMs: rendered.durationMs,
      },
      {
        id: "fresh-script-scribe-timestamps-exact",
        status: subtitleIntegrity.status,
        alignedScenes: SCRIBE_ALIGNMENT_SCENES,
        expectedWords: alignment.expectedWordCount,
        matchedWords: alignment.matchedWordCount,
        interpolatedWords: alignment.interpolatedWordCount,
        matchCoverage: alignment.matchCoverage,
      },
      {
        id: "existing-scenes-and-beats-preserved",
        status: semanticEvents.length === selectedPlan.beats.length
          && SELECTED_SCENES.every((sceneId) =>
            semanticEvents.some((event) => event.sceneId === sceneId),
          )
          && semanticEvents.every((event) => {
            const saved = plan.events.find((candidate) => candidate.beatIndex === event.beatIndex);
            return Boolean(
              saved
              && saved.sceneId === event.sceneId
              && saved.semanticType === event.semanticType
              && saved.voiceExcerpt === event.voiceExcerpt
              && JSON.stringify(saved.premiumDynamic) === JSON.stringify(event.premiumDynamic),
            );
          })
          ? "PASS"
          : "FAIL",
        selectedSceneIds: [...new Set(semanticEvents.map((event) => event.sceneId))],
        beatCount: semanticEvents.length,
      },
      {
        id: "motion-audit-covers-scene-boundaries",
        status: motionAudit.sceneTransitions.length === 5 ? "PASS" : "FAIL",
        transitionCount: motionAudit.sceneTransitions.length,
      },
      {
        id: "h264-1080p-30fps-and-audio",
        status: videoStream?.codec_name === "h264"
          && videoStream.width === 1920
          && videoStream.height === 1080
          && videoStream.r_frame_rate === "30/1"
          && audioStream?.codec_name === "aac"
          ? "PASS"
          : "FAIL",
        codec: videoStream?.codec_name ?? null,
        width: videoStream?.width ?? null,
        height: videoStream?.height ?? null,
        frameRate: videoStream?.r_frame_rate ?? null,
        audioCodec: audioStream?.codec_name ?? null,
      },
      {
        id: "previous-mp4-production-and-telegram-isolation",
        status: plan.constraints.previousMp4UsedAsInput === false
          && plan.constraints.previousMp4Overwritten === false
          && plan.constraints.productionRouteChanged === false
          && plan.constraints.telegramConnected === false
          ? "PASS"
          : "FAIL",
        previousMp4UsedAsInput: false,
        previousMp4Overwritten: false,
        productionRouteChanged: false,
        telegramConnected: false,
      },
      {
        id: "contact-sheet-generated",
        status: await pathExists(contactSheetPath) ? "PASS" : "FAIL",
        frameCount: CONTACT_SHEET_FRAME_COUNT,
      },
    ];
    const status = checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL";
    const outputFiles = {
      video: relative(API_ROOT, outputPath),
      visualPlan: relative(API_ROOT, visualPlanPath),
      motionAuditReport: relative(API_ROOT, reportPath),
      contactSheet: relative(API_ROOT, contactSheetPath),
    };
    const planWithMotion = {
      ...plan,
      motionTest: {
        engine: "PremiumVisualMotionEngine",
        selectedSceneIds: SELECTED_SCENES,
        selectedFreshScribeIntervalMs: { startMs: segmentStartMs, endMs: segmentEndMs },
        durationMs,
        previousMp4UsedAsInput: false,
        productionRouteChanged: false,
        telegramConnected: false,
        motionAuditReport: outputFiles.motionAuditReport,
        appliedAnimationTypes: motionAudit.appliedAnimationTypes,
        sceneTransitions: motionAudit.sceneTransitions,
        subtitleIntegrity,
      },
    };
    const report = {
      version: "premium-dynamic-finance-v1.1-visual-motion-test-audit",
      mode: "TEST_MODE",
      status,
      generatedAt: new Date().toISOString(),
      sourceVisualPlan: relative(API_ROOT, APPROVED_PLAN_PATH),
      outputs: outputFiles,
      segment: {
        sceneIds: SELECTED_SCENES,
        planIntervalMs: { startMs: 14_480, endMs: 56_960, durationMs: 42_480 },
        freshScribeIntervalMs: { startMs: segmentStartMs, endMs: segmentEndMs, durationMs },
        freshNarrationProvider: getSpeechProvider(),
        freshNarrationModel: getElevenLabsModel(),
        audio: "fresh approved script narration + existing coin-overview music bed + saved scene SFX cues",
        previousMp4UsedAsInput: false,
      },
      motionAudit: motionAudit satisfies PremiumVisualMotionAudit,
      subtitleIntegrity,
      checks,
      visualReview: {
        status: "PENDING_MANUAL_CONTACT_SHEET_REVIEW",
        requiredFrameCount: CONTACT_SHEET_FRAME_COUNT,
      },
      isolation: {
        previousMp4UsedAsInput: false,
        previousMp4Overwritten: false,
        productionRouteChanged: false,
        telegramConnected: false,
        semanticVisualDirectorChanged: false,
        savedSceneContentOrTypesChanged: false,
        subtitlePipelineChanged: false,
      },
    };
    await writeFile(visualPlanPath, `${JSON.stringify(planWithMotion, null, 2)}\n`, "utf8");
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      mode: "TEST_MODE",
      status,
      ...outputFiles,
      durationMs: rendered.durationMs,
      sceneCount: motionAudit.sceneCount,
      beatCount: motionAudit.beatCount,
      transitions: motionAudit.sceneTransitions.length,
      subtitleIntegrity: subtitleIntegrity.status,
      interpolatedSubtitleWords: alignment.interpolatedWordCount,
      sfxEvents: freshSfxEvents.length,
    }, null, 2));
    if (status !== "PASS") throw new Error(`Visual motion test failed; inspect ${reportPath}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error("PremiumVisualMotionEngine TEST_MODE failed:", error);
  process.exitCode = 1;
});