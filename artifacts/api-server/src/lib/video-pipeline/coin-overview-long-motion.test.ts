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
  buildCoinOverviewLongScribeCaptions,
} from "./coin-overview-long-captions";
import {
  buildCoinOverviewLongMotionGraphics as buildPhraseMotionGraphics,
  buildCoinOverviewLongPhraseBeats,
  buildCoinOverviewLongPhraseRenderChunks,
  getCoinOverviewLongMotionPalette,
} from "./coin-overview-long-edit";
import {
  buildFinanceLongStoryboardSvg,
  getFinanceLongBackgroundPath,
  getFinanceLongThemeIndex,
  renderFinanceLongStoryboardPreview,
  resolveFinanceLongVisualConfig,
  withFinanceLongVisualProfile,
} from "./finance-long-style";
import {
  createFinanceLongMotionFontConfig,
  ensureFinanceLongMotionSequence,
  FINANCE_LONG_ETHEREUM_MOTION_PROFILE,
  FINANCE_LONG_ETHEREUM_MOTION_PROFILE_KEY,
  loadFinanceLongMotionPromptContext,
  parseFinanceLongMotionSequence,
} from "./ethereum-motion-design";
import { resolveVideoCompositionMode } from "./render-profile";

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
  assert.match(captions, /\\kf\d+\\fs\d+\}СПРОС/);
  assert.match(captions, /\\fad\(70,90\)/);
  assert.match(captions, /\\pos\(163,626\)/);
  assert.match(captions, /\\fs1\d\d/);
  assert.doesNotMatch(captions, /\\fs(?:2[5-9]\d|[3-9]\d\d)/);
  assert.match(captions, /\\t\(0,150,\\fscx108\\fscy108\)/);
  assert.match(captions, /\\1c&H[0-9A-F]{8}&\\2c&H[0-9A-F]{8}&/i);
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
  assert.match(wrappedCaptions, /КРИТИЧЕСКИЕ\\N\{\\kf\d+\\fs\d+\}ПАРАМЕТРЫ/);
});

test("Pump-dynamic captions use the reference hierarchy and exact Scribe word starts", () => {
  const plan = buildCoinOverviewLongScribeCaptions({
    words: [
      { text: "Спрос", startMs: 1_000, endMs: 1_400 },
      { text: "покупателей", startMs: 1_450, endMs: 1_800 },
    ],
    durationMs: 3_000,
    width: 1_920,
    height: 1_080,
    paletteMode: "pump-dynamic",
  });

  assert.equal(plan.phraseCount, 1);
  assert.equal(plan.maxWordsPerPhrase, 2);
  assert.match(plan.ass, /Dialogue: 0,0:00:01\.00,0:00:01\.80,KineticYellow/);
  assert.match(plan.ass, /\\kf45\\fs130\}СПРОС\\N\{\\kf35\\fs70\}ПОКУПАТЕЛЕЙ/);
  assert.match(plan.ass, /\\2c&H0000FFEA&/i);
});

test("Finance Long drafts use a stable topic palette and preserve the profile through parsing", () => {
  const script = {
    title: "Обзор актива",
    scenes: [{ scene_number: 1, voice_text: "Рынок и сеть развиваются по-разному.", visual_description: "Схема сети и график." }],
  };
  const profile = withFinanceLongVisualProfile(script, "Монета HYPE", true);
  const config = resolveFinanceLongVisualConfig(
    "YouTube Finance Long Video",
    profile,
    "Монета HYPE",
  );

  assert.equal(config.enabled, true);
  assert.equal(config.themeIndex, getFinanceLongThemeIndex("Монета HYPE"));
  assert.equal(config.keepLegacyCoinOverviewFlag, true);
  assert.equal(
    resolveFinanceLongVisualConfig("YouTube Long Video", profile, "Монета HYPE").enabled,
    false,
  );
  assert.match(getFinanceLongBackgroundPath(config.themeIndex), /graphite|chocolate|plum/u);

  const aptosConfig = resolveFinanceLongVisualConfig(
    "YouTube Finance Long Video",
    withFinanceLongVisualProfile(script, "Обзор монеты Aptos (APT)"),
    "Обзор монеты Aptos (APT)",
  );
  assert.equal(aptosConfig.enabled, true);
  assert.equal(aptosConfig.paletteMode, "aptos");
});

