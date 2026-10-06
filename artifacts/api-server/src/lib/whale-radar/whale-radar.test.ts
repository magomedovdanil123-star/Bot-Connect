import test from "node:test";
import assert from "node:assert/strict";
import { fetchSmartMoneyDexTrades } from "./nansen-client";
import { attachPreviousActivity, deduplicateWhaleEvents, normalizeNansenDexTrade, normalizeNansenTransfer } from "./normalize";
import { isSignificantWhaleEvent, scoreWhaleEvent, updateWhaleMarketContextScore } from "./scoring";
import { buildWhaleYoutubeMetadata } from "./seo";
import { buildWhaleStory, getPostTradePerformance } from "./story";
import { buildWhaleVisualPlan } from "./visual-plan";
import { getNansenScanReuseReason } from "./scan-budget";
import type { NansenDexTrade, NansenTransfer } from "./nansen-client";
import type { WhaleEvent } from "./types";

function dexTrade(overrides: Partial<NansenDexTrade> = {}): NansenDexTrade {
  return {
    chain: "ethereum",
    block_timestamp: "2026-10-06T10:00:00Z",
    transaction_hash: `0x${"a".repeat(64)}`,
    trader_address: `0x${"b".repeat(40)}`,
    trader_address_label: "Smart Trader",
    token_bought_address: `0x${"c".repeat(40)}`,
    token_bought_symbol: "ETH",
    token_bought_amount: "80",
    token_sold_address: `0x${"d".repeat(40)}`,
    token_sold_symbol: "USDC",
    token_sold_amount: "200000",
    trade_value_usd: "200000",
    ...overrides,
  };
}

function withHourlyCloses(event: WhaleEvent, closes: Array<{ timestamp: string; close: number }>): WhaleEvent {
  return {
    ...event,
    marketContext: {
      source: "nansen",
      timeframe: "1h",
      changePercent: null,
      candles: closes.map(({ timestamp, close }) => ({
        timestamp,
        open: close,
        high: close * 1.01,
        low: close * 0.99,
        close,
        volumeUsd: 1_000_000,
      })),
    },
  };
}

test("normalizes a confirmed smart-money buy without inventing a destination", () => {
  const event = normalizeNansenDexTrade(dexTrade());
  assert.ok(event);
  assert.equal(event.action, "BUY");
  assert.equal(event.eventType, "SMART_MONEY_BUY");
  assert.equal(event.symbol, "ETH");
  assert.equal(event.amount, 80);
  assert.equal(event.amountUsd, 200_000);
  assert.equal(event.toAddress, null);
  assert.equal(event.dataSources[0], "nansen");
});

test("normalizes stablecoin-paid trades as sells of the non-stable asset", () => {
  const event = normalizeNansenDexTrade(dexTrade({
    transaction_hash: `0x${"e".repeat(64)}`,
    token_bought_symbol: "USDC",
    token_bought_amount: "190000",
    token_sold_symbol: "ETH",
    token_sold_amount: "76",
    token_sold_address: `0x${"f".repeat(40)}`,
  }));
  assert.ok(event);
  assert.equal(event.action, "SELL");
  assert.equal(event.eventType, "SMART_MONEY_SELL");
  assert.equal(event.symbol, "ETH");
  assert.equal(event.amount, 76);
});

test("normalizes a BTC sale as a sale of BTC rather than the stablecoin received", () => {
  const event = normalizeNansenDexTrade(dexTrade({
    transaction_hash: `0x${"6".repeat(64)}`,
    token_bought_symbol: "USDC",
    token_bought_amount: "130000",
    token_sold_symbol: "BTC",
    token_sold_amount: "2",
    token_sold_address: `0x${"7".repeat(40)}`,
  }));
  assert.ok(event);
  assert.equal(event.action, "SELL");
  assert.equal(event.symbol, "BTC");
  assert.equal(event.amount, 2);
});

test("rejects an unlabelled wallet instead of calling it Smart Money", () => {
  const event = normalizeNansenDexTrade(dexTrade({ trader_address_label: undefined }));
  assert.equal(event, null);
});

test("does not classify a stablecoin-to-stablecoin swap as a directional whale trade", () => {
  const event = normalizeNansenDexTrade(dexTrade({
    token_bought_symbol: "USDC",
    token_sold_symbol: "USDG",
    token_bought_amount: "100000",
    token_sold_amount: "100000",
  }));
  assert.equal(event, null);
});

