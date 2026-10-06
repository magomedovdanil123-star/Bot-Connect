import { logger } from "../logger";
import { getWhaleRadarConfig } from "./config";
import { fetchSmartMoneyDexTrades, fetchTokenOhlcv } from "./nansen-client";
import { attachPreviousActivity, deduplicateWhaleEvents, normalizeNansenDexTrade } from "./normalize";
import {
  getWhaleDataSourceState,
  listWhaleEvents,
  recordWhaleDataSource,
  recordWhaleScore,
  recordWhaleTransaction,
  updateWhaleEventMarketContext,
  upsertWhaleEvent,
  upsertWhaleWallet,
} from "./persistence";
import { isSignificantWhaleEvent, scoreWhaleEvent } from "./scoring";
import { getNansenScanReuseReason } from "./scan-budget";
import type { WhaleEvent } from "./types";

export type WhaleScanResult = {
  events: WhaleEvent[];
  warnings: string[];
  reusedRecentScan: boolean;
  reuseReason?: ReturnType<typeof getNansenScanReuseReason>;
};

let activeScan: Promise<WhaleScanResult> | null = null;

export function scanAndPersistWhaleEvents(): Promise<WhaleScanResult> {
  if (activeScan) return activeScan;
  const scan = runWhaleScan();
  activeScan = scan;
  void scan.then(
    () => {
      if (activeScan === scan) activeScan = null;
    },
    () => {
      if (activeScan === scan) activeScan = null;
    },
  );
  return scan;
}

async function runWhaleScan(): Promise<WhaleScanResult> {
  const config = getWhaleRadarConfig();
  if (!config.enabled) throw new Error("Whale Radar is disabled by WHALE_RADAR_ENABLED.");
  const sourceState = await getWhaleDataSourceState();
  const metadata = sourceState?.metadata ?? {};
  const lastAttemptValue = metadata["lastAttemptAt"];
  const lastAttemptAt = typeof lastAttemptValue === "string" ? lastAttemptValue : null;
  const reuseReason = getNansenScanReuseReason(sourceState
    ? {
      status: sourceState.status,
      lastFetchedAt: sourceState.lastFetchedAt,
      lastError: sourceState.lastError,
      lastAttemptAt,
    }
    : null);
  if (reuseReason) {
    const scanStartedAt = sourceState?.lastFetchedAt
      ? new Date(sourceState.lastFetchedAt.getTime() - 24 * 60 * 60 * 1_000)
      : undefined;
    const events = await listWhaleEvents({
      minimumScore: config.minimumScore,
      minimumUsd: config.minimumUsd,
      limit: config.maximumEvents,
      ...(scanStartedAt ? { since: scanStartedAt } : {}),
      smartMoneyOnly: true,
    });
    const warnings = reuseReason === "credits_exhausted"
      ? ["Предыдущий запрос Nansen сообщил о нехватке кредитов; новый запрос не отправлялся до следующего UTC-дня."]
      : [];
    logger.info({ reuseReason, eventCount: events.length }, "[WHALE RADAR] Reusing the recent Nansen scan.");
    return {
      events: events.filter((event) => event.passedSignificance),
      warnings,
      reusedRecentScan: true,
      reuseReason,
    };
  }

  const lastAttemptAtValue = new Date().toISOString();
  await recordWhaleDataSource({
    status: "fetching",
    lastError: null,
    metadata: { lastAttemptAt: lastAttemptAtValue, provider: "nansen", scope: "smart-money-dex-trades" },
  });
  logger.info("[WHALE RADAR] Starting a quota-aware Nansen Smart Money scan.");
  try {
    const rawTrades = await fetchSmartMoneyDexTrades({
      chains: config.chains,
      minimumUsd: config.minimumUsd,
      pageSize: config.pageSize,
    });
    const normalizedTrades = rawTrades
      .map((row) => normalizeNansenDexTrade(row))
      .filter((event): event is WhaleEvent => Boolean(event));
    const normalized = normalizedTrades
      .filter((event) => !config.assets.length
        || config.assets.includes(event.symbol.toUpperCase())
        || Boolean(event.tokenAddress && config.assets.includes(event.tokenAddress.toUpperCase())));
    const candidates = attachPreviousActivity(deduplicateWhaleEvents(normalized))
      .filter((event) => event.amountUsd >= config.minimumUsd)
      .sort((left, right) => right.amountUsd - left.amountUsd)
      .slice(0, config.maximumEvents);
    const scored = candidates
      .map((event) => scoreWhaleEvent(event, candidates, config.minimumUsd))
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
    await recordWhaleDataSource({
      status: "ok",
      lastError: null,
      metadata: {
        provider: "nansen",
        scope: "smart-money-dex-trades",
        lastAttemptAt: lastAttemptAtValue,
        smartMoneyLabelsRequired: true,
        rawTradeCount: rawTrades.length,
        normalizedCount: normalized.length,
        persistedCount: persisted.length,
      },
    });
    logger.info(
      { rawTradeCount: rawTrades.length, normalizedCount: normalized.length, persistedCount: persisted.length },
      "[WHALE RADAR] Nansen Smart Money scan completed.",
    );
    return {
      events: persisted.filter((event) => event.passedSignificance),
      warnings: [],
      reusedRecentScan: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Nansen scan error.";
    await recordWhaleDataSource({
      status: "error",
      lastError: message,
      metadata: {
        provider: "nansen",
        scope: "smart-money-dex-trades",
        lastAttemptAt: lastAttemptAtValue,
      },
    }).catch((recordError) => {
      logger.error({ err: recordError }, "[WHALE RADAR] Failed to persist provider error status.");
    });
    logger.error({ err: error }, "[WHALE RADAR] Nansen Smart Money scan failed.");
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
