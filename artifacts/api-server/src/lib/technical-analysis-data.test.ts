import assert from "node:assert/strict";
import test from "node:test";
import {
  createTechnicalAnalysisSnapshot,
  findTechnicalAnalysisCandidates,
  chooseTechnicalAnalysisCandidate,
  resolveTechnicalAnalysisSnapshot,
  type TechnicalAnalysisCandle,
} from "./technical-analysis-data";

const INTERVAL_MS = 4 * 60 * 60 * 1_000;

function candle(i: number, open: number, high: number, low: number, close: number): TechnicalAnalysisCandle {
  return {
    openTime: i * INTERVAL_MS,
    closeTime: (i + 1) * INTERVAL_MS - 1,
    open,
    high,
    low,
    close,
  };
}

test("range breakout detector creates a candle-only candidate", () => {
  const candles = Array.from({ length: 45 }, (_, i) => candle(i, 100, 100.4, 99.6, 100))
    .map((c, i) => i === 30 ? candle(i, 100, 106, 100, 100.5) : c);
  const found = findTechnicalAnalysisCandidates(candles);
  assert.ok(found.some((item) => item.signalIndex === 30 && item.pattern.type === "range_breakout"));
});

test("snapshot computes hypothetical $1000 target P&L", () => {
  const candles = Array.from({ length: 43 }, (_, i) => candle(i, 100, 101, 99, 100));
  candles[30] = candle(30, 100, 106, 100, 105);
  for (let i = 31; i < candles.length; i += 1) candles[i] = candle(i, 105, 106, 100, 105);
  candles[31] = candle(31, 105, 106, 104, 106);
  candles[32] = candle(32, 106, 118, 105, 115);
  const snapshot = createTechnicalAnalysisSnapshot("BTC", candles, {
    signalIndex: 30,
    now: () => 43 * INTERVAL_MS,
  });
  assert.equal(snapshot.notionalUsd, 1000);
  assert.equal(snapshot.outcome, "target");
  assert.ok(snapshot.pnlUsd > 0);
  assert.equal(snapshot.futureCandles.length, snapshot.bars);
  assert.equal(snapshot.bars, 2);
  assert.equal(snapshot.rangeStartTime, new Date(10 * INTERVAL_MS).toISOString());
  assert.equal(snapshot.rangeEndTime, new Date(33 * INTERVAL_MS - 1).toISOString());
  assert.ok(Date.parse(snapshot.rangeEndTime) - Date.parse(snapshot.rangeStartTime) <= 7 * 24 * 60 * 60 * 1_000);
});

test("snapshot requires all twelve outcome candles", () => {
  const candles = Array.from({ length: 42 }, (_, i) => candle(i, 100, 101, 99, 100));
  candles[30] = candle(30, 100, 106, 100, 105);
  assert.throws(
    () => createTechnicalAnalysisSnapshot("BTC", candles, {
      signalIndex: 30,
      now: () => 42 * INTERVAL_MS,
    }),
    /последние 7 дней/i,
  );
});

test("snapshot rejects a setup whose displayed chart starts more than seven days ago", () => {
  const candles = Array.from({ length: 43 }, (_, i) => candle(i, 100, 101, 99, 100));
  candles[30] = candle(30, 100, 106, 100, 105);
  const now = 43 * INTERVAL_MS + 8 * 24 * 60 * 60 * 1_000;
  assert.throws(
    () => createTechnicalAnalysisSnapshot("BTC", candles, { signalIndex: 30, now: () => now }),
    /последние 7 дней/i,
  );
});

test("stop wins when one future candle touches stop and target", () => {
  const candles = Array.from({ length: 43 }, (_, i) => candle(i, 100, 101, 99, 100));
  candles[30] = candle(30, 100, 106, 100, 105);
  candles[31] = candle(31, 105, 115, 95, 105);
  const snapshot = createTechnicalAnalysisSnapshot("ETHUSDT", candles, {
    signalIndex: 30,
    now: () => 43 * INTERVAL_MS,
  });
  assert.equal(snapshot.outcome, "stop");
  assert.ok(snapshot.pnlUsd < 0);
});