test("normalizes a labelled exchange transfer without treating it as a sale", () => {
  const transfer: NansenTransfer = {
    chain: "ethereum",
    block_timestamp: "2026-10-06T10:00:00Z",
    transaction_hash: `0x${"1".repeat(64)}`,
    token_address: `0x${"2".repeat(40)}`,
    token_symbol: "USDC",
    transfer_amount: "250000",
    transfer_value_usd: "250000",
    from_address: `0x${"3".repeat(40)}`,
    to_address: `0x${"4".repeat(40)}`,
    to_address_label: "Binance 14",
    transaction_type: "CEX",
  };
  const event = normalizeNansenTransfer(transfer);
  assert.ok(event);
  assert.equal(event.action, "TRANSFER");
  assert.equal(event.eventType, "EXCHANGE_DEPOSIT");
  assert.equal(event.exchange, "Binance 14");
});

test("rejects records missing a verifiable transaction or value", () => {
  assert.equal(normalizeNansenDexTrade(dexTrade({ transaction_hash: "" })), null);
  assert.equal(normalizeNansenDexTrade(dexTrade({ trade_value_usd: undefined })), null);
  assert.equal(normalizeNansenDexTrade(dexTrade({ block_timestamp: "not-a-date" })), null);
});

test("deduplicates the same transaction reported by more than one source", () => {
  const first = normalizeNansenDexTrade(dexTrade());
  assert.ok(first);
  const second = {
    ...first,
    dataSources: ["second-provider"],
    confidenceScore: 99,
    rawData: { provider: "second-provider" },
  };
  const result = deduplicateWhaleEvents([first, second]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0]?.dataSources, ["nansen", "second-provider"]);
  assert.equal((result[0]?.rawData as { deduplicated?: boolean }).deduplicated, true);
});

test("scores repeated wallet activity and reports only configured significant events", () => {
  const first = normalizeNansenDexTrade(dexTrade());
  assert.ok(first);
  const earlier = normalizeNansenDexTrade(dexTrade({
    transaction_hash: `0x${"5".repeat(64)}`,
    block_timestamp: "2026-10-06T09:00:00Z",
  }));
  assert.ok(earlier);
  const [enriched] = attachPreviousActivity([earlier, first]).slice(1);
  assert.ok(enriched);
  const scored = scoreWhaleEvent(enriched, [earlier, first], 100_000);
  assert.equal(scored.previousActivity.length, 1);
  assert.ok(scored.scoreBreakdown.accumulationScore > 0);
  assert.ok(scored.whaleScore >= 60);
  assert.equal(isSignificantWhaleEvent(scored, 100_000, 60), true);
  assert.equal(isSignificantWhaleEvent(scored, 300_000, 60), false);
});

test("adds OHLCV context without changing the event's unrelated score components", () => {
  const event = normalizeNansenDexTrade(dexTrade());
  assert.ok(event);
  const scored = scoreWhaleEvent(event, [event], 100_000);
  const enriched = updateWhaleMarketContextScore({
    ...scored,
    marketContext: {
      source: "nansen",
      timeframe: "1h",
      candles: [],
      changePercent: 2.5,
    },
  });
  assert.equal(enriched.scoreBreakdown.marketContextScore, 6);
  assert.equal(enriched.whaleScore, scored.whaleScore + 6);
  assert.equal(enriched.scoreBreakdown.unusualActivityScore, scored.scoreBreakdown.unusualActivityScore);
});

