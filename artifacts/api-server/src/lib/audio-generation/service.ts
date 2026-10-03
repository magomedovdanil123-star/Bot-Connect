import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, projectsTable, voiceGenerationsTable } from "@workspace/db";
import { objectStorageClient } from "../objectStorage";
import { logger } from "../logger";
import { videoScriptSchema } from "../script-generator";
import { generateSpeech, getElevenLabsModel, getSpeechProvider, prepareSpeechText } from "./elevenlabs-client";

const execFileAsync = promisify(execFile);

function persistedVoiceSettings(settings: VoiceSettings) {
  return {
    speed: settings.speed,
    stability: settings.stability,
    similarity: settings.similarity,
    style: settings.style,
    speaker_boost: settings.speakerBoost,
    tone: settings.tone,
  };
}

export type VoiceSettings = {
  voiceId: string;
  voiceName?: string | null;
  modelId: string;
  speed: number;
  stability: number;
  similarity: number;
  style: number;
  speakerBoost: boolean;
  tone: string;
  sceneIds?: number[];
};

export function extractSpokenAuthorText(value: string): string {
  const lines = value.split(/\r?\n/u);
  const spoken: string[] = [];
  let skipOnScreenText = false;
  let speakerDialogue = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      skipOnScreenText = false;
      speakerDialogue = false;
      if (spoken.at(-1) !== "") spoken.push("");
      continue;
    }
    if (/^(?:СЦЕНА|ЭПИЗОД|КОНЕЦ СЕРИИ|ФИНАЛ)\b/iu.test(line)) {
      speakerDialogue = false;
      continue;
    }
    if (/^ТЕКСТ НА ЭКРАНЕ\s*:/iu.test(line)) {
      skipOnScreenText = true;
      speakerDialogue = false;
      continue;
    }
    if (skipOnScreenText) continue;
    if (/^ПРОДОЛЖЕНИЕ СЛЕДУЕТ[.!…]*$/iu.test(line)) continue;
    if (/^[А-ЯЁ][А-ЯЁа-яёA-Za-z0-9 _-]{0,32}:$/u.test(line)) {
      speakerDialogue = true;
      continue;
    }
    if (speakerDialogue) {
      spoken.push(line);
      continue;
    }
    if (/^[-—]\s*\S/u.test(line)) {
      spoken.push(line);
      continue;
    }
    if (
      /^["«].+["»]$/u.test(line)
      || /^(?:закадровый голос|диктор)\s*:/iu.test(line)
      || /(?:^|\s)(?:я|мы|мне|нам|мой|моя|моё|наша|наш)\b/iu.test(line)
      || /^(?:Хочешь|Переходи|Оставляй|Подписывайся)\b/iu.test(line)
    ) spoken.push(line);
  }
  return spoken.join("\n").replace(/\n{3,}/gu, "\n\n").trim();
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  const [bucketName, ...parts] = path.replace(/^\/+/, "").split("/");
  return { bucketName, objectName: parts.join("/") };
}

async function storeAudio(buffer: Buffer, extension = "mp3"): Promise<string> {
  const privateDir = process.env["PRIVATE_OBJECT_DIR"];
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  const path = `${privateDir}/voice/${randomUUID()}.${extension}`;
  const { bucketName, objectName } = parseObjectPath(path);
  await objectStorageClient.bucket(bucketName).file(objectName).save(buffer, {
    resumable: false,
    metadata: { contentType: "audio/mpeg", cacheControl: "private, max-age=31536000" },
  });
  const relative = privateDir.endsWith("/")
    ? path.slice(privateDir.length)
    : path.slice(privateDir.length + 1);
  return `/objects/${relative}`;
}

