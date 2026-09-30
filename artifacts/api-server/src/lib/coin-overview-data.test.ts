import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import {
  appendSilenceToAudioSegment,
  renderFinancialTopicPreviewFrame,
  renderFinancialTopicShortWithAudioTrack,
  type FinancialShortBeat,
  type FinancialShortRenderPlan,
} from "./financial-short-renderer";
import {
  buildCoinOverviewVideoTitle,
  buildCoinLeaders7dStory,
  buildCoinOverviewStory,
  calculateCoinOverviewHypotheticalResult,
  clearCoinOverviewMarketDataCacheForTests,
  COIN_LEADERS_7D_SCENE_DURATIONS_SECONDS,
  COIN_OVERVIEW_HOOK_PAUSE_MS,
  COIN_OVERVIEW_SCENE_DURATIONS_SECONDS,
  CRYPTO_MARKET_7D_CTA,
  refreshCoinLeaders7dNarration,
  resolveCoinLeaders7dMarketData,
  resolveCoinLeaders7dTopGainers,
  resolveCoinOverviewLongResearchData,
  resolveCoinOverviewMarketData,
} from "./coin-overview-data";

const DAY_MS = 24 * 60 * 60 * 1_000;
const execFileAsync = promisify(execFile);
const TEST_COIN_LOGO_URL = "https://coin-images.coingecko.com/coins/images/123/small/hype.png";
const TEST_COIN_LOGO_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==",
  "base64",
);

test("builds a factual seven-day title from the selected coin's saved change", () => {
  const coin = {
    id: "hyperliquid",
    name: "Hyperliquid",
    symbol: "hype",
    marketCapRank: 1,
    sourceUrl: "https://www.coingecko.com/en/coins/hyperliquid",
  };
  assert.equal(
    buildCoinOverviewVideoTitle({ coin, changePercent7d: 23.46 }),
    "Рост HYPE на 23% за 7 дней: что произошло?",
  );
  assert.equal(
    buildCoinOverviewVideoTitle({ coin: { ...coin, symbol: "qnt" }, changePercent7d: -12.54 }),
    "Падение QNT на 13% за 7 дней: что произошло?",
  );
  assert.equal(
    buildCoinOverviewVideoTitle({ coin, changePercent7d: 0.04 }),
    "Что произошло с HYPE за 7 дней?",
  );
});

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
      image: TEST_COIN_LOGO_URL,
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

    if (url === TEST_COIN_LOGO_URL) {
      return new Response(TEST_COIN_LOGO_BYTES, {
        headers: { "content-type": "image/png" },
      });
    }
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

function marketLeadersMockFetch(state?: {
  requestHeaders: Array<{ demoApiKey: string | null; userAgent: string | null }>;
}): typeof fetch {
  const markets = [
    {
      id: "weekly-winner",
      name: "Weekly Winner",
      symbol: "win",
      market_cap_rank: 1,
      current_price: 140,
      market_cap: 8_000_000_000,
      total_volume: 90_000_000,
      price_change_percentage_7d_in_currency: 40,
      last_updated: new Date().toISOString(),
    },
    {
      id: "weekly-runner-up",
      name: "Weekly Runner Up",
      symbol: "runner",
      market_cap_rank: 2,
      current_price: 110,
      market_cap: 5_000_000_000,
      total_volume: 70_000_000,
      price_change_percentage_7d_in_currency: 12.5,
      last_updated: new Date().toISOString(),
    },
    {
      id: "weekly-loser",
      name: "Weekly Loser",
      symbol: "loss",
      market_cap_rank: 3,
      current_price: 72,
      market_cap: 4_000_000_000,
      total_volume: 30_000_000,
      price_change_percentage_7d_in_currency: -22,
      last_updated: new Date().toISOString(),
    },
    {
      id: "usd-coin",
      name: "USD Coin",
      symbol: "usdc",
      market_cap_rank: 4,
      current_price: 1,
      market_cap: 50_000_000_000,
      total_volume: 20_000_000,
      price_change_percentage_7d_in_currency: 0.1,
      last_updated: new Date().toISOString(),
    },
    {
      id: "illiquid-winner",
      name: "Illiquid Winner",
      symbol: "thin",
      market_cap_rank: 5,
      current_price: 4,
      market_cap: 500_000_000,
      total_volume: 2_000_000,
      price_change_percentage_7d_in_currency: 500,
      last_updated: new Date().toISOString(),
    },
  ];
  const charts: Record<string, number[]> = {
    "weekly-winner": [100, 103, 101, 99, 97, 100, 104, 110, 108, 105, 102, 106, 111, 117, 120, 118, 116, 119, 124, 131, 129, 126, 132, 138, 140],
    "weekly-loser": [140, 136, 132, 130, 125, 128, 124, 120, 116, 118, 112, 108, 110, 105, 100, 102, 96, 92, 95, 89, 84, 86, 80, 76, 72],
  };
  return async (input, init) => {
    const url = input instanceof Request
      ? input.url
      : input instanceof URL ? input.href : input;
    const requestHeaders = new Headers(init?.headers);
    state?.requestHeaders.push({
      demoApiKey: requestHeaders.get("x-cg-demo-api-key"),
      userAgent: requestHeaders.get("user-agent"),
    });
    if (url.includes("/coins/markets?")) return jsonResponse(markets);
    if (url.includes("/market_chart?")) {
      const id = decodeURIComponent(url.split("/coins/")[1]!.split("/")[0]!);
      const values = charts[id];
      if (!values) throw new Error(`Unexpected market chart request for ${id}`);
      const start = Date.now() - 7 * DAY_MS;
      return jsonResponse({
        prices: values.map((price, index) => [
          start + (7 * DAY_MS * index) / (values.length - 1),
          price,
        ]),
      });
    }
    throw new Error(`Unexpected market leaders request: ${url}`);
  };
}

