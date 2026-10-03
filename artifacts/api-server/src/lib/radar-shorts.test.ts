import assert from "node:assert/strict";
import { test } from "node:test";
import { radarShortsPeriodKeyboard, applyRadarShortsYoutubeSeo } from "./radar-shorts";
import {
  renderRadarShortsFrame,
  renderRadarShortsSubtitleFrame,
  type RadarShortsBeat,
} from "./radar-shorts-renderer";
import {
  buildMarketDataAudioFilterGraph,
  buildRadarShortsPlaybackFilterGraph,
  renderFinancialTopicPreviewFrame,
  type FinancialShortRenderPlan,
} from "./financial-short-renderer";
import type { CoinOverviewMarketData } from "./coin-overview-data";
import type { MarketFocusMarketData } from "./coin-market-focus-data";
import type { YoutubeMetadata } from "./youtube-metadata-fallback";

const BASE_METADATA: YoutubeMetadata = {
  title: "Рост SOL на 12% за 24 часа: что произошло?",
  description: "Разбираем рыночные данные по SOL и текущую динамику крипторынка.\n\n#shorts #криптовалюта #sol",
  tags: ["криптовалюта", "SOL", "рыночный обзор", "факты"],
  hashtags: ["#shorts", "#криптовалюта", "#sol"],
};

const MARKET_FOCUS_DATA = {
  coin: {
    name: "Solana",
    symbol: "SOL",
    pair: "SOLUSDT",
    sourceUrl: "https://example.test/sol",
    logoDataUri: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz4=",
  },
  currency: "USDT",
  periodStartUtc: "2026-10-02T00:00:00.000Z",
  periodEndUtc: "2026-10-03T00:00:00.000Z",
  periodKind: "closed_hourly",
  hourlyCandles: [
    { openTime: 1, closeTime: 2, open: 100, high: 104, low: 98, close: 102, quoteVolume: 1_000 },
    { openTime: 2, closeTime: 3, open: 102, high: 106, low: 101, close: 105, quoteVolume: 1_200 },
    { openTime: 3, closeTime: 4, open: 105, high: 108, low: 103, close: 104, quoteVolume: 900 },
    { openTime: 4, closeTime: 5, open: 104, high: 110, low: 102, close: 109, quoteVolume: 1_400 },
  ],
  periodCandles: [
    { openTime: 1, closeTime: 2, open: 100, high: 104, low: 98, close: 102, quoteVolume: 1_000 },
    { openTime: 2, closeTime: 3, open: 102, high: 106, low: 101, close: 105, quoteVolume: 1_200 },
    { openTime: 3, closeTime: 4, open: 105, high: 108, low: 103, close: 104, quoteVolume: 900 },
    { openTime: 4, closeTime: 5, open: 104, high: 110, low: 102, close: 109, quoteVolume: 1_400 },
  ],
  periodChangePercent: 9,
  periodHighPrice: 110,
  periodLowPrice: 98,
  periodQuoteVolume: 4_500,
  periodAverageDailyQuoteVolume: 3_200,
  periodVolumeVsAverage: 1.4,
  periodBenchmarks: [
    { symbol: "BTC", changePercent: 2 },
    { symbol: "ETH", changePercent: -1 },
  ],
  dailyQuoteVolumes: [],
  currentPrice: 109,
  changePercent24h: 9,
  highPrice24h: 110,
  lowPrice24h: 98,
  drawdownFromHighPercent: 0.9,
  quoteVolume24h: 4_500,
  averageDailyQuoteVolume7d: 3_200,
  volumeVs7dAverage: 1.4,
  benchmarks: [
    { symbol: "BTC", changePercent24h: 2 },
    { symbol: "ETH", changePercent24h: -1 },
  ],
  news: null,
  retrievedAt: "2026-10-03T12:00:00.000Z",
} as unknown as MarketFocusMarketData;

const COIN_OVERVIEW_DATA = {
  coin: {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    marketCapRank: 5,
    sourceUrl: "https://example.test/sol",
  },
  sourceLabel: "CoinGecko",
  currency: "USD",
  periodDays: 7,
  currentPriceUsd: 109,
  periodStartPriceUsd: 100,
  changePercent7d: 9,
  lowPriceUsd7d: 96,
  highPriceUsd7d: 112,
  priceSamples: Array.from({ length: 7 }, (_, index) => ({
    timestamp: Date.UTC(2026, 8, 27 + index),
    label: `День ${index + 1}`,
    priceUsd: 100 + index * 1.5,
  })),
  activity: {
    kind: "trading_volume",
    valueUsd: 1_500_000_000,
    sourceLabel: "CoinGecko",
    sourceUrl: "https://example.test/volume",
  },
  benchmarks: [
    { symbol: "BTC", changePercent7d: 2 },
    { symbol: "ETH", changePercent7d: -1 },
  ],
  marketCapUsd: null,
  dataAsOf: "2026-10-03T12:00:00.000Z",
  retrievedAt: "2026-10-03T12:00:00.000Z",
} as unknown as CoinOverviewMarketData;

