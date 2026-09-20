import { bigint, integer, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core";

export const telegramHoroscopeChannelsTable = pgTable(
  "telegram_horoscope_channels",
  {
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    connectionId: integer("connection_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    chatChannelPrimaryKey: primaryKey({
      columns: [table.chatId, table.connectionId],
    }),
  }),
);

export type TelegramHoroscopeChannel = typeof telegramHoroscopeChannelsTable.$inferSelect;