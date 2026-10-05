import { createHash } from "node:crypto";
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
  alignKineticSubtitleWords,
  type KineticSubtitleWord,
} from "./longform-kinetic-subtitles";
import {
  buildPremiumDynamicFinanceEditPlan,
} from "./premium-dynamic-finance";
import {
  PremiumVisualMotionEngine,
} from "./premium-dynamic-finance-v1-1-premium-visual-motion-engine";
import type {
  PremiumDynamicFinanceV1_1SemanticEvent,
} from "./premium-dynamic-finance-v1-1-semantic-director";
import {
  transcribeSpeechWithTimestamps,
} from "../audio-generation/elevenlabs-client";
import type { LongformVoice } from "./longform-visual-director";
import {
  buildPremiumFinanceV2KineticAss,
  buildPremiumFinanceV2SceneSvg,
  buildPremiumFinanceV2SceneWindows,
  getPremiumFinanceV2SceneComposition,
  mapPremiumFinanceV2Transition,
  PREMIUM_FINANCE_V2_SCENE_BRIEFS,
  type PremiumFinanceV2SceneWindow,
} from "./premium-dynamic-finance-v2-cinematic-visuals";

const execFileAsync = promisify(execFile);
const API_ROOT = process.cwd();
const OUTPUT_DIR = resolve(API_ROOT, "output");
const APPROVED_PLAN_PATH = resolve(
  OUTPUT_DIR,
  "premium-dynamic-finance-v1-1-dogecoin-semantic-test-20261004130324-VISUAL_PLAN.json",
);
const SOURCE_MP4_PATH = resolve(
  OUTPUT_DIR,
  "premium-dynamic-finance-v1-1-dogecoin-semantic-test-20261004130324.mp4",
);
const PHOTO_PATH = resolve(
  API_ROOT,
  "../../attached_assets/image_search/dogecoin-josh-wise-sonoma-2014.jpg",
);
const MUSIC_PATH = resolve(API_ROOT, "assets/audio/financial-user-music-bed.mp3");
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const TEST_SCENE_IDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const TEST_DURATION_MS = 56_960;
const SCENE_XFADE_SECONDS = 0.24;
const PHASE_XFADE_SECONDS = 0.16;
const PHASE_COUNT = 4;

type ScriptScene = {
  sceneId: number;
  startMs: number;
  endMs: number;
  text: string;
};

type MarketSnapshot = Record<string, unknown> & {
  dataAsOf: string;
  sourceLabel: string;
  currentPriceUsd: number;
  lowPriceUsd7d: number;
  highPriceUsd7d: number;
  changePercent7d: number;
  marketCapUsd: number;
  bitcoinChangePercent7d: number;
  priceSamples: number[];
  riseSegment: { fromIndex: number; toIndex: number; changePercent: number };
  drawdownSegment: { fromIndex: number; toIndex: number; changePercent: number };
};

type SfxEvent = {
  sceneId: number;
  startMs: number;
  kind: "impact" | "whoosh";
  query: string;
  volume: number;
};

type ApprovedPlan = {
  version: string;
  mode: string;
  entity: { id: string; name: string; symbol: string };
  dataAsOf: string;
  durationMs: number;
  sourceReferences: Array<{ label: string; url: string }>;
  baseEditPlan: { beatCount: number; sfxEvents: SfxEvent[] };
  narration: { script: ScriptScene[] };
  events: PremiumDynamicFinanceV1_1SemanticEvent[];
};

type MediaProbe = {
  durationSeconds: number;
  streams: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    channels?: number;
  }>;
};

type V2MotionTreatment = {
  backgroundScale: number;
  midgroundScale: number;
  foregroundScale: number;
  backgroundDrift: number;
  midgroundDrift: number;
  foregroundDrift: number;
  filters: string[];
};

type V2VisualPlan = {
  version: "PREMIUM_DYNAMIC_FINANCE_V2_CINEMATIC";
  mode: "TEST_MODE";
  planId: string;
  createdAt: string;
  entity: { id: string; name: string; symbol: string };
  durationMs: number;
  dimensions: { width: number; height: number; fps: number };
  approvedSourcePlan: string;
  approvedSourcePlanSha256: string;
  sourceVideo: {
    file: string;
    sha256: string;
    sourceAudioOnly: true;
    sourceVideoFramesUsed: false;
  };
  dataAsOf: string;
  dataSource: string;
  factualMarketSnapshot: MarketSnapshot;
  subtitleAlignment: {
    provider: "ElevenLabs Scribe";
    exactWordMatchesRequired: true;
    expectedWordCount: number;
    matchedWordCount: number;
    interpolatedWordCount: number;
    matchCoverage: number;
    words: KineticSubtitleWord[];
  };
  soundtrack: {
    source: string;
    voiceTrack: "Original source MP4 audio stream, trimmed without TTS regeneration";
    musicLevel: number;
    sfxPolicy: string;
  };
  sourceMedia: {
    file: string;
    title: string;
    sourcePage: string;
    author: string;
    license: string;
    licenseUrl: string;
    visibleAttribution: string;
    sha256: string;
  };
  selectedSceneIds: number[];
  scenes: Array<{
    sceneId: number;
    startMs: number;
    endMs: number;
    durationMs: number;
    narration: string;
    semanticType: string;
    treatment: string;
    focalRect: { x: number; y: number; width: number; height: number };
    subtitleSafeRect: {
      x: number;
      y: number;
      width: number;
      height: number;
      placement: string;
    };
    heroMoment: boolean;
    camera: {
      backgroundScale: number;
      midgroundScale: number;
      foregroundScale: number;
      backgroundDrift: number;
      midgroundDrift: number;
      foregroundDrift: number;
      appliedFilterNames: string[];
    };
    transitionIn: string;
    transitionOut: string;
    sfxEvents: SfxEvent[];
    sourceLabels: string[];
  }>;
};

