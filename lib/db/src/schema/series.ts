import { bigint, integer, jsonb, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const seriesTable = pgTable("content_series", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  title: text("title").notNull(),
  premise: text("premise").notNull(),
  city: text("city").notNull().default("Новосибирск"),
  profession: text("profession").notNull().default("курьер"),
  style: text("style").notNull().default("cinematic realistic"),
  episodeDuration: integer("episode_duration").notNull().default(90),
  episodeCount: integer("episode_count").notNull().default(8),
  locationsJson: jsonb("locations_json").notNull().default([]),
  ctaText: text("cta_text"),
  ctaUrl: text("cta_url"),
  ctaPlacement: text("cta_placement").notNull().default("ending"),
  bibleJson: jsonb("bible_json").notNull().default({}),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const seasonsTable = pgTable("content_seasons", {
  id: serial("id").primaryKey(),
  seriesId: integer("series_id").notNull().references(() => seriesTable.id, { onDelete: "cascade" }),
  seasonNumber: integer("season_number").notNull().default(1),
  title: text("title").notNull(),
  planJson: jsonb("plan_json").notNull().default([]),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  seriesSeasonUnique: unique("content_seasons_series_number_unique").on(table.seriesId, table.seasonNumber),
}));

export const seriesEpisodesTable = pgTable("content_series_episodes", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").notNull().references(() => seasonsTable.id, { onDelete: "cascade" }),
  episodeNumber: integer("episode_number").notNull(),
  title: text("title").notNull(),
  synopsis: text("synopsis").notNull(),
  hook: text("hook").notNull(),
  cliffhanger: text("cliffhanger").notNull(),
  localLocation: text("local_location"),
  scriptJson: jsonb("script_json"),
  projectId: integer("project_id"),
  status: text("status").notNull().default("planned"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  seasonEpisodeUnique: unique("content_series_episodes_season_number_unique").on(table.seasonId, table.episodeNumber),
}));

export type Series = typeof seriesTable.$inferSelect;
export type Season = typeof seasonsTable.$inferSelect;
export type SeriesEpisode = typeof seriesEpisodesTable.$inferSelect;