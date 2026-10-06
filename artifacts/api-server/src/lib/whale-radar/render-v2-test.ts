import { execFile as nodeExecFile, spawn, type ChildProcess } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  db,
  pool,
  telegramChatPreferencesTable,
  whaleDataSourcesTable,
  whaleEventsTable,
} from "@workspace/db";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import {
  generateSpeech,
  getConfiguredVoiceId,
  getElevenLabsModel,
  getSpeechProvider,
} from "../audio-generation/elevenlabs-client";
import { buildWhaleRadarV2Html } from "./renderer-v2";
import {
  buildWhaleRadarV2Story,
  countWhaleRadarV2Words,
  type WhaleRadarV2Event,
  type WhaleRadarV2RelatedEvent,
} from "./v2-story";
import { sendWhaleRadarV2PrivatePreview } from "./telegram-v2-preview";

const execFile = promisify(nodeExecFile);
const OUTPUT_DIR = path.resolve(process.cwd(), "output", "whale-radar-v2-test");
const TARGET_DURATION_SECONDS = 120;
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1_000;
const TELEGRAM_CAPTION = "Whale Radar Shorts V2 — тестовый ролик, не опубликован. Данные Nansen сохранены; конкретная DEX-площадка в записи не указана.";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Cached event has no structured raw transaction data.");
  }
  return value as Record<string, unknown>;
}

function toV2Event(row: typeof whaleEventsTable.$inferSelect): WhaleRadarV2Event {
  if (
    row.action !== "BUY" && row.action !== "SELL"
    || row.walletType !== "smart_money"
    || !row.walletLabel
    || !row.priceUsd
    || !row.marketContext
  ) {
    throw new Error("Cached event is missing the required Smart Money trade fields.");
  }
  return {
    eventTimestamp: row.eventTimestamp.toISOString(),
    blockchain: row.blockchain,
    symbol: row.symbol,
    action: row.action,
    amount: row.amount,
    amountUsd: row.amountUsd,
    priceUsd: row.priceUsd,
    walletLabel: row.walletLabel,
    walletType: row.walletType,
    dex: row.dex,
    transactionHash: row.transactionHash,
    marketContext: row.marketContext,
    rawData: asRecord(row.rawData),
  };
}

function toRelatedEvent(row: typeof whaleEventsTable.$inferSelect): WhaleRadarV2RelatedEvent {
  if (row.action !== "BUY" && row.action !== "SELL") {
    throw new Error("Previous activity is not a DEX buy or sell.");
  }
  return {
    eventTimestamp: row.eventTimestamp.toISOString(),
    symbol: row.symbol,
    action: row.action,
    amountUsd: row.amountUsd,
    transactionHash: row.transactionHash,
  };
}

async function run(command: string, args: string[], options: { timeout?: number } = {}): Promise<string> {
  const result = await execFile(command, args, {
    encoding: "utf8",
    timeout: options.timeout ?? 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return result.stdout;
}

function waitForChild(process: ChildProcess): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve, reject) => {
    process.once("error", reject);
    process.once("close", (code, signal) => resolve({ code, signal }));
  });
}

function parseDuration(value: string): number {
  const duration = Number.parseFloat(value.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("ffprobe could not read the voice duration.");
  return duration;
}

async function probeAudioDuration(audioPath: string): Promise<number> {
  const output = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ]);
  return parseDuration(output);
}

async function probeFinalVideo(videoPath: string): Promise<{
  duration: number;
  size: number;
  video: { codec_name: string; width: number; height: number; r_frame_rate: string };
  audio: { codec_name: string } | undefined;
}> {
  const output = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate:format=duration,size",
    "-of", "json",
    videoPath,
  ]);
  const metadata = JSON.parse(output) as {
    streams?: Array<{
      codec_type: string;
      codec_name?: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
    }>;
    format?: { duration?: string; size?: string };
  };
  const video = metadata.streams?.find((stream) => stream.codec_type === "video");
  const audio = metadata.streams?.find((stream) => stream.codec_type === "audio");
  if (
    !video?.codec_name || !video.width || !video.height
    || !metadata.format?.duration || !metadata.format.size
  ) {
    throw new Error("ffprobe did not return complete video metadata.");
  }
  return {
    duration: Number(metadata.format.duration),
    size: Number(metadata.format.size),
    video: {
      codec_name: video.codec_name,
      width: video.width,
      height: video.height,
      r_frame_rate: video.r_frame_rate ?? "",
    },
    audio: audio?.codec_name ? { codec_name: audio.codec_name } : undefined,
  };
}

