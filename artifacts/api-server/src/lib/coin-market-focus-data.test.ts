import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarketFocusStory,
  resolveMarketFocusMarketData,
} from "./coin-market-focus-data";

const FIXED_NOW = Date.parse("2026-09-27T09:37:00.000Z");
const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

function xmlItem(title: string, url: string, publishedAt: string): string {
  return `<item><title>${title}</title><link>${url}</link><pubDate>${publishedAt}</pubDate></item>`;
}

function response(body: unknown, contentType = "application/json"): Response {
  return new Response(
    typeof body === "string" ? body : JSON.stringify(body),
    { status: 200, headers: { "content-type": contentType } },
  );
}

function makeKlines(
  pair: string,
  interval: "1h" | "1d",
  startTime: number,
  count: number,
): unknown[][] {
  const intervalMs = interval === "1h" ? HOUR_MS : DAY_MS;
  const base = pair === "BTCUSDT" ? 60_000 : pair === "ETHUSDT" ? 3_000 : 10;
  return Array.from({ length: count }, (_, index) => {
    const open = base + index * (pair === "BTCUSDT" ? 30 : pair === "ETHUSDT" ? 2 : 0.1);
    const close = open + (pair === "BTCUSDT" ? 15 : pair === "ETHUSDT" ? 1 : 0.05);
    return [
      startTime + index * intervalMs,
      String(open),
      String(close + 0.2),
      String(open - 0.2),
      String(close),
      "100",
      startTime + (index + 1) * intervalMs - 1,
      interval === "1h" ? "100" : "1000",
    ];
  });
}

function makeFetcher(options: {
  newsXml?: string;
  badNewsDomain?: boolean;
  incompletePair?: string;
} = {}): typeof fetch {
  const hourlyStart = Math.floor(FIXED_NOW / HOUR_MS) * HOUR_MS - 24 * HOUR_MS;
  const newsDate = new Date(FIXED_NOW - DAY_MS).toUTCString();
  const newsUrl = options.badNewsDomain
    ? "https://example.com/qnt-news"
    : "https://www.coindesk.com/markets/qnt-news";
  const xml = options.newsXml
    ?? `<rss><channel>${xmlItem("QNT announces a new integration", newsUrl, newsDate)}</channel></rss>`;

  return async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const url = new URL(String(input));
    if (url.hostname === "api.binance.com" && url.pathname.endsWith("/exchangeInfo")) {
      return response({
        symbols: [{
          symbol: "QNTUSDT",
          status: "TRADING",
          baseAsset: "QNT",
          quoteAsset: "USDT",
        }],
      });
    }
    if (url.hostname === "api.binance.com" && url.pathname.endsWith("/klines")) {
      const pair = url.searchParams.get("symbol") ?? "";
      const interval = url.searchParams.get("interval") as "1h" | "1d";
      const start = Number(url.searchParams.get("startTime"));
      const count = interval === "1h" ? 24 : 7;
      if (options.incompletePair === pair && interval === "1h") {
        return response(makeKlines(pair, interval, hourlyStart, count - 1));
      }
      return response(makeKlines(pair, interval, start, count));
    }
    if (url.hostname === "api.coingecko.com") {
      return response({
        coins: [{ id: "quant-network", name: "Quant", symbol: "qnt" }],
      });
    }
    if (
      url.hostname === "www.coindesk.com"
      || url.hostname === "cointelegraph.com"
      || url.hostname === "decrypt.co"
      || url.hostname === "quant.network"
    ) {
      return response(xml, "application/rss+xml");
    }
    throw new Error(`Unexpected test request: ${url.toString()}`);
  };
}

test("market focus snapshots 24 aligned closed hours and seven full UTC days", async () => {
  const data = await resolveMarketFocusMarketData("QNT", {
    fetcher: makeFetcher(),
    now: () => FIXED_NOW,
  });

  assert.equal(data.coin.pair, "QNTUSDT");
  assert.equal(data.currency, "USDT");
  assert.equal(data.hourlyCandles.length, 24);
  assert.equal(data.dailyQuoteVolumes.length, 7);
  assert.equal(data.hourlyCandles[0]!.openTime, Math.floor(FIXED_NOW / HOUR_MS) * HOUR_MS - 24 * HOUR_MS);
  assert.equal(data.hourlyCandles.at(-1)!.closeTime, Math.floor(FIXED_NOW / HOUR_MS) * HOUR_MS - 1);
  assert.equal(data.periodEndUtc, new Date(Math.floor(FIXED_NOW / HOUR_MS) * HOUR_MS).toISOString());
  assert.equal(data.quoteVolume24h, 2_400);
  assert.equal(data.averageDailyQuoteVolume7d, 1_000);
  assert.equal(data.volumeVs7dAverage, 2.4);
  assert.deepEqual(data.benchmarks.map((item) => item.symbol), ["BTC", "ETH"]);
  assert.equal(data.news.sourceName, "CoinDesk");
  assert.equal(data.news.verificationMethod, "publisher_rss");

  const story = buildMarketFocusStory(data);
  assert.deepEqual(story.map((scene) => scene.key), [
    "impulse",
    "candles",
    "volume",
    "news",
    "benchmarks",
    "risk",
  ]);
  assert.ok(story.reduce((total, scene) => total + scene.voiceText.split(/\s+/).length, 0) < 100);
  assert.match(story[3]!.voiceText, /Связь с движением цены не доказана/);
  assert.match(story[5]!.voiceText, /не доказывает спрос на токен/);
});

test("market focus rejects headlines whose links are outside the publisher domain", async () => {
  await assert.rejects(
    resolveMarketFocusMarketData("QNT", {
      fetcher: makeFetcher({ badNewsDomain: true }),
      now: () => FIXED_NOW,
    }),
    /Не нашёл свежую новость/,
  );
});

test("market focus accepts a QNT project announcement from its official RSS domain", async () => {
  const officialHeadline = "Quant announces a new on-chain money initiative";
  const officialXml = `<rss><channel>${xmlItem(
    officialHeadline,
    "https://quant.network/press-releases/on-chain-money",
    new Date(FIXED_NOW - DAY_MS).toUTCString(),
  )}</channel></rss>`;
  const data = await resolveMarketFocusMarketData("QNT", {
    fetcher: makeFetcher({ newsXml: officialXml }),
    now: () => FIXED_NOW,
  });
  assert.equal(data.news.sourceName, "Quant Network");
  assert.equal(data.news.title, officialHeadline);
  assert.equal(data.news.sourceDomain, "quant.network");
});

test("market focus rejects incomplete benchmark candles", async () => {
  await assert.rejects(
    resolveMarketFocusMarketData("QNT", {
      fetcher: makeFetcher({ incompletePair: "ETHUSDT" }),
      now: () => FIXED_NOW,
    }),
    /не вернул 24 завершённых свечей для ETHUSDT/,
  );
});

test("market focus rejects stale headlines", async () => {
  const staleDate = new Date(FIXED_NOW - 9 * DAY_MS).toUTCString();
  const staleXml = `<rss><channel>${xmlItem(
    "QNT announces a new integration",
    "https://www.coindesk.com/markets/qnt-news",
    staleDate,
  )}</channel></rss>`;
  await assert.rejects(
    resolveMarketFocusMarketData("QNT", {
      fetcher: makeFetcher({ newsXml: staleXml }),
      now: () => FIXED_NOW,
    }),
    /Не нашёл свежую новость/,
  );
});