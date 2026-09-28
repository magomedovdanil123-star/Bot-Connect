import assert from "node:assert/strict";
import test from "node:test";
import { createTechnicalAnalysisPlan } from "./technical-analysis-plan";
import type { TechnicalAnalysisSnapshot } from "./technical-analysis-data";

function snapshot(outcome: TechnicalAnalysisSnapshot["outcome"]): TechnicalAnalysisSnapshot {
  return {
    source: "Binance Spot",
    pair: "BTCUSDT",
    timeframe: "4h",
    retrievedAt: "2026-09-28T00:00:00.000Z",
    signalTime: "2026-09-27T12:00:00.000Z",
    rangeStartTime: "2026-09-22T00:00:00.000Z",
    rangeEndTime: "2026-09-28T00:00:00.000Z",
    direction: "long",
    pattern: { type: "ascending_triangle", label: "Восходящий треугольник" },
    entry: 100,
    stop: 98,
    target: 104,
    riskPercent: 2,
    quantity: 10,
    notionalUsd: 1_000,
    outcome,
    exit: outcome === "target" ? 104 : outcome === "stop" ? 98 : 102,
    pnlUsd: outcome === "target" ? 40 : outcome === "stop" ? -20 : 20,
    bars: outcome === "time_exit" ? 12 : 4,
    setupCandles: [],
    futureCandles: [],
  };
}

function voiceText(plan: ReturnType<typeof createTechnicalAnalysisPlan>, index: number): string {
  const text = plan.beats[index]?.voiceText;
  assert.ok(text);
  return text;
}

test("plan fixes levels before revealing later candles and ends with the disclaimer", () => {
  const plan = createTechnicalAnalysisPlan("BTC", snapshot("target"));
  assert.equal(plan.beats.length, 6);
  assert.match(voiceText(plan, 0), /Привет, друзья!/);
  assert.match(voiceText(plan, 0), /что произошло после него/i);
  assert.match(voiceText(plan, 0), /исторический сигнал по BTC/i);
  assert.match(voiceText(plan, 0), /график взят из диапазона с/i);
  assert.match(voiceText(plan, 0), /22 сентября 2026/i);
  assert.match(voiceText(plan, 0), /28 сентября 2026/i);
  assert.match(voiceText(plan, 0), /только то, что было видно в этот момент/i);
  assert.match(voiceText(plan, 1), /техническая гипотеза/i);
  assert.match(voiceText(plan, 1), /не является гарантией/i);
  assert.match(voiceText(plan, 2), /вход на тысячу долларов без плеча/i);
  assert.match(voiceText(plan, 2), /заранее видим риск/i);
  assert.match(voiceText(plan, 3), /открываем продолжение графика/i);
  assert.match(voiceText(plan, 4), /историческим уровням/i);
  assert.doesNotMatch(plan.beats.slice(0, 3).map((beat) => beat.voiceText ?? "").join(" "), /тейк-профит был достигнут/i);
  assert.doesNotMatch(plan.script, /выбрали.*после.*результат/i);
  assert.equal(plan.beats.filter((beat) => beat.soundEffect === "money_ding").length, 1);
  assert.match(voiceText(plan, plan.beats.length - 1), /не инвестиционная рекомендация/i);
});

test("money ding is omitted for stop and time exits", () => {
  for (const outcome of ["stop", "time_exit"] as const) {
    const plan = createTechnicalAnalysisPlan("BTC", snapshot(outcome));
    assert.ok(plan.beats.every((beat) => beat.soundEffect !== "money_ding"));
  }
});

test("time-exit narration names the full 12-candle horizon", () => {
  const plan = createTechnicalAnalysisPlan("BTC", snapshot("time_exit"));
  assert.match(voiceText(plan, 3), /двенадцать четырёхчасовых свечей/i);
  assert.match(voiceText(plan, 3), /выход по времени/i);
  assert.match(voiceText(plan, 4), /тейк не был достигнут/i);
  assert.match(voiceText(plan, 4), /историческому окну/i);
});