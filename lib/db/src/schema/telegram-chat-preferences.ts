import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const telegramChatPreferencesTable = pgTable("telegram_chat_preferences", {
  chatId: bigint("chat_id", { mode: "number" }).primaryKey(),
  scriptInstructions: text("script_instructions"),
  voiceId: text("voice_id"),
  voiceName: text("voice_name"),
  pendingAction: text("pending_action"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});