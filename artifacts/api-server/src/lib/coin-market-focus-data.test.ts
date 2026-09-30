import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { FINANCIAL_MUSIC_BED_PATH } from "./financial-music-asset";
import {
  buildMarketFocusCashRegisterCueDelays,
  buildMarketFocusOpeningHookBeat,
  buildMarketDataAudioFilterGraph,
  renderFinancialTopicPreviewFrame,
  renderFinancialTopicShortWithAudioTrack,
  type FinancialShortBeat,
  type FinancialShortRenderPlan,
} from "./financial-short-renderer";
import {
  buildMarketFocusVideoTitle,
  buildMarketFocusCta,
  buildMarketFocusStory,
  calculateMarketFocusHypotheticalExitValueUsdt,
  calculateMarketFocusHypotheticalPnlUsd,
  formatMarketFocusHypotheticalPnlForVoice,
  listMarketFocusTopGainers,
  resolveNextMarketFocusTopGainer,
  resolveMarketFocusMarketData,
} from "./coin-market-focus-data";
import { collectUsedMarketFocusSymbols } from "./market-focus-job-history";

const FIXED_NOW = Date.parse("2026-09-27T09:37:00.000Z");
const MINUTE_MS = 60 * 1_000;
const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;
const execFileAsync = promisify(execFile);
const TEST_COIN_LOGO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==",
  "base64",
);

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
  interval: "1m" | "1h" | "1d",
  startTime: number,
  count: number,
): unknown[][] {
  const intervalMs = interval === "1m" ? MINUTE_MS : interval === "1h" ? HOUR_MS : DAY_MS;
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
      interval === "1d" ? "1000" : "100",
    ];
  });
}

