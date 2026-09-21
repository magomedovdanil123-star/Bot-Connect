import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const horoscopeVisualLibraryTable = pgTable("horoscope_visual_library", {
  id: serial("id").primaryKey(),
  zodiacSign: text("zodiac_sign"),
  symbol: text("symbol"),
  label: text("label"),
  kind: text("kind").notNull(),
  query: text("query").notNull(),
  mediaAssetId: text("media_asset_id"),
  storageAsset: jsonb("storage_asset").notNull().default({}),
  provider: text("provider").notNull(),
  sourceId: text("source_id").notNull(),
  title: text("title").notNull(),
  sourceUrl: text("source_url").notNull(),
  downloadUrl: text("download_url").notNull(),
  creator: text("creator"),
  creatorUrl: text("creator_url"),
  license: text("license").notNull(),
  licenseUrl: text("license_url"),
  attribution: text("attribution"),
  width: integer("width"),
  height: integer("height"),
  durationSeconds: integer("duration_seconds"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  sourceKey: uniqueIndex("horoscope_visual_library_source_idx").on(
    table.kind,
    table.zodiacSign,
    table.provider,
    table.sourceId,
  ),
}));

export type HoroscopeVisualLibraryAsset = typeof horoscopeVisualLibraryTable.$inferSelect;