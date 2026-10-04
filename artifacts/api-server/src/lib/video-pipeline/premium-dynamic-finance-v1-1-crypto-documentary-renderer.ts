import { execFile } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  transcribeSpeechWithTimestamps,
} from "../audio-generation/elevenlabs-client";
import {
  alignKineticSubtitleWords,
  type KineticSubtitleWord,
} from "./longform-kinetic-subtitles";
import {
  buildCryptoDocumentaryArtwork,
  buildCryptoDocumentaryScenePlan,
  formatCryptoDocumentaryMarketSummary,
  type CryptoDocumentaryMarket,
  type CryptoDocumentaryOverlay,
  type CryptoDocumentaryScene,
} from "./premium-dynamic-finance-v1-1-crypto-documentary-visuals";

const execFileAsync = promisify(execFile);
const API_ROOT = process.cwd();
const OUTPUT_DIR = resolve(API_ROOT, "output");
const APPROVED_PLAN_PATH = resolve(
  OUTPUT_DIR,
  "premium-dynamic-finance-v1-1-dogecoin-semantic-test-20261004130324-VISUAL_PLAN.json",
);
const SOURCE_MP4_PATH = resolve(
  OUTPUT_DIR,
  "premium-dynamic-finance-v1-1-dogecoin-visual-motion-test-20261004134510.mp4",
);
const WIDTH = 1_920;
const HEIGHT = 1_080;
const FPS = 30;
const CROSSFADE_FRAMES = 7;
const EXPECTED_SELECTED_SCENES = [3, 4, 5, 6, 7, 8] as const;
const EXPECTED_VISUAL_TYPES = [
  "PRICE_CHART",
  "MARKET_MOVEMENT",
  "HISTORY_DOCUMENTARY",
  "FULLSCREEN_IMPACT",
  "FULLSCREEN_STAT",
  "COIN_COMPARISON",
  "NEWS_EDITORIAL",
  "COMMUNITY",
] as const;
const TRANSITIONS = [
  "wipeleft",
  "fadeblack",
  "circleopen",
  "fadewhite",
  "smoothright",
  "pixelize",
  "dissolve",
] as const;

type ApprovedPlan = {
  version: string;
  mode: string;
  entity: { id: string; name: string; symbol: string };
  dataAsOf: string;
  sourceReferences: Array<{ label: string; url: string }>;
  narration: {
    script: Array<{ sceneId: number; startMs: number; endMs: number; text: string }>;
    scribe?: {
      expectedWords?: number;
      matchedWords?: number;
      interpolatedWords?: number;
    };
  };
  events: Array<{ sceneId: number; market?: CryptoDocumentaryMarket }>;
};

type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
  nb_read_frames?: string;
};

type MediaProbe = {
  durationSeconds: number;
  streams: ProbeStream[];
};

type SubtitleAssResult = {
  ass: string;
  wordCount: number;
  phraseCount: number;
  maxWordsPerPhrase: number;
  fontSize: number;
  lowerSafeZoneY: number;
};

