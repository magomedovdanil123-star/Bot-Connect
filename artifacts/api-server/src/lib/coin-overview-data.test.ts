import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import {
  renderFinancialTopicPreviewFrame,
  renderFinancialTopicShortWithAudioTrack,
  type FinancialShortBeat,
  type FinancialShortRenderPlan,
} from "./financial-short-renderer";
import {
  buildCoinLeaders7dStory,
  buildCoinOverviewStory,
  clearCoinOverviewMarketDataCacheForTests,
  COIN_LEADERS_7D_SCENE_DURATIONS_SECONDS,
  COIN_OVERVIEW_SCENE_DURATIONS_SECONDS,
  CRYPTO_MARKET_7D_CTA,
  refreshCoinLeaders7dNarration,
  resolveCoinLeaders7dMarketData,
  resolveCoinOverviewMarketData,
} from "./coin-overview-data";

const DAY_MS = 24 * 60 * 60 * 1_000;
const execFileAsync = promisify(execFile);

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function marketRows() {
  return [
    {
      id: "hyperliquid",
      name: "Hyperliquid",
      symbol: "hype",
      current_price: 100,
      market_cap: 1_000_000_000,
      total_volume: 50_000_000,
      price_change_percentage_7d_in_currency: 100,
      last_updated: new Date().toISOString(),
    },
    {
      id: "bitcoin",
      name: "Bitcoin",
      symbol: "btc",
      current_price: 60_000,
      market_cap: 1_000_000_000_000,
      total_volume: 20_000_000_000,
      price_change_percentage_7d_in_currency: 9.09,
      last_updated: new Date().toISOString(),
    },
    {
      id: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      current_price: 3_000,
      market_cap: 400_000_000_000,
      total_volume: 10_000_000_000,
      price_change_percentage_7d_in_currency: 15.38,
      last_updated: new Date().toISOString(),
    },
  ];
}

function chartValues(id: string): number[] {
  if (id === "bitcoin") return [55_000, 56_000, 57_000, 58_000, 59_000, 58_000, 59_000, 60_000];
  if (id === "ethereum") return [2_600, 2_650, 2_700, 2_750, 2_800, 2_850, 2_900, 3_000];
  return [50, 55, 54, 70, 68, 82, 92, 100];
}

function mockFetch(options: {
  searchCoins?: Array<Record<string, unknown>>;
  hyperliquidSymbol?: string;
  historyDays?: number;
} = {}): typeof fetch {
  return async (input, init) => {
    const url = input instanceof Request
      ? input.url
      : input instanceof URL ? input.href : input;

    if (url.includes("/search?")) {
      return jsonResponse({
        coins: options.searchCoins ?? [{
          id: "hyperliquid",
          name: "Hyperliquid",
          symbol: "hype",
          market_cap_rank: 30,
        }],
      });
    }
    if (url.includes("/coins/markets?")) return jsonResponse(marketRows());
    if (url.includes("/market_chart?")) {
      const id = decodeURIComponent(url.split("/coins/")[1]!.split("/")[0]!);
      const values = chartValues(id);
      const span = (options.historyDays ?? 7) * DAY_MS;
      const start = Date.now() - span;
      const points = values.map((price, index) => [
        start + (span * index) / (values.length - 1),
        price,
      ]);
      return jsonResponse({ prices: points });
    }
    if (url === "https://api.hyperliquid.xyz/info" && init?.method === "POST") {
      const symbol = options.hyperliquidSymbol ?? "HYPE";
      return jsonResponse([
        { universe: [{ name: symbol }] },
        [{ openInterest: "12", markPx: "100" }],
      ]);
    }
    throw new Error(`Unexpected mock request: ${url}`);
  };
}