test("Elliott trigger uses alternating confirmed high/low pivots", () => {
  const candles = Array.from({ length: 80 }, (_, i) => candle(i, 100, 101, 99, 100));
  candles[29] = candle(29, 108, 109, 105, 108);
  candles[30] = candle(30, 108, 111, 107, 110);
  candles[31] = candle(31, 106, 107, 105, 106);
  candles[32] = candle(32, 105, 106, 104, 105);
  candles[33] = candle(33, 105, 106, 103, 104);
  candles[34] = candle(34, 106, 107, 105, 106);
  candles[35] = candle(35, 117, 118, 115, 117);
  candles[36] = candle(36, 118, 121, 117, 120);
  candles[37] = candle(37, 116, 117, 114, 116);
  candles[38] = candle(38, 114, 115, 112, 114);
  candles[39] = candle(39, 113, 114, 111, 112);
  candles[40] = candle(40, 113, 114, 112, 113);
  candles[41] = candle(41, 112, 126, 111, 125);
  const found = findTechnicalAnalysisCandidates(candles);
  const wave = found.find((item) => item.pattern.type === "elliott_wave_1_4");
  assert.ok(wave);
  assert.deepEqual(wave.waveAnnotations?.map((item) => item.wave), ["1", "2", "3", "4"]);
  assert.ok(wave.waveAnnotations!.every((item) => item.index < 40));
});

test("a strong breakout without a preceding pole is not mislabeled as a pennant", () => {
  const candles = Array.from({ length: 70 }, (_, i) => candle(i, 100, 101, 99, 100));
  candles[40] = candle(40, 100, 120, 100, 115);
  const candidates = findTechnicalAnalysisCandidates(candles).filter((item) => item.signalIndex === 40);
  assert.ok(candidates.every((item) => !item.pattern.type.includes("pennant")));
});

test("detects ascending and symmetric triangle breakouts", () => {
  const ascending = Array.from({ length: 50 }, (_, i) => candle(i, 100, 101, 99, 100));
  for (let i = 10; i < 20; i += 1) ascending[i] = candle(i, 105, 110, 100, 105);
  for (let i = 20; i < 30; i += 1) ascending[i] = candle(i, 107, 110, 104, 107);
  ascending[30] = candle(30, 110, 114, 109, 112);
  assert.ok(findTechnicalAnalysisCandidates(ascending)
    .some((item) => item.signalIndex === 30 && item.pattern.type === "ascending_triangle"));

  const symmetric = Array.from({ length: 50 }, (_, i) => candle(i, 105, 106, 104, 105));
  for (let i = 10; i < 20; i += 1) symmetric[i] = candle(i, 105, 115, 95, 105);
  for (let i = 20; i < 30; i += 1) symmetric[i] = candle(i, 105, 110, 100, 105);
  symmetric[30] = candle(30, 110, 114, 109, 112);
  assert.ok(findTechnicalAnalysisCandidates(symmetric)
    .some((item) => item.signalIndex === 30 && item.pattern.type === "symmetric_triangle"));
});

test("detects a bull pennant only after a pole and contraction", () => {
  const candles = Array.from({ length: 55 }, (_, i) => candle(i, 100, 101, 99, 100));
  for (let i = 10; i < 20; i += 1) {
    const close = 100 + (i - 10) * 2;
    candles[i] = candle(i, close - 1, close + 1, close - 2, close);
  }
  for (let i = 20; i < 30; i += 1) candles[i] = candle(i, 113, 115, 110, 113);
  candles[30] = candle(30, 115, 122, 114, 120);
  assert.ok(findTechnicalAnalysisCandidates(candles)
    .some((item) => item.signalIndex === 30 && item.pattern.type === "bull_pennant"));
});

