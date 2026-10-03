// ../hype-market-focus/scripts/render-qnt-refined-live-radar.mjs
import { execFile as execFileCallback } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

// src/lib/audio-generation/elevenlabs-client.ts
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

// src/lib/audio-generation/free-tts.ts
var DEFAULT_FREE_RUSSIAN_VOICE = "google-ru";
function getFreeTtsVoice() {
  return process.env["TTS_VOICE_ID"] || DEFAULT_FREE_RUSSIAN_VOICE;
}
function isFreeTtsConfigured() {
  const provider = (process.env["TTS_PROVIDER"] || "elevenlabs").toLowerCase();
  return provider === "google_free" || provider === "edge";
}
async function generateFreeRussianSpeech(text, voiceId = getFreeTtsVoice()) {
  if (voiceId !== DEFAULT_FREE_RUSSIAN_VOICE) {
    throw new Error(`Unsupported free TTS voice: ${voiceId}. Use ${DEFAULT_FREE_RUSSIAN_VOICE}.`);
  }
  const chunks = [];
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
  const audioChunks = [];
  for (const chunk of chunks) {
    const url = new URL("https://translate.google.com/translate_tts");
    url.searchParams.set("ie", "UTF-8");
    url.searchParams.set("client", "tw-ob");
    url.searchParams.set("tl", "ru");
    url.searchParams.set("q", chunk);
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(3e4)
    });
    if (!response.ok) throw new Error(`Free Google Russian TTS failed (${response.status})`);
    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length) throw new Error("Free Google Russian TTS returned empty audio");
    audioChunks.push(audio);
  }
  return Buffer.concat(audioChunks);
}

