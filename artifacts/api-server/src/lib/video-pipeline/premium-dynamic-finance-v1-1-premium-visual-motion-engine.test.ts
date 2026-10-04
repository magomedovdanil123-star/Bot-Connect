import assert from "node:assert/strict";
import test from "node:test";
import type { CoinOverviewMarketData } from "../coin-overview-data";
import { buildPremiumDynamicFinanceEditPlan } from "./premium-dynamic-finance";
import {
  buildPremiumDynamicFinanceV1_1SemanticPlan,
} from "./premium-dynamic-finance-v1-1-semantic-director";
import { buildPremiumDynamicFinanceV1_1SemanticTestVoices } from "./premium-dynamic-finance-v1-1-semantic-test-script";
import { PremiumVisualMotionEngine } from "./premium-dynamic-finance-v1-1-premium-visual-motion-engine";
import type { KineticSubtitleWord } from "./longform-kinetic-subtitles";

function testMarket(): CoinOverviewMarketData {
  return {
    coin: {
      id: "dogecoin",
      name: "Dogecoin",
      symbol: "DOGE",
      marketCapRank: 9,
      sourceUrl: "https://www.coingecko.com/en/coins/dogecoin",
    },
    sourceLabel: "CoinGecko",
    currency: "USD",
    periodDays: 7,
    currentPriceUsd: 10,
    periodStartPriceUsd: 11,
    changePercent7d: -9.09,
    lowPriceUsd7d: 8,
    highPriceUsd7d: 12,
    priceSamples: [
      { timestamp: 1, label: "a", priceUsd: 10 },
      { timestamp: 2, label: "b", priceUsd: 11 },
      { timestamp: 3, label: "c", priceUsd: 12 },
      { timestamp: 4, label: "d", priceUsd: 9 },
      { timestamp: 5, label: "e", priceUsd: 8 },
      { timestamp: 6, label: "f", priceUsd: 9 },
      { timestamp: 7, label: "g", priceUsd: 11 },
      { timestamp: 8, label: "h", priceUsd: 10 },
    ],
    activity: {
      kind: "trading_volume",
      valueUsd: 1_000_000,
      sourceLabel: "CoinGecko",
      sourceUrl: "https://www.coingecko.com/en/coins/dogecoin",
    },
    benchmarks: [
      { id: "bitcoin", name: "Bitcoin", symbol: "BTC", changePercent7d: 2.5 },
      { id: "ethereum", name: "Ethereum", symbol: "ETH", changePercent7d: 1.2 },
    ],
    marketCapUsd: 14_000_000_000,
    dataAsOf: "2026-10-04T10:00:00.000Z",
    retrievedAt: "2026-10-04T10:01:00.000Z",
  };
}

function buildMotionFixture() {
  const voices = buildPremiumDynamicFinanceV1_1SemanticTestVoices();
  const editPlan = buildPremiumDynamicFinanceEditPlan({
    voices,
    durationMs: 120_000,
    topic: "Dogecoin DOGE cryptocurrency",
  });
  const semanticPlan = buildPremiumDynamicFinanceV1_1SemanticPlan({
    editPlan,
    voices,
    market: testMarket(),
    genesisYear: "2013",
  });
  const words: KineticSubtitleWord[] = voices.flatMap((voice) => {
    const startMs = voice.startTime!;
    const endMs = voice.endTime!;
    const tokens = voice.text.trim().split(/\s+/u).filter((token) =>
      token.replace(/[^\p{L}\p{N}]/gu, "").length > 0,
    );
    const interval = (endMs - startMs) / Math.max(1, tokens.length);
    return tokens.map((text, index) => ({
      text,
      startMs: Math.round(startMs + interval * index),
      endMs: Math.max(
        Math.round(startMs + interval * index) + 1,
        Math.round(startMs + interval * (index + 0.72)),
      ),
    }));
  });
  return { editPlan, semanticPlan, words };
}

