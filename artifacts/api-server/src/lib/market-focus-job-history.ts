export type MarketFocusJobReference = {
  plan: unknown;
  topic: string;
};

function marketFocusSymbolFromJob(
  plan: unknown,
  topic: string,
): string | null {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return null;
  const record = plan as Record<string, unknown>;
  if (record.visualTheme !== "market_focus_24h") return null;
  const data = record.marketFocusData;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const coin = (data as Record<string, unknown>).coin;
    if (coin && typeof coin === "object" && !Array.isArray(coin)) {
      const symbol = (coin as Record<string, unknown>).symbol;
      if (typeof symbol === "string" && symbol.trim()) return symbol.trim().toUpperCase();
    }
  }
  const normalizedTopic = topic.trim().replace(/^\$/, "").replace(/[\/-\s]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{2,20}$/.test(normalizedTopic)) return null;
  return normalizedTopic.endsWith("USDT")
    ? normalizedTopic.slice(0, -"USDT".length)
    : normalizedTopic;
}

export function collectUsedMarketFocusSymbols(
  completedJobs: MarketFocusJobReference[],
  activeJobs: MarketFocusJobReference[],
): string[] {
  const symbols = new Set<string>();
  for (const job of [...completedJobs, ...activeJobs]) {
    const symbol = marketFocusSymbolFromJob(job.plan, job.topic);
    if (symbol) symbols.add(symbol);
  }
  return [...symbols];
}