import {
  generatePremiumDynamicFinanceV1_1DogecoinVisualPlan,
  parsePremiumDynamicFinanceV1_1PilotArgs,
  premiumDynamicFinanceV1_1PilotUsage,
} from "./premium-dynamic-finance-v1-1-pilot";

async function main(): Promise<void> {
  const options = parsePremiumDynamicFinanceV1_1PilotArgs(process.argv.slice(2));
  if (options.help) {
    console.log(premiumDynamicFinanceV1_1PilotUsage());
    return;
  }
  const result = await generatePremiumDynamicFinanceV1_1DogecoinVisualPlan(options);
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