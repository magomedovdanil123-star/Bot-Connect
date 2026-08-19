export const DEFAULT_FREE_RUSSIAN_VOICE = "google-ru";

export function getFreeTtsVoice(): string {
  return process.env["TTS_VOICE_ID"] || DEFAULT_FREE_RUSSIAN_VOICE;
}

export function isFreeTtsConfigured(): boolean {
  const provider = (process.env["TTS_PROVIDER"] || "elevenlabs").toLowerCase();
  return provider === "google_free" || provider === "edge";
}

export async function generateFreeRussianSpeech(text: string, voiceId = getFreeTtsVoice()): Promise<Buffer> {
  if (voiceId !== DEFAULT_FREE_RUSSIAN_VOICE) {
    throw new Error(`Unsupported free TTS voice: ${voiceId}. Use ${DEFAULT_FREE_RUSSIAN_VOICE}.`);
  }
  const chunks: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > 180 && current) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  if (!chunks.length) throw new Error("Free Russian TTS received empty text");

  const audioChunks: Buffer[] = [];
  for (const chunk of chunks) {
    const url = new URL("https://translate.google.com/translate_tts");
    url.searchParams.set("ie", "UTF-8");
    url.searchParams.set("client", "tw-ob");
    url.searchParams.set("tl", "ru");
    url.searchParams.set("q", chunk);
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Free Google Russian TTS failed (${response.status})`);
    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length) throw new Error("Free Google Russian TTS returned empty audio");
    audioChunks.push(audio);
  }
  return Buffer.concat(audioChunks);
}