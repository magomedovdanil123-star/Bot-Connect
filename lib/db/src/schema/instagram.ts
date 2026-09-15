import { pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const instagramConnectionsTable = pgTable("instagram_connections", {
  id: serial("id").primaryKey(),
  pageId: text("page_id"),
  pageName: text("page_name"),
  instagramUserId: text("instagram_user_id").notNull(),
  username: text("username"),
  displayName: text("display_name"),
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  instagramUserUnique: unique("instagram_connections_user_unique").on(table.instagramUserId),
}));

export type InstagramConnection = typeof instagramConnectionsTable.$inferSelect;