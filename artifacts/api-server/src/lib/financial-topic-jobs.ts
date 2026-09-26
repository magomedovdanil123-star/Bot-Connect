import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  financialTopicJobsTable,
  type FinancialTopicJob,
  type FinancialTopicVoiceSegment,
} from "@workspace/db";
import type { FinancialTopicCategory, FinancialTopicPlan } from "./financial-topic-engine";

export type FinancialTopicJobPatch = Partial<Pick<
  FinancialTopicJob,
  "status" | "stage" | "plan" | "voiceSegments" | "outputStoragePath" | "durationMs" | "error" | "completedAt"
>>;

export async function createFinancialTopicJob(
  chatId: number,
  topic: string,
  category: FinancialTopicCategory,
  cta: string,
  customScript = "",
  visualTheme?: NonNullable<FinancialTopicPlan["visualTheme"]>,
): Promise<FinancialTopicJob> {
  const [job] = await db.insert(financialTopicJobsTable).values({
    chatId,
    topic,
    category,
    cta,
    plan: {
      ...(customScript ? { inputScript: customScript } : {}),
      ...(visualTheme ? { visualTheme } : {}),
    },
    status: "queued",
    stage: "planning",
  }).returning();
  if (!job) throw new Error("Не удалось сохранить задачу финансового Shorts.");
  return job;
}

export async function getFinancialTopicJob(
  chatId: number,
  jobId: number,
): Promise<FinancialTopicJob | null> {
  const [job] = await db.select().from(financialTopicJobsTable).where(and(
    eq(financialTopicJobsTable.id, jobId),
    eq(financialTopicJobsTable.chatId, chatId),
  ));
  return job ?? null;
}

export async function listInterruptedFinancialTopicJobs(): Promise<FinancialTopicJob[]> {
  return db.select().from(financialTopicJobsTable).where(inArray(
    financialTopicJobsTable.status,
    ["queued", "running"],
  ));
}

export async function claimFinancialTopicJob(
  chatId: number,
  jobId: number,
): Promise<FinancialTopicJob | null> {
  const [job] = await db.update(financialTopicJobsTable).set({
    status: "running",
    error: null,
    updatedAt: new Date(),
  }).where(and(
    eq(financialTopicJobsTable.id, jobId),
    eq(financialTopicJobsTable.chatId, chatId),
    inArray(financialTopicJobsTable.status, ["queued", "failed"]),
  )).returning();
  return job ?? null;
}

export async function updateFinancialTopicJob(
  jobId: number,
  patch: FinancialTopicJobPatch,
): Promise<FinancialTopicJob> {
  const [job] = await db.update(financialTopicJobsTable).set({
    ...patch,
    updatedAt: new Date(),
  }).where(eq(financialTopicJobsTable.id, jobId)).returning();
  if (!job) throw new Error("Сохранённая задача финансового Shorts не найдена.");
  return job;
}

export async function saveFinancialTopicPlan(
  jobId: number,
  plan: FinancialTopicPlan,
): Promise<void> {
  await updateFinancialTopicJob(jobId, {
    plan: plan as unknown as Record<string, unknown>,
    status: "running",
    stage: "voice",
    error: null,
  });
}

export async function saveFinancialTopicVoiceSegment(
  jobId: number,
  voiceSegments: FinancialTopicVoiceSegment[],
): Promise<void> {
  await updateFinancialTopicJob(jobId, {
    voiceSegments,
    status: "running",
    stage: "voice",
  });
}

export async function failFinancialTopicJob(jobId: number, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await updateFinancialTopicJob(jobId, {
    status: "failed",
    error: message.slice(0, 2_000),
  });
}

export async function completeFinancialTopicJob(
  jobId: number,
  outputStoragePath: string,
  durationMs: number,
): Promise<void> {
  await updateFinancialTopicJob(jobId, {
    status: "completed",
    stage: "completed",
    outputStoragePath,
    durationMs,
    error: null,
    completedAt: new Date(),
  });
}