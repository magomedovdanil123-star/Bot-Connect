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
import { audioUrl, deleteAudioAsset, readAudioAsset, storeAudioAsset } from "./storage";
import { loadActiveVoiceTimeline } from "./timeline";
import type { AudioAsset, SoundDesignPlan } from "./types";
import { mixProjectAudio } from "./mixer";
import { generateInstrumentalMusic } from "./generated-music";
import {
  FINANCIAL_BACKGROUND_MUSIC_VOLUME,
  FINANCIAL_MUSIC_BED_TRACK_ID,
  readFinancialMusicBedBuffer,
} from "../financial-music-asset";

const MAX_DOWNLOADED_SOUND_ASSETS = 8;
const FINANCE_LONG_MUSIC_CATEGORY = "user-provided background music for a financial video";
let financeLongSharedMusicPromise: Promise<{ asset: AudioAsset; buffer: Buffer }> | null = null;

function isFinanceLongFormat(format: string): boolean {
  const normalized = format.toLocaleLowerCase();
  return normalized.includes("finance") && normalized.includes("long");
}

function assetFromStoredMusicTrack(
  row: typeof musicTracksTable.$inferSelect,
  metadata: Record<string, unknown>,
): AudioAsset {
  return {
    provider: row.provider,
    externalId: row.externalTrackId,
    title: row.title,
    creator: row.artist,
    sourceUrl: row.sourceUrl,
    previewUrl: row.previewUrl,
    downloadUrl: row.previewUrl || row.sourceUrl,
    license: row.license,
    licenseUrl: row.licenseUrl,
    requiresAttribution: row.requiresAttribution,
    duration: row.duration,
    category: row.category || FINANCE_LONG_MUSIC_CATEGORY,
    metadata,
  };
}

function calmFinanceLongSoundPlan(plan: SoundDesignPlan): SoundDesignPlan {
  return {
    ...plan,
    overall: {
      ...plan.overall,
      mood: "calm",
      energy: 0.22,
      tension: 0.08,
      music_style: FINANCE_LONG_MUSIC_CATEGORY,
    },
    scenes: plan.scenes.map((scene, index) => ({
      ...scene,
      music: {
        ...scene.music,
        enabled: index === 0,
        mood: "calm",
        energy: 0.18,
        category: FINANCE_LONG_MUSIC_CATEGORY,
        volume: FINANCIAL_BACKGROUND_MUSIC_VOLUME,
      },
    })),
  };
}

async function createFinanceLongSharedMusic(projectId: number): Promise<{ asset: AudioAsset; buffer: Buffer }> {
  const buffer = await readFinancialMusicBedBuffer();
  const canonicalStoragePath = await storeAudioAsset(buffer, "music");
  const metadata = {
    userProvided: true,
    financeLongSharedBackground: true,
    financeLongSharedBackgroundTrack: FINANCIAL_MUSIC_BED_TRACK_ID,
    financeLongCanonicalStoragePath: canonicalStoragePath,
  };
  const sharedAsset: AudioAsset = {
    provider: "user-upload",
    externalId: FINANCIAL_MUSIC_BED_TRACK_ID,
    title: "Музыкальный фон для финансовых видео",
    creator: null,
    sourceUrl: "user-upload:financial-background-music",
    previewUrl: null,
    downloadUrl: "user-upload:financial-background-music",
    license: "user-provided",
    licenseUrl: null,
    requiresAttribution: false,
    duration: null,
    category: FINANCE_LONG_MUSIC_CATEGORY,
    metadata,
  };

  try {
    await db.insert(musicTracksTable).values({
      provider: sharedAsset.provider,
      externalTrackId: sharedAsset.externalId,
      title: sharedAsset.title,
      artist: sharedAsset.creator,
      sourceUrl: sharedAsset.sourceUrl,
      previewUrl: sharedAsset.previewUrl,
      license: sharedAsset.license,
      licenseUrl: sharedAsset.licenseUrl,
      requiresAttribution: sharedAsset.requiresAttribution,
      duration: sharedAsset.duration,
      mood: "calm",
      category: FINANCE_LONG_MUSIC_CATEGORY,
      metadata,
    });
    logger.info({ projectId, trackId: FINANCIAL_MUSIC_BED_TRACK_ID }, "Using saved user-provided finance long music");
    return { asset: sharedAsset, buffer };
  } catch (error) {
    await deleteAudioAsset(canonicalStoragePath).catch(() => undefined);
    throw error;
  }
}

