import { db, whaleDataSourcesTable, whaleEventsTable, whaleScoresTable, whaleScriptsTable, whaleShortsTable, whaleTransactionsTable, whaleWalletsTable } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import type { WhaleEvent, WhaleStory, WhaleVisualPlan, WhaleYoutubeMetadata } from "./types";

function toWhaleEvent(row: typeof whaleEventsTable.$inferSelect): WhaleEvent {
  return {
    id: row.id,
    eventId: row.eventId,
    deduplicationKey: row.deduplicationKey,
    timestamp: row.eventTimestamp.toISOString(),
    blockchain: row.blockchain,
    asset: row.asset,
    symbol: row.symbol,
    tokenAddress: row.tokenAddress,
    action: row.action as WhaleEvent["action"],
    eventType: row.eventType as WhaleEvent["eventType"],
    amount: row.amount,
    amountUsd: row.amountUsd,
    priceUsd: row.priceUsd,
    fromAddress: row.fromAddress,
    toAddress: row.toAddress,
    fromLabel: row.fromLabel,
    toLabel: row.toLabel,
    walletType: row.walletType,
    walletLabel: row.walletLabel,
    transactionHash: row.transactionHash,
    dex: row.dex,
    exchange: row.exchange,
    confidenceScore: row.confidenceScore,
    whaleScore: row.whaleScore,
    scoreBreakdown: row.scoreBreakdown,
    previousActivity: row.previousActivity as WhaleEvent["previousActivity"],
    marketContext: row.marketContext,
    dataSources: row.dataSources,
    rawData: row.rawData,
    passedSignificance: row.passedSignificance,
  };
}

export async function upsertWhaleEvent(event: WhaleEvent): Promise<WhaleEvent> {
  const values = {
    eventId: event.eventId,
    deduplicationKey: event.deduplicationKey,
    eventTimestamp: new Date(event.timestamp),
    blockchain: event.blockchain,
    asset: event.asset,
    symbol: event.symbol,
    tokenAddress: event.tokenAddress,
    action: event.action,
    eventType: event.eventType,
    amount: event.amount,
    amountUsd: event.amountUsd,
    priceUsd: event.priceUsd,
    fromAddress: event.fromAddress,
    toAddress: event.toAddress,
    fromLabel: event.fromLabel,
    toLabel: event.toLabel,
    walletType: event.walletType,
    walletLabel: event.walletLabel,
    transactionHash: event.transactionHash,
    dex: event.dex,
    exchange: event.exchange,
    confidenceScore: event.confidenceScore,
    whaleScore: event.whaleScore,
    scoreBreakdown: event.scoreBreakdown,
    previousActivity: event.previousActivity,
    marketContext: event.marketContext,
    dataSources: event.dataSources,
    rawData: event.rawData,
    passedSignificance: event.passedSignificance,
  };
  const [row] = await db.insert(whaleEventsTable)
    .values(values)
    .onConflictDoUpdate({
      target: whaleEventsTable.deduplicationKey,
      set: {
        whaleScore: event.whaleScore,
        scoreBreakdown: event.scoreBreakdown,
        previousActivity: event.previousActivity,
        marketContext: event.marketContext,
        dataSources: event.dataSources,
        rawData: event.rawData,
        passedSignificance: event.passedSignificance,
      },
    })
    .returning();
  if (!row) throw new Error("Whale event could not be persisted.");
  return toWhaleEvent(row);
}

export async function recordWhaleTransaction(event: WhaleEvent): Promise<void> {
  await db.insert(whaleTransactionsTable)
    .values({
      blockchain: event.blockchain,
      transactionHash: event.transactionHash,
      firstSeenAt: new Date(event.timestamp),
      source: event.dataSources.join(","),
      rawData: event.rawData,
    })
    .onConflictDoUpdate({
      target: [whaleTransactionsTable.blockchain, whaleTransactionsTable.transactionHash],
      set: { rawData: event.rawData, source: event.dataSources.join(",") },
    });
}

export async function upsertWhaleWallet(event: WhaleEvent): Promise<void> {
  const address = event.fromAddress ?? event.toAddress;
  if (!address) return;
  await db.insert(whaleWalletsTable)
    .values({
      blockchain: event.blockchain,
      address,
      walletType: event.walletType,
      label: event.walletLabel,
      source: event.dataSources.join(","),
      details: { confidenceScore: event.confidenceScore },
      firstSeenAt: new Date(event.timestamp),
      lastSeenAt: new Date(event.timestamp),
    })
    .onConflictDoUpdate({
      target: [whaleWalletsTable.blockchain, whaleWalletsTable.address],
      set: {
        walletType: event.walletType,
        label: event.walletLabel,
        source: event.dataSources.join(","),
        lastSeenAt: new Date(event.timestamp),
      },
    });
}

