import assert from "node:assert/strict";
import test from "node:test";
import type { CoinOverviewMarketData } from "../coin-overview-data";
import {
  buildPremiumDynamicFinanceEditPlan,
} from "./premium-dynamic-finance";
import {
  PREMIUM_DYNAMIC_FINANCE_V1_1_GENESIS_SOURCE_URL,
} from "./premium-dynamic-finance-v1-1-pilot-script";
import { buildPremiumDynamicFinanceV1_1SemanticTestVoices } from "./premium-dynamic-finance-v1-1-semantic-test-script";
import {
  buildPremiumDynamicFinanceV1_1SemanticPlan,
  PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TYPES,
} from "./premium-dynamic-finance-v1-1-semantic-director";
import { renderLongformVisualVideo, buildLongformVisualSvg } from "./longform-visual-renderer";
import { alignKineticSubtitleWords } from "./longform-kinetic-subtitles";

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

function testPlan() {
  const voices = buildPremiumDynamicFinanceV1_1SemanticTestVoices();
  const editPlan = buildPremiumDynamicFinanceEditPlan({
    voices,
    durationMs: 120_000,
    topic: "Dogecoin DOGE криптовалюта",
  });
  const semanticPlan = buildPremiumDynamicFinanceV1_1SemanticPlan({
    editPlan,
    voices,
    market: testMarket(),
    genesisYear: "2013",
  });
  return { voices, editPlan, semanticPlan };
}

test("SemanticVisualDirector extends, but does not replace, every Premium Dynamic beat", () => {
  const { editPlan, semanticPlan } = testPlan();
  assert.equal(semanticPlan.events.length, editPlan.beats.length);
  assert.equal(semanticPlan.baseEditPlan.beatCount, editPlan.beats.length);
  for (const beat of editPlan.beats) {
    const event = semanticPlan.events.find((candidate) => candidate.beatIndex === beat.index);
    assert.ok(event);
    assert.equal(event.sceneId, beat.sceneId);
    assert.equal(event.startMs, beat.startMs);
    assert.equal(event.endMs, beat.endMs);
    assert.deepEqual(event.premiumDynamic, {
      mainIdea: beat.mainIdea,
      visualConcept: beat.visualConcept,
      assetDescription: beat.assetDescription,
      visualForm: beat.visualForm,
      composition: beat.composition,
      entry: beat.entry,
      movement: beat.movement,
      exit: beat.exit,
      transition: beat.transition,
      kineticText: beat.kineticText,
      focalPoint: beat.focalPoint,
      intensity: beat.intensity,
      emphasisWord: beat.emphasisWord ?? null,
      sfxEvent: beat.sfxEvent ?? null,
    });
  }
});

test("SemanticVisualDirector covers all required topics with measured market segments", () => {
  const { semanticPlan } = testPlan();
  assert.equal(semanticPlan.mode, "TEST_MODE");
  assert.deepEqual(semanticPlan.requiredCoverage, [...PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TYPES]);
  assert.ok(semanticPlan.requiredCoverage.every((type) => semanticPlan.visualTypeCounts[type] > 0));
  assert.ok(semanticPlan.events.every((event) => event.market.riseSegment?.changePercent! > 0));
  assert.ok(semanticPlan.events.every((event) => event.market.drawdownSegment?.changePercent! < 0));
  assert.ok(semanticPlan.sourceReferences.some((reference) => reference.url === PREMIUM_DYNAMIC_FINANCE_V1_1_GENESIS_SOURCE_URL));
  assert.equal(semanticPlan.entity.symbol, "DOGE");
});

test("semantic render is opt-in and full-frame semantic art is added before the immutable captions", () => {
  const { editPlan, semanticPlan } = testPlan();
  const beat = editPlan.beats[0]!;
  const event = semanticPlan.events.find((candidate) => candidate.beatIndex === beat.index)!;
  const originalSvg = buildLongformVisualSvg(beat);
  const semanticSvg = buildLongformVisualSvg(beat, event);
  assert.notEqual(originalSvg, semanticSvg);
  assert.match(semanticSvg, /GENESIS BLOCK/u);
  assert.match(semanticSvg, /2013/u);
  assert.match(semanticSvg, /<svg[^>]+width="1920"[^>]+height="1080"/u);
});

test("renderer rejects semantic events that drift from base beat timing", async () => {
  const { editPlan, semanticPlan } = testPlan();
  const event = semanticPlan.events[0]!;
  await assert.rejects(
    renderLongformVisualVideo({
      beats: [editPlan.beats[0]!],
      durationMs: 120_000,
      outputPath: "/tmp/unused-semantic-render.mp4",
      semanticVisualEvents: [{ ...event, startMs: event.startMs + 1 }],
    }),
    /does not align with existing Premium Dynamic beat/u,
  );
});

test("SemanticVisualDirector refuses to invent missing rising or falling data segments", () => {
  const voices = buildPremiumDynamicFinanceV1_1SemanticTestVoices();
  const editPlan = buildPremiumDynamicFinanceEditPlan({ voices, durationMs: 120_000 });
  const flatMarket = testMarket();
  flatMarket.priceSamples = flatMarket.priceSamples.map((point) => ({ ...point, priceUsd: 10 }));
  assert.throws(
    () => buildPremiumDynamicFinanceV1_1SemanticPlan({
      editPlan,
      voices,
      market: flatMarket,
      genesisYear: "2013",
    }),
    /cannot claim both a rise and drawdown/u,
  );
});

test("test render rejects any subtitle word without an exact Scribe timestamp", () => {
  assert.throws(
    () => alignKineticSubtitleWords({
      voices: [{ sceneId: 1, text: "Привет мир", startTime: 0, endTime: 1_000 }],
      transcriptWords: [{ text: "Привет", start: 0, end: 0.4 }],
      durationMs: 1_000,
      minimumMatchCoverage: 0.5,
      requireExactMatches: true,
    }),
    /requires exact Scribe timestamps.*missing exact matches for: мир/u,
  );
});

test("strict Scribe alignment accepts the spoken numeric year and hyphenated compound with original timestamps", () => {
  const tokens = ["В", "2013", "году", "датирован", "генезис-блок", "сети"];
  const alignment = alignKineticSubtitleWords({
    voices: [{
      sceneId: 1,
      text: "В 2013 году датирован генезис-блок сети.",
      startTime: 0,
      endTime: 2_000,
    }],
    transcriptWords: tokens.map((text, index) => ({
      text,
      start: index * 0.2,
      end: index * 0.2 + 0.15,
    })),
    durationMs: 2_000,
    requireExactMatches: true,
  });
  assert.equal(alignment.matchedWordCount, tokens.length);
  assert.equal(alignment.interpolatedWordCount, 0);
  assert.equal(alignment.matchCoverage, 1);
});