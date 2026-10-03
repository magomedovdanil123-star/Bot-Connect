import assert from "node:assert/strict";
import test from "node:test";
import type { CoinOverviewMarketData } from "../coin-overview-data";
import {
  buildPremiumDynamicFinanceV1_1VisualPlan,
  detectPremiumDynamicFinanceV1_1SemanticTags,
} from "./premium-dynamic-finance-v1-1-visual-director";
import {
  buildPremiumDynamicFinanceV1_1PilotVoices,
  PREMIUM_DYNAMIC_FINANCE_V1_1_DOGECOIN_PILOT_LINES,
  PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS,
  PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_SCENE_COUNT,
} from "./premium-dynamic-finance-v1-1-pilot-script";
import { buildPremiumDynamicFinanceV1_1SceneSvg } from "./premium-dynamic-finance-v1-1-full-scene-renderer";

const dogecoin = { id: "dogecoin", name: "Dogecoin", symbol: "DOGE" };
const dataAsOf = "2026-10-03T12:00:00.000Z";

function marketFixture(): CoinOverviewMarketData {
  return {
    coin: {
      id: "dogecoin",
      name: "Dogecoin",
      symbol: "DOGE",
      marketCapRank: 9,
      sourceUrl: "https://www.coingecko.com/en/coins/dogecoin",
      logoDataUri: "data:image/png;base64,aGVsbG8=",
    },
    sourceLabel: "CoinGecko",
    currency: "USD",
    periodDays: 7,
    currentPriceUsd: 11,
    periodStartPriceUsd: 10,
    changePercent7d: 10,
    lowPriceUsd7d: 8,
    highPriceUsd7d: 13,
    priceSamples: [
      { timestamp: 1, label: "2026-10-01T00:00:00Z", priceUsd: 10 },
      { timestamp: 2, label: "2026-10-01T12:00:00Z", priceUsd: 12 },
      { timestamp: 3, label: "2026-10-02T00:00:00Z", priceUsd: 9 },
      { timestamp: 4, label: "2026-10-02T12:00:00Z", priceUsd: 13 },
      { timestamp: 5, label: "2026-10-03T00:00:00Z", priceUsd: 8 },
      { timestamp: 6, label: "2026-10-03T12:00:00Z", priceUsd: 11 },
    ],
    activity: {
      kind: "trading_volume",
      valueUsd: 50_000_000,
      sourceLabel: "CoinGecko",
      sourceUrl: "https://www.coingecko.com/en/coins/dogecoin",
    },
    benchmarks: [
      { id: "bitcoin", name: "Bitcoin", symbol: "BTC", changePercent7d: 2.5 },
      { id: "ethereum", name: "Ethereum", symbol: "ETH", changePercent7d: -1.25 },
    ],
    marketCapUsd: 15_000_000_000,
    dataAsOf,
    retrievedAt: dataAsOf,
  };
}

test("Dogecoin pilot maps its ten meanings to full-scene visual treatments", () => {
  const plan = buildPremiumDynamicFinanceV1_1VisualPlan({
    voices: buildPremiumDynamicFinanceV1_1PilotVoices(),
    entity: dogecoin,
    dataAsOf,
    market: marketFixture(),
  });

  assert.equal(PREMIUM_DYNAMIC_FINANCE_V1_1_DOGECOIN_PILOT_LINES.length, 10);
  assert.equal(PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_SCENE_COUNT, 10);
  assert.equal(plan.mode, "PLAN_ONLY");
  assert.equal(plan.events.length, 10);
  assert.equal(plan.durationMs, PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS);
  assert.deepEqual(plan.events.map((event) => event.visualType), [
    "HISTORY_DOCUMENTARY",
    "PRICE_MOVEMENT",
    "MARKET_GROWTH",
    "MARKET_DROP",
    "FULLSCREEN_STAT",
    "COIN_COMPARISON",
    "NEWS_EDITORIAL",
    "COMMUNITY",
    "BLOCKCHAIN_NETWORK",
    "FULLSCREEN_IMPACT",
  ]);
  assert.equal(plan.repeatedVisualTypes, 0);
  assert.equal(plan.events.at(-1)?.endMs, PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS);
  assert.ok(plan.events.every((event) => event.subjectOccupancyPercent >= 40));
  assert.ok(plan.events.every((event) => event.motionBeats.length >= 8));
  assert.equal(new Set(plan.events.map((event) => event.backgroundKey)).size, 10);
  assert.equal(plan.events[6]?.integrityNote, "Редакционная реконструкция, не реальная статья и не новостной факт.");
  assert.deepEqual(plan.events[6]?.sourceReferences, []);
  assert.deepEqual(plan.events[7]?.sourceReferences, []);
  assert.match(plan.events[7]?.integrityNote ?? "", /число участников/u);
  assert.deepEqual(plan.events[8]?.sourceReferences, []);
  assert.match(plan.events[8]?.integrityNote ?? "", /реальном времени/u);
  assert.deepEqual(plan.events[9]?.sourceReferences, []);
  assert.ok(plan.events[4]?.sourceReferences.some((source) => source.label.includes("market snapshot")));
  assert.match(plan.events[0]?.integrityNote ?? "", /не показывать 2013/u);
});

