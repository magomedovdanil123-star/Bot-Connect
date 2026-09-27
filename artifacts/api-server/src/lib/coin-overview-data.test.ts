import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import {
  renderFinancialTopicPreviewFrame,
  type FinancialShortBeat,
  type FinancialShortRenderPlan,
} from "./financial-short-renderer";
import {
  buildCoinOverviewStory,
  clearCoinOverviewMarketDataCacheForTests,
  COIN_OVERVIEW_SCENE_DURATIONS_SECONDS,
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
  assert.match(scenes[2]!.voiceText, /одной биржи/i);
  assert.match(scenes[5]!.voiceText, /CoinGecko.*Hyperliquid/);
  assert.equal(COIN_OVERVIEW_SCENE_DURATIONS_SECONDS.reduce((sum, seconds) => sum + seconds, 0), 44);
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
