import { bigint, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { videoGenerationJobsTable } from "./sound-design";

export const chatDayBatchesTable = pgTable("chat_day_batches", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  totalCount: integer("total_count").notNull().default(5),
  intervalMinutes: integer("interval_minutes").notNull().default(180),
  currentIndex: integer("current_index").notNull().default(0),
  status: text("status").notNull().default("collecting"),
  baseScript: text("base_script").notNull(),
  connectionIds: jsonb("connection_ids").notNull().default([]),
  privacyStatus: text("privacy_status"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const chatDayBatchItemsTable = pgTable("chat_day_batch_items", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull().references(() => chatDayBatchesTable.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  scriptText: text("script_text").notNull(),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  jobId: integer("job_id").references(() => videoGenerationJobsTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"),
  sourceVideoStoragePath: text("source_video_storage_path"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ChatDayBatch = typeof chatDayBatchesTable.$inferSelect;
export type ChatDayBatchItem = typeof chatDayBatchItemsTable.$inferSelect;