test("PremiumVisualMotionEngine adds motion to existing beats and records each scene transition", () => {
  const { editPlan, semanticPlan, words } = buildMotionFixture();
  const engine = new PremiumVisualMotionEngine({
    events: semanticPlan.events,
    beats: editPlan.beats,
    subtitleWords: words,
    fontPath: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  });
  const audit = engine.getAudit();

  assert.equal(audit.engine, "PremiumVisualMotionEngine");
  assert.equal(audit.sceneCount, 10);
  assert.equal(audit.beatCount, editPlan.beats.length);
  assert.equal(audit.sceneTransitions.length, 9);
  assert.ok(audit.appliedAnimationTypes.includes("easeOutCubic entrance and exit masks"));
  assert.ok(audit.appliedAnimationTypes.includes("subtitle-word-synchronized visual pulse"));
  assert.ok(audit.appliedAnimationTypes.includes("animated market-cap number counter"));
  assert.ok(
    audit.appliedAnimationTypes.includes("resolved market-cap value held in upper-right subtitle-safe area"),
  );
  assert.ok(audit.events.some((event) => event.reactionWord));
});

test("market-cap value stays in a subtitle-safe corner after its spoken count-up", () => {
  const { editPlan, semanticPlan, words } = buildMotionFixture();
  const engine = new PremiumVisualMotionEngine({
    events: semanticPlan.events,
    beats: editPlan.beats,
    subtitleWords: words,
    fontPath: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  });
  const audit = engine.getAudit();
  const counterAudit = audit.events.find((event) =>
    event.semanticType === "market-cap"
    && event.animatedCounter
    && !event.animatedCounter.startsWith("hold "),
  );
  assert.ok(counterAudit, "market-cap scene should have a word-timed animated counter");
  const marketCapEvents = semanticPlan.events.filter((event) => event.semanticType === "market-cap");
  const marketCapAudit = audit.events.filter((event) => event.semanticType === "market-cap");
  assert.ok(marketCapAudit.some((event) => event.animatedCounter?.startsWith("hold ")));

  for (const event of marketCapEvents) {
    const beat = editPlan.beats.find((candidate) => candidate.index === event.beatIndex)!;
    const treatment = engine.getTreatment({
      beat,
      event,
      durationSeconds: (beat.endMs - beat.startMs) / 1_000,
    });
    assert.equal(treatment.omitStaticMarketCapValue, true);
    if (event.beatIndex === counterAudit.beatIndex) {
      assert.ok(treatment.backgroundScale < treatment.midgroundScale);
      assert.ok(treatment.midgroundScale < treatment.foregroundScale);
      const counterFilters = treatment.filters.filter((filter) => filter.startsWith("drawtext="));
      assert.ok(counterFilters.length >= 5);
      assert.ok(counterFilters.every((filter) =>
        filter.includes("x='w-text_w-0.08*w'")
        && filter.includes("y='0.18*h'"),
      ));
    }
  }

  const heldCounter = marketCapAudit.find((event) => event.animatedCounter?.startsWith("hold "));
  assert.ok(heldCounter);
  const heldEvent = semanticPlan.events.find((event) => event.beatIndex === heldCounter.beatIndex)!;
  const heldBeat = editPlan.beats.find((beat) => beat.index === heldCounter.beatIndex)!;
  const heldTreatment = engine.getTreatment({
    beat: heldBeat,
    event: heldEvent,
    durationSeconds: (heldBeat.endMs - heldBeat.startMs) / 1_000,
  });
  assert.ok(heldTreatment.filters.some((filter) => filter.includes("text='$14.00B'")));

  const firstBeat = editPlan.beats[0]!;
  const firstEvent = semanticPlan.events.find((candidate) => candidate.beatIndex === firstBeat.index)!;
  const entrance = engine.getTreatment({
    beat: firstBeat,
    event: firstEvent,
    durationSeconds: (firstBeat.endMs - firstBeat.startMs) / 1_000,
  });
  assert.ok(entrance.filters.some((filter) => filter.includes("gblur=")));
});