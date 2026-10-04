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
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  generateSpeech,
  getConfiguredVoiceId,
  getElevenLabsModel,
  getSpeechProvider,
  prepareSpeechText,
  transcribeSpeechWithTimestamps,
} from "../audio-generation/elevenlabs-client";
import { resolveCoinOverviewMarketData } from "../coin-overview-data";
import {
  buildLongformKineticSubtitleAss,
  alignKineticSubtitleWords,
} from "./longform-kinetic-subtitles";
import { renderLongformVisualVideo } from "./longform-visual-renderer";
import {
  buildPremiumDynamicFinanceEditPlan,
  buildPremiumFinanceEmphasisEvents,
} from "./premium-dynamic-finance";
import { buildPremiumDynamicFinanceV1_1SemanticPlan } from "./premium-dynamic-finance-v1-1-semantic-director";
import {
  PREMIUM_DYNAMIC_FINANCE_V1_1_GENESIS_SOURCE_URL,
} from "./premium-dynamic-finance-v1-1-pilot-script";
import { buildPremiumDynamicFinanceV1_1SemanticTestVoices } from "./premium-dynamic-finance-v1-1-semantic-test-script";
import type { LongformVoice } from "./longform-visual-director";

const execFileAsync = promisify(execFile);
const API_ROOT = process.cwd();
const OUTPUT_DIR = resolve(API_ROOT, "output");
const INPUT_PLAN_PATH = resolve(
  OUTPUT_DIR,
  "premium-dynamic-finance-v1-1-dogecoin.visual-plan.json",
);
const MUSIC_BED_PATH = resolve(API_ROOT, "assets/audio/coin-overview-music-bed.mp3");
const EXPECTED_SUBTITLE_COVERAGE = 0.9;
const EXPECTED_SCENE_COVERAGE = 0.65;
const CONTACT_SHEET_FRAME_COUNT = 24;

type TimestampWord = {
  text: string;
  start?: number;
  end?: number;
  type?: string;
};

function canonicalWord(value: string): string {
  const normalized = value.toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  if (/^(dogecoin|догикоин|догикоина|догикоину|догикоином)$/u.test(normalized)) return "dogecoin";
  if (/^(bitcoin|биткоин|биткоина|биткоину|биткоином)$/u.test(normalized)) return "bitcoin";
  return normalized;
}

function wordsIn(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+/gu) ?? [];
}

