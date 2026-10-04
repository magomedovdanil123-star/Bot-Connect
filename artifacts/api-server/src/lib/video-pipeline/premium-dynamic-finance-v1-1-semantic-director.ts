import type { CoinOverviewMarketData } from "../coin-overview-data";
import type { LongformVoice } from "./longform-visual-director";
import type { PremiumDynamicFinanceEditPlan } from "./premium-dynamic-finance";
import { PREMIUM_DYNAMIC_FINANCE_V1_1_GENESIS_SOURCE_URL } from "./premium-dynamic-finance-v1-1-pilot-script";

export const PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TYPES = [
  "genesis-history",
  "price-history",
  "measured-rise",
  "measured-drawdown",
  "market-cap",
  "bitcoin-comparison",
  "media-noise",
  "community",
  "blockchain",
  "conclusion",
] as const;

export type PremiumDynamicFinanceSemanticType =
  typeof PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TYPES[number];

export type PremiumDynamicFinanceV1_1SemanticEvent = {
  beatIndex: number;
  sceneId: number;
  startMs: number;
  endMs: number;
  semanticType: PremiumDynamicFinanceSemanticType;
  voiceExcerpt: string;
  visualLanguage: string;
  subjectOccupancyPercent: number;
  phaseIndex: number;
  phaseCount: number;
  premiumDynamic: {
    mainIdea: string;
    visualConcept: string;
    assetDescription: string;
    visualForm: PremiumDynamicFinanceEditPlan["beats"][number]["visualForm"];
    composition: PremiumDynamicFinanceEditPlan["beats"][number]["composition"];
    entry: PremiumDynamicFinanceEditPlan["beats"][number]["entry"];
    movement: PremiumDynamicFinanceEditPlan["beats"][number]["movement"];
    exit: PremiumDynamicFinanceEditPlan["beats"][number]["exit"];
    transition: PremiumDynamicFinanceEditPlan["beats"][number]["transition"];
    kineticText: string;
    focalPoint: PremiumDynamicFinanceEditPlan["beats"][number]["focalPoint"];
    intensity: PremiumDynamicFinanceEditPlan["beats"][number]["intensity"];
    emphasisWord: string | null;
    sfxEvent: PremiumDynamicFinanceEditPlan["beats"][number]["sfxEvent"] | null;
  };
  market: {
    dataAsOf: string;
    sourceLabel: string;
    currentPriceUsd: number;
    lowPriceUsd7d: number;
    highPriceUsd7d: number;
    changePercent7d: number;
    marketCapUsd: number | null;
    bitcoinChangePercent7d: number;
    priceSamples: number[];
    riseSegment: { fromIndex: number; toIndex: number; changePercent: number } | null;
    drawdownSegment: { fromIndex: number; toIndex: number; changePercent: number } | null;
  };
  sourceReferences: Array<{ label: string; url: string }>;
};

export type PremiumDynamicFinanceV1_1SemanticPlan = {
  version: "premium-dynamic-finance-v1.1-semantic-test";
  mode: "TEST_MODE";
  entity: { id: string; name: string; symbol: string };
  dataAsOf: string;
  durationMs: number;
  sourceReferences: Array<{ label: string; url: string }>;
  baseEditPlan: {
    beatCount: number;
    sfxEvents: PremiumDynamicFinanceEditPlan["sfxEvents"];
    intensityCounts: PremiumDynamicFinanceEditPlan["intensityCounts"];
  };
  requiredCoverage: PremiumDynamicFinanceSemanticType[];
  visualTypeCounts: Record<PremiumDynamicFinanceSemanticType, number>;
  repeatedAdjacentVisualTypes: number;
  events: PremiumDynamicFinanceV1_1SemanticEvent[];
};

const SCENE_SEMANTICS: Record<number, PremiumDynamicFinanceSemanticType> = {
  1: "genesis-history",
  2: "price-history",
  3: "measured-rise",
  4: "measured-drawdown",
  5: "market-cap",
  6: "bitcoin-comparison",
  7: "media-noise",
  8: "community",
  9: "blockchain",
  10: "conclusion",
};