function marketLeadersMockFetch(state?: { apiKeys: string[] }): typeof fetch {
  const markets = [
    {
      id: 9_001,
      slug: "weekly-winner",
      name: "Weekly Winner",
      symbol: "win",
      cmc_rank: 1,
      quote: { USD: {
        price: 140,
        market_cap: 8_000_000_000,
        volume_24h: 90_000_000,
        percent_change_7d: 40,
        last_updated: new Date().toISOString(),
      } },
    },
    {
      id: 9_002,
      slug: "weekly-loser",
      name: "Weekly Loser",
      symbol: "loss",
      cmc_rank: 2,
      quote: { USD: {
        price: 72,
        market_cap: 4_000_000_000,
        volume_24h: 30_000_000,
        percent_change_7d: -22,
        last_updated: new Date().toISOString(),
      } },
    },
    {
      id: 9_003,
      slug: "usd-coin",
      name: "USD Coin",
      symbol: "usdc",
      cmc_rank: 3,
      quote: { USD: {
        price: 1,
        market_cap: 50_000_000_000,
        volume_24h: 20_000_000,
        percent_change_7d: 0.1,
        last_updated: new Date().toISOString(),
      } },
    },
    {
      id: 9_004,
      slug: "illiquid-winner",
      name: "Illiquid Winner",
      symbol: "thin",
      cmc_rank: 4,
      quote: { USD: {
        price: 4,
        market_cap: 500_000_000,
        volume_24h: 2_000_000,
        percent_change_7d: 500,
        last_updated: new Date().toISOString(),
      } },
    },
  ];
  const charts: Record<string, number[]> = {
    "9001": [100, 103, 101, 99, 97, 100, 104, 110, 108, 105, 102, 106, 111, 117, 120, 118, 116, 119, 124, 131, 129, 126, 132, 138, 140],
    "9002": [140, 136, 132, 130, 125, 128, 124, 120, 116, 118, 112, 108, 110, 105, 100, 102, 96, 92, 95, 89, 84, 86, 80, 76, 72],
  };
  return async (input, init) => {
    const url = input instanceof Request
      ? input.url
      : input instanceof URL ? input.href : input;
    const parsedUrl = new URL(url);
    state?.apiKeys.push(new Headers(init?.headers).get("X-CMC_PRO_API_KEY") ?? "");
    if (parsedUrl.pathname.endsWith("/cryptocurrency/listings/latest")) {
      return jsonResponse({ status: { timestamp: new Date().toISOString() }, data: markets });
    }
    if (parsedUrl.pathname.endsWith("/cryptocurrency/ohlcv/historical")) {
      const id = parsedUrl.searchParams.get("id") ?? "";
      const values = charts[id];
      if (!values) throw new Error(`Unexpected market chart request for ${id}`);
      const start = Date.now() - 7 * DAY_MS;
      return jsonResponse({
        data: {
          id: Number(id),
          quotes: values.map((price, index) => {
            const timestamp = start + (7 * DAY_MS * index) / (values.length - 1);
            return {
              time_open: new Date(timestamp).toISOString(),
              quote: {
                USD: {
                  close: price,
                  high: price * 1.01,
                  low: price * 0.99,
                  timestamp: new Date(timestamp).toISOString(),
                },
              },
            };
          }),
        },
      });
    }
    throw new Error(`Unexpected market leaders request: ${url}`);
  };
}

function marketLeadersSequentialChartsMockFetch(options: {
  chartIds: string[];
  maximumConcurrentCharts: number;
  apiKeys: string[];
}): typeof fetch {
  const baseFetcher = marketLeadersMockFetch(options);
  let activeCharts = 0;

  return async (input, init) => {
    const url = input instanceof Request
      ? input.url
      : input instanceof URL ? input.href : input;
    if (!url.includes("/cryptocurrency/ohlcv/historical?")) return baseFetcher(input, init);

    const id = new URL(url).searchParams.get("id") ?? "";
    options.chartIds.push(id);
    activeCharts += 1;
    options.maximumConcurrentCharts = Math.max(options.maximumConcurrentCharts, activeCharts);
    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return await baseFetcher(input, init);
    } finally {
      activeCharts -= 1;
    }
  };
}