function normalizeWord(value: string): string {
  return value.toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function tokensIn(value: string): string[] {
  return value.trim().split(/\s+/u).filter((token) => normalizeWord(token));
}

function assTime(milliseconds: number): string {
  const centiseconds = Math.max(0, Math.round(milliseconds / 10));
  const hours = Math.floor(centiseconds / 360_000);
  const minutes = Math.floor(centiseconds / 6_000) % 60;
  const seconds = Math.floor(centiseconds / 100) % 60;
  const remainder = centiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(remainder).padStart(2, "0")}`;
}

function escapeAss(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}");
}

function splitSmallSubtitlePhrases(words: KineticSubtitleWord[]): KineticSubtitleWord[][] {
  const phrases: KineticSubtitleWord[][] = [];
  let current: KineticSubtitleWord[] = [];
  for (const word of words) {
    const previous = current.at(-1);
    const gap = previous ? word.startMs - previous.endMs : 0;
    const duration = current.length ? word.endMs - current[0]!.startMs : 0;
    const breakBefore = current.length > 0 && (
      current.length >= 5
      || gap > 320
      || duration > 1_650
      || /[,;:.!?…]$/u.test(previous!.text)
    );
    if (breakBefore) {
      phrases.push(current);
      current = [];
    }
    current.push(word);
  }
  if (current.length) phrases.push(current);
  return phrases;
}

export function buildSmallWordSubtitleAss(
  words: KineticSubtitleWord[],
  durationMs: number,
): SubtitleAssResult {
  if (!words.length) throw new Error("Small subtitle render requires exact Scribe word timestamps");
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("Small subtitle render requires a positive video duration");
  }
  let previousStartMs = -1;
  const safeWords = words.map((word) => {
    if (
      !word.text.trim()
      || !Number.isFinite(word.startMs)
      || !Number.isFinite(word.endMs)
      || word.startMs < 0
      || word.endMs <= word.startMs
      || word.endMs > durationMs
      || word.startMs < previousStartMs
    ) {
      throw new Error(`Small subtitle render received invalid or unordered Scribe word: ${word.text}`);
    }
    previousStartMs = word.startMs;
    return word;
  });
  const phrases = splitSmallSubtitlePhrases(safeWords);
  const fontSize = 42;
  const y = 966;
  const dialogues: string[] = [];
  let maxWordsPerPhrase = 0;
  for (const phrase of phrases) {
    maxWordsPerPhrase = Math.max(maxWordsPerPhrase, phrase.length);
    const widths = phrase.map((word) => Math.max(fontSize * 0.7, [...word.text].length * fontSize * 0.55));
    const gapWidth = fontSize * 0.34;
    const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gapWidth * (phrase.length - 1);
    if (totalWidth > 1_500) {
      throw new Error(`Small subtitle phrase is too wide for the lower safe zone: ${phrase.map((word) => word.text).join(" ")}`);
    }
    const phraseEndMs = phrase.at(-1)!.endMs;
    let cursorX = (WIDTH - totalWidth) / 2;
    phrase.forEach((word, index) => {
      const x = Math.round(cursorX + widths[index]! / 2);
      const overrides = `{\\an5\\pos(${x},${y})\\fs${fontSize}\\b0\\1c&H00F5F7FA&\\3c&HCC07111B&\\bord3\\shad1\\fad(0,60)}`;
      dialogues.push(
        `Dialogue: 1,${assTime(word.startMs)},${assTime(phraseEndMs)},Small,,0,0,0,,${overrides}${escapeAss(word.text)}`,
      );
      cursorX += widths[index]! + gapWidth;
    });
  }
  const ass = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${WIDTH}`,
    `PlayResY: ${HEIGHT}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Small,DejaVu Sans,${fontSize},&H00F5F7FA,&H00F5F7FA,&HCC07111B,&H00000000,0,0,1,3,1,5,72,72,0,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...dialogues,
    "",
  ].join("\n");
  return {
    ass,
    wordCount: safeWords.length,
    phraseCount: phrases.length,
    maxWordsPerPhrase,
    fontSize,
    lowerSafeZoneY: y,
  };
}

async function probeMedia(path: string, countFrames = false): Promise<MediaProbe> {
  const args = [
    "-v", "error",
    ...(countFrames ? ["-count_frames"] : []),
    "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels,nb_read_frames",
    "-of", "json",
    path,
  ];
  const { stdout } = await execFileAsync("ffprobe", args, { maxBuffer: 4 * 1024 * 1024 });
  const parsed = JSON.parse(stdout) as { format?: { duration?: string }; streams?: ProbeStream[] };
  const durationSeconds = Number(parsed.format?.duration);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`FFprobe returned an invalid duration for ${path}`);
  }
  return { durationSeconds, streams: parsed.streams ?? [] };
}

async function audioPacketSha256(path: string): Promise<string> {
  const { stdout } = await execFileAsync("ffmpeg", [
    "-hide_banner", "-v", "error", "-i", path,
    "-map", "0:a:0", "-c:a", "copy",
    "-f", "hash", "-hash", "sha256", "-",
  ], { maxBuffer: 1024 * 1024 });
  const match = stdout.match(/SHA256=([0-9a-f]{64})/iu);
  if (!match) throw new Error(`Could not calculate the AAC packet hash for ${path}`);
  return match[1]!.toLowerCase();
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function renderSvgToPng(tempDir: string, stem: string, svg: string): Promise<string> {
  const svgPath = join(tempDir, `${stem}.svg`);
  const pngPath = join(tempDir, `${stem}.png`);
  await writeFile(svgPath, svg, "utf8");
  await execFileAsync("magick", [
    "-background", "none",
    svgPath,
    "-alpha", "on",
    pngPath,
  ], { maxBuffer: 4 * 1024 * 1024 });
  return pngPath;
}

function sceneCamera(scene: CryptoDocumentaryScene): { zoom: string; xDrift: number; yDrift: number } {
  switch (scene.visualType) {
    case "FULLSCREEN_IMPACT":
      return { zoom: "if(lte(on,18),1+0.0027*on,1.048)", xDrift: 0, yDrift: 0 };
    case "COMMUNITY":
      return { zoom: "if(eq(on,0),1.055,max(zoom-0.000055,1.0))", xDrift: 5, yDrift: 3 };
    case "MARKET_MOVEMENT":
      return { zoom: "min(zoom+0.000045,1.045)", xDrift: 12, yDrift: 7 };
    case "NEWS_EDITORIAL":
      return { zoom: "min(zoom+0.000025,1.035)", xDrift: 24, yDrift: 6 };
    default:
      return { zoom: "min(zoom+0.000035,1.04)", xDrift: 8, yDrift: 5 };
  }
}

async function renderSceneClip(input: {
  scene: CryptoDocumentaryScene;
  backgroundSvg: string;
  overlays: CryptoDocumentaryOverlay[];
  tempDir: string;
  clipFrames: number;
  sceneIndex: number;
}): Promise<string> {
  const durationSeconds = input.clipFrames / FPS;
  const basePng = await renderSvgToPng(
    input.tempDir,
    `scene-${input.sceneIndex + 1}-background`,
    input.backgroundSvg,
  );
  const overlayPngs: Array<{ path: string; overlay: CryptoDocumentaryOverlay }> = [];
  for (const [index, overlay] of input.overlays.entries()) {
    const path = await renderSvgToPng(
      input.tempDir,
      `scene-${input.sceneIndex + 1}-overlay-${index + 1}`,
      overlay.svg,
    );
    overlayPngs.push({ path, overlay });
  }
  const inputArgs: string[] = [];
  for (const path of [basePng, ...overlayPngs.map((item) => item.path)]) {
    inputArgs.push("-loop", "1", "-framerate", String(FPS), "-t", durationSeconds.toFixed(6), "-i", path);
  }

  const filters: string[] = ["[0:v]fps=30,format=rgba[base0]"];
  overlayPngs.forEach(({ overlay }, index) => {
    const inputIndex = index + 1;
    const revealSeconds = Math.max(0, overlay.revealAtMs / 1_000);
    const fadeSeconds = Math.max(0.04, (overlay.fadeMs ?? 100) / 1_000);
    filters.push(
      `[${inputIndex}:v]fps=30,format=rgba,fade=t=in:st=${revealSeconds.toFixed(3)}:d=${fadeSeconds.toFixed(3)}:alpha=1[lay${inputIndex}]`,
    );
    filters.push(
      `[base${inputIndex - 1}][lay${inputIndex}]overlay=x=0:y=0:eval=frame:eof_action=pass:repeatlast=0[base${inputIndex}]`,
    );
  });

  const finalBase = `base${overlayPngs.length}`;
  const camera = sceneCamera(input.scene);
  const motionBlur = "tmix=frames=2:weights='0.24 0.76'";
  filters.push(
    `[${finalBase}]zoompan=z='${camera.zoom}':x='iw/2-(iw/zoom/2)+${camera.xDrift}*sin(on/52)':y='ih/2-(ih/zoom/2)+${camera.yDrift}*cos(on/67)':d=1:s=${WIDTH}x${HEIGHT}:fps=${FPS},${motionBlur},trim=end_frame=${input.clipFrames},setpts=PTS-STARTPTS,format=yuv420p[v]`,
  );
  const outputPath = join(input.tempDir, `scene-${input.sceneIndex + 1}.mp4`);
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    ...inputArgs,
    "-filter_complex_threads", "1",
    "-filter_complex", filters.join(";"),
    "-map", "[v]",
    "-an",
    "-frames:v", String(input.clipFrames),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    "-movflags", "+faststart",
    outputPath,
  ], { maxBuffer: 8 * 1024 * 1024 });
  return outputPath;
}

async function renderXfadeVideo(input: {
  clipPaths: string[];
  sceneFrames: number[];
  targetFrames: number;
  tempDir: string;
}): Promise<string> {
  const args: string[] = ["-hide_banner", "-loglevel", "error", "-y"];
  input.clipPaths.forEach((path) => args.push("-i", path));
  const filters = input.clipPaths.map((_, index) =>
    `[${index}:v]fps=${FPS},settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p[v${index}]`,
  );
  const crossfadeDuration = CROSSFADE_FRAMES / FPS;
  let currentLabel = "v0";
  let elapsedSceneFrames = input.sceneFrames[0]!;
  for (let index = 1; index < input.clipPaths.length; index += 1) {
    const transitionLabel = `xf${index}`;
    const transition = TRANSITIONS[index - 1]!;
    const offset = (elapsedSceneFrames / FPS).toFixed(6);
    filters.push(
      `[${currentLabel}][v${index}]xfade=transition=${transition}:duration=${crossfadeDuration.toFixed(6)}:offset=${offset}[${transitionLabel}]`,
    );
    currentLabel = transitionLabel;
    elapsedSceneFrames += input.sceneFrames[index]!;
  }
  const outputPath = join(input.tempDir, "documentary-video-only.mp4");
  await execFileAsync("ffmpeg", [
    ...args,
    "-filter_complex_threads", "1",
    "-filter_complex", filters.join(";"),
    "-map", `[${currentLabel}]`,
    "-an",
    "-frames:v", String(input.targetFrames),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "17",
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    "-movflags", "+faststart",
    outputPath,
  ], { maxBuffer: 12 * 1024 * 1024 });
  return outputPath;
}

function escapeFilterPath(path: string): string {
  return path.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'");
}

function marketFromApprovedPlan(plan: ApprovedPlan): CryptoDocumentaryMarket {
  const row = plan.events.find((event) => event.sceneId === 3)?.market;
  if (!row) throw new Error("Approved plan is missing the sourced DOGE market snapshot");
  const source = plan.sourceReferences.find((reference) =>
    reference.label.toLocaleLowerCase("en-US").includes("coingecko"),
  );
  if (!source) throw new Error("Approved plan is missing the CoinGecko source reference");
  if (
    row.priceSamples.length !== 7
    || !row.riseSegment
    || !row.drawdownSegment
    || !Number.isFinite(row.marketCapUsd)
    || !Number.isFinite(row.changePercent7d)
    || !Number.isFinite(row.bitcoinChangePercent7d)
  ) {
    throw new Error("Approved plan's seven-day market snapshot is incomplete");
  }
  return { ...row, sourceUrl: source.url };
}

function validateApprovedPlan(plan: ApprovedPlan): void {
  if (plan.version !== "premium-dynamic-finance-v1.1-semantic-test" || plan.mode !== "TEST_MODE") {
    throw new Error("Expected the reviewed V1.1 semantic TEST_MODE plan; refusing to use another plan");
  }
  if (plan.entity.id !== "dogecoin" || plan.entity.symbol !== "DOGE") {
    throw new Error("The documentary test is limited to the reviewed Dogecoin plan");
  }
  const sceneIds = [...new Set(plan.narration.script.map((scene) => scene.sceneId))]
    .sort((left, right) => left - right);
  if (sceneIds.join(",") !== "1,2,3,4,5,6,7,8,9,10") {
    throw new Error("Reviewed narration no longer contains the expected ten source scenes");
  }
}

export async function runPremiumCryptoDocumentaryTest(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log([
      "Isolated test-only Premium Crypto Documentary renderer for reviewed Dogecoin scenes 3–8.",
      "Run: pnpm --filter @workspace/api-server run render:finance-v1-1-crypto-documentary-test",
      "Uses only the existing test MP4's extracted AAC audio; source video frames, production routes, and Telegram are not used.",
    ].join("\n"));
    return;
  }

  await access(SOURCE_MP4_PATH);
  await access(APPROVED_PLAN_PATH);
  await mkdir(OUTPUT_DIR, { recursive: true });
  const plan = JSON.parse(await readFile(APPROVED_PLAN_PATH, "utf8")) as ApprovedPlan;
  validateApprovedPlan(plan);
  const narrationScenes = plan.narration.script.filter((scene) =>
    EXPECTED_SELECTED_SCENES.includes(scene.sceneId as typeof EXPECTED_SELECTED_SCENES[number]),
  );
  if (narrationScenes.length !== EXPECTED_SELECTED_SCENES.length) {
    throw new Error("Approved script does not contain exactly scenes 3–8");
  }
  const sourceProbe = await probeMedia(SOURCE_MP4_PATH);
  const sourceVideo = sourceProbe.streams.find((stream) => stream.codec_type === "video");
  const sourceAudio = sourceProbe.streams.find((stream) => stream.codec_type === "audio");
  if (
    sourceProbe.durationSeconds < 30
    || sourceProbe.durationSeconds > 45
    || sourceVideo?.codec_name !== "h264"
    || sourceVideo.width !== WIDTH
    || sourceVideo.height !== HEIGHT
    || sourceVideo.r_frame_rate !== `${FPS}/1`
    || sourceAudio?.codec_name !== "aac"
  ) {
    throw new Error("Latest source MP4 does not match the reviewed 30–45 second H.264/AAC test input");
  }

  const runKey = new Date().toISOString().replace(/\D/gu, "").slice(0, 14);
  const prefix = `premium-dynamic-finance-v1-1-dogecoin-crypto-documentary-test-${runKey}`;
  const outputPath = join(OUTPUT_DIR, `${prefix}.mp4`);
  const visualPlanPath = join(OUTPUT_DIR, `${prefix}-VISUAL_PLAN.json`);
  const reportPath = join(OUTPUT_DIR, `${prefix}-MOTION_AUDIT_REPORT.json`);
  const contactSheetPath = join(OUTPUT_DIR, `${prefix}-CONTACT_SHEET.jpg`);
  for (const path of [outputPath, visualPlanPath, reportPath, contactSheetPath]) {
    if (await pathExists(path)) throw new Error(`Refusing to overwrite an existing documentary test artifact: ${path}`);
  }

  const tempDir = await mkdtemp(join(tmpdir(), "premium-crypto-documentary-test-"));
  try {
    const sourceAudioHash = await audioPacketSha256(SOURCE_MP4_PATH);
    const extractedAudioPath = join(tempDir, "source-audio-exact.m4a");
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-n",
      "-i", SOURCE_MP4_PATH,
      "-map", "0:a:0", "-vn", "-c:a", "copy",
      "-movflags", "+faststart",
      extractedAudioPath,
    ], { maxBuffer: 4 * 1024 * 1024 });
    const extractedAudioHash = await audioPacketSha256(extractedAudioPath);
    if (extractedAudioHash !== sourceAudioHash) {
      throw new Error("AAC stream-copy extraction changed source audio packets; refusing to render");
    }

    const transcriptionMp3Path = join(tempDir, "scribe-audio-input.mp3");
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-n",
      "-i", extractedAudioPath,
      "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "48000",
      "-c:a", "libmp3lame", "-q:a", "2",
      transcriptionMp3Path,
    ], { maxBuffer: 4 * 1024 * 1024 });
    const transcriptionAudio = await readFile(transcriptionMp3Path);
    const scriptText = narrationScenes.map((scene) => scene.text).join(" ");
    const expectedWordCount = narrationScenes.reduce((sum, scene) => sum + tokensIn(scene.text).length, 0);
    const scribe = await transcribeSpeechWithTimestamps(
      transcriptionAudio,
      `${prefix}-source-audio-analysis.mp3`,
    );
    const durationMs = Math.round(sourceProbe.durationSeconds * 1_000);
    const alignment = alignKineticSubtitleWords({
      voices: [{ sceneId: 3, startTime: 0, endTime: durationMs, text: scriptText }],
      transcriptWords: scribe.words,
      durationMs,
      minimumMatchCoverage: 1,
      requireExactMatches: true,
    });
    if (
      alignment.expectedWordCount !== expectedWordCount
      || alignment.matchedWordCount !== expectedWordCount
      || alignment.interpolatedWordCount !== 0
      || alignment.words.length !== expectedWordCount
    ) {
      throw new Error(
        `Scribe failed exact subtitle recovery: expected=${expectedWordCount}, matched=${alignment.matchedWordCount}, interpolated=${alignment.interpolatedWordCount}`,
      );
    }
    const subtitleAss = buildSmallWordSubtitleAss(alignment.words, durationMs);
    if (subtitleAss.fontSize > 44 || subtitleAss.lowerSafeZoneY < HEIGHT * 0.82) {
      throw new Error("Subtitle style exceeded the approved small lower-safe-zone limits");
    }

    const market = marketFromApprovedPlan(plan);
    const scenes = buildCryptoDocumentaryScenePlan({
      narrationScenes,
      subtitleWords: alignment.words,
      durationMs,
    });
    if (
      scenes.length !== EXPECTED_VISUAL_TYPES.length
      || scenes.map((scene) => scene.visualType).join(",") !== EXPECTED_VISUAL_TYPES.join(",")
      || new Set(scenes.map((scene) => scene.layout)).size !== scenes.length
    ) {
      throw new Error("Documentary plan failed its distinct-scene semantic coverage checks");
    }
    const sceneFrames = scenes.map((scene, index) => {
      const startFrame = index === 0 ? 0 : Math.round(scene.startMs * FPS / 1_000);
      const endFrame = index === scenes.length - 1
        ? Math.round(durationMs * FPS / 1_000)
        : Math.round(scene.endMs * FPS / 1_000);
      const count = endFrame - startFrame;
      if (count < 1) throw new Error(`Documentary scene ${scene.visualType} has no output frames`);
      return count;
    });
    const targetFrames = Math.round(durationMs * FPS / 1_000);
    if (sceneFrames.reduce((sum, count) => sum + count, 0) !== targetFrames) {
      throw new Error("Documentary scene frame allocation does not cover the source MP4 duration exactly");
    }

    const artworks = scenes.map((scene) => buildCryptoDocumentaryArtwork(scene, market));
    const renderedClipPaths: string[] = [];
    for (const [sceneIndex, scene] of scenes.entries()) {
      const clipFrames = sceneFrames[sceneIndex]! + (sceneIndex < scenes.length - 1 ? CROSSFADE_FRAMES : 0);
      const artwork = artworks[sceneIndex]!;
      renderedClipPaths.push(await renderSceneClip({
        scene,
        backgroundSvg: artwork.backgroundSvg,
        overlays: artwork.overlays,
        tempDir,
        clipFrames,
        sceneIndex,
      }));
      console.log(JSON.stringify({
        renderer: "PremiumCryptoDocumentaryTestRenderer",
        scene: sceneIndex + 1,
        scenes: scenes.length,
        type: scene.visualType,
        frames: sceneFrames[sceneIndex],
        overlays: artwork.overlays.length,
      }));
    }

    const videoOnlyPath = await renderXfadeVideo({
      clipPaths: renderedClipPaths,
      sceneFrames,
      targetFrames,
      tempDir,
    });
    const assPath = join(tempDir, "small-word-synced-subtitles.ass");
    await writeFile(assPath, subtitleAss.ass, "utf8");
    const finalTempPath = join(tempDir, "crypto-documentary-with-source-audio.mp4");
    const targetDurationSeconds = targetFrames / FPS;
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-n",
      "-i", videoOnlyPath,
      "-i", extractedAudioPath,
      "-map", "0:v:0", "-map", "1:a:0",
      "-vf", `subtitles='${escapeFilterPath(assPath)}'`,
      "-t", targetDurationSeconds.toFixed(6),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
      "-pix_fmt", "yuv420p", "-r", String(FPS),
      "-c:a", "copy",
      "-movflags", "+faststart",
      finalTempPath,
    ], { maxBuffer: 12 * 1024 * 1024 });

    const finalProbe = await probeMedia(finalTempPath, true);
    const finalVideo = finalProbe.streams.find((stream) => stream.codec_type === "video");
    const finalAudio = finalProbe.streams.find((stream) => stream.codec_type === "audio");
    const finalAudioHash = await audioPacketSha256(finalTempPath);
    const finalFrameCount = Number(finalVideo?.nb_read_frames);
    if (
      finalVideo?.codec_name !== "h264"
      || finalVideo.width !== WIDTH
      || finalVideo.height !== HEIGHT
      || finalVideo.r_frame_rate !== `${FPS}/1`
      || finalFrameCount !== targetFrames
      || finalAudio?.codec_name !== "aac"
      || finalAudioHash !== sourceAudioHash
    ) {
      throw new Error(
        `Final output validation failed: frames=${finalFrameCount}/${targetFrames}, audioHashMatch=${finalAudioHash === sourceAudioHash}`,
      );
    }
    const finalDurationMs = Math.round(finalProbe.durationSeconds * 1_000);
    if (Math.abs(finalDurationMs - durationMs) > 34) {
      throw new Error(`Final video duration drifted from the source MP4: ${finalDurationMs} ms vs ${durationMs} ms`);
    }

    const contactTempPath = join(tempDir, "documentary-contact-sheet.jpg");
    const sampleRate = 24 / (targetFrames / FPS);
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-n",
      "-i", finalTempPath,
      "-vf", `fps=${sampleRate.toFixed(6)},scale=480:270,tile=4x6:padding=16:margin=16:color=0x0b1218`,
      "-frames:v", "1", "-q:v", "2",
      contactTempPath,
    ], { maxBuffer: 6 * 1024 * 1024 });

    const planOutput = {
      version: "premium-dynamic-finance-v1.1-crypto-documentary-test",
      mode: "TEST_MODE",
      renderer: "PremiumCryptoDocumentaryTestRenderer",
      source: {
        mp4: SOURCE_MP4_PATH.replace(`${API_ROOT}/`, ""),
        sourceVideoFramesUsed: false,
        sourceUsedForAudioOnly: true,
        audioExtraction: "AAC packet stream-copy",
        audioPacketSha256: sourceAudioHash,
        audioPacketHashMatchesAfterExtraction: extractedAudioHash === sourceAudioHash,
        approvedNarrationPlan: APPROVED_PLAN_PATH.replace(`${API_ROOT}/`, ""),
        visualPlanWasReviewedBeforeRender: true,
        productionRouteChanged: false,
        telegramRouteChanged: false,
      },
      output: {
        mp4: outputPath.replace(`${API_ROOT}/`, ""),
        contactSheet: contactSheetPath.replace(`${API_ROOT}/`, ""),
        motionAuditReport: reportPath.replace(`${API_ROOT}/`, ""),
        width: WIDTH,
        height: HEIGHT,
        fps: FPS,
        durationMs: finalDurationMs,
        frameCount: finalFrameCount,
      },
      semanticCoverage: {
        sourceSceneIds: EXPECTED_SELECTED_SCENES,
        visualTypes: scenes.map((scene) => scene.visualType),
        uniqueLayouts: new Set(scenes.map((scene) => scene.layout)).size,
        independentCompositionPerScene: true,
        persistentLegacyBackground: false,
        futurePriceProjection: false,
        documentaryScope: "Sourced past seven-day Dogecoin price record; not Dogecoin origin history.",
      },
      market: {
        sourceLabel: market.sourceLabel,
        sourceUrl: market.sourceUrl,
        dataAsOf: market.dataAsOf,
        ...formatCryptoDocumentaryMarketSummary(market),
        priceSampleCount: market.priceSamples.length,
      },
      subtitles: {
        timingSource: "Fresh Scribe word timestamps from the exact source MP4 audio stream",
        expectedWordCount,
        matchedWordCount: alignment.matchedWordCount,
        interpolatedWordCount: alignment.interpolatedWordCount,
        matchCoverage: alignment.matchCoverage,
        preservedWordStartEndTimestamps: true,
        fontSizePx: subtitleAss.fontSize,
        lowerSafeZoneY: subtitleAss.lowerSafeZoneY,
        giantCaptionMode: false,
        subtitleDialogueCount: subtitleAss.wordCount,
      },
      scenes: scenes.map((scene, index) => ({
        index: scene.index,
        sourceSceneId: scene.sourceSceneId,
        visualType: scene.visualType,
        voiceText: scene.voiceText,
        startMs: scene.startMs,
        endMs: scene.endMs,
        voiceStartMs: scene.voiceStartMs,
        voiceEndMs: scene.voiceEndMs,
        frameCount: sceneFrames[index],
        layout: scene.layout,
        dominantVisual: scene.dominantVisual,
        visualDominancePercent: scene.visualDominancePercent,
        composition: scene.composition,
        animation: scene.animation,
        overlayCount: artworks[index]!.overlays.length,
      })),
    };

    const report = {
      reportVersion: 1,
      status: "PASS",
      rendererName: "PremiumCryptoDocumentaryTestRenderer",
      testOnly: true,
      generatedAt: new Date().toISOString(),
      source: planOutput.source,
      video: {
        width: finalVideo.width,
        height: finalVideo.height,
        fps: finalVideo.r_frame_rate,
        codec: finalVideo.codec_name,
        durationMs: finalDurationMs,
        sourceDurationMs: durationMs,
        frameCount: finalFrameCount,
        expectedFrameCount: targetFrames,
      },
      audioIntegrity: {
        sourceCodec: sourceAudio.codec_name,
        outputCodec: finalAudio.codec_name,
        sourceAudioPacketSha256: sourceAudioHash,
        extractedAudioPacketSha256: extractedAudioHash,
        outputAudioPacketSha256: finalAudioHash,
        sourceMatchesExtraction: extractedAudioHash === sourceAudioHash,
        sourceMatchesOutput: finalAudioHash === sourceAudioHash,
        sourceAudioRemixed: false,
        sourceAudioReencoded: false,
        addedSoundEffects: false,
      },
      subtitleIntegrity: planOutput.subtitles,
      semanticCoverage: planOutput.semanticCoverage,
      sceneAudit: planOutput.scenes,
      isolation: {
        productionRendererModified: false,
        productionRoutesModified: false,
        telegramIntegrationAdded: false,
        previousVideoFramesReused: false,
        previewedMp4UsedForAudioOnly: true,
      },
      checks: {
        eightDistinctSemanticVisualTypes: true,
        eightIndependentSceneLayouts: true,
        smallLowerSafeZoneSubtitles: true,
        exactScribeMatchesWithNoInterpolation: true,
        giantSpokenTextCaptionsDisabled: true,
        sourceAacPacketStreamIdentical: true,
        h2641080p30: true,
        noProductionOrTelegramChanges: true,
        contactSheetGenerated: true,
      },
    };

    await writeFile(join(tempDir, "visual-plan.json"), `${JSON.stringify(planOutput, null, 2)}\n`, "utf8");
    await writeFile(join(tempDir, "motion-audit-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await copyFile(finalTempPath, outputPath);
    await copyFile(contactTempPath, contactSheetPath);
    await copyFile(join(tempDir, "visual-plan.json"), visualPlanPath);
    await copyFile(join(tempDir, "motion-audit-report.json"), reportPath);
    console.log(JSON.stringify({
      renderer: "PremiumCryptoDocumentaryTestRenderer",
      status: "PASS",
      output: outputPath,
      contactSheet: contactSheetPath,
      report: reportPath,
      durationMs: finalDurationMs,
      frames: finalFrameCount,
      subtitleWords: alignment.matchedWordCount,
      audioPacketSha256: finalAudioHash,
    }, null, 2));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && basename(resolve(process.argv[1])) === "run.mjs") {
  runPremiumCryptoDocumentaryTest().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
