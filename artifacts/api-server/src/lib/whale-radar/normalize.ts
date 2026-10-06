import type { NansenDexTrade, NansenTransfer } from "./nansen-client";
import type { WhaleEvent, WhaleEventType } from "./types";

const STABLECOINS = new Set([
  "USDC",
  "USDT",
  "DAI",
  "BUSD",
  "FDUSD",
  "USDE",
  "USDS",
  "USDG",
  "USD1",
  "USDD",
  "PYUSD",
  "USDP",
  "TUSD",
  "FRAX",
  "GHO",
  "LUSD",
  "CRVUSD",
  "EURC",
  "EURS",
]);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function makeEventId(chain: string, txHash: string): string {
  return `${chain}:${txHash.toLowerCase()}`;
}

function baseEvent(input: {
  chain: string;
  txHash: string;
  timestamp: string;
  asset: string;
  symbol: string;
  tokenAddress: string | null;
  action: WhaleEvent["action"];
  eventType: WhaleEventType;
  amount: number;
  amountUsd: number;
  priceUsd: number | null;
  fromAddress: string | null;
  toAddress: string | null;
  fromLabel: string | null;
  toLabel: string | null;
  walletType: string | null;
  walletLabel: string | null;
  dex?: string | null;
  exchange?: string | null;
  confidenceScore: number;
  source: string;
  rawData: unknown;
}): WhaleEvent {
  const deduplicationKey = makeEventId(input.chain, input.txHash);
  return {
    eventId: deduplicationKey,
    deduplicationKey,
    timestamp: input.timestamp,
    blockchain: input.chain,
    asset: input.asset,
    symbol: input.symbol,
    tokenAddress: input.tokenAddress,
    action: input.action,
    eventType: input.eventType,
    amount: input.amount,
    amountUsd: input.amountUsd,
    priceUsd: input.priceUsd,
    fromAddress: input.fromAddress,
    toAddress: input.toAddress,
    fromLabel: input.fromLabel,
    toLabel: input.toLabel,
    walletType: input.walletType,
    walletLabel: input.walletLabel,
    transactionHash: input.txHash,
    dex: input.dex ?? null,
    exchange: input.exchange ?? null,
    confidenceScore: input.confidenceScore,
    whaleScore: 0,
    scoreBreakdown: {
      sizeScore: 0,
      smartMoneyScore: 0,
      unusualActivityScore: 0,
      accumulationScore: 0,
      marketContextScore: 0,
      walletHistoryScore: 0,
    },
    previousActivity: [],
    marketContext: null,
    dataSources: [input.source],
    rawData: input.rawData,
    passedSignificance: false,
  };
}

export function normalizeNansenDexTrade(row: NansenDexTrade): WhaleEvent | null {
  const chain = text(row["chain"]).toLowerCase();
  const txHash = text(row["transaction_hash"]);
  const eventTimestamp = timestamp(row["block_timestamp"]);
  const trader = text(row["trader_address"]);
  const label = text(row["trader_address_label"]) || null;
  const tradeValue = positiveNumber(row["trade_value_usd"]);
  const boughtSymbol = text(row["token_bought_symbol"]).toUpperCase();
  const soldSymbol = text(row["token_sold_symbol"]).toUpperCase();
  const boughtAmount = positiveNumber(row["token_bought_amount"]);
  const soldAmount = positiveNumber(row["token_sold_amount"]);
  const boughtAddress = text(row["token_bought_address"]) || null;
  const soldAddress = text(row["token_sold_address"]) || null;
  if (!chain || !txHash || !eventTimestamp || !trader || !tradeValue) return null;

  // Treat stablecoin -> asset as a buy and asset -> stablecoin as a sell.
  // Cross-asset swaps are a buy of the received token; their other side is not inferred.
  const boughtStable = STABLECOINS.has(boughtSymbol);
  const soldStable = STABLECOINS.has(soldSymbol);
  if (boughtStable && soldStable) return null;
  const action: WhaleEvent["action"] = boughtStable ? "SELL" : "BUY";
  const symbol = boughtStable ? soldSymbol : boughtSymbol;
  const amount = boughtStable ? soldAmount : boughtAmount;
  const tokenAddress = boughtStable ? soldAddress : boughtAddress;
  if (!symbol || !amount) return null;

  return baseEvent({
    chain,
    txHash,
    timestamp: eventTimestamp,
    asset: symbol,
    symbol,
    tokenAddress,
    action,
    eventType: action === "BUY" ? "SMART_MONEY_BUY" : "SMART_MONEY_SELL",
    amount,
    amountUsd: tradeValue,
    priceUsd: tradeValue / amount,
    fromAddress: trader,
    toAddress: null,
    fromLabel: label,
    toLabel: null,
    walletType: "smart_money",
    walletLabel: label,
    dex: text(row["dex_name"]) || null,
    confidenceScore: label ? 95 : 85,
    source: "nansen",
    rawData: row,
  });
}