async function getX11State(): Promise<{ mode: string; rotation: string; framebuffer: string }> {
  const output = await run("xrandr", ["--verbose"]);
  const lines = output.split("\n");
  const screenIndex = lines.findIndex((line) => line.startsWith("VNC-0 connected"));
  if (screenIndex < 0) throw new Error("VNC-0 display is unavailable; no video capture was started.");
  const firstLine = lines[screenIndex] ?? "";
  const mode = /VNC-0 connected(?: primary)?\s+(\d+x\d+)\+/u.exec(firstLine)?.[1];
  const rotation = /VNC-0 connected(?: primary)?\s+\d+x\d+\+\d+\+\d+(?:\s+\([^)]+\))?\s+(normal|left|right|inverted)\s+\(/u
    .exec(firstLine)?.[1];
  const framebufferSize = /Screen 0:[^\n]*current\s+(\d+)\s+x\s+(\d+)/u.exec(output);
  if (!mode || !rotation || !framebufferSize) {
    throw new Error("Could not safely record the current X11 display mode.");
  }
  return {
    mode,
    rotation,
    framebuffer: `${framebufferSize[1]}x${framebufferSize[2]}`,
  };
}

async function captureAnimation(htmlPath: string, silentVideoPath: string, durationSeconds: number): Promise<void> {
  const display = process.env["DISPLAY"];
  if (!display) throw new Error("DISPLAY is not configured; no video capture was started.");

  const originalDisplay = await getX11State();
  const chromiumProfile = path.join(OUTPUT_DIR, "chromium-profile");
  let browser: ChildProcess | undefined;
  let didResize = false;
  try {
    didResize = true;
    await run("xrandr", ["--output", "VNC-0", "--mode", "1920x1080", "--pos", "0x0"]);
    await run("xrandr", ["--fb", "1920x1920"]);
    const resized = await run("xrandr", ["--query"]);
    if (
      !/current\s+1920\s+x\s+1920/u.test(resized)
      || !/VNC-0 connected(?: primary)?\s+1920x1080\+0\+0/u.test(resized)
    ) {
      throw new Error("X11 did not create a 1920x1920 virtual framebuffer for portrait capture.");
    }

    browser = spawn(process.env["CHROMIUM_BIN"] || "/repl/tools/bin/chromium", [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-features=Translate",
      "--force-device-scale-factor=1",
      "--hide-scrollbars",
      "--window-size=1080,1941",
      "--window-position=0,-21",
      `--user-data-dir=${chromiumProfile}`,
      `--app=file://${htmlPath}`,
    ], { stdio: "ignore" });

    await delay(2_500);
    const windowOutput = await run("xdotool", [
      "search", "--sync", "--onlyvisible", "--name", "Whale Radar Shorts V2",
    ], { timeout: 15_000 });
    const windowId = windowOutput.trim().split(/\s+/u).at(-1);
    if (!windowId) throw new Error("The V2 animation page did not open in Chromium.");
    await run("xdotool", ["windowmove", "--sync", windowId, "0", "-21"]);
    await run("xdotool", ["windowsize", "--sync", windowId, "1080", "1941"]);
    await run("xdotool", ["windowactivate", "--sync", windowId]);
    await run("xdotool", ["mousemove", "--sync", "1058", "8", "click", "1"]);
    await delay(350);

    const capture = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel", "warning",
      "-y",
      "-f", "x11grab",
      "-draw_mouse", "0",
      "-framerate", "30",
      "-video_size", "1080x1920",
      "-i", `${display}+0,0`,
      "-t", durationSeconds.toFixed(2),
      "-an",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-b:v", "2.0M",
      "-maxrate", "2.3M",
      "-bufsize", "4.6M",
      "-r", "30",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      silentVideoPath,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    let captureError = "";
    capture.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
      captureError += chunk;
    });
    const captureExit = waitForChild(capture);
    await new Promise<void>((resolve, reject) => {
      capture.once("spawn", resolve);
      capture.once("error", reject);
    });
    await run("xdotool", ["key", "--window", windowId, "space"]);
    const outcome = await captureExit;
    if (outcome.code !== 0) {
      throw new Error(`FFmpeg capture failed (exit ${outcome.code ?? outcome.signal}): ${captureError.slice(-1_500)}`);
    }
  } finally {
    if (browser && !browser.killed) {
      browser.kill("SIGTERM");
      await Promise.race([waitForChild(browser).catch(() => undefined), delay(5_000)]);
    }
    try {
      if (didResize) {
        await run("xrandr", [
          "--output", "VNC-0",
          "--mode", originalDisplay.mode,
          "--pos", "0x0",
          "--rotate", originalDisplay.rotation,
        ]);
        await run("xrandr", ["--fb", originalDisplay.framebuffer]);
      }
    } finally {
      await rm(chromiumProfile, { recursive: true, force: true });
    }
  }
}

