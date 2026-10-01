import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import {
  buildCoinOverviewLongRenderChunks,
  buildCoinOverviewLongSceneClipDurations,
  buildCoinOverviewLongCameraFilter,
  buildCoinOverviewLongMotionGraphics,
} from "./coin-overview-long-motion";
import {
  buildCoinOverviewLongCaptions,
  buildCoinOverviewLongPhraseCaptions,
} from "./coin-overview-long-captions";
import {
  buildCoinOverviewLongMotionGraphics as buildPhraseMotionGraphics,
  buildCoinOverviewLongPhraseBeats,
  buildCoinOverviewLongPhraseRenderChunks,
} from "./coin-overview-long-edit";

const execFileAsync = promisify(execFile);

test("coin long overview selects scene-relevant visual sketches", () => {
  const network = buildCoinOverviewLongMotionGraphics({
    width: 640,
    height: 360,
    durationSeconds: 12,
    voiceText: "Как устроены сеть и транзакции проекта",
    sceneIndex: 0,
  });
  const timeline = buildCoinOverviewLongMotionGraphics({
    width: 640,
    height: 360,
    durationSeconds: 12,
    voiceText: "История запуска и развития проекта",
    sceneIndex: 0,
  });

  assert.match(network, /drawbox=/);
  assert.notEqual(network, timeline);
  assert.match(network, /0x70dec8@0\.62/);
  assert.match(timeline, /0xe6bd70@0\.66/);
});

test("coin long overview visuals cover narration gaps and the full mixed-audio tail", () => {
  const targetDurationMs = 20_000;
  const transitionDurationMs = 140;
  const clipDurations = buildCoinOverviewLongSceneClipDurations({
    sceneIds: [1, 2, 3],
    voices: [
      { sceneId: 1, startTime: 0, endTime: 5_000 },
      { sceneId: 2, startTime: 7_000, endTime: 12_000 },
      { sceneId: 3, startTime: 14_000, endTime: 19_000 },
    ],
    durationMs: targetDurationMs,
    transitionDurationMs,
  });

  assert.deepEqual(clipDurations, [7_140, 7_140, 6_000]);
  assert.equal(
    clipDurations.reduce((sum, duration) => sum + duration, 0) - transitionDurationMs * 2,
    targetDurationMs,
  );
});

test("coin long overview render chunks land on the nearest scene boundary around two minutes", () => {
  const sceneIds = [1, 2, 3, 4, 5];
  const starts = [0, 48_000, 115_000, 178_000, 245_000];
  const chunks = buildCoinOverviewLongRenderChunks({
    sceneIds,
    voices: sceneIds.map((sceneId, index) => ({
      sceneId,
      startTime: starts[index]!,
      endTime: starts[index]! + 30_000,
    })),
    durationMs: 300_000,
  });

  assert.deepEqual(chunks, [
    { startMs: 0, endMs: 115_000 },
    { startMs: 115_000, endMs: 245_000 },
    { startMs: 245_000, endMs: 300_000 },
  ]);
  assert.equal(chunks.at(-1)!.endMs, 300_000);
});

test("coin long overview keeps a long scene intact rather than cutting dialogue mid-sentence", () => {
  const chunks = buildCoinOverviewLongRenderChunks({
    sceneIds: [1, 2, 3],
    voices: [
      { sceneId: 1, startTime: 0, endTime: 30_000 },
      { sceneId: 2, startTime: 30_000, endTime: 35_000 },
      { sceneId: 3, startTime: 205_000, endTime: 230_000 },
    ],
    durationMs: 260_000,
  });

  assert.deepEqual(chunks, [
    { startMs: 0, endMs: 205_000 },
    { startMs: 205_000, endMs: 260_000 },
  ]);
});

