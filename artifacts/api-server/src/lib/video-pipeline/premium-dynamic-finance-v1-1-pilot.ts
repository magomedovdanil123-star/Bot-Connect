import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  resolveCoinOverviewLongResearchData,
  resolveCoinOverviewMarketData,
} from "../coin-overview-data";
import { buildPremiumDynamicFinanceV1_1VisualPlan } from "./premium-dynamic-finance-v1-1-visual-director";
import {
  buildPremiumDynamicFinanceV1_1PilotVoices,
  PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS,
} from "./premium-dynamic-finance-v1-1-pilot-script";

type VisualPlan = ReturnType<typeof buildPremiumDynamicFinanceV1_1VisualPlan>;

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function planClock(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function buildVisualPlanMarkdown(input: {
  plan: VisualPlan;
  market: Awaited<ReturnType<typeof resolveCoinOverviewMarketData>>;
  research: Awaited<ReturnType<typeof resolveCoinOverviewLongResearchData>> | null;
}): string {
  const { plan, market, research } = input;
  const number = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 7 });
  const percent = (value: number) =>
    `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  const scenes = plan.events.map((event, index) => {
    const motion = event.motionBeats
      .map((beat) => `- ${planClock(event.startMs + beat.atMs)} — ${beat.action}`)
      .join("\n");
    const assets = event.assetPlans.length
      ? event.assetPlans.map((asset) =>
          `- ${asset.key} — ${asset.purpose} **[${asset.status}]**${
            asset.integrityLabel ? `; ${asset.integrityLabel}` : ""
          }${asset.sourceUrl ? `; ${asset.sourceLabel ?? "source"}: ${asset.sourceUrl}` : ""}`,
        ).join("\n")
      : "- No external asset required.";
    const sources = event.sourceReferences.length
      ? event.sourceReferences.map((source) => `- ${source.label}: ${source.url}`).join("\n")
      : "- No external factual source used.";
    const facts = Object.keys(event.factualData).length
      ? `\n**Verified data anchors:**\n\n\`\`\`json\n${JSON.stringify(event.factualData, null, 2)}\n\`\`\`\n`
      : "";
    return `## SCENE ${String(index + 1).padStart(2, "0")} · ${planClock(event.startMs)}–${planClock(event.endMs)}

**TEXT:** “${event.text}”

**SEMANTIC MEANING:** ${event.semanticMeaning}

**VISUAL:** ${event.visualType}

**DOMINANT VISUAL:** ${event.dominantVisual}

**COMPOSITION:** ${event.compositionMode}; visual occupies approximately ${event.subjectOccupancyPercent}% of attention. ${event.cameraFraming}

**BACKGROUND:** ${event.backgroundKey}

**ASSETS:**

${assets}

**ANIMATION:**

${motion}

**TRANSITION:** ${event.transitionOut}
${facts}${event.integrityNote ? `\n**INTEGRITY NOTE:** ${event.integrityNote}\n` : ""}

**SOURCES:**

${sources}`;
  }).join("\n\n---\n\n");

  return `# Premium Dynamic Finance V1.1 — Dogecoin visual plan

**Plan only. No MP4 was rendered.** The plan uses full-scene compositions; market-data cards are not the default.

## Project

- Version: ${plan.version}
- Duration: ${(plan.durationMs / 1_000).toFixed(0)} seconds
- Aspect ratio: ${plan.aspectRatio}
- Scenes: ${plan.events.length}
- Market source: ${plan.dataSource.label} — ${plan.dataSource.url}
- Data timestamp: ${plan.dataAsOf}
- Confirmed genesis date: ${research?.genesisDate ?? "not returned; omitted"}

## Data snapshot

- Current price: $${number.format(market.currentPriceUsd)}
- 7-day change: ${percent(market.changePercent7d)}
- 7-day range: $${number.format(market.lowPriceUsd7d)}–$${number.format(market.highPriceUsd7d)}
- Market cap: ${market.marketCapUsd === null ? "not supplied; not invented" : `$${number.format(market.marketCapUsd)}`}
- Benchmarks, same period: ${market.benchmarks.map((item) => `${item.symbol} ${percent(item.changePercent7d)}`).join(" · ")}
- Sampled price points: ${market.priceSamples.length}
- Visual types repeat consecutively: ${plan.repeatedVisualTypes}
- Unique backgrounds: ${new Set(plan.events.map((event) => event.backgroundKey)).size}
- Editorial/illustrative scenes have explicit integrity labels; no fictional news, audience totals, or live blockchain data.

${scenes}

## Renderer boundary

- This is a semantic visual plan for review; it does not call the video renderer.
- Telegram, production routing, and the active Premium Dynamic renderer remain unchanged.
- The rejected corner-card overlay output is not treated as satisfying this plan.
`;
}

