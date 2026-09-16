import { bigint, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { videoGenerationJobsTable } from "./sound-design";

export const storyBatchesTable = pgTable("story_batches", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  title: text("title").notNull(),
  baseScript: text("base_script").notNull(),
  duration: integer("duration").notNull().default(60),
  backgroundStoragePath: text("background_storage_path").notNull(),
  bannerStoragePath: text("banner_storage_path"),
  bannerKind: text("banner_kind"),
  connectionIds: jsonb("connection_ids").notNull().default([]),
  status: text("status").notNull().default("collecting"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const storyBatchItemsTable = pgTable("story_batch_items", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull().references(() => storyBatchesTable.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  connectionId: integer("connection_id").notNull(),
  channelTitle: text("channel_title").notNull(),
  scriptJson: jsonb("script_json").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  tags: jsonb("tags").notNull().default([]),
  hashtags: jsonb("hashtags").notNull().default([]),
  avatarStoragePath: text("avatar_storage_path"),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  jobId: integer("job_id").references(() => videoGenerationJobsTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"),
  publishedVideoId: text("published_video_id"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const storyChannelVisualsTable = pgTable("story_channel_visuals", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull().references(() => storyBatchesTable.id, { onDelete: "cascade" }),
  connectionId: integer("connection_id").notNull(),
  sequence: integer("sequence").notNull(),
  storagePath: text("storage_path").notNull(),
  prompt: text("prompt").notNull(),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StoryBatch = typeof storyBatchesTable.$inferSelect;
export type StoryBatchItem = typeof storyBatchItemsTable.$inferSelect;
export type StoryChannelVisual = typeof storyChannelVisualsTable.$inferSelect;