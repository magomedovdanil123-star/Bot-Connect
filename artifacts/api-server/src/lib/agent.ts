import { and, desc, eq } from "drizzle-orm";
import {
  agentProfilesTable,
  agentTaskLogsTable,
  agentTasksTable,
  db,
  type AgentTask,
} from "@workspace/db";
import { openRouterConfig } from "./openrouter-config";

export type AgentAction = "prepare_video" | "sync_youtube" | "youtube_report" | "manual";

export type AgentPlanStep = {
  id: number;
  action: AgentAction;
  title: string;
  details: string;
  topic?: string;
};

export type AgentPlan = {
  summary: string;
  risk: "low" | "medium" | "high";
  steps: AgentPlanStep[];
};

function safeText(value: unknown, fallback: string, maxLength: number): string {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function parsePlan(content: string): AgentPlan {
  const jsonText = content.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) throw new Error("Агент не вернул структурированный план.");
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
  const steps: AgentPlanStep[] = rawSteps.slice(0, 8).map((rawStep, index) => {
    const step = rawStep && typeof rawStep === "object" ? rawStep as Record<string, unknown> : {};
    const rawAction = step.action;
    const action: AgentAction = rawAction === "prepare_video"
      || rawAction === "sync_youtube"
      || rawAction === "youtube_report"
      ? rawAction
      : "manual";
    return {
      id: index + 1,
      action,
      title: safeText(step.title, action === "manual" ? "Требуется ручное действие" : "Шаг агента", 160),
      details: safeText(step.details, "Подробности не указаны.", 800),
      ...(typeof step.topic === "string" && step.topic.trim()
        ? { topic: step.topic.trim().slice(0, 2_000) }
        : {}),
    };
  });
  if (!steps.length) {
    steps.push({
      id: 1,
      action: "manual",
      title: "Уточнить задачу",
      details: "Агент не смог выделить безопасное действие. Нужно уточнить поручение.",
    });
  }
  const rawRisk = parsed.risk;
  return {
    summary: safeText(parsed.summary, "План подготовлен.", 1_000),
    risk: rawRisk === "high" || rawRisk === "medium" ? rawRisk : "low",
    steps,
  };
}

export async function getAgentProfile(chatId: number) {
  const [profile] = await db.select().from(agentProfilesTable)
    .where(eq(agentProfilesTable.chatId, chatId));
  if (profile) return profile;
  const [created] = await db.insert(agentProfilesTable).values({ chatId }).returning();
  return created;
}

export async function appendAgentMemory(chatId: number, memory: string): Promise<void> {
  const profile = await getAgentProfile(chatId);
  const nextMemory = [profile.memory, memory.trim()].filter(Boolean).join("\n").slice(-12_000);
  await db.update(agentProfilesTable).set({
    memory: nextMemory,
    updatedAt: new Date(),
  }).where(eq(agentProfilesTable.chatId, chatId));
}

export async function createAgentTask(chatId: number, instruction: string): Promise<AgentTask> {
  const profile = await getAgentProfile(chatId);
  if (!openRouterConfig.apiKey) throw new Error("OPENROUTER_API_KEY не настроен для агента.");
  const response = await fetch(openRouterConfig.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterConfig.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openRouterConfig.model,
      max_tokens: 8192,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "Ты безопасный рабочий агент внутри Telegram-бота.",
            "Составь краткий план, но не обещай действий, которых нет в списке.",
            "Доступные действия: prepare_video — подготовить черновик одного видео через существующий сценарий; sync_youtube — синхронизировать доступные YouTube-каналы; youtube_report — собрать отчёт по публикациям текущего дня; manual — шаг, который нельзя выполнить автоматически.",
            "Публикация, удаление, изменение брендинга, массовые изменения, изменение кода и развёртывание всегда относятся к manual и требуют отдельного ручного подтверждения в существующем интерфейсе.",
            "Верни только JSON без markdown: {summary:string,risk:'low'|'medium'|'high',steps:[{action:'prepare_video'|'sync_youtube'|'youtube_report'|'manual',title:string,details:string,topic?:string}]}",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `Поручение: ${instruction}`,
            profile.memory ? `Сохранённые правила пользователя:\n${profile.memory}` : "",
          ].filter(Boolean).join("\n\n"),
        },
      ],
    }),
  });
  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || `Не удалось получить план агента (${response.status})`);
  }
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Агент не вернул план.");
  const plan = parsePlan(content);
  const [task] = await db.insert(agentTasksTable).values({
    chatId,
    instruction: instruction.trim().slice(0, 12_000),
    status: "awaiting_approval",
    plan,
  }).returning();
  await logAgentTask(task.id, "plan_created", "План подготовлен и ожидает подтверждения.", { risk: plan.risk });
  return task;
}

export async function getAgentTask(chatId: number, taskId: number): Promise<AgentTask | null> {
  const [task] = await db.select().from(agentTasksTable).where(and(
    eq(agentTasksTable.id, taskId),
    eq(agentTasksTable.chatId, chatId),
  ));
  return task || null;
}

export async function listAgentTasks(chatId: number, limit = 8): Promise<AgentTask[]> {
  return db.select().from(agentTasksTable)
    .where(eq(agentTasksTable.chatId, chatId))
    .orderBy(desc(agentTasksTable.createdAt))
    .limit(limit);
}

export async function approveAgentTask(chatId: number, taskId: number): Promise<AgentTask> {
  const task = await getAgentTask(chatId, taskId);
  if (!task) throw new Error("Задача агента не найдена.");
  if (task.status !== "awaiting_approval") throw new Error("Эта задача уже обработана.");
  const [updated] = await db.update(agentTasksTable).set({
    status: "running",
    approvedAt: new Date(),
    startedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(eq(agentTasksTable.id, taskId), eq(agentTasksTable.chatId, chatId))).returning();
  await logAgentTask(taskId, "approved", "Пользователь подтвердил выполнение.");
  return updated;
}

export async function completeAgentTask(
  taskId: number,
  result: Record<string, unknown>,
): Promise<void> {
  await db.update(agentTasksTable).set({
    status: "completed",
    result,
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(agentTasksTable.id, taskId));
  await logAgentTask(taskId, "completed", "Задача завершена.", result);
}

export async function failAgentTask(taskId: number, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await db.update(agentTasksTable).set({
    status: "failed",
    error: message.slice(0, 2_000),
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(agentTasksTable.id, taskId));
  await logAgentTask(taskId, "failed", message.slice(0, 2_000));
}

export async function cancelAgentTask(chatId: number, taskId: number): Promise<void> {
  const task = await getAgentTask(chatId, taskId);
  if (!task) throw new Error("Задача агента не найдена.");
  if (task.status === "running") throw new Error("Задача уже выполняется; остановите процесс через отдельную кнопку процессов.");
  await db.update(agentTasksTable).set({
    status: "cancelled",
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(agentTasksTable.id, taskId));
  await logAgentTask(taskId, "cancelled", "Задача отменена пользователем.");
}

export async function logAgentTask(
  taskId: number,
  event: string,
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(agentTaskLogsTable).values({ taskId, event, message, metadata });
}

export function agentPlanFromTask(task: AgentTask): AgentPlan {
  return parsePlan(JSON.stringify(task.plan));
}