test("builds six HYPE scenes from seven-day data and labels venue-specific open interest", async () => {
  clearCoinOverviewMarketDataCacheForTests();
  const data = await resolveCoinOverviewMarketData("HYPE", mockFetch());
  const scenes = buildCoinOverviewStory(data);

  assert.equal(data.coin.id, "hyperliquid");
  assert.equal(data.priceSamples.length, 7);
  assert.equal(data.changePercent7d, 100);
  assert.equal(data.activity.kind, "open_interest");
  assert.equal(data.activity.valueUsd, 1_200);
  assert.equal(data.activity.sourceLabel, "Hyperliquid");
  assert.equal(scenes.length, 6);
  assert.match(scenes[0]!.voiceText, /Привет, друзья!/);
  assert.match(scenes[0]!.voiceText, /посчитаем, что стало бы с условными \$100/);
  assert.match(scenes[0]!.voiceText, /путь цены/i);
  assert.match(scenes[1]!.voiceText, /полной картиной/i);
  assert.match(scenes[3]!.voiceText, /рыночный фон/i);
  assert.match(scenes[4]!.voiceText, /не прогноз и не обещание результата/i);
  assert.match(scenes[2]!.voiceText, /одной биржи/i);
  assert.match(scenes[5]!.voiceText, /CoinGecko.*Hyperliquid/);
  assert.ok(
    Math.abs(COIN_OVERVIEW_SCENE_DURATIONS_SECONDS.reduce((sum, seconds) => sum + seconds, 0) - 51.2) < 1e-9,
  );
});

test("uses CoinGecko 24-hour volume when the coin has no Hyperliquid listing", async () => {
  clearCoinOverviewMarketDataCacheForTests();
  const data = await resolveCoinOverviewMarketData(
    "HYPE",
    mockFetch({ hyperliquidSymbol: "OTHER" }),
  );

  assert.equal(data.activity.kind, "trading_volume");
  assert.equal(data.activity.valueUsd, 50_000_000);
  assert.equal(data.activity.sourceLabel, "CoinGecko");
  assert.match(buildCoinOverviewStory(data)[2]!.voiceText, /Оборот за сутки по CoinGecko/);
});

test("asks for a more precise name when a ticker is ambiguous", async () => {
  const fetcher = mockFetch({
    searchCoins: [
      { id: "one", name: "Coin One", symbol: "amb", market_cap_rank: 101 },
      { id: "two", name: "Coin Two", symbol: "amb", market_cap_rank: 150 },
    ],
  });

  await assert.rejects(
    resolveCoinOverviewMarketData("AMB", fetcher),
    /неоднозначен/,
  );
});

test("rejects a coin without a full seven-day price history", async () => {
  await assert.rejects(
    resolveCoinOverviewMarketData("HYPE", mockFetch({ historyDays: 3 })),
    /полной семидневной истории/,
  );
});

