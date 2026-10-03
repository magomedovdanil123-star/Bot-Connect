import { readFile } from "node:fs/promises";
import {
  generatePremiumDynamicFinanceV1_1DogecoinVisualPlan,
  parsePremiumDynamicFinanceV1_1PilotArgs,
  premiumDynamicFinanceV1_1PilotUsage,
} from "./premium-dynamic-finance-v1-1-pilot";
import { resolveCoinOverviewMarketData } from "../coin-overview-data";
import type { PremiumDynamicFinanceV1_1VisualPlan } from "./premium-dynamic-finance-v1-1-visual-director";
import { renderPremiumDynamicFinanceV1_1FullSceneVideo } from "./premium-dynamic-finance-v1-1-full-scene-renderer";

async function main(): Promise<void> {
  const options = parsePremiumDynamicFinanceV1_1PilotArgs(process.argv.slice(2));
  if (options.help) {
    console.log(premiumDynamicFinanceV1_1PilotUsage());
    return;
  }
  if (options.render) {
    const plan = JSON.parse(
      await readFile(options.jsonPath, "utf8"),
    ) as PremiumDynamicFinanceV1_1VisualPlan;
    let logoDataUri: string | undefined;
    try {
      const logoAsset = await resolveCoinOverviewMarketData(
        plan.entity.id,
        globalThis.fetch,
        plan.entity.id,
      );
      logoDataUri = logoAsset.coin.logoDataUri ?? undefined;
      if (!logoDataUri) {
        console.warn("CoinGecko did not return the Dogecoin logo; using plain DOGE typography.");
      }
    } catch (error) {
      console.warn(
        `Could not refresh the optional Dogecoin logo asset; using plain DOGE typography: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const result = await renderPremiumDynamicFinanceV1_1FullSceneVideo({
      plan,
      planPath: options.jsonPath,
      outputPath: options.outputPath,
      ...(logoDataUri ? { logoDataUri } : {}),
    });
    console.log(JSON.stringify({
      mode: "FULL_SCENE_RENDER",
      scenes: plan.events.length,
      durationMs: result.durationMs,
      outputPath: result.outputPath,
      reportPath: result.reportPath,
      bytes: result.bytes,
      factualSnapshotAt: plan.dataAsOf,
      marketDataRefreshed: false,
      telegramOrProductionTouched: false,
    }, null, 2));
    return;
  }
  const result = await generatePremiumDynamicFinanceV1_1DogecoinVisualPlan({
    jsonPath: options.jsonPath,
    markdownPath: options.markdownPath,
  });
  console.log(JSON.stringify({
    mode: result.plan.mode,
    scenes: result.plan.events.length,
    durationSeconds: result.plan.durationMs / 1_000,
    jsonPath: result.jsonPath,
    markdownPath: result.markdownPath,
    renderStarted: false,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});