async function getDuration(buffer: Buffer, extension = "mp3"): Promise<number> {
  const dir = await mkdtemp(join(tmpdir(), "voice-duration-"));
  const file = join(dir, `audio.${extension}`);
  try {
    await writeFile(file, buffer);
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file,
    ]);
    return Math.max(0, Math.round(Number.parseFloat(stdout.trim()) * 1000));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function concatAudio(buffers: Buffer[]): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "voice-concat-"));
  try {
    const files: string[] = [];
    for (const [index, buffer] of buffers.entries()) {
      const file = join(dir, `scene-${String(index + 1).padStart(3, "0")}.mp3`);
      await writeFile(file, buffer);
      files.push(file);
    }
    const list = join(dir, "concat.txt");
    await writeFile(list, files.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"));
    const output = join(dir, "full_voice.mp3");
    await execFileAsync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "128k", output]);
    return await (await import("node:fs/promises")).readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function startProjectVoiceGeneration(projectId: number, settings: VoiceSettings): Promise<number[]> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) throw new Error("Project not found");
  const script = videoScriptSchema.parse(project.scriptJson);
  const scenes = settings.sceneIds?.length
    ? script.scenes.filter((scene) => settings.sceneIds!.includes(scene.scene_number))
    : script.scenes;
  const rows = await db.insert(voiceGenerationsTable).values(scenes.map((scene) => ({
    projectId,
    sceneId: scene.scene_number,
     provider: getSpeechProvider(),
    voiceId: settings.voiceId,
    voiceName: settings.voiceName,
    modelId: settings.modelId || getElevenLabsModel(),
    text: scene.voice_text,
    speechText: prepareSpeechText(scene.voice_text),
    settings: persistedVoiceSettings(settings),
    status: "pending",
    version: sql`coalesce((select max(version) + 1 from voice_generations where project_id = ${projectId} and scene_id = ${scene.scene_number}), 1)`,
    isActive: false,
  }))).returning({ id: voiceGenerationsTable.id });
  const ids = rows.map((row) => row.id);
  void processVoiceJob(projectId, ids, settings, true);
  return ids;
}

export async function startProjectFullVoiceGeneration(
  projectId: number,
  settings: VoiceSettings,
  sceneTexts: string[],
  options: { extractAuthorScript?: boolean } = {},
): Promise<number[]> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) throw new Error("Project not found");
  const spokenSceneTexts = sceneTexts.map((text) =>
    options.extractAuthorScript === false ? text.trim() : extractSpokenAuthorText(text),
  );
  const fullText = spokenSceneTexts.filter(Boolean).join("\n\n").trim();
  if (!fullText) throw new Error("Авторский текст для озвучки пуст");

  const audio = await generateSpeech(prepareSpeechText(fullText), settings.voiceId, settings.modelId || getElevenLabsModel(), {
    ...settings,
    previousText: undefined,
    nextText: undefined,
  });
  const duration = await getDuration(audio);
  const storagePath = await storeAudio(audio);
  const weights = spokenSceneTexts.map((text) => Math.max(1, text.trim().length));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = 0;
  const timeline = spokenSceneTexts.map((text, index) => {
    const startTime = cursor;
    const sceneDuration = index === sceneTexts.length - 1
      ? duration - cursor
      : Math.max(1, Math.round(duration * (weights[index]! / weightTotal)));
    cursor += sceneDuration;
    return { text, startTime, endTime: cursor };
  });

  const ids = await db.transaction(async (tx) => {
    await tx.delete(voiceGenerationsTable).where(eq(voiceGenerationsTable.projectId, projectId));
    const rows = await tx.insert(voiceGenerationsTable).values([
      {
        projectId,
        sceneId: 0,
        provider: getSpeechProvider(),
        voiceId: settings.voiceId,
        voiceName: settings.voiceName,
        modelId: settings.modelId || getElevenLabsModel(),
        text: fullText,
        speechText: prepareSpeechText(fullText),
        settings: persistedVoiceSettings(settings),
        status: "completed",
        audioUrl: `/api/storage${storagePath}`,
        storagePath,
        duration,
        fileSize: audio.length,
        startTime: 0,
        endTime: duration,
        version: 1,
        isActive: true,
        isFullVoice: true,
      },
      ...timeline.map((scene, index) => ({
        projectId,
        sceneId: index + 1,
        provider: getSpeechProvider(),
        voiceId: settings.voiceId,
        voiceName: settings.voiceName,
        modelId: settings.modelId || getElevenLabsModel(),
        text: scene.text,
        speechText: prepareSpeechText(scene.text),
        settings: persistedVoiceSettings(settings),
        status: "completed" as const,
        duration: scene.endTime - scene.startTime,
        startTime: scene.startTime,
        endTime: scene.endTime,
        version: 1,
        isActive: true,
        isFullVoice: false,
      })),
    ]).returning({ id: voiceGenerationsTable.id, sceneId: voiceGenerationsTable.sceneId });
    return rows.filter((row) => row.sceneId > 0).map((row) => row.id);
  });
  return ids;
}