test("ranks liquid non-stablecoin leaders, shows technical observation zones, and stays under two minutes", async () => {
  assert.equal(
    CRYPTO_MARKET_7D_CTA,
    "Все эти движения можно отслеживать самостоятельно. Ссылка на биржу — в описании и шапке профиля.",
  );
  const data = await resolveCoinLeaders7dMarketData(
    marketLeadersMockFetch(),
    { apiKey: "test-cmc-api-key" },
  );
  const story = buildCoinLeaders7dStory(data);
  assert.equal(data.screenedCoinCount, 2);
  assert.equal(data.sourceLabel, "CoinMarketCap");
  assert.equal(data.leaders.gainer.coin.id, "9001");
  assert.equal(data.leaders.decliner.coin.id, "9002");
  assert.equal(data.leaders.gainer.changePercent7d, 40);
  assert.equal(data.leaders.decliner.changePercent7d, -22);
  assert.ok(data.leaders.gainer.entryZone.lowUsd < data.leaders.gainer.entryZone.highUsd);
  assert.ok(data.leaders.decliner.entryZone.lowUsd < data.leaders.decliner.entryZone.highUsd);
  assert.equal(story.length, 6);
  assert.match(story[0]!.voiceText, /Привет, друзья!/);
  assert.match(story[0]!.voiceText, /Кто за неделю вырос сильнее всех, а кто упал\?/);
  assert.match(story[0]!.voiceText, /CoinMarketCap/);
  assert.match(story[0]!.voiceText, /без лишнего шума/i);
  assert.match(story[1]!.voiceText, /лидера роста/i);
  assert.match(story[2]!.voiceText, /рост сам по себе не обещает продолжения/i);
  assert.match(story[4]!.voiceText, /тот же принцип осторожности/i);
  assert.match(story[5]!.voiceText, /не становится прогнозом/i);
  assert.match(story[2]!.voiceText, /зон[ау] наблюдения/i);
  assert.match(story[5]!.voiceText, /не инвестиционная рекомендация/i);
  assert.equal(COIN_LEADERS_7D_SCENE_DURATIONS_SECONDS.reduce((sum, seconds) => sum + seconds, 0), 100);
  assert.ok(COIN_LEADERS_7D_SCENE_DURATIONS_SECONDS.reduce((sum, seconds) => sum + seconds, 0) <= 120);
  const narrationWordCount = story
    .map((scene) => scene.voiceText.trim().split(/\s+/u).length)
    .reduce((sum, count) => sum + count, 0);
  assert.ok(narrationWordCount <= 220, `Expected detailed but bounded narration, got ${narrationWordCount} words`);

  const durationMs = 100_000;
  const beats = story.map((scene, index) => ({
    from: index / story.length,
    to: (index + 1) / story.length,
    title: scene.title,
    subtitle: scene.subtitle,
    visual: "market",
    background: "grid",
  } as unknown as FinancialShortBeat));
  const plan = {
    mainTitle: "ЛИДЕРЫ РЫНКА • 7 ДНЕЙ",
    background: "grid",
    visualTheme: "market_leaders_7d",
    marketLeaders7dData: data,
    beats,
  } as unknown as FinancialShortRenderPlan;
  const sceneStartsMs = beats.slice(1).map((beat) => Math.round(beat.from * durationMs));
  const frames = story.map((scene, index) => {
    const timeMs = Math.round(((beats[index]!.from + beats[index]!.to) / 2) * durationMs);
    const svg = renderFinancialTopicPreviewFrame(plan, durationMs, timeMs, sceneStartsMs);
    assert.match(svg, /viewBox="0 0 1080 1920"/);
    assert.ok(svg.includes(scene.title));
    assert.match(svg, /COINMARKETCAP/);
    assert.doesNotMatch(svg, /COINGECKO/);
    return svg;
  });

  const tempDir = await mkdtemp(join(tmpdir(), "coin-leaders-7d-render-"));
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
    ], { timeout: 30_000, maxBuffer: 1 * 1024 * 1024 });
    assert.match(probe.stdout, /"width": 1080/);
    assert.match(probe.stdout, /"height": 1920/);

    const audioPath = join(tempDir, "voice.wav");
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-f", "lavfi",
      "-i", "sine=frequency=440:duration=4",
      audioPath,
    ], { timeout: 30_000, maxBuffer: 1 * 1024 * 1024 });
    const rendered = await renderFinancialTopicShortWithAudioTrack(
      plan,
      audioPath,
      beats.slice(1).map((beat) => Math.round(beat.from * 4_000)),
    );
    const renderedPath = join(tempDir, "market-leaders-with-audio.mp4");
    await writeFile(renderedPath, rendered.buffer);
    const renderedProbe = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "stream=codec_type,width,height",
      "-of", "json",
      renderedPath,
    ], { timeout: 30_000, maxBuffer: 1 * 1024 * 1024 });
    assert.match(renderedProbe.stdout, /"codec_type": "video"/);
    assert.match(renderedProbe.stdout, /"codec_type": "audio"/);
    assert.match(renderedProbe.stdout, /"width": 1080/);
    assert.match(renderedProbe.stdout, /"height": 1920/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("refreshes saved market-leaders narration without changing its visual plan", async () => {
  const data = await resolveCoinLeaders7dMarketData(
    marketLeadersMockFetch(),
    { apiKey: "test-cmc-api-key" },
  );
  const storedPlan = {
    script: "Older overlong narration",
    title: "Saved title",
    beats: buildCoinLeaders7dStory(data).map((scene) => ({
      title: scene.title,
      voiceText: `Old narration for ${scene.title}`,
      visualAction: scene.visualAction,
    })),
    marketLeaders7dData: data,
  };

  const refreshedPlan = refreshCoinLeaders7dNarration(storedPlan);

  assert.notEqual(refreshedPlan.script, storedPlan.script);
  assert.equal(refreshedPlan.title, storedPlan.title);
  assert.equal(refreshedPlan.beats[0]!.title, storedPlan.beats[0]!.title);
  assert.equal(refreshedPlan.beats[0]!.visualAction, storedPlan.beats[0]!.visualAction);
  assert.deepEqual(
    refreshedPlan.beats.map((beat) => beat.voiceText),
    buildCoinLeaders7dStory(data).map((scene) => scene.voiceText),
  );
});

test("sends the CoinMarketCap key and fetches leader charts sequentially", async () => {
  const state = {
    chartIds: [] as string[],
    maximumConcurrentCharts: 0,
    apiKeys: [] as string[],
  };
  const fetcher = marketLeadersSequentialChartsMockFetch(state);
  const data = await resolveCoinLeaders7dMarketData(
    fetcher,
    { apiKey: "test-cmc-api-key" },
  );

  assert.equal(data.leaders.gainer.coin.id, "9001");
  assert.equal(data.leaders.decliner.coin.id, "9002");
  assert.deepEqual(state.chartIds, ["9001", "9002"]);
  assert.equal(state.maximumConcurrentCharts, 1);
  assert.deepEqual(state.apiKeys, [
    "test-cmc-api-key",
    "test-cmc-api-key",
    "test-cmc-api-key",
  ]);
});

test("requires the CoinMarketCap API key before making requests", async () => {
  let called = false;
  await assert.rejects(
    resolveCoinLeaders7dMarketData(async () => {
      called = true;
      return jsonResponse({});
    }, { apiKey: "" }),
    /COINMARKETCAP_API_KEY/,
  );
  assert.equal(called, false);
});

test("reports an invalid CoinMarketCap key without exposing it", async () => {
  const fakeKey = "test-key-that-must-not-appear-in-errors";
  const fetcher: typeof fetch = async () => jsonResponse({
    status: {
      error_code: 1001,
      error_message: "This API Key is invalid.",
    },
  }, 401);

  await assert.rejects(
    resolveCoinLeaders7dMarketData(fetcher, { apiKey: fakeKey }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /CoinMarketCap отклонил API-ключ/);
      assert.doesNotMatch(error.message, new RegExp(fakeKey));
      return true;
    },
  );
});