function makeFetcher(options: {
  newsXml?: string;
  badNewsDomain?: boolean;
  failNewsFetch?: boolean;
  incompletePair?: string;
  marketSymbols?: string[];
  gainers?: Array<{
    symbol: string;
    priceChangePercent: string;
    quoteVolume: string;
    lastPrice?: string;
    openTime?: number;
    closeTime?: number;
    openPrice?: string;
    highPrice?: string;
    lowPrice?: string;
  }>;
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
      if (!url.searchParams.has("symbol") && options.marketSymbols) {
        return response({
          symbols: options.marketSymbols.map((symbol) => ({
            symbol,
            status: "TRADING",
            baseAsset: symbol.replace(/USDT$/, ""),
            quoteAsset: "USDT",
          })),
        });
      }
      const pair = url.searchParams.get("symbol") ?? "QNTUSDT";
      return response({
        symbols: [{
          symbol: pair,
          status: "TRADING",
          baseAsset: pair.replace(/USDT$/, ""),
          quoteAsset: "USDT",
        }],
      });
    }
    if (url.hostname === "api.binance.com" && url.pathname.endsWith("/ticker/24hr")) {
      return response(options.gainers ?? []);
    }
    if (url.hostname === "api.binance.com" && url.pathname.endsWith("/klines")) {
      const pair = url.searchParams.get("symbol") ?? "";
      const interval = url.searchParams.get("interval") as "1m" | "1h" | "1d";
      const start = Number(url.searchParams.get("startTime"));
      const count = interval === "1m"
        ? Number(url.searchParams.get("limit"))
        : interval === "1h"
          ? 24
          : 7;
      if (options.incompletePair === pair && interval === "1h") {
        return response(makeKlines(pair, interval, hourlyStart, count - 1));
      }
      return response(makeKlines(pair, interval, start, count));
    }
    if (url.hostname === "api.coingecko.com") {
      const symbol = (url.searchParams.get("query") ?? "QNT").toLocaleUpperCase("en-US");
      return response({
        coins: [{
          id: symbol === "QNT" ? "quant-network" : symbol.toLocaleLowerCase("en-US"),
          name: symbol === "QNT" ? "Quant" : symbol,
          symbol: symbol.toLocaleLowerCase("en-US"),
          large: `https://assets.coingecko.com/coins/images/1/large/${symbol.toLocaleLowerCase("en-US")}.png`,
        }],
      });
    }
    if (url.hostname === "assets.coingecko.com") {
      return new Response(TEST_COIN_LOGO, {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }
    if (
      url.hostname === "www.coindesk.com"
      || url.hostname === "cointelegraph.com"
      || url.hostname === "decrypt.co"
      || url.hostname === "quant.network"
      || url.hostname === "www.theblock.co"
      || url.hostname === "cryptoslate.com"
      || url.hostname === "coinjournal.net"
      || url.hostname === "crypto.news"
      || url.hostname === "www.newsbtc.com"
      || url.hostname === "bitcoinist.com"
    ) {
      if (options.failNewsFetch) throw new Error("Publisher RSS unavailable");
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
  assert.match(data.coin.logoDataUri ?? "", /^data:image\/png;base64,/);
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
  assert.ok(data.news);
  assert.equal(data.news.sourceName, "CoinDesk");
  assert.equal(data.news.verificationMethod, "publisher_rss");
  assert.equal(
    buildMarketFocusCta(),
    "Хочешь сам посмотреть, что сейчас происходит с этой монетой? Ссылка на биржу — в описании и шапке профиля.",
  );

  const story = buildMarketFocusStory(data);
  assert.deepEqual(story.map((scene) => scene.key), [
    "impulse",
    "candles",
    "investment",
    "volume",
    "news",
    "benchmarks",
    "risk",
  ]);
  assert.ok(story.reduce((total, scene) => total + scene.voiceText.split(/\s+/).length, 0) < 180);
  assert.match(story[0]!.voiceText, /Привет, друзья!/);
  assert.match(story[0]!.voiceText, /с 26 по 27 сентября/);
  assert.doesNotMatch(story[0]!.voiceText, /09:00|UTC/);
  assert.match(story[2]!.voiceText, /вложить тысячу долларов/);
  assert.match(story[2]!.voiceText, /1\s235 USDT/);
  assert.match(story[2]!.voiceText, /235 USDT больше исходной суммы/);
  assert.match(story[1]!.voiceText, /минимум и максимум цены за сутки показаны на экране/i);
  assert.doesNotMatch(story[1]!.voiceText, /,\d{2,}/);
  assert.match(story[2]!.voiceText, /до комиссий и проскальзывания/);
  assert.equal(story[2]!.soundEffect, "cash_register");
  const fractionalStory = buildMarketFocusStory({ ...data, changePercent24h: 23.45678 });
  assert.match(fractionalStory[2]!.voiceText, /1\s234,6 USDT/);
  assert.match(fractionalStory[2]!.voiceText, /234,6 USDT больше исходной суммы/);
  assert.doesNotMatch(fractionalStory[2]!.voiceText, /USDT[^.]*,\d{2,}/);
  assert.match(story[4]!.voiceText, /доказательств этому нет/i);
  assert.match(story[5]!.voiceText, /биткоин.*эфир/i);
  assert.match(story[6]!.voiceText, /не рекомендация покупать или продавать/i);
});

test("market focus explains a hypothetical $1,000 spot result as a symmetric price-change example", () => {
  assert.equal(
    calculateMarketFocusHypotheticalPnlUsd({ changePercent24h: 23.5 }),
    235,
  );
  assert.equal(
    calculateMarketFocusHypotheticalExitValueUsdt({ changePercent24h: 23.5 }),
    1_235,
  );
  assert.equal(
    buildMarketFocusVideoTitle({
      coin: { name: "Quant", symbol: "QNT", pair: "QNTUSDT", sourceUrl: "" },
      changePercent24h: 23.5,
    }),
    "Рост QNT на 23,50% за 24 часа: что произошло?",
  );
  assert.equal(
    buildMarketFocusVideoTitle({
      coin: { name: "Quant", symbol: "QNT", pair: "QNTUSDT", sourceUrl: "" },
      changePercent24h: -12.5,
    }),
    "Падение QNT на 12,50% за 24 часа: что произошло?",
  );
  assert.equal(
    formatMarketFocusHypotheticalPnlForVoice({ changePercent24h: 23.5 }),
    "плюс 235 долларов США",
  );
  assert.equal(
    formatMarketFocusHypotheticalPnlForVoice({ changePercent24h: -12.5 }),
    "минус 125 долларов США",
  );
  assert.equal(
    formatMarketFocusHypotheticalPnlForVoice({ changePercent24h: 23.45678 }),
    "плюс 234,6 доллара США",
  );
  assert.equal(
    formatMarketFocusHypotheticalPnlForVoice({ changePercent24h: 0.02 }),
    "около нуля долларов США",
  );
});

test("market focus loss examples show the reduced USDT balance without the profit cue", async () => {
  const data = await resolveMarketFocusMarketData("QNT", {
    fetcher: makeFetcher(),
    now: () => FIXED_NOW,
  });
  const lossStory = buildMarketFocusStory({ ...data, changePercent24h: -12.5 });

  assert.equal(calculateMarketFocusHypotheticalExitValueUsdt({ changePercent24h: -12.5 }), 875);
  assert.match(lossStory[2]!.voiceText, /875 USDT/);
  assert.match(lossStory[2]!.voiceText, /125 USDT меньше исходной суммы/);
  const fractionalLossStory = buildMarketFocusStory({ ...data, changePercent24h: -12.34 });
  assert.match(fractionalLossStory[2]!.voiceText, /876,6 USDT/);
  assert.match(fractionalLossStory[2]!.voiceText, /123,4 USDT меньше исходной суммы/);
  assert.equal(lossStory[2]!.soundEffect, "none");
});

test("market focus resolves duplicate CoinGecko tickers using the best market-cap rank", async () => {
  const fallbackFetcher = makeFetcher();
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "api.coingecko.com") {
      return response({
        coins: [
          { id: "qnt-bridged", name: "Bridged QNT", symbol: "qnt", market_cap_rank: null, large: "https://assets.coingecko.com/bridged.png" },
          { id: "quant-network", name: "Quant", symbol: "qnt", market_cap_rank: 62, large: "https://assets.coingecko.com/quant.png" },
        ],
      });
    }
    return fallbackFetcher(input);
  };

  const data = await resolveMarketFocusMarketData("QNT", { fetcher, now: () => FIXED_NOW });

  assert.equal(data.coin.name, "Quant");
  assert.match(data.coin.logoDataUri ?? "", /^data:image\/png;base64,/);
});

