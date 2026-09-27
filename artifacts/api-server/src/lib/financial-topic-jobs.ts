import { and, desc, eq, gte, inArray } from "drizzle-orm";
import {
  db,
  financialTopicJobsTable,
  type FinancialTopicJob,
  type FinancialTopicVoiceSegment,
} from "@workspace/db";
import type { FinancialTopicCategory, FinancialTopicPlan } from "./financial-topic-engine";
import { cryptoF2MotionFingerprintFromPlan } from "./crypto-f2-motion";
import type { MarketFocusMarketData } from "./coin-market-focus-data";
import { collectUsedMarketFocusSymbols } from "./market-focus-job-history";

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
  marketFocusData?: MarketFocusMarketData,
): Promise<FinancialTopicJob> {
  const [job] = await db.insert(financialTopicJobsTable).values({
    chatId,
    topic,
    category,
    cta,
    plan: {
      ...(customScript ? { inputScript: customScript } : {}),
      ...(visualTheme ? { visualTheme } : {}),
      ...(marketFocusData ? { marketFocusData } : {}),
    },
    status: "queued",
    stage: "planning",
  }).returning();
  if (!job) throw new Error("Не удалось сохранить задачу финансового Shorts.");
  return job;
}

export async function listUsedMarketFocusSymbols(
  chatId: number,
  dayStart: Date,
): Promise<string[]> {
  const [completedJobs, activeJobs] = await Promise.all([
    db.select({
      plan: financialTopicJobsTable.plan,
      topic: financialTopicJobsTable.topic,
    })
      .from(financialTopicJobsTable)
      .where(and(
        eq(financialTopicJobsTable.chatId, chatId),
        eq(financialTopicJobsTable.category, "crypto"),
        eq(financialTopicJobsTable.status, "completed"),
        gte(financialTopicJobsTable.completedAt, dayStart),
      )),
    db.select({
      plan: financialTopicJobsTable.plan,
      topic: financialTopicJobsTable.topic,
    })
      .from(financialTopicJobsTable)
      .where(and(
        eq(financialTopicJobsTable.chatId, chatId),
        eq(financialTopicJobsTable.category, "crypto"),
        inArray(financialTopicJobsTable.status, ["queued", "running"]),
      )),
  ]);
  return collectUsedMarketFocusSymbols(completedJobs, activeJobs);
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

export async function listRecentCryptoF2MotionFingerprints(
  chatId: number,
  limit = 8,
): Promise<string[]> {
  const safeLimit = Number.isInteger(limit) ? Math.min(20, Math.max(1, limit)) : 8;
  const rows = await db.select({ plan: financialTopicJobsTable.plan })
    .from(financialTopicJobsTable)
    .where(and(
      eq(financialTopicJobsTable.chatId, chatId),
      eq(financialTopicJobsTable.category, "crypto"),
      eq(financialTopicJobsTable.status, "completed"),
    ))
    .orderBy(desc(financialTopicJobsTable.completedAt), desc(financialTopicJobsTable.id))
    .limit(Math.min(100, safeLimit * 8));
  const fingerprints: string[] = [];
  for (const row of rows) {
    const fingerprint = cryptoF2MotionFingerprintFromPlan(row.plan);
    if (!fingerprint) continue;
    fingerprints.push(fingerprint);
    if (fingerprints.length >= safeLimit) break;
  }
  return fingerprints;
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