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
import { FINANCE_LONG_COIN_HISTORY_PROFILE_KEY } from "../video-pipeline/finance-long-style";

const MAX_DOWNLOADED_SOUND_ASSETS = 8;

async function saveMusicAsset(
  asset: AudioAsset,
  projectId: number,
  plan: SoundDesignPlan,
  lockOwnerId: string,
  options: { replaceExisting?: boolean; startTime?: number; volume?: number } = {},
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
        volume: options.volume ?? plan.scenes.find((scene) => scene.music.enabled)?.music.volume ?? 0.12,
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

function createDocumentaryMusicCues(plan: SoundDesignPlan) {
  const phases: Array<{
    position: number;
    mood: SoundDesignPlan["scenes"][number]["music"]["mood"];
    energy: number;
    volume: number;
    category: string;
  }> = [
    { position: 0, mood: "energetic", energy: 0.78, volume: 0.14, category: "cinematic energetic documentary opening instrumental" },
    { position: 0.18, mood: "documentary", energy: 0.46, volume: 0.09, category: "atmospheric historical documentary score" },
    { position: 0.4, mood: "calm", energy: 0.28, volume: 0.06, category: "minimal analytical documentary underscore" },
    { position: 0.63, mood: "cinematic", energy: 0.52, volume: 0.08, category: "measured cinematic market analysis instrumental" },
    { position: 0.82, mood: "suspense", energy: 0.72, volume: 0.12, category: "tense investigative documentary underscore" },
    { position: 0.94, mood: "motivational", energy: 0.67, volume: 0.13, category: "cinematic motivational documentary finale" },
  ];
  const totalDuration = plan.scenes.at(-1)?.end_time ?? 0;
  const usedSceneIds = new Set<number>();

  return phases.flatMap((phase, index) => {
    const targetTime = totalDuration * phase.position;
    const scene = plan.scenes.find((candidate) =>
      candidate.start_time >= targetTime && !usedSceneIds.has(candidate.scene_id)
    ) ?? plan.scenes.find((candidate) => !usedSceneIds.has(candidate.scene_id));
    if (!scene) return [];
    usedSceneIds.add(scene.scene_id);
    return [{
      scene: {
        ...scene,
        music: {
          ...scene.music,
          enabled: true,
          mood: phase.mood,
          energy: phase.energy,
          volume: phase.volume,
          category: phase.category,
        },
      },
      startTime: index === 0 ? 0 : scene.start_time,
    }];
  }).sort((left, right) => left.startTime - right.startTime);
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
    const projectMetadata = typeof project.scriptJson === "object" && project.scriptJson !== null
      ? project.scriptJson as Record<string, unknown>
      : {};
    const documentaryCoinHistory = projectMetadata[FINANCE_LONG_COIN_HISTORY_PROFILE_KEY] === true;
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
    const plan = analyzedPlan;
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

    const initialMusicScene = plan.scenes.find((scene) => scene.music.enabled);
    const musicCues = documentaryCoinHistory
      ? createDocumentaryMusicCues(plan)
      : initialMusicScene ? [{ scene: initialMusicScene, startTime: 0 }] : [];
    if (!musicCues.length) throw new Error("Sound design plan did not include the required music track.");
    try {
      const usedTrackIds = new Set<string>();
      for (const [index, cue] of musicCues.entries()) {
        const musicScene = cue.scene;
        const cuePlan: SoundDesignPlan = documentaryCoinHistory
          ? {
            ...plan,
            overall: {
              ...plan.overall,
              mood: musicScene.music.mood,
              music_style: musicScene.music.category,
            },
          }
          : plan;
        await heartbeatAudioProject(projectId, ownerId);
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
          logger.warn({ err: error, projectId, cue: index + 1 }, "Openverse music search failed; using generated instrumental fallback");
        }
        if (documentaryCoinHistory) {
          tracks = tracks.filter((track) => !usedTrackIds.has(track.externalId));
        }
        if (!tracks[0]) {
          try {
            const fallbackTracks = await musicProvider.search({
              query: "cinematic instrumental background music",
              mood: documentaryCoinHistory ? musicScene.music.mood : plan.overall.mood,
              category: "instrumental background music",
              limit: 8,
            });
            const distinctFallbacks = documentaryCoinHistory
              ? fallbackTracks.filter((track) => !usedTrackIds.has(track.externalId))
              : fallbackTracks;
            if (distinctFallbacks[0]) tracks = distinctFallbacks;
          } catch (error) {
            if (error instanceof AudioProjectLockLostError) throw error;
            logger.warn({ err: error, projectId, cue: index + 1 }, "Openverse fallback music search failed; using generated instrumental fallback");
          }
        }

        const saveGeneratedFallback = async () => {
          const generated = await generateInstrumentalMusic({
            projectId,
            durationMs: Math.max(1_000, (plan.scenes.at(-1)?.end_time || 1_000) - cue.startTime),
            mood: musicScene.music.mood,
            category: musicScene.music.category,
          });
          await saveMusicAsset(generated.asset, projectId, cuePlan, ownerId, {
            replaceExisting: index === 0,
            startTime: cue.startTime,
            volume: musicScene.music.volume,
          }, generated.buffer);
        };

        if (tracks[0]) {
          try {
            await saveMusicAsset(tracks[0], projectId, cuePlan, ownerId, {
              replaceExisting: index === 0,
              startTime: cue.startTime,
              volume: musicScene.music.volume,
            });
            usedTrackIds.add(tracks[0].externalId);
          } catch (error) {
            if (error instanceof AudioProjectLockLostError) throw error;
            logger.warn({ err: error, projectId, cue: index + 1 }, "Openverse music download failed; using generated instrumental fallback");
            await saveGeneratedFallback();
          }
        } else {
          if (documentaryCoinHistory) {
            logger.warn({ projectId, cue: index + 1, provider: "local:ffmpeg" }, "No distinct stock music result; using generated instrumental fallback");
          } else {
            logger.warn({ projectId, provider: "local:ffmpeg" }, "Openverse returned no music; using generated instrumental fallback");
          }
          await saveGeneratedFallback();
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
          const assets = await sfxProvider.search({
            query: item.query,
            category: "sound effect",
            limit: 6,
          });
          await heartbeatAudioProject(projectId, ownerId);
          const asset = assets[0];
          if (asset) {
            await saveSfxAsset(asset, projectId, scene.scene_id, item.start_time, item.volume, "sfx", ownerId);
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