function marketLeaders429RecoveryMockFetch(options: {
  chartIds: string[];
  maximumConcurrentCharts: number;
}): typeof fetch {
  const baseFetcher = marketLeadersMockFetch();
  let activeCharts = 0;

  return async (input, init) => {
    const url = input instanceof Request
      ? input.url
      : input instanceof URL ? input.href : input;
    if (!url.includes("/market_chart?")) return baseFetcher(input, init);

    const id = decodeURIComponent(url.split("/coins/")[1]!.split("/")[0]!);
    options.chartIds.push(id);
    activeCharts += 1;
    options.maximumConcurrentCharts = Math.max(options.maximumConcurrentCharts, activeCharts);
    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (options.chartIds.length === 1) {
        return new Response("rate limited", {
          status: 429,
          headers: { "retry-after": "0" },
        });
      }
      return await baseFetcher(input, init);
    } finally {
      activeCharts -= 1;
    }
  };
}

test("builds seven HYPE scenes from seven-day data and labels venue-specific open interest", async () => {
  clearCoinOverviewMarketDataCacheForTests();
  const data = await resolveCoinOverviewMarketData("HYPE", mockFetch());
  const scenes = buildCoinOverviewStory(data);

  assert.equal(data.coin.id, "hyperliquid");
  assert.equal(data.priceSamples.length, 7);
  assert.equal(data.changePercent7d, 100);
  assert.deepEqual(calculateCoinOverviewHypotheticalResult(data), {
    initialUsd: 1_000,
    exitUsd: 2_000,
    pnlUsd: 1_000,
    changePercent: 100,
  });
  assert.equal(data.activity.kind, "open_interest");
  assert.equal(data.activity.valueUsd, 1_200);
  assert.equal(data.activity.sourceLabel, "Hyperliquid");
  assert.match(data.coin.logoDataUri ?? "", /^data:image\/png;base64,/);
  assert.equal(scenes.length, 7);
  assert.match(
    scenes[0]!.voiceText,
    /^Плюс\s+1\s000 долларов на условной позиции в 1\s000 долларов по HYPE за неделю/iu,
  );
  assert.doesNotMatch(scenes[0]!.voiceText, /Привет, друзья!|\$2\s?000|2\s?000 долларов на выходе/iu);
  assert.equal(scenes[0]!.soundEffect, "cash_register");
  assert.equal(scenes[0]!.pauseAfterMs, COIN_OVERVIEW_HOOK_PAUSE_MS);
  assert.match(scenes[0]!.visualAction, /считай.*кассовый эффект.*2 секунды/iu);
  assert.match(scenes[1]!.voiceText, /^Привет, друзья!/);
  assert.match(scenes[1]!.voiceText, /посчитаем, что стало бы с условными \$1 000/);
  assert.match(scenes[1]!.voiceText, /путь цены/i);
  assert.match(scenes[2]!.voiceText, /полной картиной/i);
  assert.match(scenes[4]!.voiceText, /рыночный фон/i);
  assert.match(scenes[5]!.voiceText, /не прогноз и не обещание результата/i);
  assert.match(scenes[5]!.voiceText, /условные тысяча долларов/i);
  assert.match(scenes[5]!.voiceText, /плюс\s+1\s000 долларов США/);
  assert.match(scenes[5]!.subtitle, /2\s000 \$ на выходе/);
  assert.equal(scenes[5]!.soundEffect, "cash_register");
  assert.match(scenes[3]!.voiceText, /одной биржи/i);
  assert.match(scenes[6]!.voiceText, /CoinGecko.*Hyperliquid/);
  assert.equal(COIN_OVERVIEW_HOOK_PAUSE_MS, 2_000);
  assert.ok(
    Math.abs(COIN_OVERVIEW_SCENE_DURATIONS_SECONDS.reduce((sum, seconds) => sum + seconds, 0) - 51.2) < 1e-9,
  );
});