async function loadCachedEvent(): Promise<{
  event: WhaleRadarV2Event;
  relatedEvents: WhaleRadarV2RelatedEvent[];
  scannedAt: string;
}> {
  const [source] = await db.select().from(whaleDataSourcesTable)
    .where(eq(whaleDataSourcesTable.provider, "nansen"))
    .limit(1);
  if (
    !source
    || source.status !== "ok"
    || !source.lastFetchedAt
    || Date.now() - source.lastFetchedAt.getTime() > MAX_CACHE_AGE_MS
  ) {
    throw new Error("No successful Nansen cache from the last 24 hours; the script will not make a provider request.");
  }

  const rows = await db.select().from(whaleEventsTable)
    .where(and(
      eq(whaleEventsTable.blockchain, "ethereum"),
      eq(whaleEventsTable.symbol, "ETH"),
      eq(whaleEventsTable.action, "BUY"),
      eq(whaleEventsTable.walletType, "smart_money"),
      eq(whaleEventsTable.passedSignificance, true),
      isNotNull(whaleEventsTable.walletLabel),
      isNotNull(whaleEventsTable.priceUsd),
    ))
    .orderBy(desc(whaleEventsTable.eventTimestamp))
    .limit(30);
  const row = rows.find((candidate) =>
    candidate.marketContext?.candles?.length
    && candidate.transactionHash
    && candidate.previousActivity.length >= 2
  );
  if (!row) {
    throw new Error("No cached Smart Money ETH buy with verified transaction and post-trade candles was found.");
  }

  const priorHashes = row.previousActivity
    .filter((activity) => activity.action === "BUY" || activity.action === "SELL")
    .map((activity) => activity.transactionHash);
  if (priorHashes.length < 2) throw new Error("The selected event has fewer than two saved prior buy/sell references.");
  const priorRows = await db.select().from(whaleEventsTable)
    .where(inArray(whaleEventsTable.transactionHash, priorHashes));
  const priorByHash = new Map(priorRows.map((prior) => [prior.transactionHash, prior]));
  const relatedEvents = row.previousActivity
    .map((activity) => priorByHash.get(activity.transactionHash))
    .filter((prior): prior is typeof row => Boolean(
      prior
      && prior.walletLabel === row.walletLabel
      && prior.blockchain === row.blockchain
      && prior.symbol === row.symbol
      && (prior.action === "BUY" || prior.action === "SELL")
      && prior.eventTimestamp.getTime() < row.eventTimestamp.getTime(),
    ))
    .map(toRelatedEvent)
    .sort((a, b) => Date.parse(a.eventTimestamp) - Date.parse(b.eventTimestamp));
  if (relatedEvents.length < 2) {
    throw new Error("Could not verify two earlier saved DEX buy/sell rows for the same labeled wallet.");
  }

  return {
    event: toV2Event(row),
    relatedEvents,
    scannedAt: source.lastFetchedAt.toISOString(),
  };
}