async function getFinanceLongSharedMusic(projectId: number): Promise<{ asset: AudioAsset; buffer: Buffer }> {
  const existingTracks = await db.select().from(musicTracksTable)
    .orderBy(desc(musicTracksTable.createdAt))
    .limit(40);
  const seenStoragePaths = new Set<string>();
  for (const row of existingTracks) {
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : {};
    if (
      metadata.financeLongSharedBackground !== true
      || metadata.financeLongSharedBackgroundTrack !== FINANCIAL_MUSIC_BED_TRACK_ID
    ) continue;
    const storagePath = metadata.financeLongCanonicalStoragePath;
    if (typeof storagePath !== "string" || !storagePath || seenStoragePaths.has(storagePath)) continue;
    seenStoragePaths.add(storagePath);
    try {
      return {
        asset: assetFromStoredMusicTrack(row, metadata),
        buffer: await readAudioAsset(storagePath),
      };
    } catch (error) {
      logger.warn({ err: error, projectId, musicTrackId: row.id }, "Stored finance long soundtrack is unavailable; looking for a replacement");
    }
  }

  if (!financeLongSharedMusicPromise) {
    financeLongSharedMusicPromise = createFinanceLongSharedMusic(projectId);
  }
  const pending = financeLongSharedMusicPromise;
  try {
    return await pending;
  } catch (error) {
    financeLongSharedMusicPromise = null;
    throw error;
  } finally {
    if (financeLongSharedMusicPromise === pending) financeLongSharedMusicPromise = null;
  }
}

async function saveMusicAsset(
  asset: AudioAsset,
  projectId: number,
  plan: SoundDesignPlan,
  lockOwnerId: string,
  options: { replaceExisting?: boolean; startTime?: number } = {},
  downloadedBuffer?: Buffer,
) {
  const replaceExisting = options.replaceExisting ?? true;
  const startTime = Math.max(0, options.startTime ?? 0);
  const previous = replaceExisting
    ? await db.select().from(projectMusicTable).where(eq(projectMusicTable.projectId, projectId))
    : [];
  const buffer = downloadedBuffer || await musicProvider.download(asset);
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
         source: asset.provider.startsWith("local:") ? "generated" : "provider",
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
    const financeLongProject = isFinanceLongFormat(project.format);
    const analyzedPlan = await analyzeSoundDesign({
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
    const plan = financeLongProject ? calmFinanceLongSoundPlan(analyzedPlan) : analyzedPlan;
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
    if (!musicScene) throw new Error("Sound design plan did not include the required music track.");
    try {
      await heartbeatAudioProject(projectId, ownerId);
      if (financeLongProject) {
        const sharedMusic = await getFinanceLongSharedMusic(projectId);
        await heartbeatAudioProject(projectId, ownerId);
        await saveMusicAsset(sharedMusic.asset, projectId, plan, ownerId, {}, sharedMusic.buffer);
      } else {
      let tracks: AudioAsset[] = [];
      try {
        tracks = await musicProvider.search({
          query: musicScene.music.category,
          mood: musicScene.music.mood,
          category: "instrumental background music",
          limit: 8,
        });
        await heartbeatAudioProject(projectId, ownerId);
      } catch (error) {
        if (error instanceof AudioProjectLockLostError) throw error;
        logger.warn({ err: error, projectId }, "Openverse music search failed; using generated instrumental fallback");
      }
      if (!tracks[0]) {
        try {
          const fallbackTracks = await musicProvider.search({
            query: "cinematic instrumental background music",
            mood: plan.overall.mood,
            category: "instrumental background music",
            limit: 8,
          });
          if (fallbackTracks[0]) tracks = fallbackTracks;
        } catch (error) {
          if (error instanceof AudioProjectLockLostError) throw error;
          logger.warn({ err: error, projectId }, "Openverse fallback music search failed; using generated instrumental fallback");
        }
      }
      if (tracks[0]) {
        try {
          await saveMusicAsset(tracks[0], projectId, plan, ownerId);
        } catch (error) {
          if (error instanceof AudioProjectLockLostError) throw error;
          logger.warn({ err: error, projectId }, "Openverse music download failed; using generated instrumental fallback");
          const generated = await generateInstrumentalMusic({
            projectId,
            durationMs: Math.max(1_000, plan.scenes.at(-1)?.end_time || 1_000),
            mood: musicScene.music.mood,
            category: musicScene.music.category,
          });
          await saveMusicAsset(generated.asset, projectId, plan, ownerId, {}, generated.buffer);
        }
      } else {
        const generated = await generateInstrumentalMusic({
          projectId,
          durationMs: Math.max(1_000, plan.scenes.at(-1)?.end_time || 1_000),
          mood: musicScene.music.mood,
          category: musicScene.music.category,
        });
        logger.warn({ projectId, provider: "local:ffmpeg" }, "Openverse returned no music; using generated instrumental fallback");
        await saveMusicAsset(generated.asset, projectId, plan, ownerId, {}, generated.buffer);
      }
      }
    } catch (error) {
      if (error instanceof AudioProjectLockLostError) throw error;
      logger.error({ err: error, projectId }, "Music asset was unavailable; sound design cannot continue without music");
      throw error;
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