export function normalizeNansenTransfer(row: NansenTransfer): WhaleEvent | null {
  const chain = text(row["chain"]).toLowerCase();
  const txHash = text(row["transaction_hash"]);
  const eventTimestamp = timestamp(row["block_timestamp"]);
  const amount = positiveNumber(row["transfer_amount"]);
  const amountUsd = positiveNumber(row["transfer_value_usd"]);
  const symbol = text(row["token_symbol"] || row["token_name"]).toUpperCase();
  if (!chain || !txHash || !eventTimestamp || !amount || !amountUsd || !symbol) return null;

  const fromAddress = text(row["from_address"]) || null;
  const toAddress = text(row["to_address"]) || null;
  const fromLabel = text(row["from_address_label"]) || null;
  const toLabel = text(row["to_address_label"]) || null;
  const toExchange = /\b(exchange|cex|binance|coinbase|kraken|okx|bybit)\b/i.test(toLabel ?? "");
  const fromExchange = /\b(exchange|cex|binance|coinbase|kraken|okx|bybit)\b/i.test(fromLabel ?? "");
  const eventType: WhaleEventType = toExchange
    ? "EXCHANGE_DEPOSIT"
    : fromExchange
      ? "EXCHANGE_WITHDRAWAL"
      : "LARGE_TRANSFER";
  const transactionType = text(row["transaction_type"]);
  return baseEvent({
    chain,
    txHash,
    timestamp: eventTimestamp,
    asset: symbol,
    symbol,
    tokenAddress: text(row["token_address"]) || null,
    action: "TRANSFER",
    eventType,
    amount,
    amountUsd,
    priceUsd: amountUsd / amount,
    fromAddress,
    toAddress,
    fromLabel,
    toLabel,
    walletType: "transfer",
    walletLabel: toLabel ?? fromLabel,
    exchange: toExchange ? toLabel : fromExchange ? fromLabel : null,
    confidenceScore: transactionType ? 90 : 80,
    source: "nansen",
    rawData: row,
  });
}

export function deduplicateWhaleEvents(events: WhaleEvent[]): WhaleEvent[] {
  const unique = new Map<string, WhaleEvent>();
  for (const event of events) {
    const existing = unique.get(event.deduplicationKey);
    if (!existing) {
      unique.set(event.deduplicationKey, event);
      continue;
    }
    const preferred = event.confidenceScore > existing.confidenceScore ? event : existing;
    const sources = [...new Set([...existing.dataSources, ...event.dataSources])];
    unique.set(event.deduplicationKey, {
      ...preferred,
      dataSources: sources,
      confidenceScore: Math.max(existing.confidenceScore, event.confidenceScore),
      rawData: {
        deduplicated: true,
        sources,
        records: [existing.rawData, event.rawData],
      },
    });
  }
  return [...unique.values()];
}

export function attachPreviousActivity(events: WhaleEvent[]): WhaleEvent[] {
  return events.map((event) => {
    const history = events
      .filter((candidate) =>
        candidate.deduplicationKey !== event.deduplicationKey
        && candidate.blockchain === event.blockchain
        && candidate.asset.toUpperCase() === event.asset.toUpperCase()
        && candidate.fromAddress === event.fromAddress
        && candidate.timestamp < event.timestamp)
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(0, 5)
      .map((candidate) => ({
        transactionHash: candidate.transactionHash,
        action: candidate.action,
        amountUsd: candidate.amountUsd,
        timestamp: candidate.timestamp,
      }));
    return { ...event, previousActivity: history };
  });
}