function sha256(buffer: Buffer | string): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function timestampForDay(): string {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function prefixForDay(): string {
  return `premium-dynamic-finance-v2-cinematic-dogecoin-test-${timestampForDay()}-r3`;
}

async function probeMedia(filePath: string): Promise<MediaProbe> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,channels",
    "-of", "json",
    filePath,
  ]);
  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: MediaProbe["streams"];
  };
  return {
    durationSeconds: Number(parsed.format?.duration ?? 0),
    streams: parsed.streams ?? [],
  };
}

async function getFontPath(): Promise<string> {
  const { stdout } = await execFileAsync("fc-match", ["-f", "%{file}", "DejaVu Sans"]);
  const fontPath = stdout.trim();
  if (!fontPath) throw new Error("Could not resolve DejaVu Sans for the cinematic renderer");
  await access(fontPath);
  return fontPath;
}

function validateApprovedPlan(plan: ApprovedPlan): void {
  const expectedTypes = [
    "genesis-history",
    "price-history",
    "measured-rise",
    "measured-drawdown",
    "market-cap",
    "bitcoin-comparison",
    "media-noise",
    "community",
  ];
  if (
    plan.mode !== "TEST_MODE"
    || plan.dataAsOf !== "2026-10-04T13:01:20.000Z"
    || plan.durationMs !== 70_860
    || plan.events.length !== 50
    || plan.baseEditPlan.beatCount !== 50
  ) {
    throw new Error("V2 requires the approved 70.86-second Dogecoin semantic source plan");
  }
  const market = plan.events[0]?.market;
  const expectedSamples = [
    0.09808782150688386,
    0.0943272409370802,
    0.09401055808900624,
    0.09450892695084427,
    0.09674387652083344,
    0.09252775178712423,
    0.09339743439911617,
  ];
  if (
    !market
    || market.dataAsOf !== "2026-10-04T13:01:20.000Z"
    || market.currentPriceUsd !== 0.093414
    || market.lowPriceUsd7d !== 0.09106128548394973
    || market.highPriceUsd7d !== 0.09808782150688386
    || market.changePercent7d !== -4.764935580260444
    || market.marketCapUsd !== 14_589_808_762
    || market.bitcoinChangePercent7d !== 0.2886
    || !Array.isArray(market.priceSamples)
    || market.priceSamples.length !== expectedSamples.length
    || market.priceSamples.some((value, index) => value !== expectedSamples[index])
    || market.riseSegment?.changePercent !== 2.9074589997001965
    || market.drawdownSegment?.changePercent !== -5.668460808225229
  ) {
    throw new Error("V2 source plan does not contain the approved, unrefreshed Dogecoin market snapshot");
  }
  for (let index = 0; index < expectedTypes.length; index += 1) {
    const event = plan.events.find((candidate) => candidate.sceneId === index + 1);
    if (!event || event.semanticType !== expectedTypes[index]) {
      throw new Error(`Approved source plan has an unexpected semantic scene at ${index + 1}`);
    }
  }
  const finalSelectedScene = plan.narration.script.find((scene) => scene.sceneId === 8);
  if (!finalSelectedScene || finalSelectedScene.endMs !== TEST_DURATION_MS) {
    throw new Error("V2 source crop no longer ends at the approved end of scene 8");
  }
}

function buildVoices(scenes: ScriptScene[]): LongformVoice[] {
  return scenes.map((scene) => ({
    sceneId: scene.sceneId,
    text: scene.text,
    startTime: scene.startMs,
    endTime: scene.endMs,
  }));
}

function buildSceneWindows(plan: ApprovedPlan): PremiumFinanceV2SceneWindow[] {
  const scenes = plan.narration.script
    .filter((scene) => TEST_SCENE_IDS.includes(scene.sceneId as typeof TEST_SCENE_IDS[number]))
    .map((scene) => ({
      ...scene,
      semanticType: plan.events.find((event) => event.sceneId === scene.sceneId)!.semanticType,
    }));
  return buildPremiumFinanceV2SceneWindows(scenes, [...TEST_SCENE_IDS], TEST_DURATION_MS);
}

function assertSceneLayout(scene: V2VisualPlan["scenes"][number]): void {
  const focal = scene.focalRect;
  const safe = scene.subtitleSafeRect;
  const intersects = focal.x < safe.x + safe.width
    && safe.x < focal.x + focal.width
    && focal.y < safe.y + safe.height
    && safe.y < focal.y + focal.height;
  if (intersects) {
    throw new Error(`Scene ${scene.sceneId} subtitle safe zone overlaps the primary focal subject`);
  }
}

function emphasisWordsByScene(
  beats: ReturnType<typeof buildPremiumDynamicFinanceEditPlan>["beats"],
): Record<number, string[]> {
  const output: Record<number, string[]> = {};
  for (const beat of beats) {
    if (beat.sceneId > 8 || beat.intensity === "restrained" || !beat.emphasisWord) continue;
    const words = output[beat.sceneId] ?? [];
    if (!words.some((word) => word.toLocaleLowerCase("ru-RU") === beat.emphasisWord!.toLocaleLowerCase("ru-RU"))) {
      words.push(beat.emphasisWord);
      output[beat.sceneId] = words;
    }
  }
  return output;
}

async function transcribeApprovedAudio(tempDir: string, prefix: string): Promise<{
  transcriptionWords: Array<{ text: string; start?: number; end?: number; type?: string }>;
  sourceAudioPath: string;
}> {
  const extractedAudioPath = join(tempDir, "dogecoin-source-audio.m4a");
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-n",
    "-i", SOURCE_MP4_PATH,
    "-map", "0:a:0", "-vn", "-c:a", "copy",
    "-movflags", "+faststart",
    extractedAudioPath,
  ], { maxBuffer: 8 * 1024 * 1024 });
  const transcriptionMp3Path = join(tempDir, "dogecoin-source-audio-for-scribe.mp3");
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-n",
    "-i", extractedAudioPath,
    "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "48000",
    "-c:a", "libmp3lame", "-q:a", "2",
    transcriptionMp3Path,
  ], { maxBuffer: 8 * 1024 * 1024 });
  const transcript = await transcribeSpeechWithTimestamps(
    await readFile(transcriptionMp3Path),
    `${prefix}-source-audio-analysis.mp3`,
  );
  return {
    transcriptionWords: transcript.words,
    sourceAudioPath: extractedAudioPath,
  };
}