test("market focus falls back to CoinPaprika when CoinGecko cannot resolve a logo", async () => {
  const fallbackFetcher = makeFetcher();
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "api.coingecko.com") {
      return response({
        coins: [
          { id: "qnt-one", name: "QNT One", symbol: "qnt", market_cap_rank: null, large: "https://assets.coingecko.com/one.png" },
          { id: "qnt-two", name: "QNT Two", symbol: "qnt", market_cap_rank: null, large: "https://assets.coingecko.com/two.png" },
        ],
      });
    }
    if (url.hostname === "api.coinpaprika.com") {
      return response({
        currencies: [
          { id: "quant-network", name: "Quant Network", symbol: "QNT", rank: 90, is_active: true },
          { id: "qnt-impostor", name: "QNT Impostor", symbol: "QNT", rank: 900, is_active: true },
        ],
      });
    }
    if (url.hostname === "static.coinpaprika.com") {
      return new Response(TEST_COIN_LOGO, {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }
    return fallbackFetcher(input);
  };

  const data = await resolveMarketFocusMarketData("QNT", { fetcher, now: () => FIXED_NOW });

  assert.equal(data.coin.name, "Quant Network");
  assert.match(data.coin.logoDataUri ?? "", /^data:image\/png;base64,/);
});

test("market focus refuses an unresolved ticker instead of attaching the wrong logo", async () => {
  const fallbackFetcher = makeFetcher();
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "api.coingecko.com") {
      return response({
        coins: [
          { id: "qnt-one", name: "QNT One", symbol: "qnt", market_cap_rank: null, large: "https://assets.coingecko.com/one.png" },
          { id: "qnt-two", name: "QNT Two", symbol: "qnt", market_cap_rank: null, large: "https://assets.coingecko.com/two.png" },
        ],
      });
    }
    if (url.hostname === "api.coinpaprika.com") {
      return response({
        currencies: [
          { id: "qnt-one", name: "QNT One", symbol: "QNT", rank: null, is_active: true },
          { id: "qnt-two", name: "QNT Two", symbol: "QNT", rank: null, is_active: true },
        ],
      });
    }
    return fallbackFetcher(input);
  };

  await assert.rejects(
    resolveMarketFocusMarketData("QNT", { fetcher, now: () => FIXED_NOW }),
    /основную монету QNT/,
  );
});