async function processVoiceJob(projectId: number, ids: number[], settings: VoiceSettings, isProjectPass = false): Promise<void> {
  const buffers: Buffer[] = [];
  let cursor = 0;
  try {
    for (const id of ids) {
      const [row] = await db.select().from(voiceGenerationsTable).where(eq(voiceGenerationsTable.id, id));
      if (!row) continue;
      try {
        await db.update(voiceGenerationsTable).set({ status: "processing", updatedAt: new Date() }).where(eq(voiceGenerationsTable.id, id));
        const previous = cursor > 0
          ? (await db.select({
            text: voiceGenerationsTable.text,
            speechText: voiceGenerationsTable.speechText,
          }).from(voiceGenerationsTable).where(eq(voiceGenerationsTable.id, ids[cursor - 1])))[0]
          : undefined;
        const next = cursor < ids.length - 1
          ? (await db.select({
            text: voiceGenerationsTable.text,
            speechText: voiceGenerationsTable.speechText,
          }).from(voiceGenerationsTable).where(eq(voiceGenerationsTable.id, ids[cursor + 1])))[0]
          : undefined;
        const audio = await generateSpeech(row.speechText || row.text, row.voiceId, row.modelId, {
          ...settings,
          previousText: previous?.speechText || previous?.text,
          nextText: next?.speechText || next?.text,
        });
        const duration = await getDuration(audio);
        const storagePath = await storeAudio(audio);
        await db.update(voiceGenerationsTable).set({
          status: "completed", audioUrl: `/api/storage${storagePath}`, storagePath,
          duration, fileSize: audio.length, startTime: cursor, endTime: cursor + duration, updatedAt: new Date(),
        }).where(eq(voiceGenerationsTable.id, id));
        buffers.push(audio);
        cursor += duration;
      } catch (error) {
         logger.error({ err: error, voiceId: id, projectId, provider: getSpeechProvider() }, "Scene voice generation failed");
        await db.update(voiceGenerationsTable).set({
          status: "failed",
          error: error instanceof Error ? error.message : "ElevenLabs request failed",
          updatedAt: new Date(),
        }).where(eq(voiceGenerationsTable.id, id));
      }
    }
    if (isProjectPass && buffers.length === ids.length && buffers.length > 0) {
      const full = await concatAudio(buffers);
      const fullDuration = await getDuration(full);
      const fullStoragePath = await storeAudio(full);
      await db.transaction(async (tx) => {
        await tx.update(voiceGenerationsTable).set({ isActive: false, updatedAt: new Date() }).where(and(
          eq(voiceGenerationsTable.projectId, projectId),
          eq(voiceGenerationsTable.isActive, true),
        ));
        await tx.update(voiceGenerationsTable).set({ isActive: true, updatedAt: new Date() }).where(inArray(voiceGenerationsTable.id, ids));
        await tx.insert(voiceGenerationsTable).values({
          projectId, sceneId: 0, provider: getSpeechProvider(), voiceId: settings.voiceId,
          voiceName: settings.voiceName, modelId: settings.modelId || getElevenLabsModel(), text: "Full voice",
           speechText: null,
          settings: persistedVoiceSettings(settings), status: "completed", audioUrl: `/api/storage${fullStoragePath}`,
          storagePath: fullStoragePath, duration: fullDuration, fileSize: full.length,
          version: sql`coalesce((select max(version) + 1 from voice_generations where project_id = ${projectId} and scene_id = 0), 1)`,
          isActive: true, isFullVoice: true, startTime: 0, endTime: fullDuration,
        });
      });
    }
  } catch (error) {
     logger.error({ err: error, projectId, provider: getSpeechProvider() }, "Voice generation failed");
    await db.update(voiceGenerationsTable).set({
      status: "failed",
      error: error instanceof Error ? error.message : "ElevenLabs request failed",
      updatedAt: new Date(),
    }).where(and(eq(voiceGenerationsTable.projectId, projectId), inArray(voiceGenerationsTable.id, ids)));
  }
}