async function main(): Promise<void> {
  if (!process.argv.includes("--authorize-tts") || !process.argv.includes("--send-preview")) {
    throw new Error("Both --authorize-tts and --send-preview are required for this one-off test.");
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const { event, relatedEvents, scannedAt } = await loadCachedEvent();
  if (!event.marketContext) throw new Error("Selected cached trade has no market candle context.");
  const story = buildWhaleRadarV2Story(event, relatedEvents);
  const wordCount = countWhaleRadarV2Words(story.narration);
  if (wordCount < 220 || wordCount > 400) {
    throw new Error(`Narration word count ${wordCount} is outside the validated long-form range.`);
  }
  await writeFile(path.join(OUTPUT_DIR, "story.txt"), story.narration, "utf8");
  await writeFile(path.join(OUTPUT_DIR, "metadata.json"), JSON.stringify({
    source: "Nansen saved cache; no new source request",
    scannedAt,
    eventTimestamp: event.eventTimestamp,
    blockchain: event.blockchain,
    symbol: event.symbol,
    action: event.action,
    amount: event.amount,
    amountUsd: event.amountUsd,
    priceUsd: event.priceUsd,
    walletLabel: event.walletLabel,
    transactionHash: event.transactionHash,
    dex: event.dex,
    marketData: {
      candleCount: story.metrics.postTradeCandles.length,
      latestCandle: story.metrics.latestCandle,
      priceChangePercent: story.metrics.priceChangePercent,
      timeframe: event.marketContext.timeframe,
    },
    priorActivityCount: relatedEvents.length,
    narrationWordCount: wordCount,
    targetDurationSeconds: TARGET_DURATION_SECONDS,
    publishing: "private preview only; no channel or YouTube publishing",
  }, null, 2), "utf8");

  const provider = getSpeechProvider();
  const voiceId = getConfiguredVoiceId();
  if (provider === "elevenlabs" && !voiceId) {
    throw new Error("The configured ElevenLabs voice ID is missing; no speech was generated.");
  }
  console.info(`Using configured speech provider: ${provider}; narration: ${wordCount} words.`);
  const audio = await generateSpeech(story.narration, voiceId, getElevenLabsModel(), {
    speed: 0.94,
    stability: 0.52,
    similarity: 0.78,
    style: 0.16,
    speakerBoost: true,
  });
  const audioPath = path.join(OUTPUT_DIR, "voice.mp3");
  await writeFile(audioPath, audio);
  const audioDuration = await probeAudioDuration(audioPath);
  const audioTempo = audioDuration / TARGET_DURATION_SECONDS;
  if (audioTempo < 0.85 || audioTempo > 1.15) {
    throw new Error(`Voice duration ${audioDuration.toFixed(1)}s needs an unsafe tempo change; video was not sent.`);
  }

  const htmlPath = path.join(OUTPUT_DIR, "renderer.html");
  const silentVideoPath = path.join(OUTPUT_DIR, "silent-capture.mp4");
  const finalVideoPath = path.join(OUTPUT_DIR, "whale-radar-v2-test.mp4");
  await writeFile(htmlPath, buildWhaleRadarV2Html({
    durationSeconds: TARGET_DURATION_SECONDS,
    event,
    relatedEvents,
    metrics: story.metrics,
    scannedAt,
  }), "utf8");

  await captureAnimation(htmlPath, silentVideoPath, TARGET_DURATION_SECONDS);
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-i", silentVideoPath,
    "-i", audioPath,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-af", `atempo=${audioTempo.toFixed(6)}`,
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "160k",
    "-t", String(TARGET_DURATION_SECONDS),
    "-movflags", "+faststart",
    finalVideoPath,
  ], { timeout: 180_000 });
  await rm(silentVideoPath, { force: true });

  const video = await probeFinalVideo(finalVideoPath);
  if (
    video.video.width !== 1080
    || video.video.height !== 1920
    || video.video.r_frame_rate !== "30/1"
    || Math.abs(video.duration - TARGET_DURATION_SECONDS) > 0.2
    || video.audio?.codec_name !== "aac"
    || video.size > 45 * 1024 * 1024
  ) {
    throw new Error(`Final MP4 did not meet constraints: ${JSON.stringify(video)}.`);
  }

  const destinations = await db.select({ chatId: telegramChatPreferencesTable.chatId })
    .from(telegramChatPreferencesTable)
    .limit(2);
  if (destinations.length !== 1) {
    throw new Error(`Expected exactly one saved Telegram destination; found ${destinations.length}. Video kept locally and not sent.`);
  }
  const sent = await sendWhaleRadarV2PrivatePreview(
    destinations[0]!.chatId,
    finalVideoPath,
    TELEGRAM_CAPTION,
  );
  if (sent.width !== video.video.width || sent.height !== video.video.height) {
    throw new Error("Telegram's accepted preview dimensions differ from the local MP4.");
  }

  console.info(JSON.stringify({
    narrationWords: wordCount,
    voiceDurationSeconds: Number(audioDuration.toFixed(2)),
    videoDurationSeconds: Number(video.duration.toFixed(2)),
    dimensions: `${video.video.width}x${video.video.height}`,
    frameRate: video.video.r_frame_rate,
    sizeBytes: video.size,
    telegramPrivatePreview: "accepted",
    telegramDimensions: `${sent.width}x${sent.height}`,
    published: false,
  }));
}

if (process.argv.includes("--run-whale-radar-v2-preview")) {
  void main()
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Whale Radar V2 preview failed.");
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}

