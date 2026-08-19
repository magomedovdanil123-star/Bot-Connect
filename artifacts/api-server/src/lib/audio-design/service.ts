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
import { logger } from "../logger";
import { analyzeSoundDesign } from "./analyzer";
import { AudioProjectLockLostError, claimAudioProject, heartbeatAudioProject, releaseAudioProject, withAudioProjectFence, withAudioProjectLock } from "./lock";
import { musicProvider, sfxProvider } from "./openverse-provider";
import { audioUrl, deleteAudioAsset, storeAudioAsset } from "./storage";
import { loadActiveVoiceTimeline } from "./timeline";
import type { AudioAsset, SoundDesignPlan } from "./types";
import { mixProjectAudio } from "./mixer";

const MAX_DOWNLOADED_SOUND_ASSETS = 8;

async function saveMusicAsset(
  asset: AudioAsset,
  projectId: number,
  plan: SoundDesignPlan,
  lockOwnerId: string,
  options: { replaceExisting?: boolean; startTime?: number } = {},
) {
  const replaceExisting = options.replaceExisting ?? true;
  const startTime = Math.max(0, options.startTime ?? 0);
  const previous = replaceExisting
    ? await db.select().from(projectMusicTable).where(eq(projectMusicTable.projectId, projectId))
    : [];
  const buffer = await musicProvider.download(asset);
  await heartbeatAudioProject(projectId, lockOwnerId);
  const storagePath = await storeAudioAsset(buffer, "music");
  try {
    const assignment = await withAudioProjectFence(projectId, lockOwnerId, async (tx) => {
      if (previous.length) {
        await tx.delete(projectMusicTable).where(inArray(projectMusicTable.id, previous.map((row) => row.id)));
      }
      const [track] = await tx.insert(musicTracksTable).values({
        provider: asset.provider,
        externalTrackId: asset.externalId,
        title: asset.title,
        artist: asset.creator,
        sourceUrl: asset.sourceUrl,
        previewUrl: asset.previewUrl,
        license: asset.license,
        licenseUrl: asset.licenseUrl,
        requiresAttribution: asset.requiresAttribution,
        duration: asset.duration,
        mood: plan.overall.mood,
        category: plan.overall.music_style,
        metadata: asset.metadata,
      }).returning();
      const [created] = await tx.insert(projectMusicTable).values({
        projectId,
        musicTrackId: track.id,
        source: "provider",
        storagePath,
        audioUrl: audioUrl(storagePath),
        volume: plan.scenes.find((scene) => scene.music.enabled)?.music.volume || 0.12,
        fadeIn: 1000,
        fadeOut: 1500,
        loop: true,
        ducking: true,
        startTime,
        duration: Math.max(0, (plan.scenes.at(-1)?.end_time || asset.duration || 60_000) - startTime),
        isActive: true,
        status: "completed",
      }).returning();
      if (!created) throw new Error("Project music assignment was not created");
      return created;
    });
    for (const row of previous) {
      await deleteAudioAsset(row.storagePath).catch((error) => {
        logger.warn({ err: error, projectId, projectMusicId: row.id }, "Could not delete replaced music object");
      });
    }
    return assignment;
  } catch (error) {
    await deleteAudioAsset(storagePath).catch(() => undefined);
    throw error;
  }
}

async function saveSfxAsset(
  asset: AudioAsset,
  projectId: number,
  sceneId: number,
  startTime: number,
  volume: number,
  kind: "sfx" | "ambience",
  lockOwnerId: string,
) {
  const buffer = await sfxProvider.download(asset);
  await heartbeatAudioProject(projectId, lockOwnerId);
  const storagePath = await storeAudioAsset(buffer, "sfx");
  try {
    return await withAudioProjectFence(projectId, lockOwnerId, async (tx) => {
      const [effect] = await tx.insert(soundEffectsTable).values({
        provider: asset.provider,
        externalEffectId: asset.externalId,
        title: asset.title,
        category: asset.category,
        sourceUrl: asset.sourceUrl,
        previewUrl: asset.previewUrl,
        license: asset.license,
        licenseUrl: asset.licenseUrl,
        requiresAttribution: asset.requiresAttribution,
        duration: asset.duration,
        metadata: asset.metadata,
      }).returning();
      return (await tx.insert(projectSoundEffectsTable).values({
        projectId,
        sceneId,
        soundEffectId: effect.id,
        kind,
        storagePath,
        audioUrl: audioUrl(storagePath),
        startTime,
        duration: kind === "ambience" ? null : Math.min(asset.duration || 5000, 5000),
        volume,
        fadeIn: kind === "ambience" ? 500 : 50,
        fadeOut: kind === "ambience" ? 500 : 100,
        isActive: true,
        status: "completed",
      }).returning())[0];
    });
  } catch (error) {
    await deleteAudioAsset(storagePath).catch(() => undefined);
    throw error;
  }
}

