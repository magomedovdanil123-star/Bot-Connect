import { logger } from "../logger";
import { getWhaleRadarConfig } from "./config";
import { fetchSmartMoneyDexTrades, fetchTokenOhlcv, fetchTokenTransfers } from "./nansen-client";
import { attachPreviousActivity, deduplicateWhaleEvents, normalizeNansenDexTrade, normalizeNansenTransfer } from "./normalize";
import {
  recordWhaleDataSource,
  recordWhaleScore,
  recordWhaleTransaction,
  updateWhaleEventMarketContext,
  upsertWhaleEvent,
  upsertWhaleWallet,
} from "./persistence";
import { isSignificantWhaleEvent, scoreWhaleEvent } from "./scoring";
import type { WhaleEvent, WhaleMarketContext } from "./types";

export type WhaleScanResult = {
  events: WhaleEvent[];
  warnings: string[];
};

export async function scanAndPersistWhaleEvents(): Promise<WhaleScanResult> {
  const config = getWhaleRadarConfig();
  if (!config.enabled) throw new Error("Whale Radar is disabled by WHALE_RADAR_ENABLED.");
  logger.info("[WHALE RADAR] Starting user-requested Nansen Smart Money scan.");
  try {
    const rawTrades = await fetchSmartMoneyDexTrades({
      chains: config.chains,
      minimumUsd: config.minimumUsd,
      pageSize: config.pageSize,
    });
    const rangeTo = new Date();
    const rangeFrom = new Date(rangeTo.getTime() - 24 * 60 * 60 * 1_000);
    const transferResponses = await Promise.allSettled(config.transferTokens.map((item) =>
      fetchTokenTransfers({
        chain: item.chain,
        tokenAddress: item.tokenAddress,
        from: rangeFrom.toISOString(),
        to: rangeTo.toISOString(),
        pageSize: config.pageSize,
      }),
    ));
    const rawTransfers = transferResponses.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const transferErrors = transferResponses.flatMap((result) => result.status === "rejected"
      ? [result.reason instanceof Error ? result.reason.message : String(result.reason)]
      : []);
    if (transferErrors.length) {
      logger.warn({ failedQueries: transferErrors.length }, "[WHALE RADAR] Some configured Nansen transfer queries failed; DEX trades remain available.");
    }
    const normalizedTrades = rawTrades
      .map((row) => normalizeNansenDexTrade(row))
      .filter((event): event is WhaleEvent => Boolean(event));
    const normalizedTransfers = rawTransfers
      .map((row) => normalizeNansenTransfer(row))
      .filter((event): event is WhaleEvent => Boolean(event))
      .filter((event) => event.amountUsd >= config.minimumUsd);
    const normalized = [...normalizedTrades, ...normalizedTransfers]
      .filter((event) => !config.assets.length
        || config.assets.includes(event.symbol.toUpperCase())
        || Boolean(event.tokenAddress && config.assets.includes(event.tokenAddress.toUpperCase())));
    const candidates = attachPreviousActivity(deduplicateWhaleEvents(normalized))
      .filter((event) => event.amountUsd >= config.minimumUsd)
      .sort((left, right) => right.amountUsd - left.amountUsd)
      .slice(0, config.maximumEvents);
    const marketRequests = new Map<string, WhaleEvent>();
    for (const event of candidates) {
      if (event.tokenAddress) marketRequests.set(`${event.blockchain}:${event.tokenAddress}`, event);
    }
    const marketResults = await Promise.allSettled([...marketRequests.entries()].map(async ([key, event]) => {
      const context = await fetchTokenOhlcv({
        chain: event.blockchain,
        tokenAddress: event.tokenAddress!,
        from: new Date(rangeTo.getTime() - 24 * 60 * 60 * 1_000).toISOString(),
        to: rangeTo.toISOString(),
      });
      return [key, context] as const;
    }));
    const marketContextByKey = new Map<string, WhaleMarketContext>();
    const marketWarnings = marketResults.flatMap((result) => {
      if (result.status === "fulfilled") {
        marketContextByKey.set(result.value[0], result.value[1]);
        return [];
      }
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      logger.warn({ message }, "[WHALE RADAR] Optional Nansen OHLCV context unavailable.");
      return [message];
    });
    const withContext = candidates.map((event) => ({
      ...event,
      marketContext: event.tokenAddress
        ? marketContextByKey.get(`${event.blockchain}:${event.tokenAddress}`) ?? null
        : null,
    }));
    const scored = withContext
      .map((event) => scoreWhaleEvent(event, withContext, config.minimumUsd))
      .map((event) => ({
        ...event,
        passedSignificance: isSignificantWhaleEvent(event, config.minimumUsd, config.minimumScore),
      }));

    const persisted: WhaleEvent[] = [];
    for (const event of scored) {
      const saved = await upsertWhaleEvent(event);
      await Promise.all([
        recordWhaleTransaction(saved),
        upsertWhaleWallet(saved),
        recordWhaleScore(saved),
      ]);
      persisted.push(saved);
    }
    const warnings = [...transferErrors, ...marketWarnings];
    await recordWhaleDataSource({
      status: warnings.length ? "partial" : "ok",
      lastError: warnings.join(" | ") || null,
      metadata: {
        provider: "nansen",
        rawTradeCount: rawTrades.length,
        rawTransferCount: rawTransfers.length,
        configuredTransferTokenCount: config.transferTokens.length,
        normalizedCount: normalized.length,
        marketContextCount: marketContextByKey.size,
        persistedCount: persisted.length,
      },
    });
    logger.info(
      { rawTradeCount: rawTrades.length, normalizedCount: normalized.length, persistedCount: persisted.length },
      "[WHALE RADAR] Nansen scan completed.",
    );
    return {
      events: persisted.filter((event) => event.passedSignificance),
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Nansen scan error.";
    await recordWhaleDataSource({ status: "error", lastError: message }).catch((recordError) => {
      logger.error({ err: recordError }, "[WHALE RADAR] Failed to persist provider error status.");
    });
    logger.error({ err: error }, "[WHALE RADAR] Nansen scan failed.");
    throw error;
  }
}

export async function loadWhaleMarketContext(event: WhaleEvent): Promise<WhaleEvent> {
  if (!event.id || !event.tokenAddress) return event;
  if (event.marketContext?.candles.length) return event;
  const eventTime = new Date(event.timestamp).getTime();
  const from = new Date(eventTime - 12 * 60 * 60 * 1_000);
  const to = new Date(Math.min(Date.now(), eventTime + 12 * 60 * 60 * 1_000));
  if (to.getTime() <= from.getTime()) return event;
  try {
    const marketContext = await fetchTokenOhlcv({
      chain: event.blockchain,
      tokenAddress: event.tokenAddress,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    const withContext = { ...event, marketContext };
    await updateWhaleEventMarketContext(event.id, marketContext);
    logger.info(
      { eventId: event.id, candleCount: marketContext.candles.length },
      "[WHALE RADAR] Loaded Nansen OHLCV market context.",
    );
    return withContext;
  } catch (error) {
    logger.warn({ err: error, eventId: event.id }, "[WHALE RADAR] Optional OHLCV context unavailable; continuing with verified trade data.");
    return event;
  }
}
