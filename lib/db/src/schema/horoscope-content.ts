import { bigint, boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { videoGenerationJobsTable } from "./sound-design";

export const horoscopeChannelProfilesTable = pgTable("horoscope_channel_profiles", {
  connectionId: integer("connection_id").primaryKey(),
  channelName: text("channel_name").notNull(),
  category: text("category").notNull().default("Horoscope"),
  niche: text("niche").notNull(),
  tone: text("tone").notNull(),
  topics: jsonb("topics").notNull().default([]),
  formats: jsonb("formats").notNull().default([]),
  videoLength: integer("video_length").notNull().default(45),
  hookStyle: text("hook_style").notNull(),
  targetAudience: text("target_audience").notNull(),
  visualMode: text("visual_mode").notNull().default("AUTO"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const horoscopeIdeaLibraryTable = pgTable("horoscope_idea_library", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  template: text("template").notNull(),
  format: text("format").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const horoscopeContentRunsTable = pgTable("horoscope_content_runs", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  topic: text("topic").notNull(),
  status: text("status").notNull().default("generating"),
  connectionIds: jsonb("connection_ids").notNull().default([]),
  totalCount: integer("total_count").notNull().default(0),
  completedCount: integer("completed_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  plannerMode: text("planner_mode").notNull().default("manual"),
  contentPlan: jsonb("content_plan").notNull().default([]),
  plannerAnalysis: jsonb("planner_analysis").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const horoscopeContentItemsTable = pgTable("horoscope_content_items", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull().references(() => horoscopeContentRunsTable.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  connectionId: integer("connection_id").notNull(),
  channelTitle: text("channel_title").notNull(),
  channelConfig: jsonb("channel_config").notNull().default({}),
  topic: text("topic").notNull(),
  idea: text("idea").notNull(),
  format: text("format").notNull(),
  hook: text("hook").notNull(),
  scriptJson: jsonb("script_json").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  titleVariants: jsonb("title_variants").notNull().default([]),
  keywords: jsonb("keywords").notNull().default([]),
  tags: jsonb("tags").notNull().default([]),
  hashtags: jsonb("hashtags").notNull().default([]),
  visualMode: text("visual_mode").notNull().default("AUTO"),
  visualSearchQueries: jsonb("visual_search_queries").notNull().default([]),
  visualPrompt: text("visual_prompt").notNull(),
  stockAssets: jsonb("stock_assets").notNull().default([]),
  stockStatus: text("stock_status").notNull().default("pending"),
  stockError: text("stock_error"),
  voiceoverText: text("voiceover_text").notNull(),
  bannerId: text("banner_id"),
  bannerText: text("banner_text"),
  bannerPosition: text("banner_position"),
  bannerStart: integer("banner_start"),
  bannerEnd: integer("banner_end"),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  videoJobId: integer("video_job_id").references(() => videoGenerationJobsTable.id, { onDelete: "set null" }),
  videoStatus: text("video_status").notNull().default("not_started"),
  status: text("status").notNull().default("ready"),
  contentHash: text("content_hash").notNull(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const horoscopeContentHistoryTable = pgTable("horoscope_content_history", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id"),
  channelTitle: text("channel_title").notNull(),
  topic: text("topic").notNull(),
  idea: text("idea").notNull(),
  format: text("format").notNull(),
  hook: text("hook").notNull(),
  title: text("title").notNull(),
  scriptText: text("script_text").notNull(),
  contentHash: text("content_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type HoroscopeChannelProfile = typeof horoscopeChannelProfilesTable.$inferSelect;
export type HoroscopeContentRun = typeof horoscopeContentRunsTable.$inferSelect;
export type HoroscopeContentItem = typeof horoscopeContentItemsTable.$inferSelect;