test("shows a weekly loss without the positive-result cash-register cue", async () => {
  const data = await resolveCoinOverviewMarketData("HYPE", mockFetch());
  const lossStory = buildCoinOverviewStory({
    ...data,
    currentPriceUsd: 40,
    changePercent7d: -20,
  });

  assert.equal(lossStory[0]!.soundEffect, "none");
  assert.match(
    lossStory[0]!.voiceText,
    /^Минус\s+200 долларов на условной позиции в 1\s000 долларов по HYPE за неделю/iu,
  );
  assert.equal(lossStory[5]!.soundEffect, "none");
  assert.match(lossStory[5]!.subtitle, /800 \$ на выходе/);
  assert.match(lossStory[5]!.voiceText, /минус\s+200 долларов США/);
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
  assert.match(buildCoinOverviewStory(data)[3]!.voiceText, /Оборот за сутки по CoinGecko/);
});

test("resolves a selected CoinGecko ID directly for the individual seven-day overview", async () => {
  const requests: string[] = [];
  const baseFetcher = mockFetch();
  const fetcher: typeof fetch = async (input, init) => {
    const url = input instanceof Request
      ? input.url
      : input instanceof URL ? input.href : input;
    requests.push(url);
    return baseFetcher(input, init);
  };
  const data = await resolveCoinOverviewMarketData("Hyperliquid", fetcher, "hyperliquid");

  assert.equal(data.coin.id, "hyperliquid");
  assert.equal(data.coin.symbol, "HYPE");
  assert.equal(data.coin.name, "Hyperliquid");
  assert.equal(requests.some((url) => url.includes("/search?")), false);
});