test("manual resolver normalizes ticker and rejects an unavailable pair without network", async () => {
  const interval = 4 * 60 * 60 * 1_000;
  const now = 240 * interval + 1_000;
  const requested: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    requested.push(url.toString());
    if (url.pathname.endsWith("/exchangeInfo")) {
      return new Response(JSON.stringify({
        symbols: [{ symbol: "BTCUSDT", status: "TRADING", quoteAsset: "USDT" }],
      }));
    }
    const start = Number(url.searchParams.get("startTime"));
    const rows = Array.from({ length: 240 }, (_, i) => {
      const open = 100;
      const close = i === 220 ? 105 : 100;
      return [start + i * interval, String(open), String(i === 220 ? 106 : 101), String(i === 220 ? 100 : 99), String(close), "1", start + (i + 1) * interval - 1, "1"];
    });
    return new Response(JSON.stringify(rows));
  };
  const snapshot = await resolveTechnicalAnalysisSnapshot({ mode: "manual", symbol: " btc/usdt " }, { fetcher, now: () => now });
  assert.equal(snapshot.pair, "BTCUSDT");
  assert.ok(Date.parse(snapshot.rangeStartTime) >= now - 7 * 24 * 60 * 60 * 1_000);
  assert.ok(Date.parse(snapshot.rangeEndTime) < now);
  assert.ok(requested.some((url) => url.includes("symbol=BTCUSDT")));
  await assert.rejects(
    resolveTechnicalAnalysisSnapshot({ mode: "manual", symbol: "NOTREAL" }, { fetcher, now: () => now }),
    /не найдена|недоступна/i,
  );
});

test("automatic resolver reads the Binance symbols envelope and finds a recent setup", async () => {
  const interval = 4 * 60 * 60 * 1_000;
  const now = 240 * interval + 1_000;
  let candleRequests = 0;
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/exchangeInfo")) {
      return new Response(JSON.stringify({
        symbols: [{ symbol: "BTCUSDT", status: "TRADING", quoteAsset: "USDT" }],
      }));
    }
    if (url.pathname.endsWith("/ticker/24hr")) {
      return new Response(JSON.stringify([{ symbol: "BTCUSDT", quoteVolume: "100000000" }]));
    }
    candleRequests += 1;
    const start = Number(url.searchParams.get("startTime"));
    const rows = Array.from({ length: 240 }, (_, i) => [
      start + i * interval,
      "100",
      i === 220 ? "106" : "101",
      i === 220 ? "100" : "99",
      i === 220 ? "105" : "100",
      "1",
      start + (i + 1) * interval - 1,
      "1",
    ]);
    return new Response(JSON.stringify(rows));
  };
  const snapshot = await resolveTechnicalAnalysisSnapshot(
    { mode: "auto" },
    { fetcher, now: () => now, random: () => 0 },
  );
  assert.equal(snapshot.pair, "BTCUSDT");
  assert.equal(snapshot.signalTime, new Date(221 * interval - 1).toISOString());
  assert.ok(Date.parse(snapshot.rangeStartTime) >= now - 7 * 24 * 60 * 60 * 1_000);
  assert.ok(Date.parse(snapshot.rangeEndTime) < now);
  assert.equal(candleRequests, 1);
});

test("auto helper prefers unused cases and uses injected random", () => {
  const make = (pair: string, type: "range_breakout" | "ascending_triangle") => ({
    pair,
    candidate: {
      signalIndex: 30, direction: "long" as const,
      pattern: { type, label: type }, entry: 100, stop: 99, target: 102,
      riskPercent: 1, setupStartIndex: 10,
    },
  });
  const items = [make("BTCUSDT", "range_breakout"), make("ETHUSDT", "range_breakout"), make("SOLUSDT", "ascending_triangle")];
  assert.equal(chooseTechnicalAnalysisCandidate(items, ["BTCUSDT:range_breakout"], () => 0).pair, "ETHUSDT");
  assert.equal(chooseTechnicalAnalysisCandidate(items, ["BTCUSDT:range_breakout"], () => 0.99).pair, "SOLUSDT");
});