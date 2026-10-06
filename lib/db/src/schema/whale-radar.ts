import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

type WhaleMarketContext = {
  source: "nansen";
  timeframe: string;
  candles: Array<{
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volumeUsd: number | null;
  }>;
  changePercent: number | null;
};

type WhaleScoreBreakdown = {
  sizeScore: number;
  smartMoneyScore: number;
  unusualActivityScore: number;
  accumulationScore: number;
  marketContextScore: number;
  walletHistoryScore: number;
};

type WhaleVisualPlan = {
  format: "WHALE_RADAR_SHORTS_V1";
  source: "Nansen";
  targetDurationSeconds: number;
  aspectRatio: "9:16";
  scenes: Array<{
    id: string;
    kind: string;
    title: string;
    subtitle: string;
    visualDescription: string;
  }>;
};

type WhaleYoutubeMetadata = {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
};

export const whaleEventsTable = pgTable("whale_events", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull().unique(),
  deduplicationKey: text("deduplication_key").notNull().unique(),
  eventTimestamp: timestamp("event_timestamp", { withTimezone: true }).notNull(),
  blockchain: text("blockchain").notNull(),
  asset: text("asset").notNull(),
  symbol: text("symbol").notNull(),
  tokenAddress: text("token_address"),
  action: text("action").notNull(),
  eventType: text("event_type").notNull(),
  amount: doublePrecision("amount").notNull(),
  amountUsd: doublePrecision("amount_usd").notNull(),
  priceUsd: doublePrecision("price_usd"),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  fromLabel: text("from_label"),
  toLabel: text("to_label"),
  walletType: text("wallet_type"),
  walletLabel: text("wallet_label"),
  transactionHash: text("transaction_hash").notNull(),
  dex: text("dex"),
  exchange: text("exchange"),
  confidenceScore: integer("confidence_score").notNull(),
  whaleScore: integer("whale_score").notNull().default(0),
  scoreBreakdown: jsonb("score_breakdown").$type<WhaleScoreBreakdown>().notNull(),
  previousActivity: jsonb("previous_activity").$type<Array<{
    transactionHash: string;
    action: string;
    amountUsd: number;
    timestamp: string;
  }>>().notNull().default([]),
  marketContext: jsonb("market_context").$type<WhaleMarketContext | null>(),
  dataSources: jsonb("data_sources").$type<string[]>().notNull().default(["nansen"]),
  rawData: jsonb("raw_data").$type<unknown>().notNull(),
  passedSignificance: boolean("passed_significance").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const whaleTransactionsTable = pgTable("whale_transactions", {
  id: serial("id").primaryKey(),
  blockchain: text("blockchain").notNull(),
  transactionHash: text("transaction_hash").notNull(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
  source: text("source").notNull(),
  rawData: jsonb("raw_data").$type<unknown>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("whale_transactions_chain_hash_uidx").on(table.blockchain, table.transactionHash),
]);

export const whaleWalletsTable = pgTable("whale_wallets", {
  id: serial("id").primaryKey(),
  blockchain: text("blockchain").notNull(),
  address: text("address").notNull(),
  walletType: text("wallet_type"),
  label: text("label"),
  source: text("source").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("whale_wallets_chain_address_uidx").on(table.blockchain, table.address),
]);

export const whaleScoresTable = pgTable("whale_scores", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => whaleEventsTable.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  breakdown: jsonb("breakdown").$type<WhaleScoreBreakdown>().notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const whaleScriptsTable = pgTable("whale_scripts", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => whaleEventsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  narration: text("narration").notNull(),
  keyFacts: jsonb("key_facts").$type<string[]>().notNull(),
  visualPlan: jsonb("visual_plan").$type<WhaleVisualPlan>().notNull(),
  metadata: jsonb("metadata").$type<WhaleYoutubeMetadata>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const whaleShortsTable = pgTable("whale_shorts", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => whaleEventsTable.id, { onDelete: "cascade" }),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  status: text("status").notNull().default("queued"),
  stage: text("stage").notNull().default("queued"),
  outputStoragePath: text("output_storage_path"),
  scriptId: integer("script_id").references(() => whaleScriptsTable.id, { onDelete: "set null" }),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const whaleDataSourcesTable = pgTable("whale_data_sources", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().unique(),
  status: text("status").notNull().default("idle"),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  lastError: text("last_error"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
