import type { WhaleEvent, WhaleScoreBreakdown } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scoreMarketContext(change: number | null | undefined): number {
  if (change === null || change === undefined) return 0;
  return Math.abs(change) >= 5 ? 10 : Math.abs(change) >= 2 ? 6 : Math.abs(change) >= 0.5 ? 2 : 0;
}

export function scoreWhaleEvent(
  event: WhaleEvent,
  cohort: WhaleEvent[],
  minimumUsd: number,
): WhaleEvent {
  const sizeScore = clamp(
    Math.round(20 + Math.log10(Math.max(1, event.amountUsd / minimumUsd)) * 15),
    0,
    35,
  );
  const smartMoneyScore = event.walletType === "smart_money" ? (event.walletLabel ? 20 : 15) : 0;

  const comparable = cohort
    .filter((candidate) =>
      candidate.blockchain === event.blockchain
      && candidate.asset.toUpperCase() === event.asset.toUpperCase())
    .map((candidate) => candidate.amountUsd)
    .sort((left, right) => left - right);
  const percentile = comparable.length <= 1
    ? 1
    : comparable.filter((amount) => amount <= event.amountUsd).length / comparable.length;
  const relativeScore = comparable.length <= 1
    ? 5
    : percentile >= 0.95 ? 20 : percentile >= 0.8 ? 15 : percentile >= 0.5 ? 10 : 5;
  const sizeMultiple = event.amountUsd / Math.max(1, minimumUsd);
  const unusualActivityScore = clamp(
    relativeScore
      + (sizeMultiple >= 10 ? 5 : 0)
      + (event.action === "TRANSFER" && event.exchange ? 5 : 0),
    0,
    25,
  );

  const buyCount = event.previousActivity.filter((item) => item.action === "BUY").length;
  const accumulationScore = buyCount >= 3 ? 15 : buyCount > 0 ? 10 : 0;
  const marketContextScore = scoreMarketContext(event.marketContext?.changePercent);
  const walletHistoryScore = Math.min(15, event.previousActivity.length * 3);
  const scoreBreakdown: WhaleScoreBreakdown = {
    sizeScore,
    smartMoneyScore,
    unusualActivityScore,
    accumulationScore,
    marketContextScore,
    walletHistoryScore,
  };
  const whaleScore = clamp(Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0), 0, 100);
  return {
    ...event,
    whaleScore,
    scoreBreakdown,
  };
}

export function updateWhaleMarketContextScore(event: WhaleEvent): WhaleEvent {
  const marketContextScore = scoreMarketContext(event.marketContext?.changePercent);
  const baseScore = event.whaleScore - event.scoreBreakdown.marketContextScore;
  const whaleScore = clamp(baseScore + marketContextScore, 0, 100);
  return {
    ...event,
    whaleScore,
    scoreBreakdown: {
      ...event.scoreBreakdown,
      marketContextScore,
    },
  };
}

export function isSignificantWhaleEvent(
  event: WhaleEvent,
  minimumUsd: number,
  minimumScore: number,
): boolean {
  return event.amountUsd >= minimumUsd && event.whaleScore >= minimumScore;
}