test("coin long overview skips scene starts where the previous voice is still speaking", () => {
  const sceneIds = [1, 2, 3, 4];
  const chunks = buildCoinOverviewLongRenderChunks({
    sceneIds,
    voices: [
      { sceneId: 1, startTime: 0, endTime: 30_000 },
      { sceneId: 2, startTime: 100_000, endTime: 135_000 },
      { sceneId: 3, startTime: 130_000, endTime: 160_000 },
      { sceneId: 4, startTime: 250_000, endTime: 280_000 },
    ],
    durationMs: 300_000,
  });

  assert.deepEqual(chunks, [
    { startMs: 0, endMs: 100_000 },
    { startMs: 100_000, endMs: 250_000 },
    { startMs: 250_000, endMs: 300_000 },
  ]);
});

test("coin long overview captions animate timed phrases with changing layouts and accents", () => {
  const captions = buildCoinOverviewLongCaptions({
    voices: [
      {
        sceneId: 1,
        startTime: 0,
        endTime: 8_000,
        text: "Спрос покупателей меняет следующую цену. Продавцы двигают рынок вниз.",
      },
    ],
    durationMs: 8_000,
    width: 1920,
    height: 1080,
  });

  assert.match(captions, /KineticYellow/);
  assert.match(captions, /KineticCyan/);
  assert.match(captions, /\\kf\d+\}СПРОС/);
  assert.match(captions, /\\fad\(90,120\)/);
  assert.match(captions, /\\pos\(163,626\)/);
  assert.match(captions, /\\fs2\d\d/);
  assert.match(captions, /\\t\(0,180,\\fscx100\\fscy100\)/);
  assert.doesNotMatch(captions, /Style: Word,Arial/);

  const wrappedCaptions = buildCoinOverviewLongCaptions({
    voices: [{
      sceneId: 1,
      startTime: 0,
      endTime: 2_000,
      text: "Критические параметры",
    }],
    durationMs: 2_000,
    width: 1920,
    height: 1080,
  });
  assert.match(wrappedCaptions, /КРИТИЧЕСКИЕ\\N\{\\kf\d+\}ПАРАМЕТРЫ/);
});

test("coin long overview ASS captions are accepted by FFmpeg for styled rendering", async () => {
  const captions = buildCoinOverviewLongCaptions({
    voices: [{
      sceneId: 1,
      startTime: 0,
      endTime: 2_500,
      text: "Покупатели двигают цену.",
    }],
    durationMs: 3_000,
    width: 640,
    height: 360,
  });
  const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), "coin-captions-test-"));
  try {
    const captionsPath = join(directory, "captions.ass");
    await writeFile(captionsPath, captions, "utf8");
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-f", "lavfi",
      "-i", "color=c=0x101318:s=640x360:r=30:d=3",
      "-vf", `subtitles=${captionsPath}`,
      "-frames:v", "30",
      "-f", "null", "-",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("coin long overview motion filters are accepted by FFmpeg", async () => {
  const width = 640;
  const height = 360;
  const graphics = buildCoinOverviewLongMotionGraphics({
    width,
    height,
    durationSeconds: 12,
    voiceText: "История сети, рыночный риск и изменения цены",
    sceneIndex: 2,
  });
  const camera = buildCoinOverviewLongCameraFilter({
    width,
    height,
    frames: 45,
    sceneIndex: 2,
  });

  await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-f", "lavfi",
    "-i", `color=c=black:s=${width}x${height}:r=30:d=1.5`,
    "-vf", graphics,
    "-frames:v", "30",
    "-f", "null", "-",
  ]);
  await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-f", "lavfi",
    "-i", `color=c=black:s=${width}x${height}:r=30:d=1.5`,
    "-vf", camera,
    "-frames:v", "30",
    "-f", "null", "-",
  ]);

  assert.match(camera, /zoompan=/);
});

