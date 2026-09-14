import { and, desc, eq, inArray } from "drizzle-orm";
import {
  audioMixesTable,
  db,
  generatedImagesTable,
  projectsTable,
  projectMusicTable,
  soundDesignPlansTable,
  videoGenerationJobsTable,
  voiceGenerationsTable,
  seasonsTable,
  seriesEpisodesTable,
  seriesTable,
} from "@workspace/db";
import { startProjectImageGeneration } from "../image-generation/service";
import { getConfiguredVoiceId, getElevenLabsModel, getSpeechProvider } from "../audio-generation/elevenlabs-client";
import { extractSpokenAuthorText, startProjectFullVoiceGeneration, startProjectVoiceGeneration } from "../audio-generation/service";
import { resetAudioProjectLock } from "../audio-design/lock";
import { startAudioMix, startSoundDesign } from "../audio-design/service";
import { loadActiveVoiceTimeline } from "../audio-design/timeline";
import { assetUrl, storeAudioAsset } from "../audio-design/storage";
import { logger } from "../logger";
import { videoScriptSchema } from "../script-generator";
import { renderVideo, storeRenderedVideo } from "./renderer";
import type { ChatRenderMessage } from "./chat-renderer";
import { linkMediaToSeries, saveMediaAsset, supabaseConfigured } from "../supabase";

export const VIDEO_STAGES = ["pending", "script", "images", "voice", "music", "sfx", "rendering", "completed", "failed"] as const;
export type VideoStage = typeof VIDEO_STAGES[number];
type StageState = { status: "pending" | "processing" | "completed" | "failed"; progress?: number; error?: string };
type StageMap = Partial<Record<VideoStage, StageState>>;
const DEFAULT_RECRUITMENT_CTA =
  "Узнай, сколько платят курьерам в твоём городе, и присоединяйся. Оплата — до 7 000 рублей за смену. Пригласи друга — работайте вместе и получи дополнительное вознаграждение. Оставляй заявку в Telegram, ссылка в шапке профиля канала.";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Video pipeline failed";
}

async function getJob(id: number) {
  const [job] = await db.select().from(videoGenerationJobsTable).where(eq(videoGenerationJobsTable.id, id));
  if (!job) throw new Error("Video generation job not found");
  return job;
}

async function updateJob(id: number, patch: Partial<typeof videoGenerationJobsTable.$inferInsert>) {
  const [job] = await db.update(videoGenerationJobsTable).set({ ...patch, updatedAt: new Date() }).where(eq(videoGenerationJobsTable.id, id)).returning();
  return job;
}

async function updateStage(id: number, stage: VideoStage, state: StageState, progress: number) {
  const job = await getJob(id);
  const stages = { ...(job.stages as StageMap), [stage]: state };
  return updateJob(id, { currentStage: stage, progress, stages });
}

async function waitFor<T>(
  load: () => Promise<{ done: boolean; value?: T; error?: string }>,
  timeoutMs = 90 * 60_000,
): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await load();
    if (result.error) throw new Error(result.error);
    if (result.done && result.value !== undefined) return result.value;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Video pipeline stage timed out");
}

async function waitForImages(projectId: number, ids: number[]) {
  return waitFor(async () => {
    const rows = await db.select().from(generatedImagesTable).where(and(
      eq(generatedImagesTable.projectId, projectId),
      inArray(generatedImagesTable.id, ids),
    ));
    const failed = rows.find((row) => row.status === "failed");
    if (failed) return { done: false, error: failed.error || `Image generation failed for scene ${failed.sceneId}` };
    const completed = rows.filter((row) => row.status === "completed").length;
    if (completed === ids.length) return { done: true, value: rows };
    return { done: false };
  });
}

async function waitForVoice(projectId: number, ids: number[]) {
  return waitFor(async () => {
    const rows = await db.select().from(voiceGenerationsTable).where(and(
      eq(voiceGenerationsTable.projectId, projectId),
      inArray(voiceGenerationsTable.id, ids),
    ));
    const failed = rows.find((row) => row.status === "failed");
    if (failed) return { done: false, error: failed.error || `Voice generation failed for scene ${failed.sceneId}` };
    const completed = rows.filter((row) => row.status === "completed").length;
    if (completed === ids.length) return { done: true, value: rows };
    return { done: false };
  });
}

