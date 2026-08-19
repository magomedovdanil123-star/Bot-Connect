import { createInsertSchema } from "drizzle-zod";
import { jsonb, pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  format: text("format").notNull(),
  duration: integer("duration").notNull(),
  style: text("style").notNull(),
  tone: text("tone").notNull(),
  scriptJson: jsonb("script_json").notNull(),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;