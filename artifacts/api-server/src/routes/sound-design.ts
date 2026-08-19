import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import { Router, raw, type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  audioMixesTable,
  db,
  musicTracksTable,
  projectMusicTable,
  projectSoundEffectsTable,
  soundDesignPlansTable,
  soundEffectsTable,
} from "@workspace/db";
import {
  DeleteProjectMusicParams,
  DeleteProjectSoundDesignParams,
  GenerateSoundDesignParams,
  GetMusicParams,
  GetProjectSoundDesignParams,
  ListMusicQueryParams,
  ListProjectMusicParams,
  ListSoundEffectsQueryParams,
  MixProjectSoundDesignParams,
  PreviewMusicParams,
  RecommendProjectMusicParams,
  SearchMusicBody,
  SearchSoundEffectsBody,
  SelectProjectMusicBody,
  SelectProjectMusicParams,
  UpdateProjectMusicBody,
  UpdateProjectMusicParams,
  UploadProjectMusicHeader,
  UploadProjectMusicParams,
} from "@workspace/api-zod";
import { audioUrl, deleteAudioAsset, storeAudioAsset } from "../lib/audio-design/storage";
import { musicProvider, sfxProvider } from "../lib/audio-design/openverse-provider";
import { AudioProjectLockLostError, withAudioProjectFence, withAudioProjectLock } from "../lib/audio-design/lock";
import { removeSoundDesign, selectMusic, startAudioMix, startSoundDesign } from "../lib/audio-design/service";
import type { AudioAsset } from "../lib/audio-design/types";

const execFileAsync = promisify(execFile);
export const soundDesignRouter = Router();

const assetResponse = (asset: AudioAsset) => ({
  provider: asset.provider,
  external_id: asset.externalId,
  title: asset.title,
  creator: asset.creator,
  source_url: asset.sourceUrl,
  preview_url: asset.previewUrl,
  download_url: asset.downloadUrl,
  license: asset.license,
  license_url: asset.licenseUrl,
  requires_attribution: asset.requiresAttribution,
  duration: asset.duration,
  category: asset.category,
  metadata: asset.metadata,
});

async function listProjectMusic(projectId: number) {
  const rows = await db.select({ assignment: projectMusicTable, track: musicTracksTable })
    .from(projectMusicTable)
    .leftJoin(musicTracksTable, eq(projectMusicTable.musicTrackId, musicTracksTable.id))
    .where(eq(projectMusicTable.projectId, projectId))
    .orderBy(desc(projectMusicTable.createdAt));
  return rows.map(({ assignment: row, track }) => ({
    id: row.id,
    project_id: row.projectId,
    music_track_id: row.musicTrackId,
    source: row.source,
    title: track?.title || row.originalName,
    artist: track?.artist || null,
    source_url: track?.sourceUrl || null,
    license: track?.license || "unknown",
    license_url: track?.licenseUrl || null,
    requires_attribution: track?.requiresAttribution ?? true,
    audio_url: row.audioUrl,
    storage_path: row.storagePath,
    volume: row.volume,
    fade_in: row.fadeIn,
    fade_out: row.fadeOut,
    loop: row.loop,
    ducking: row.ducking,
    start_time: row.startTime,
    duration: row.duration,
    is_active: row.isActive,
    status: row.status,
    error: row.error,
  }));
}

soundDesignRouter.get("/music", async (req, res, next) => {
  try {
    const query = ListMusicQueryParams.parse(req.query);
    res.json((await musicProvider.search({ query: query.query, category: "instrumental music", limit: 12 })).map(assetResponse));
  } catch (error) { next(error); }
});

soundDesignRouter.post("/music/search", async (req, res, next) => {
  try {
    const input = SearchMusicBody.parse(req.body);
    res.json((await musicProvider.search(input)).map(assetResponse));
  } catch (error) { next(error); }
});

soundDesignRouter.get("/music/:id", async (req, res, next) => {
  try {
    const { id } = GetMusicParams.parse(req.params);
    res.json(assetResponse(await musicProvider.getTrack(id)));
  } catch (error) { next(error); }
});

soundDesignRouter.get("/music/:id/preview", async (req, res, next) => {
  try {
    const { id } = PreviewMusicParams.parse(req.params);
    const preview = await musicProvider.getPreview(id);
    if (!preview) return res.status(404).json({ error: "Preview not available" });
    return res.redirect(302, preview);
  } catch (error) { next(error); }
});

soundDesignRouter.get("/sound-effects", async (req, res, next) => {
  try {
    const query = ListSoundEffectsQueryParams.parse(req.query);
    res.json((await sfxProvider.search({ query: query.query, category: "sound effect", limit: 12 })).map(assetResponse));
  } catch (error) { next(error); }
});