export async function generatePremiumDynamicFinanceV1_1DogecoinVisualPlan(input: {
  jsonPath?: string;
  markdownPath?: string;
} = {}): Promise<{
  jsonPath: string;
  markdownPath: string;
  plan: VisualPlan;
  markdown: string;
}> {
  const jsonPath = resolve(
    input.jsonPath ?? "output/premium-dynamic-finance-v1-1-dogecoin.visual-plan.json",
  );
  const markdownPath = resolve(
    input.markdownPath ?? "output/premium-dynamic-finance-v1-1-dogecoin.visual-plan.md",
  );
  if (jsonPath === markdownPath) {
    throw new Error("Visual plan JSON and Markdown outputs must use different paths");
  }

  const market = await resolveCoinOverviewMarketData(
    "dogecoin",
    globalThis.fetch,
    "dogecoin",
  );
  let research: Awaited<ReturnType<typeof resolveCoinOverviewLongResearchData>> | null = null;
  try {
    research = await resolveCoinOverviewLongResearchData(
      market.coin.id,
      market.coin.name,
      globalThis.fetch,
      market.sourceLabel,
    );
  } catch (error) {
    console.warn(JSON.stringify({
      run: "premium-dynamic-finance-v1-1-dogecoin-plan",
      event: "optional-history-unavailable",
      reason: error instanceof Error ? error.message : String(error),
    }));
  }

  const voices = buildPremiumDynamicFinanceV1_1PilotVoices({
    genesisDate: research?.genesisDate,
  });
  const plan = buildPremiumDynamicFinanceV1_1VisualPlan({
    voices,
    entity: {
      id: market.coin.id,
      name: market.coin.name,
      symbol: market.coin.symbol,
    },
    dataAsOf: market.dataAsOf,
    market,
    research,
  });
  const expectedTypes: VisualPlan["events"][number]["visualType"][] = [
    "HISTORY_DOCUMENTARY",
    "PRICE_MOVEMENT",
    "MARKET_GROWTH",
    "MARKET_DROP",
    "FULLSCREEN_STAT",
    "COIN_COMPARISON",
    "NEWS_EDITORIAL",
    "COMMUNITY",
    "BLOCKCHAIN_NETWORK",
    "FULLSCREEN_IMPACT",
  ];
  const actualTypes = new Set(plan.events.map((event) => event.visualType));
  const missingTypes = expectedTypes.filter((visualType) => !actualTypes.has(visualType));
  if (
    plan.events.length !== 10
    || plan.durationMs !== PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS
    || missingTypes.length > 0
  ) {
    throw new Error(
      `V1.1 plan failed the 10-scene semantic coverage check; missing: ${missingTypes.join(", ")}`,
    );
  }

  await mkdir(dirname(jsonPath), { recursive: true });
  await mkdir(dirname(markdownPath), { recursive: true });
  if (await pathExists(jsonPath)) {
    throw new Error(`Refusing to overwrite an existing visual plan: ${jsonPath}`);
  }
  if (await pathExists(markdownPath)) {
    throw new Error(`Refusing to overwrite an existing visual plan: ${markdownPath}`);
  }

  const markdown = buildVisualPlanMarkdown({ plan, market, research });
  await writeFile(jsonPath, `${JSON.stringify(plan, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  try {
    await writeFile(markdownPath, markdown, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    await rm(jsonPath, { force: true });
    throw error;
  }
  return { jsonPath, markdownPath, plan, markdown };
}

export function parsePremiumDynamicFinanceV1_1PilotArgs(args: string[]): {
  jsonPath: string;
  markdownPath: string;
  help: boolean;
} {
  let jsonPath = resolve("output/premium-dynamic-finance-v1-1-dogecoin.visual-plan.json");
  let markdownPath = resolve("output/premium-dynamic-finance-v1-1-dogecoin.visual-plan.md");
  let help = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--") continue;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--json") {
      const value = args[index + 1];
      if (!value) throw new Error("--json requires a JSON file path");
      jsonPath = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--markdown") {
      const value = args[index + 1];
      if (!value) throw new Error("--markdown requires a Markdown file path");
      markdownPath = resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown visual-plan option: ${arg}`);
  }
  return { jsonPath, markdownPath, help };
}

export function premiumDynamicFinanceV1_1PilotUsage(): string {
  return [
    "Build the isolated two-minute Dogecoin V1.1 semantic visual plan only. This command does not render video.",
    "Options:",
    "  --json <file.json>       JSON plan path (default: output/premium-dynamic-finance-v1-1-dogecoin.visual-plan.json)",
    "  --markdown <file.md>     Readable plan path (default: output/premium-dynamic-finance-v1-1-dogecoin.visual-plan.md)",
    "MP4 rendering remains paused until the visual plan is reviewed and the full-scene renderer is ready.",
  ].join("\n");
}