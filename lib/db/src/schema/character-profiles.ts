import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const characterProfilesTable = pgTable("character_profiles", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  gender: text("gender").notNull(),
  age: text("age").notNull(),
  appearance: text("appearance").notNull(),
  hair: text("hair").notNull(),
  clothing: text("clothing").notNull(),
  accessories: text("accessories").notNull(),
  facialFeatures: text("facial_features").notNull(),
  style: text("style").notNull(),
  persistentTraits: text("persistent_traits").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  projectUnique: unique("character_profiles_project_id_unique").on(table.projectId),
}));