import { bigint, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const telegramChatPreferencesTable = pgTable("telegram_chat_preferences", {
  chatId: bigint("chat_id", { mode: "number" }).primaryKey(),
  scriptInstructions: text("script_instructions"),
  voiceId: text("voice_id"),
  voiceName: text("voice_name"),
  stylePreset: text("style_preset"),
  customStyle: text("custom_style"),
  tone: text("tone"),
  duration: integer("duration").notNull().default(60),
  pendingAction: text("pending_action"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});