import { extractFinanceLongCoinHeader } from "../finance-long-script";
import type { CoinOverviewLongResearchData, CoinOverviewMarketData } from "../coin-overview-data";

export const FINANCE_LONG_SCRIPT_DONE_CALLBACK = "finance:long:script:done";

export type TelegramFinanceLongCustomScriptOptions = {
  authorScript: true;
  coinOverview: true;
  topicLabel: string;
  coinOverviewContext: string;
  coinContext?: {
    marketData: CoinOverviewMarketData;
    researchData: CoinOverviewLongResearchData;
  };
};

export function createTelegramFinanceLongCustomScriptOptions(
  topicLabel: string,
  coinOverviewContext: string,
  coinContext?: TelegramFinanceLongCustomScriptOptions["coinContext"],
): TelegramFinanceLongCustomScriptOptions {
  return {
    authorScript: true,
    coinOverview: true,
    topicLabel,
    coinOverviewContext,
    coinContext,
  };
}

export async function dispatchTelegramFinanceLongScriptDoneUpdate<T>(
  input: {
    callbackData?: string;
    script: string;
    coinContext?: T;
  },
  startAuthorScript: (script: string, coinContext?: T) => Promise<void>,
): Promise<"ignored" | "script-too-short" | "started"> {
  if (input.callbackData !== FINANCE_LONG_SCRIPT_DONE_CALLBACK) return "ignored";
  const narration = extractFinanceLongCoinHeader(input.script)?.narration || input.script;
  if (narration.trim().length < 50) return "script-too-short";
  await startAuthorScript(input.script, input.coinContext);
  return "started";
}