export async function startSoundDesign(projectId: number): Promise<number> {
  const ownerId = await claimAudioProject(projectId, "sound-design");
  try {
    const [job] = await withAudioProjectFence(projectId, ownerId, (tx) =>
      tx.insert(soundDesignPlansTable).values({ projectId, status: "pending" }).returning()
    );
    void processSoundDesign(job.id, projectId, ownerId);
    return job.id;
  } catch (error) {
    await releaseAudioProject(projectId, ownerId);
    throw error;
  }
}

async function processSoundDesign(jobId: number, projectId: number, ownerId: string) {
  try {
    await withAudioProjectFence(projectId, ownerId, (tx) =>
      tx.update(soundDesignPlansTable).set({ status: "processing", updatedAt: new Date() }).where(eq(soundDesignPlansTable.id, jobId))
    );
    const { project, script, voices: voiceRows } = await loadActiveVoiceTimeline(projectId);
    const plan = await analyzeSoundDesign({
      projectId,
      topic: project.topic,
      style: project.style,
      tone: project.tone,
      scenes: script.scenes.map((scene) => ({
        scene_number: scene.scene_number,
        voice_text: scene.voice_text,
        visual_description: scene.visual_description,
      })),
      timeline: voiceRows.map((row) => ({
        sceneId: row.sceneId,
        startTime: row.startTime || 0,
        endTime: row.endTime || (row.startTime || 0) + (row.duration || 0),
      })),
    });
    await heartbeatAudioProject(projectId, ownerId);
    await withAudioProjectFence(projectId, ownerId, (tx) =>
      tx.update(soundDesignPlansTable).set({ plan, status: "assets", updatedAt: new Date() }).where(eq(soundDesignPlansTable.id, jobId))
    );

    const oldMusic = await db.select().from(projectMusicTable).where(eq(projectMusicTable.projectId, projectId));
    const oldSfx = await db.select().from(projectSoundEffectsTable).where(eq(projectSoundEffectsTable.projectId, projectId));
    await withAudioProjectFence(projectId, ownerId, async (tx) => {
      await tx.delete(projectMusicTable).where(eq(projectMusicTable.projectId, projectId));
      await tx.delete(projectSoundEffectsTable).where(eq(projectSoundEffectsTable.projectId, projectId));
    });
    await Promise.all([...oldMusic, ...oldSfx].map((row) => deleteAudioAsset(row.storagePath).catch(() => undefined)));

    const musicScene = plan.scenes.find((scene) => scene.music.enabled);
    if (musicScene) {
      try {
        await heartbeatAudioProject(projectId, ownerId);
        const tracks = await musicProvider.search({
          query: musicScene.music.category,
          mood: musicScene.music.mood,
          category: "instrumental background music",
          limit: 8,
        });
        await heartbeatAudioProject(projectId, ownerId);
        if (tracks[0]) await saveMusicAsset(tracks[0], projectId, plan, ownerId);
      } catch (error) {
        if (error instanceof AudioProjectLockLostError) throw error;
        logger.warn({ err: error, projectId }, "Music asset was unavailable; sound design will continue");
      }
    }

    let downloaded = 0;
    for (const scene of plan.scenes) {
      for (const item of scene.sfx) {
        if (downloaded >= MAX_DOWNLOADED_SOUND_ASSETS) break;
        try {
          await heartbeatAudioProject(projectId, ownerId);
          const assets = await sfxProvider.search({ query: item.query, category: "sound effect", limit: 6 });
          await heartbeatAudioProject(projectId, ownerId);
          if (assets[0]) {
            await saveSfxAsset(assets[0], projectId, scene.scene_id, item.start_time, item.volume, "sfx", ownerId);
            downloaded += 1;
          }
        } catch (error) {
          if (error instanceof AudioProjectLockLostError) throw error;
          logger.warn({ err: error, projectId, sceneId: scene.scene_id, query: item.query }, "SFX asset was unavailable; continuing");
        }
      }
      if (scene.ambience.enabled && downloaded < MAX_DOWNLOADED_SOUND_ASSETS) {
        try {
          await heartbeatAudioProject(projectId, ownerId);
          const assets = await sfxProvider.search({ query: scene.ambience.query, category: "ambience field recording", limit: 6 });
          await heartbeatAudioProject(projectId, ownerId);
          if (assets[0]) {
            await saveSfxAsset(assets[0], projectId, scene.scene_id, scene.start_time, scene.ambience.volume, "ambience", ownerId);
            downloaded += 1;
          }
        } catch (error) {
          if (error instanceof AudioProjectLockLostError) throw error;
          logger.warn({ err: error, projectId, sceneId: scene.scene_id, query: scene.ambience.query }, "Ambience asset was unavailable; continuing");
        }
      }
    }
    await withAudioProjectFence(projectId, ownerId, (tx) =>
      tx.update(soundDesignPlansTable).set({ plan, status: "completed", updatedAt: new Date() }).where(eq(soundDesignPlansTable.id, jobId))
    );
  } catch (error) {
    logger.error({ err: error, projectId, soundDesignJobId: jobId }, "Auto sound design failed");
    await db.update(soundDesignPlansTable).set({
      status: "failed",
      error: error instanceof Error ? error.message : "Auto sound design failed",
      updatedAt: new Date(),
    }).where(eq(soundDesignPlansTable.id, jobId));
  } finally {
    await releaseAudioProject(projectId, ownerId);
  }
}