// src/lib/audio-generation/lumean-client.ts
import { createHash } from "node:crypto";
var DEFAULT_BASE_URL = "https://api.lumean.app/api/public";
var TEMPLATE_PREFIX = "AI Content Factory";
var LUMEAN_SYNTHESIS_TIMEOUT_MESSAGE = "Lumean synthesis timed out after 4 minutes.";
var templateCache = /* @__PURE__ */ new Map();
function apiKey() {
  const value = process.env["LUMEAN_API_KEY"];
  if (!value) throw new Error("LUMEAN_API_KEY is not configured");
  return value;
}
function endpoint(path2) {
  return `${(process.env["LUMEAN_API_URL"] || DEFAULT_BASE_URL).replace(/\/+$/, "")}${path2}`;
}
function describeError(status, body) {
  if (status === 401) return "Lumean \u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B API-\u043A\u043B\u044E\u0447. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 LUMEAN_API_KEY.";
  if (status === 403) return "API-\u043A\u043B\u044E\u0447 Lumean \u043D\u0435 \u0438\u043C\u0435\u0435\u0442 \u043D\u0443\u0436\u043D\u044B\u0445 \u043F\u0440\u0430\u0432 (templates.read/write, orders.read/write, storage.read).";
  if (status === 402) {
    const amount = typeof body.shortfall_lmc === "number" ? ` \u041D\u0443\u0436\u043D\u043E \u043F\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u044C ${body.shortfall_lmc} LMC.` : "";
    return `\u041D\u0430 \u0431\u0430\u043B\u0430\u043D\u0441\u0435 \u0438\u043B\u0438 \u0432 \u043A\u0432\u043E\u0442\u0435 Lumean \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432.${amount}`;
  }
  if (status === 429) return "Lumean \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u043B \u0437\u0430\u043F\u0440\u043E\u0441\u044B \u0438\u043B\u0438 \u0438\u0441\u0447\u0435\u0440\u043F\u0430\u043D\u0430 \u0442\u043E\u043A\u0435\u043D-\u043A\u0432\u043E\u0442\u0430.";
  return body.message || `Lumean API error (HTTP ${status})`;
}
async function request(path2, init = {}) {
  const response = await fetch(endpoint(path2), {
    ...init,
    headers: {
      "X-API-KEY": apiKey(),
      "X-Locale": "ru",
      ...init.body ? { "Content-Type": "application/json" } : {},
      ...init.headers
    },
    signal: init.signal || AbortSignal.timeout(3e4)
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Lumean \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442 (HTTP ${response.status}).`);
  }
  if (!response.ok || !body.data) throw new Error(describeError(response.status, body));
  return body.data;
}
function templateSignature(voiceId, modelId, settings) {
  return createHash("sha256").update(JSON.stringify({ voiceId, modelId, settings })).digest("hex").slice(0, 12);
}
async function resolveTemplate(voiceId, modelId, settings) {
  const configured = process.env["LUMEAN_TEMPLATE_ID"];
  if (configured) return configured;
  const signature = templateSignature(voiceId, modelId, settings);
  const cached = templateCache.get(signature);
  if (cached) return cached;
  const name = `${TEMPLATE_PREFIX} ${signature}`;
  const templates = await request("/templates?per_page=100");
  const existing = templates.find((template) => template.name === name && template.id);
  if (existing?.id) {
    templateCache.set(signature, existing.id);
    return existing.id;
  }
  const created = await request("/templates", {
    method: "POST",
    body: JSON.stringify({
      service_key: "elevenlabs",
      name,
      is_public: false,
      config: {
        tts_settings: {
          mode: "mode_v1",
          model_id: modelId,
          voice_id: voiceId,
          language_code: "ru",
          advanced_voice_settings: true,
          apply_text_normalization: "auto",
          prev_next_text: true,
          voice_settings: {
            stability: settings.stability,
            similarity_boost: settings.similarity,
            style: settings.style,
            speed: settings.speed,
            use_speaker_boost: settings.speakerBoost
          }
        }
      }
    })
  });
  if (!created.id) throw new Error("Lumean \u0441\u043E\u0437\u0434\u0430\u043B \u0448\u0430\u0431\u043B\u043E\u043D \u0431\u0435\u0437 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u0430.");
  templateCache.set(signature, created.id);
  return created.id;
}
async function waitForOrder(orderId) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const order = await request(`/orders/${encodeURIComponent(orderId)}`);
    const status = (order.status || "").toLowerCase();
    if (status === "completed" || status === "result_delivered") return order;
    if (["failed", "compensated", "cancelled", "partially_completed"].includes(status)) {
      throw new Error(order.result?.user_message || `Lumean \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B \u043E\u0437\u0432\u0443\u0447\u043A\u0443: ${status}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2e3));
  }
  throw new Error(LUMEAN_SYNTHESIS_TIMEOUT_MESSAGE);
}
async function generateLumeanSpeech(text, voiceId, modelId, settings) {
  const templateId = await resolveTemplate(voiceId, modelId, settings);
  const created = await request("/orders", {
    method: "POST",
    body: JSON.stringify({
      template_id: templateId,
      input_text: text,
      name: text.replace(/\s+/g, " ").trim().slice(0, 60) || "\u041E\u0437\u0432\u0443\u0447\u043A\u0430"
    })
  });
  if (!created.id) throw new Error("Lumean \u0441\u043E\u0437\u0434\u0430\u043B \u0437\u0430\u043A\u0430\u0437 \u0431\u0435\u0437 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u0430.");
  const completed = await waitForOrder(created.id);
  const filePath = completed.result?.files?.[0];
  if (!filePath) throw new Error("Lumean \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B \u0437\u0430\u043A\u0430\u0437 \u0431\u0435\u0437 \u0430\u0443\u0434\u0438\u043E\u0444\u0430\u0439\u043B\u0430.");
  const download = await request("/storage/url", {
    method: "POST",
    body: JSON.stringify({ path: filePath, download: true })
  });
  if (!download.url) throw new Error("Lumean \u043D\u0435 \u0432\u0435\u0440\u043D\u0443\u043B \u0441\u0441\u044B\u043B\u043A\u0443 \u043D\u0430 \u0430\u0443\u0434\u0438\u043E\u0444\u0430\u0439\u043B.");
  const response = await fetch(download.url, { signal: AbortSignal.timeout(12e4) });
  if (!response.ok) throw new Error(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0430\u0443\u0434\u0438\u043E Lumean (HTTP ${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("Lumean \u0432\u0435\u0440\u043D\u0443\u043B \u043F\u0443\u0441\u0442\u043E\u0439 \u0430\u0443\u0434\u0438\u043E\u0444\u0430\u0439\u043B.");
  return buffer;
}

// src/lib/audio-generation/voice-api-client.ts
var DEFAULT_ENDPOINT = "https://voiceapi.csv666.ru";
var DEFAULT_VOICE_ID = "iP95p4xoKVk53GoZ742B";
var DEFAULT_MODEL_ID = "eleven_multilingual_v2";
function endpoint2(path2) {
  return `${(process.env["VOICE_API_URL"] || DEFAULT_ENDPOINT).replace(/\/+$/, "")}${path2}`;
}
function headers() {
  const apiKey2 = process.env["VOICE_API_KEY"];
  if (!apiKey2) throw new Error("VOICE_API_KEY is not configured");
  return { "X-API-Key": apiKey2, "Content-Type": "application/json" };
}
function errorMessage(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value;
    for (const key of ["ru", "en", "message", "detail"]) {
      const message = errorMessage(record[key]);
      if (message) return message;
    }
    return JSON.stringify(value);
  }
  return void 0;
}
async function readJsonResponse(response, label) {
  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch {
    const contentType = response.headers.get("content-type") || "unknown content type";
    const preview = body.replace(/\s+/g, " ").trim().slice(0, 180);
    throw new Error(
      `${label} \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435 JSON (HTTP ${response.status}, ${contentType}). \u041E\u0442\u0432\u0435\u0442: ${preview || "\u043F\u0443\u0441\u0442\u043E\u0439 \u043E\u0442\u0432\u0435\u0442"}`
    );
  }
}
function getVoiceApiVoiceId() {
  return process.env["VOICE_API_VOICE_ID"] || DEFAULT_VOICE_ID;
}
function getVoiceApiModelId() {
  return process.env["VOICE_API_MODEL_ID"] || DEFAULT_MODEL_ID;
}
async function withLumeanTimeoutFallback(primary, fallback) {
  try {
    return await primary();
  } catch (error) {
    if (!(error instanceof Error) || error.message !== LUMEAN_SYNTHESIS_TIMEOUT_MESSAGE || !fallback) {
      throw error;
    }
    return fallback();
  }
}
async function generateVoiceApiTaskSpeech(text, voiceId, modelId, settings) {
  const authHeaders = headers();
  const templateUuid = process.env["VOICE_API_TEMPLATE_UUID"];
  const requestBody = templateUuid ? { text, template_uuid: templateUuid } : {
    text,
    template: {
      model_id: modelId || getVoiceApiModelId(),
      voice_id: voiceId || getVoiceApiVoiceId(),
      voice_settings: {
        stability: settings.stability,
        similarity_boost: settings.similarity,
        style: settings.style,
        speed: settings.speed,
        use_speaker_boost: settings.speakerBoost
      },
      voice_result_type: "default",
      subtitles: false,
      voice_engine: "default"
    }
  };
  let createResponse;
  let created;
  let lastCreateError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(endpoint2("/tasks"), {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(requestBody),
        // Voice task creation can take longer while the provider queues synthesis.
        signal: AbortSignal.timeout(24e4)
      });
      if (response.status >= 500 && attempt < 3) {
        await response.text();
        await new Promise((resolve) => setTimeout(resolve, attempt * 3e3));
        continue;
      }
      createResponse = response;
      created = await readJsonResponse(
        response,
        "Voice API /tasks"
      );
      break;
    } catch (error) {
      lastCreateError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 3e3));
    }
  }
  if (!createResponse || !created) {
    throw lastCreateError instanceof Error ? new Error(`Voice API task creation failed after retry: ${lastCreateError.message}`) : new Error("Voice API task creation failed after retry");
  }
  if (!createResponse.ok || !created.task_id) {
    throw new Error(errorMessage(created.message) || errorMessage(created.error) || errorMessage(created.detail) || `Voice API task error (${createResponse.status})`);
  }
  let status = "waiting";
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const statusResponse = await fetch(endpoint2(`/tasks/${created.task_id}/status`), {
      headers: authHeaders,
      signal: AbortSignal.timeout(3e4)
    });
    const task = await readJsonResponse(
      statusResponse,
      "Voice API task status"
    );
    if (!statusResponse.ok) {
      throw new Error(errorMessage(task.detail) || `Voice API status error (${statusResponse.status})`);
    }
    status = (task.status || "").toLowerCase();
    if (["ending", "ending_processed", "completed", "success"].includes(status)) break;
    if (["error", "error_handled", "failed"].includes(status)) {
      throw new Error(task.error?.ru || task.error?.en || "Voice API synthesis failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 2e3));
  }
  if (!["ending", "ending_processed", "completed", "success"].includes(status)) {
    throw new Error("Voice API synthesis timed out");
  }
  let result;
  let lastResultError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      result = await fetch(endpoint2(`/tasks/${created.task_id}/result`), {
        headers: { "X-API-Key": authHeaders["X-API-Key"] },
        signal: AbortSignal.timeout(18e4)
      });
      break;
    } catch (error) {
      lastResultError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2e3));
    }
  }
  if (!result) {
    throw lastResultError instanceof Error ? new Error(`Voice API result download failed after retry: ${lastResultError.message}`) : new Error("Voice API result download failed after retry");
  }
  if (!result.ok) {
    const errorText = await result.text();
    throw new Error(errorText || `Voice API result error (${result.status})`);
  }
  const buffer = Buffer.from(await result.arrayBuffer());
  if (!buffer.length) throw new Error("Voice API returned an empty audio file");
  return buffer;
}
async function generateVoiceApiSpeech(text, voiceId, modelId, settings) {
  const directVoiceApi = () => generateVoiceApiTaskSpeech(text, voiceId, modelId, settings);
  if (!process.env["LUMEAN_API_KEY"]) return directVoiceApi();
  const fallback = process.env["VOICE_API_KEY"] ? async () => {
    console.warn(
      "[audio-generation] Lumean synthesis timed out; using the configured Voice API fallback."
    );
    try {
      return await directVoiceApi();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Lumean timed out and Voice API fallback failed: ${reason}`);
    }
  } : void 0;
  return withLumeanTimeoutFallback(
    () => generateLumeanSpeech(text, voiceId, modelId, settings),
    fallback
  );
}

// src/lib/audio-generation/elevenlabs-client.ts
var DEFAULT_ELEVENLABS_MODEL = "eleven_multilingual_v2";
var ElevenLabsNotConfiguredError = class extends Error {
  constructor() {
    super("ElevenLabs API key is not configured");
    this.name = "ElevenLabsNotConfiguredError";
  }
};
function getClient() {
  const apiKey2 = process.env["ELEVENLABS_API_KEY"];
  if (!apiKey2) throw new ElevenLabsNotConfiguredError();
  return new ElevenLabsClient({ apiKey: apiKey2 });
}
function getElevenLabsModel() {
  return process.env["ELEVENLABS_MODEL_ID"] || DEFAULT_ELEVENLABS_MODEL;
}
function getSpeechProvider() {
  const provider = (process.env["TTS_PROVIDER"] || "elevenlabs").toLowerCase();
  if (provider === "voice_api") return "voice_api";
  return isFreeTtsConfigured() ? "google_free" : "elevenlabs";
}
function getConfiguredVoiceId() {
  return getSpeechProvider() === "google_free" ? getFreeTtsVoice() : getSpeechProvider() === "voice_api" ? getVoiceApiVoiceId() : process.env["ELEVENLABS_VOICE_ID"] || "";
}
function prepareSpeechText(text) {
  const normalized = text.normalize("NFC").trim();
  return normalized.replace(/\[пауза(?:\s*[:=]?\s*)(\d+(?:[.,]\d+)?)\s*(?:с|сек|секунд)?\]/giu, (_match, rawSeconds) => {
    const seconds = Number.parseFloat(rawSeconds.replace(",", "."));
    if (!Number.isFinite(seconds) || seconds <= 0) return "\u2026";
    if (seconds >= 0.8) return ".";
    if (seconds >= 0.35) return "\u2026";
    return ",";
  }).replace(/\[пауза\]/giu, "\u2026").replace(/\s{2,}/g, " ").trim();
}
async function generateSpeech(text, voiceId, modelId, settings) {
  if (getSpeechProvider() === "google_free") {
    return generateFreeRussianSpeech(text, getFreeTtsVoice());
  }
  if (getSpeechProvider() === "voice_api") {
    return generateVoiceApiSpeech(text, getVoiceApiVoiceId(), getVoiceApiModelId(), settings);
  }
  return generateElevenLabsSpeech(text, voiceId, modelId, settings);
}
async function generateElevenLabsSpeech(text, voiceId, modelId, settings) {
  const request2 = {
    text,
    modelId,
    outputFormat: "mp3_44100_128",
    voiceSettings: {
      stability: settings.stability,
      similarityBoost: settings.similarity,
      style: settings.style,
      speed: settings.speed,
      useSpeakerBoost: settings.speakerBoost
    },
    previousText: settings.previousText,
    nextText: settings.nextText
  };
  request2.languageCode = "ru";
  const audio = await getClient().textToSpeech.convert(voiceId, request2);
  const chunks = [];
  for await (const chunk of audio) {
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);
  if (!buffer.length) throw new Error("ElevenLabs returned an empty audio file.");
  return buffer;
}

// ../hype-market-focus/scripts/render-qnt-refined-live-radar.mjs
var execFile = promisify(execFileCallback);
var FPS = 30;
var ROOT = path.resolve(
  process.env.QNT_VIDEO_PROJECT_ROOT || path.resolve(import.meta.dirname, "..")
);
var EXPORT_DIR = path.join(ROOT, "exports", "qnt-visual-variants");
var BASE_VIDEO = path.join(EXPORT_DIR, "qnt-01-impact-refined.mp4");
var RADAR_DIR = path.join(
  ROOT,
  "exports",
  "qnt-live-radar",
  "SAND-20261003-061347UTC"
);
var RADAR_VIDEO = path.join(
  RADAR_DIR,
  "qnt-live-radar-SAND-20261003-061347UTC.mp4"
);
var RADAR_SCRIPT = path.join(RADAR_DIR, "SCRIPT.md");
var SNAPSHOT_PATH = path.join(RADAR_DIR, "market-snapshot.json");
var OUTPUT_VIDEO = path.join(
  EXPORT_DIR,
  "qnt-01-impact-refined-live-radar.mp4"
);
var OUTPUT_SCRIPT = path.join(
  ROOT,
  "exports",
  "SCRIPT-QNT-IMPACT-REFINED-LIVE-RADAR.md"
);
var MUSIC = path.resolve(
  ROOT,
  "..",
  "api-server",
  "assets",
  "audio",
  "coin-overview-music-bed.mp3"
);
var CTA_TEXT = "\u0421\u044D\u043D\u0434, \u043D\u0435 \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438: \u043F\u043E\u0441\u043C\u043E\u0442\u0440\u0438 \u044D\u0442\u0443 \u043C\u043E\u043D\u0435\u0442\u0443 \u043D\u0430 \u0431\u0438\u0440\u0436\u0435 \u043F\u0440\u044F\u043C\u043E \u0441\u0435\u0439\u0447\u0430\u0441. \u0421\u0441\u044B\u043B\u043A\u0430 \u2014 \u0432 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0438.";
var CTA_BANNER = "\u041D\u0415 \u041F\u0420\u041E\u041F\u0423\u0421\u0422\u0418 SAND \xB7 \u041F\u0420\u041E\u0412\u0415\u0420\u042C \u041D\u0410 \u0411\u0418\u0420\u0416\u0415 \xB7 \u0421\u0421\u042B\u041B\u041A\u0410 \u0412 \u041E\u041F\u0418\u0421\u0410\u041D\u0418\u0418";
var VOICE_SETTINGS = {
  speed: 0.98,
  stability: 0.52,
  similarity: 0.78,
  style: 0.2,
  speakerBoost: true
};
async function probeMedia(filePath) {
  const { stdout } = await execFile("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,width,height,r_frame_rate,duration",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath
  ]);
  return JSON.parse(stdout);
}
async function probeDuration(filePath) {
  const { stdout } = await execFile("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath
  ]);
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not read audio duration: ${filePath}`);
  }
  return duration;
}
async function main() {
  await Promise.all([
    access(BASE_VIDEO),
    access(RADAR_VIDEO),
    access(RADAR_SCRIPT),
    access(SNAPSHOT_PATH),
    access(MUSIC)
  ]);
  const baseProbe = await probeMedia(BASE_VIDEO);
  const radarProbe = await probeMedia(RADAR_VIDEO);
  const baseVideo = baseProbe.streams.find((stream) => stream.codec_type === "video");
  const baseAudio = baseProbe.streams.find((stream) => stream.codec_type === "audio");
  const radarVideo = radarProbe.streams.find((stream) => stream.codec_type === "video");
  const radarAudio = radarProbe.streams.find((stream) => stream.codec_type === "audio");
  if (!baseVideo || !baseAudio || !radarVideo || !radarAudio || baseVideo.width !== 1080 || baseVideo.height !== 1920 || radarVideo.width !== 1080 || radarVideo.height !== 1920) {
    throw new Error("Expected both source videos to contain 1080\xD71920 video and audio.");
  }
  const baseFrameCount = Math.round(Number(baseProbe.format.duration) * FPS);
  const baseDuration = baseFrameCount / FPS;
  const baseAudioDuration = Number(baseAudio.duration);
  const baseAudioPad = Math.max(0, baseDuration - baseAudioDuration);
  const radarScript = await readFile(RADAR_SCRIPT, "utf8");
  const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
  const timelineRows = [
    ...radarScript.matchAll(
      /^\|\s*(\d+)\s*\|\s*([\d.]+)[–-]([\d.]+)\s*\|\s*([^|]+)\|/gmu
    )
  ];
  const radarRowIndex = timelineRows.findIndex(
    (row) => row[4].trim().startsWith("\u041D\u0410 \u0420\u0410\u0414\u0410\u0420\u0415 \u0421\u0415\u0419\u0427\u0410\u0421")
  );
  const radarNarration = radarScript.match(/^3\.\s+(.+)$/mu)?.[1]?.trim();
  if (radarRowIndex < 1 || !radarNarration || snapshot.selected?.symbol !== "SANDUSDT") {
    throw new Error("Could not verify the saved SAND radar scene and narration.");
  }
  const radarRow = timelineRows[radarRowIndex];
  const radarStartSeconds = Number(radarRow[2]);
  const radarFrames = Math.round((Number(radarRow[3]) - radarStartSeconds) * FPS);
  const radarStartFrame = timelineRows.slice(0, radarRowIndex).reduce(
    (frames, row) => frames + Math.round((Number(row[3]) - Number(row[2])) * FPS),
    0
  );
  const radarDuration = radarFrames / FPS;
  if (radarFrames < 1 || radarDuration > 20) {
    throw new Error("The saved SAND radar scene has an invalid duration.");
  }
  const provider = getSpeechProvider();
  const voiceId = getConfiguredVoiceId();
  if (!voiceId) {
    throw new Error(
      `The configured ${provider} speech provider has no voice ID; refusing to substitute another voice.`
    );
  }
  const ctaAudio = await generateSpeech(
    prepareSpeechText(CTA_TEXT),
    voiceId,
    getElevenLabsModel(),
    { ...VOICE_SETTINGS, previousText: radarNarration }
  );
  if (!ctaAudio?.length) throw new Error("The configured voice provider returned no CTA audio.");
  const tempDir = path.join("/tmp", `qnt-refined-radar-${process.pid}`);
  const ctaAudioPath = path.join(tempDir, "cta.mp3");
  const bannerPath = path.join(tempDir, "cta-banner.txt");
  const outputDir = path.dirname(OUTPUT_VIDEO);
  await mkdir(tempDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await writeFile(ctaAudioPath, ctaAudio);
  await writeFile(bannerPath, CTA_BANNER, "utf8");
  const ctaRawDuration = await probeDuration(ctaAudioPath);
  const ctaFrames = Math.max(120, Math.ceil((ctaRawDuration + 0.45) * FPS));
  const ctaHoldDuration = ctaFrames / FPS;
  const totalFrames = baseFrameCount + radarFrames + ctaFrames;
  const totalDuration = totalFrames / FPS;
  if (totalDuration > 60) {
    throw new Error(
      `The appended version would be ${totalDuration.toFixed(2)} seconds; shorten the CTA before rendering.`
    );
  }
  const fontMatch = await execFile("fc-match", [
    "-f",
    "%{file}",
    "DejaVu Sans:style=Bold"
  ]);
  const fontPath = fontMatch.stdout.trim();
  if (!fontPath) throw new Error("Could not locate a bold DejaVu font for the CTA banner.");
  const holdStart = radarDuration.toFixed(6);
  const ctaFadeOutStart = Math.max(0, ctaHoldDuration - 0.65).toFixed(6);
  const radarVideoFilters = [
    `trim=start_frame=${radarStartFrame}:end_frame=${radarStartFrame + radarFrames}`,
    "setpts=PTS-STARTPTS",
    `fps=${FPS}`,
    "setsar=1",
    `tpad=stop_mode=clone:stop_duration=${ctaHoldDuration.toFixed(6)}`,
    "drawbox=x=895:y=39:w=128:h=36:color=0x080c0b:t=fill",
    `drawtext=fontfile=${fontPath}:text=FINAL:fontcolor=0x91a097:fontsize=18:x=1004-text_w:y=63`,
    `drawbox=x=96:y=598:w=888:h=105:color=0x101714@0.98:t=fill:enable='gte(t,${holdStart})'`,
    `drawbox=x=96:y=598:w=888:h=105:color=0xd6ff39@0.9:t=2:enable='gte(t,${holdStart})'`,
    `drawtext=fontfile=${fontPath}:textfile=${bannerPath}:fontcolor=0xd6ff39:fontsize=22:x=(w-text_w)/2:y=642:enable='gte(t,${holdStart})'`,
    "format=yuv420p"
  ].join(",");
  const filterGraph = [
    `[0:v]fps=${FPS},setsar=1,format=yuv420p,setpts=PTS-STARTPTS[basev]`,
    `[1:v]${radarVideoFilters}[radarv]`,
    `[basev][radarv]concat=n=2:v=1:a=0[v]`,
    `[0:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS,apad=pad_dur=${baseAudioPad.toFixed(6)},atrim=duration=${baseDuration.toFixed(6)}[basea]`,
    `[1:a]atrim=start=${radarStartSeconds.toFixed(6)}:duration=${radarDuration.toFixed(6)},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,apad=pad_dur=0.1,atrim=duration=${radarDuration.toFixed(6)}[radara]`,
    `[2:a]aresample=48000,aformat=channel_layouts=stereo,apad=pad_dur=${ctaHoldDuration.toFixed(6)},atrim=duration=${ctaHoldDuration.toFixed(6)},asetpts=PTS-STARTPTS[ctavoice]`,
    `[3:a]volume=0.13,afade=t=in:st=0:d=0.4,afade=t=out:st=${ctaFadeOutStart}:d=0.65,atrim=duration=${ctaHoldDuration.toFixed(6)},aresample=48000,aformat=channel_layouts=stereo[ctamusic]`,
    `[ctavoice][ctamusic]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[ctaa]`,
    `[basea][radara][ctaa]concat=n=3:v=0:a=1[a]`
  ].join(";");
  console.log(
    `Appending SAND radar (${radarDuration.toFixed(2)} s) and a ${ctaRawDuration.toFixed(2)} s spoken CTA to the refined QNT version.`
  );
  await execFile(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "warning",
      "-i",
      BASE_VIDEO,
      "-i",
      RADAR_VIDEO,
      "-i",
      ctaAudioPath,
      "-stream_loop",
      "-1",
      "-i",
      MUSIC,
      "-filter_complex",
      filterGraph,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-frames:v",
      String(totalFrames),
      "-t",
      totalDuration.toFixed(6),
      "-r",
      String(FPS),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      OUTPUT_VIDEO
    ],
    { timeout: 3e5, maxBuffer: 12 * 1024 * 1024 }
  );
  const snapshotAt = snapshot.scannedAt;
  const windowStart = new Date(snapshot.selected.candleOpenTime).toISOString();
  const windowEnd = new Date(snapshot.selected.candleCloseTime).toISOString();
  const script = `# QNT \u2014 Impact: \u0443\u0442\u043E\u0447\u043D\u0451\u043D\u043D\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F + SAND \u043D\u0430 \u0440\u0430\u0434\u0430\u0440\u0435

## \u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u0430\u044F \u043E\u0441\u043D\u043E\u0432\u0430

- \u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0439 \u0444\u0430\u0439\u043B \u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D \u0431\u0435\u0437 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439: qnt-01-impact-refined.mp4.
- \u041F\u0435\u0440\u0432\u044B\u0435 ${baseFrameCount} \u043A\u0430\u0434\u0440\u043E\u0432 \u0438 \u0438\u0441\u0445\u043E\u0434\u043D\u0430\u044F \u0430\u0443\u0434\u0438\u043E\u0434\u043E\u0440\u043E\u0436\u043A\u0430 \u0438\u0434\u0443\u0442 \u043F\u0435\u0440\u0432\u044B\u043C\u0438 \u0431\u0435\u0437 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0442\u0435\u043A\u0441\u0442\u0430 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F.
- \u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0439 QNT-\u0441\u0440\u0435\u0437 \u0438 \u0432\u0435\u0441\u044C \u0438\u0441\u0442\u043E\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0431\u043B\u043E\u043A \u043E\u0441\u0442\u0430\u044E\u0442\u0441\u044F \u043F\u0440\u0435\u0436\u043D\u0438\u043C\u0438.

## \u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043D\u044B\u0439 \u0444\u0438\u043D\u0430\u043B

- \u041A\u0430\u043D\u0434\u0438\u0434\u0430\u0442: ${snapshot.selected.symbol} \xB7 Binance Spot.
- \u0421\u043D\u0438\u043C\u043E\u043A \u0440\u044B\u043D\u043A\u0430: ${snapshotAt} UTC.
- \u0417\u0430\u043A\u0440\u044B\u0442\u043E\u0435 4h-\u043E\u043A\u043D\u043E: ${windowStart} \u2014 ${windowEnd} UTC.
- \u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435: +${snapshot.selected.priceChange4h.toFixed(2)}% \u0437\u0430 4h.
- \u041E\u0431\u043E\u0440\u043E\u0442: ${(snapshot.selected.quoteVolume4h / 1e6).toFixed(2)} \u043C\u043B\u043D USDT.
- \u041E\u0431\u044A\u0451\u043C \u043A \u0441\u0440\u0435\u0434\u043D\u0435\u043C\u0443 \u0437\u0430 42 \u043F\u0440\u0435\u0434\u0448\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u0437\u0430\u043A\u0440\u044B\u0442\u044B\u0435 4h-\u0441\u0432\u0435\u0447\u0438: ${snapshot.selected.volumeRatio.toFixed(2)}\xD7.
- \u0422\u0430\u0439\u043C\u043A\u043E\u0434 \u0440\u0430\u0434\u0430\u0440\u0430: ${(baseFrameCount / FPS).toFixed(2)}\u2013${((baseFrameCount + radarFrames) / FPS).toFixed(2)} \u0441.
- \u0422\u0430\u0439\u043C\u043A\u043E\u0434 \u0444\u0438\u043D\u0430\u043B\u044C\u043D\u043E\u0433\u043E CTA: ${((baseFrameCount + radarFrames) / FPS).toFixed(2)}\u2013${totalDuration.toFixed(2)} \u0441.
- \u041E\u0437\u0432\u0443\u0447\u043A\u0430 \u0440\u0430\u0434\u0430\u0440\u0430: ${radarNarration}
- \u041D\u043E\u0432\u0430\u044F \u043E\u0437\u0432\u0443\u0447\u043A\u0430 CTA: ${CTA_TEXT}
- \u042D\u043A\u0440\u0430\u043D\u043D\u0430\u044F \u043F\u043B\u0430\u0448\u043A\u0430 \u0432 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u043C \u043A\u0430\u0434\u0440\u0435: ${CTA_BANNER}

## \u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438

- \u041E\u0441\u043D\u043E\u0432\u043D\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F: exports/qnt-visual-variants/qnt-01-impact-refined.mp4.
- \u0420\u0430\u0434\u0430\u0440 \u0438 \u0442\u0430\u0439\u043C\u043A\u043E\u0434 \u0434\u0430\u043D\u043D\u044B\u0445: exports/qnt-live-radar/SAND-20261003-061347UTC/.
- \u041D\u043E\u0432\u044B\u0439 \u0433\u043E\u043B\u043E\u0441 CTA \u0441\u043E\u0437\u0434\u0430\u043D \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u043C \u0433\u043E\u043B\u043E\u0441\u043E\u0432\u044B\u043C \u043F\u0440\u043E\u0432\u0430\u0439\u0434\u0435\u0440\u043E\u043C \u043F\u0440\u043E\u0435\u043A\u0442\u0430.
- \u0418\u0442\u043E\u0433: 1080\xD71920, 30 fps, ${totalDuration.toFixed(2)} \u0441.
`;
  await writeFile(OUTPUT_SCRIPT, script, "utf8");
  const finalProbe = await probeMedia(OUTPUT_VIDEO);
  console.log(`Completed: ${OUTPUT_VIDEO}`);
  console.log(JSON.stringify(finalProbe, null, 2));
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