const VISUAL_LANGUAGES: Record<PremiumDynamicFinanceSemanticType, string> = {
  "genesis-history": "archival timeline with a large 2013 date and genesis-block marker",
  "price-history": "full-width market trace with the sourced seven-day range",
  "measured-rise": "ascending measured price segment isolated from the full series",
  "measured-drawdown": "descending measured price segment isolated from the same series",
  "market-cap": "large-scale value composition with circulating-market context",
  "bitcoin-comparison": "two-asset matched-period comparison, DOGE against BTC",
  "media-noise": "editorial signal fragments without fabricated headlines or posts",
  community: "connected social nodes without invented people or audience counts",
  blockchain: "linked block-and-node structure, explicitly illustrative",
  conclusion: "historical trace resolves into a non-predictive risk frame",
};

const OCCUPANCY: Record<PremiumDynamicFinanceSemanticType, number> = {
  "genesis-history": 78,
  "price-history": 72,
  "measured-rise": 70,
  "measured-drawdown": 70,
  "market-cap": 76,
  "bitcoin-comparison": 74,
  "media-noise": 68,
  community: 70,
  blockchain: 76,
  conclusion: 62,
};

function bestRise(prices: number[]): PremiumDynamicFinanceV1_1SemanticEvent["market"]["riseSegment"] {
  if (prices.length < 2) return null;
  let minimumIndex = 0;
  let best: { fromIndex: number; toIndex: number; changePercent: number } | null = null;
  for (let index = 1; index < prices.length; index += 1) {
    const from = prices[minimumIndex]!;
    const to = prices[index]!;
    const changePercent = from > 0 ? (to / from - 1) * 100 : 0;
    if (changePercent > 0 && (!best || changePercent > best.changePercent)) {
      best = { fromIndex: minimumIndex, toIndex: index, changePercent };
    }
    if (to < from) minimumIndex = index;
  }
  return best;
}

function bestDrawdown(prices: number[]): PremiumDynamicFinanceV1_1SemanticEvent["market"]["drawdownSegment"] {
  if (prices.length < 2) return null;
  let maximumIndex = 0;
  let best: { fromIndex: number; toIndex: number; changePercent: number } | null = null;
  for (let index = 1; index < prices.length; index += 1) {
    const from = prices[maximumIndex]!;
    const to = prices[index]!;
    const changePercent = from > 0 ? (to / from - 1) * 100 : 0;
    if (changePercent < 0 && (!best || changePercent < best.changePercent)) {
      best = { fromIndex: maximumIndex, toIndex: index, changePercent };
    }
    if (to > from) maximumIndex = index;
  }
  return best;
}

function samplePrices(market: CoinOverviewMarketData): number[] {
  return market.priceSamples
    .map((point) => point.priceUsd)
    .filter((price) => Number.isFinite(price) && price > 0);
}

