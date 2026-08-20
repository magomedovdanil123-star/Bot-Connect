import { bigint, integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const ctaProfilesTable = pgTable("cta_profiles", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  profession: text("profession").notNull(),
  ctaText: text("cta_text").notNull(),
  telegramUrl: text("telegram_url"),
  placement: text("placement").notNull().default("ending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  chatNameUnique: unique("cta_profiles_chat_name_unique").on(table.chatId, table.name),
}));

export type CtaProfile = typeof ctaProfilesTable.$inferSelect;