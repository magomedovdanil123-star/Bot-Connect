import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, projectsTable, videoGenerationJobsTable } from "@workspace/db";
import {
  completeYoutubeAuthorization,
  createYoutubeAuthorizationUrl,
  DEFAULT_YOUTUBE_COMMENT,
  uploadYoutubeShort,
  postYoutubeComment,
  listYoutubeConnections,
  youtubeConnectionStatus,
} from "../lib/youtube";

const router = Router();

router.get("/youtube/connect", (_req, res, next) => {
  try {
    res.redirect(createYoutubeAuthorizationUrl());
  } catch (error) { next(error); }
});

router.get("/youtube/callback", async (req, res, next): Promise<void> => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state) {
      res.status(400).send("YouTube authorization was cancelled.");
      return;
    }
     const connection = await completeYoutubeAuthorization(code, state);
     const channelNames = connection.channels.map((channel) => channel.channelTitle || "без названия").join(", ");
     res.send(`<h1>YouTube подключён</h1><p>Доступные каналы: ${channelNames}</p><p>Подключений сохранено: ${connection.channels.length}</p><p>Вернитесь в Telegram и выберите нужный канал в разделе «Каналы».</p>`);
  } catch (error) { next(error); }
});

router.get("/youtube/status", async (_req, res, next) => {
  try { res.json(await youtubeConnectionStatus()); } catch (error) { next(error); }
});

router.get("/youtube/channels", async (_req, res, next) => {
  try {
    res.json({ channels: await listYoutubeConnections() });
  } catch (error) { next(error); }
});

router.post("/projects/:id/youtube-upload", async (req, res, next): Promise<void> => {
  try {
    const projectId = Number(req.params.id);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }
    const requestedIds = Array.isArray(req.body?.connectionIds)
      ? req.body.connectionIds
        .map((value: unknown) => typeof value === "number" ? value : Number(value))
        .filter((value: number) => Number.isInteger(value) && value > 0)
      : [];
    const connectionIds = [...new Set(requestedIds)];
    if (!connectionIds.length) {
      res.status(400).json({ error: "Выберите хотя бы один YouTube-канал перед публикацией" });
      return;
    }
    const channels = await listYoutubeConnections();
    const selectedChannels = channels.filter((channel) => connectionIds.includes(channel.id));
    if (selectedChannels.length !== connectionIds.length) {
      res.status(400).json({ error: "Один или несколько выбранных YouTube-каналов больше не подключены" });
      return;
    }
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const [job] = await db.select().from(videoGenerationJobsTable)
      .where(eq(videoGenerationJobsTable.projectId, projectId)).orderBy(desc(videoGenerationJobsTable.createdAt));
    if (!job?.videoStoragePath || job.status !== "completed") {
      res.status(409).json({ error: "Готового видео для загрузки ещё нет" });
      return;
    }
    const privacyStatus = ["private", "unlisted", "public"].includes(req.body?.privacyStatus)
      ? req.body.privacyStatus as "private" | "unlisted" | "public"
      : "private";
    const results: Array<{
      connectionId: number;
      channelTitle: string | null;
      videoId?: string;
      privacyStatus?: string;
      error?: string;
    }> = [];
    for (const channel of selectedChannels) {
      try {
        const result = await uploadYoutubeShort({
          videoStoragePath: job.videoStoragePath,
          title: project.title,
          description: `${project.topic}\n\nСоздано в AI Content Factory.`,
          tags: ["shorts", "ai", "story"],
          connectionId: channel.id,
          privacyStatus,
        });
        let commentError: string | null = null;
        try {
          await postYoutubeComment({
            videoId: result.videoId,
            connectionId: channel.id,
            text: DEFAULT_YOUTUBE_COMMENT,
          });
        } catch (error) {
          commentError = error instanceof Error ? error.message : "YouTube comment creation failed";
        }
        results.push({
          connectionId: channel.id,
          channelTitle: channel.channelTitle,
          videoId: result.videoId,
          privacyStatus: result.privacyStatus,
          ...(commentError ? { error: `Видео загружено, но комментарий не добавлен: ${commentError}` } : {}),
        });
      } catch (error) {
        results.push({
          connectionId: channel.id,
          channelTitle: channel.channelTitle,
          error: error instanceof Error ? error.message : "YouTube upload failed",
        });
      }
    }
    res.json({ results });
  } catch (error) { next(error); }
});

export default router;