async function buildVisualPlan(input: {
  plan: ApprovedPlan;
  planText: string;
  prefix: string;
  sourceHash: string;
  photoHash: string;
  subtitleWords: KineticSubtitleWord[];
  expectedWordCount: number;
  matchedWordCount: number;
  interpolatedWordCount: number;
  matchCoverage: number;
  motionEngine: PremiumVisualMotionEngine;
  editPlan: ReturnType<typeof buildPremiumDynamicFinanceEditPlan>;
}): Promise<V2VisualPlan> {
  const sceneWindows = buildSceneWindows(input.plan);
  const market = input.plan.events[0]!.market as unknown as MarketSnapshot;
  const scenePlan = sceneWindows.map((window) => {
    const beatIndexes = input.editPlan.beats
      .map((beat, index) => ({ beat, index }))
      .filter(({ beat }) => beat.sceneId === window.sceneId);
    const firstBeat = beatIndexes[0]?.beat;
    const finalBeat = beatIndexes.at(-1)?.beat;
    if (!firstBeat || !finalBeat) throw new Error(`No Premium Dynamic edit beats for scene ${window.sceneId}`);
    const firstEvent = input.plan.events.find((event) => event.beatIndex === firstBeat.index);
    if (!firstEvent) throw new Error(`No saved semantic event for scene ${window.sceneId}`);
    const treatment = input.motionEngine.getTreatment({
      beat: firstBeat,
      event: firstEvent,
      durationSeconds: (window.endMs - window.startMs) / 1_000,
    }) as V2MotionTreatment;
    const brief = getPremiumFinanceV2SceneComposition(window.sceneId);
    const sceneSfx = input.editPlan.sfxEvents.filter((event) =>
      event.sceneId === window.sceneId && event.startMs < TEST_DURATION_MS,
    );
    const scene = {
      sceneId: window.sceneId,
      startMs: window.startMs,
      endMs: window.endMs,
      durationMs: window.endMs - window.startMs,
      narration: window.narration,
      semanticType: window.semanticType,
      treatment: brief.treatment,
      focalRect: brief.focalRect,
      subtitleSafeRect: brief.safeRect,
      heroMoment: brief.heroMoment,
      camera: {
        backgroundScale: treatment.backgroundScale,
        midgroundScale: treatment.midgroundScale,
        foregroundScale: treatment.foregroundScale,
        backgroundDrift: treatment.backgroundDrift,
        midgroundDrift: treatment.midgroundDrift,
        foregroundDrift: treatment.foregroundDrift,
        appliedFilterNames: treatment.filters
          .filter((filter) => !filter.startsWith("drawtext="))
          .map((filter) => filter.split("=")[0]!),
      },
      transitionIn: window.sceneId === 1 ? "fade-in" : firstBeat.transition,
      transitionOut: finalBeat.transition,
      sfxEvents: sceneSfx,
      sourceLabels: brief.sourceLabels,
    };
    assertSceneLayout(scene);
    return scene;
  });
  const subtitle = {
    provider: "ElevenLabs Scribe" as const,
    exactWordMatchesRequired: true as const,
    expectedWordCount: input.expectedWordCount,
    matchedWordCount: input.matchedWordCount,
    interpolatedWordCount: input.interpolatedWordCount,
    matchCoverage: input.matchCoverage,
    words: input.subtitleWords,
  };
  const sourceMedia = {
    file: "attached_assets/image_search/dogecoin-josh-wise-sonoma-2014.jpg",
    title: "Josh Wise's No. 98 Dogecoin Chevrolet at Sonoma Raceway in 2014",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Josh_Wise_Sonoma_2014.jpg",
    author: "TaurusEmerald",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    visibleAttribution: "Wikimedia Commons · TaurusEmerald · CC BY-SA 4.0",
    sha256: input.photoHash,
  };
  const visualPlan: V2VisualPlan = {
    version: "PREMIUM_DYNAMIC_FINANCE_V2_CINEMATIC",
    mode: "TEST_MODE",
    planId: input.prefix,
    createdAt: new Date().toISOString(),
    entity: input.plan.entity,
    durationMs: TEST_DURATION_MS,
    dimensions: { width: WIDTH, height: HEIGHT, fps: FPS },
    approvedSourcePlan: APPROVED_PLAN_PATH.replace(`${API_ROOT}/`, ""),
    approvedSourcePlanSha256: sha256(input.planText),
    sourceVideo: {
      file: SOURCE_MP4_PATH.replace(`${API_ROOT}/`, ""),
      sha256: input.sourceHash,
      sourceAudioOnly: true,
      sourceVideoFramesUsed: false,
    },
    dataAsOf: input.plan.dataAsOf,
    dataSource: market.sourceLabel,
    factualMarketSnapshot: market,
    subtitleAlignment: subtitle,
    soundtrack: {
      source: MUSIC_PATH.replace(`${API_ROOT}/`, ""),
      voiceTrack: "Original source MP4 audio stream, trimmed without TTS regeneration",
      musicLevel: 0.16,
      sfxPolicy: "Four restrained, procedural impact/whoosh cues from the existing Premium Dynamic edit plan; no external sound effects.",
    },
    sourceMedia,
    selectedSceneIds: [...TEST_SCENE_IDS],
    scenes: scenePlan,
  };
  if (visualPlan.scenes.length !== TEST_SCENE_IDS.length) {
    throw new Error("V2 visual plan must contain exactly the eight approved scenes");
  }
  return visualPlan;
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPlanHtml(plan: V2VisualPlan): string {
  const scenes = plan.scenes.map((scene) => `
    <article class="scene ${scene.heroMoment ? "hero" : ""}">
      <div class="scene-head"><span>SCENE ${String(scene.sceneId).padStart(2, "0")}</span><time>${(scene.startMs / 1000).toFixed(2)}–${(scene.endMs / 1000).toFixed(2)}s</time></div>
      <h2>${htmlEscape(PREMIUM_FINANCE_V2_SCENE_BRIEFS[scene.sceneId]!.title)}</h2>
      <p>${htmlEscape(scene.treatment)}</p>
      <blockquote>${htmlEscape(scene.narration)}</blockquote>
      <div class="meta"><span>Focal object ${scene.focalRect.width}×${scene.focalRect.height}</span><span>Subtitle safe zone: ${htmlEscape(scene.subtitleSafeRect.placement)}</span><span>Transition: ${htmlEscape(scene.transitionIn)}</span></div>
      <div class="source">${scene.sourceLabels.map(htmlEscape).join(" · ")}</div>
    </article>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dogecoin V2 Cinematic Visual Plan</title>
<style>
:root{color-scheme:dark;--bg:#080d13;--panel:#111b24;--line:#263944;--muted:#a8b5bf;--ink:#f6f4ed;--gold:#f3b74c;--mint:#72e4be}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 20% 0%,#1a2b37 0,#080d13 52%);color:var(--ink);font:16px/1.55 Inter,Arial,sans-serif}
main{max-width:1120px;margin:0 auto;padding:48px 24px 80px}header{border-bottom:1px solid var(--line);padding:0 0 28px;margin-bottom:28px}
.eyebrow{font:700 12px/1.2 Arial,sans-serif;letter-spacing:.22em;color:var(--gold)}h1{font-size:clamp(30px,5vw,54px);line-height:1.02;margin:15px 0 12px}
.summary{max-width:850px;color:var(--muted)}.facts{display:flex;flex-wrap:wrap;gap:9px;margin-top:22px}.facts span{padding:7px 11px;border:1px solid var(--line);border-radius:999px;color:#d1d9de;font-size:12px}
.scene{margin:14px 0;padding:22px 24px;background:linear-gradient(140deg,#14202a,#0f171f);border:1px solid var(--line);border-radius:14px}
.scene.hero{border-color:#8f6c34;background:linear-gradient(140deg,#242319,#111920)}.scene-head{display:flex;justify-content:space-between;color:var(--gold);font:700 12px Arial,sans-serif;letter-spacing:.14em}
h2{font-size:23px;margin:12px 0 8px}.scene p{color:#d5dde1;margin:0 0 12px}.scene blockquote{margin:12px 0;color:#bfcbd0;border-left:2px solid #667d89;padding:4px 0 4px 15px}
.meta{display:flex;flex-wrap:wrap;gap:8px 18px;color:var(--muted);font-size:12px}.source{margin-top:13px;color:var(--mint);font-size:12px}
.note{border-top:1px solid var(--line);padding-top:22px;margin-top:28px;color:var(--muted);font-size:13px}a{color:var(--mint)}
@media(max-width:640px){main{padding:28px 14px 48px}.scene{padding:18px 16px}}
</style></head><body><main>
<header><div class="eyebrow">ISOLATED TEST · NO TELEGRAM OR PRODUCTION ROUTING</div>
<h1>Dogecoin — cinematic test plan</h1>
<p class="summary">Eight sourced and time-aligned scenes from the approved narration. The first eight scenes end at 56.96 seconds. This is a scene-led documentary composition, not a repeated dashboard layout.</p>
<div class="facts"><span>56.96 seconds</span><span>1920×1080 · 30 fps</span><span>CoinGecko snapshot: ${htmlEscape(plan.dataAsOf)}</span><span>Exact Scribe word timing: ${plan.subtitleAlignment.matchedWordCount}/${plan.subtitleAlignment.expectedWordCount}</span></div></header>
${scenes}
<div class="note">Voice: the existing approved MP4 audio only; no TTS regeneration. The 2014 Dogecoin Chevrolet photograph is attributed in-scene and in the JSON plan. Sound: existing finance music bed plus restrained procedural SFX. Source video frames are not reused.</div>
</main></body></html>`;
}

async function planOnly(): Promise<void> {
  await Promise.all([access(APPROVED_PLAN_PATH), access(SOURCE_MP4_PATH), access(PHOTO_PATH), access(MUSIC_PATH)]);
  await mkdir(OUTPUT_DIR, { recursive: true });
  const prefix = prefixForDay();
  const visualPlanPath = join(OUTPUT_DIR, `${prefix}-VISUAL_PLAN.json`);
  const visualPlanHtmlPath = join(OUTPUT_DIR, `${prefix}-VISUAL_PLAN.html`);
  for (const path of [visualPlanPath, visualPlanHtmlPath]) {
    if (await pathExists(path)) throw new Error(`Refusing to overwrite existing V2 plan: ${path}`);
  }

  const approvedPlanText = await readFile(APPROVED_PLAN_PATH, "utf8");
  const approvedPlan = JSON.parse(approvedPlanText) as ApprovedPlan;
  validateApprovedPlan(approvedPlan);
  const sourceProbe = await probeMedia(SOURCE_MP4_PATH);
  const video = sourceProbe.streams.find((stream) => stream.codec_type === "video");
  const audio = sourceProbe.streams.find((stream) => stream.codec_type === "audio");
  if (
    sourceProbe.durationSeconds < 70
    || sourceProbe.durationSeconds > 72
    || video?.codec_name !== "h264"
    || video.width !== WIDTH
    || video.height !== HEIGHT
    || video.r_frame_rate !== `${FPS}/1`
    || audio?.codec_name !== "aac"
  ) {
    throw new Error("Approved source MP4 does not match the expected 70-second H.264/AAC narration source");
  }
  const sourceHash = sha256(await readFile(SOURCE_MP4_PATH));
  const photoBytes = await readFile(PHOTO_PATH);
  const photoHash = sha256(photoBytes);
  const tempDir = await mkdtemp(join(tmpdir(), "premium-finance-v2-plan-"));
  try {
    const { transcriptionWords } = await transcribeApprovedAudio(tempDir, prefix);
    const selectedScripts = approvedPlan.narration.script.filter((scene) =>
      TEST_SCENE_IDS.includes(scene.sceneId as typeof TEST_SCENE_IDS[number]),
    );
    const voices = buildVoices(selectedScripts);
    const alignment = alignKineticSubtitleWords({
      voices: voices.map((voice) => ({
        sceneId: voice.sceneId,
        text: voice.text,
        startTime: voice.startTime,
        endTime: voice.endTime,
      })),
      transcriptWords: transcriptionWords,
      durationMs: TEST_DURATION_MS,
      minimumMatchCoverage: 0.9,
      requireExactMatches: true,
    });
    if (
      alignment.matchCoverage < 0.9
      || alignment.interpolatedWordCount !== 0
      || alignment.matchedWordCount !== alignment.expectedWordCount
    ) {
      throw new Error(
        `Strict Scribe alignment failed: ${alignment.matchedWordCount}/${alignment.expectedWordCount}, interpolated=${alignment.interpolatedWordCount}`,
      );
    }

    const fullVoices = buildVoices(approvedPlan.narration.script);
    const editPlan = buildPremiumDynamicFinanceEditPlan({
      voices: fullVoices,
      durationMs: approvedPlan.durationMs,
      topic: "Dogecoin",
    });
    if (editPlan.beats.length !== approvedPlan.events.length) {
      throw new Error("Premium Dynamic V2 edit plan no longer aligns with the approved semantic plan");
    }
    editPlan.beats.forEach((beat, index) => {
      const event = approvedPlan.events[index]!;
      if (beat.index !== event.beatIndex || beat.sceneId !== event.sceneId || beat.startMs !== event.startMs || beat.endMs !== event.endMs) {
        throw new Error(`Premium Dynamic beat ${beat.index} diverges from the approved semantic event`);
      }
    });
    const fontPath = await getFontPath();
    const motionEngine = new PremiumVisualMotionEngine({
      events: approvedPlan.events,
      beats: editPlan.beats,
      subtitleWords: alignment.words,
      fontPath,
    });
    const visualPlan = await buildVisualPlan({
      plan: approvedPlan,
      planText: approvedPlanText,
      prefix,
      sourceHash,
      photoHash,
      subtitleWords: alignment.words,
      expectedWordCount: alignment.expectedWordCount,
      matchedWordCount: alignment.matchedWordCount,
      interpolatedWordCount: alignment.interpolatedWordCount,
      matchCoverage: alignment.matchCoverage,
      motionEngine,
      editPlan,
    });
    await writeFile(visualPlanPath, `${JSON.stringify(visualPlan, null, 2)}\n`, "utf8");
    await writeFile(visualPlanHtmlPath, renderPlanHtml(visualPlan), "utf8");
    await writeFile(
      resolve(API_ROOT, "../../attached_assets/image_search/dogecoin-v2-media-sources.json"),
      `${JSON.stringify({
        sources: [{
          file: "attached_assets/image_search/dogecoin-josh-wise-sonoma-2014.jpg",
          title: "Josh Wise's No. 98 Dogecoin Chevrolet at Sonoma Raceway in 2014",
          sourcePage: "https://commons.wikimedia.org/wiki/File:Josh_Wise_Sonoma_2014.jpg",
          author: "TaurusEmerald",
          license: "CC BY-SA 4.0",
          licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
          visibleAttribution: "Wikimedia Commons · TaurusEmerald · CC BY-SA 4.0",
          sha256: photoHash,
        }],
      }, null, 2)}\n`,
      "utf8",
    );
    console.log(JSON.stringify({
      render: "premium-dynamic-finance-v2-cinematic-test",
      mode: "TEST_MODE",
      status: "visual-plan-created",
      visualPlanPath,
      visualPlanHtmlPath,
      durationMs: visualPlan.durationMs,
      scenes: visualPlan.scenes.length,
      scribeWordCoverage: alignment.matchCoverage,
      matchedWords: alignment.matchedWordCount,
      interpolatedWords: alignment.interpolatedWordCount,
      telegramConnected: false,
      productionRouteChanged: false,
    }, null, 2));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function transitionForScene(value: string): string {
  return mapPremiumFinanceV2Transition(value);
}

async function renderSceneClip(input: {
  scene: V2VisualPlan["scenes"][number];
  window: PremiumFinanceV2SceneWindow;
  market: MarketSnapshot;
  dataAsOf: string;
  photoDataUri: string;
  treatment: V2MotionTreatment;
  tempDir: string;
  sceneIndex: number;
}): Promise<{ path: string; durationSeconds: number }> {
  const framePaths: string[] = [];
  const extraSeconds = input.sceneIndex < TEST_SCENE_IDS.length - 1 ? SCENE_XFADE_SECONDS : 0;
  const sceneSeconds = (input.scene.endMs - input.scene.startMs) / 1_000 + extraSeconds;
  const frameCrossfade = PHASE_XFADE_SECONDS;
  const phaseSeconds = (sceneSeconds + (PHASE_COUNT - 1) * frameCrossfade) / PHASE_COUNT;
  for (let phaseIndex = 0; phaseIndex < PHASE_COUNT; phaseIndex += 1) {
    const phase = phaseIndex / (PHASE_COUNT - 1);
    const svgPath = join(input.tempDir, `scene-${input.scene.sceneId}-phase-${phaseIndex}.svg`);
    const pngPath = join(input.tempDir, `scene-${input.scene.sceneId}-phase-${phaseIndex}.png`);
    await writeFile(svgPath, buildPremiumFinanceV2SceneSvg({
      sceneId: input.scene.sceneId,
      phase,
      market: input.market,
      dataAsOf: input.dataAsOf,
      photoDataUri: input.photoDataUri,
      motion: input.treatment,
    }), "utf8");
    await execFileAsync("magick", [
      "-background", "#05080C",
      "-density", "96",
      svgPath,
      "-resize", `${WIDTH}x${HEIGHT}!`,
      "-alpha", "remove",
      pngPath,
    ], { maxBuffer: 16 * 1024 * 1024 });
    framePaths.push(pngPath);
  }

  const args: string[] = ["-hide_banner", "-loglevel", "error", "-y"];
  for (const framePath of framePaths) {
    args.push(
      "-loop", "1",
      "-framerate", String(FPS),
      "-t", phaseSeconds.toFixed(6),
      "-i", framePath,
    );
  }
  const filters: string[] = [];
  for (let index = 0; index < framePaths.length; index += 1) {
    const zoomEnd = Math.max(1.012, Math.min(1.045, input.treatment.midgroundScale));
    filters.push(
      `[${index}:v]zoompan=z='min(zoom+0.00012,${zoomEnd.toFixed(4)})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${WIDTH}x${HEIGHT}:fps=${FPS},trim=duration=${phaseSeconds.toFixed(6)},setpts=PTS-STARTPTS,settb=expr=1/${FPS},setsar=1,format=yuv420p[v${index}]`,
    );
  }
  let previous = "v0";
  for (let index = 1; index < framePaths.length; index += 1) {
    const output = index === framePaths.length - 1 ? "scenevisual" : `phasefade${index}`;
    const offset = index * (phaseSeconds - frameCrossfade);
    filters.push(
      `[${previous}][v${index}]xfade=transition=fade:duration=${frameCrossfade.toFixed(3)}:offset=${offset.toFixed(6)}[${output}]`,
    );
    previous = output;
  }
  const safeMotionFilters = input.treatment.filters.filter((filter) => !filter.startsWith("drawtext="));
  const postFilters = [
    ...(input.sceneIndex === 0 ? ["fade=t=in:st=0:d=0.35"] : []),
    ...(input.sceneIndex === TEST_SCENE_IDS.length - 1
      ? [`fade=t=out:st=${Math.max(0, sceneSeconds - 0.42).toFixed(3)}:d=0.42`]
      : []),
    ...safeMotionFilters,
    `trim=duration=${sceneSeconds.toFixed(6)}`,
    "setpts=PTS-STARTPTS",
    "fps=30",
    "format=yuv420p",
  ];
  const clipPath = join(input.tempDir, `scene-${input.scene.sceneId}-video.mp4`);
  filters.push(`[${previous}]${postFilters.join(",")}[final]`);
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[final]",
    "-an",
    "-t", sceneSeconds.toFixed(6),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "19",
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    "-movflags", "+faststart",
    clipPath,
  );
  await execFileAsync("ffmpeg", args, { maxBuffer: 32 * 1024 * 1024 });
  return { path: clipPath, durationSeconds: sceneSeconds };
}

async function joinSceneClips(input: {
  clips: Array<{ path: string; durationSeconds: number }>;
  transitions: string[];
  outputPath: string;
}): Promise<void> {
  if (input.clips.length !== TEST_SCENE_IDS.length) {
    throw new Error("V2 cinematic join requires exactly eight rendered scene clips");
  }
  const args: string[] = ["-hide_banner", "-loglevel", "error", "-y"];
  for (const clip of input.clips) args.push("-i", clip.path);
  const filters = input.clips.map((_, index) =>
    `[${index}:v]setpts=PTS-STARTPTS,settb=expr=1/${FPS},setsar=1,format=yuv420p[v${index}]`,
  );
  let previous = "v0";
  let currentDuration = input.clips[0]!.durationSeconds;
  for (let index = 1; index < input.clips.length; index += 1) {
    const output = index === input.clips.length - 1 ? "joined" : `scenejoin${index}`;
    const transition = transitionForScene(input.transitions[index] ?? "snap-cut");
    const offset = Math.max(0, currentDuration - SCENE_XFADE_SECONDS);
    filters.push(
      `[${previous}][v${index}]xfade=transition=${transition}:duration=${SCENE_XFADE_SECONDS.toFixed(3)}:offset=${offset.toFixed(6)}[${output}]`,
    );
    previous = output;
    currentDuration += input.clips[index]!.durationSeconds - SCENE_XFADE_SECONDS;
  }
  filters.push(`[${previous}]trim=duration=${(TEST_DURATION_MS / 1_000).toFixed(3)},setpts=PTS-STARTPTS,fps=${FPS},format=yuv420p[v]`);
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[v]",
    "-an",
    "-t", (TEST_DURATION_MS / 1_000).toFixed(3),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "19",
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    "-movflags", "+faststart",
    input.outputPath,
  );
  await execFileAsync("ffmpeg", args, { maxBuffer: 48 * 1024 * 1024 });
}

function sfxFilter(event: SfxEvent, index: number): string {
  const delay = Math.max(0, Math.round(event.startMs));
  const cue = event.kind === "impact"
    ? `volume=${event.volume.toFixed(3)},lowpass=f=170,afade=t=out:st=0:d=0.48`
    : `volume=${event.volume.toFixed(3)},lowpass=f=1.9k,afade=t=out:st=0:d=0.62`;
  return `[${index}:a]aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo,${cue},adelay=${delay}|${delay}[sfx${index}]`;
}

async function mixAudioAndSubtitles(input: {
  videoOnlyPath: string;
  sourceAudioPath: string;
  musicPath: string;
  outputPath: string;
  subtitlePath: string;
  sfxEvents: SfxEvent[];
}): Promise<void> {
  const durationSeconds = TEST_DURATION_MS / 1_000;
  const args: string[] = ["-hide_banner", "-loglevel", "error", "-y", "-i", input.videoOnlyPath];
  args.push("-i", input.sourceAudioPath);
  args.push("-stream_loop", "-1", "-i", input.musicPath);
  for (const event of input.sfxEvents) {
    const source = event.kind === "impact"
      ? "aevalsrc=0.34*sin(2*PI*48*t)*exp(-8*t):s=48000:d=0.48"
      : "aevalsrc=0.18*sin(2*PI*(95+420*t)*t)*exp(-3.8*t):s=48000:d=0.62";
    args.push("-f", "lavfi", "-i", source);
  }
  const subtitleFilterPath = input.subtitlePath.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
  const filters = [
    `[0:v]ass='${subtitleFilterPath}',format=yuv420p[v]`,
    `[1:a]atrim=duration=${durationSeconds.toFixed(3)},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo,volume=1[voice]`,
    `[2:a]atrim=duration=${durationSeconds.toFixed(3)},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo,volume=0.16,afade=t=out:st=${(durationSeconds - 2.5).toFixed(3)}:d=2.5[music]`,
  ];
  const inputs = ["[voice]", "[music]"];
  input.sfxEvents.forEach((event, index) => {
    const inputIndex = index + 3;
    filters.push(sfxFilter(event, inputIndex));
    inputs.push(`[sfx${inputIndex}]`);
  });
  filters.push(
    `${inputs.join("")}amix=inputs=${inputs.length}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.96[a]`,
  );
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[v]",
    "-map", "[a]",
    "-t", durationSeconds.toFixed(3),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "19",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    input.outputPath,
  );
  await execFileAsync("ffmpeg", args, { maxBuffer: 48 * 1024 * 1024 });
}

async function makeContactSheet(input: {
  videoPath: string;
  plan: V2VisualPlan;
  outputPath: string;
  tempDir: string;
  fontPath: string;
}): Promise<void> {
  const framePaths: string[] = [];
  for (const scene of input.plan.scenes) {
    const time = (scene.startMs + Math.min(3_000, Math.floor(scene.durationMs * 0.48))) / 1_000;
    const framePath = join(input.tempDir, `contact-scene-${scene.sceneId}.jpg`);
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", time.toFixed(3),
      "-i", input.videoPath,
      "-frames:v", "1",
      "-vf", "scale=480:270",
      "-q:v", "2",
      framePath,
    ], { maxBuffer: 8 * 1024 * 1024 });
    framePaths.push(framePath);
  }
  await execFileAsync("magick", [
    "montage",
    "-font", input.fontPath,
    ...framePaths,
    "-tile", "2x4",
    "-geometry", "480x270+10+10",
    "-background", "#081019",
    input.outputPath,
  ], { maxBuffer: 16 * 1024 * 1024 });
}