test("script and visual plan use detailed facts, explain post-trade movement, and stay vertical", () => {
  const event = normalizeNansenDexTrade(dexTrade());
  assert.ok(event);
  const story = buildWhaleStory(event);
  const plan = buildWhaleVisualPlan(event, story, 27);
  assert.match(story.narration, /примерно на 200\s000 долларов/u);
  assert.match(story.narration, /200\s000 юэсди си/u);
  assert.match(story.narration, /2\s500 долларов/u);
  assert.match(story.narration, /Привет, друзья/u);
  assert.match(story.narration, /6 октября/u);
  assert.match(story.narration, /что сейчас с эфиром/iu);
  assert.match(story.narration, /купить любую другую криптовалюту/iu);
  assert.match(story.narration, /шапке профиля канала/u);
  assert.match(story.narration, /Подписывайтесь/u);
  assert.doesNotMatch(story.narration, /\bETH\b/u);
  assert.match(story.title, /^ЭФИРИУМ/u);
  assert.doesNotMatch(
    `${story.title} ${story.hook} ${story.keyFacts.join(" ")} ${plan.scenes.map((scene) => `${scene.title} ${scene.subtitle}`).join(" ")}`,
    /\bETH\b/iu,
  );
  assert.doesNotMatch(
    `${story.narration} ${plan.scenes.map((scene) => `${scene.title} ${scene.subtitle}`).join(" ")}`,
    /ETHEREUM/iu,
  );
  assert.match(story.narration, /изменение цены не посчитать/u);
  assert.doesNotMatch(story.narration, /0x[a-f0-9]{20,}/iu);
  assert.ok(story.narration.split(/\s+/u).length <= 140);
  assert.equal(plan.format, "WHALE_RADAR_SHORTS_V1");
  assert.equal(plan.aspectRatio, "9:16");
  assert.equal(plan.scenes.length, 7);
  assert.equal(plan.targetDurationSeconds, 27);
  assert.equal(plan.scenes.at(-1)?.title, "КАЖДЫЙ ДЕНЬ — ОБЗОР СДЕЛОК КИТОВ");
  assert.equal(plan.scenes.at(-1)?.subtitle, "Ссылка на биржу — в шапке профиля канала");
  assert.notEqual(plan.scenes[2]?.kind, "MARKET");
  assert.ok(plan.scenes.some((scene) => scene.kind === "SOURCE_PROOF"));
  const planWithMarketContext = buildWhaleVisualPlan({
    ...event,
    marketContext: {
      source: "nansen",
      timeframe: "1h",
      candles: [{
        timestamp: "2026-10-06T10:00:00Z",
        open: 2_000,
        high: 2_010,
        low: 1_990,
        close: 2_005,
        volumeUsd: 50_000,
      }],
      changePercent: 0.25,
    },
  }, story, 27);
  assert.ok(planWithMarketContext.scenes.some((scene) => scene.kind === "MARKET"));
  assert.ok(planWithMarketContext.scenes.some((scene) => scene.kind === "POST_TRADE"));
  assert.ok(planWithMarketContext.scenes.some((scene) => scene.kind === "SOURCE_PROOF"));

  const transfer = normalizeNansenTransfer({
    chain: "ethereum",
    block_timestamp: "2026-10-06T10:00:00Z",
    transaction_hash: `0x${"8".repeat(64)}`,
    token_symbol: "ETH",
    transfer_amount: 100,
    transfer_value_usd: 250_000,
    from_address: `0x${"9".repeat(40)}`,
  });
  assert.ok(transfer);
  const transferStory = buildWhaleStory(transfer);
  assert.match(transferStory.disclaimer, /не означает продажу/u);
});

test("compares two distinct Nansen coins only from their own execution prices to later hourly candles", () => {
  const main = normalizeNansenDexTrade(dexTrade());
  const second = normalizeNansenDexTrade(dexTrade({
    transaction_hash: `0x${"7".repeat(64)}`,
    token_bought_symbol: "BTC",
    token_bought_amount: "2",
    token_sold_symbol: "USDC",
    token_sold_amount: "210000",
    trade_value_usd: "210000",
  }));
  assert.ok(main);
  assert.ok(second);
  const mainWithMarket = withHourlyCloses(main, [
    { timestamp: "2026-10-06T10:00:00Z", close: 2_510 },
    { timestamp: "2026-10-06T11:00:00Z", close: 2_550 },
  ]);
  const secondWithMarket = withHourlyCloses(second, [
    { timestamp: "2026-10-06T10:00:00Z", close: 104_800 },
    { timestamp: "2026-10-06T11:00:00Z", close: 103_950 },
  ]);
  assert.equal(getPostTradePerformance(mainWithMarket)?.changePercent, 2);
  assert.equal(getPostTradePerformance(mainWithMarket)?.elapsedHours, 2);
  assert.equal(getPostTradePerformance(secondWithMarket)?.changePercent, -1);

  const story = buildWhaleStory(mainWithMarket, secondWithMarket);
  const plan = buildWhaleVisualPlan(mainWithMarket, story, 60, secondWithMarket);
  assert.match(story.narration, /выросла на 2,0 процента/u);
  assert.match(story.narration, /снизилась на 1,0 процента/u);
  assert.match(story.narration, /не прогноз/u);
  assert.match(story.narration, /биткоина/u);
  assert.ok(plan.scenes.some((scene) => scene.kind === "POST_TRADE"));
  assert.ok(plan.scenes.some((scene) => scene.kind === "COMPARISON"));
  assert.equal(plan.targetDurationSeconds, 60);
  assert.equal(getPostTradePerformance({ ...mainWithMarket, action: "TRANSFER" }), null);
});

