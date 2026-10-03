import {
  parsePremiumDynamicFinanceV1_1PilotArgs,
  premiumDynamicFinanceV1_1PilotUsage,
  renderPremiumDynamicFinanceV1_1DogecoinPilot,
} from "./premium-dynamic-finance-v1-1-pilot";

async function main(): Promise<void> {
  const options = parsePremiumDynamicFinanceV1_1PilotArgs(process.argv.slice(2));
  if (options.help) {
    console.log(premiumDynamicFinanceV1_1PilotUsage());
    return;
  }
  const result = await renderPremiumDynamicFinanceV1_1DogecoinPilot(options);
  console.log(result.report);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});