test("long overview phrases become distinct, timed motion scenes", () => {
  const beats = buildCoinOverviewLongPhraseBeats({
    voices: [{
      sceneId: 1,
      startTime: 0,
      endTime: 30_000,
      text: "Цифровой актив существует в сети. Рыночная цена может меняться быстро. " +
        "Записи переводов подтверждаются узлами. История протокола начинается с запуска. " +
        "Ключ защищает доступ, но не убирает риск.",
    }],
    durationMs: 30_000,
  });

  assert.ok(beats.length >= 5);
  assert.equal(beats[0]!.startMs, 0);
  assert.equal(beats.at(-1)!.endMs, 30_000);
  assert.ok(beats.every((beat) => beat.endMs > beat.startMs));
  const motifs = new Set(beats.filter((beat) => beat.text).map((beat) => beat.motif));
  for (const motif of ["asset", "market", "network", "record", "timeline", "access", "risk"]) {
    assert.ok(motifs.has(motif as (typeof beats)[number]["motif"]), `expected a distinct ${motif} scene`);
  }
});

test("long overview chunk boundaries align with phrase scene endings", () => {
  const text = Array.from({ length: 24 }, (_, index) =>
    `Сцена номер ${index + 1} объясняет устройство сети и записи.`,
  ).join(" ");
  const beats = buildCoinOverviewLongPhraseBeats({
    voices: [{ sceneId: 1, startTime: 0, endTime: 130_000, text }],
    durationMs: 130_000,
  });
  const chunks = buildCoinOverviewLongPhraseRenderChunks({
    beats,
    durationMs: 130_000,
    targetDurationMs: 60_000,
  });

  assert.ok(chunks.length >= 2);
  assert.equal(chunks[0]!.startMs, 0);
  assert.equal(chunks.at(-1)!.endMs, 130_000);
  for (const chunk of chunks.slice(0, -1)) {
    assert.ok(beats.some((beat) => beat.endMs === chunk.endMs));
    assert.ok(chunk.endMs - chunk.startMs <= 75_000);
  }
});

test("30-second phrase-led motion sample encodes as 16:9 H.264 at 30 FPS", async () => {
  const width = 640;
  const height = 360;
  const durationMs = 30_000;
  const voices = [{
    sceneId: 1,
    startTime: 0,
    endTime: durationMs,
    text: "Цифровой актив существует в сети. Рыночная цена может меняться быстро. " +
      "Записи переводов подтверждаются узлами. История протокола начинается с запуска. " +
      "Ключ защищает доступ, но не убирает риск.",
  }];
  const beats = buildCoinOverviewLongPhraseBeats({ voices, durationMs });
  const graphics = buildPhraseMotionGraphics({
    width,
    height,
    beats,
    chunkStartMs: 0,
    chunkEndMs: durationMs,
  });
  const captions = buildCoinOverviewLongPhraseCaptions({
    voices,
    durationMs,
    width,
    height,
    chunkStartMs: 0,
    chunkEndMs: durationMs,
  });
  assert.match(captions, /Style: Subtitle,DejaVu Sans,48/);
  assert.match(captions, /Цифровой актив/);
  assert.doesNotMatch(captions, /ЦИФРОВОЙ АКТИВ/);
  assert.doesNotMatch(captions, /\\fs(?:[6-9]\d|[1-9]\d{2})/);
  const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), "coin-overview-long-motion-"));
  const captionsPath = join(directory, "captions.ass");
  const outputPath = join(directory, "30-second-sample.mp4");
  await writeFile(captionsPath, captions, "utf8");

  try {
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-f", "lavfi",
      "-i", `color=c=0x080d0d:s=${width}x${height}:r=30:d=30`,
      "-vf", `${graphics},subtitles=${captionsPath}`,
      "-t", "30",
      "-an", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-r", "30",
      outputPath,
    ], { maxBuffer: 20 * 1024 * 1024 });
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration:stream=width,height,r_frame_rate",
      "-of", "json", outputPath,
    ]);
    const probe = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ width?: number; height?: number; r_frame_rate?: string }>;
    };
    assert.equal(Number(probe.format?.duration), 30);
    assert.ok(probe.streams?.some((stream) =>
      stream.width === width && stream.height === height && stream.r_frame_rate === "30/1",
    ));
    if (process.env["KEEP_COIN_OVERVIEW_SAMPLE"] !== "1") {
      await rm(directory, { recursive: true, force: true });
    }
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
});