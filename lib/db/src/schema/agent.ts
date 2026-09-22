import { bigint, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const agentProfilesTable = pgTable("agent_profiles", {
  chatId: bigint("chat_id", { mode: "number" }).primaryKey(),
  mode: text("mode").notNull().default("review_each"),
  memory: text("memory").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const agentTasksTable = pgTable("agent_tasks", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  instruction: text("instruction").notNull(),
  status: text("status").notNull().default("awaiting_approval"),
  plan: jsonb("plan").notNull().default({}),
  result: jsonb("result").notNull().default({}),
  error: text("error"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const agentTaskLogsTable = pgTable("agent_task_logs", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => agentTasksTable.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AgentProfile = typeof agentProfilesTable.$inferSelect;
export type AgentTask = typeof agentTasksTable.$inferSelect;
export type AgentTaskLog = typeof agentTaskLogsTable.$inferSelect;