test("Aptos Finance Long always selects animated vector graphics instead of image scenes", () => {
  assert.equal(resolveVideoCompositionMode({
    format: "16:9",
    motionProfile: "finance-long-v4",
  }), "finance-long-v4");
  assert.throws(
    () => resolveVideoCompositionMode({ format: "9:16", motionProfile: "finance-long-v4" }),
    /requires a 16:9 render format/u,
  );

  const palette = getCoinOverviewLongMotionPalette({
    sceneId: 1,
    beatIndex: 0,
    startMs: 0,
    endMs: 1_650,
    text: "Aptos network and transactions",
    motif: "network",
  }, 0, "aptos");
  assert.deepEqual(
    [palette.background, palette.primary, palette.secondary, palette.contrast],
    ["0x080c16", "0x00d7ff", "0xffe600", "0xff604a"],
  );

  const graphics = buildPhraseMotionGraphics({
    width: 640,
    height: 360,
    beats: [{
      sceneId: 1,
      beatIndex: 0,
      startMs: 0,
      endMs: 1_650,
      text: "Aptos network and transactions",
      motif: "network",
    }],
    chunkStartMs: 0,
    chunkEndMs: 1_650,
    paletteMode: "aptos",
  });
  assert.match(graphics, /0x00d7ff/u);
  assert.match(graphics, /0xffe600/u);
  assert.match(graphics, /min\(max\(\(t-/u);
  assert.match(graphics, /gte\(t/u);

  const captions = buildCoinOverviewLongCaptions({
    voices: [{
      sceneId: 1,
      startTime: 0,
      endTime: 1_650,
      text: "Aptos parallel transactions stay synchronized",
    }],
    beats: [{
      sceneId: 1,
      beatIndex: 0,
      startMs: 0,
      endMs: 1_650,
      text: "Aptos parallel transactions stay synchronized",
      motif: "network",
    }],
    durationMs: 1_650,
    width: 1_920,
    height: 1_080,
    paletteMode: "aptos",
  });
  assert.match(captions, /Dialogue: .*KineticYellow/u);
  assert.match(captions, /\\kf\d+\\fs1\d{2}/u);
  assert.match(captions, /\\2c&H00FFD700&/iu);
  assert.doesNotMatch(captions, /KineticPink/u);
});

test("Finance Long storyboard preview renders the approved palette and representative scenes", async () => {
  const preview = await renderFinanceLongStoryboardPreview({
    title: "Обзор цифрового актива",
    themeIndex: getFinanceLongThemeIndex("HYPE"),
    scenes: [
      {
        scene_number: 1,
        voice_text: "Сначала разберём, что именно представляет собой этот проект.",
        visual_description: "Абстрактная композиция с несколькими слоями.",
      },
      {
        scene_number: 2,
        voice_text: "Затем посмотрим на историю запуска и основные этапы.",
        visual_description: "Временная линия с несколькими точками.",
      },
      {
        scene_number: 3,
        voice_text: "В конце отдельно оценим ограничения и риски.",
        visual_description: "Сдержанная графическая композиция.",
      },
    ],
  });

  assert.deepEqual([...preview.subarray(0, 2)], [0xff, 0xd8]);
  assert.ok(preview.length > 20_000);
});

test("Finance Long storyboard is a readable static concept and does not turn narration risks into warning signs", () => {
  const svg = buildFinanceLongStoryboardSvg({
    title: "Разбор Aptos",
    themeIndex: getFinanceLongThemeIndex("Aptos"),
    backgroundJpeg: Buffer.from("test background"),
    scenes: [
      {
        scene_number: 1,
        voice_text: "Сначала разберём риски проекта и его ограничения.",
        visual_description: "Художественный образ цифровой монеты, световые блики и каменная фактура.",
      },
      {
        scene_number: 4,
        voice_text: "Теперь посмотрим, как устроены транзакции.",
        visual_description: "Узлы блокчейн-сети соединены светящимися линиями.",
        image_prompt: "Cinematic network nodes and data flow.",
      },
      {
        scene_number: 8,
        voice_text: "Отдельно обсудим риски и ограничения.",
        visual_description: "Фрагментированный контур защитного щита.",
      },
      {
        scene_number: 12,
        voice_text: "В конце соберём выводы.",
        visual_description: "Документы и этапы развития проекта.",
      },
    ],
  });

  assert.match(svg, /FINANCE LONG · ВИЗУАЛЬНАЯ КОНЦЕПЦИЯ/u);
  assert.match(svg, /ОБРАЗ АКТИВА/u);
  assert.match(svg, /СЕТЬ И СВЯЗИ/u);
  assert.match(svg, /ОГРАНИЧЕНИЯ/u);
  assert.equal((svg.match(/<clipPath id="panel-clip-/gu) || []).length, 4);
  assert.doesNotMatch(svg, /M\d+ \d+ L\d+ \d+ H\d+ Z/u);
});

test("Pump-dynamic graphic palette adds high-contrast panels without changing the default style", () => {
  const beat = {
    sceneId: 1,
    beatIndex: 0,
    startMs: 0,
    endMs: 3_000,
    text: "Спрос покупателей меняет цену",
    motif: "market" as const,
  };
  const defaultGraphics = buildPhraseMotionGraphics({
    width: 1_920,
    height: 1_080,
    beats: [beat],
    chunkStartMs: 0,
    chunkEndMs: 3_000,
  });
  const pumpGraphics = buildPhraseMotionGraphics({
    width: 1_920,
    height: 1_080,
    beats: [beat],
    chunkStartMs: 0,
    chunkEndMs: 3_000,
    paletteMode: "pump-dynamic",
  });

  assert.notEqual(pumpGraphics, defaultGraphics);
  assert.match(pumpGraphics, /0xeaff00/);
  assert.match(pumpGraphics, /0x14d8f0/);
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

test("Finance Long maps market moves and scene descriptions to purposeful visual motifs", () => {
  const fallingMarket = buildCoinOverviewLongPhraseBeats({
    voices: [{
      sceneId: 1,
      startTime: 0,
      endTime: 2_400,
      text: "Сильно упал",
    }],
    durationMs: 2_400,
  });
  const risingMarket = buildCoinOverviewLongPhraseBeats({
    voices: [{
      sceneId: 2,
      startTime: 0,
      endTime: 2_400,
      text: "Стоимость резко выросла",
    }],
    durationMs: 2_400,
  });
  const describedMarket = buildCoinOverviewLongPhraseBeats({
    voices: [{
      sceneId: 3,
      startTime: 0,
      endTime: 2_400,
      text: "Теперь посмотрим на этот результат.",
      visualDescription: "Линейный график цены с отчётливой нисходящей линией.",
    }],
    durationMs: 2_400,
  });
  const describedNetwork = buildCoinOverviewLongPhraseBeats({
    voices: [{
      sceneId: 4,
      startTime: 0,
      endTime: 2_400,
      text: "Aptos — блокчейн, который обрабатывает операции быстро и безопасно.",
      visualDescription: "Параллельное выполнение транзакций на узлах сети.",
    }],
    durationMs: 2_400,
  });
  const describedFlow = buildCoinOverviewLongPhraseBeats({
    voices: [{
      sceneId: 5,
      startTime: 0,
      endTime: 8_000,
      text: "Получается потенциальная связь: больше активности → больше транзакций → больше комиссий → больше сжигания APT.",
      visualDescription: "Параллельная связь между активностью, комиссиями и сжиганием токенов.",
    }],
    durationMs: 8_000,
  });

  assert.equal(fallingMarket[0]?.motif, "market");
  assert.equal(risingMarket[0]?.motif, "market");
  assert.equal(describedMarket[0]?.motif, "market");
  assert.equal(describedNetwork[0]?.motif, "network");
  assert.equal(describedFlow[0]?.motif, "risk");
  assert.ok(describedFlow.every((beat) => beat.motif === "risk"));
  const parallelGraphic = buildPhraseMotionGraphics({
    width: 1_280,
    height: 720,
    beats: describedNetwork,
    chunkStartMs: 0,
    chunkEndMs: 2_400,
    paletteMode: "aptos",
  });
  for (const label of ["ПАРАЛЛЕЛЬНАЯ ОБРАБОТКА", "ОПЕРАЦИЯ 01", "ОПЕРАЦИЯ 02", "ОПЕРАЦИЯ 03", "ОБРАБОТКА", "ГОТОВО"]) {
    assert.match(parallelGraphic, new RegExp(label, "u"));
  }
  assert.doesNotMatch(parallelGraphic, /text='○'/u);

  const flowGraphic = buildPhraseMotionGraphics({
    width: 640,
    height: 360,
    beats: describedFlow,
    chunkStartMs: 0,
    chunkEndMs: 2_400,
    paletteMode: "aptos",
  });
  for (const label of ["АКТИВНОСТЬ", "ТРАНЗАКЦИИ", "КОМИССИИ", "СЖИГАНИЕ APT"]) {
    assert.match(flowGraphic, new RegExp(label, "u"));
  }
  const neutralMarketGraphic = buildPhraseMotionGraphics({
    width: 640,
    height: 360,
    beats: [{
      ...describedMarket[0]!,
      visualDescription: "Линейный график цены без заданного тренда.",
    }],
    chunkStartMs: 0,
    chunkEndMs: 2_400,
    paletteMode: "aptos",
  });
  const fallingMarketGraphic = buildPhraseMotionGraphics({
    width: 640,
    height: 360,
    beats: describedMarket,
    chunkStartMs: 0,
    chunkEndMs: 2_400,
    paletteMode: "aptos",
  });
  assert.notEqual(fallingMarketGraphic, neutralMarketGraphic);
});

test("Aptos falling-market phrase renders a bright graph that draws downward", async () => {
  const width = 640;
  const height = 360;
  const durationMs = 3_300;
  const beats = buildCoinOverviewLongPhraseBeats({
    voices: [{
      sceneId: 1,
      startTime: 0,
      endTime: durationMs,
      text: "Сильно упал",
    }],
    durationMs,
  });
  assert.equal(beats[0]?.motif, "market");

  const graphics = buildPhraseMotionGraphics({
    width,
    height,
    beats,
    chunkStartMs: 0,
    chunkEndMs: durationMs,
    paletteMode: "aptos",
  });
  const { mkdtemp, readFile, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), "aptos-market-graph-"));
  const filterPath = join(directory, "graphics.filter");
  const videoPath = join(directory, "market-graph.mp4");
  const framePath = join(directory, "market-frame.rgb");

  try {
    await writeFile(filterPath, graphics, "utf8");
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-f", "lavfi",
      "-i", `color=c=0x080c16:s=${width}x${height}:r=30:d=3.3`,
      "-filter_script:v", filterPath,
      "-t", "3.3",
      "-an",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      videoPath,
    ], { maxBuffer: 20 * 1024 * 1024 });
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-ss", "1.2",
      "-i", videoPath,
      "-frames:v", "1",
      "-pix_fmt", "rgb24",
      "-f", "rawvideo",
      framePath,
    ]);

    const pixels = await readFile(framePath);
    assert.equal(pixels.length, width * height * 3);
    const cyanYsByColumn: number[][] = Array.from({ length: width }, () => []);
    for (let y = 50; y < 280; y += 1) {
      for (let x = 35; x < width - 35; x += 1) {
        const offset = (y * width + x) * 3;
        const red = pixels[offset]!;
        const green = pixels[offset + 1]!;
        const blue = pixels[offset + 2]!;
        if (red < 105 && green > 130 && blue > 155) cyanYsByColumn[x]!.push(y);
      }
    }
    const meanLineY = (startX: number, endX: number) => {
      const ys = cyanYsByColumn.slice(startX, endX).flat();
      assert.ok(ys.length > 20, `Expected the bright chart stroke between x=${startX} and x=${endX}`);
      return ys.reduce((sum, y) => sum + y, 0) / ys.length;
    };
    const leftY = meanLineY(70, 190);
    const rightY = meanLineY(450, 575);
    assert.ok(
      rightY - leftY > 45,
      `Expected a clearly falling chart line, got left y=${leftY.toFixed(1)} and right y=${rightY.toFixed(1)}`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Ethereum-preview motion profile stays isolated, keeps the 60 FPS style, and parses scene sequences", async () => {
  const metadata = {
    [FINANCE_LONG_ETHEREUM_MOTION_PROFILE_KEY]: FINANCE_LONG_ETHEREUM_MOTION_PROFILE,
  };
  const motionConfig = resolveFinanceLongVisualConfig(
    "YouTube Finance Long Video",
    metadata,
    "Solana",
  );
  const standardConfig = resolveFinanceLongVisualConfig(
    "YouTube Finance Long Video",
    {},
    "Solana",
  );
  assert.equal(motionConfig.paletteMode, "ethereum-motion");
  assert.equal(motionConfig.frameRate, 60);
  assert.equal(standardConfig.paletteMode, "default");
  assert.equal(standardConfig.frameRate, 30);

  const visualDescription = [
    "Техническая сетка раскрывается вокруг узлов блокчейна.",
    "MOTION_SEQUENCE: [TECHNICAL_GRID] координаты проявляются по линиям | [NETWORK_REVEAL] видны связанные узлы | [DATA_FLOW] сигнал проходит между узлами | [TIMELINE] отмечаются этапы протокола | [MORPH_TRANSITION] сетка перестраивается к следующей сцене",
  ].join("\n");
  const events = parseFinanceLongMotionSequence(visualDescription);
  assert.equal(events.length, 5);
  const normalizedDescription = ensureFinanceLongMotionSequence("Узлы сети и график операций.");
  assert.equal(parseFinanceLongMotionSequence(normalizedDescription).length, 6);

  const voices = [{
    sceneId: 1,
    startTime: 0,
    endTime: 5_000,
    text: "Данные проходят через сеть и подтверждают операции.",
    visualDescription,
  }];
  const genericBeats = buildCoinOverviewLongPhraseBeats({ voices, durationMs: 5_000 });
  assert.ok(genericBeats.every((beat) => !beat.motionEvents));
  const beats = buildCoinOverviewLongPhraseBeats({
    voices,
    durationMs: 5_000,
    useEthereumMotionSequence: true,
  });
  assert.ok(beats.length > 0);
  assert.ok(beats.every((beat) => beat.motionEvents?.length === 5));
  assert.deepEqual(
    beats[0]!.motionEvents!.map(({ startMs, endMs }) => [startMs, endMs]),
    [[0, 1_000], [1_000, 2_000], [2_000, 3_000], [3_000, 4_000], [4_000, 5_000]],
  );

  const graphics = buildPhraseMotionGraphics({
    width: 1_920,
    height: 1_080,
    beats,
    chunkStartMs: 0,
    chunkEndMs: 5_000,
    paletteMode: "ethereum-motion",
  });
  assert.match(graphics, /0xff5a67/u);
  assert.match(graphics, /0x070b16/u);
  const buildSingleEventGraphics = (kind: "FINANCIAL_CHART" | "NETWORK_REVEAL") =>
    buildPhraseMotionGraphics({
      width: 1_920,
      height: 1_080,
      beats: [{
        ...beats[0]!,
        startMs: 0,
        endMs: 5_000,
        motionEvents: [{ kind, description: "test event", startMs: 0, endMs: 5_000 }],
      }],
      chunkStartMs: 0,
      chunkEndMs: 5_000,
      paletteMode: "ethereum-motion",
    });
  const chartGraphics = buildSingleEventGraphics("FINANCIAL_CHART");
  const networkGraphics = buildSingleEventGraphics("NETWORK_REVEAL");
  assert.notEqual(chartGraphics, networkGraphics);
  assert.match(chartGraphics, /0x252b38@0\.96/u);
  assert.match(chartGraphics, /0xe5d438/u);
  const captions = buildCoinOverviewLongCaptions({
    voices,
    beats,
    durationMs: 5_000,
    width: 1_920,
    height: 1_080,
    paletteMode: "ethereum-motion",
  });
  assert.match(captions, /Montserrat/u);
  assert.ok(captions.includes(String.raw`\an2\pos(960,1004)\fs70\fnMontserrat ExtraBold`));
  assert.match(captions, /ОПЕРАЦИИ/u);
  assert.doesNotMatch(captions, /ОПЕРАЦИИ\./u);

  const storyboard = buildFinanceLongStoryboardSvg({
    title: "Обзор Solana",
    themeIndex: 0,
    motionDesignProfile: "ethereum-preview-v1",
    scenes: [{
      scene_number: 1,
      voice_text: voices[0]!.text,
      visual_description: normalizedDescription,
    }],
  });
  assert.match(storyboard, /#070B16/u);
  assert.match(storyboard, /#FF5A67/u);
  assert.match(storyboard, /Montserrat/u);
  const promptContext = await loadFinanceLongMotionPromptContext();
  assert.match(promptContext, /MOTION_DESIGN_SYSTEM\.md/u);
  assert.match(promptContext, /VIDEO_PIPELINE\.md/u);
});

test("Ethereum motion event graphics render at 60 FPS with the fixed palette", async () => {
  const visualDescription = [
    "Техническая сетка раскрывается вокруг узлов блокчейна.",
    "MOTION_SEQUENCE: [TECHNICAL_GRID] появляется сетка | [NETWORK_REVEAL] раскрываются узлы | [DATA_FLOW] проходит сигнал | [FINANCIAL_CHART] строится график | [TIMELINE] отмечаются этапы | [COMPARISON] сопоставляются формы | [PARTICLE_FLOW] импульсы движутся по полю | [MORPH_TRANSITION] геометрия меняется",
  ].join("\n");
  const voices = [{
    sceneId: 1,
    startTime: 0,
    endTime: 3_000,
    text: "Сеть подтверждает переводы между пользователями.",
    visualDescription,
  }];
  const beats = buildCoinOverviewLongPhraseBeats({
    voices,
    durationMs: 3_000,
    useEthereumMotionSequence: true,
  });
  assert.equal(beats[0]!.motionEvents?.length, 8);
  const graphics = buildPhraseMotionGraphics({
    width: 640,
    height: 360,
    beats,
    chunkStartMs: 0,
    chunkEndMs: 3_000,
    paletteMode: "ethereum-motion",
  });
  const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), "ethereum-motion-graphics-"));
  try {
    const filterPath = join(directory, "graphics.filter");
    const outputPath = join(directory, "graphics-60fps.mp4");
    await writeFile(filterPath, graphics, "utf8");
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-f", "lavfi",
      "-i", "color=c=0x070b16:s=640x360:r=60:d=3",
      "-filter_script:v", filterPath,
      "-t", "3",
      "-an",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      "-r", "60",
      outputPath,
    ]);
    const probe = JSON.parse((await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "stream=codec_name,width,height,r_frame_rate",
      "-of", "json",
      outputPath,
    ])).stdout) as {
      streams?: Array<{ codec_name?: string; width?: number; height?: number; r_frame_rate?: string }>;
    };
    const video = probe.streams?.find((stream) => stream.codec_name === "h264");
    assert.equal(video?.width, 640);
    assert.equal(video?.height, 360);
    assert.equal(video?.r_frame_rate, "60/1");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Ethereum motion captions resolve Montserrat and render at 60 FPS", async () => {
  const width = 640;
  const height = 360;
  const durationMs = 1_500;
  const voices = [{
    sceneId: 1,
    startTime: 0,
    endTime: durationMs,
    text: "Техническая сетка соединяет узлы.",
  }];
  const captions = buildCoinOverviewLongCaptions({
    voices,
    durationMs,
    width,
    height,
    paletteMode: "ethereum-motion",
  });
  const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), "ethereum-motion-render-"));
  try {
    const fontConfig = await createFinanceLongMotionFontConfig(directory);
    const fontMatch = await execFileAsync(
      "fc-match",
      ["-f", "%{file}|%{style}", "Montserrat ExtraBold"],
      { env: fontConfig.env },
    );
    assert.match(fontMatch.stdout, /Montserrat-ExtraBold\.ttf\|ExtraBold/u);

    const captionsPath = join(directory, "captions.ass");
    const outputPath = join(directory, "motion-60fps.mp4");
    await writeFile(captionsPath, captions, "utf8");
    const rendered = await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "verbose",
      "-y",
      "-f", "lavfi",
      "-i", `color=c=0x070b16:s=${width}x${height}:r=60:d=${durationMs / 1000}`,
      "-vf", `subtitles=${captionsPath}`,
      "-t", String(durationMs / 1000),
      "-an",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      "-r", "60",
      outputPath,
    ], { env: fontConfig.env, maxBuffer: 5 * 1024 * 1024 });
    assert.match(rendered.stderr, /Montserrat/u);

    const probe = await execFileAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=codec_name,width,height,r_frame_rate",
      "-of", "json",
      outputPath,
    ]);
    const streams = JSON.parse(probe.stdout) as {
      streams?: Array<{ codec_name?: string; width?: number; height?: number; r_frame_rate?: string }>;
    };
    assert.deepEqual(streams.streams?.[0], {
      codec_name: "h264",
      width,
      height,
      r_frame_rate: "60/1",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
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

test("30-second phrase-led motion sample changes inside the central graphic area", async () => {
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
  const captions = buildCoinOverviewLongCaptions({
    voices,
    durationMs,
    width,
    height,
    beats,
    chunkStartMs: 0,
    chunkEndMs: durationMs,
  });
  assert.match(captions, /Style: KineticYellow/);
  assert.match(captions, /ЦИФРОВОЙ/);
  assert.doesNotMatch(captions, /\\fs(?:1[6-9]\d|[2-9]\d\d)/);
  const subtitleCaptions = buildCoinOverviewLongPhraseCaptions({
    voices,
    durationMs,
    width,
    height,
    chunkStartMs: 0,
    chunkEndMs: durationMs,
  });
  assert.match(subtitleCaptions, /Style: Subtitle,DejaVu Sans,48/);
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
    const frameHashesResult = await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-i", outputPath,
      "-vf", "fps=0.5,crop=iw*0.82:ih*0.7:iw*0.09:ih*0.12,scale=64:56:flags=area,format=gray",
      "-an",
      "-f", "framemd5",
      "-",
    ], { maxBuffer: 2 * 1024 * 1024 });
    const frameHashes = frameHashesResult.stdout
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => line.split(",").at(-1)?.trim())
      .filter((hash): hash is string => Boolean(hash));
    assert.ok(frameHashes.length >= 12, "The 30-second sample should include regular 2-second motion checks");
    assert.equal(
      new Set(frameHashes).size,
      frameHashes.length,
      "The central graph-and-kinetic-text area should visibly change at every 2-second sample",
    );
    if (process.env["KEEP_COIN_OVERVIEW_SAMPLE"] !== "1") {
      await rm(directory, { recursive: true, force: true });
    }
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
});