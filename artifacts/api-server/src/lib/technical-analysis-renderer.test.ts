import assert from "node:assert/strict";
import test from "node:test";
import { renderTechnicalAnalysisFrame } from "./technical-analysis-renderer";
import type { TechnicalAnalysisCandle, TechnicalAnalysisSnapshot } from "./technical-analysis-data";

function candle(index: number, price: number): TechnicalAnalysisCandle {
  return {
    openTime: index * 14_400_000,
    closeTime: (index + 1) * 14_400_000 - 1,
    open: price - 1,
    high: price + 2,
    low: price - 2,
    close: price,
  };
}

function frame(snapshot: TechnicalAnalysisSnapshot, beatIndex: number, beatProgress: number): string {
  return renderTechnicalAnalysisFrame({
    snapshot,
    beatIndex,
    beatProgress,
    beatTitle: "Исторический сигнал",
    beatSubtitle: "Тестовая сцена",
  });
}

test("historical candles and trade levels reveal in order, then future bars progress", () => {
  const snapshot: TechnicalAnalysisSnapshot = {
    source: "Binance Spot",
    pair: "BTCUSDT",
    timeframe: "4h",
    retrievedAt: "2026-09-28T00:00:00.000Z",
    signalTime: "2026-09-18T12:00:00.000Z",
    rangeStartTime: "2026-09-14T00:00:00.000Z",
    rangeEndTime: "2026-09-18T12:00:00.000Z",
    direction: "long",
    pattern: { type: "ascending_triangle", label: "Восходящий треугольник" },
    entry: 102,
    stop: 96,
    target: 114,
    riskPercent: 6,
    quantity: 9.80392,
    notionalUsd: 1_000,
    outcome: "target",
    exit: 114,
    pnlUsd: 117.65,
    bars: 4,
    setupCandles: [candle(0, 100), candle(1, 101), candle(2, 102)],
    futureCandles: [candle(3, 103), candle(4, 106), candle(5, 110), candle(6, 114)],
  };

  const signalFrame = frame(snapshot, 0, 0.5);
  assert.match(signalFrame, /ГРАФИК:/);
  assert.match(signalFrame, /14 СЕНТ\. 2026/);
  assert.match(signalFrame, /18 СЕНТ\. 2026/);
  assert.match(signalFrame, /data-candle-index="2"/);
  assert.doesNotMatch(signalFrame, /data-candle-index="3"/);
  assert.doesNotMatch(signalFrame, /ТЕЙК ДОСТИГНУТ/);

  const levelsFrame = frame(snapshot, 2, 0.5);
  assert.match(levelsFrame, />ВХОД</);
  assert.match(levelsFrame, />СТОП</);
  assert.match(levelsFrame, />ТЕЙК</);
  assert.doesNotMatch(levelsFrame, /data-candle-index="3"/);

  const revealStart = frame(snapshot, 3, 0.25);
  assert.match(revealStart, /data-candle-index="3"/);
  assert.doesNotMatch(revealStart, /data-candle-index="4"/);
  assert.doesNotMatch(revealStart, /ТЕЙК ДОСТИГНУТ/);
  assert.match(frame(snapshot, 3, 1), /data-candle-index="6"/);
  assert.match(frame(snapshot, 4, 0), /ТЕЙК ДОСТИГНУТ/);
});