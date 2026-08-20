import { serial, text, timestamp } from "drizzle-orm/pg-core";

export const youtubeConnectionsTable = pgTable("youtube_connections", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id"),
  channelTitle: text("channel_title"),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type YoutubeConnection = typeof youtubeConnectionsTable.$inferSelect;