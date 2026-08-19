import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, projectsTable, videoGenerationJobsTable } from "@workspace/db";
import {
  completeYoutubeAuthorization,
  createYoutubeAuthorizationUrl,
  uploadYoutubeShort,
  youtubeConnectionStatus,
} from "../lib/youtube";

const router = Router();

router.get("/youtube/connect", (_req, res, next) => {
  try {
    res.redirect(createYoutubeAuthorizationUrl());
  } catch (error) { next(error); }
});

router.get("/youtube/callback", async (req, res, next) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state) return res.status(400).send("YouTube authorization was cancelled.");
    const channelTitle = await completeYoutubeAuthorization(code, state);
    return res.send(`<h1>YouTube подключён</h1><p>Канал: ${channelTitle || "без названия"}</p><p>Можно закрыть это окно и вернуться в AI Content Factory.</p>`);
  } catch (error) { next(error); }
});

router.get("/youtube/status", async (_req, res, next) => {
  try { res.json(await youtubeConnectionStatus()); } catch (error) { next(error); }
});

router.post("/projects/:id/youtube-upload", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    if (!Number.isInteger(projectId) || projectId <= 0) return res.status(400).json({ error: "Invalid project id" });
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) return res.status(404).json({ error: "Project not found" });
    const [job] = await db.select().from(videoGenerationJobsTable)
      .where(eq(videoGenerationJobsTable.projectId, projectId)).orderBy(desc(videoGenerationJobsTable.createdAt));
    if (!job?.videoStoragePath || job.status !== "completed") return res.status(409).json({ error: "Готового видео для загрузки ещё нет" });
    const result = await uploadYoutubeShort({
      videoStoragePath: job.videoStoragePath,
      title: project.title,
      description: `${project.topic}\n\nСоздано в AI Content Factory.`,
      tags: ["shorts", "ai", "story"],
    });
    res.json(result);
  } catch (error) { next(error); }
});

export default router;