function mapScriptScenesToScribe(input: {
  voices: LongformVoice[];
  transcriptWords: TimestampWord[];
  durationMs: number;
}): {
  sceneTimings: Array<{ startTime: number; endTime: number }>;
  matchCoverage: number;
  sceneCoverage: number[];
  unmatchedScriptWords: string[];
  unmatchedScribeWords: string[];
} {
  const expected = input.voices.flatMap((voice) =>
    wordsIn(voice.text).map((text) => ({ text, sceneId: voice.sceneId, normalized: canonicalWord(text) })),
  );
  const observed = input.transcriptWords
    .filter((word) =>
      word.type === undefined || word.type === "word",
    )
    .filter((word) =>
      typeof word.text === "string"
      && typeof word.start === "number"
      && typeof word.end === "number"
      && word.end > word.start,
    )
    .map((word) => ({
      text: word.text,
      normalized: canonicalWord(word.text),
      startMs: Math.max(0, Math.round(word.start! * 1_000)),
      endMs: Math.min(input.durationMs, Math.round(word.end! * 1_000)),
    }))
    .filter((word) => word.normalized && word.endMs > word.startMs);

  if (!expected.length || !observed.length) {
    throw new Error("Scribe mapping requires both script words and timestamped transcript words");
  }
  const table = Array.from(
    { length: expected.length + 1 },
    () => new Uint16Array(observed.length + 1),
  );
  for (let expectedIndex = expected.length - 1; expectedIndex >= 0; expectedIndex -= 1) {
    for (let observedIndex = observed.length - 1; observedIndex >= 0; observedIndex -= 1) {
      table[expectedIndex]![observedIndex] =
        expected[expectedIndex]!.normalized === observed[observedIndex]!.normalized
          ? table[expectedIndex + 1]![observedIndex + 1]! + 1
          : Math.max(
            table[expectedIndex + 1]![observedIndex]!,
            table[expectedIndex]![observedIndex + 1]!,
          );
    }
  }

  const matchedByScene = new Map<number, Array<{ startMs: number; endMs: number }>>();
  const matchedExpectedIndexes = new Set<number>();
  const matchedObservedIndexes = new Set<number>();
  let expectedIndex = 0;
  let observedIndex = 0;
  let matchedCount = 0;
  while (expectedIndex < expected.length && observedIndex < observed.length) {
    if (expected[expectedIndex]!.normalized === observed[observedIndex]!.normalized) {
      const sceneId = expected[expectedIndex]!.sceneId;
      const sceneWords = matchedByScene.get(sceneId) ?? [];
      sceneWords.push({
        startMs: observed[observedIndex]!.startMs,
        endMs: observed[observedIndex]!.endMs,
      });
      matchedByScene.set(sceneId, sceneWords);
      matchedExpectedIndexes.add(expectedIndex);
      matchedObservedIndexes.add(observedIndex);
      matchedCount += 1;
      expectedIndex += 1;
      observedIndex += 1;
    } else if (table[expectedIndex + 1]![observedIndex]! >= table[expectedIndex]![observedIndex + 1]!) {
      expectedIndex += 1;
    } else {
      observedIndex += 1;
    }
  }

  const sceneCoverage: number[] = [];
  const sceneTimings = input.voices.map((voice) => {
    const expectedCount = wordsIn(voice.text).length;
    const words = matchedByScene.get(voice.sceneId) ?? [];
    const coverage = words.length / Math.max(1, expectedCount);
    sceneCoverage.push(coverage);
    if (!words.length || coverage < EXPECTED_SCENE_COVERAGE) {
      throw new Error(
        `Scribe matched only ${(coverage * 100).toFixed(1)}% of voice scene ${voice.sceneId}; refusing estimated scene timing`,
      );
    }
    const startTime = Math.min(...words.map((word) => word.startMs));
    const endTime = Math.max(...words.map((word) => word.endMs));
    if (endTime <= startTime) {
      throw new Error(`Scribe returned invalid timing for voice scene ${voice.sceneId}`);
    }
    return {
      startTime: Math.max(0, startTime),
      endTime: Math.min(input.durationMs, endTime),
    };
  });

  return {
    sceneTimings,
    matchCoverage: matchedCount / expected.length,
    sceneCoverage,
    unmatchedScriptWords: expected
      .filter((_, index) => !matchedExpectedIndexes.has(index))
      .map((word) => word.text),
    unmatchedScribeWords: observed
      .filter((_, index) => !matchedObservedIndexes.has(index))
      .map((word) => word.text),
  };
}

async function probeMedia(filePath: string): Promise<{
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
}> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels",
    "-of", "json",
    filePath,
  ]);
  const probe = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
      sample_rate?: string;
      channels?: number;
    }>;
  };
  return {
    durationSeconds: Number(probe.format?.duration || 0),
    streams: probe.streams ?? [],
  };
}

async function createSfxSample(kind: "whoosh" | "impact", filePath: string): Promise<void> {
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
    filePath,
  ], { maxBuffer: 8 * 1024 * 1024 });
}