function renderReport(input: {
  plan: V2VisualPlan;
  outputPath: string;
  videoProbe: MediaProbe;
  bytes: number;
  contactSheetPath: string;
}): string {
  return JSON.stringify({
    version: input.plan.version,
    mode: input.plan.mode,
    planId: input.plan.planId,
    outputPath: input.outputPath,
    contactSheetPath: input.contactSheetPath,
    bytes: input.bytes,
    durationMs: Math.round(input.videoProbe.durationSeconds * 1_000),
    video: input.videoProbe.streams.find((stream) => stream.codec_type === "video"),
    audio: input.videoProbe.streams.find((stream) => stream.codec_type === "audio"),
    sceneCount: input.plan.scenes.length,
    selectedSceneIds: input.plan.selectedSceneIds,
    subtitleAlignment: {
      expectedWordCount: input.plan.subtitleAlignment.expectedWordCount,
      matchedWordCount: input.plan.subtitleAlignment.matchedWordCount,
      interpolatedWordCount: input.plan.subtitleAlignment.interpolatedWordCount,
      matchCoverage: input.plan.subtitleAlignment.matchCoverage,
    },
    soundtrack: input.plan.soundtrack,
    sourcePhoto: input.plan.sourceMedia,
    sourceVideoFramesUsed: input.plan.sourceVideo.sourceVideoFramesUsed,
    productionRoutesChanged: false,
    telegramConnected: false,
  }, null, 2);
}

