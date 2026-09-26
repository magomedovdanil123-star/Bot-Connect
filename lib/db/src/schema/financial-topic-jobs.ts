import { bigint, boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type FinancialTopicVoiceSegment = {
  storagePath: string;
  durationMs: number;
};

export const financialTopicJobsTable = pgTable("financial_topic_jobs", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  topic: text("topic").notNull(),
  category: text("category").notNull().default("finance"),
  cta: text("cta").notNull().default(""),
  status: text("status").notNull().default("queued"),
  stage: text("stage").notNull().default("planning"),
  useFreeVoice: boolean("use_free_voice").notNull().default(false),
  plan: jsonb("plan").$type<Record<string, unknown>>().notNull().default({}),
  voiceSegments: jsonb("voice_segments").$type<FinancialTopicVoiceSegment[]>().notNull().default([]),
  outputStoragePath: text("output_storage_path"),
  durationMs: integer("duration_ms"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type FinancialTopicJob = typeof financialTopicJobsTable.$inferSelect;