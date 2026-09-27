import { and, eq } from "drizzle-orm";
import {
  db,
  financialTopicJobsTable,
  projectsTable,
  videoGenerationJobsTable,
} from "@workspace/db";
import type { YoutubeMetadata } from "./youtube";

export type YoutubePublicationDraftRef =
  | { kind: "project"; jobId: number }
  | { kind: "financial"; jobId: number };

export type YoutubePublicationDraft = {
  state: "ready" | "publishing" | "published" | "failed" | "cancelled";
  topic: string;
  videoStoragePath: string;
  metadata: YoutubeMetadata;
  selectedConnectionId?: number;
  videoId?: string;
  error?: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}


function isYoutubeMetadata(value: unknown): value is YoutubeMetadata {
  if (!isRecord(value)) return false;
  return typeof value.title === "string"
    && typeof value.description === "string"
    && Array.isArray(value.tags)
    && value.tags.every((tag) => typeof tag === "string")
    && Array.isArray(value.hashtags)
    && value.hashtags.every((tag) => typeof tag === "string");
}

function parseDraft(value: unknown): YoutubePublicationDraft | null {
  if (!isRecord(value) || !isYoutubeMetadata(value.metadata)) return null;
  if (
    (value.state !== "ready"
      && value.state !== "publishing"
      && value.state !== "published"
      && value.state !== "failed"
      && value.state !== "cancelled")
    || typeof value.topic !== "string"
    || typeof value.videoStoragePath !== "string"
    || typeof value.updatedAt !== "string"
  ) {
    return null;
  }
  return {
    state: value.state,
    topic: value.topic,
    videoStoragePath: value.videoStoragePath,
    metadata: value.metadata,
    ...(typeof value.selectedConnectionId === "number"
      ? { selectedConnectionId: value.selectedConnectionId }
      : {}),
    ...(typeof value.videoId === "string" ? { videoId: value.videoId } : {}),
    ...(typeof value.error === "string" ? { error: value.error } : {}),
    updatedAt: value.updatedAt,
  };
}

function projectScriptRecord(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return { ...value };
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (isRecord(parsed)) return { ...parsed };
    } catch {
      // Preserve plain-text source scripts under a namespaced key.
    }
    return { youtubeSourceScriptText: value };
  }
  return {};
}

export async function saveYoutubePublicationDraft(
  chatId: number,
  ref: YoutubePublicationDraftRef,
  draft: Omit<YoutubePublicationDraft, "updatedAt"> & { updatedAt?: string },
): Promise<YoutubePublicationDraft> {
  const savedDraft: YoutubePublicationDraft = {
    ...draft,
    updatedAt: draft.updatedAt ?? new Date().toISOString(),
  };

  if (ref.kind === "financial") {
    const [job] = await db.select({ plan: financialTopicJobsTable.plan })
      .from(financialTopicJobsTable)
      .where(and(
        eq(financialTopicJobsTable.id, ref.jobId),
        eq(financialTopicJobsTable.chatId, chatId),
      ));
    if (!job) throw new Error("Финансовая задача для SEO-публикации не найдена.");
    const plan = isRecord(job.plan) ? job.plan : {};
    await db.update(financialTopicJobsTable)
      .set({ plan: { ...plan, youtubePublication: savedDraft } })
      .where(and(
        eq(financialTopicJobsTable.id, ref.jobId),
        eq(financialTopicJobsTable.chatId, chatId),
      ));
    return savedDraft;
  }

  const [job] = await db.select({
    projectId: videoGenerationJobsTable.projectId,
  })
    .from(videoGenerationJobsTable)
    .where(and(
      eq(videoGenerationJobsTable.id, ref.jobId),
      eq(videoGenerationJobsTable.chatId, chatId),
    ));
  if (!job) throw new Error("Задача видео для SEO-публикации не найдена.");
  const [project] = await db.select({ scriptJson: projectsTable.scriptJson })
    .from(projectsTable)
    .where(eq(projectsTable.id, job.projectId));
  if (!project) throw new Error("Проект видео для SEO-публикации не найден.");

  const script = projectScriptRecord(project.scriptJson);
  const existingPublications = isRecord(script.youtubePublications)
    ? script.youtubePublications
    : {};
  await db.update(projectsTable)
    .set({
      scriptJson: {
        ...script,
        youtubePublications: {
          ...existingPublications,
          [String(ref.jobId)]: savedDraft,
        },
      },
    })
    .where(eq(projectsTable.id, job.projectId));
  return savedDraft;
}

export async function loadYoutubePublicationDraft(
  chatId: number,
  ref: YoutubePublicationDraftRef,
): Promise<{ draft: YoutubePublicationDraft; projectId: number | null } | null> {
  if (ref.kind === "financial") {
    const [job] = await db.select({ plan: financialTopicJobsTable.plan })
      .from(financialTopicJobsTable)
      .where(and(
        eq(financialTopicJobsTable.id, ref.jobId),
        eq(financialTopicJobsTable.chatId, chatId),
      ));
    if (!job || !isRecord(job.plan)) return null;
    const draft = parseDraft(job.plan.youtubePublication);
    return draft ? { draft, projectId: null } : null;
  }

  const [job] = await db.select({
    projectId: videoGenerationJobsTable.projectId,
  })
    .from(videoGenerationJobsTable)
    .where(and(
      eq(videoGenerationJobsTable.id, ref.jobId),
      eq(videoGenerationJobsTable.chatId, chatId),
    ));
  if (!job) return null;
  const [project] = await db.select({ scriptJson: projectsTable.scriptJson })
    .from(projectsTable)
    .where(eq(projectsTable.id, job.projectId));
  if (!project) return null;
  const script = projectScriptRecord(project.scriptJson);
  const publications = isRecord(script.youtubePublications) ? script.youtubePublications : {};
  const draft = parseDraft(publications[String(ref.jobId)]);
  return draft ? { draft, projectId: job.projectId } : null;
}