async function renderFromPlan(): Promise<void> {
  const prefix = prefixForDay();
  const visualPlanPath = join(OUTPUT_DIR, `${prefix}-VISUAL_PLAN.json`);
  const visualPlanHtmlPath = join(OUTPUT_DIR, `${prefix}-VISUAL_PLAN.html`);
  await Promise.all([
    access(visualPlanPath),
    access(visualPlanHtmlPath),
    access(APPROVED_PLAN_PATH),
    access(SOURCE_MP4_PATH),
    access(PHOTO_PATH),
    access(MUSIC_PATH),
  ]);
  const outputPath = join(OUTPUT_DIR, `${prefix}.mp4`);
  const reportPath = join(OUTPUT_DIR, `${prefix}-RENDER_REPORT.json`);
  const contactSheetPath = join(OUTPUT_DIR, `${prefix}-CONTACT_SHEET.jpg`);
  for (const path of [outputPath, reportPath, contactSheetPath]) {
    if (await pathExists(path)) throw new Error(`Refusing to overwrite existing V2 test output: ${path}`);
  }

  const [planText, approvedPlanText, sourceBuffer, photoBuffer] = await Promise.all([
    readFile(visualPlanPath, "utf8"),
    readFile(APPROVED_PLAN_PATH, "utf8"),
    readFile(SOURCE_MP4_PATH),
    readFile(PHOTO_PATH),
  ]);
  const visualPlan = JSON.parse(planText) as V2VisualPlan;
  const approvedPlan = JSON.parse(approvedPlanText) as ApprovedPlan;
  validateApprovedPlan(approvedPlan);
  if (
    visualPlan.version !== "PREMIUM_DYNAMIC_FINANCE_V2_CINEMATIC"
    || visualPlan.mode !== "TEST_MODE"
    || visualPlan.durationMs !== TEST_DURATION_MS
    || visualPlan.approvedSourcePlanSha256 !== sha256(approvedPlanText)
    || visualPlan.sourceVideo.sha256 !== sha256(sourceBuffer)
    || visualPlan.sourceMedia.sha256 !== sha256(photoBuffer)
  ) {
    throw new Error("V2 visual plan no longer matches its approved script, source audio/video, or licensed media");
  }
  const market = visualPlan.factualMarketSnapshot;
  const voices = buildVoices(approvedPlan.narration.script);
  const editPlan = buildPremiumDynamicFinanceEditPlan({
    voices,
    durationMs: approvedPlan.durationMs,
    topic: "Dogecoin",
  });
  if (editPlan.beats.length !== approvedPlan.events.length) {
    throw new Error("V2 render edit plan diverged from the approved semantic source");
  }
  editPlan.beats.forEach((beat, index) => {
    const event = approvedPlan.events[index]!;
    if (beat.index !== event.beatIndex || beat.sceneId !== event.sceneId || beat.startMs !== event.startMs || beat.endMs !== event.endMs) {
      throw new Error(`V2 render beat ${beat.index} no longer matches the approved semantic event`);
    }
  });
  const fontPath = await getFontPath();
  const motionEngine = new PremiumVisualMotionEngine({
    events: approvedPlan.events,
    beats: editPlan.beats,
    subtitleWords: visualPlan.subtitleAlignment.words,
    fontPath,
  });
  const sceneWindows = buildSceneWindows(approvedPlan);
  const emphasis = emphasisWordsByScene(editPlan.beats);
  const subtitleResult = buildPremiumFinanceV2KineticAss({
    words: visualPlan.subtitleAlignment.words,
    windows: sceneWindows,
    emphasisWordsByScene: emphasis,
    durationMs: TEST_DURATION_MS,
  });
  const tempDir = await mkdtemp(join(tmpdir(), "premium-finance-v2-cinematic-"));
  try {
    const subtitlePath = join(tempDir, "kinetic-captions.ass");
    const sourceAudioPath = join(tempDir, "source-voice.m4a");
    const videoOnlyPath = join(tempDir, "scene-composite.mp4");
    await writeFile(subtitlePath, subtitleResult.ass, "utf8");
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-n",
      "-i", SOURCE_MP4_PATH,
      "-map", "0:a:0", "-vn", "-c:a", "copy",
      "-movflags", "+faststart",
      sourceAudioPath,
    ], { maxBuffer: 8 * 1024 * 1024 });
    const photoDataUri = `data:image/jpeg;base64,${photoBuffer.toString("base64")}`;
    const clips: Array<{ path: string; durationSeconds: number }> = [];
    for (const [sceneIndex, scene] of visualPlan.scenes.entries()) {
      const window = sceneWindows.find((candidate) => candidate.sceneId === scene.sceneId)!;
      const beat = editPlan.beats.find((candidate) => candidate.sceneId === scene.sceneId)!;
      const event = approvedPlan.events.find((candidate) => candidate.beatIndex === beat.index)!;
      const treatment = motionEngine.getTreatment({
        beat,
        event,
        durationSeconds: (window.endMs - window.startMs) / 1_000,
      }) as V2MotionTreatment;
      clips.push(await renderSceneClip({
        scene,
        window,
        market,
        dataAsOf: visualPlan.dataAsOf,
        photoDataUri,
        treatment,
        tempDir,
        sceneIndex,
      }));
      console.log(JSON.stringify({
        render: "premium-dynamic-finance-v2-cinematic-test",
        scene: scene.sceneId,
        scenes: visualPlan.scenes.length,
        semanticType: scene.semanticType,
        status: "complete",
      }));
    }
    await joinSceneClips({
      clips,
      transitions: visualPlan.scenes.map((scene) => scene.transitionIn),
      outputPath: videoOnlyPath,
    });
    const sfxEvents = editPlan.sfxEvents.filter((event) =>
      TEST_SCENE_IDS.includes(event.sceneId as typeof TEST_SCENE_IDS[number])
      && event.startMs < TEST_DURATION_MS,
    );
    await mixAudioAndSubtitles({
      videoOnlyPath,
      sourceAudioPath,
      musicPath: MUSIC_PATH,
      outputPath,
      subtitlePath,
      sfxEvents,
    });
    const videoProbe = await probeMedia(outputPath);
    const video = videoProbe.streams.find((stream) => stream.codec_type === "video");
    const audio = videoProbe.streams.find((stream) => stream.codec_type === "audio");
    if (
      videoProbe.durationSeconds < 45
      || videoProbe.durationSeconds > 60
      || video?.codec_name !== "h264"
      || video.width !== WIDTH
      || video.height !== HEIGHT
      || video.r_frame_rate !== `${FPS}/1`
      || audio?.codec_name !== "aac"
    ) {
      throw new Error("Rendered V2 MP4 failed its required 45–60 second H.264/AAC media validation");
    }
    await makeContactSheet({
      videoPath: outputPath,
      plan: visualPlan,
      outputPath: contactSheetPath,
      tempDir,
      fontPath,
    });
    const report = renderReport({
      plan: visualPlan,
      outputPath,
      videoProbe,
      bytes: (await readFile(outputPath)).byteLength,
      contactSheetPath,
    });
    await writeFile(reportPath, `${report}\n`, "utf8");
    console.log(JSON.stringify({
      render: "premium-dynamic-finance-v2-cinematic-test",
      mode: "TEST_MODE",
      status: "complete",
      outputPath,
      visualPlanPath,
      visualPlanHtmlPath,
      reportPath,
      contactSheetPath,
      durationSeconds: videoProbe.durationSeconds,
      subtitlePhraseCount: subtitleResult.phraseCount,
      subtitleWordCount: subtitleResult.wordCount,
      sfxEvents: sfxEvents.length,
      telegramConnected: false,
      productionRouteChanged: false,
    }, null, 2));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function runPremiumDynamicFinanceV2CinematicTest(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log([
      "Isolated test-only renderer for PREMIUM_DYNAMIC_FINANCE_V2_CINEMATIC.",
      "Create and review the scene plan first:",
      "  pnpm --filter @workspace/api-server run plan:finance-v2-cinematic-test",
      "Render only from that saved plan:",
      "  pnpm --filter @workspace/api-server run render:finance-v2-cinematic-test",
      "Uses the approved Dogecoin source MP4 audio; no production or Telegram route is called.",
    ].join("\n"));
    return;
  }
  if (process.argv.includes("--plan-only")) {
    await planOnly();
    return;
  }
  if (process.argv.includes("--render")) {
    await renderFromPlan();
    return;
  }
  throw new Error("Choose --plan-only or --render. The V2 plan must exist before a render can start.");
}

runPremiumDynamicFinanceV2CinematicTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