test("SEO metadata stays descriptive and does not promise an outcome", () => {
  const event = normalizeNansenDexTrade(dexTrade());
  assert.ok(event);
  const metadata = buildWhaleYoutubeMetadata(event);
  assert.match(metadata.title, /ETH/u);
  assert.match(metadata.description, /Nansen/u);
  assert.match(metadata.description, /не гарантирует/u);
  assert.ok(metadata.title.length <= 100);
});

test("Nansen client sends a bounded request and accepts documented data rows", async () => {
  const previousKey = process.env["NANSEN_API_KEY"];
  process.env["NANSEN_API_KEY"] = "unit-test-key";
  try {
    let requestHeaders: Headers | undefined;
    let requestBody: Record<string, unknown> | undefined;
    const rows = [dexTrade()];
    const result = await fetchSmartMoneyDexTrades({
      chains: ["ethereum"],
      minimumUsd: 100_000,
      pageSize: 500,
    }, async (_input, init) => {
      requestHeaders = new Headers(init?.headers);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ data: rows }), { status: 200 });
    });
    assert.equal(result.length, 1);
    assert.equal(requestHeaders?.get("apikey"), "unit-test-key");
    assert.deepEqual(requestBody?.["chains"], ["ethereum"]);
    assert.equal((requestBody?.["pagination"] as { per_page: number }).per_page, 100);
    assert.deepEqual(
      (requestBody?.["filters"] as { include_smart_money_labels: string[] }).include_smart_money_labels,
      ["Fund", "Smart Trader", "30D Smart Trader", "90D Smart Trader", "180D Smart Trader"],
    );
  } finally {
    if (previousKey === undefined) delete process.env["NANSEN_API_KEY"];
    else process.env["NANSEN_API_KEY"] = previousKey;
  }
});

test("reports Nansen rate limits rather than silently returning an empty scan", async () => {
  const previousKey = process.env["NANSEN_API_KEY"];
  process.env["NANSEN_API_KEY"] = "unit-test-key";
  try {
    await assert.rejects(
      fetchSmartMoneyDexTrades({
        chains: ["ethereum"],
        minimumUsd: 100_000,
        pageSize: 10,
      }, async () => new Response("rate limited", { status: 429 })),
      /HTTP 429.*ограничил частоту/u,
    );
  } finally {
    if (previousKey === undefined) delete process.env["NANSEN_API_KEY"];
    else process.env["NANSEN_API_KEY"] = previousKey;
  }
});

test("reuses successful Nansen scans for 24 hours to protect the free daily balance", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");
  assert.equal(getNansenScanReuseReason({
    status: "ok",
    lastFetchedAt: "2026-10-05T12:01:00.000Z",
    lastError: null,
    lastAttemptAt: "2026-10-05T12:01:00.000Z",
  }, now), "successful_scan");
  assert.equal(getNansenScanReuseReason({
    status: "ok",
    lastFetchedAt: "2026-10-05T11:59:00.000Z",
    lastError: null,
    lastAttemptAt: "2026-10-05T11:59:00.000Z",
  }, now), null);
});

test("does not retry a depleted Nansen credit balance until the next UTC day", () => {
  const beforeReset = new Date("2026-10-06T23:59:59.000Z");
  const depleted = {
    status: "error",
    lastFetchedAt: null,
    lastError: "Nansen returned HTTP 403. Insufficient credits.",
    lastAttemptAt: "2026-10-06T15:00:00.000Z",
  };
  assert.equal(getNansenScanReuseReason(depleted, beforeReset), "credits_exhausted");
  assert.equal(getNansenScanReuseReason(depleted, new Date("2026-10-07T00:00:00.000Z")), null);
});

test("briefly suppresses duplicate scans while a request is running or after a transient failure", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");
  assert.equal(getNansenScanReuseReason({
    status: "fetching",
    lastFetchedAt: null,
    lastError: null,
    lastAttemptAt: "2026-10-06T11:55:00.000Z",
  }, now), "recent_attempt");
  assert.equal(getNansenScanReuseReason({
    status: "error",
    lastFetchedAt: null,
    lastError: "Nansen network timeout",
    lastAttemptAt: "2026-10-06T11:40:00.000Z",
  }, now), null);
});
