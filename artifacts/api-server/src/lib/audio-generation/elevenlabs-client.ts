import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export const DEFAULT_ELEVENLABS_MODEL = "eleven_multilingual_v2";

export class ElevenLabsNotConfiguredError extends Error {
  constructor() {
    super("ElevenLabs API key is not configured");
    this.name = "ElevenLabsNotConfiguredError";
  }
}

function getClient(): ElevenLabsClient {
  const apiKey = process.env["ELEVENLABS_API_KEY"];
  if (!apiKey) throw new ElevenLabsNotConfiguredError();
  return new ElevenLabsClient({ apiKey });
}

export function getElevenLabsModel(): string {
  return process.env["ELEVENLABS_MODEL_ID"] || DEFAULT_ELEVENLABS_MODEL;
}

export function prepareSpeechText(text: string): string {
  const normalized = text.normalize("NFC").trim();
  return normalized
    .replace(/\[пауза(?:\s*[:=]?\s*)(\d+(?:[.,]\d+)?)\s*(?:с|сек|секунд)?\]/giu, (_match, rawSeconds: string) => {
      const seconds = Number.parseFloat(rawSeconds.replace(",", "."));
      if (!Number.isFinite(seconds) || seconds <= 0) return "…";
      if (seconds >= 0.8) return ".";
      if (seconds >= 0.35) return "…";
      return ",";
    })
    .replace(/\[пауза\]/giu, "…")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function cleanSubtitleText(text: string): string {
  return text.normalize("NFD").replace(/\p{Mn}/gu, "").normalize("NFC");
}

export async function generateSpeech(
  text: string,
  voiceId: string,
  modelId: string,
  settings: {
    speed: number;
    stability: number;
    similarity: number;
    style: number;
    speakerBoost: boolean;
    previousText?: string;
    nextText?: string;
  },
): Promise<Buffer> {
  const request: Record<string, unknown> = {
    text,
    modelId,
    outputFormat: "mp3_44100_128",
    voiceSettings: {
      stability: settings.stability,
      similarityBoost: settings.similarity,
      style: settings.style,
      speed: settings.speed,
      useSpeakerBoost: settings.speakerBoost,
    },
    previousText: settings.previousText,
    nextText: settings.nextText,
  };
  if (modelId !== "eleven_multilingual_v2") request.languageCode = "ru";
  const audio = await getClient().textToSpeech.convert(voiceId, request as never);
  const chunks: Buffer[] = [];
  for await (const chunk of audio as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function listElevenLabsVoices(): Promise<unknown[]> {
  const response = await getClient().voices.getAll();
  return ((response as unknown as { voices?: unknown[] }).voices || []);
}