export async function recordWhaleScore(event: WhaleEvent): Promise<void> {
  if (!event.id) return;
  await db.insert(whaleScoresTable).values({
    eventId: event.id,
    score: event.whaleScore,
    breakdown: event.scoreBreakdown,
  });
}

export async function getWhaleEvent(id: number): Promise<WhaleEvent | null> {
  const [row] = await db.select().from(whaleEventsTable).where(eq(whaleEventsTable.id, id)).limit(1);
  return row ? toWhaleEvent(row) : null;
}

export async function listWhaleEvents(options: {
  minimumScore?: number;
  minimumUsd?: number;
  limit?: number;
} = {}): Promise<WhaleEvent[]> {
  const conditions = [];
  if (options.minimumScore !== undefined) conditions.push(gte(whaleEventsTable.whaleScore, options.minimumScore));
  if (options.minimumUsd !== undefined) conditions.push(gte(whaleEventsTable.amountUsd, options.minimumUsd));
  conditions.push(gte(whaleEventsTable.eventTimestamp, new Date(Date.now() - 24 * 60 * 60 * 1_000)));
  const rows = await db.select()
    .from(whaleEventsTable)
    .where(and(...conditions))
    .orderBy(desc(whaleEventsTable.whaleScore), desc(whaleEventsTable.amountUsd))
    .limit(options.limit ?? 10);
  return rows.map(toWhaleEvent);
}

export async function updateWhaleEventMarketContext(
  id: number,
  marketContext: WhaleEvent["marketContext"],
  scoredEvent?: WhaleEvent,
): Promise<void> {
  await db.update(whaleEventsTable)
    .set({
      marketContext,
      ...(scoredEvent ? {
        whaleScore: scoredEvent.whaleScore,
        scoreBreakdown: scoredEvent.scoreBreakdown,
        passedSignificance: scoredEvent.passedSignificance,
      } : {}),
    })
    .where(eq(whaleEventsTable.id, id));
}

export async function saveWhaleScript(input: {
  eventId: number;
  story: WhaleStory;
  visualPlan: WhaleVisualPlan;
  metadata: WhaleYoutubeMetadata;
}): Promise<number> {
  const [row] = await db.insert(whaleScriptsTable).values({
    eventId: input.eventId,
    title: input.story.title,
    narration: input.story.narration,
    keyFacts: input.story.keyFacts,
    visualPlan: input.visualPlan,
    metadata: input.metadata,
  }).returning({ id: whaleScriptsTable.id });
  if (!row) throw new Error("Whale short script could not be saved.");
  return row.id;
}

export async function updateWhaleScriptVisualPlan(
  id: number,
  visualPlan: WhaleVisualPlan,
): Promise<void> {
  await db.update(whaleScriptsTable).set({ visualPlan }).where(eq(whaleScriptsTable.id, id));
}

export async function createWhaleShortJob(eventId: number, chatId: number): Promise<number> {
  const [row] = await db.insert(whaleShortsTable)
    .values({ eventId, chatId, status: "queued", stage: "queued" })
    .returning({ id: whaleShortsTable.id });
  if (!row) throw new Error("Whale short job could not be created.");
  return row.id;
}

export async function getWhaleShortJob(id: number): Promise<{
  id: number;
  eventId: number;
  chatId: number;
  status: string;
  stage: string;
  outputStoragePath: string | null;
  error: string | null;
} | null> {
  const [row] = await db.select().from(whaleShortsTable).where(eq(whaleShortsTable.id, id)).limit(1);
  return row ?? null;
}

export async function updateWhaleShortJob(
  id: number,
  update: Partial<{
    status: string;
    stage: string;
    outputStoragePath: string | null;
    scriptId: number | null;
    error: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
  }>,
): Promise<void> {
  await db.update(whaleShortsTable)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(whaleShortsTable.id, id));
}

export async function recordWhaleDataSource(input: {
  status: string;
  lastError?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(whaleDataSourcesTable)
    .values({
      provider: "nansen",
      status: input.status,
      lastFetchedAt: input.status === "ok" || input.status === "partial" ? new Date() : null,
      lastError: input.lastError ?? null,
      metadata: input.metadata ?? {},
    })
    .onConflictDoUpdate({
      target: whaleDataSourcesTable.provider,
      set: {
        status: input.status,
        ...(input.status === "ok" || input.status === "partial" ? { lastFetchedAt: new Date() } : {}),
        lastError: input.lastError ?? null,
        metadata: input.metadata ?? {},
        updatedAt: new Date(),
      },
    });
}
