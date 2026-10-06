function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCsv(value: string | undefined, fallback: string[]): string[] {
  const values = value
    ?.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return values?.length ? [...new Set(values)] : fallback;
}

export type WhaleRadarConfig = {
  enabled: boolean;
  minimumUsd: number;
  minimumScore: number;
  chains: string[];
  assets: string[];
  pageSize: number;
  maximumEvents: number;
  transferTokens: Array<{ chain: string; tokenAddress: string }>;
};

function parseTransferTokens(value: string | undefined): Array<{ chain: string; tokenAddress: string }> {
  if (!value?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("WHALE_TRANSFER_TOKENS must be a JSON array of {chain, tokenAddress} objects.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("WHALE_TRANSFER_TOKENS must be a JSON array of {chain, tokenAddress} objects.");
  }
  const tokens = parsed.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("Each WHALE_TRANSFER_TOKENS item needs chain and tokenAddress.");
    }
    const record = item as Record<string, unknown>;
    const chain = typeof record["chain"] === "string" ? record["chain"].trim().toLowerCase() : "";
    const tokenAddress = typeof record["tokenAddress"] === "string" ? record["tokenAddress"].trim() : "";
    if (!chain || !tokenAddress) {
      throw new Error("Each WHALE_TRANSFER_TOKENS item needs chain and tokenAddress.");
    }
    return { chain, tokenAddress };
  });
  return tokens.slice(0, 20);
}

export function isWhaleRadarEnabled(): boolean {
  const override = process.env["WHALE_RADAR_ENABLED"];
  if (override !== undefined) return override.trim().toLowerCase() === "true";
  return process.env["NODE_ENV"] !== "production";
}

export function getWhaleRadarConfig(): WhaleRadarConfig {
  const minimumUsd = process.env["WHALE_MIN_USD_VALUE"] ?? process.env["WHALE_MINIMUM_USD"];
  const minimumScore = process.env["WHALE_MIN_SCORE"] ?? process.env["WHALE_MINIMUM_SCORE"];
  const maximumEvents = process.env["WHALE_MAX_EVENTS"] ?? process.env["WHALE_MAXIMUM_EVENTS"];
  return {
    enabled: isWhaleRadarEnabled(),
    minimumUsd: parsePositiveNumber(minimumUsd, 100_000),
    minimumScore: Math.min(100, parsePositiveNumber(minimumScore, 60)),
    chains: parseCsv(process.env["WHALE_SUPPORTED_CHAINS"], ["ethereum", "solana"]),
    assets: parseCsv(process.env["WHALE_SUPPORTED_ASSETS"], []).map((asset) => asset.toUpperCase()),
    pageSize: Math.min(100, parsePositiveNumber(process.env["WHALE_PAGE_SIZE"], 100)),
    maximumEvents: Math.min(20, parsePositiveNumber(maximumEvents, 10)),
    transferTokens: parseTransferTokens(process.env["WHALE_TRANSFER_TOKENS"]),
  };
}