test("collects CoinGecko project details and only coin-matched recent CoinDesk news for a long overview", async () => {
  const now = new Date().toUTCString();
  const fetcher: typeof fetch = async (input) => {
    const url = input instanceof Request
      ? input.url
      : input instanceof URL ? input.href : input;
    if (url.includes("/coins/hyperliquid?")) {
      return jsonResponse({
        description: {
          en: "<p>Hyperliquid is a <strong>decentralized exchange</strong> &amp; layer 1.</p><script>ignore()</script>",
        },
        categories: ["Decentralized Exchange", "Layer 1"],
        genesis_date: "2023-01-01",
        hashing_algorithm: null,
        links: {
          homepage: ["https://hyperliquid.xyz", "javascript:alert(1)"],
          blockchain_site: ["https://explorer.hyperliquid.xyz"],
          whitepaper: "https://hyperliquid.gitbook.io",
        },
      });
    }
    if (url.includes("coindesk.com/arc/outboundfeeds/rss/")) {
      return new Response([
        "<rss><channel>",
        `<item><title>Hyperliquid announces an ecosystem update</title><link>https://www.coindesk.com/example/hype/</link><pubDate>${now}</pubDate><description>New HYPE ecosystem details.</description></item>`,
        `<item><title>Bitcoin market recap</title><link>https://www.coindesk.com/example/btc/</link><pubDate>${now}</pubDate><description>Bitcoin BTC news.</description></item>`,
        `<item><title>Market hype around Bitcoin continues</title><link>https://www.coindesk.com/example/hype-word/</link><pubDate>${now}</pubDate><description>Bitcoin market hype.</description></item>`,
        "</channel></rss>",
      ].join(""), { headers: { "content-type": "application/rss+xml" } });
    }
    throw new Error(`Unexpected mock request: ${url}`);
  };

  const research = await resolveCoinOverviewLongResearchData("hyperliquid", "Hyperliquid", "HYPE", fetcher);

  assert.equal(research.description, "Hyperliquid is a decentralized exchange & layer 1.");
  assert.deepEqual(research.categories, ["Decentralized Exchange", "Layer 1"]);
  assert.equal(research.genesisDate, "2023-01-01");
  assert.equal(research.newsSearchStatus, "matched");
  assert.equal(research.recentNews.length, 1);
  assert.match(research.recentNews[0]!.title, /Hyperliquid/);
  assert.deepEqual(research.sourceUrls, [
    "https://hyperliquid.xyz/",
    "https://explorer.hyperliquid.xyz/",
    "https://hyperliquid.gitbook.io/",
  ]);
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

test("returns only positive seven-day gainers in percentage order", async () => {
  const gainers = await resolveCoinLeaders7dTopGainers(10, marketLeadersMockFetch());

  assert.deepEqual(
    gainers.map(({ coin, changePercent7d }) => [coin.id, changePercent7d]),
    [
      ["weekly-winner", 40],
      ["weekly-runner-up", 12.5],
    ],
  );
  assert.ok(gainers.every((gainer) => gainer.changePercent7d > 0));
});

test("ranks liquid non-stablecoin leaders, shows technical observation zones, and stays under two minutes", async () => {
  assert.equal(
    CRYPTO_MARKET_7D_CTA,
    "Все эти движения можно отслеживать самостоятельно. Ссылка на биржу — в описании и шапке профиля.",
  );
  const data = await resolveCoinLeaders7dMarketData(marketLeadersMockFetch());
  const story = buildCoinLeaders7dStory(data);
  assert.equal(data.screenedCoinCount, 3);
  assert.equal(data.sourceLabel, "CoinGecko");
  assert.equal(data.leaders.gainer.coin.id, "weekly-winner");
  assert.equal(data.leaders.decliner.coin.id, "weekly-loser");
  assert.equal(data.leaders.gainer.changePercent7d, 40);
  assert.equal(data.leaders.decliner.changePercent7d, -22);
  assert.ok(data.leaders.gainer.entryZone.lowUsd < data.leaders.gainer.entryZone.highUsd);
  assert.ok(data.leaders.decliner.entryZone.lowUsd < data.leaders.decliner.entryZone.highUsd);
  assert.equal(story.length, 6);
  assert.match(story[0]!.voiceText, /Привет, друзья!/);
  assert.match(story[0]!.voiceText, /Кто за неделю вырос сильнее всех, а кто упал\?/);
  assert.match(story[0]!.voiceText, /CoinGecko/);
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
    assert.match(svg, /data:image\/jpeg;base64,/);
    assert.ok(svg.includes(scene.title));
    assert.match(svg, /COINGECKO/);
    assert.doesNotMatch(svg, /COINMARKETCAP/);
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
  const data = await resolveCoinLeaders7dMarketData(marketLeadersMockFetch());
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

test("recovers from a CoinGecko 429 and fetches leader charts sequentially", async () => {
  const state = { chartIds: [] as string[], maximumConcurrentCharts: 0 };
  const fetcher = marketLeaders429RecoveryMockFetch(state);
  const data = await resolveCoinLeaders7dMarketData(fetcher);

  assert.equal(data.leaders.gainer.coin.id, "weekly-winner");
  assert.equal(data.leaders.decliner.coin.id, "weekly-loser");
  assert.deepEqual(state.chartIds, ["weekly-winner", "weekly-winner", "weekly-loser"]);
  assert.equal(state.maximumConcurrentCharts, 1);
});

test("sends an optional CoinGecko Demo key and a descriptive user agent", async () => {
  const previousApiKey = process.env.COINGECKO_DEMO_API_KEY;
  process.env.COINGECKO_DEMO_API_KEY = "test-cg-demo-key";
  const state = { requestHeaders: [] as Array<{ demoApiKey: string | null; userAgent: string | null }> };
  try {
    await resolveCoinLeaders7dMarketData(marketLeadersMockFetch(state));
    assert.equal(state.requestHeaders.length, 3);
    assert.ok(state.requestHeaders.every(({ demoApiKey, userAgent }) => (
      demoApiKey === "test-cg-demo-key" && userAgent === "CryptoMarketDataBot/1.0"
    )));
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.COINGECKO_DEMO_API_KEY;
    } else {
      process.env.COINGECKO_DEMO_API_KEY = previousApiKey;
    }
  }
});

test("reports CoinGecko access denial clearly", async () => {
  const fetcher: typeof fetch = async () => jsonResponse({}, 403);
  await assert.rejects(
    resolveCoinLeaders7dMarketData(fetcher),
    /CoinGecko отклонил запрос \(HTTP 403\)/,
  );
});

test("renders seven overview scenes and animates the opening profit count", async () => {
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
    soundEffect: scene.soundEffect ?? "none",
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
    if (index === 5) {
      assert.match(svg, /ПОКУПКА В НАЧАЛЕ НЕДЕЛИ/);
      assert.match(svg, /\+\$1\s000/);
      assert.match(svg, /ИЗМЕНЕНИЕ ЦЕНЫ \+100% ЗА 7 ДНЕЙ/);
    }
    if (index === 0) {
      assert.match(svg, /coin-overview-logo-clip/);
      assert.match(svg, /data:image\/png;base64,/);
      assert.match(svg, /\+\$1\s000/);
      assert.doesNotMatch(svg, /\$2,000|→/);
    }
    if (index === 1) {
      assert.match(svg, /ТЕКУЩАЯ ЦЕНА/);
      assert.match(svg, /ИЗМЕНЕНИЕ ЗА 7 ДНЕЙ/);
    }
    frames.push(svg);
  }

  const hookStartMs = Math.round(beats[0]!.from * durationMs);
  const countingFrame = renderFinancialTopicPreviewFrame(
    plan,
    durationMs,
    hookStartMs + 800,
    sceneStartsMs,
  );
  const countedFrame = renderFinancialTopicPreviewFrame(
    plan,
    durationMs,
    hookStartMs + 1_800,
    sceneStartsMs,
  );
  assert.doesNotMatch(countingFrame, /\+\$1\s000/);
  assert.match(countedFrame, /\+\$1\s000/);

  const investmentBeat = beats[5]!;
  const finalInvestmentTime = Math.round(
    (investmentBeat.from + (investmentBeat.to - investmentBeat.from) * 0.95) * durationMs,
  );
  const finalInvestmentFrame = renderFinancialTopicPreviewFrame(
    plan,
    durationMs,
    finalInvestmentTime,
    sceneStartsMs,
  );
  assert.match(finalInvestmentFrame, /\$2,000/);

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

    const voicePath = join(tempDir, "voice.wav");
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-f", "lavfi",
      "-i", "sine=frequency=440:duration=4",
      voicePath,
    ], { timeout: 30_000, maxBuffer: 1 * 1024 * 1024 });
    const renderedWithAudio = await renderFinancialTopicShortWithAudioTrack(
      plan,
      voicePath,
      beats.slice(1).map((beat) => Math.round(beat.from * 4_000)),
    );
    const audioVideoPath = join(tempDir, "overview-with-audio.mp4");
    await writeFile(audioVideoPath, renderedWithAudio.buffer);
    const audioProbe = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "stream=codec_type,width,height",
      "-of", "json",
      audioVideoPath,
    ], { timeout: 30_000, maxBuffer: 1 * 1024 * 1024 });
    assert.match(audioProbe.stdout, /"codec_type": "video"/);
    assert.match(audioProbe.stdout, /"codec_type": "audio"/);
    assert.match(audioProbe.stdout, /"width": 1080/);
    assert.match(audioProbe.stdout, /"height": 1920/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("adds the two-second pause after opening hook narration", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "coin-overview-hook-pause-"));
  try {
    const speechPath = join(tempDir, "hook.wav");
    const pausedSpeechPath = join(tempDir, "hook-paused.mp3");
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-f", "lavfi",
      "-i", "sine=frequency=440:duration=0.6",
      speechPath,
    ], { timeout: 30_000, maxBuffer: 1 * 1024 * 1024 });

    const durationMs = await appendSilenceToAudioSegment(
      speechPath,
      pausedSpeechPath,
      COIN_OVERVIEW_HOOK_PAUSE_MS,
    );
    const probe = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      pausedSpeechPath,
    ]);
    const actualDurationMs = Number.parseFloat(probe.stdout.trim()) * 1_000;
    assert.ok(Math.abs(actualDurationMs - durationMs) <= 120);
    assert.ok(Math.abs(actualDurationMs - 2_600) <= 120);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("keeps the complete post-hook pause silent, including the music bed", async () => {
  const data = await resolveCoinOverviewMarketData("HYPE", mockFetch());
  const tempDir = await mkdtemp(join(tmpdir(), "coin-overview-silent-pause-"));
  try {
    const audioPath = join(tempDir, "voice-with-pause.wav");
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-f", "lavfi",
      "-i", "sine=frequency=440:sample_rate=48000:duration=0.6",
      "-f", "lavfi",
      "-i", "anullsrc=r=48000:cl=mono",
      "-f", "lavfi",
      "-i", "sine=frequency=440:sample_rate=48000:duration=1",
      "-filter_complex",
      "[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=mono[hook];[1:a]atrim=duration=2,asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=mono[pause];[2:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=mono[intro];[hook][pause][intro]concat=n=3:v=0:a=1[out]",
      "-map", "[out]",
      "-c:a", "pcm_s16le",
      audioPath,
    ], { timeout: 30_000, maxBuffer: 1 * 1024 * 1024 });
    const plan = {
      mainTitle: "HYPE • ОБЗОР ЗА 7 ДНЕЙ",
      background: "grid",
      visualTheme: "coin_overview",
      coinOverviewData: data,
      beats: [
        {
          id: "hook",
          from: 0,
          to: 0.72,
          visual: "hook",
          title: "РЕЗУЛЬТАТ ЗА 7 ДНЕЙ",
          subtitle: "Позиция $1 000",
          pauseAfterMs: COIN_OVERVIEW_HOOK_PAUSE_MS,
        },
        {
          id: "identity",
          from: 0.72,
          to: 1,
          visual: "market",
          title: "HYPE В ФОКУСЕ",
          subtitle: "Недельный обзор",
        },
      ],
    } as unknown as FinancialShortRenderPlan;
    const rendered = await renderFinancialTopicShortWithAudioTrack(
      plan,
      audioPath,
      [2_600],
    );
    const outputPath = join(tempDir, "silent-pause.mp4");
    await writeFile(outputPath, rendered.buffer);

    const rmsAt = async (startSeconds: number, durationSeconds: number): Promise<number> => {
      const sample = await execFileAsync("ffmpeg", [
        "-hide_banner",
        "-loglevel", "error",
        "-i", outputPath,
        "-ss", String(startSeconds),
        "-t", String(durationSeconds),
        "-map", "0:a:0",
        "-ac", "1",
        "-ar", "48000",
        "-f", "f32le",
        "pipe:1",
      ], {
        timeout: 30_000,
        maxBuffer: 2 * 1024 * 1024,
        encoding: "buffer",
      });
      const bytes = Buffer.from(sample.stdout);
      const sampleCount = Math.floor(bytes.length / 4);
      const sumSquares = Array.from({ length: sampleCount }, (_, index) => {
        const value = bytes.readFloatLE(index * 4);
        return value * value;
      }).reduce((sum, value) => sum + value, 0);
      return Math.sqrt(sumSquares / Math.max(1, sampleCount));
    };

    const beforePauseRms = await rmsAt(0.15, 0.3);
    const duringPauseRms = await rmsAt(0.8, 1.4);
    const afterPauseRms = await rmsAt(2.85, 0.3);
    assert.ok(beforePauseRms > 0.001, `expected sound before pause, got RMS ${beforePauseRms}`);
    assert.ok(duringPauseRms < 0.001, `expected silence during pause, got RMS ${duringPauseRms}`);
    assert.ok(afterPauseRms > 0.001, `expected sound after pause, got RMS ${afterPauseRms}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("shows the Bybit banner only during the weekly coin overview CTA", async () => {
  const data = await resolveCoinOverviewMarketData("HYPE", mockFetch());
  const cta = CRYPTO_MARKET_7D_CTA;
  const plan = {
    mainTitle: "HYPE • ОБЗОР ЗА 7 ДНЕЙ",
    background: "grid",
    visualTheme: "coin_overview",
    coinOverviewData: data,
    beats: [
      {
        id: "overview",
        from: 0,
        to: 0.5,
        visual: "hook",
        title: "HYPE В ФОКУСЕ",
        subtitle: "Недельный обзор.",
        voiceText: "Начало обзора.",
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
  const tempDir = await mkdtemp(join(tmpdir(), "coin-overview-bybit-banner-"));
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
    const outputPath = join(tempDir, "weekly-banner-preview.mp4");
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
      `expected the Bybit banner to appear only during the weekly CTA (before ${beforeCtaLuma.toFixed(1)}, during ${duringCtaLuma.toFixed(1)})`,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