soundDesignRouter.post("/sound-effects/search", async (req, res, next) => {
  try {
    const input = SearchSoundEffectsBody.parse(req.body);
    res.json((await sfxProvider.search(input)).map(assetResponse));
  } catch (error) { next(error); }
});

soundDesignRouter.post("/projects/:id/music/recommend", async (req, res, next) => {
  try {
    const { id } = RecommendProjectMusicParams.parse(req.params);
    const jobId = await startSoundDesign(id);
    res.status(202).json({ id: jobId, project_id: id, status: "pending" });
  } catch (error) { next(error); }
});

soundDesignRouter.post("/projects/:id/music/select", async (req, res, next) => {
  try {
    const { id } = SelectProjectMusicParams.parse(req.params);
    const input = SelectProjectMusicBody.parse(req.body);
    const selected = await selectMusic(id, input.external_id, {
      volume: input.settings?.volume,
      fadeIn: input.settings?.fade_in,
      fadeOut: input.settings?.fade_out,
      loop: input.settings?.loop,
      ducking: input.settings?.ducking,
      startTime: input.start_time,
      replaceExisting: input.replace_existing,
    });
    res.status(201).json((await listProjectMusic(id)).find((item) => item.id === selected.id));
  } catch (error) { next(error); }
});

soundDesignRouter.get("/projects/:id/music", async (req, res, next) => {
  try {
    const { id } = ListProjectMusicParams.parse(req.params);
    res.json(await listProjectMusic(id));
  } catch (error) { next(error); }
});

soundDesignRouter.post("/projects/:id/music/update", async (req, res, next) => {
  try {
    const { id } = UpdateProjectMusicParams.parse(req.params);
    const input = UpdateProjectMusicBody.parse(req.body);
    const updated = await withAudioProjectLock(id, "music-update", async (ownerId) => {
      const activeId = await withAudioProjectFence(id, ownerId, async (tx) => {
        const [active] = await tx.select().from(projectMusicTable).where(and(
          eq(projectMusicTable.projectId, id),
          eq(projectMusicTable.isActive, true),
        )).orderBy(desc(projectMusicTable.createdAt));
        if (!active) return undefined;
        await tx.update(projectMusicTable).set({
          volume: input.volume,
          fadeIn: input.fade_in,
          fadeOut: input.fade_out,
          loop: input.loop,
          ducking: input.ducking,
          updatedAt: new Date(),
        }).where(eq(projectMusicTable.id, active.id));
        return active.id;
      });
      if (!activeId) return undefined;
      return (await listProjectMusic(id)).find((item) => item.id === activeId);
    });
    if (!updated) return res.status(404).json({ error: "Project music not found" });
    return res.json(updated);
  } catch (error) { return next(error); }
});

soundDesignRouter.delete("/projects/:id/music", async (req, res, next) => {
  try {
    const { id } = DeleteProjectMusicParams.parse(req.params);
    await withAudioProjectLock(id, "music-delete", async (ownerId) => {
      const rows = await db.select().from(projectMusicTable).where(eq(projectMusicTable.projectId, id));
      await withAudioProjectFence(id, ownerId, (tx) =>
        tx.delete(projectMusicTable).where(eq(projectMusicTable.projectId, id))
      );
      await Promise.all(rows.map((row) => deleteAudioAsset(row.storagePath).catch(() => undefined)));
    });
    res.status(204).end();
  } catch (error) { next(error); }
});