test("full-scene frames use saved figures and keep editorial scenes explicitly illustrative", () => {
  const plan = buildPremiumDynamicFinanceV1_1VisualPlan({
    voices: buildPremiumDynamicFinanceV1_1PilotVoices(),
    entity: dogecoin,
    dataAsOf,
    market: marketFixture(),
  });
  const frames = plan.events.map((event) =>
    buildPremiumDynamicFinanceV1_1SceneSvg({ plan, event, phase: 0 }),
  );

  assert.equal(frames.length, 10);
  assert.equal(new Set(frames).size, 10);
  assert.match(frames[0] ?? "", /РЕДАКЦИОННАЯ РЕКОНСТРУКЦИЯ/u);
  assert.doesNotMatch(frames[0] ?? "", /\b2013\b/u);
  assert.match(frames[1] ?? "", /две крайние точки, без реконструкции/u);
  assert.match(frames[5] ?? "", /BITCOIN/u);
  assert.match(frames[5] ?? "", /ETHEREUM/u);
  assert.match(frames[6] ?? "", /НЕ РЕАЛЬНАЯ НОВОСТЬ/u);
  assert.match(frames[8] ?? "", /НЕ LIVE-ТРАНЗАКЦИИ/u);
  assert.match(frames[9] ?? "", /НЕ ЧТО БУДЕТ/u);
});

test("mentioning DOGE with a price routes to a price visual, not a coin card or logo reveal", () => {
  const plan = buildPremiumDynamicFinanceV1_1VisualPlan({
    voices: [{
      sceneId: 1,
      startTime: 0,
      endTime: 10_000,
      text: "Цена Dogecoin показана на графике за семь дней.",
    }],
    entity: dogecoin,
    dataAsOf,
  });

  assert.ok(plan.events[0]?.semanticTags.includes("COIN_MENTION"));
  assert.ok(plan.events[0]?.semanticTags.includes("PRICE"));
  assert.equal(plan.events[0]?.visualType, "PRICE_MOVEMENT");
  assert.equal(plan.events[0]?.compositionMode, "DATA");
  assert.ok(!plan.events[0]?.assetKeys.some((key) => key.endsWith(":logo")));
});

test("growth and decline use the actual selected points and do not invent a percentage", () => {
  const market = marketFixture();
  const plan = buildPremiumDynamicFinanceV1_1VisualPlan({
    voices: [{
      sceneId: 1,
      startTime: 0,
      endTime: 10_000,
      text: "На графике цены выделен фактический восходящий отрезок.",
    }, {
      sceneId: 2,
      startTime: 10_000,
      endTime: 20_000,
      text: "Здесь показано фактическое падение цены.",
    }],
    entity: dogecoin,
    dataAsOf,
    market,
  });

  assert.equal(plan.events[0]?.visualType, "MARKET_GROWTH");
  assert.equal(plan.events[1]?.visualType, "MARKET_DROP");
  assert.equal(plan.events[0]?.factualData.moveStartPriceUsd, 9);
  assert.equal(plan.events[0]?.factualData.moveEndPriceUsd, 13);
  assert.equal(plan.events[1]?.factualData.moveStartPriceUsd, 13);
  assert.equal(plan.events[1]?.factualData.moveEndPriceUsd, 8);
  assert.ok(plan.events[0]?.sourceReferences.some((source) => source.label.includes("market snapshot")));
  assert.equal(plan.events[0]?.integrityNote, undefined);
  assert.equal(plan.marketSnapshot?.marketCapUsd, 15_000_000_000);
});

test("unknown copy keeps the existing Premium Dynamic fallback and never invents a visual fact", () => {
  const text = "A quiet camera move with no defined financial subject.";
  assert.deepEqual(detectPremiumDynamicFinanceV1_1SemanticTags(text, dogecoin), []);
  const plan = buildPremiumDynamicFinanceV1_1VisualPlan({
    voices: [{ sceneId: 1, startTime: 0, endTime: 10_000, text }],
    entity: dogecoin,
    dataAsOf,
  });

  assert.equal(plan.events[0]?.visualType, "EXISTING_PREMIUM_DYNAMIC");
  assert.match(plan.events[0]?.fallbackReason ?? "", /without adding a data card/u);
});