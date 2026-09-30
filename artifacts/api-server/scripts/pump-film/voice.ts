import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { and, desc, eq } from "drizzle-orm";
import { db, voiceGenerationsTable } from "@workspace/db";
import {
  generateSpeech,
  getConfiguredVoiceId,
  getElevenLabsModel,
  getSpeechProvider,
  prepareSpeechText,
} from "../../src/lib/audio-generation/elevenlabs-client";
import { generateVoiceApiSpeech, getVoiceApiModelId } from "../../src/lib/audio-generation/voice-api-client";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd(), "../..");
const scriptPath = resolve(root, "research/pump-film-script.json");
const outputDir = resolve(root, "attached_assets/generated_audio/pump-film-2026-09-30");

type Scene = {
  scene_number: number;
  voice_text: string;
};

type Script = {
  scenes: Scene[];
};

type PersistedSettings = {
  speed?: number;
  stability?: number;
  similarity?: number;
  style?: number;
  speaker_boost?: boolean;
};

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

async function getAudioDurationSeconds(path: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    path,
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not measure generated voice segment ${path}`);
  }
  return duration;
}

async function main(): Promise<void> {
  const provider = getSpeechProvider();
  const script = JSON.parse(await readFile(scriptPath, "utf8")) as Script;
  if (!Array.isArray(script.scenes) || script.scenes.length !== 20) {
    throw new Error("The fresh PUMP film script must contain exactly 20 scenes");
  }

  const [activeVoice] = await db
    .select({
      voiceId: voiceGenerationsTable.voiceId,
      modelId: voiceGenerationsTable.modelId,
      settings: voiceGenerationsTable.settings,
    })
    .from(voiceGenerationsTable)
    .where(and(
      eq(voiceGenerationsTable.isActive, true),
      eq(voiceGenerationsTable.isFullVoice, false),
      eq(voiceGenerationsTable.status, "completed"),
    ))
    .orderBy(desc(voiceGenerationsTable.updatedAt))
    .limit(1);

  const configuredVoiceId = getConfiguredVoiceId();
  const voiceId = activeVoice?.voiceId || configuredVoiceId;
  if (!voiceId) {
    throw new Error("No configured or active Telegram-selected ElevenLabs voice was found");
  }

  const savedSettings = activeVoice?.settings as PersistedSettings | null | undefined;
  const settings = {
    speed: numberOr(savedSettings?.speed, 1),
    stability: numberOr(savedSettings?.stability, 0.55),
    similarity: numberOr(savedSettings?.similarity, 0.8),
    style: numberOr(savedSettings?.style, 0.1),
    speakerBoost: booleanOr(savedSettings?.speaker_boost, true),
  };
  const modelId = activeVoice?.modelId
    || (provider === "voice_api" ? getVoiceApiModelId() : getElevenLabsModel());
  const fullText = prepareSpeechText(script.scenes.map((scene) => scene.voice_text).join("\n\n"));
  const wordCount = fullText.split(/\s+/u).filter(Boolean).length;
  await mkdir(outputDir, { recursive: true });
  const voicePath = resolve(outputDir, "pump-film-voice.mp3");
  const audio = provider === "voice_api"
    ? await generateVoiceApiSpeech(fullText, voiceId, modelId, settings)
    : await generateSpeech(fullText, voiceId, modelId, settings);
  await writeFile(voicePath, audio);
  const durationSeconds = await getAudioDurationSeconds(voicePath);
  const manifestPath = resolve(outputDir, "voice.json");
  await writeFile(manifestPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    provider,
    model: modelId,
    scene_count: script.scenes.length,
    word_count: wordCount,
    audio_file: voicePath,
    duration_seconds: durationSeconds,
    settings,
  }, null, 2), "utf8");

  console.log(JSON.stringify({
    voiceManifest: manifestPath,
    scenes: script.scenes.length,
    words: wordCount,
    speechMinutes: Number((durationSeconds / 60).toFixed(2)),
    targetMinutes: [12, 16],
    voiceSource: activeVoice?.voiceId ? "latest-active-Telegram-voice" : "configured",
  }));
}

main().then(() => {
  process.exit(0);
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown voice generation error");
  process.exit(1);
});