soundDesignRouter.post(
  "/projects/:id/music/upload",
  raw({ type: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a"], limit: "50mb" }),
  async (req, res, next) => {
    try {
      const { id } = UploadProjectMusicParams.parse(req.params);
      const headers = UploadProjectMusicHeader.parse(req.headers);
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: "Audio file is required" });
      const extension = extname(headers["x-file-name"]).toLowerCase();
      if (![".mp3", ".wav", ".m4a"].includes(extension)) return res.status(400).json({ error: "Only MP3, WAV and M4A are supported" });
      const dir = await mkdtemp(join(tmpdir(), "audio-upload-"));
      try {
        const input = join(dir, `input${extension}`);
        await writeFile(input, req.body);
        const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type", "-of", "csv=p=0", input]);
        if (!stdout.includes("audio")) return res.status(400).json({ error: "Uploaded file is not valid audio" });
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
      const uploaded = await withAudioProjectLock(id, "music-upload", async (ownerId) => {
        const storagePath = await storeAudioAsset(req.body, "music", req.headers["content-type"] || "audio/mpeg", extension.slice(1));
        try {
          const result = await withAudioProjectFence(id, ownerId, async (tx) => {
            const previous = await tx.select().from(projectMusicTable).where(eq(projectMusicTable.projectId, id));
            if (previous.length) {
              await tx.delete(projectMusicTable).where(inArray(projectMusicTable.id, previous.map((row) => row.id)));
            }
            const [row] = await tx.insert(projectMusicTable).values({
              projectId: id,
              source: "upload",
              originalName: headers["x-file-name"],
              storagePath,
              audioUrl: audioUrl(storagePath),
              volume: 0.12,
              fadeIn: 1000,
              fadeOut: 1500,
              loop: true,
              ducking: true,
              isActive: true,
              status: "completed",
            }).returning();
            return { row, previous };
          });
          for (const oldRow of result.previous) {
            await deleteAudioAsset(oldRow.storagePath).catch(() => undefined);
          }
          return (await listProjectMusic(id)).find((item) => item.id === result.row.id);
        } catch (error) {
          await deleteAudioAsset(storagePath).catch(() => undefined);
          throw error;
        }
      });
      return res.status(201).json(uploaded);
    } catch (error) { return next(error); }
  },
);

soundDesignRouter.post("/projects/:id/sound-design/generate", async (req, res, next) => {
  try {
    const { id } = GenerateSoundDesignParams.parse(req.params);
    const jobId = await startSoundDesign(id);
    res.status(202).json({ id: jobId, project_id: id, status: "pending" });
  } catch (error) { next(error); }
});

soundDesignRouter.get("/projects/:id/sound-design", async (req, res, next) => {
  try {
    const { id } = GetProjectSoundDesignParams.parse(req.params);
    const job = (await db.select().from(soundDesignPlansTable).where(eq(soundDesignPlansTable.projectId, id)).orderBy(desc(soundDesignPlansTable.createdAt)))[0] || null;
    const sfx = await db.select({ assignment: projectSoundEffectsTable, effect: soundEffectsTable })
      .from(projectSoundEffectsTable)
      .leftJoin(soundEffectsTable, eq(projectSoundEffectsTable.soundEffectId, soundEffectsTable.id))
      .where(eq(projectSoundEffectsTable.projectId, id))
      .orderBy(asc(projectSoundEffectsTable.startTime));
    const mixes = await db.select().from(audioMixesTable).where(eq(audioMixesTable.projectId, id)).orderBy(desc(audioMixesTable.createdAt));
    res.json({
      job: job && { id: job.id, project_id: job.projectId, status: job.status, plan: job.plan, error: job.error, created_at: job.createdAt, updated_at: job.updatedAt },
      music: await listProjectMusic(id),
      sound_effects: sfx.map(({ assignment: row, effect }) => ({
        id: row.id, project_id: row.projectId, scene_id: row.sceneId, sound_effect_id: row.soundEffectId,
        kind: row.kind, title: effect?.title || null, category: effect?.category || null,
        license: effect?.license || "unknown", license_url: effect?.licenseUrl || null,
        requires_attribution: effect?.requiresAttribution ?? true, audio_url: row.audioUrl,
        start_time: row.startTime, duration: row.duration, volume: row.volume, is_active: row.isActive, status: row.status,
      })),
      mixes: mixes.map((mix) => ({
        id: mix.id, project_id: mix.projectId, status: mix.status, audio_url: mix.audioUrl,
        storage_path: mix.storagePath, duration: mix.duration, file_size: mix.fileSize,
        peak_db: mix.peakDb, error: mix.error, created_at: mix.createdAt,
      })),
    });
  } catch (error) { next(error); }
});

soundDesignRouter.post("/projects/:id/sound-design/mix", async (req, res, next) => {
  try {
    const { id } = MixProjectSoundDesignParams.parse(req.params);
    const jobId = await startAudioMix(id);
    res.status(202).json({ id: jobId, project_id: id, status: "pending" });
  } catch (error) { next(error); }
});

soundDesignRouter.delete("/projects/:id/sound-design", async (req, res, next) => {
  try {
    const { id } = DeleteProjectSoundDesignParams.parse(req.params);
    await removeSoundDesign(id);
    res.status(204).end();
  } catch (error) { next(error); }
});

soundDesignRouter.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: "Invalid request", issues: error.issues });
  }
  if (error instanceof Error && error.message === "Audio processing is already running for this project") {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof AudioProjectLockLostError) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof Error && (error.message.includes("music track is required") || error.message.includes("Transition start"))) {
    return res.status(400).json({ error: error.message });
  }
  return next(error);
});
