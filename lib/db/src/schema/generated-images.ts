import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { z } from "zod/v4";

export const generatedImagesTable = pgTable("generated_images", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  sceneId: integer("scene_id").notNull(),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negative_prompt").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  aspectRatio: text("aspect_ratio").notNull(),
  status: text("status").notNull().default("pending"),
  imageUrl: text("image_url"),
  storagePath: text("storage_path"),
  width: integer("width"),
  height: integer("height"),
  generationTime: integer("generation_time"),
  error: text("error"),
  version: integer("version").notNull().default(1),
  isPrimary: boolean("is_primary").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGeneratedImageSchema = createInsertSchema(generatedImagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGeneratedImage = z.infer<typeof insertGeneratedImageSchema>;
export type GeneratedImage = typeof generatedImagesTable.$inferSelect;