export function buildPremiumDynamicFinanceV1_1SemanticPlan(input: {
  editPlan: PremiumDynamicFinanceEditPlan;
  voices: LongformVoice[];
  market: CoinOverviewMarketData;
  genesisYear: "2013";
}): PremiumDynamicFinanceV1_1SemanticPlan {
  if (!input.editPlan.beats.length) {
    throw new Error("SemanticVisualDirector requires an existing Premium Dynamic edit plan");
  }
  if (!input.voices.some((voice) => voice.sceneId === 1 && /2013|тринадцат/u.test(voice.text))) {
    throw new Error("SemanticVisualDirector requires the verified 2013 genesis fact in scene one");
  }
  if (!Number.isFinite(Date.parse(input.market.dataAsOf))) {
    throw new Error("SemanticVisualDirector requires a valid market snapshot timestamp");
  }

  const prices = samplePrices(input.market);
  if (prices.length < 2) {
    throw new Error("SemanticVisualDirector requires at least two sourced price samples");
  }
  const bitcoin = input.market.benchmarks.find((benchmark) => benchmark.symbol === "BTC");
  if (!bitcoin) {
    throw new Error("SemanticVisualDirector requires a Bitcoin benchmark for the matched-period comparison");
  }
  const riseSegment = bestRise(prices);
  const drawdownSegment = bestDrawdown(prices);
  if (!riseSegment || !drawdownSegment) {
    throw new Error("SemanticVisualDirector cannot claim both a rise and drawdown without measured samples for each");
  }

  const commonMarketData = {
    dataAsOf: input.market.dataAsOf,
    sourceLabel: input.market.sourceLabel,
    currentPriceUsd: input.market.currentPriceUsd,
    lowPriceUsd7d: input.market.lowPriceUsd7d,
    highPriceUsd7d: input.market.highPriceUsd7d,
    changePercent7d: input.market.changePercent7d,
    marketCapUsd: input.market.marketCapUsd,
    bitcoinChangePercent7d: bitcoin.changePercent7d,
    priceSamples: prices,
    riseSegment,
    drawdownSegment,
  };
  const sourceReferences = [
    { label: "Dogecoin Core genesis-block timestamp", url: PREMIUM_DYNAMIC_FINANCE_V1_1_GENESIS_SOURCE_URL },
    { label: input.market.sourceLabel, url: input.market.coin.sourceUrl },
  ];

  const grouped = new Map<number, number[]>();
  for (const [index, beat] of input.editPlan.beats.entries()) {
    const indexes = grouped.get(beat.sceneId) ?? [];
    indexes.push(index);
    grouped.set(beat.sceneId, indexes);
  }

  const events = input.editPlan.beats.map((beat, index): PremiumDynamicFinanceV1_1SemanticEvent => {
    const semanticType = SCENE_SEMANTICS[beat.sceneId];
    if (!semanticType) {
      throw new Error(`No V1.1 semantic mapping exists for Premium Dynamic scene ${beat.sceneId}`);
    }
    const sceneBeatIndexes = grouped.get(beat.sceneId) ?? [];
    const phaseIndex = sceneBeatIndexes.indexOf(index);
    return {
      beatIndex: beat.index,
      sceneId: beat.sceneId,
      startMs: beat.startMs,
      endMs: beat.endMs,
      semanticType,
      voiceExcerpt: beat.voiceExcerpt,
      visualLanguage: VISUAL_LANGUAGES[semanticType],
      subjectOccupancyPercent: OCCUPANCY[semanticType],
      phaseIndex: Math.max(0, phaseIndex),
      phaseCount: Math.max(1, sceneBeatIndexes.length),
      premiumDynamic: {
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
      },
      market: commonMarketData,
      sourceReferences,
    };
  });

  const visualTypeCounts = Object.fromEntries(
    PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TYPES.map((type) => [
      type,
      events.filter((event) => event.semanticType === type).length,
    ]),
  ) as Record<PremiumDynamicFinanceSemanticType, number>;
  const requiredCoverage = [...PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TYPES];
  const missing = requiredCoverage.filter((type) => visualTypeCounts[type] === 0);
  if (missing.length) {
    throw new Error(`SemanticVisualDirector did not cover required story beats: ${missing.join(", ")}`);
  }

  return {
    version: "premium-dynamic-finance-v1.1-semantic-test",
    mode: "TEST_MODE",
    entity: {
      id: input.market.coin.id,
      name: input.market.coin.name,
      symbol: input.market.coin.symbol,
    },
    dataAsOf: input.market.dataAsOf,
    durationMs: Math.max(...events.map((event) => event.endMs)),
    sourceReferences,
    baseEditPlan: {
      beatCount: input.editPlan.beats.length,
      sfxEvents: input.editPlan.sfxEvents,
      intensityCounts: input.editPlan.intensityCounts,
    },
    requiredCoverage,
    visualTypeCounts,
    repeatedAdjacentVisualTypes: events.slice(1).filter((event, index) =>
      event.semanticType === events[index]!.semanticType,
    ).length,
    events,
  };
}