export async function regenerateVoice(id: number, settings: VoiceSettings): Promise<typeof voiceGenerationsTable.$inferSelect> {
  const [source] = await db.select().from(voiceGenerationsTable).where(eq(voiceGenerationsTable.id, id));
  if (!source) throw new Error("Voice not found");
  const [version] = await db.insert(voiceGenerationsTable).values({
    projectId: source.projectId, sceneId: source.sceneId, provider: getSpeechProvider(),
    voiceId: settings.voiceId, voiceName: settings.voiceName, modelId: settings.modelId,
    text: source.text, settings: persistedVoiceSettings(settings), status: "pending",
    speechText: prepareSpeechText(source.text),
    version: sql`coalesce((select max(version) + 1 from voice_generations where project_id = ${source.projectId} and scene_id = ${source.sceneId}), 2)`,
    isActive: false,
  }).returning();
  void processVoiceJob(source.projectId, [version.id], settings, false);
  return version;
}

export async function activateVoice(id: number): Promise<typeof voiceGenerationsTable.$inferSelect> {
  const [source] = await db.select().from(voiceGenerationsTable).where(eq(voiceGenerationsTable.id, id));
  if (!source) throw new Error("Voice not found");
  if (source.status !== "completed" || !source.duration || source.isFullVoice) throw new Error("Only a completed scene voice can be activated");
  return await db.transaction(async (tx) => {
    await tx.update(voiceGenerationsTable).set({ isActive: false, updatedAt: new Date() }).where(and(eq(voiceGenerationsTable.projectId, source.projectId), eq(voiceGenerationsTable.sceneId, source.sceneId)));
    await tx.update(voiceGenerationsTable).set({ isActive: true, updatedAt: new Date() }).where(eq(voiceGenerationsTable.id, id));
    const activeScenes = await tx.select().from(voiceGenerationsTable).where(and(
      eq(voiceGenerationsTable.projectId, source.projectId),
      eq(voiceGenerationsTable.isActive, true),
      eq(voiceGenerationsTable.isFullVoice, false),
      eq(voiceGenerationsTable.status, "completed"),
    )).orderBy(asc(voiceGenerationsTable.sceneId));
    let cursor = 0;
    for (const scene of activeScenes) {
      const duration = scene.duration || 0;
      await tx.update(voiceGenerationsTable).set({
        startTime: cursor,
        endTime: cursor + duration,
        updatedAt: new Date(),
      }).where(eq(voiceGenerationsTable.id, scene.id));
      cursor += duration;
    }
    await tx.update(voiceGenerationsTable).set({ isActive: false, updatedAt: new Date() }).where(and(
      eq(voiceGenerationsTable.projectId, source.projectId),
      eq(voiceGenerationsTable.isFullVoice, true),
      eq(voiceGenerationsTable.isActive, true),
    ));
    const [active] = await tx.select().from(voiceGenerationsTable).where(eq(voiceGenerationsTable.id, id));
    if (!active) throw new Error("Voice not found");
    return active;
  });
}