export async function startAudioMix(projectId: number): Promise<number> {
  const ownerId = await claimAudioProject(projectId, "audio-mix");
  try {
    const [job] = await withAudioProjectFence(projectId, ownerId, (tx) =>
      tx.insert(audioMixesTable).values({ projectId, status: "pending" }).returning()
    );
    void mixProjectAudio(job.id, projectId, ownerId).finally(() => releaseAudioProject(projectId, ownerId));
    return job.id;
  } catch (error) {
    await releaseAudioProject(projectId, ownerId);
    throw error;
  }
}

export async function selectMusic(projectId: number, externalId: string, settings?: Partial<{
  volume: number; fadeIn: number; fadeOut: number; loop: boolean; ducking: boolean;
  startTime: number; replaceExisting: boolean;
}>) {
  return withAudioProjectLock(projectId, "music-select", async (ownerId) => {
    const asset = await musicProvider.getTrack(externalId);
    await heartbeatAudioProject(projectId, ownerId);
    const planRow = (await db.select().from(soundDesignPlansTable)
      .where(eq(soundDesignPlansTable.projectId, projectId)).orderBy(desc(soundDesignPlansTable.createdAt)))[0];
    const fallbackPlan: SoundDesignPlan = {
      project_id: projectId,
      overall: { mood: "cinematic", energy: 0.5, tension: 0.5, music_style: asset.category },
      scenes: [{ scene_id: 1, start_time: 0, end_time: asset.duration || 60_000, music: { enabled: true, mood: "cinematic", energy: 0.5, category: asset.category, volume: settings?.volume || 0.12 }, sfx: [], ambience: { enabled: false, type: "room", query: "room ambience", volume: 0.05 } }],
    };
    const plan = (planRow?.plan as SoundDesignPlan | null) || fallbackPlan;
    const replaceExisting = settings?.replaceExisting ?? true;
    const startTime = settings?.startTime ?? 0;
    if (!replaceExisting) {
      const existing = await db.select({ id: projectMusicTable.id }).from(projectMusicTable).where(and(
        eq(projectMusicTable.projectId, projectId),
        eq(projectMusicTable.isActive, true),
      ));
      const { totalMs } = await loadActiveVoiceTimeline(projectId);
      if (!existing.length) throw new Error("A base music track is required before adding a transition");
      if (startTime <= 0 || startTime >= totalMs) throw new Error("Transition start must be inside the voice timeline");
    }
    const assignment = await saveMusicAsset(asset, projectId, plan, ownerId, {
      startTime: settings?.startTime,
      replaceExisting,
    });
    const [updated] = await withAudioProjectFence(projectId, ownerId, (tx) =>
      tx.update(projectMusicTable).set({
        volume: settings?.volume,
        fadeIn: settings?.fadeIn,
        fadeOut: settings?.fadeOut,
        loop: settings?.loop,
        ducking: settings?.ducking,
      }).where(eq(projectMusicTable.id, assignment.id)).returning()
    );
    return updated;
  });
}

export async function removeSoundDesign(projectId: number): Promise<void> {
  await withAudioProjectLock(projectId, "sound-design-clear", async (ownerId) => {
    const music = await db.select().from(projectMusicTable).where(eq(projectMusicTable.projectId, projectId));
    const sfx = await db.select().from(projectSoundEffectsTable).where(eq(projectSoundEffectsTable.projectId, projectId));
    const mixes = await db.select().from(audioMixesTable).where(eq(audioMixesTable.projectId, projectId));
    await withAudioProjectFence(projectId, ownerId, async (tx) => {
      await tx.delete(projectMusicTable).where(eq(projectMusicTable.projectId, projectId));
      await tx.delete(projectSoundEffectsTable).where(eq(projectSoundEffectsTable.projectId, projectId));
      await tx.delete(audioMixesTable).where(eq(audioMixesTable.projectId, projectId));
      await tx.delete(soundDesignPlansTable).where(eq(soundDesignPlansTable.projectId, projectId));
    });
    await Promise.all([...music, ...sfx, ...mixes].map((row) => deleteAudioAsset(row.storagePath).catch(() => undefined)));
  });
}
