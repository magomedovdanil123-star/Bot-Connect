import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { renderFinancialTopicShortWithAudioTrack } from "./financial-short-renderer";
import { createTechnicalAnalysisPlan } from "./technical-analysis-plan";
import type { TechnicalAnalysisCandle, TechnicalAnalysisSnapshot } from "./technical-analysis-data";

const execFileAsync = promisify(execFile);
const FOUR_HOURS_MS = 4 * 60 * 60 * 1_000;
const START_TIME = Date.UTC(2026, 8, 22);

function candle(index: number): TechnicalAnalysisCandle {
  const openTime = START_TIME + index * FOUR_HOURS_MS;
  return {
    openTime,
    closeTime: openTime + FOUR_HOURS_MS - 1,
    open: 100 + (index % 3) * 0.2,
    high: 101 + (index % 2) * 0.2,
    low: 99 - (index % 2) * 0.2,
    close: 100 + (index % 2) * 0.1,
    volume: 1,
    quoteVolume: 100,
  };
}

function snapshot(
  outcome: TechnicalAnalysisSnapshot["outcome"],
  direction: "long" | "short" = "long",
): TechnicalAnalysisSnapshot {
  const stop = direction === "long" ? 98 : 102;
  const target = direction === "long" ? 104 : 96;
  return {
    source: "Binance Spot",
    pair: "BTCUSDT",
    timeframe: "4h",
    retrievedAt: "2026-09-28T00:00:00.000Z",
    signalTime: "2026-09-27T12:00:00.000Z",
    rangeStartTime: "2026-09-22T00:00:00.000Z",
    rangeEndTime: "2026-09-28T00:00:00.000Z",
    direction,
    pattern: direction === "long"
      ? { type: "ascending_triangle", label: "Восходящий треугольник" }
      : { type: "descending_triangle", label: "Нисходящий треугольник" },
    entry: 100,
    stop,
    target,
    riskPercent: 2,
    quantity: 10,
    notionalUsd: 1_000,
    outcome,
    exit: outcome === "target" ? target : outcome === "stop" ? stop : direction === "long" ? 102 : 98,
    pnlUsd: outcome === "target" ? 40 : outcome === "stop" ? -20 : 20,
    bars: outcome === "time_exit" ? 12 : 4,
    setupCandles: Array.from({ length: 24 }, (_, index) => candle(index)),
    futureCandles: Array.from({ length: 12 }, (_, index) => candle(24 + index)),
  };
}

function voiceText(plan: ReturnType<typeof createTechnicalAnalysisPlan>, index: number): string {
  const text = plan.beats[index]?.voiceText;
  assert.ok(text);
  return text;
}

test("plan fixes levels, reveals the disclaimer, then ends with the spoken Bybit CTA", () => {
  const plan = createTechnicalAnalysisPlan("BTC", snapshot("target"));
  assert.equal(plan.beats.length, 7);
  assert.match(voiceText(plan, 0), /Привет, друзья!/);
  assert.match(voiceText(plan, 0), /что произошло после него/i);
  assert.match(voiceText(plan, 0), /исторический сигнал по BTC/i);
  assert.match(voiceText(plan, 0), /график взят из диапазона с/i);
  assert.match(voiceText(plan, 0), /22 сентября 2026/i);
  assert.match(voiceText(plan, 0), /28 сентября 2026/i);
  assert.match(voiceText(plan, 0), /только то, что было видно в этот момент/i);
  assert.match(voiceText(plan, 1), /техническая гипотеза/i);
  assert.match(voiceText(plan, 1), /не является гарантией/i);
  assert.match(voiceText(plan, 2), /покупку актива на тысячу долларов без плеча/i);
  assert.match(voiceText(plan, 2), /заранее видим риск/i);
  assert.match(voiceText(plan, 3), /открываем продолжение графика/i);
  assert.match(voiceText(plan, 4), /историческим уровням/i);
  assert.doesNotMatch(plan.beats.slice(0, 3).map((beat) => beat.voiceText ?? "").join(" "), /тейк-профит был достигнут/i);
  assert.doesNotMatch(plan.script, /выбрали.*после.*результат/i);
  assert.equal(plan.beats.filter((beat) => beat.soundEffect === "money_ding").length, 1);
  assert.match(voiceText(plan, 5), /не инвестиционная рекомендация/i);
  assert.equal(plan.beats.at(-1)?.isCta, true);
  assert.match(plan.cta, /BPJLZJ/);
  assert.match(voiceText(plan, 6), /отсканируйте QR-код/i);
  assert.match(voiceText(plan, 6), /BPJLZJ/);
});

test("short narration distinguishes the modeled position from an executed futures trade", () => {
  const plan = createTechnicalAnalysisPlan("BTC", snapshot("target", "short"));
  assert.match(voiceText(plan, 1), /это шорт/i);
  assert.match(voiceText(plan, 2), /короткую позицию/i);
  assert.match(voiceText(plan, 2), /фактическую маржинальную или фьючерсную сделку не моделируем/i);
  assert.match(voiceText(plan, 4), /валовый результат по тейку составил бы плюс/i);
});

test("non-positive historical results cannot be turned into a plan", () => {
  assert.throws(
    () => createTechnicalAnalysisPlan("BTC", snapshot("stop")),
    /расчётный результат/i,
  );
});

test("time-exit narration names the full 12-candle horizon", () => {
  const plan = createTechnicalAnalysisPlan("BTC", snapshot("time_exit"));
  assert.ok(plan.beats.some((beat) => beat.soundEffect === "money_ding"));
  assert.match(voiceText(plan, 3), /двенадцать четырёхчасовых свечей/i);
  assert.match(voiceText(plan, 3), /выход по времени/i);
  assert.match(voiceText(plan, 4), /без достижения тейка/i);
  assert.match(voiceText(plan, 4), /историческому окну/i);
});

test("technical analysis render adds the supplied Bybit banner in its final CTA scene", async () => {
  const directory = await mkdtemp(join(tmpdir(), "technical-analysis-cta-test-"));
  try {
    const audioPath = join(directory, "voice.wav");
    const videoPath = join(directory, "technical-analysis.mp4");
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "lavfi",
      "-i", "sine=frequency=440:duration=2.1",
      "-c:a", "pcm_s16le",
      audioPath,
    ]);

    const rendered = await renderFinancialTopicShortWithAudioTrack(
      createTechnicalAnalysisPlan("BTC", snapshot("target")),
      audioPath,
      [300, 600, 900, 1_200, 1_500, 1_800],
    );
    await writeFile(videoPath, rendered.buffer);

    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "stream=codec_type,width,height",
      "-of", "json",
      videoPath,
    ]);
    const streams = (JSON.parse(stdout) as {
      streams: Array<{ codec_type: string; width?: number; height?: number }>;
    }).streams;
    assert.ok(streams.some((stream) => stream.codec_type === "video" && stream.width === 1_080 && stream.height === 1_920));
    assert.ok(streams.some((stream) => stream.codec_type === "audio"));
    assert.equal(rendered.sceneCount, 7);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});