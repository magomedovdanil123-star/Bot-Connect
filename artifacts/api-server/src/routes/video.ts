import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, videoGenerationJobsTable } from "@workspace/db";
import { retryVideoGeneration, startVideoGeneration } from "../lib/video-pipeline/service";

const router = Router();

function toApiJob(row: typeof videoGenerationJobsTable.$inferSelect) {
  return {
    id: row.id,
    project_id: row.projectId,
    topic: row.topic,
    format: row.format,
    duration: row.duration,
    style: row.style,
    tone: row.tone,
    status: row.status,
    current_stage: row.currentStage,
    progress: row.progress,
    stages: row.stages,
    subtitle_url: row.subtitleUrl,
    video_url: row.videoUrl,
    video_duration: row.videoDuration,
    error: row.error,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function projectId(req: { params: Record<string, string> }): number | null {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.post("/projects/:id/generate-video", async (req, res, next) => {
  try {
    const id = projectId(req);
    if (!id) return res.status(400).json({ error: "Invalid project id" });
    const input = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
    const job = await startVideoGeneration(id, {
      format: typeof input.format === "string" ? input.format : undefined,
      duration: typeof input.duration === "number" ? input.duration : undefined,
      style: typeof input.style === "string" ? input.style : undefined,
      tone: typeof input.tone === "string" ? input.tone : undefined,
    });
    return res.status(202).json(toApiJob(job));
  } catch (error) {
    if (error instanceof Error && error.message.includes("already running")) {
      return res.status(409).json({ error: error.message });
    }
    return next(error);
  }
});

router.get("/video-generation/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid video job id" });
    const [job] = await db.select().from(videoGenerationJobsTable).where(eq(videoGenerationJobsTable.id, id));
    if (!job) return res.status(404).json({ error: "Video generation job not found" });
    return res.json(toApiJob(job));
  } catch (error) { return next(error); }
});

router.get("/projects/:id/video-generation", async (req, res, next) => {
  try {
    const id = projectId(req);
    if (!id) return res.status(400).json({ error: "Invalid project id" });
    const [job] = await db.select().from(videoGenerationJobsTable)
      .where(eq(videoGenerationJobsTable.projectId, id))
      .orderBy(desc(videoGenerationJobsTable.createdAt));
    if (!job) return res.status(404).json({ error: "Video generation job not found" });
    return res.json(toApiJob(job));
  } catch (error) { return next(error); }
});

router.post("/video-generation/:id/retry", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid video job id" });
    return res.status(202).json(toApiJob(await retryVideoGeneration(id)));
  } catch (error) {
    if (error instanceof Error && error.message.includes("Only failed")) return res.status(400).json({ error: error.message });
    return next(error);
  }
});

export default router;