test("lists the ten largest positive Binance Spot gainers with price and 24-hour volume", async () => {
  const gainers: Array<{
    symbol: string;
    priceChangePercent: string;
    quoteVolume: string;
    lastPrice?: string;
    openTime?: number;
    closeTime?: number;
    openPrice?: string;
    highPrice?: string;
    lowPrice?: string;
  }> = Array.from({ length: 12 }, (_value, index) => {
    const lastPrice = index + 1;
    const changePercent = 60 - index;
    const openPrice = lastPrice / (1 + changePercent / 100);
    return {
      symbol: `COIN${index}USDT`,
      priceChangePercent: String(changePercent),
      quoteVolume: "2000000",
      lastPrice: String(lastPrice),
      openTime: FIXED_NOW - DAY_MS,
      closeTime: FIXED_NOW,
      openPrice: String(openPrice),
      highPrice: String(lastPrice + 0.1),
      lowPrice: String(openPrice - 0.1),
    };
  });
  gainers.push(
    { symbol: "USDCUSDT", priceChangePercent: "99", quoteVolume: "5000000", lastPrice: "1" },
    { symbol: "COINBULLUSDT", priceChangePercent: "98", quoteVolume: "5000000", lastPrice: "1" },
    { symbol: "THINUSDT", priceChangePercent: "97", quoteVolume: "100000", lastPrice: "1" },
    { symbol: "BTCUSDT", priceChangePercent: "2.5", quoteVolume: "1000", lastPrice: "60000" },
    { symbol: "ETHUSDT", priceChangePercent: "-1.25", quoteVolume: "1000", lastPrice: "3000" },
  );
  const list = await listMarketFocusTopGainers(10, {
    fetcher: makeFetcher({
      gainers,
      marketSymbols: gainers.map((item) => item.symbol),
    }),
  });

  assert.equal(list.length, 10);
  assert.deepEqual(list.map((item) => item.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(list.map((item) => item.symbol), Array.from({ length: 10 }, (_value, index) => `COIN${index}`));
  assert.equal(list[0]?.changePercent24h, 60);
  assert.equal(list[0]?.lastPriceUsdt, 1);
  assert.equal(list[0]?.quoteVolume24h, 2_000_000);
  assert.equal(list[0]?.windowStartMs, FIXED_NOW - DAY_MS);
  assert.equal(list[0]?.windowEndMs, FIXED_NOW);
  assert.ok(Math.abs((list[0]?.openPriceUsdt ?? 0) - 0.625) < 1e-9);
  assert.deepEqual(list[0]?.benchmarks, [
    { symbol: "BTC", changePercent24h: 2.5 },
    { symbol: "ETH", changePercent24h: -1.25 },
  ]);
});

test("selected gainers use the exact rolling Binance snapshot throughout the market-focus data", async () => {
  const data = await resolveMarketFocusMarketData("QNT", {
    fetcher: makeFetcher(),
    now: () => FIXED_NOW,
    rankingSnapshot: {
      changePercent24h: 38.63,
      lastPriceUsdt: 0.09045,
      quoteVolume24h: 18_200_000,
      windowStartMs: FIXED_NOW - DAY_MS,
      windowEndMs: FIXED_NOW,
      openPriceUsdt: 0.06526,
      highPrice24h: 0.095,
      lowPrice24h: 0.064,
      benchmarks: [
        { symbol: "BTC", changePercent24h: 1.2 },
        { symbol: "ETH", changePercent24h: -0.7 },
      ],
    },
  });
  assert.equal(data.periodKind, "rolling");
  assert.equal(data.changePercent24h, 38.63);
  assert.equal(data.currentPrice, 0.09045);
  assert.equal(data.quoteVolume24h, 18_200_000);
  assert.equal(data.periodStartUtc, new Date(FIXED_NOW - DAY_MS).toISOString());
  assert.equal(data.periodEndUtc, new Date(FIXED_NOW).toISOString());
  assert.equal(data.hourlyCandles.length, 24);
  assert.equal(data.hourlyCandles[0]?.open, 0.06526);
  assert.equal(data.hourlyCandles.at(-1)?.close, 0.09045);
  assert.deepEqual(data.benchmarks, [
    { symbol: "BTC", changePercent24h: 1.2 },
    { symbol: "ETH", changePercent24h: -0.7 },
  ]);
  assert.ok(Math.abs(calculateMarketFocusHypotheticalPnlUsd(data) - 386.3) < 1e-9);
  assert.ok(Math.abs(calculateMarketFocusHypotheticalExitValueUsdt(data) - 1_386.3) < 1e-9);
  const story = buildMarketFocusStory(data);
  assert.equal(buildMarketFocusVideoTitle(data), "Рост QNT на 38,63% за 24 часа: что произошло?");
  assert.match(story[0]!.title, /\+38,63%/u);
  assert.match(story[0]!.subtitle, /скользящее окно Binance/u);
  assert.match(story[0]!.voiceText, /38,63/u);

  const durationMs = 70_000;
  const beats = story.map((scene, index) => ({
    from: index / story.length,
    to: (index + 1) / story.length,
    title: scene.title,
    subtitle: scene.subtitle,
    visual: "market",
    background: "grid",
  } as unknown as FinancialShortBeat));
  const plan = {
    mainTitle: "QNT • МОНЕТА В ФОКУСЕ",
    background: "grid",
    visualTheme: "market_focus_24h",
    marketFocusData: data,
    beats,
  } as unknown as FinancialShortRenderPlan;
  const sceneStartsMs = beats.slice(1).map((beat) => Math.round(beat.from * durationMs));
  const introFrame = renderFinancialTopicPreviewFrame(plan, durationMs, 1_000, sceneStartsMs);
  const investmentBeat = beats[2]!;
  const investmentTimeMs = Math.round((investmentBeat.from + investmentBeat.to) * durationMs / 2);
  const investmentFrame = renderFinancialTopicPreviewFrame(
    plan,
    durationMs,
    investmentTimeMs,
    sceneStartsMs,
  );
  assert.match(introFrame, /\+38,63%/u);
  assert.match(investmentFrame, /ИЗМЕНЕНИЕ ЦЕНЫ \+38,63%/u);
});

test("market focus never treats an unverified headline as a catalyst and states when the cause is unknown", async () => {
  const data = await resolveMarketFocusMarketData("QNT", {
    fetcher: makeFetcher({ badNewsDomain: true }),
    now: () => FIXED_NOW,
  });
  assert.equal(data.news, null);
  const story = buildMarketFocusStory(data);
  assert.match(story[4]!.voiceText, /не нашли новости/i);
  assert.match(story[4]!.voiceText, /Точная причина неизвестна/i);
  assert.match(story[5]!.voiceText, /не объясняет его причину/i);
  assert.match(story[6]!.voiceText, /точную причину движения мы не нашли/i);
});

test("market focus still stops if no publisher feeds can be checked", async () => {
  await assert.rejects(
    resolveMarketFocusMarketData("QNT", {
      fetcher: makeFetcher({ failNewsFetch: true }),
      now: () => FIXED_NOW,
    }),
    /Не удалось проверить ни одну новостную ленту/,
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
  assert.ok(data.news);
  assert.equal(data.news.sourceName, "Quant Network");
  assert.equal(data.news.title, officialHeadline);
  assert.equal(data.news.sourceDomain, "quant.network");
});

test("market focus accepts a fresh headline from an expanded direct publisher feed", async () => {
  const expandedHeadline = "QNT rises as Bitcoin pauses";
  const publisherXml = `<rss><channel>${xmlItem(
    expandedHeadline,
    "https://www.theblock.co/markets/qnt-rises",
    new Date(FIXED_NOW - 2 * HOUR_MS).toUTCString(),
  )}</channel></rss>`;
  const data = await resolveMarketFocusMarketData("QNT", {
    fetcher: makeFetcher({ newsXml: publisherXml }),
    now: () => FIXED_NOW,
  });
  assert.ok(data.news);
  assert.equal(data.news.sourceName, "The Block");
  assert.equal(data.news.title, expandedHeadline);
  assert.equal(data.news.sourceDomain, "www.theblock.co");
});

test("automatic market focus allows a top gainer without news and skips unavailable markets", async () => {
  const gainers = [
    { symbol: "ALTUSDT", priceChangePercent: "42", quoteVolume: "5000000" },
    { symbol: "QNTUSDT", priceChangePercent: "30", quoteVolume: "2000000" },
    { symbol: "BTCUSDT", priceChangePercent: "20", quoteVolume: "3000000000" },
    { symbol: "SHIBUPUSDT", priceChangePercent: "90", quoteVolume: "5000000" },
    { symbol: "THINUSDT", priceChangePercent: "80", quoteVolume: "100000" },
  ];
  const marketSymbols = gainers.map((item) => item.symbol);
  const qntNews = `<rss><channel>${xmlItem(
    "QNT rises on fresh integration news",
    "https://www.coindesk.com/markets/qnt-rises",
    new Date(FIXED_NOW - HOUR_MS).toUTCString(),
  )}</channel></rss>`;
  const firstSelection = await resolveNextMarketFocusTopGainer([], {
    fetcher: makeFetcher({ gainers, marketSymbols, newsXml: qntNews }),
    now: () => FIXED_NOW,
  });
  assert.equal(firstSelection.data.coin.symbol, "ALT");
  assert.equal(firstSelection.data.news, null);
  assert.equal(firstSelection.rank, 1);
  assert.deepEqual(firstSelection.checkedSymbols, ["ALT"]);

  const btcNews = `<rss><channel>${xmlItem(
    "BTC rallies as spot demand returns",
    "https://www.coindesk.com/markets/btc-rallies",
    new Date(FIXED_NOW - HOUR_MS).toUTCString(),
  )}</channel></rss>`;
  const nextSelection = await resolveNextMarketFocusTopGainer(["ALT", "QNT"], {
    fetcher: makeFetcher({ gainers, marketSymbols, newsXml: btcNews }),
    now: () => FIXED_NOW,
  });
  assert.equal(nextSelection.data.coin.symbol, "BTC");
  assert.equal(nextSelection.rank, 3);
  assert.deepEqual(nextSelection.checkedSymbols, ["BTC"]);
});

test("market-focus history prevents repeats from completed and active jobs", () => {
  const completedJobs = [
    {
      plan: {
        visualTheme: "market_focus_24h",
        marketFocusData: { coin: { symbol: "qnt" } },
      },
      topic: "QNT",
    },
    {
      plan: { visualTheme: "market_focus_24h" },
      topic: "BTC/USDT",
    },
    {
      plan: { visualTheme: "coin_overview" },
      topic: "ETH",
    },
  ];
  const activeJobs = [
    {
      plan: { visualTheme: "market_focus_24h" },
      topic: "$btc",
    },
    {
      plan: { visualTheme: "market_focus_24h" },
      topic: "ETH",
    },
  ];

  assert.deepEqual(
    collectUsedMarketFocusSymbols(completedJobs, activeJobs),
    ["QNT", "BTC", "ETH"],
  );
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

test("market focus treats stale headlines as no-news and renders an explicit missing-catalyst card", async () => {
  const staleDate = new Date(FIXED_NOW - 9 * DAY_MS).toUTCString();
  const staleXml = `<rss><channel>${xmlItem(
    "QNT announces a new integration",
    "https://www.coindesk.com/markets/qnt-news",
    staleDate,
  )}</channel></rss>`;
  const data = await resolveMarketFocusMarketData("QNT", {
    fetcher: makeFetcher({ newsXml: staleXml }),
    now: () => FIXED_NOW,
  });
  assert.equal(data.news, null);
  const story = buildMarketFocusStory(data);
  assert.match(story[4]!.voiceText, /не нашли новости/i);
  const durationMs = 36_000;
  const beats = story.map((scene, index) => ({
    from: index / story.length,
    to: (index + 1) / story.length,
    title: scene.title,
    subtitle: scene.subtitle,
    visual: "market",
    background: "grid",
  } as unknown as FinancialShortBeat));
  const plan = {
    mainTitle: "QNT • МОНЕТА В ФОКУСЕ",
    background: "grid",
    visualTheme: "market_focus_24h",
    marketFocusData: data,
    beats,
  } as unknown as FinancialShortRenderPlan;
  const sceneStartsMs = beats.slice(1).map((beat) => Math.round(beat.from * durationMs));
  const svg = renderFinancialTopicPreviewFrame(plan, durationMs, 21_000, sceneStartsMs);
  assert.match(svg, /НОВОСТНОЙ КАТАЛИЗАТОР НЕ НАЙДЕН/);
  assert.doesNotMatch(svg, /ЗАГОЛОВОК ИЗ ИСТОЧНИКА/);
});

test("market focus leads with an animated result hook and encodes the original seven scenes after it", async () => {
  const data = await resolveMarketFocusMarketData("QNT", {
    fetcher: makeFetcher(),
    now: () => FIXED_NOW,
  });
  const story = buildMarketFocusStory(data);
  const durationMs = 39_000;
  const hookDurationMs = 3_000;
  const mainDurationMs = durationMs - hookDurationMs;
  const openingHook = buildMarketFocusOpeningHookBeat(data);
  const originalMainBeats = story.map((scene, index) => ({
    from: index / story.length,
    to: (index + 1) / story.length,
    title: scene.title,
    subtitle: scene.subtitle,
    visual: "market",
    background: "grid",
  } as unknown as FinancialShortBeat));
  const beats: FinancialShortBeat[] = [
    { ...openingHook, from: 0, to: hookDurationMs / durationMs },
    ...originalMainBeats.map((beat) => ({
      ...beat,
      from: (hookDurationMs + beat.from * mainDurationMs) / durationMs,
      to: (hookDurationMs + beat.to * mainDurationMs) / durationMs,
    })),
  ];
  const plan = {
    mainTitle: "QNT • МОНЕТА В ФОКУСЕ",
    background: "grid",
    visualTheme: "market_focus_24h",
    marketFocusData: data,
    beats,
  } as unknown as FinancialShortRenderPlan;
  const sceneStartsMs = beats.slice(1).map((beat) => Math.round(beat.from * durationMs));
  const hookTimeMs = Math.round(hookDurationMs * 0.92);
  const hookFrame = renderFinancialTopicPreviewFrame(plan, durationMs, hookTimeMs, sceneStartsMs);
  assert.match(hookFrame, /data:image\/jpeg;base64,/);
  assert.match(openingHook.voiceText ?? "", /Плюс.*235.*одной сделкой за 24 часа/iu);
  assert.equal(openingHook.soundEffect, "cash_register");
  assert.match(hookFrame, /\+\$235/);
  assert.match(hookFrame, /ОДНОЙ СДЕЛКОЙ ЗА 24 ЧАСА/);

  const negativeData = { ...data, changePercent24h: -12.5 };
  const negativeHook = buildMarketFocusOpeningHookBeat(negativeData);
  assert.match(negativeHook.voiceText ?? "", /Минус.*125.*одной сделкой за 24 часа/iu);
  assert.equal(negativeHook.soundEffect, "none");
  const negativeHookFrame = renderFinancialTopicPreviewFrame({
    ...plan,
    marketFocusData: negativeData,
    beats: [{ ...negativeHook, from: 0, to: hookDurationMs / durationMs }, ...beats.slice(1)],
  } as unknown as FinancialShortRenderPlan, durationMs, hookTimeMs, sceneStartsMs);
  assert.match(negativeHookFrame, /−\$125/);
  assert.doesNotMatch(negativeHookFrame, /\+\$235/);

  const cashCueDelays = buildMarketFocusCashRegisterCueDelays([
    { ...openingHook, from: 0, to: hookDurationMs / durationMs },
    { id: "market-focus-main-result", from: 0.4, to: 0.55, soundEffect: "cash_register" },
  ], durationMs);
  assert.deepEqual(cashCueDelays, [360, 17_238]);
  assert.deepEqual(buildMarketFocusCashRegisterCueDelays([
    { ...negativeHook, from: 0, to: hookDurationMs / durationMs },
  ], durationMs), []);

  const frames: string[] = [hookFrame];
  const mainBeats = beats.slice(1);
  const firstMainFrame = renderFinancialTopicPreviewFrame(
    plan,
    durationMs,
    hookDurationMs + 700,
    sceneStartsMs,
  );
  assert.match(firstMainFrame, /01 \/ 07/);
  assert.match(firstMainFrame, /data:image\/jpeg;base64,/);
  assert.match(firstMainFrame, /data:image\/png;base64,/);
  const pnlBeat = mainBeats[2]!;
  const pnlFrameTimeMs = Math.round((pnlBeat.from + pnlBeat.to) * durationMs / 2);
  const pnlFrame = renderFinancialTopicPreviewFrame(plan, durationMs, pnlFrameTimeMs, sceneStartsMs);
  assert.match(pnlFrame, /03 \/ 07/);
  assert.match(pnlFrame, /\$1 000/);

  for (const [index, scene] of story.entries()) {
    const timeMs = Math.round(((mainBeats[index]!.from + mainBeats[index]!.to) / 2) * durationMs);
    const svg = renderFinancialTopicPreviewFrame(plan, durationMs, timeMs, sceneStartsMs);
    assert.match(svg, /viewBox="0 0 1080 1920"/);
    assert.ok(svg.includes(scene.title));
    assert.doesNotMatch(svg, /="[^"]*\d_\d/);
    if (index === 0) assert.match(svg, /data:image\/png;base64,/);
    if (index === 1) {
      assert.match(svg, /МАКСИМУМ .* UTC · МИНИМУМ .* UTC/);
      assert.match(svg, /ПОЗИЦИЯ ТЕКУЩЕЙ ЦЕНЫ В ДИАПАЗОНЕ/);
    }
    if (index === 3) assert.match(svg, /1×/);
    if (index === 1) {
      assert.match(svg, /24 ЗАКРЫТЫЕ ЧАСОВЫЕ СВЕЧИ/);
    }
    if (index === 2) {
      assert.match(svg, /УСЛОВНЫЙ БАЛАНС/);
      assert.match(svg, /\$1 000/);
      assert.match(svg, /USDT/);
      assert.match(svg, /ИЗМЕНЕНИЕ ЦЕНЫ/);
      const finalFrame = renderFinancialTopicPreviewFrame(
        plan,
        durationMs,
        Math.round((mainBeats[index]!.from + (mainBeats[index]!.to - mainBeats[index]!.from) * 0.95) * durationMs),
        sceneStartsMs,
      );
      assert.match(finalFrame, /1\s235 USDT/);
      assert.match(svg, /\+\$235/);
      assert.match(svg, /ДОХОД/);
      assert.match(svg, /market-focus-profit-glow/);

      const overshootFrame = renderFinancialTopicPreviewFrame(
        plan,
        durationMs,
        Math.round((mainBeats[index]!.from + (mainBeats[index]!.to - mainBeats[index]!.from) * 0.38) * durationMs),
        sceneStartsMs,
      );
      assert.match(overshootFrame, /scale\(1\.180\)/);

      const lossPlan = {
        ...plan,
        marketFocusData: { ...data, changePercent24h: -12.5 },
      } as unknown as FinancialShortRenderPlan;
      const lossFrame = renderFinancialTopicPreviewFrame(lossPlan, durationMs, timeMs, sceneStartsMs);
      assert.doesNotMatch(lossFrame, /\+\$235|ДОХОД/);
      assert.match(lossFrame, /−125 USDT/);

      const fractionalPlan = {
        ...plan,
        marketFocusData: { ...data, changePercent24h: 23.45678 },
      } as unknown as FinancialShortRenderPlan;
      const fractionalFrame = renderFinancialTopicPreviewFrame(fractionalPlan, durationMs, timeMs, sceneStartsMs);
      assert.match(fractionalFrame, /\+\$234,5678/);
      assert.doesNotMatch(fractionalFrame, /\$234,\d{5,}|USDT[^<]*,\d{5,}/);
      const fractionalFinalFrame = renderFinancialTopicPreviewFrame(
        fractionalPlan,
        durationMs,
        Math.round((mainBeats[index]!.from + (mainBeats[index]!.to - mainBeats[index]!.from) * 0.95) * durationMs),
        sceneStartsMs,
      );
      assert.match(fractionalFinalFrame, /1\s234,5678 USDT/);
    }
    frames.push(svg);
  }

  const tempDir = await mkdtemp(join(tmpdir(), "market-focus-render-"));
  try {
    await Promise.all(frames.map((svg, index) => (
      writeFile(join(tempDir, `scene-${String(index).padStart(2, "0")}.svg`), svg)
    )));
    const outputPath = join(tempDir, "preview.mp4");
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-framerate", "1",
      "-start_number", "0",
      "-i", join(tempDir, "scene-%02d.svg"),
      "-frames:v", String(frames.length),
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      outputPath,
    ], { timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });
    const probe = await execFileAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height",
      "-of", "json",
      outputPath,
    ]);
    const stream = (JSON.parse(probe.stdout) as {
      streams?: Array<{ width?: number; height?: number }>;
    }).streams?.[0];
    assert.equal(stream?.width, 1080);
    assert.equal(stream?.height, 1920);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("market music graph uses the shared bed and gives technical analysis a slight boost", async () => {
  const focusGraph = buildMarketDataAudioFilterGraph({
    audioInputIndex: 0,
    musicInputIndex: 1,
    durationMs: 2_000,
    theme: "market_focus_24h",
  });
  const overviewGraph = buildMarketDataAudioFilterGraph({
    audioInputIndex: 0,
    musicInputIndex: 1,
    durationMs: 2_000,
    theme: "coin_overview",
  });
  const technicalAnalysisGraph = buildMarketDataAudioFilterGraph({
    audioInputIndex: 0,
    musicInputIndex: 1,
    durationMs: 2_000,
    theme: "technical_analysis",
  });
  assert.equal(focusGraph.outputLabel, "market-focus-base");
  assert.match(focusGraph.filterChains.at(-1)!, /\[market-focus-base\]$/);
  assert.match(focusGraph.filterChains[1]!, /volume=0\.1,atrim=duration=2\.000,afade=t=in:st=0:d=0\.700/);
  assert.equal(overviewGraph.outputLabel, "coin-overview-base");
  assert.match(overviewGraph.filterChains.at(-1)!, /\[coin-overview-base\]$/);
  assert.match(overviewGraph.filterChains[1]!, /volume=0\.1,atrim=duration=2\.000,afade=t=in:st=0:d=0\.700/);
  assert.equal(technicalAnalysisGraph.outputLabel, "technical-analysis-base");
  assert.match(technicalAnalysisGraph.filterChains.at(-1)!, /\[technical-analysis-base\]$/);
  assert.match(technicalAnalysisGraph.filterChains[1]!, /volume=0\.12,atrim=duration=2\.000,afade=t=in:st=0:d=0\.700/);

  const tempDir = await mkdtemp(join(tmpdir(), "market-focus-audio-"));
  try {
    const outputPath = join(tempDir, "audio-smoke-test.m4a");
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-f", "lavfi",
      "-i", "sine=frequency=440:duration=2",
      "-stream_loop", "-1",
      "-i", FINANCIAL_MUSIC_BED_PATH,
      "-filter_complex", technicalAnalysisGraph.filterChains.join(";"),
      "-map", `[${technicalAnalysisGraph.outputLabel}]`,
      "-t", "2",
      "-c:a", "aac",
      "-b:a", "96k",
      outputPath,
    ], { timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });
    const probe = await execFileAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=codec_type",
      "-of", "json",
      outputPath,
    ], { timeout: 30_000, maxBuffer: 1 * 1024 * 1024 });
    assert.match(probe.stdout, /"codec_type": "audio"/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("market focus shows the full-screen Bybit banner only during the final CTA beat", async () => {
  const data = await resolveMarketFocusMarketData("QNT", {
    fetcher: makeFetcher(),
    now: () => FIXED_NOW,
  });
  const cta = buildMarketFocusCta();
  const plan = {
    mainTitle: "QNT • 24 ЧАСА",
    background: "grid",
    visualTheme: "market_focus_24h",
    marketFocusData: data,
    beats: [
      {
        id: "market",
        from: 0,
        to: 0.5,
        visual: "market",
        title: "ДВИЖЕНИЕ ЗА 24 ЧАСА",
        subtitle: "Данные рынка за сутки.",
        voiceText: "Краткий обзор движения монеты.",
        soundEffect: "cash_register",
      },
      {
        id: "cta",
        from: 0.5,
        to: 1,
        visual: "risk",
        title: "CTA",
        subtitle: cta,
        voiceText: cta,
        isCta: true,
      },
    ],
  } as unknown as FinancialShortRenderPlan;
  const tempDir = await mkdtemp(join(tmpdir(), "market-focus-bybit-banner-"));
  try {
    const audioPath = join(tempDir, "voice.m4a");
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-f", "lavfi",
      "-i", "sine=frequency=440:duration=2",
      "-c:a", "aac",
      "-b:a", "96k",
      audioPath,
    ], { timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });
    const rendered = await renderFinancialTopicShortWithAudioTrack(plan, audioPath, [1_000]);
    const outputPath = join(tempDir, "banner-preview.mp4");
    await writeFile(outputPath, rendered.buffer);

    const sampleLuma = async (timeSeconds: number): Promise<number> => {
      const sample = await execFileAsync("ffmpeg", [
        "-hide_banner",
        "-loglevel", "error",
        "-i", outputPath,
        "-ss", String(timeSeconds),
        "-frames:v", "1",
        "-vf", "crop=220:250:800:1640,format=gray",
        "-f", "rawvideo",
        "pipe:1",
      ], {
        timeout: 30_000,
        maxBuffer: 2 * 1024 * 1024,
        encoding: "buffer",
      });
      const pixels = Buffer.from(sample.stdout);
      assert.equal(pixels.length, 220 * 250);
      return pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
    };
    const beforeCtaLuma = await sampleLuma(0.5);
    const duringCtaLuma = await sampleLuma(1.5);
    assert.ok(
      duringCtaLuma > beforeCtaLuma + 35,
      `expected the bright Bybit banner crop to appear during CTA (before ${beforeCtaLuma.toFixed(1)}, during ${duringCtaLuma.toFixed(1)})`,
    );

    const probe = await execFileAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height",
      "-of", "json",
      outputPath,
    ]);
    const stream = (JSON.parse(probe.stdout) as {
      streams?: Array<{ width?: number; height?: number }>;
    }).streams?.[0];
    assert.equal(stream?.width, 1080);
    assert.equal(stream?.height, 1920);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});