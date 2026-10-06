import type { WhaleMarketContext } from "./types";

const NANSEN_API_BASE = "https://api.nansen.ai";
const REQUEST_TIMEOUT_MS = 25_000;

export type NansenDexTrade = {
  chain?: unknown;
  block_timestamp?: unknown;
  transaction_hash?: unknown;
  trader_address?: unknown;
  trader_address_label?: unknown;
  token_bought_address?: unknown;
  token_bought_symbol?: unknown;
  token_bought_amount?: unknown;
  token_sold_address?: unknown;
  token_sold_symbol?: unknown;
  token_sold_amount?: unknown;
  trade_value_usd?: unknown;
  dex_name?: unknown;
  [key: string]: unknown;
};

export type NansenTransfer = {
  chain?: unknown;
  block_timestamp?: unknown;
  transaction_hash?: unknown;
  token_address?: unknown;
  token_symbol?: unknown;
  token_name?: unknown;
  transfer_amount?: unknown;
  transfer_value_usd?: unknown;
  from_address?: unknown;
  to_address?: unknown;
  from_address_label?: unknown;
  to_address_label?: unknown;
  transaction_type?: unknown;
  [key: string]: unknown;
};

type NansenFetch = typeof fetch;

function getApiKey(): string {
  const apiKey = process.env["NANSEN_API_KEY"]?.trim();
  if (!apiKey) {
    throw new Error("Nansen API is not configured. Add NANSEN_API_KEY in Replit Secrets.");
  }
  return apiKey;
}

function getDataRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record["data"])) return record["data"];
  if (record["data"] && typeof record["data"] === "object") {
    const nested = record["data"] as Record<string, unknown>;
    if (Array.isArray(nested["data"])) return nested["data"];
    if (Array.isArray(nested["items"])) return nested["items"];
  }
  return [];
}

async function postNansen<T>(
  endpoint: string,
  body: Record<string, unknown>,
  fetcher: NansenFetch = fetch,
): Promise<T> {
  const response = await fetcher(`${NANSEN_API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      apikey: getApiKey(),
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const statusHint = response.status === 401
      ? "Проверьте доступность API key."
      : response.status === 402
        ? "План Nansen не разрешает этот endpoint или исчерпан лимит."
        : response.status === 429
          ? "Nansen ограничил частоту запросов."
          : "Проверьте доступность endpoint в аккаунте Nansen.";
    let responseHint = "";
    try {
      responseHint = (await response.text()).replace(/\s+/g, " ").slice(0, 240);
    } catch {
      responseHint = "";
    }
    throw new Error(
      `Nansen ${endpoint} вернул HTTP ${response.status}. ${statusHint}${responseHint ? ` Ответ: ${responseHint}` : ""}`,
    );
  }

  return await response.json() as T;
}

export async function fetchSmartMoneyDexTrades(
  options: { chains: string[]; minimumUsd: number; pageSize: number },
  fetcher: NansenFetch = fetch,
): Promise<NansenDexTrade[]> {
  const payload = await postNansen<unknown>("/api/v1/smart-money/dex-trades", {
    chains: options.chains,
    filters: {
      include_smart_money_labels: [
        "Fund",
        "Smart Trader",
        "30D Smart Trader",
        "90D Smart Trader",
        "180D Smart Trader",
      ],
      trade_value_usd: { min: options.minimumUsd },
    },
    pagination: {
      page: 1,
      per_page: Math.min(100, Math.max(1, options.pageSize)),
    },
  }, fetcher);
  return getDataRows(payload) as NansenDexTrade[];
}

export async function fetchTokenTransfers(
  options: {
    chain: string;
    tokenAddress: string;
    from: string;
    to: string;
    pageSize?: number;
  },
  fetcher: NansenFetch = fetch,
): Promise<NansenTransfer[]> {
  const payload = await postNansen<unknown>("/api/v1/tgm/transfers", {
    chain: options.chain,
    token_address: options.tokenAddress,
    date: { from: options.from, to: options.to },
    pagination: { page: 1, per_page: Math.min(100, options.pageSize ?? 100) },
  }, fetcher);
  return getDataRows(payload) as NansenTransfer[];
}

export async function fetchTokenOhlcv(
  options: {
    chain: string;
    tokenAddress: string;
    from: string;
    to: string;
  },
  fetcher: NansenFetch = fetch,
): Promise<WhaleMarketContext> {
  const payload = await postNansen<unknown>("/api/v1/tgm/token-ohlcv", {
    chain: options.chain,
    token_address: options.tokenAddress,
    date: { from: options.from, to: options.to },
    timeframe: "1h",
  }, fetcher);
  const rows = getDataRows(payload);
  const candles = rows.flatMap((row): WhaleMarketContext["candles"] => {
    if (!row || typeof row !== "object") return [];
    const candle = row as Record<string, unknown>;
    const timestamp = String(candle["interval_start"] ?? "");
    const values = [candle["open"], candle["high"], candle["low"], candle["close"]].map(Number);
    if (!timestamp || values.some((value) => !Number.isFinite(value) || value <= 0)) return [];
    const volumeUsd = Number(candle["volume_usd"]);
    return [{
      timestamp,
      open: values[0]!,
      high: values[1]!,
      low: values[2]!,
      close: values[3]!,
      volumeUsd: Number.isFinite(volumeUsd) && volumeUsd >= 0 ? volumeUsd : null,
    }];
  });
  const first = candles[0];
  const last = candles[candles.length - 1];
  const changePercent = first && last && first.open > 0
    ? ((last.close - first.open) / first.open) * 100
    : null;
  return { source: "nansen", timeframe: "1h", candles, changePercent };
}