async function waitForActiveVoiceTimeline(projectId: number) {
  return waitFor(async () => {
    try {
      return { done: true, value: await loadActiveVoiceTimeline(projectId, true) };
    } catch (error) {
      if (error instanceof Error && error.message === "Complete active scene voice is required") {
        return { done: false };
      }
      return { done: false, error: error instanceof Error ? error.message : "Voice timeline validation failed" };
    }
  });
}

async function waitForSoundDesign(projectId: number, jobId: number) {
  return waitFor(async () => {
    const [job] = await db.select().from(soundDesignPlansTable).where(and(
      eq(soundDesignPlansTable.id, jobId),
      eq(soundDesignPlansTable.projectId, projectId),
    ));
    if (!job) return { done: false };
    if (job.status === "failed") return { done: false, error: job.error || "Sound design failed" };
    if (job.status === "completed") return { done: true, value: job };
    return { done: false };
  });
}

async function waitForMix(projectId: number, jobId: number) {
  return waitFor(async () => {
    const [job] = await db.select().from(audioMixesTable).where(and(
      eq(audioMixesTable.id, jobId),
      eq(audioMixesTable.projectId, projectId),
    ));
    if (!job) return { done: false };
    if (job.status === "failed") return { done: false, error: job.error || "Audio mix failed" };
    if (job.status === "completed" && job.storagePath) return { done: true, value: job };
    return { done: false };
  });
}

export async function startVideoGeneration(
  projectId: number,
  options?: Partial<{ format: string; duration: number; style: string; tone: string; voiceId: string; voiceName: string }>,
) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) throw new Error("Project not found");
  if (project.status !== "completed") throw new Error("Сначала утвердите сценарий перед запуском видео");
  const [existing] = await db.select().from(videoGenerationJobsTable).where(and(
    eq(videoGenerationJobsTable.projectId, projectId),
    inArray(videoGenerationJobsTable.status, ["pending", "processing"]),
  )).orderBy(desc(videoGenerationJobsTable.createdAt));
  if (existing) throw new Error("A video generation job is already running for this project");
  const script = videoScriptSchema.parse(project.scriptJson);
  const lastScene = script.scenes.at(-1);
  if (lastScene && !script.scenes.some((scene) => scene.voice_text.includes("дополнительное вознаграждение"))) {
    lastScene.voice_text = `${lastScene.voice_text.trim()} ${DEFAULT_RECRUITMENT_CTA}`;
    await db.update(projectsTable).set({ scriptJson: script }).where(eq(projectsTable.id, projectId));
  }
  const [job] = await db.insert(videoGenerationJobsTable).values({
    projectId,
    topic: project.topic,
    format: options?.format || "9:16",
    duration: options?.duration || project.duration || 60,
    style: options?.style || project.style || "cinematic",
    tone: options?.tone || project.tone || "suspense",
    voiceId: options?.voiceId || null,
    voiceName: options?.voiceName || null,
    status: "processing",
    currentStage: "script",
    progress: 2,
    stages: { script: { status: "processing" } },
  }).returning();
  void processVideoGeneration(job.id).catch((error) => {
    logger.error({ err: error, videoJobId: job.id, projectId }, "Unhandled video pipeline failure");
  });
  return job;
}

export async function retryVideoGeneration(jobId: number) {
  const job = await getJob(jobId);
  if (job.status !== "failed") throw new Error("Only failed video jobs can be retried");
  await resetAudioProjectLock(job.projectId);
  await updateJob(jobId, { status: "processing", currentStage: "pending", progress: 0, error: null });
  void processVideoGeneration(jobId).catch((error) => {
    logger.error({ err: error, videoJobId: jobId }, "Unhandled video retry failure");
  });
  return getJob(jobId);
}

