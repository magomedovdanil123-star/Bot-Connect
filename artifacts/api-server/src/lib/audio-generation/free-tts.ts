import { tts } from "edge-tts";

export const DEFAULT_FREE_RUSSIAN_VOICE = "ru-RU-SvetlanaNeural";

export function getFreeTtsVoice(): string {
  return process.env["TTS_VOICE_ID"] || DEFAULT_FREE_RUSSIAN_VOICE;
}

export function isFreeTtsConfigured(): boolean {
  return (process.env["TTS_PROVIDER"] || "elevenlabs").toLowerCase() === "edge";
}

export async function generateFreeRussianSpeech(text: string, voiceId = getFreeTtsVoice()): Promise<Buffer> {
  const audio = await tts(text, {
    voice: voiceId,
    rate: process.env["TTS_RATE"] || "+0%",
    pitch: process.env["TTS_PITCH"] || "+0Hz",
  });
  if (!audio.length) throw new Error("Free Russian TTS returned empty audio");
  return audio;
}