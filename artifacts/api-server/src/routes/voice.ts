import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  ActivateVoiceParams, ActivateVoiceResponse, DeleteVoiceParams, GenerateProjectVoiceBody,
  GenerateProjectVoiceParams, GenerateProjectVoiceResponse, GetVoiceParams, GetVoiceResponse,
  GetVoiceStatusParams, GetVoiceStatusResponse, ListProjectVoiceParams, ListProjectVoiceResponse,
  ListVoicesResponse, RefreshVoicesResponse, RegenerateVoiceBody, RegenerateVoiceParams,
  RegenerateVoiceResponse,
} from "@workspace/api-zod";
import { db, projectsTable, voiceGenerationsTable } from "@workspace/db";
import { ElevenLabsNotConfiguredError, getElevenLabsModel, listElevenLabsVoices } from "../lib/audio-generation/elevenlabs-client";
import { activateVoice, regenerateVoice, startProjectVoiceGeneration } from "../lib/audio-generation/service";
import { getConfiguredVoiceId, getSpeechProvider } from "../lib/audio-generation/elevenlabs-client";

const router: IRouter = Router();
let voicesCache: { expiresAt: number; value: ReturnType<typeof toApiVoice>[] } | null = null;

function toApiVoice(row: any) {
  return {
    voice_id: row.voiceId,
    name: row.name || row.voiceName || "Unnamed voice",
    description: row.description || null,
    gender: row.labels?.gender || null,
    language: row.labels?.language || row.labels?.language_code || null,
    accent: row.labels?.accent || null,
    preview_url: row.previewUrl || row.preview_url || null,
  };
}

function toApiGeneration(row: typeof voiceGenerationsTable.$inferSelect) {
  return {
    id: row.id, project_id: row.projectId, scene_id: row.sceneId, provider: row.provider,
    voice_id: row.voiceId, voice_name: row.voiceName, model_id: row.modelId, text: row.text,
    settings: row.settings, status: row.status, audio_url: row.audioUrl, storage_path: row.storagePath,
    duration: row.duration, file_size: row.fileSize, error: row.error, version: row.version,
    is_active: row.isActive, start_time: row.startTime, end_time: row.endTime, is_full_voice: row.isFullVoice,
    created_at: row.createdAt, updated_at: row.updatedAt,
  };
}

async function loadVoices(force = false) {
  if (!force && voicesCache && voicesCache.expiresAt > Date.now()) return voicesCache.value;
  const value = (await listElevenLabsVoices()).map(toApiVoice);
  voicesCache = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
  return value;
}

router.get("/voices", async (_req, res): Promise<void> => {
  try {
    res.json(ListVoicesResponse.parse(await loadVoices()));
  } catch (error) {
    if (error instanceof ElevenLabsNotConfiguredError) {
      res.status(503).json({ error: "ElevenLabs API key is not configured" });
      return;
    }
    res.status(502).json({ error: "Could not load ElevenLabs voices" });
  }
});

router.post("/voices/refresh", async (_req, res): Promise<void> => {
  try {
    res.json(RefreshVoicesResponse.parse(await loadVoices(true)));
  } catch (error) {
    if (error instanceof ElevenLabsNotConfiguredError) {
      res.status(503).json({ error: "ElevenLabs API key is not configured" });
      return;
    }
    res.status(502).json({ error: "Could not refresh ElevenLabs voices" });
  }
});

router.post("/projects/:id/voice/generate", async (req, res): Promise<void> => {
  const params = GenerateProjectVoiceParams.safeParse(req.params);
  const body = GenerateProjectVoiceBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid voice settings" });
    return;
  }
  if (getSpeechProvider() === "elevenlabs" && !process.env["ELEVENLABS_API_KEY"]) {
    res.status(400).json({ error: "ElevenLabs API key is not configured" });
    return;
  }
  const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const settings = body.data;
  const ids = await startProjectVoiceGeneration(params.data.id, {
    voiceId: getSpeechProvider() === "google_free" ? getConfiguredVoiceId() : settings.voice_id,
    voiceName: getSpeechProvider() === "google_free" ? "Google Russian (free)" : settings.voice_name,
    modelId: settings.model_id || getElevenLabsModel(),
    speed: settings.speed, stability: settings.stability, similarity: settings.similarity,
    style: settings.style, speakerBoost: settings.speaker_boost, tone: settings.tone,
  });
  res.status(202).json(GenerateProjectVoiceResponse.parse({
    project_id: params.data.id, status: "pending", total: ids.length, voice_ids: ids,
  }));
});

router.get("/projects/:id/voice", async (req, res): Promise<void> => {
  const params = ListProjectVoiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid project id" }); return; }
  const rows = await db.select().from(voiceGenerationsTable).where(eq(voiceGenerationsTable.projectId, params.data.id)).orderBy(desc(voiceGenerationsTable.sceneId), desc(voiceGenerationsTable.version));
  res.json(ListProjectVoiceResponse.parse(rows.map(toApiGeneration)));
});

async function getRow(id: number) {
  return (await db.select().from(voiceGenerationsTable).where(eq(voiceGenerationsTable.id, id)))[0];
}

router.get("/voice/:id", async (req, res): Promise<void> => {
  const params = GetVoiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid voice id" }); return; }
  const row = await getRow(params.data.id);
  if (!row) { res.status(404).json({ error: "Voice not found" }); return; }
  res.json(GetVoiceResponse.parse(toApiGeneration(row)));
});

router.get("/voice/:id/status", async (req, res): Promise<void> => {
  const params = GetVoiceStatusParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid voice id" }); return; }
  const row = await getRow(params.data.id);
  if (!row) { res.status(404).json({ error: "Voice not found" }); return; }
  res.json(GetVoiceStatusResponse.parse(toApiGeneration(row)));
});

router.post("/voice/:id/regenerate", async (req, res): Promise<void> => {
  const params = RegenerateVoiceParams.safeParse(req.params);
  const body = RegenerateVoiceBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid voice settings" }); return; }
  try {
    const settings = body.data;
    const row = await regenerateVoice(params.data.id, {
      voiceId: settings.voice_id, voiceName: settings.voice_name, modelId: settings.model_id,
      speed: settings.speed, stability: settings.stability, similarity: settings.similarity,
      style: settings.style, speakerBoost: settings.speaker_boost, tone: settings.tone,
    });
    res.status(202).json(RegenerateVoiceResponse.parse(toApiGeneration(row)));
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Voice not found" });
  }
});

router.post("/voice/:id/activate", async (req, res): Promise<void> => {
  const params = ActivateVoiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid voice id" }); return; }
  try {
    res.json(ActivateVoiceResponse.parse(toApiGeneration(await activateVoice(params.data.id))));
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Voice not found" });
  }
});

router.delete("/voice/:id", async (req, res): Promise<void> => {
  const params = DeleteVoiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid voice id" }); return; }
  const deleted = await db.delete(voiceGenerationsTable).where(eq(voiceGenerationsTable.id, params.data.id)).returning({ id: voiceGenerationsTable.id });
  if (!deleted[0]) { res.status(404).json({ error: "Voice not found" }); return; }
  res.sendStatus(204);
});

export default router;