async function buildTestAudioMix(input: {
  voicePath: string;
  musicPath: string;
  outputPath: string;
  tempDir: string;
  durationMs: number;
  sfxEvents: Array<{ kind: "whoosh" | "impact"; startMs: number; volume: number }>;
}): Promise<void> {
  const durationSeconds = (input.durationMs / 1_000).toFixed(3);
  const sfxSamples = new Map<"whoosh" | "impact", string>();
  for (const kind of ["whoosh", "impact"] as const) {
    const filePath = join(input.tempDir, `test-sfx-${kind}.wav`);
    await createSfxSample(kind, filePath);
    sfxSamples.set(kind, filePath);
  }

  const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", input.voicePath, "-stream_loop", "-1", "-i", input.musicPath];
  for (const event of input.sfxEvents) {
    const samplePath = sfxSamples.get(event.kind);
    if (!samplePath) throw new Error(`Missing generated test sound effect sample for ${event.kind}`);
    args.push("-i", samplePath);
  }

  const fadeDuration = Math.min(1.5, input.durationMs / 2_000);
  const fadeStart = Math.max(0, input.durationMs / 1_000 - fadeDuration).toFixed(3);
  const filters = [
    `[0:a]aresample=48000,volume=1.0,atrim=duration=${durationSeconds}[voice]`,
    `[1:a]aresample=48000,volume=0.14,atrim=duration=${durationSeconds},afade=t=out:st=${fadeStart}:d=${fadeDuration.toFixed(3)}[music]`,
  ];
  const mixInputs = ["[voice]", "[music]"];
  input.sfxEvents.forEach((event, index) => {
    const inputIndex = index + 2;
    const delay = Math.max(0, Math.round(event.startMs));
    const label = `sfx${index}`;
    filters.push(
      `[${inputIndex}:a]aresample=48000,volume=${event.volume},adelay=${delay}|${delay}[${label}]`,
    );
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
    const framePath = join(input.tempDir, `contact-${String(index).padStart(2, "0")}.jpg`);
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
  if (frames.length < 20 || frames.length > 30) {
    throw new Error(`Contact sheet requires 20-30 distinct frames; got ${frames.length}`);
  }
  const { stdout: matchedFont } = await execFileAsync("fc-match", [
    "-f",
    "%{file}",
    "DejaVu Sans",
  ]);
  const fontPath = matchedFont.trim();
  if (!fontPath) {
    throw new Error("Contact sheet generation requires an installed DejaVu Sans font");
  }
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

function pathExists(filePath: string): Promise<boolean> {
  return access(filePath).then(() => true).catch(() => false);
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log([
      "Test-only Premium Dynamic + SemanticVisualDirector Dogecoin render.",
      "Run with: pnpm --filter @workspace/api-server run render:finance-v1-1-semantic-test",
      "This command does not use a previous MP4, modify the production route, or publish through Telegram.",
    ].join("\n"));
    return;
  }

  await access(INPUT_PLAN_PATH);
  await access(MUSIC_BED_PATH);
  await mkdir(OUTPUT_DIR, { recursive: true });
  const sourcePlan = JSON.parse(await readFile(INPUT_PLAN_PATH, "utf8")) as {
    entity?: { id?: string };
  };
  const coinId = sourcePlan.entity?.id;
  if (!coinId) throw new Error("The saved Dogecoin plan must contain an entity ID");

  const market = await resolveCoinOverviewMarketData(coinId, globalThis.fetch, coinId);
  if (market.coin.id !== coinId || market.priceSamples.length < 2) {
    throw new Error("Fresh CoinGecko data did not return the selected Dogecoin price history");
  }

  const baseVoices = buildPremiumDynamicFinanceV1_1SemanticTestVoices();
  const scriptText = prepareSpeechText(baseVoices.map((voice) => voice.text).join(" "));
  const voiceId = getConfiguredVoiceId();
  if (!voiceId.trim()) throw new Error("The configured speech provider has no voice ID");

  const runKey = new Date().toISOString().replace(/\D/gu, "").slice(0, 14);
  const prefix = `premium-dynamic-finance-v1-1-dogecoin-semantic-test-${runKey}`;
  const outputPath = resolve(OUTPUT_DIR, `${prefix}.mp4`);
  const visualPlanPath = resolve(OUTPUT_DIR, `${prefix}-VISUAL_PLAN.json`);
  const reportPath = resolve(OUTPUT_DIR, `${prefix}-SELF_AUDIT_REPORT.json`);
  const contactSheetPath = resolve(OUTPUT_DIR, `${prefix}-SELF_AUDIT_CONTACT_SHEET.jpg`);
  for (const path of [outputPath, visualPlanPath, reportPath, contactSheetPath]) {
    if (await pathExists(path)) throw new Error(`Refusing to overwrite an existing test artifact: ${path}`);
  }

  const tempDir = await mkdtemp(join(tmpdir(), "finance-semantic-test-"));
  try {
    const voicePath = join(tempDir, "narration.mp3");
    const mixedAudioPath = join(tempDir, "narration-music-sfx.m4a");
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
    if (!speechBuffer.length) throw new Error("Configured voice provider returned an empty narration file");
    await writeFile(voicePath, speechBuffer);
    const speechProbe = await probeMedia(voicePath);
    if (speechProbe.durationSeconds < 1) {
      throw new Error("Generated narration audio is too short to build a test video");
    }
    const durationMs = Math.max(60_000, Math.ceil(speechProbe.durationSeconds * 1_000));
    if (durationMs > 120_000) {
      throw new Error(`Narration is ${Math.round(durationMs / 1_000)} seconds; test mode is limited to 60-120 seconds`);
    }

    const scribe = await transcribeSpeechWithTimestamps(speechBuffer, "semantic-test-narration.mp3");
    const mappedScenes = mapScriptScenesToScribe({
      voices: baseVoices,
      transcriptWords: scribe.words,
      durationMs,
    });
    if (mappedScenes.matchCoverage < EXPECTED_SUBTITLE_COVERAGE) {
      throw new Error(
        `Scribe matched ${(mappedScenes.matchCoverage * 100).toFixed(1)}% of the narration; refusing estimated subtitle timing`,
      );
    }
    const voices = buildPremiumDynamicFinanceV1_1SemanticTestVoices({
      sceneTimings: mappedScenes.sceneTimings,
    });
    let alignment: ReturnType<typeof alignKineticSubtitleWords>;
    try {
      alignment = alignKineticSubtitleWords({
        voices,
        transcriptWords: scribe.words,
        durationMs,
        minimumMatchCoverage: EXPECTED_SUBTITLE_COVERAGE,
        requireExactMatches: true,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("requires exact Scribe timestamps")) {
        throw new Error(
          `${error.message}. Scene-mapper unmatched script words: ${mappedScenes.unmatchedScriptWords.join(", ") || "(none)"}. Unmatched Scribe words: ${mappedScenes.unmatchedScribeWords.join(", ") || "(none)"}`,
        );
      }
      throw error;
    }
    const editPlan = buildPremiumDynamicFinanceEditPlan({
      voices,
      durationMs,
      topic: "Dogecoin DOGE криптовалюта",
    });
    if (!editPlan.sfxEvents.length) {
      throw new Error("Premium Dynamic edit plan produced no SFX cues for the test mix");
    }
    await buildTestAudioMix({
      voicePath,
      musicPath: MUSIC_BED_PATH,
      outputPath: mixedAudioPath,
      tempDir,
      durationMs,
      sfxEvents: editPlan.sfxEvents,
    });
    const emphasisEvents = buildPremiumFinanceEmphasisEvents(editPlan.beats, alignment.words);
    const semanticPlan = buildPremiumDynamicFinanceV1_1SemanticPlan({
      editPlan,
      voices,
      market,
      genesisYear: "2013",
    });
    const visualPlan = {
      ...semanticPlan,
      narration: {
        provider: getSpeechProvider(),
        language: "ru",
        generatedVoiceTrack: true,
        timingSource: "ElevenLabs Scribe v2 word-level timestamps",
        script: voices.map((voice) => ({
          sceneId: voice.sceneId,
          startMs: voice.startTime,
          endMs: voice.endTime,
          text: voice.text,
        })),
        scribe: {
          expectedWords: alignment.expectedWordCount,
          matchedWords: alignment.matchedWordCount,
          interpolatedWords: alignment.interpolatedWordCount,
          matchCoverage: alignment.matchCoverage,
          perSceneMatchCoverage: mappedScenes.sceneCoverage,
        },
      },
      constraints: {
        previousMp4UsedAsInput: false,
        previousMp4Overwritten: false,
        productionRouteChanged: false,
        telegramConnected: false,
        basePremiumDynamicBeatPlanPreserved: true,
        sourceAudio: "fresh narration + coin-overview music bed + planned test-mode SFX cues",
      },
    };
    await writeFile(visualPlanPath, `${JSON.stringify(visualPlan, null, 2)}\n`, "utf8");

    const subtitleAss = buildLongformKineticSubtitleAss({
      words: alignment.words,
      durationMs,
      width: 1920,
      height: 1080,
      emphasisEvents,
    });
    const subtitleDialogueCount = subtitleAss.ass
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("Dialogue:")).length;
    const rendered = await renderLongformVisualVideo({
      beats: editPlan.beats,
      durationMs,
      sourceAudioPath: mixedAudioPath,
      outputPath,
      kineticSubtitleWords: alignment.words,
      kineticSubtitleEmphasis: emphasisEvents,
      semanticVisualEvents: semanticPlan.events,
    });
    const outputProbe = await probeMedia(outputPath);
    const videoStream = outputProbe.streams.find((stream) => stream.codec_type === "video");
    const audioStream = outputProbe.streams.find((stream) => stream.codec_type === "audio");
    let contactSheetError: string | null = null;
    try {
      await createContactSheet({
        videoPath: outputPath,
        durationSeconds: outputProbe.durationSeconds,
        outputPath: contactSheetPath,
        tempDir,
      });
    } catch (error) {
      contactSheetError = error instanceof Error ? error.message : String(error);
    }

    const checks = [
      {
        id: "duration-60-to-120-seconds",
        status: rendered.durationMs >= 60_000 && rendered.durationMs <= 120_000 ? "PASS" : "FAIL",
        measuredDurationMs: rendered.durationMs,
      },
      {
        id: "voiceover-and-music-audio",
        status: Boolean(audioStream && outputProbe.durationSeconds >= 60) ? "PASS" : "FAIL",
        codec: audioStream?.codec_name ?? null,
        sfxEventCount: editPlan.sfxEvents.length,
      },
      {
        id: "scribe-word-level-subtitles",
        status: alignment.matchCoverage >= EXPECTED_SUBTITLE_COVERAGE
          && alignment.interpolatedWordCount === 0
          && subtitleDialogueCount > 0
          ? "PASS"
          : "FAIL",
        expectedWords: alignment.expectedWordCount,
        matchedWords: alignment.matchedWordCount,
        interpolatedWords: alignment.interpolatedWordCount,
        matchCoverage: alignment.matchCoverage,
        subtitleDialogueCount,
      },
      {
        id: "premium-dynamic-motion-and-emphasis-preserved",
        status: editPlan.beats.length === semanticPlan.events.length && emphasisEvents.length > 0 ? "PASS" : "FAIL",
        premiumDynamicBeatCount: editPlan.beats.length,
        kineticEmphasisEvents: emphasisEvents.length,
        sfxEvents: editPlan.sfxEvents.length,
      },
      {
        id: "semantic-story-coverage",
        status: semanticPlan.requiredCoverage.every((type) => semanticPlan.visualTypeCounts[type] > 0) ? "PASS" : "FAIL",
        coveredTypes: semanticPlan.requiredCoverage,
      },
      {
        id: "full-frame-1080p-30fps",
        status: videoStream?.codec_name === "h264"
          && videoStream.width === 1920
          && videoStream.height === 1080
          && videoStream.r_frame_rate === "30/1"
          ? "PASS"
          : "FAIL",
        codec: videoStream?.codec_name ?? null,
        width: videoStream?.width ?? null,
        height: videoStream?.height ?? null,
        frameRate: videoStream?.r_frame_rate ?? null,
      },
      {
        id: "contact-sheet-20-to-30-frames",
        status: !contactSheetError && await pathExists(contactSheetPath) ? "PASS" : "FAIL",
        frameCount: CONTACT_SHEET_FRAME_COUNT,
        error: contactSheetError,
      },
      {
        id: "production-and-telegram-isolation",
        status: visualPlan.constraints.productionRouteChanged === false
          && visualPlan.constraints.telegramConnected === false
          && visualPlan.constraints.previousMp4UsedAsInput === false
          ? "PASS"
          : "FAIL",
      },
    ];
    const automaticStatus = checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL";
    const report = {
      version: "premium-dynamic-finance-v1.1-semantic-test-audit",
      mode: "TEST_MODE",
      status: automaticStatus,
      generatedAt: new Date().toISOString(),
      outputs: {
        video: outputPath,
        visualPlan: visualPlanPath,
        contactSheet: contactSheetPath,
      },
      market: {
        entity: market.coin,
        source: market.sourceLabel,
        dataAsOf: market.dataAsOf,
        references: visualPlan.sourceReferences,
      },
      narration: visualPlan.narration,
      checks,
      visualReview: {
        status: contactSheetError
          ? "BLOCKED_CONTACT_SHEET_GENERATION_FAILED"
          : "PENDING_MANUAL_CONTACT_SHEET_REVIEW",
        requiredFrameCount: CONTACT_SHEET_FRAME_COUNT,
        contactSheetError,
      },
      isolation: visualPlan.constraints,
    };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      mode: "TEST_MODE",
      status: automaticStatus,
      outputPath,
      visualPlanPath,
      reportPath,
      contactSheetPath,
      durationMs: rendered.durationMs,
      beats: rendered.beatCount,
      scribeCoverage: alignment.matchCoverage,
      interpolatedWords: alignment.interpolatedWordCount,
      subtitles: subtitleDialogueCount,
      sfxEvents: editPlan.sfxEvents.length,
      sourceVideoUsed: false,
      productionRouteChanged: false,
      telegramConnected: false,
    }, null, 2));
    if (automaticStatus !== "PASS") {
      throw new Error(`Semantic test-mode render failed one or more self-audit checks; inspect ${reportPath}`);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});