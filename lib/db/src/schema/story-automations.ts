import { bigint, boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const storyAutomationsTable = pgTable("story_automations", {
  chatId: bigint("chat_id", { mode: "number" }).primaryKey(),
  connectionIds: jsonb("connection_ids").notNull().default([]),
  intervalMinutes: integer("interval_minutes").notNull().default(120),
  source: text("source").notNull().default("ai"),
  privacyStatus: text("privacy_status").notNull().default("public"),
  enabled: boolean("enabled").notNull().default(false),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  activeBatchId: integer("active_batch_id"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type StoryAutomation = typeof storyAutomationsTable.$inferSelect;