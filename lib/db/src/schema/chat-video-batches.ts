import { bigint, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const chatVideoBatchesTable = pgTable("chat_video_batches", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  totalCount: integer("total_count").notNull(),
  currentIndex: integer("current_index").notNull().default(0),
  status: text("status").notNull().default("collecting"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const chatVideoBatchItemsTable = pgTable("chat_video_batch_items", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull().references(() => chatVideoBatchesTable.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  scriptText: text("script_text").notNull(),
  projectId: integer("project_id"),
  jobId: integer("job_id"),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ChatVideoBatch = typeof chatVideoBatchesTable.$inferSelect;
export type ChatVideoBatchItem = typeof chatVideoBatchItemsTable.$inferSelect;