test("renders all six distinct overview scenes as vertical SVG frames", async () => {
  const data = await resolveCoinOverviewMarketData("HYPE", mockFetch());
  const story = buildCoinOverviewStory(data);
  const durationMs = 44_000;
  const beats = story.map((scene, index) => ({
    from: index / story.length,
    to: (index + 1) / story.length,
    title: scene.title,
    subtitle: scene.subtitle,
    visual: "market",
    background: "grid",
  } as unknown as FinancialShortBeat));
  const plan = {
    mainTitle: "HYPE • МОНЕТА В ФОКУСЕ",
    background: "grid",
    visualTheme: "coin_overview",
    coinOverviewData: data,
    beats,
  } as unknown as FinancialShortRenderPlan;
  const sceneStartsMs = beats.slice(1).map((beat) => Math.round(beat.from * durationMs));
  const frames: string[] = [];

  for (const [index, scene] of story.entries()) {
    const timeMs = Math.round(((beats[index]!.from + beats[index]!.to) / 2) * durationMs);
    const svg = renderFinancialTopicPreviewFrame(plan, durationMs, timeMs, sceneStartsMs);
    assert.match(svg, /viewBox="0 0 1080 1920"/);
    assert.ok(svg.includes(scene.title));
    assert.doesNotMatch(svg, /="[^"]*\d_\d/);
    frames.push(svg);
  }

  const tempDir = await mkdtemp(join(tmpdir(), "coin-overview-render-"));
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