export async function rebuildVideoWithExistingAssets(projectId: number, sourceJobId: number) {
  const [sourceJob] = await db.select().from(videoGenerationJobsTable).where(and(
    eq(videoGenerationJobsTable.id, sourceJobId),
    eq(videoGenerationJobsTable.projectId, projectId),
    eq(videoGenerationJobsTable.status, "completed"),
  ));
  if (!sourceJob) throw new Error("Исходный готовый ролик не найден.");
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) throw new Error("Проект не найден.");
  const [job] = await db.insert(videoGenerationJobsTable).values({
    projectId,
    topic: project.topic,
    format: sourceJob.format || "9:16",
    duration: sourceJob.duration || project.duration || 60,
    style: sourceJob.style || project.style || "cinematic",
    tone: sourceJob.tone || project.tone || "suspense",
    voiceId: sourceJob.voiceId,
    voiceName: sourceJob.voiceName,
    status: "processing",
    currentStage: "rendering",
    progress: 74,
    stages: {
      script: { status: "completed", progress: 100 },
      images: { status: "completed", progress: 100 },
      voice: { status: "completed", progress: 100 },
      music: { status: "completed", progress: 100 },
      sfx: { status: "completed", progress: 100 },
    },
  }).returning();
  if (!job) throw new Error("Не удалось создать job пересборки.");
  void processVideoGeneration(job.id).catch((error) => {
    logger.error({ err: error, videoJobId: job.id, projectId }, "Existing-assets video rebuild failed");
  });
  return job;
}

export async function resumeInterruptedVideoJobs(): Promise<Array<{ id: number; projectId: number }>> {
  const jobs = await db.select({
    id: videoGenerationJobsTable.id,
    projectId: videoGenerationJobsTable.projectId,
  }).from(videoGenerationJobsTable)
    .where(eq(videoGenerationJobsTable.status, "processing"));

  for (const job of jobs) {
    await resetAudioProjectLock(job.projectId);
    await db.update(voiceGenerationsTable)
      .set({ status: "pending", updatedAt: new Date() })
      .where(and(
        eq(voiceGenerationsTable.projectId, job.projectId),
        eq(voiceGenerationsTable.status, "processing"),
      ));
    await db.update(generatedImagesTable)
      .set({ status: "pending", updatedAt: new Date() })
      .where(and(
        eq(generatedImagesTable.projectId, job.projectId),
        eq(generatedImagesTable.status, "processing"),
      ));
    void processVideoGeneration(job.id).catch((error) => {
      logger.error({ err: error, videoJobId: job.id }, "Unhandled interrupted video resume failure");
    });
  }

  const blockedJobs = await db.select({
    id: videoGenerationJobsTable.id,
    projectId: videoGenerationJobsTable.projectId,
  }).from(videoGenerationJobsTable)
    .where(and(
      eq(videoGenerationJobsTable.status, "failed"),
      eq(videoGenerationJobsTable.error, "Audio processing is already running for this project"),
    ));

  for (const job of blockedJobs) {
    await resetAudioProjectLock(job.projectId);
    await updateJob(job.id, {
      status: "processing",
      currentStage: "pending",
      progress: 0,
      error: null,
    });
    void processVideoGeneration(job.id).catch((error) => {
      logger.error({ err: error, videoJobId: job.id }, "Unhandled blocked video retry failure");
    });
  }

  return [...jobs, ...blockedJobs];
}

