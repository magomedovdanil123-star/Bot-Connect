import assert from "node:assert/strict";
import test from "node:test";
import { buildWhaleRadarV2Html } from "./renderer-v2";
import { getWhaleFlowNodeOrder, getWhaleFlowSegment, getWhaleRadarV2MotionProfile } from "./v2-motion";
import {
  buildWhaleRadarV2Story,
  countWhaleRadarV2Words,
  deriveWhaleRadarV2Metrics,
  type WhaleRadarV2Event,
  type WhaleRadarV2RelatedEvent,
} from "./v2-story";

const event: WhaleRadarV2Event = {
  eventTimestamp: "2026-10-06T04:54:11.000Z",
  blockchain: "ethereum",
  symbol: "ETH",
  action: "BUY",
  amount: 61.8053415114484,
  amountUsd: 166908.236248993,
  priceUsd: 2700.54710753562,
  walletLabel: "Token Millionaire",
  walletType: "smart_money",
  dex: null,
  transactionHash: "0x456591eab0abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  marketContext: {
    timeframe: "1h",
    candles: [
      { timestamp: "2026-10-06T05:00:00.000Z", open: 2701, high: 2704, low: 2699, close: 2699.9975841524556 },
      { timestamp: "2026-10-06T06:00:00.000Z", open: 2700, high: 2701, low: 2691, close: 2697.5618648654063 },
      { timestamp: "2026-10-06T12:00:00.000Z", open: 2714, high: 2716, low: 2708, close: 2710.1821662800626 },
    ],
  },
  rawData: {
    chain: "ethereum",
    trader_address: "0x1234567890123456789012345678901234567890",
    token_sold_symbol: "USDC",
    token_sold_amount: 166973.91914,
    token_bought_symbol: "ETH",
    token_bought_amount: 61.805341511448,
  },
};

const relatedEvents: WhaleRadarV2RelatedEvent[] = [
  {
    eventTimestamp: "2026-10-06T04:36:59.000Z",
    symbol: "ETH",
    action: "BUY",
    amountUsd: 506593.0756187692,
    transactionHash: "0x061d1ea5b707b11f5f1fb7b1b9069f5926ca396839c9c780fee04788bf6c2211",
  },
  {
    eventTimestamp: "2026-10-06T04:39:35.000Z",
    symbol: "ETH",
    action: "SELL",
    amountUsd: 201107.95092928363,
    transactionHash: "0xdb67a83d08014493f886cc70a48c76477ca4262ec09bc38cbb38a20770946328",
  },
];

test("BUY and SELL use opposite meaningful money-flow directions", () => {
  assert.deepEqual(getWhaleFlowNodeOrder("BUY"), ["wallet", "dex", "token"]);
  assert.deepEqual(getWhaleFlowNodeOrder("SELL"), ["token", "dex", "wallet"]);
});

test("flow progress crosses both physical route segments without reversing", () => {
  assert.deepEqual(getWhaleFlowSegment(0.25), { segmentIndex: 0, segmentProgress: 0.5 });
  assert.deepEqual(getWhaleFlowSegment(0.75), { segmentIndex: 1, segmentProgress: 0.5 });
  assert.deepEqual(getWhaleFlowSegment(1.4), { segmentIndex: 1, segmentProgress: 1 });
});

test("motion profile keeps camera moves bounded and includes transition punch", () => {
  const opening = getWhaleRadarV2MotionProfile(0, 15, 0);
  const middle = getWhaleRadarV2MotionProfile(7, 15, 2);
  assert.ok(opening.cameraZoom >= 1 && opening.cameraZoom < 1.1);
  assert.ok(opening.cameraPunch > middle.cameraPunch);
  assert.ok(middle.routeProgress >= 0 && middle.routeProgress <= 1);
});

test("price result uses saved post-trade candles, not an assumed 24h or 7d return", () => {
  const metrics = deriveWhaleRadarV2Metrics(event);
  assert.equal(metrics.postTradeCandles.length, 3);
  assert.equal(metrics.latestCandle?.close, 2710.1821662800626);
  assert.ok(Math.abs((metrics.priceChangePercent ?? 0) - 0.3567) < 0.002);
});

test("narration includes exact swap inputs, prior activity, proof limits, and a concise CTA", () => {
  const story = buildWhaleRadarV2Story(event, relatedEvents);
  assert.match(story.narration, /166\s*973,91914 USDC/u);
  assert.match(story.narration, /61,805342 ETH/u);
  assert.match(story.narration, /506\s*593 долларов/u);
  assert.match(story.narration, /201\s*108 долларов/u);
  assert.match(story.narration, /название конкретной DEX-площадки[\s\S]*?не указано/iu);
  assert.match(story.narration, /Полные 24h|сутки и семь дней/u);
  assert.match(story.narration, /ссылка на биржу в шапке профиля канала/iu);
  assert.ok(countWhaleRadarV2Words(story.narration) >= 220);
});

test("renderer emits a portrait, non-publishing preview using the real transaction hash", () => {
  const story = buildWhaleRadarV2Story(event, relatedEvents);
  const html = buildWhaleRadarV2Html({
    durationSeconds: 120,
    event,
    relatedEvents,
    metrics: story.metrics,
    scannedAt: "2026-10-06T12:42:04.250Z",
  });
  assert.match(html, /width="1080" height="1920"/u);
  assert.match(html, /0x456591eab0abcdef/u);
  assert.match(html, /ПЛОЩАДКА НЕ УКАЗАНА/u);
  assert.match(html, /ВЫ ПОДПИСАНЫ/u);
  assert.match(html, /БЕЗ АВТОПУБЛИКАЦИИ/u);
  assert.throws(() => buildWhaleRadarV2Html({
    durationSeconds: 60,
    event,
    relatedEvents,
    metrics: story.metrics,
    scannedAt: "2026-10-06T12:42:04.250Z",
  }), /near two minutes/u);
});