function beat(id: string, title: string, subtitle = "SOL · выбранный период"): RadarShortsBeat {
  return { id, from: 0, to: 1, title, subtitle };
}

test("Radar Shorts period menu routes directly to each top-10 ranking", () => {
  const keyboard = radarShortsPeriodKeyboard();
  assert.deepEqual(
    keyboard.inline_keyboard.slice(0, 3).map((row) => row[0]?.callback_data),
    [
      "crypto:radar_shorts:24h",
      "crypto:radar_shorts:7d",
      "crypto:radar_shorts:30d",
    ],
  );
  assert.match(keyboard.inline_keyboard[0]?.[0]?.text ?? "", /24 часа.*топ-10/u);
  assert.match(keyboard.inline_keyboard[1]?.[0]?.text ?? "", /7 дней.*топ-10/u);
  assert.match(keyboard.inline_keyboard[2]?.[0]?.text ?? "", /30 дней.*топ-10/u);
});

test("Radar Shorts metadata includes the coin, selected period, verified movement, and crypto SEO", () => {
  const metadata = applyRadarShortsYoutubeSeo(BASE_METADATA, {
    coinName: "Solana",
    symbol: "SOL",
    periodLabel: "24 часа",
    changePercent: 12.345,
  });

  assert.match(metadata.description, /Solana \(SOL\).*24 часа: рост на 12,35%/u);
  assert.ok(metadata.tags.includes("криптовалюта"));
  assert.ok(metadata.tags.includes("крипторынок"));
  assert.ok(metadata.tags.includes("Solana"));
  assert.ok(metadata.tags.includes("SOL 24 часа"));
  assert.deepEqual(metadata.hashtags, ["#shorts", "#криптовалюта", "#sol"]);
  assert.match(metadata.description, /@viberolebot.*#viberolebot.*#вайббот/su);
});

test("Radar Shorts SEO preserves falling-period facts and caps tags at YouTube limits", () => {
  const metadata = applyRadarShortsYoutubeSeo({
    ...BASE_METADATA,
    tags: Array.from({ length: 30 }, (_, index) => `дополнительный тег ${index}`),
  }, {
    coinName: "Bitcoin",
    symbol: "BTC",
    periodLabel: "7 дней",
    changePercent: -4.2,
  });

  assert.match(metadata.description, /Bitcoin \(BTC\).*7 дней: снижение на 4,2%/u);
  assert.ok(metadata.tags.length <= 30);
  assert.ok(metadata.tags.length > 10);
  assert.ok(metadata.tags.includes("Bitcoin"));
  assert.ok(Buffer.byteLength(metadata.tags.join(","), "utf8") <= 500);
});

test("Radar Shorts renders selected-period candles with live coin facts and the approved playback label", () => {
  const scene = beat("candles", "ДИАПАЗОН И ОТКАТ");
  const frame = renderRadarShortsFrame({
    timeMs: 900,
    durationMs: 1_000,
    beats: [scene],
    beat: scene,
    beatIndex: 0,
    market: { kind: "market_focus", data: MARKET_FOCUS_DATA },
  });

  assert.match(frame, /MARKET \/ LIVE RADAR • 24 ЧАСА/u);
  assert.match(frame, /SOLUSDT/u);
  assert.match(frame, /4 ЧАСОВЫЕ СВЕЧИ/u);
  assert.match(frame, /BINANCE SPOT/u);
  assert.match(frame, /PLAYBACK 1\.25×/u);
  assert.match(frame, /\+9,0%/u);
});

test("Radar Shorts uses the selected 30-day snapshot and renders daily candles", () => {
  const periodCandles = Array.from({ length: 30 }, (_, index) => {
    const open = 100 - index * (12.5 / 30);
    const close = 100 - (index + 1) * (12.5 / 30);
    return {
      openTime: Date.UTC(2026, 8, 3 + index),
      closeTime: Date.UTC(2026, 8, 4 + index),
      open,
      high: open + 0.75,
      low: close - 0.75,
      close,
      quoteVolume: 2_000 + index * 10,
    };
  });
  const monthlyMarket = {
    ...MARKET_FOCUS_DATA,
    periodStartUtc: "2026-09-03T00:00:00.000Z",
    periodEndUtc: "2026-10-03T00:00:00.000Z",
    periodKind: "rolling_30d",
    periodCandles,
    periodChangePercent: -12.5,
    periodHighPrice: 100.75,
    periodLowPrice: 86.75,
    currentPrice: 87.5,
  } as MarketFocusMarketData;
  const scene = beat("candles", "ДИАПАЗОН ЗА 30 ДНЕЙ");
  const frame = renderRadarShortsFrame({
    timeMs: 900,
    durationMs: 1_000,
    beats: [scene],
    beat: scene,
    beatIndex: 0,
    market: { kind: "market_focus", data: monthlyMarket },
  });

  assert.match(frame, /LIVE RADAR • 30 ДНЕЙ/u);
  assert.match(frame, /30 ДНЕВНЫХ СВЕЧЕЙ/u);
  assert.match(frame, /−12,5%/u);
  assert.doesNotMatch(frame, /ЧАСОВЫЕ СВЕЧИ/u);
});

test("Radar Shorts uses seven real price samples and never invents seven-day candles", () => {
  const scene = beat("price_history", "ЦЕНА ЗА 7 ДНЕЙ");
  const frame = renderRadarShortsFrame({
    timeMs: 700,
    durationMs: 1_000,
    beats: [scene],
    beat: scene,
    beatIndex: 0,
    market: { kind: "coin_overview", data: COIN_OVERVIEW_DATA },
  });

  assert.match(frame, /7 РАВНОМЕРНЫХ СНИМКА/u);
  assert.match(frame, /COINGECKO/u);
  assert.match(frame, /SOL\/USD/u);
  assert.doesNotMatch(frame, /ДНЕВНЫХ СВЕЧЕЙ/u);
});

test("Radar Shorts hypothetical card uses the selected coin's loss calculation", () => {
  const scene = beat("hypothetical", "УСЛОВНЫЕ $1 000");
  const fallingMarket = {
    ...MARKET_FOCUS_DATA,
    periodChangePercent: -12.5,
    currentPrice: 87.5,
  } as MarketFocusMarketData;
  const frame = renderRadarShortsFrame({
    timeMs: 1_000,
    durationMs: 1_000,
    beats: [scene],
    beat: scene,
    beatIndex: 0,
    market: { kind: "market_focus", data: fallingMarket },
  });

  assert.match(frame, /−\$125/u);
  assert.match(frame, /\$875/u);
  assert.match(frame, /УСЛОВНЫЕ/u);
});

test("Radar Shorts subtitle shows the active scene caption", () => {
  const scene = beat("activity", "ОБОРОТ", "Оборот выбранной монеты по Binance Spot");
  const frame = renderRadarShortsSubtitleFrame(scene, 0.8);
  assert.match(frame, /Оборот выбранной монеты по Binance Spot/u);
  assert.match(frame, /#D8FF3F/u);
});

test("Radar rendering is isolated behind its saved marker and leaves the original market renderer intact", () => {
  const scene = beat("identity", "SOL В ФОКУСЕ");
  const radarPlan = {
    title: "SOL Radar",
    mainTitle: "SOL",
    script: scene.subtitle,
    beats: [scene],
    visualTheme: "coin_overview",
    coinOverviewData: COIN_OVERVIEW_DATA,
    radarShorts: true,
  } as unknown as FinancialShortRenderPlan;
  const originalPlan = {
    title: "SOL market focus",
    mainTitle: "SOL",
    script: scene.subtitle,
    beats: [scene],
    visualTheme: "market_focus_24h",
    marketFocusData: MARKET_FOCUS_DATA,
  } as unknown as FinancialShortRenderPlan;

  const radarFrame = renderFinancialTopicPreviewFrame(radarPlan, 1_000, 500, []);
  const originalFrame = renderFinancialTopicPreviewFrame(originalPlan, 1_000, 500, []);

  assert.match(radarFrame, /MARKET \/ LIVE RADAR/u);
  assert.match(originalFrame, /МОНЕТА В ФОКУСЕ/u);
  assert.doesNotMatch(originalFrame, /LIVE RADAR/u);
});

test("Radar uses its approved music level and pitch-preserving 1.25x playback without changing the base format", () => {
  const radarMusic = buildMarketDataAudioFilterGraph({
    audioInputIndex: 2,
    musicInputIndex: 3,
    durationMs: 12_500,
    theme: "market_focus_24h",
    radarShorts: true,
  });
  const originalMusic = buildMarketDataAudioFilterGraph({
    audioInputIndex: 2,
    musicInputIndex: 3,
    durationMs: 12_500,
    theme: "market_focus_24h",
  });
  const playback = buildRadarShortsPlaybackFilterGraph({
    videoInputLabel: "video",
    audioInputLabel: "radar-shorts-base",
    durationMs: 12_500,
  });

  assert.equal(radarMusic.outputLabel, "radar-shorts-base");
  assert.match(radarMusic.filterChains.join(";"), /volume=0\.1,/u);
  assert.equal(originalMusic.outputLabel, "market-focus-base");
  assert.equal(playback.durationMs, 10_000);
  assert.match(playback.filterChains[0] ?? "", /setpts=PTS\/1\.25/u);
  assert.match(playback.filterChains[1] ?? "", /atempo=1\.25/u);
});

test("Radar CTA uses the saved user phrase and does not add an unconfigured link claim", () => {
  const scene: RadarShortsBeat = {
    ...beat("financial-cta", "ССЫЛКА НА БИРЖУ"),
    isCta: true,
    voiceText: "Откройте данные SOL и проверьте условия самостоятельно.",
  };
  const frame = renderRadarShortsFrame({
    timeMs: 900,
    durationMs: 1_000,
    beats: [scene],
    beat: scene,
    beatIndex: 0,
    market: { kind: "market_focus", data: MARKET_FOCUS_DATA },
  });

  assert.match(frame, /Откройте данные SOL и проверьте условия/u);
  assert.match(frame, /самостоятельно\./u);
  assert.doesNotMatch(frame, /ССЫЛКА В ОПИСАНИИ/u);
});