async function processVideoGeneration(jobId: number): Promise<void> {
  let stage: VideoStage = "script";
  try {
    const job = await getJob(jobId);
    const previousStages = job.stages as StageMap;
    const project = (await db.select().from(projectsTable).where(eq(projectsTable.id, job.projectId)))[0];
    if (!project) throw new Error("Project not found");
    const script = videoScriptSchema.parse(project.scriptJson);
    await updateStage(jobId, "script", { status: "completed", progress: 100 }, 10);

    stage = "images";
    await updateStage(jobId, stage, { status: "processing", progress: 0 }, 12);
    const chatMode = job.format.toLowerCase().includes("chat");
    let images = await db.select().from(generatedImagesTable).where(and(
      eq(generatedImagesTable.projectId, job.projectId),
      eq(generatedImagesTable.isPrimary, true),
      eq(generatedImagesTable.status, "completed"),
    ));
    const missingImageSceneIds = script.scenes
      .filter((scene) => !images.some((image) => image.sceneId === scene.scene_number))
      .map((scene) => scene.scene_number);
    if (!chatMode && missingImageSceneIds.length > 0) {
      const imageIds = await startProjectImageGeneration(job.projectId, {
        count: script.scenes.length,
        sceneIds: missingImageSceneIds,
         aspectRatio: job.format === "16:9" ? "16:9" : "9:16",
        visualStyle: job.style,
        realism: "high",
        people: "optional",
        colorAtmosphere: "cinematic",
        consistentCharacter: true,
      });
      images = await waitForImages(job.projectId, imageIds);
    }
    await updateStage(jobId, stage, { status: "completed", progress: 100 }, 28);

    stage = "voice";
    await updateStage(jobId, stage, { status: "processing", progress: 0 }, 30);
    const [storedVoice] = await db.select({ voiceId: voiceGenerationsTable.voiceId })
      .from(voiceGenerationsTable)
      .where(and(
        eq(voiceGenerationsTable.projectId, job.projectId),
        eq(voiceGenerationsTable.isActive, true),
        eq(voiceGenerationsTable.isFullVoice, false),
        eq(voiceGenerationsTable.status, "completed"),
      ))
      .orderBy(desc(voiceGenerationsTable.updatedAt));
    const [configuredVoice] = storedVoice?.voiceId ? [storedVoice] : await db.select({ voiceId: voiceGenerationsTable.voiceId })
      .from(voiceGenerationsTable)
      .where(and(
        eq(voiceGenerationsTable.isActive, true),
        eq(voiceGenerationsTable.isFullVoice, false),
        eq(voiceGenerationsTable.status, "completed"),
      ))
      .orderBy(desc(voiceGenerationsTable.updatedAt))
      .limit(1);
    const voiceId = job.voiceId || getConfiguredVoiceId() || configuredVoice?.voiceId;
    if (getSpeechProvider() === "elevenlabs" && !process.env["ELEVENLABS_API_KEY"]) {
      throw new Error("ElevenLabs is not configured: ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are required, or the project must have an active completed scene voice");
    }
    if (!voiceId) throw new Error("No voice is configured for the selected speech provider");
    const existingVoices = await db.select().from(voiceGenerationsTable).where(and(
      eq(voiceGenerationsTable.projectId, job.projectId),
      eq(voiceGenerationsTable.isActive, true),
      eq(voiceGenerationsTable.isFullVoice, false),
      eq(voiceGenerationsTable.status, "completed"),
    ));
    const isAuthorScript = project.topic.includes("Авторский сценарий серии.");
    if (isAuthorScript) {
      const [existingFullVoice] = await db.select({ id: voiceGenerationsTable.id })
        .from(voiceGenerationsTable)
        .where(and(
          eq(voiceGenerationsTable.projectId, job.projectId),
          eq(voiceGenerationsTable.isActive, true),
          eq(voiceGenerationsTable.isFullVoice, true),
          eq(voiceGenerationsTable.status, "completed"),
        ))
        .limit(1);
      if (!existingFullVoice) {
        await startProjectFullVoiceGeneration(
          job.projectId,
          {
            voiceId,
            voiceName: job.voiceName,
            modelId: getElevenLabsModel(),
            speed: 0.98,
            stability: 0.72,
            similarity: 0.8,
            style: 0.1,
            speakerBoost: true,
            tone: job.tone,
          },
           // startProjectFullVoiceGeneration performs the author-script
           // extraction once. Passing already-filtered text here would remove
           // speaker context and could produce an empty voice track.
           script.scenes.map((scene) => scene.voice_text),
        );
      }
    } else if (previousStages.voice?.status !== "completed" || script.scenes.some((scene) => !existingVoices.some((voice) => voice.sceneId === scene.scene_number))) {
      const missingVoiceSceneIds = script.scenes
        .filter((scene) => !existingVoices.some((voice) => voice.sceneId === scene.scene_number))
        .map((scene) => scene.scene_number);
      const voiceIds = await startProjectVoiceGeneration(job.projectId, {
        voiceId,
        sceneIds: missingVoiceSceneIds,
        voiceName: job.voiceName,
        modelId: getElevenLabsModel(),
        speed: 0.98,
        stability: 0.72,
        similarity: 0.8,
        style: 0.1,
        speakerBoost: true,
        tone: job.tone,
      });
      await waitForVoice(job.projectId, voiceIds);
    }
    await waitForActiveVoiceTimeline(job.projectId);
    await updateStage(jobId, stage, { status: "completed", progress: 100 }, 46);

    let [mix] = await db.select().from(audioMixesTable).where(and(
      eq(audioMixesTable.projectId, job.projectId),
      eq(audioMixesTable.status, "completed"),
    )).orderBy(desc(audioMixesTable.createdAt));
    const [activeMusic] = await db.select({ id: projectMusicTable.id })
      .from(projectMusicTable)
      .where(and(
        eq(projectMusicTable.projectId, job.projectId),
        eq(projectMusicTable.isActive, true),
        eq(projectMusicTable.status, "completed"),
      ))
      .limit(1);
    if (!mix?.storagePath || !activeMusic || previousStages.music?.status !== "completed" || previousStages.sfx?.status !== "completed") {
      stage = "music";
      await updateStage(jobId, stage, { status: "processing", progress: 0 }, 48);
      const soundDesignJobId = await startSoundDesign(job.projectId);
      await waitForSoundDesign(job.projectId, soundDesignJobId);
      await updateStage(jobId, "music", { status: "completed", progress: 100 }, 56);
      stage = "sfx";
      await updateStage(jobId, stage, { status: "processing", progress: 0 }, 58);
      await updateStage(jobId, stage, { status: "completed", progress: 100 }, 68);
      const mixJobId = await startAudioMix(job.projectId);
      mix = await waitForMix(job.projectId, mixJobId);
    }
    await updateStage(jobId, "music", { status: "completed", progress: 100 }, 70);
    await updateStage(jobId, "sfx", { status: "completed", progress: 100 }, 72);

    const { voices } = await loadActiveVoiceTimeline(job.projectId, true);

    stage = "rendering";
    await updateStage(jobId, stage, { status: "processing", progress: 0 }, 74);
    const chatMessages: ChatRenderMessage[] | undefined = chatMode
      ? script.scenes.map((scene, index) => ({
        text: scene.voice_text,
        durationMs: scene.duration_seconds * 1000,
        sender: index % 2 === 0 ? "contact" : "anonymous",
      }))
      : undefined;
    const rendered = await renderVideo({
      images: images.filter((image) => image.isPrimary && image.status === "completed").sort((a, b) => a.sceneId - b.sceneId),
      voices: voices.filter((voice) => !voice.isFullVoice),
      audioStoragePath: mix.storagePath!,
      durationMs: chatMode
        ? Math.max(1, (job.duration || script.duration_seconds) * 1000)
        : Math.max(1, voices.at(-1)?.endTime || script.duration_seconds * 1000),
      format: job.format,
      ctaText: script.cta,
      chatMessages,
    });
    const output = await storeRenderedVideo(rendered.buffer);
    if (supabaseConfigured) {
      try {
        const persistedVideo = await saveMediaAsset({
          kind: "video",
          buffer: rendered.buffer,
          contentType: "video/mp4",
          projectId: job.projectId,
          metadata: {
            format: job.format,
            durationMs: rendered.durationMs,
            videoJobId: job.id,
            title: project.title,
          },
        });
        const [episode] = await db.select({
          id: seriesEpisodesTable.id,
          seasonId: seriesEpisodesTable.seasonId,
        }).from(seriesEpisodesTable).where(eq(seriesEpisodesTable.projectId, job.projectId));
        if (episode) {
          const [season] = await db.select({ seriesId: seasonsTable.seriesId })
            .from(seasonsTable)
            .where(eq(seasonsTable.id, episode.seasonId));
          if (season) {
            await linkMediaToSeries({
              seriesId: season.seriesId,
              episodeId: episode.id,
              projectId: job.projectId,
              assetId: persistedVideo.asset.id!,
            });
          }
        }
      } catch (error) {
        logger.warn(
          { err: error, projectId: job.projectId, videoJobId: job.id, storagePath: output.storagePath },
          "Supabase media persistence unavailable; keeping the Object Storage video",
        );
      }
    }
    await updateStage(jobId, "rendering", { status: "completed", progress: 100 }, 98);
    await updateJob(jobId, {
      status: "completed",
      currentStage: "completed",
      progress: 100,
      videoStoragePath: output.storagePath,
      videoUrl: output.videoUrl,
      videoDuration: rendered.durationMs,
    });
    const [episode] = await db.select({
      id: seriesEpisodesTable.id,
      seasonId: seriesEpisodesTable.seasonId,
    }).from(seriesEpisodesTable).where(eq(seriesEpisodesTable.projectId, job.projectId));
    if (episode) {
      await db.update(seriesEpisodesTable)
        .set({ status: "completed" })
        .where(eq(seriesEpisodesTable.id, episode.id));
    }
  } catch (error) {
    const message = errorMessage(error);
    logger.error({ err: error, videoJobId: jobId, stage }, "Video pipeline stage failed");
    await updateStage(jobId, stage, { status: "failed", progress: 0, error: message }, 0);
    await updateJob(jobId, { status: "failed", currentStage: "failed", error: message });
  }
}