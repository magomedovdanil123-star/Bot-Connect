import { jsonb, integer, pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const voiceGenerationsTable = pgTable("voice_generations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  sceneId: integer("scene_id").notNull(),
  provider: text("provider").notNull().default("elevenlabs"),
  voiceId: text("voice_id").notNull(),
  voiceName: text("voice_name"),
  modelId: text("model_id").notNull(),
  text: text("text").notNull(),
  settings: jsonb("settings").notNull().default({}),
  status: text("status").notNull().default("pending"),
  audioUrl: text("audio_url"),
  storagePath: text("storage_path"),
  duration: integer("duration"),
  fileSize: integer("file_size"),
  error: text("error"),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  startTime: integer("start_time"),
  endTime: integer("end_time"),
  isFullVoice: boolean("is_full_voice").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});