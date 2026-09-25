import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);

// .tmp-bitcoin-render-runner.ts
import { readFile as readFile2, writeFile as writeFile2 } from "node:fs/promises";
import { resolve } from "node:path";

// src/lib/financial-short-renderer.ts
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
async function generateFreeRussianSpeech(text2, voiceId = getFreeTtsVoice()) {
  if (voiceId !== DEFAULT_FREE_RUSSIAN_VOICE) {
    throw new Error(`Unsupported free TTS voice: ${voiceId}. Use ${DEFAULT_FREE_RUSSIAN_VOICE}.`);
  }
  const chunks = [];
  let current = "";
  for (const word of text2.split(/\s+/).filter(Boolean)) {
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
var templateCache = /* @__PURE__ */ new Map();
function apiKey() {
  const value = process.env["LUMEAN_API_KEY"];
  if (!value) throw new Error("LUMEAN_API_KEY is not configured");
  return value;
}
function endpoint(path) {
  return `${(process.env["LUMEAN_API_URL"] || DEFAULT_BASE_URL).replace(/\/+$/, "")}${path}`;
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
async function request(path, init = {}) {
  const response = await fetch(endpoint(path), {
    ...init,
    headers: {
      "X-API-KEY": apiKey(),
      "X-Locale": "ru",
      ...init.body ? { "Content-Type": "application/json" } : {},
      ...init.headers
    },
    signal: init.signal || AbortSignal.timeout(3e4)
  });
  const text2 = await response.text();
  let body;
  try {
    body = JSON.parse(text2);
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
    await new Promise((resolve2) => setTimeout(resolve2, 2e3));
  }
  throw new Error("Lumean synthesis timed out after 4 minutes.");
}
async function generateLumeanSpeech(text2, voiceId, modelId, settings) {
  const templateId = await resolveTemplate(voiceId, modelId, settings);
  const created = await request("/orders", {
    method: "POST",
    body: JSON.stringify({
      template_id: templateId,
      input_text: text2,
      name: text2.replace(/\s+/g, " ").trim().slice(0, 60) || "\u041E\u0437\u0432\u0443\u0447\u043A\u0430"
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
function endpoint2(path) {
  return `${(process.env["VOICE_API_URL"] || DEFAULT_ENDPOINT).replace(/\/+$/, "")}${path}`;
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
async function generateVoiceApiSpeech(text2, voiceId, modelId, settings) {
  if (process.env["LUMEAN_API_KEY"]) {
    return generateLumeanSpeech(text2, voiceId, modelId, settings);
  }
  const authHeaders = headers();
  const templateUuid = process.env["VOICE_API_TEMPLATE_UUID"];
  const requestBody = templateUuid ? { text: text2, template_uuid: templateUuid } : {
    text: text2,
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
        await new Promise((resolve2) => setTimeout(resolve2, attempt * 3e3));
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
      if (attempt < 3) await new Promise((resolve2) => setTimeout(resolve2, attempt * 3e3));
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
    await new Promise((resolve2) => setTimeout(resolve2, 2e3));
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
      if (attempt < 2) await new Promise((resolve2) => setTimeout(resolve2, 2e3));
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
function prepareSpeechText(text2) {
  const normalized = text2.normalize("NFC").trim();
  return normalized.replace(/\[пауза(?:\s*[:=]?\s*)(\d+(?:[.,]\d+)?)\s*(?:с|сек|секунд)?\]/giu, (_match, rawSeconds) => {
    const seconds = Number.parseFloat(rawSeconds.replace(",", "."));
    if (!Number.isFinite(seconds) || seconds <= 0) return "\u2026";
    if (seconds >= 0.8) return ".";
    if (seconds >= 0.35) return "\u2026";
    return ",";
  }).replace(/\[пауза\]/giu, "\u2026").replace(/\s{2,}/g, " ").trim();
}
async function generateSpeech(text2, voiceId, modelId, settings) {
  if (getSpeechProvider() === "google_free") {
    return generateFreeRussianSpeech(text2, getFreeTtsVoice());
  }
  if (getSpeechProvider() === "voice_api") {
    return generateVoiceApiSpeech(text2, getVoiceApiVoiceId(), getVoiceApiModelId(), settings);
  }
  const request2 = {
    text: text2,
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
  return Buffer.concat(chunks);
}

// src/lib/finance-style-dna.ts
var FINANCE_STYLE_DNA = {
  width: 1080,
  height: 1920,
  fps: 30,
  colors: {
    backgroundTop: "#0B151D",
    backgroundBottom: "#050A0E",
    panel: "#101B24",
    panelDark: "#0D1A22",
    panelEdge: "#294051",
    green: "#35E69A",
    greenSoft: "#B9F7D8",
    white: "#F7FBFF",
    muted: "#92A4B5",
    gold: "#F4D477",
    red: "#FF8D8D"
  },
  typography: {
    family: "DejaVu Sans",
    titleSize: 38,
    sceneTitleSize: 25,
    subtitleSize: 26
  },
  geometry: {
    safeTop: 150,
    safeBottom: 240
  }
};
var FINANCE_BRAND_PROFILE = {
  label: "Finance DNA \xB7 Premium Creator",
  presenter: "Existing approved financial presenter; preserve the same identity and appearance.",
  quality: {
    width: FINANCE_STYLE_DNA.width,
    height: FINANCE_STYLE_DNA.height,
    fps: FINANCE_STYLE_DNA.fps
  },
  colors: FINANCE_STYLE_DNA.colors,
  typography: FINANCE_STYLE_DNA.typography,
  safeZones: {
    topPx: FINANCE_STYLE_DNA.geometry.safeTop,
    bottomPx: FINANCE_STYLE_DNA.geometry.safeBottom
  }
};
var animationProperties = [
  "position",
  "scale",
  "rotation",
  "opacity",
  "color",
  "enter",
  "exit",
  "movement",
  "delay",
  "duration",
  "easing"
];
var objectKinds = [
  ["investor", "actor"],
  ["company", "actor"],
  ["bank", "actor"],
  ["government", "actor"],
  ["broker", "actor"],
  ["wallet", "utility"],
  ["money", "instrument"],
  ["gold", "instrument"],
  ["coin", "instrument"],
  ["ruble", "instrument"],
  ["bond", "instrument"],
  ["stock", "instrument"],
  ["dividend", "metric"],
  ["percentage", "metric"],
  ["chart_up", "chart"],
  ["chart_down", "chart"],
  ["candlestick_chart", "chart"],
  ["portfolio", "utility"],
  ["brokerage_account", "utility"],
  ["document", "utility"],
  ["calendar", "utility"],
  ["clock", "utility"],
  ["shield", "risk"],
  ["warning", "risk"],
  ["arrow", "utility"],
  ["money_flow", "utility"],
  ["payment", "metric"],
  ["coupon", "metric"],
  ["interest", "metric"],
  ["balance", "metric"],
  ["calculator", "utility"],
  ["phone", "utility"],
  ["laptop", "utility"]
];
var FINANCE_OBJECT_LIBRARY = objectKinds.map(([kind, role]) => ({
  kind,
  role,
  supports: animationProperties
}));

// src/lib/financial-presenter.ts
function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}
function ease(value) {
  const progress = clamp(value);
  return 1 - (1 - progress) ** 3;
}
function speechUnits(text2) {
  const tokens = text2.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*[,.!?;:…]?/gu) ?? [];
  const units = [];
  for (const token of tokens) {
    const punctuation = token.match(/[,.!?;:…]+$/u)?.[0] ?? "";
    const word = punctuation ? token.slice(0, -punctuation.length) : token;
    const vowelGroups = word.toLocaleLowerCase("ru-RU").match(/[аеёиоуыэюяaeiouy]+/gu)?.length ?? 0;
    const syllables = Math.max(1, vowelGroups);
    for (let index = 0; index < syllables; index += 1) {
      units.push({ kind: "syllable", weight: 1 });
    }
    const pauseWeight = /[.!?…]/u.test(punctuation) ? 0.9 : /[,;:]/u.test(punctuation) ? 0.55 : 0.22;
    units.push({ kind: "pause", weight: pauseWeight });
  }
  return units;
}
var NON_KEYWORD_WORDS = /* @__PURE__ */ new Set([
  "\u0430",
  "\u0431\u0435\u0437",
  "\u0431\u044B",
  "\u0431\u0443\u0434\u0435\u0442",
  "\u0431\u0443\u0434\u0443\u0442",
  "\u0432",
  "\u0432\u043E",
  "\u0432\u043E\u0442",
  "\u0432\u0441\u0435",
  "\u0432\u0441\u0451",
  "\u0434\u043B\u044F",
  "\u0434\u043E",
  "\u0435\u0441\u043B\u0438",
  "\u0435\u0449\u0451",
  "\u0435\u0449\u0435",
  "\u0435\u0441\u0442\u044C",
  "\u0435\u0451",
  "\u0435\u0433\u043E",
  "\u0436\u0435",
  "\u0437\u0430",
  "\u0438",
  "\u0438\u043B\u0438",
  "\u0438\u0437",
  "\u0438\u0445",
  "\u043A",
  "\u043A\u0430\u043A",
  "\u043A\u043E\u0433\u0434\u0430",
  "\u043A\u043E\u0442\u043E\u0440\u044B\u0439",
  "\u043B\u0438",
  "\u043C\u043D\u0435",
  "\u043C\u043E\u0436\u0435\u0442",
  "\u043C\u043E\u0436\u043D\u043E",
  "\u043C\u043E\u0433\u0443\u0442",
  "\u043C\u044B",
  "\u043D\u0430",
  "\u043D\u0430\u0434",
  "\u043D\u0435",
  "\u043D\u043E",
  "\u043E",
  "\u043E\u0431",
  "\u043E\u043D",
  "\u043E\u043D\u0430",
  "\u043E\u043D\u0438",
  "\u043E\u043D\u043E",
  "\u043E\u0442",
  "\u043F\u043E",
  "\u043F\u043E\u0434",
  "\u043F\u0440\u0438",
  "\u043F\u0440\u043E",
  "\u0441",
  "\u0441\u043E",
  "\u0442\u0430\u043A",
  "\u0442\u0430\u043C",
  "\u0442\u043E",
  "\u0442\u043E\u0436\u0435",
  "\u0442\u044B",
  "\u0443",
  "\u0443\u0436\u0435",
  "\u0447\u0442\u043E",
  "\u044D\u0442\u043E",
  "\u044F"
]);
function normalizeKeyword(value) {
  return value.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]/gu, "");
}
function getSpeechWordTimings(value) {
  const words = [];
  let totalWeight = 0;
  const tokens = value.matchAll(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*%?[,.!?;:…]?/gu);
  for (const match of tokens) {
    const token = match[0];
    const punctuation = token.match(/[,.!?;:…]+$/u)?.[0] ?? "";
    const word = punctuation ? token.slice(0, -punctuation.length) : token;
    const normalized = normalizeKeyword(word);
    if (!normalized) continue;
    const vowelGroups = word.toLocaleLowerCase("ru-RU").match(/[аеёиоуыэюяaeiouy]+/gu)?.length ?? 0;
    const syllables = Math.max(1, vowelGroups);
    const start = totalWeight;
    totalWeight += syllables;
    words.push({ word, normalized, punctuation, start, end: totalWeight });
    totalWeight += /[.!?…]/u.test(punctuation) ? 0.9 : /[,;:]/u.test(punctuation) ? 0.55 : 0.22;
  }
  return { words, totalWeight };
}
function isSameKeywordFamily(left, right) {
  if (left === right) return true;
  const sharedLength = Math.min(left.length, right.length, 6);
  return sharedLength >= 5 && left.slice(0, sharedLength) === right.slice(0, sharedLength);
}
function selectSpokenKeywords(title, words) {
  const titleTerms = (title.match(/[\p{L}\p{N}]+%?/gu) ?? []).map(normalizeKeyword).filter((word) => word && !NON_KEYWORD_WORDS.has(word));
  const selectedIndexes = /* @__PURE__ */ new Set();
  for (const term of titleTerms) {
    const matchIndex = words.findIndex((word, index) => !selectedIndexes.has(index) && !NON_KEYWORD_WORDS.has(word.normalized) && isSameKeywordFamily(term, word.normalized));
    if (matchIndex >= 0) selectedIndexes.add(matchIndex);
  }
  const contentIndexes = words.map((word, index) => ({ word, index })).filter(({ word }) => !NON_KEYWORD_WORDS.has(word.normalized)).map(({ index }) => index);
  const desiredKeywordCount = Math.min(4, contentIndexes.length);
  for (let sample = 0; sample < desiredKeywordCount; sample += 1) {
    const sampleIndex = desiredKeywordCount === 1 ? 0 : Math.round(sample * (contentIndexes.length - 1) / (desiredKeywordCount - 1));
    selectedIndexes.add(contentIndexes[sampleIndex]);
  }
  if (selectedIndexes.size < desiredKeywordCount) {
    for (const index of contentIndexes) {
      selectedIndexes.add(index);
      if (selectedIndexes.size >= desiredKeywordCount) break;
    }
  }
  return [...selectedIndexes].sort((left, right) => left - right).slice(0, 6).map((index) => words[index]);
}
function speechMouthIsOpen(beat, progress) {
  const units = speechUnits(beat.lipSyncText || beat.voiceText || beat.subtitle);
  const totalWeight = units.reduce((sum, unit) => sum + unit.weight, 0);
  if (!totalWeight) return false;
  let position = clamp(progress) * totalWeight;
  for (const unit of units) {
    if (position < unit.weight) {
      if (unit.kind === "pause") return false;
      return Math.sin(Math.PI * clamp(position / unit.weight)) > 0.24;
    }
    position -= unit.weight;
  }
  return false;
}
function stablePoseSeed(value, size) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0) % size;
}
function getPresenterAnimationState(beat, progress, absoluteTimeMs) {
  const meaning = `${beat.visual} ${beat.visualAction || ""} ${beat.title} ${beat.subtitle}`.toLocaleLowerCase("ru-RU");
  const caution = /риск|осторож|марж|убыт|плеч|паден|сниж|опас|предупрежд/iu.test(meaning) || beat.visual === "leverage" || beat.visual === "risk";
  const confident = !caution && (/результат|вывод|итог|важн|ключев|прибыл|рост|решен/iu.test(meaning) || ["hook", "payoff", "comparison", "summary", "ownership"].includes(beat.visual));
  const analytical = /услов|контракт|сравн|расч[её]т|номинал|доходност|процент|ставк|позици|пример|стоимост|срок/iu.test(meaning);
  const semanticPoseOptions = caution ? ["caution", "thinking-temple", "shrug-surprised", "thinking-arms"] : confident ? ["confident", "pointing-up", "aha", "reassuring"] : analytical ? ["thinking-chin", "pointing-up", "thinking-temple", "thinking-arms", "speaking"] : ["speaking", "thinking-chin", "pointing-up", "shrug-surprised", "aha", "reassuring", "confident", "thinking-temple", "thinking-arms", "caution"];
  const fiveSecondCycle = Math.floor(Math.max(0, absoluteTimeMs) / 5e3);
  const continuationOptions = beat.presenterPose ? semanticPoseOptions.filter((pose2) => pose2 !== beat.presenterPose) : semanticPoseOptions;
  const seed = stablePoseSeed(`${beat.visual}:${beat.title}`, continuationOptions.length);
  const pose = beat.presenterPose && fiveSecondCycle === 0 ? beat.presenterPose : continuationOptions[(seed + (beat.presenterPose ? fiveSecondCycle - 1 : fiveSecondCycle)) % continuationOptions.length];
  return {
    pose,
    mouthOpen: speechMouthIsOpen(beat, progress)
  };
}
function renderPremiumCreatorBackground(timeMs) {
  const drift = Math.sin(timeMs / 4200) * 18;
  const dust = Array.from({ length: 5 }, (_, index) => {
    const x = 135 + index * 206 + Math.sin(timeMs / 1400 + index) * 12;
    const y = 355 + (index * 137 + Math.round(timeMs / 36)) % 780;
    const opacity = 0.12 + index % 3 * 0.045;
    return `<circle cx="${x.toFixed(1)}" cy="${y}" r="${index % 2 ? 2 : 3}" fill="#D7AF70" opacity="${opacity.toFixed(2)}"/>`;
  }).join("");
  return `<defs>
    <linearGradient id="creator-studio-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#10171B"/>
      <stop offset=".56" stop-color="#11191A"/>
      <stop offset="1" stop-color="#090D0E"/>
    </linearGradient>
    <radialGradient id="creator-host-light" cx="50%" cy="48%" r="64%">
      <stop offset="0" stop-color="#D29851" stop-opacity=".24"/>
      <stop offset=".52" stop-color="#8E673B" stop-opacity=".09"/>
      <stop offset="1" stop-color="#090D0E" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="creator-visual-light" cx="82%" cy="35%" r="66%">
      <stop offset="0" stop-color="#397769" stop-opacity=".15"/>
      <stop offset=".52" stop-color="#233C3B" stop-opacity=".08"/>
      <stop offset="1" stop-color="#090D0E" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="creator-floor-fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#17211F" stop-opacity="0"/>
      <stop offset="1" stop-color="#080B0C" stop-opacity=".9"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#creator-studio-bg)"/>
  <rect width="1080" height="1920" fill="url(#creator-host-light)"/>
  <rect width="1080" height="1920" fill="url(#creator-visual-light)"/>
  <path d="M0 246H1080" stroke="#D2A05E" stroke-width="2" opacity=".08"/>
  <path d="M${548 + drift} 220V1390M1050 230V1390" stroke="#9B8766" stroke-width="2" opacity=".07"/>
  <path d="M0 1390C210 1348 374 1418 540 1385S850 1355 1080 1408V1920H0Z" fill="#11191A" opacity=".62"/>
  <rect y="1370" width="1080" height="550" fill="url(#creator-floor-fade)"/>
   <ellipse cx="${540 + drift}" cy="1440" rx="390" ry="70" fill="#C28B43" opacity=".075"/>
   <path d="M0 820H1080" stroke="#C28B43" stroke-width="2" opacity=".1"/>
  <g>${dust}</g>`;
}
function renderSpokenWordChips(beat, progress, timeMs) {
  const source = beat.lipSyncText || beat.voiceText || beat.subtitle;
  const { words, totalWeight } = getSpeechWordTimings(source);
  const keywords = selectSpokenKeywords(beat.title, words);
  if (!keywords.length || !totalWeight) return "";
  const spokenWeight = clamp(progress) * totalWeight;
  const activeIndex = keywords.reduce(
    (selectedIndex, word, index) => word.start <= spokenWeight ? index : selectedIndex,
    -1
  );
  if (activeIndex < 0) return "";
  const activeWord = keywords[activeIndex];
  const timeAfterWord = spokenWeight - activeWord.end;
  if (timeAfterWord > 0.48) return "";
  const wordProgress = clamp(
    (spokenWeight - activeWord.start) / Math.max(0.6, activeWord.end - activeWord.start)
  );
  const fadeIn = clamp(wordProgress / 0.18);
  const fadeOut = 1 - clamp(timeAfterWord / 0.48);
  const cardOpacity = Math.min(fadeIn, fadeOut);
  const fontSize = Math.max(30, Math.min(46, 680 / Math.max(8, activeWord.word.length * 0.62)));
  const wordWidth = activeWord.word.length * fontSize * 0.62;
  const cardWidth = Math.max(310, Math.min(760, wordWidth + 112));
  const centerX = 540;
  const cardX = centerX - cardWidth / 2;
  const cardY = 680;
  const wordX = centerX;
  const entranceProgress = ease(clamp(wordProgress / 0.34));
  const pop = 0.82 + entranceProgress * 0.18 + Math.sin(entranceProgress * Math.PI) * 0.06;
  const rotation = (1 - entranceProgress) * -4.5;
  const progressWidth = Math.max(0, (cardWidth - 36) * wordProgress);
  return `<g pointer-events="none" opacity="${cardOpacity.toFixed(2)}">
    <g transform="translate(${wordX} ${cardY + 44}) rotate(${rotation.toFixed(2)}) scale(${pop.toFixed(3)}) translate(-${wordX} ${-(cardY + 44)})">
      <rect x="${cardX.toFixed(1)}" y="${cardY}" width="${cardWidth.toFixed(1)}" height="88" rx="25" fill="#111817" fill-opacity=".97" stroke="#9C7A49" stroke-opacity=".78" stroke-width="2"/>
      <circle cx="${(cardX + 24).toFixed(1)}" cy="${cardY + 23}" r="5" fill="#F1BD6C"/>
      <text x="${(cardX + 39).toFixed(1)}" y="${cardY + 29}" fill="#D6B879" font-family="DejaVu Sans, sans-serif" font-size="14" font-weight="800" letter-spacing="2">\u041A\u041B\u042E\u0427\u0415\u0412\u041E\u0415 \u0421\u041B\u041E\u0412\u041E</text>
      <text x="${wordX}" y="${cardY + 64}" text-anchor="middle" fill="#F0C579" font-family="DejaVu Sans, sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="900">${escapeXml(activeWord.word.toLocaleUpperCase("ru-RU"))}</text>
      <path d="M${(centerX - Math.min(wordWidth / 2 + 5, cardWidth / 2 - 28)).toFixed(1)} ${cardY + 74}H${(centerX + Math.min(wordWidth / 2 + 5, cardWidth / 2 - 28)).toFixed(1)}" stroke="#E1AE5D" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="${(cardX + 18).toFixed(1)}" y="${cardY + 80}" width="${(cardWidth - 36).toFixed(1)}" height="3" rx="1.5" fill="#465047"/>
      <rect x="${(cardX + 18).toFixed(1)}" y="${cardY + 80}" width="${progressWidth.toFixed(1)}" height="3" rx="1.5" fill="#E1AE5D"/>
    </g>
  </g>`;
}
function renderSpeechSubtitle(beat, progress) {
  const source = beat.lipSyncText || beat.voiceText || beat.subtitle;
  const { words, totalWeight } = getSpeechWordTimings(source);
  if (!words.length || !totalWeight) return "";
  const chunks = [];
  let current = [];
  const pushChunk = () => {
    if (!current.length) return;
    chunks.push({
      words: current,
      start: current[0].start,
      end: current.at(-1).end
    });
    current = [];
  };
  for (const word of words) {
    current.push(word);
    const sentenceBreak = /[.!?…]/u.test(word.punctuation);
    const clauseBreak = /[,;:]/u.test(word.punctuation) && current.length >= 2;
    if (current.length >= 4 || sentenceBreak || clauseBreak) pushChunk();
  }
  pushChunk();
  const spokenWeight = clamp(progress) * totalWeight;
  const active = chunks.find((chunk) => spokenWeight >= chunk.start && spokenWeight <= chunk.end + 0.16);
  if (!active) return "";
  const caption = active.words.map((word) => `${word.word}${word.punctuation}`).join(" ").toLocaleUpperCase("ru-RU");
  const fontSize = Math.max(22, Math.min(32, 840 / Math.max(16, caption.length * 0.58)));
  const chunkProgress = clamp(
    (spokenWeight - active.start) / Math.max(0.4, active.end - active.start)
  );
  const enter = ease(clamp(chunkProgress / 0.18));
  const opacity = Math.min(1, enter);
  const scale = 0.97 + enter * 0.03;
  return `<g pointer-events="none" opacity="${opacity.toFixed(3)}" transform="translate(540 1722) scale(${scale.toFixed(3)}) translate(-540 -1722)">
    <rect x="78" y="1668" width="924" height="108" rx="28" fill="#080D0B" fill-opacity=".94" stroke="#C9A66B" stroke-opacity=".38" stroke-width="2"/>
    <rect x="104" y="1691" width="5" height="61" rx="2.5" fill="#8DC58B" opacity=".9"/>
    <text x="540" y="1737" text-anchor="middle" fill="#F5F0E5" font-family="DejaVu Sans, sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="800" letter-spacing=".35">${escapeXml(caption)}</text>
  </g>`;
}
function renderFullPresenter(beat, _progress, timeMs, layout = "center") {
  const visualAction = `${beat.visual} ${beat.visualAction || ""}`.toLocaleLowerCase("ru-RU");
  const caution = /риск|осторож|марж|вниман|убыт|плеч/iu.test(visualAction) || beat.visual === "leverage" || beat.visual === "risk" || beat.visual === "summary";
  const warmth = caution ? "#C36D57" : "#C28B43";
  const bob = Math.sin(timeMs / (caution ? 1520 : 1860)) * 3.2;
  const centerX = layout === "left" ? 390 : layout === "right" ? 690 : 540;
  const auraY = layout === "center" ? 1320 : layout === "large" ? 1270 : 1450;
  const auraRx = layout === "large" ? 500 : layout === "center" ? 440 : 360;
  const shadowY = layout === "center" ? 1824 : layout === "large" ? 1840 : 1796;
  return `<g pointer-events="none">
    <defs>
      <radialGradient id="presenter-aura" cx="46%" cy="42%" r="60%">
        <stop offset="0" stop-color="${warmth}" stop-opacity=".22"/>
        <stop offset=".58" stop-color="${warmth}" stop-opacity=".07"/>
        <stop offset="1" stop-color="${warmth}" stop-opacity="0"/>
      </radialGradient>
    </defs>
     <ellipse cx="${centerX}" cy="${(auraY + bob).toFixed(1)}" rx="${auraRx}" ry="430" fill="url(#presenter-aura)" opacity=".78"/>
     <ellipse cx="${centerX}" cy="${(shadowY + bob).toFixed(1)}" rx="${layout === "large" ? 460 : 330}" ry="34" fill="#000000" opacity=".32"/>
  </g>`;
}
function renderPresenterImage(imageDataUri, timeMs, layout = "center") {
  const base = layout === "left" ? { x: 10, y: 1050, scale: 0.76 } : layout === "right" ? { x: 310, y: 1050, scale: 0.76 } : layout === "large" ? { x: 0, y: 790, scale: 1.08 } : { x: 90, y: 950, scale: 0.9 };
  const x = base.x + Math.sin(timeMs / 580) * (layout === "center" ? 7 : 4);
  const y = base.y + Math.sin(timeMs / 480) * 6 + Math.sin(timeMs / 1760) * 3;
  const scale = base.scale * (1 + Math.sin(timeMs / 1080) * 0.012);
  return `<g pointer-events="none" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) translate(500 500) scale(${scale.toFixed(4)}) translate(-500 -500)">
    <image href="${escapeXml(imageDataUri)}" x="0" y="0" width="1000" height="1000" preserveAspectRatio="xMidYMid meet"/>
  </g>`;
}

// src/lib/financial-short-renderer.ts
var execFileAsync = promisify(execFile);
var WIDTH = FINANCE_STYLE_DNA.width;
var HEIGHT = FINANCE_STYLE_DNA.height;
var FPS = FINANCE_STYLE_DNA.fps;
var FONT = FINANCE_STYLE_DNA.typography.family;
var GREEN = FINANCE_STYLE_DNA.colors.green;
var WHITE = FINANCE_STYLE_DNA.colors.white;
var MUTED = FINANCE_STYLE_DNA.colors.muted;
var PANEL = FINANCE_STYLE_DNA.colors.panel;
var PANEL_EDGE = FINANCE_STYLE_DNA.colors.panelEdge;
var GOLD = FINANCE_STYLE_DNA.colors.gold;
var WORKSPACE_ROOT = existsSync(join(process.cwd(), "attached_assets")) ? process.cwd() : join(process.cwd(), "..", "..");
var FINANCIAL_PRESENTER_POSE_DIR = join(
  WORKSPACE_ROOT,
  "attached_assets",
  "generated_images"
);
var financialPresenterDataUris = /* @__PURE__ */ new Map();
function getFinancialPresenterAssetPath(state) {
  const mouthState = state.mouthOpen ? "transparent" : "closed-transparent";
  const path = join(
    FINANCIAL_PRESENTER_POSE_DIR,
    `finance-explainer-host-${state.pose}-${mouthState}.png`
  );
  if (!existsSync(path)) {
    throw new Error(`\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u043A\u0430\u0434\u0440 \u0432\u0435\u0434\u0443\u0449\u0435\u0433\u043E: ${path}`);
  }
  return path;
}
function getFinancialPresenterDataUri(state) {
  const path = getFinancialPresenterAssetPath(state);
  let dataUri = financialPresenterDataUris.get(path);
  if (!dataUri) {
    dataUri = `data:image/png;base64,${readFileSync(path).toString("base64")}`;
    financialPresenterDataUris.set(path, dataUri);
  }
  return dataUri;
}
var FINANCIAL_SHORT_SCRIPT = [
  "\u041E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u044F \u2014 \u044D\u0442\u043E \u043F\u043E \u0441\u0443\u0442\u0438 \u0440\u0430\u0441\u043F\u0438\u0441\u043A\u0430 \u0441 \u043F\u043E\u043D\u044F\u0442\u043D\u044B\u043C\u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u043C\u0438.",
  "\u041F\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u044C: \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438 \u043D\u0443\u0436\u043D\u044B \u0434\u0435\u043D\u044C\u0433\u0438 \u043D\u0430 \u0440\u0430\u0437\u0432\u0438\u0442\u0438\u0435. \u041E\u043D\u0430 \u043C\u043E\u0436\u0435\u0442 \u0432\u0437\u044F\u0442\u044C \u043A\u0440\u0435\u0434\u0438\u0442 \u0432 \u0431\u0430\u043D\u043A\u0435, \u0430 \u043C\u043E\u0436\u0435\u0442 \u0437\u0430\u043D\u044F\u0442\u044C \u0434\u0435\u043D\u044C\u0433\u0438 \u0443 \u0438\u043D\u0432\u0435\u0441\u0442\u043E\u0440\u043E\u0432.",
  "\u041A\u043E\u043C\u043F\u0430\u043D\u0438\u044F \u0432\u044B\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u0438. \u0422\u044B \u043F\u043E\u043A\u0443\u043F\u0430\u0435\u0448\u044C \u043E\u0434\u043D\u0443 \u0438\u0437 \u043D\u0438\u0445 \u0438 \u0434\u0430\u0451\u0448\u044C \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438 \u0434\u0435\u043D\u044C\u0433\u0438 \u0441\u0435\u0439\u0447\u0430\u0441.",
  "\u0412\u0437\u0430\u043C\u0435\u043D \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u044F \u043E\u0431\u0435\u0449\u0430\u0435\u0442 \u0434\u0432\u0435 \u0432\u0435\u0449\u0438: \u043F\u043B\u0430\u0442\u0438\u0442\u044C \u043F\u0440\u043E\u0446\u0435\u043D\u0442 \u2014 \u044D\u0442\u043E \u043A\u0443\u043F\u043E\u043D, \u0438 \u0432\u0435\u0440\u043D\u0443\u0442\u044C \u043D\u043E\u043C\u0438\u043D\u0430\u043B \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u0438 \u0432 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0451\u043D\u043D\u0443\u044E \u0434\u0430\u0442\u0443.",
  "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u0442\u044B \u043A\u0443\u043F\u0438\u043B \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u044E \u0437\u0430 \u0434\u0435\u0441\u044F\u0442\u044C \u0442\u044B\u0441\u044F\u0447 \u0440\u0443\u0431\u043B\u0435\u0439 \u043D\u0430 \u043E\u0434\u0438\u043D \u0433\u043E\u0434 \u0441 \u043A\u0443\u043F\u043E\u043D\u043E\u043C \u0432\u043E\u0441\u0435\u043C\u043D\u0430\u0434\u0446\u0430\u0442\u044C \u043F\u0440\u043E\u0446\u0435\u043D\u0442\u043E\u0432 \u0433\u043E\u0434\u043E\u0432\u044B\u0445.",
  "\u042D\u0442\u043E \u043D\u0435 \u0437\u043D\u0430\u0447\u0438\u0442, \u0447\u0442\u043E \u0442\u044B \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u043B\u0443\u0447\u0438\u0448\u044C \u0442\u044B\u0441\u044F\u0447\u0443 \u0432\u043E\u0441\u0435\u043C\u044C\u0441\u043E\u0442 \u0440\u0443\u0431\u043B\u0435\u0439. \u041A\u0443\u043F\u043E\u043D \u043C\u043E\u0436\u0435\u0442 \u043F\u0440\u0438\u0445\u043E\u0434\u0438\u0442\u044C \u0447\u0430\u0441\u0442\u044F\u043C\u0438 \u2014 \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u043A\u0430\u0436\u0434\u044B\u0439 \u043A\u0432\u0430\u0440\u0442\u0430\u043B.",
  "\u0412 \u043A\u043E\u043D\u0446\u0435 \u0441\u0440\u043E\u043A\u0430 \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u044F \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 \u0442\u0435\u0431\u0435 \u0441\u0430\u043C\u0438 \u0434\u0435\u0441\u044F\u0442\u044C \u0442\u044B\u0441\u044F\u0447 \u0440\u0443\u0431\u043B\u0435\u0439. \u042D\u0442\u043E \u0438 \u0435\u0441\u0442\u044C \u0432\u043E\u0437\u0432\u0440\u0430\u0442 \u043D\u043E\u043C\u0438\u043D\u0430\u043B\u0430.",
  "\u041D\u043E \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u044F \u2014 \u043D\u0435 \u0434\u0435\u043F\u043E\u0437\u0438\u0442. \u041F\u043E\u043A\u0430 \u043E\u043D\u0430 \u0442\u043E\u0440\u0433\u0443\u0435\u0442\u0441\u044F \u043D\u0430 \u0431\u0438\u0440\u0436\u0435, \u0435\u0451 \u0446\u0435\u043D\u0430 \u043C\u043E\u0436\u0435\u0442 \u043C\u0435\u043D\u044F\u0442\u044C\u0441\u044F \u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C.",
  "\u0415\u0441\u043B\u0438 \u043F\u0440\u043E\u0434\u0430\u0442\u044C \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u044E \u0440\u0430\u043D\u044C\u0448\u0435 \u0441\u0440\u043E\u043A\u0430, \u043C\u043E\u0436\u043D\u043E \u0437\u0430\u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C, \u0430 \u043C\u043E\u0436\u043D\u043E \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043C\u0435\u043D\u044C\u0448\u0435 \u0432\u043B\u043E\u0436\u0435\u043D\u043D\u043E\u0439 \u0441\u0443\u043C\u043C\u044B.",
  "\u041F\u043E\u044D\u0442\u043E\u043C\u0443 \u043F\u0435\u0440\u0435\u0434 \u043F\u043E\u043A\u0443\u043F\u043A\u043E\u0439 \u0441\u043C\u043E\u0442\u0440\u0438 \u043D\u0430 \u0441\u0440\u043E\u043A, \u0434\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C, \u043A\u0440\u0435\u0434\u0438\u0442\u043D\u044B\u0439 \u0440\u0435\u0439\u0442\u0438\u043D\u0433 \u0438 \u0440\u0438\u0441\u043A \u044D\u043C\u0438\u0442\u0435\u043D\u0442\u0430.",
  "\u041A\u043E\u0440\u043E\u0442\u043A\u043E: \u0442\u044B \u0434\u0430\u0451\u0448\u044C \u0434\u0435\u043D\u044C\u0433\u0438 \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438 \u0438\u043B\u0438 \u0433\u043E\u0441\u0443\u0434\u0430\u0440\u0441\u0442\u0432\u0443, \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0448\u044C \u043A\u0443\u043F\u043E\u043D\u044B \u043F\u043E \u043F\u0443\u0442\u0438, \u0430 \u0432 \u043A\u043E\u043D\u0446\u0435 \u2014 \u043D\u043E\u043C\u0438\u043D\u0430\u043B. \u0427\u0435\u043C \u0432\u044B\u0448\u0435 \u043E\u0431\u0435\u0449\u0430\u043D\u043D\u0430\u044F \u0434\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C, \u0442\u0435\u043C \u0432\u043D\u0438\u043C\u0430\u0442\u0435\u043B\u044C\u043D\u0435\u0435 \u043D\u0443\u0436\u043D\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0442\u044C \u0440\u0438\u0441\u043A."
].join(" ");
function escapeXml2(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function clamp2(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}
function ease2(value) {
  const t = clamp2(value);
  return 1 - (1 - t) ** 3;
}
function localProgress(timeMs, startMs, endMs) {
  return clamp2((timeMs - startMs) / Math.max(1, endMs - startMs));
}
function wrapText(value, maxChars) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["\u2026"];
}
function text(value, x, y, options = {}) {
  return `<text x="${x}" y="${y}" fill="${options.color ?? WHITE}" font-family="${FONT}" font-size="${options.size ?? 30}" font-weight="${options.weight ?? 600}" text-anchor="${options.anchor ?? "middle"}"${options.letterSpacing ? ` letter-spacing="${options.letterSpacing}"` : ""}>${escapeXml2(value)}</text>`;
}
function textLines(value, x, y, maxChars, lineHeight, options = {}) {
  const lines = wrapText(value, maxChars);
  const anchor = options.anchor ?? "middle";
  return lines.map((line, index) => text(line, x, y + index * lineHeight, {
    ...options,
    anchor
  })).join("");
}
function panel(x, y, width, height, fill = PANEL, stroke = PANEL_EDGE) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="34" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
}
function pointOnCurve(progress, reverse = false) {
  const t = reverse ? 1 - clamp2(progress) : clamp2(progress);
  const start = { x: 285, y: 780 };
  const controlA = { x: 410, y: 570 };
  const controlB = { x: 670, y: 980 };
  const end = { x: 795, y: 780 };
  const inverse = 1 - t;
  return {
    x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * controlA.x + 3 * inverse * t ** 2 * controlB.x + t ** 3 * end.x,
    y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * controlA.y + 3 * inverse * t ** 2 * controlB.y + t ** 3 * end.y
  };
}
function coin(x, y, scale, color, rotation, opacity = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})" opacity="${opacity}">
    <circle r="40" fill="#122C25" stroke="${color}" stroke-width="6"/>
    <circle r="29" fill="none" stroke="${color}" stroke-width="2" opacity=".55"/>
    ${text("\u20BD", 0, 12, { size: 33, color, weight: 800 })}
  </g>`;
}
function coinsAlongCurve(progress, reverse, color, count = 5) {
  return Array.from({ length: count }, (_, index) => {
    const offset = (index - (count - 1) / 2) * 0.075;
    const point = pointOnCurve(progress + offset, reverse);
    const scale = 0.78 + (index + 1) % 3 * 0.07;
    return coin(point.x, point.y, scale, color, (progress * 240 + index * 29) % 360, clamp2(1 - Math.abs(offset) * 2));
  }).join("");
}
function actor(kind, x, y, progress, timeMs = 0) {
  const entry = ease2(progress);
  const offsetX = kind === "investor" ? -90 * (1 - entry) : 90 * (1 - entry);
  const liveOffset = Math.sin(timeMs / 620 + (kind === "investor" ? 0 : Math.PI)) * 7 * entry;
  const liveRotation = Math.sin(timeMs / 890 + (kind === "investor" ? 0 : Math.PI)) * 0.8 * entry;
  const label = kind === "investor" ? "\u0418\u041D\u0412\u0415\u0421\u0422\u041E\u0420" : "\u041A\u041E\u041C\u041F\u0410\u041D\u0418\u042F";
  const icon = kind === "investor" ? `<rect x="-84" y="-45" width="168" height="105" rx="18" fill="#172936" stroke="${GREEN}" stroke-width="3"/>
       <path d="M-42 -10 L42 -10 M-42 20 L28 20" stroke="${GREEN}" stroke-width="8" stroke-linecap="round" opacity=".72"/>
       <circle cx="0" cy="82" r="18" fill="${GREEN}"/>${text("\u20BD", 0, 91, { size: 25, color: "#092017", weight: 800 })}` : `<path d="M-72 65 V-32 L0 -88 L72 -32 V65 Z" fill="#172936" stroke="${GREEN}" stroke-width="3"/>
       <path d="M-46 54 V3 H-10 V54 M10 54 V3 H46 V54 M-85 72 H85" fill="none" stroke="${GREEN}" stroke-width="9" stroke-linejoin="round" opacity=".78"/>`;
  return `<g transform="translate(${x + offsetX} ${y + liveOffset}) rotate(${liveRotation}) scale(${0.9 + entry * 0.1})" opacity="${entry}">
    ${panel(-135, -120, 270, 240)}
    ${icon}
    ${text(label, 0, 155, { size: 25, color: WHITE, weight: 800, letterSpacing: 1 })}
  </g>`;
}
function documentCard(progress, label = "\u041E\u0411\u042F\u0417\u0410\u0422\u0415\u041B\u042C\u0421\u0422\u0412\u041E", caption = "\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0434\u0435\u043D\u044C\u0433\u0438") {
  const entry = ease2(progress);
  return `<g transform="translate(540 780) scale(${0.82 + entry * 0.18}) rotate(${(1 - entry) * -3})" opacity="${entry}">
    <rect x="-230" y="-150" width="460" height="300" rx="30" fill="#F1F7F5" stroke="${GREEN}" stroke-width="4"/>
    <path d="M-170 -62 H150 M-170 0 H125 M-170 62 H55" stroke="#4B6A62" stroke-width="14" stroke-linecap="round"/>
    <rect x="106" y="72" width="72" height="38" rx="12" fill="${GREEN}"/>
    ${text(label, 0, -190, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
    ${text(caption, 0, 215, { size: 26, color: WHITE, weight: 700 })}
  </g>`;
}
function shareTile(x, y, label, progress, rotation = 0, color = GREEN) {
  const entry = ease2(progress);
  const scale = 0.72 + entry * 0.28;
  const labelSize = Math.max(14, Math.min(22, 240 / Math.max(1, label.length)));
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})" opacity="${entry}">
    <rect x="-72" y="-52" width="144" height="104" rx="22" fill="#142B26" stroke="${color}" stroke-width="3"/>
    ${text(label, 0, 9, { size: labelSize, color: WHITE, weight: 800 })}
  </g>`;
}
function ownershipVisual(beat, progress, timeMs) {
  const split = clamp2((progress - 0.14) / 0.6);
  const shares = [
    [350, 600, "\u0410\u041A\u0426\u0418\u042F"],
    [730, 600, "\u0410\u041A\u0426\u0418\u042F"],
    [430, 820, "\u0410\u041A\u0426\u0418\u042F"],
    [650, 820, "\u0410\u041A\u0426\u0418\u042F"],
    [540, 900, "\u0410\u041A\u0426\u0418\u042F"]
  ];
  const companyScale = 1 - ease2(split) * 0.18;
  return `${actor("company", 850, 770, ease2(progress * 1.8), timeMs)}
    <g transform="translate(540 700) scale(${companyScale})" opacity="${1 - ease2(split) * 0.62}">
      ${panel(-150, -120, 300, 240, "#162B2B", GREEN)}
      ${text("\u041A\u041E\u041C\u041F\u0410\u041D\u0418\u042F", 0, -12, { size: 25, color: WHITE, weight: 800 })}
      ${text("100%", 0, 42, { size: 44, color: GREEN, weight: 900 })}
    </g>
    ${shares.map(([x, y, label], index) => {
    const shareProgress = clamp2((split - index * 0.08) * 2.3);
    const originX = 540 + (Number(x) - 540) * (1 - ease2(split));
    const originY = 700 + (Number(y) - 700) * (1 - ease2(split));
    return shareTile(originX, originY, String(label), shareProgress, Math.sin(timeMs / 600 + index) * 2);
  }).join("")}
    ${text("\u041A\u041E\u041C\u041F\u0410\u041D\u0418\u042F \u2192 \u0414\u041E\u041B\u0418", 540, 1050, { size: 28, color: GREEN, weight: 800, letterSpacing: 1 })}
    ${text(beat.entityLabel ?? "\u0410\u041A\u0426\u0418\u042F", 540, 1120, { size: 34, color: WHITE, weight: 900 })}`;
}
function fundPoolVisual(beat, progress, timeMs) {
  const poolEntry = ease2(clamp2((progress - 0.16) * 1.6));
  const assetEntry = ease2(clamp2((progress - 0.48) * 2.1));
  const investors = [
    [165, 600],
    [165, 780],
    [165, 960]
  ];
  const assets = [
    ["\u0410\u041A\u0426\u0418\u0418", GREEN],
    ["\u041E\u0411\u041B\u0418\u0413\u0410\u0426\u0418\u0418", GOLD],
    ["\u0417\u041E\u041B\u041E\u0422\u041E", "#D7C27C"],
    ["\u0414\u0420\u0423\u0413\u0418\u0415 \u0410\u041A\u0422\u0418\u0412\u042B", "#B9F7D8"]
  ];
  return `${investors.map(([x, y], index) => {
    const local = ease2(clamp2(progress * 2.1 - index * 0.18));
    return `<g transform="translate(${x + (1 - local) * -70} ${y + Math.sin(timeMs / 700 + index) * 5})" opacity="${local}">
        <circle r="48" fill="#142B26" stroke="${GREEN}" stroke-width="3"/>
        ${text("\u20BD", 0, 14, { size: 33, color: GREEN, weight: 800 })}
      </g>`;
  }).join("")}
    ${investors.map(([x, y]) => `<path d="M${x + 58} ${y} C300 ${y} 340 760 430 760" fill="none" stroke="${GREEN}" stroke-width="4" stroke-dasharray="9 18" opacity="${poolEntry * 0.8}" stroke-dashoffset="${-Math.round(timeMs / 7)}"/>`).join("")}
    ${assets.map(([, color], index) => {
    const angle = -1.05 + index * 0.7 + Math.sin(timeMs / 1200) * 0.04;
    const x = 540 + Math.cos(angle) * 250;
    const y = 760 + Math.sin(angle) * 250;
    return `<path d="M540 760L${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="7 12" opacity="${assetEntry * 0.46}" stroke-dashoffset="${-Math.round(timeMs / 8)}"/>`;
  }).join("")}
    <g transform="translate(540 760) scale(${0.72 + poolEntry * 0.28})" opacity="${poolEntry}">
      <circle r="190" fill="#102A29" stroke="${GREEN}" stroke-width="5"/>
      <circle r="155" fill="none" stroke="${GREEN}" stroke-width="2" stroke-dasharray="8 18" opacity=".65"/>
      ${text("\u041E\u0411\u0429\u0418\u0419", 0, -12, { size: 27, color: MUTED, weight: 800, letterSpacing: 2 })}
      ${text("\u0424\u041E\u041D\u0414", 0, 42, { size: 48, color: WHITE, weight: 900 })}
    </g>
    ${assets.map(([label, color], index) => {
    const angle = -1.05 + index * 0.7 + Math.sin(timeMs / 1200) * 0.04;
    const x = 540 + Math.cos(angle) * 250;
    const y = 760 + Math.sin(angle) * 250;
    return shareTile(x, y, String(label), assetEntry, index % 2 ? -4 : 4, String(color));
  }).join("")}
    ${text("\u0414\u041E\u041B\u0418 \u041F\u041E\u0420\u0422\u0424\u0415\u041B\u042F \xB7 \u0421\u0425\u0415\u041C\u0410", 540, 1080, { size: 20, color: MUTED, weight: 750, letterSpacing: 1 })}
    ${text(beat.entityLabel ?? "\u041F\u0410\u0415\u0412\u041E\u0419 \u0424\u041E\u041D\u0414", 540, 1150, { size: 31, color: GREEN, weight: 800 })}`;
}
function distributionVisual(beat, progress, timeMs) {
  const profitEntry = ease2(clamp2(progress * 1.8));
  const distribution = ease2(clamp2((progress - 0.3) * 1.7));
  const payments = [
    [330, 910, "1"],
    [540, 1e3, "2"],
    [750, 910, "3"]
  ];
  return `${actor("company", 540, 575, profitEntry, timeMs)}
    ${badge("\u041F\u0420\u0418\u0411\u042B\u041B\u042C", 540, 350, GOLD, profitEntry, 300)}
    <path d="M540 760 C540 820 330 820 330 900 M540 760 C540 850 540 900 540 970 M540 760 C540 820 750 820 750 900" fill="none" stroke="${GREEN}" stroke-width="5" stroke-dasharray="10 16" opacity="${distribution * 0.8}" stroke-dashoffset="${-Math.round(timeMs / 8)}"/>
    ${payments.map(([x, y, label], index) => {
    const local = ease2(clamp2(distribution * 2.2 - index * 0.16));
    return `<g transform="translate(${x} ${y + Math.sin(timeMs / 500 + index) * 6}) scale(${0.76 + local * 0.24})" opacity="${local}">
        <circle r="74" fill="#142B26" stroke="${GREEN}" stroke-width="4"/>
        ${text("\u20BD", 0, 12, { size: 38, color: GREEN, weight: 900 })}
        ${text(`\u0410\u041A\u0426\u0418\u041E\u041D\u0415\u0420 ${label}`, 0, 118, { size: 18, color: WHITE, weight: 800 })}
      </g>`;
  }).join("")}
    ${text("\u041F\u0420\u0418\u0411\u042B\u041B\u042C \u2192 \u0412\u042B\u041F\u041B\u0410\u0422\u0410", 540, 1220, { size: 29, color: GREEN, weight: 800, letterSpacing: 1 })}
    ${text(beat.entityLabel ?? "\u0414\u0418\u0412\u0418\u0414\u0415\u041D\u0414", 540, 1280, { size: 34, color: WHITE, weight: 900 })}`;
}
function badge(label, x, y, color, progress, width = 310) {
  const entry = ease2(progress);
  return `<g transform="translate(${x} ${y}) scale(${0.78 + entry * 0.22})" opacity="${entry}">
    <rect x="${-width / 2}" y="-43" width="${width}" height="86" rx="43" fill="#12261F" stroke="${color}" stroke-width="2"/>
    <circle cx="${-width / 2 + 34}" cy="0" r="10" fill="${color}"/>
    ${text(label, 18, 11, { size: 27, color: WHITE, weight: 800, letterSpacing: 0.7 })}
  </g>`;
}
function seededSeries(seed, count, trend = 0.5) {
  let state = Math.abs(Math.round(seed)) || 17;
  const values = [];
  let value = 42;
  for (let index = 0; index < count; index += 1) {
    state = state * 1664525 + 1013904223 >>> 0;
    const noise = (state / 4294967295 - 0.5) * 15;
    value = Math.max(12, Math.min(88, value + trend + noise));
    values.push(value);
  }
  return values;
}
function chartSeed(beat) {
  return [...beat.id, beat.entityLabel ?? "", beat.title].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0
  );
}
function chartVisual(beat, progress, timeMs) {
  const kind = beat.chartKind ?? "line";
  const seed = chartSeed(beat);
  const values = seededSeries(seed, 9, kind === "candlestick" ? 0.2 : 1.2);
  const plotX = 205;
  const plotY = 570;
  const plotWidth = 670;
  const plotHeight = 360;
  const visible = Math.max(2, Math.ceil(clamp2((progress - 0.08) / 0.76) * values.length));
  const pointAt = (value, index) => ({
    x: plotX + index / (values.length - 1) * plotWidth,
    y: plotY + plotHeight - value / 100 * plotHeight
  });
  const points = values.map(pointAt);
  const grid = Array.from({ length: 5 }, (_, index) => {
    const y = plotY + index * (plotHeight / 4);
    return `<line x1="${plotX}" y1="${y}" x2="${plotX + plotWidth}" y2="${y}" stroke="#294051" stroke-width="2" stroke-dasharray="6 18"/>`;
  }).join("");
  const axes = `<line x1="${plotX}" y1="${plotY + plotHeight}" x2="${plotX + plotWidth}" y2="${plotY + plotHeight}" stroke="${MUTED}" stroke-width="3" opacity=".65"/><line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotHeight}" stroke="${MUTED}" stroke-width="3" opacity=".65"/>`;
  const label = kind === "candlestick" ? "\u0421\u0412\u0415\u0427\u041D\u041E\u0419 \u0413\u0420\u0410\u0424\u0418\u041A" : kind === "area" ? "\u0414\u0418\u041D\u0410\u041C\u0418\u041A\u0410 \u041F\u041E\u041A\u0410\u0417\u0410\u0422\u0415\u041B\u042F" : kind === "bar" || kind === "horizontal_bar" ? "\u0421\u0420\u0410\u0412\u041D\u0415\u041D\u0418\u0415 \u0417\u041D\u0410\u0427\u0415\u041D\u0418\u0419" : "\u0414\u0412\u0418\u0416\u0415\u041D\u0418\u0415 \u041F\u041E\u041A\u0410\u0417\u0410\u0422\u0415\u041B\u042F";
  if (kind === "candlestick") {
    const candles = values.map((value, index) => {
      const x = plotX + index * (plotWidth / (values.length - 1));
      const open = Math.max(10, value - 8 + Math.sin(seed + index) * 4);
      const close = Math.max(10, value + 6 - Math.cos(seed + index) * 4);
      const high = Math.min(98, Math.max(open, close) + 10);
      const low = Math.max(4, Math.min(open, close) - 10);
      const scale = Math.max(0.28, clamp2((progress * values.length - index) * 1.8));
      const color = close >= open ? GREEN : "#FF8D8D";
      const yHigh = pointAt(high, index).y;
      const yLow = pointAt(low, index).y;
      const yOpen = pointAt(open, index).y;
      const yClose = pointAt(close, index).y;
      const active = Math.floor(timeMs / 260) % values.length === index;
      return `<g opacity="${scale}"><line x1="${x}" y1="${yHigh}" x2="${x}" y2="${yLow}" stroke="${color}" stroke-width="${active ? 9 : 5}"/><rect x="${x - (active ? 23 : 18)}" y="${Math.min(yOpen, yClose)}" width="${active ? 46 : 36}" height="${Math.max(12, Math.abs(yClose - yOpen))}" rx="6" fill="${color}" opacity="${active ? 1 : 0.85}"/>${active ? `<circle cx="${x}" cy="${yHigh - 18}" r="${10 + Math.sin(timeMs / 120) * 3}" fill="${color}"/>` : ""}</g>`;
    }).join("");
    return `${panel(140, 420, 800, 650, "#0D1A22", PANEL_EDGE)}
      ${text(label, 540, 500, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      ${grid}${axes}${candles}
      ${text("\u0423\u0447\u0435\u0431\u043D\u044B\u0439 \u043F\u0440\u0438\u043C\u0435\u0440 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u044F \u0446\u0435\u043D\u044B", 540, 1145, { size: 27, color: WHITE, weight: 700 })}
      ${badge(beat.metricLabel ?? "\u0426\u0415\u041D\u0410 \u041D\u0410 \u0411\u0418\u0420\u0416\u0415", 540, 1240, GOLD, ease2(progress), 390)}`;
  }
  if (kind === "bar" || kind === "horizontal_bar" || kind === "portfolio") {
    const labels = kind === "portfolio" ? ["\u0410\u041A\u0426\u0418\u0418", "\u041E\u0411\u041B\u0418\u0413\u0410\u0426\u0418\u0418", "\u0417\u041E\u041B\u041E\u0422\u041E", "\u041A\u042D\u0428", "\u0414\u0420\u0423\u0413\u041E\u0415"] : ["A", "B", "C", "D", "E", "F"];
    const bars = labels.map((labelText, index) => {
      const value = values[index % values.length];
      const local = ease2(clamp2(progress * 1.8 - index * 0.12));
      if (kind === "horizontal_bar" || kind === "portfolio") {
        const y = 600 + index * 82;
        const width = value * 5.1 * (0.94 + Math.sin(timeMs / 360 + index) * 0.06);
        return `<g opacity="${local}">${text(labelText, 210, y + 28, { size: 22, color: WHITE, weight: 700, anchor: "start" })}<rect x="370" y="${y}" width="${width}" height="46" rx="23" fill="${index % 2 ? GOLD : GREEN}" opacity=".8"/><text x="${390 + width}" y="${y + 31}" fill="${WHITE}" font-family="${FONT}" font-size="20" font-weight="800">${Math.round(value)}%</text></g>`;
      }
      const x = 225 + index * 105;
      const height = value * 3.2 * (0.94 + Math.sin(timeMs / 360 + index) * 0.06);
      return `<g opacity="${local}"><rect x="${x}" y="${930 - height}" width="64" height="${height}" rx="16" fill="${index % 2 ? GOLD : GREEN}" opacity=".82"/><text x="${x + 32}" y="970" fill="${WHITE}" font-family="${FONT}" font-size="20" font-weight="800" text-anchor="middle">${labelText}</text></g>`;
    }).join("");
    return `${panel(140, 420, 800, 650, "#0D1A22", PANEL_EDGE)}
      ${text(kind === "portfolio" ? "\u0421\u0422\u0420\u0423\u041A\u0422\u0423\u0420\u0410 \u041F\u041E\u0420\u0422\u0424\u0415\u041B\u042F" : label, 540, 500, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      ${kind === "horizontal_bar" || kind === "portfolio" ? bars : `${axes}${bars}`}
      ${text("\u0414\u043E\u043B\u0438 \u0438 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u043A\u0430\u043A \u0443\u0447\u0435\u0431\u043D\u044B\u0439 \u043F\u0440\u0438\u043C\u0435\u0440", 540, 1145, { size: 25, color: WHITE, weight: 700 })}`;
  }
  if (kind === "donut") {
    const segments = [28, 22, 18, 17, 15];
    const colors = [GREEN, GOLD, "#7ED8FF", "#C795FF", "#FF9B8D"];
    const circumference = 2 * Math.PI * 150;
    let offset = 0;
    const rings = segments.map((segment, index) => {
      const length = circumference * segment / 100;
      const local = ease2(clamp2(progress * 2 - index * 0.18));
      const ring = `<circle cx="540" cy="760" r="150" fill="none" stroke="${colors[index]}" stroke-width="64" stroke-dasharray="${length * local} ${circumference}" stroke-dashoffset="${-offset}" transform="rotate(-90 540 760)" opacity="${local}"/>`;
      offset += length;
      return ring;
    }).join("");
    return `${panel(140, 420, 800, 650, "#0D1A22", PANEL_EDGE)}
      ${text("\u0420\u0410\u0421\u041F\u0420\u0415\u0414\u0415\u041B\u0415\u041D\u0418\u0415", 540, 500, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      <g transform="rotate(${Math.sin(timeMs / 1800) * 8} 540 760)">${rings}</g>
      <circle cx="540" cy="760" r="104" fill="#0D1A22"/>
      ${text(beat.entityLabel ?? "\u041F\u041E\u0420\u0422\u0424\u0415\u041B\u042C", 540, 750, { size: 24, color: WHITE, weight: 800 })}
      ${text("100%", 540, 795, { size: 36, color: GREEN, weight: 900 })}
      ${text("\u0423\u0447\u0435\u0431\u043D\u0430\u044F \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430", 540, 1145, { size: 27, color: WHITE, weight: 700 })}`;
  }
  if (kind === "waterfall") {
    const values2 = [68, 24, -18, 15, -9, 80];
    let running = 42;
    const bars = values2.map((change, index) => {
      const start = running;
      running += change;
      const local = ease2(clamp2(progress * 1.8 - index * 0.13));
      const x = 190 + index * 112;
      const yStart = 930 - start * 3;
      const yEnd = 930 - running * 3;
      const y = Math.min(yStart, yEnd);
      const height = Math.max(18, Math.abs(yEnd - yStart));
      const color = change >= 0 ? GREEN : "#FF8D8D";
      return `<g opacity="${local}"><rect x="${x}" y="${y}" width="72" height="${height}" rx="12" fill="${color}" opacity=".85"/><text x="${x + 36}" y="980" fill="${WHITE}" font-family="${FONT}" font-size="18" font-weight="800" text-anchor="middle">${change > 0 ? "+" : ""}${change}</text></g>`;
    }).join("");
    return `${panel(140, 420, 800, 650, "#0D1A22", PANEL_EDGE)}
      ${text("\u041F\u0420\u0418\u0411\u042B\u041B\u042C \u2192 \u0412\u042B\u041F\u041B\u0410\u0422\u0410", 540, 500, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      ${axes}${bars}
      ${text("\u041A\u0430\u043A \u0441\u0443\u043C\u043C\u0430 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0448\u0430\u0433\u0430", 540, 1145, { size: 27, color: WHITE, weight: 700 })}`;
  }
  const linePoints = points.slice(0, visible).map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = `${plotX},${plotY + plotHeight} ${linePoints} ${points[Math.max(0, visible - 1)].x},${plotY + plotHeight}`;
  const fullPoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const progressivePath = `<polyline points="${fullPoints}" fill="none" stroke="${GREEN}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".24"/><polyline points="${linePoints}" fill="none" stroke="${GREEN}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="18 12" stroke-dashoffset="${-Math.round(timeMs / 5)}"/>`;
  const area = kind === "area" ? `<polygon points="${areaPoints}" fill="${GREEN}" opacity=".12"/><polyline points="${fullPoints}" fill="none" stroke="${GREEN}" stroke-width="5" stroke-dasharray="12 22" stroke-dashoffset="${-Math.round(timeMs / 6)}" opacity=".55"/>` : "";
  const dots = points.map((point, index) => {
    const visibleOpacity = index < visible ? 1 : 0.22;
    const active = Math.floor(timeMs / 300) % values.length === index;
    return `<circle cx="${point.x}" cy="${point.y}" r="${active ? 16 + Math.sin(timeMs / 140) * 3 : 8 + Math.sin(timeMs / 220 + index) * 2}" fill="${GREEN}" stroke="#0D1A22" stroke-width="5" opacity="${visibleOpacity}"/>`;
  }).join("");
  return `${panel(140, 420, 800, 650, "#0D1A22", PANEL_EDGE)}
    ${text(label, 540, 500, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
    ${grid}${axes}${area}${progressivePath}${dots}
    ${text("\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u0432\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438", 540, 1145, { size: 27, color: WHITE, weight: 700 })}
    ${badge(beat.metricLabel ?? "\u0414\u0418\u041D\u0410\u041C\u0418\u041A\u0410", 540, 1240, GREEN, ease2(progress), 330)}`;
}
function renderBackgroundLayer(background, timeMs) {
  const drift = Math.round(timeMs / 14);
  const grid = `<g opacity=".12">${Array.from({ length: 16 }, (_, index) => `<line x1="${index * 72}" y1="0" x2="${index * 72}" y2="${HEIGHT}" stroke="${GREEN}" stroke-width="1"/>`).join("")}${Array.from({ length: 28 }, (_, index) => `<line x1="0" y1="${index * 72}" x2="${WIDTH}" y2="${index * 72}" stroke="${GREEN}" stroke-width="1"/>`).join("")}</g>`;
  if (background === "grid") return grid;
  if (background === "particles" || background === "stars") {
    return `${grid}<g fill="${GREEN}" opacity=".2">${Array.from({ length: background === "stars" ? 42 : 24 }, (_, index) => {
      const x = 34 + index * 173 % 1010;
      const y = 180 + index * 311 % 1440;
      const radius = background === "stars" ? 2 + index % 4 * 2 : 3 + index % 4 * 2;
      return `<circle cx="${x}" cy="${y}" r="${radius}"/><circle cx="${(x + 120) % WIDTH}" cy="${y + 54}" r="2"/>`;
    }).join("")}</g>`;
  }
  if (background === "terminal" || background === "ledger") {
    const rows = Array.from({ length: 12 }, (_, index) => {
      const y = 250 + index * 118;
      return `<line x1="48" y1="${y}" x2="${1030 - index % 3 * 90}" y2="${y}" stroke="${GREEN}" stroke-width="${background === "ledger" ? 1 : 2}" stroke-dasharray="${18 + index % 4 * 11} 22" stroke-dashoffset="${-drift}"/>`;
    }).join("");
    return `${background === "ledger" ? grid : ""}<g opacity=".16">${rows}</g>`;
  }
  if (background === "aurora") {
    return `<g opacity=".24" fill="none" stroke-linecap="round"><path d="M-80 520 C220 220 420 820 720 470 S1120 210 1190 540" stroke="${GREEN}" stroke-width="70" opacity=".1"/><path d="M-80 930 C230 620 470 1180 770 840 S1120 610 1190 900" stroke="#7ED8FF" stroke-width="42" opacity=".12"/><path d="M-80 1340 C240 1040 470 1500 820 1200 S1110 1050 1190 1320" stroke="${GOLD}" stroke-width="24" opacity=".12"/></g>`;
  }
  if (background === "mesh") {
    return `<g opacity=".14" fill="none" stroke="${GREEN}" stroke-width="2">${Array.from({ length: 9 }, (_, index) => `<path d="M-50 ${340 + index * 150} C260 ${180 + index * 150} 520 ${520 + index * 120} 1130 ${300 + index * 138}"/>`).join("")}</g><g fill="${GREEN}" opacity=".28">${Array.from({ length: 18 }, (_, index) => `<circle cx="${80 + index * 227 % 900}" cy="${260 + index * 149 % 1240}" r="5"/>`).join("")}</g>`;
  }
  if (background === "circuit") {
    return `<g fill="none" stroke="${GREEN}" stroke-width="3" opacity=".16">${Array.from({ length: 9 }, (_, index) => {
      const y = 260 + index * 150;
      return `<path d="M30 ${y} H${170 + index % 3 * 70} V${y + 60} H${420 + index % 4 * 90} V${y - 40} H1050"/>`;
    }).join("")}</g><g fill="${GREEN}" opacity=".36">${Array.from({ length: 18 }, (_, index) => `<circle cx="${170 + index % 6 * 150}" cy="${260 + Math.floor(index / 6) * 430}" r="7"/>`).join("")}</g>`;
  }
  if (background === "waves") {
    return `<g fill="none" stroke-linecap="round"><path d="M-80 460 C100 300 250 620 430 460 S760 300 940 460 S1130 620 1180 480" stroke="${GREEN}" stroke-width="4" opacity=".22"/><path d="M-80 800 C100 640 250 960 430 800 S760 640 940 800 S1130 960 1180 820" stroke="${GOLD}" stroke-width="3" opacity=".18"/><path d="M-80 1140 C100 980 250 1300 430 1140 S760 980 940 1140 S1130 1300 1180 1160" stroke="#7ED8FF" stroke-width="3" opacity=".16"/></g>`;
  }
  if (background === "blueprint") {
    return `<g opacity=".16" stroke="${GREEN}" fill="none" stroke-width="2" stroke-dasharray="10 16">${Array.from({ length: 9 }, (_, index) => `<rect x="${80 + index % 3 * 300}" y="${260 + Math.floor(index / 3) * 380}" width="220" height="240" rx="24"/>`).join("")}</g>${grid}`;
  }
  if (background === "radar") {
    return `<g transform="translate(540 760)" fill="none" stroke="${GREEN}" opacity=".18">${[180, 300, 420, 540].map((radius) => `<circle r="${radius}"/>`).join("")}<path d="M0 0 L0 -540 M0 0 L540 0 M0 0 L0 540 M0 0 L-540 0"/></g><path d="M540 760 L540 220 A540 540 0 0 1 850 318 Z" fill="${GREEN}" opacity=".07"/>`;
  }
  return `<g opacity=".16" fill="${GREEN}">${Array.from({ length: 15 }, (_, index) => {
    const x = 80 + index * 70;
    const height = 80 + index * 83 % 260;
    return `<rect x="${x}" y="${1200 - height}" width="24" height="${height}" rx="12" transform="scale(1 ${1 + Math.sin(timeMs / 500 + index) * 0.08})"/>`;
  }).join("")}</g>`;
}
function contractVisual(beat, progress, timeMs) {
  const reveal = ease2(clamp2(progress * 1.8));
  const scanX = 300 + timeMs / 8 % 480;
  return `<g opacity="${reveal}">
    <g transform="translate(540 700) rotate(${Math.sin(timeMs / 900) * 1.5})">
      ${panel(-245, -190, 490, 380, "#111D2B", "#5DC7FF")}
      ${text("\u041A\u041E\u041D\u0422\u0420\u0410\u041A\u0422", 0, -118, { size: 23, color: "#7ED8FF", weight: 800, letterSpacing: 2 })}
      <path d="M-170 -54 H170 M-170 8 H120 M-170 70 H60" stroke="#7C93A7" stroke-width="14" stroke-linecap="round"/>
      <rect x="92" y="106" width="92" height="42" rx="12" fill="#5DC7FF"/>
      ${text(beat.maturityLabel ?? "\u0411\u0423\u0414\u0423\u0429\u0410\u042F \u0414\u0410\u0422\u0410", 0, 245, { size: 25, color: WHITE, weight: 800 })}
    </g>
    <g transform="translate(190 720)">${panel(-120, -100, 240, 200, "#132338", "#FFB86B")}${text("\u041F\u041E\u041A\u0423\u041F\u0410\u0422\u0415\u041B\u042C", 0, -8, { size: 21, color: "#FFB86B", weight: 800 })}${text("\u0446\u0435\u043D\u0430", 0, 42, { size: 27, color: WHITE, weight: 700 })}</g>
    <g transform="translate(890 720)">${panel(-120, -100, 240, 200, "#132338", "#C795FF")}${text("\u041F\u0420\u041E\u0414\u0410\u0412\u0415\u0426", 0, -8, { size: 21, color: "#C795FF", weight: 800 })}${text("\u0430\u043A\u0442\u0438\u0432", 0, 42, { size: 27, color: WHITE, weight: 700 })}</g>
    <path d="M315 720 C380 590 430 590 470 650 M610 650 C650 590 700 590 765 720" fill="none" stroke="#7ED8FF" stroke-width="6" stroke-dasharray="12 18" stroke-dashoffset="${-Math.round(timeMs / 7)}"/>
    <rect x="${scanX}" y="450" width="6" height="510" fill="#7ED8FF" opacity=".24"/>
    ${text("\u0414\u043E\u0433\u043E\u0432\u043E\u0440\u0451\u043D\u043D\u043E\u0441\u0442\u044C \u043E \u0446\u0435\u043D\u0435 \u043D\u0430 \u0431\u0443\u0434\u0443\u0449\u0443\u044E \u0434\u0430\u0442\u0443", 540, 1110, { size: 27, color: WHITE, weight: 700 })}
  </g>`;
}
function leverageVisual(beat, progress, timeMs) {
  const level = ease2(clamp2((progress - 0.12) * 1.45));
  const marker = 250 + level * 580;
  return `${panel(130, 420, 820, 700, "#111B2A", "#FFB86B")}
    ${text("\u041F\u041B\u0415\u0427\u041E \u0423\u0412\u0415\u041B\u0418\u0427\u0418\u0412\u0410\u0415\u0422 \u041F\u041E\u0417\u0418\u0426\u0418\u042E", 540, 505, { size: 23, color: "#FFB86B", weight: 800, letterSpacing: 1 })}
    ${text("\u0417\u0410\u041B\u041E\u0413", 190, 660, { size: 22, color: MUTED, weight: 800, anchor: "start" })}
    <rect x="190" y="700" width="700" height="54" rx="27" fill="#27394B"/>
    <rect x="190" y="700" width="${260 * level}" height="54" rx="27" fill="#7ED8FF"/>
    ${text("\u043F\u043E\u0437\u0438\u0446\u0438\u044F", 190, 850, { size: 22, color: MUTED, weight: 800, anchor: "start" })}
    <rect x="190" y="890" width="700" height="54" rx="27" fill="#27394B"/>
    <rect x="190" y="890" width="${700 * level}" height="54" rx="27" fill="#FFB86B"/>
    <circle cx="${marker}" cy="917" r="${22 + Math.sin(timeMs / 180) * 4}" fill="#FFF2D7" stroke="#FFB86B" stroke-width="5"/>
    ${badge(beat.metricLabel ?? "\u0426\u0415\u041D\u0410 \u041A\u041E\u041D\u0422\u0420\u0410\u041A\u0422\u0410", 540, 1190, "#FFB86B", level, 390)}
    ${text("\u041C\u0430\u043B\u0435\u043D\u044C\u043A\u043E\u0435 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u0446\u0435\u043D\u044B \u0432\u043B\u0438\u044F\u0435\u0442 \u043D\u0430 \u0431\u043E\u043B\u044C\u0448\u0443\u044E \u043F\u043E\u0437\u0438\u0446\u0438\u044E", 540, 1280, { size: 25, color: WHITE, weight: 700 })}`;
}
function payoffVisual(beat, progress, timeMs) {
  const reveal = ease2(clamp2((progress - 0.1) * 1.3));
  const futuresExample = beat.concept === "futures_contract";
  const shortScenario = futuresExample && /short|95/iu.test(`${beat.title} ${beat.visualAction || ""}`);
  const currentX = futuresExample ? shortScenario ? 540 - 320 * ease2(progress) : 540 + 320 * ease2(progress) : 240 + timeMs / 18 % 600;
  const currentY = futuresExample ? shortScenario ? 850 - (540 - currentX) * (170 / 320) : 850 - (currentX - 540) * 0.8 : 850 - (currentX - 540) * 0.8;
  const longOpacity = futuresExample && shortScenario ? 0.38 : 1;
  const shortOpacity = futuresExample && !shortScenario ? 0.38 : 0.72;
  const curveReveal = futuresExample ? "" : `stroke-dasharray="${720 * reveal} 720"`;
  return `${panel(130, 410, 820, 720, "#111A2C", "#C795FF")}
    ${text(futuresExample ? "\u0423\u0427\u0415\u0411\u041D\u042B\u0419 PAYOFF \xB7 \u0411\u0415\u0417 \u041A\u041E\u041C\u0418\u0421\u0421\u0418\u0419" : "\u0420\u0415\u0417\u0423\u041B\u042C\u0422\u0410\u0422 \u041F\u0420\u0418 \u0420\u0410\u0417\u041D\u041E\u0419 \u0426\u0415\u041D\u0415", 540, 500, { size: 23, color: "#C795FF", weight: 800, letterSpacing: 1 })}
    <line x1="220" y1="850" x2="880" y2="850" stroke="${MUTED}" stroke-width="3"/>
    <line x1="540" y1="580" x2="540" y2="1040" stroke="${MUTED}" stroke-width="3"/>
    <path d="M220 1010 L540 850 L860 590" fill="none" stroke="#C795FF" stroke-width="10" ${curveReveal} stroke-linecap="round" opacity="${longOpacity}"/>
    <path d="M220 680 L540 850 L860 1010" fill="none" stroke="#FF8D8D" stroke-width="6" ${curveReveal} stroke-linecap="round" opacity="${shortOpacity}"/>
    <circle cx="${currentX}" cy="${currentY}" r="${18 + Math.sin(timeMs / 160) * 4}" fill="#FFFFFF" stroke="${shortScenario ? "#FF8D8D" : "#C795FF"}" stroke-width="5"/>
    ${futuresExample ? `${text("\u041B\u041E\u041D\u0413", 300, 650, { size: 22, color: "#C795FF", weight: 850 })}${text("\u0428\u041E\u0420\u0422", 780, 650, { size: 22, color: "#FF8D8D", weight: 850 })}${text("95", 220, 900, { size: 21, color: MUTED, weight: 700 })}${text("100 \xB7 \u0412\u0425\u041E\u0414", 540, 900, { size: 21, color: GOLD, weight: 800 })}${text("105", 860, 900, { size: 21, color: MUTED, weight: 700 })}` : text("\u0446\u0435\u043D\u0430 \u0430\u043A\u0442\u0438\u0432\u0430", 840, 900, { size: 20, color: MUTED, weight: 700 })}
    ${text("\u043F\u0440\u0438\u0431\u044B\u043B\u044C / \u0443\u0431\u044B\u0442\u043E\u043A", 560, 575, { size: 20, color: MUTED, weight: 700 })}
    ${text(beat.maturityLabel ?? "\u0418\u0421\u041F\u041E\u041B\u041D\u0415\u041D\u0418\u0415 \u0412 \u0411\u0423\u0414\u0423\u0429\u0415\u041C", 540, 1190, { size: 27, color: WHITE, weight: 700 })}`;
}
function compoundGrowthVisual(beat, progress, timeMs) {
  const values = ["100 000 \u20BD", "110 000 \u20BD", "121 000 \u20BD"];
  const activeStep = Math.min(values.length - 1, Math.floor(clamp2(progress) * values.length));
  const chartProgress = ease2(clamp2((progress - 0.08) / 0.86));
  const points = [[230, 970], [410, 860], [590, 715], [780, 525]];
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");
  const lastX = 230 + (780 - 230) * chartProgress;
  const lastY = 970 - (970 - 525) * chartProgress;
  const count = Math.min(points.length, Math.max(1, Math.ceil(chartProgress * points.length)));
  return `${panel(110, 390, 860, 770, "#131C1B", "#78D6B0")}
    ${text("\u041A\u0410\u041F\u0418\u0422\u0410\u041B\u0418\u0417\u0410\u0426\u0418\u042F \u041F\u0420\u041E\u0426\u0415\u041D\u0422\u0410", 540, 482, { size: 24, color: "#78D6B0", weight: 850, letterSpacing: 1.4 })}
    <path d="${line}" fill="none" stroke="#78D6B0" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="${chartProgress.toFixed(3)} 1"/>
    ${points.slice(0, count).map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="${index === activeStep ? 21 + Math.sin(timeMs / 180) * 3 : 13}" fill="${index <= activeStep ? "#E8BD70" : "#293A33"}" stroke="${index <= activeStep ? "#FFF0C9" : "#63766C"}" stroke-width="3"/>`).join("")}
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="13" fill="#F0C579" opacity=".9"/>
    ${values.map((value, index) => {
    const x = 270 + index * 265;
    const y = 1050 - index * 115;
    const reached = index <= activeStep;
    return `<g opacity="${reached ? 1 : 0.42}" transform="translate(0 ${reached ? 0 : 10})">
        <rect x="${x - 115}" y="${y - 61}" width="230" height="76" rx="22" fill="${reached ? "#1C3027" : "#17221D"}" stroke="${reached ? "#78D6B0" : "#384B40"}" stroke-width="2"/>
        ${text(value, x, y - 13, { size: 26, color: reached ? WHITE : MUTED, weight: 850 })}
        ${text(index === 0 ? "\u0421\u0422\u0410\u0420\u0422" : `\u041F\u0415\u0420\u0418\u041E\u0414 ${index}`, x, y + 13, { size: 13, color: "#D0B378", weight: 750, letterSpacing: 1 })}
      </g>`;
  }).join("")}
    ${text(beat.subtitle.length < 52 ? beat.subtitle : "\u041F\u0440\u043E\u0446\u0435\u043D\u0442\u044B \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u043A \u043A\u0430\u043F\u0438\u0442\u0430\u043B\u0443", 540, 1210, { size: 25, color: WHITE, weight: 700 })}
    ${text("\u0423\u0421\u041B\u041E\u0412\u041D\u042B\u0419 \u041F\u0420\u0418\u041C\u0415\u0420 \xB7 \u041D\u0415 \u041F\u0420\u041E\u0413\u041D\u041E\u0417 \u0414\u041E\u0425\u041E\u0414\u041D\u041E\u0421\u0422\u0418", 540, 1270, { size: 17, color: "#C9C1B3", weight: 700, letterSpacing: 1 })}`;
}
function comparisonVisual(beat, progress, timeMs) {
  const reveal = ease2(clamp2(progress * 1.8));
  const leftScale = 0.94 + Math.sin(timeMs / 420) * 0.025;
  const rightScale = 0.94 + Math.sin(timeMs / 420 + Math.PI) * 0.025;
  return `${panel(90, 420, 430, 650, "#122033", "#5DC7FF")}
    ${panel(560, 420, 430, 650, "#241D31", "#C795FF")}
    <g opacity="${reveal}" transform="translate(305 710) scale(${leftScale})">
      ${text("\u0421\u0426\u0415\u041D\u0410\u0420\u0418\u0419 A", 0, -120, { size: 22, color: "#7ED8FF", weight: 800, letterSpacing: 1 })}
      ${text("\u0426\u0415\u041D\u0410 \u0420\u0410\u0421\u0422\u0401\u0422", 0, -18, { size: 30, color: WHITE, weight: 900 })}
      <path d="M-120 100 L-55 45 L10 65 L120 -75" fill="none" stroke="#7ED8FF" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="18 12" stroke-dashoffset="${-Math.round(timeMs / 5)}"/>
      ${text("+", 0, 160, { size: 38, color: "#7ED8FF", weight: 900 })}
    </g>
    <g opacity="${reveal}" transform="translate(775 710) scale(${rightScale})">
      ${text("\u0421\u0426\u0415\u041D\u0410\u0420\u0418\u0419 B", 0, -120, { size: 22, color: "#C795FF", weight: 800, letterSpacing: 1 })}
      ${text("\u0426\u0415\u041D\u0410 \u041F\u0410\u0414\u0410\u0415\u0422", 0, -18, { size: 30, color: WHITE, weight: 900 })}
      <path d="M-120 -75 L-55 35 L10 0 L120 100" fill="none" stroke="#C795FF" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="18 12" stroke-dashoffset="${Math.round(timeMs / 5)}"/>
      ${text("\u2212", 0, 160, { size: 38, color: "#C795FF", weight: 900 })}
    </g>
    ${text(beat.metricLabel ?? "\u0414\u0412\u0410 \u0420\u0415\u0417\u0423\u041B\u042C\u0422\u0410\u0422\u0410", 540, 1160, { size: 27, color: WHITE, weight: 800 })}`;
}
function riskVisual(beat, progress, timeMs) {
  const reveal = ease2(clamp2(progress * 1.8));
  const level = 0.28 + 0.42 * (0.5 + Math.sin(timeMs / 700) * 0.5);
  const markerX = 220 + 640 * level;
  return `${panel(120, 420, 840, 660, "#1E1823", "#FFB86B")}
    ${text("\u041B\u0410\u0411\u041E\u0420\u0410\u0422\u041E\u0420\u0418\u042F \u0420\u0418\u0421\u041A\u0410", 540, 515, { size: 24, color: "#FFB86B", weight: 800, letterSpacing: 2 })}
    ${text("\u0414\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C", 210, 690, { size: 23, color: MUTED, weight: 700, anchor: "start" })}
    <rect x="210" y="735" width="660" height="38" rx="19" fill="#293442"/>
    <rect x="210" y="735" width="${660 * level * reveal}" height="38" rx="19" fill="#FFB86B" opacity=".9"/>
    <circle cx="${markerX}" cy="754" r="${18 + Math.sin(timeMs / 170) * 3}" fill="#FFF2D7" stroke="#FFB86B" stroke-width="5"/>
    ${text("\u041D\u0438\u0437\u043A\u0438\u0439 \u0440\u0438\u0441\u043A", 210, 850, { size: 21, color: "#7ED8FF", weight: 700, anchor: "start" })}
    ${text("\u0412\u044B\u0441\u043E\u043A\u0438\u0439 \u0440\u0438\u0441\u043A", 870, 850, { size: 21, color: "#FF8D8D", weight: 700, anchor: "end" })}
    ${text(beat.metricLabel ?? "\u041F\u0420\u041E\u0412\u0415\u0420\u042C \u041E\u0413\u0420\u0410\u041D\u0418\u0427\u0415\u041D\u0418\u042F", 540, 1015, { size: 28, color: WHITE, weight: 800 })}
    ${text("\u0411\u043E\u043B\u044C\u0448\u0435 \u043F\u043E\u0442\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u2014 \u0432\u044B\u0448\u0435 \u0446\u0435\u043D\u0430 \u043E\u0448\u0438\u0431\u043A\u0438", 540, 1165, { size: 25, color: GOLD, weight: 700 })}`;
}
function sceneHueRotation(beat) {
  if (beat.visual === "contract") return 170;
  if (beat.visual === "leverage") return -92;
  if (beat.visual === "payoff") return 112;
  if (beat.visual === "comparison") return 82;
  if (beat.visual === "risk") return -48;
  if (beat.visual === "market") return 48;
  if (beat.visual === "fund") return 188;
  if (beat.visual === "distribution") return 300;
  if (beat.visual === "ownership") return 228;
  if (beat.visual === "compound_growth") return 156;
  return 0;
}
var CAMERA_FOCAL_POINTS = {
  top_left: { x: 352, y: 325 },
  top_center: { x: 540, y: 322 },
  top_right: { x: 728, y: 325 },
  center_left: { x: 352, y: 510 },
  center: { x: 540, y: 510 },
  center_right: { x: 728, y: 510 },
  hero: { x: 540, y: 438 }
};
function cameraFocalPoint(position) {
  return position ? CAMERA_FOCAL_POINTS[position] : { x: 540, y: 486 };
}
function defaultCameraActionForVisual(visual, beatIndex = 0) {
  const alternate = beatIndex % 2 === 1;
  if (visual === "hook" || visual === "definition" || visual === "leverage") {
    return alternate ? "push_in_focus_shift" : "push_in";
  }
  if (visual === "flow" || visual === "coupon" || visual === "maturity") {
    return alternate ? "tracking_parallax" : "follow_flow";
  }
  if (visual === "calendar" || visual === "distribution" || visual === "ownership") {
    return alternate ? "pan_left" : "pan_right";
  }
  if (visual === "compound_growth") return alternate ? "orbit_focus_shift" : "push_in";
  if (visual === "market" || visual === "payoff" || visual === "comparison") {
    return alternate ? "pan_right" : "pan_left";
  }
  if (visual === "risk" || visual === "summary") return alternate ? "focus_shift" : "pull_back";
  return alternate ? "tracking" : "parallax";
}
function renderTransitionSweep(progress, accent, transition) {
  if (transition === "cut") return "";
  const reveal = ease2(clamp2(progress / 0.08));
  const opacity = 0.28 * (1 - reveal);
  if (transition === "light_flash") {
    const flash = Math.sin(Math.PI * clamp2(progress / 0.12));
    return `<rect width="${WIDTH}" height="${HEIGHT}" fill="#F7F1E7" opacity="${(flash * 0.22).toFixed(3)}" pointer-events="none"/>`;
  }
  if (transition === "radial_wipe" || transition === "zoom_blur") {
    const radius = 105 + reveal * 720;
    return `<g pointer-events="none" opacity="${opacity.toFixed(3)}">
      <circle cx="540" cy="820" r="${radius.toFixed(1)}" fill="none" stroke="${accent}" stroke-width="${transition === "zoom_blur" ? 42 : 28}"/>
      <circle cx="540" cy="820" r="${(radius - 34).toFixed(1)}" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="8 24" stroke-dashoffset="${-Math.round(reveal * 260)}"/>
    </g>`;
  }
  if (transition === "center_split_wipe") {
    const opening = 540 * reveal;
    return `<g pointer-events="none" opacity="${opacity.toFixed(3)}">
      <path d="M0 190H${(540 - opening).toFixed(1)}V1470H0Z" fill="${accent}"/>
      <path d="M1080 190H${(540 + opening).toFixed(1)}V1470H1080Z" fill="${accent}"/>
    </g>`;
  }
  if (transition === "vertical_wipe") {
    const y = -180 + reveal * 1820;
    return `<rect x="0" y="${y.toFixed(1)}" width="${WIDTH}" height="130" fill="${accent}" opacity="${opacity.toFixed(3)}" pointer-events="none"/>`;
  }
  const x = -210 + reveal * 1470;
  return `<rect x="${x.toFixed(1)}" y="190" width="190" height="1280" fill="${accent}" opacity="${opacity.toFixed(3)}" transform="skewX(-12)" pointer-events="none"/>`;
}
function renderSceneMotion(beat, progress, timeMs, premiumCreator = false) {
  const phase = timeMs / 420;
  const motionColor = beat.visual === "payoff" ? "#C795FF" : beat.visual === "leverage" ? "#FFB86B" : "#7ED8FF";
  if (premiumCreator) {
    const sweepX2 = 470 + timeMs / 5 % 520;
    const glowY = 450 + (Math.round(timeMs / 7) + 310) % 560;
    const opacity = 0.08 + ease2(progress * 1.6) * 0.055;
    return `<g pointer-events="none" opacity="${opacity.toFixed(3)}">
      <path d="M${sweepX2.toFixed(1)} 410V1090" stroke="${motionColor}" stroke-width="2" opacity=".48"/>
      <circle cx="${sweepX2.toFixed(1)}" cy="${glowY}" r="7" fill="${motionColor}" opacity=".56"/>
      <path d="M${(sweepX2 - 20).toFixed(1)} ${glowY}H${(sweepX2 + 20).toFixed(1)}" stroke="${motionColor}" stroke-width="2" opacity=".42"/>
    </g>`;
  }
  const sweepX = 150 + timeMs / 5 % 780;
  const ringScale = 1 + Math.sin(phase) * 0.08;
  return `<g pointer-events="none" opacity=".5">
    <circle cx="540" cy="760" r="${300 * ringScale}" fill="none" stroke="${motionColor}" stroke-width="2" stroke-dasharray="5 30" stroke-dashoffset="${-Math.round(timeMs / 4)}"/>
    <circle cx="540" cy="760" r="${350 - Math.sin(phase * 0.7) * 18}" fill="none" stroke="${motionColor}" stroke-width="2" stroke-dasharray="2 46" stroke-dashoffset="${Math.round(timeMs / 6)}" opacity=".45"/>
    <line x1="${sweepX}" y1="300" x2="${sweepX}" y2="1210" stroke="${motionColor}" stroke-width="4" opacity=".12"/>
    ${Array.from({ length: 8 }, (_, index) => {
    const x = 160 + index * 108 + Math.sin(phase + index) * 16;
    const y = 420 + (index * 93 + Math.round(timeMs / 3)) % 660;
    return `<circle cx="${x}" cy="${y}" r="${3 + index % 3 * 2}" fill="${motionColor}" opacity="${0.18 + index % 4 * 0.08}"/>`;
  }).join("")}
  </g>`;
}
function momentAccent(kind) {
  if (kind === "risk") return "#D27662";
  if (kind === "compound_growth" || kind === "reinvestment" || kind === "market_chart") return "#78D6B0";
  if (kind === "comparison" || kind === "payoff") return "#B796E8";
  return "#E0B56F";
}
function momentCardRadius(presentation) {
  if (presentation === "document") return 14;
  if (presentation === "sticker" || presentation === "image_sticker" || presentation === "icon_bubble") return 42;
  if (presentation === "notification" || presentation === "highlighted_word" || presentation === "number_counter") return 24;
  return 32;
}
function countUpVisualValue(value, progress) {
  const match = value.match(/-?\d[\d \u00a0\u202f]*(?:[.,]\d+)?/u);
  if (!match || match.index === void 0) return value;
  const numericValue = Number(match[0].replace(/[ \u00a0\u202f]/gu, "").replace(",", "."));
  if (!Number.isFinite(numericValue)) return value;
  const countedValue = Math.round(numericValue * ease2(clamp2(progress / 0.46))).toLocaleString("ru-RU");
  return `${value.slice(0, match.index)}${countedValue}${value.slice(match.index + match[0].length)}`;
}
function renderMomentPresentationShell(style, x, y, width, height, radius, accent, timeMs) {
  const pulse = (0.68 + Math.sin(timeMs / 170) * 0.18).toFixed(2);
  switch (style) {
    case "sticker":
      return `<rect x="${x + 1}" y="${y + 2}" width="${width - 2}" height="${height - 4}" rx="${radius + 8}" fill="#F1EADB" stroke="#FFF9EC" stroke-width="7"/>
        <rect x="${x + 8}" y="${y + 9}" width="${width - 16}" height="${height - 18}" rx="${radius + 3}" fill="url(#moment-card-fill)" stroke="${accent}" stroke-width="2"/>
        <path d="M${x + width - 52} ${y + 18}l8 8 12-2-2 12 8 8-12 3-4 11-8-8-12 1 2-12-8-8 12-3z" fill="${accent}" opacity="${pulse}"/>`;
    case "image_sticker":
      return `<path d="M${x + 30} ${y + 3}Q${x + 46} ${y - 4} ${x + 60} ${y + 4}H${x + width - 44}Q${x + width - 24} ${y + 4} ${x + width - 28} ${y + 24}V${y + height - 24}Q${x + width - 26} ${y + height - 3} ${x + width - 48} ${y + height - 7}H${x + 46}Q${x + 20} ${y + height - 4} ${x + 24} ${y + height - 26}V${y + 28}Q${x + 18} ${y + 7} ${x + 30} ${y + 3}Z" fill="url(#moment-card-fill)" stroke="#FFF9EC" stroke-width="9"/>
        <path d="M${x + 32} ${y + 10}H${x + width - 46}Q${x + width - 34} ${y + 10} ${x + width - 34} ${y + 26}" fill="none" stroke="${accent}" stroke-width="2" opacity=".8"/>`;
    case "cutout_object":
      return `<path d="M${x + 24} ${y + 6}Q${x + 47} ${y - 4} ${x + 65} ${y + 7}Q${x + 93} ${y - 1} ${x + 109} ${y + 9}H${x + width - 92}Q${x + width - 70} ${y - 2} ${x + width - 53} ${y + 10}Q${x + width - 24} ${y + 4} ${x + width - 20} ${y + 29}V${y + height - 36}Q${x + width - 8} ${y + height - 15} ${x + width - 33} ${y + height - 12}Q${x + width - 59} ${y + height + 1} ${x + width - 81} ${y + height - 12}H${x + 77}Q${x + 53} ${y + height + 1} ${x + 32} ${y + height - 12}Q${x + 9} ${y + height - 8} ${x + 13} ${y + height - 35}V${y + 32}Q${x + 5} ${y + 10} ${x + 24} ${y + 6}Z" fill="url(#moment-card-fill)" stroke="#F7F0E4" stroke-width="8"/>
        <path d="M${x + 26} ${y + 13}H${x + width - 24}" stroke="${accent}" stroke-width="2" stroke-dasharray="4 9" opacity=".65"/>`;
    case "document":
      return `<path d="M${x + 12} ${y + 2}H${x + width - 38}L${x + width - 2} ${y + 38}V${y + height - 14}Q${x + width - 2} ${y + height - 2} ${x + width - 14} ${y + height - 2}H${x + 14}Q${x + 2} ${y + height - 2} ${x + 2} ${y + height - 14}V${y + 14}Q${x + 2} ${y + 2} ${x + 12} ${y + 2}Z" fill="url(#moment-card-fill)" stroke="${accent}" stroke-width="2.5"/>
        <path d="M${x + width - 38} ${y + 2}V${y + 28}Q${x + width - 38} ${y + 38} ${x + width - 28} ${y + 38}H${x + width - 2}" fill="none" stroke="${accent}" stroke-width="2" opacity=".8"/>
        <path d="M${x + 24} ${y + 60}H${x + width - 24}" stroke="${accent}" stroke-width="2" stroke-dasharray="4 8" opacity=".62"/>`;
    case "infographic":
      return `<rect x="${x + 2}" y="${y + 3}" width="${width - 4}" height="${height - 6}" rx="${radius}" fill="url(#moment-card-fill)" stroke="${accent}" stroke-width="2"/>
        <path d="M${x + 22} ${y + 59}H${x + width - 22}" stroke="${accent}" stroke-width="2" opacity=".58"/>
        <circle cx="${x + width - 34}" cy="${y + 30}" r="8" fill="${accent}" opacity="${pulse}"/>
        <rect x="${x + width - 57}" y="${y + 18}" width="4" height="24" rx="2" fill="${accent}" opacity=".45"/>
        <rect x="${x + 22}" y="${y + 23}" width="6" height="23" rx="3" fill="${accent}"/>`;
    case "notification":
      return `<rect x="${x + 3}" y="${y + 5}" width="${width - 6}" height="${height - 10}" rx="${Math.min(height / 2, 48)}" fill="#0C1311" stroke="${accent}" stroke-width="2.5"/>
        <rect x="${x + 13}" y="${y + 16}" width="7" height="${height - 32}" rx="4" fill="${accent}"/>
        <circle cx="${x + width - 31}" cy="${y + 30}" r="8" fill="${accent}" opacity="${pulse}"/>`;
    case "icon_bubble":
      return `<rect x="${x + 3}" y="${y + 5}" width="${width - 6}" height="${height - 10}" rx="${radius + 9}" fill="url(#moment-card-fill)" stroke="${accent}" stroke-width="2.5"/>
        <circle cx="${x + 42}" cy="${y + 39}" r="22" fill="#101713" stroke="${accent}" stroke-width="2.5"/>
        <circle cx="${x + 42}" cy="${y + 39}" r="7" fill="${accent}" opacity="${pulse}"/>`;
    case "highlighted_word":
      return `<path d="M${x + 24} ${y + 26}Q${x + width * 0.35} ${y + 16} ${x + width * 0.58} ${y + 24}T${x + width - 26} ${y + 25}L${x + width - 30} ${y + 53}Q${x + width * 0.64} ${y + 58} ${x + width * 0.4} ${y + 51}T${x + 28} ${y + 54}Z" fill="${accent}" fill-opacity=".35"/>
        <path d="M${x + 30} ${y + 58}Q${x + width * 0.56} ${y + 62} ${x + width - 35} ${y + 56}" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" opacity=".8"/>`;
    case "number_counter":
      return `<rect x="${x + 3}" y="${y + 7}" width="${width - 6}" height="${height - 14}" rx="${height / 2}" fill="#101713" stroke="${accent}" stroke-width="3"/>
        <circle cx="${x + 42}" cy="${y + 39}" r="19" fill="${accent}" fill-opacity=".2" stroke="${accent}" stroke-width="2"/>
        <path d="M${x + 35} ${y + 39}h14M${x + 42} ${y + 32}v14" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/>`;
    default:
      return `<rect x="${x + 8}" y="${y + 9}" width="${width - 16}" height="${height - 18}" rx="${radius}" fill="#050908" opacity=".52"/>
        <rect x="${x + 2}" y="${y + 2}" width="${width - 4}" height="${height - 4}" rx="${radius}" fill="url(#moment-card-fill)" stroke="${accent}" stroke-opacity=".88" stroke-width="2.5"/>
        <rect x="${x + 20}" y="${y + 17}" width="6" height="38" rx="3" fill="${accent}"/>
        <circle cx="${x + width - 26}" cy="${y + 27}" r="5" fill="${accent}" opacity="${pulse}"/>`;
  }
}
function renderMomentGraphic(moment, x, y, width, progress, accent) {
  const center = x + width / 2;
  const baseline = y + 120;
  const source = (moment.sourceLabel || "\u0418\u0421\u0422\u041E\u0427\u041D\u0418\u041A").slice(0, 22).toLocaleUpperCase("ru-RU");
  const target = (moment.targetLabel || "\u041F\u041E\u041B\u0423\u0427\u0410\u0422\u0415\u041B\u042C").slice(0, 22).toLocaleUpperCase("ru-RU");
  const label = moment.label.slice(0, 38);
  const detail = (moment.detail || "").slice(0, 54);
  const rawValue = (moment.value || "").slice(0, 24);
  const value = moment.presentationStyle === "number_counter" ? countUpVisualValue(rawValue, progress) : rawValue;
  if (moment.kind === "money_flow" || moment.kind === "distribution" || moment.kind === "reinvestment") {
    const coinX = x + 82 + (width - 164) * clamp2(progress);
    return `<path d="M${x + 62} ${baseline}H${x + width - 62}" stroke="${accent}" stroke-width="5" stroke-dasharray="10 12" opacity=".76"/>
      <circle cx="${x + 74}" cy="${baseline}" r="33" fill="#17211D" stroke="${accent}" stroke-width="3"/>
      <circle cx="${x + width - 74}" cy="${baseline}" r="33" fill="#17211D" stroke="${accent}" stroke-width="3"/>
      ${text(source, x + 74, baseline + 6, { size: 13, color: WHITE, weight: 800 })}
      ${text(target, x + width - 74, baseline + 6, { size: 13, color: WHITE, weight: 800 })}
      <circle cx="${coinX.toFixed(1)}" cy="${baseline}" r="18" fill="#E7BC70" stroke="#FFF0C9" stroke-width="3"/>
      ${text(value || "\u20BD", coinX, baseline + 6, { size: value.length > 4 ? 11 : 14, color: "#1B211C", weight: 900 })}
      ${moment.kind === "reinvestment" ? `<path d="M${x + width - 46} ${y + 87}C${x + width - 18} ${y + 52} ${x + 28} ${y + 52} ${x + 50} ${y + 83}" fill="none" stroke="${accent}" stroke-width="3" marker-end="url(#moment-arrow)"/>` : ""}`;
  }
  if (moment.kind === "market_chart" || moment.kind === "compound_growth" || moment.kind === "payoff") {
    const points = moment.kind === "compound_growth" ? [[0, 52], [0.24, 42], [0.5, 30], [0.74, 17], [1, 2]] : moment.kind === "payoff" ? [[0, 44], [0.27, 40], [0.52, 30], [0.76, 20], [1, 8]] : [[0, 34], [0.25, 20], [0.48, 28], [0.72, 11], [1, 16]];
    const left = x + 65;
    const right = x + width - 65;
    const top = y + 78;
    const path = points.map(([px, py], index) => {
      const pointX = left + (right - left) * px;
      const pointY = top + py;
      return `${index ? "L" : "M"}${pointX.toFixed(1)} ${pointY.toFixed(1)}`;
    }).join(" ");
    const drawn = clamp2(progress);
    return `<line x1="${left}" y1="${baseline}" x2="${right}" y2="${baseline}" stroke="#73877D" stroke-width="2" opacity=".5"/>
      <path d="${path}" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="${drawn.toFixed(3)} 1"/>
      ${points.slice(0, Math.max(2, Math.ceil(points.length * drawn))).map(([px, py]) => `<circle cx="${(left + (right - left) * px).toFixed(1)}" cy="${(top + py).toFixed(1)}" r="5" fill="${accent}"/>`).join("")}
      ${value ? text(value, x + width - 70, y + 74, { size: 17, color: "#F1D18C", weight: 850, anchor: "end" }) : ""}
      ${detail ? text(detail.slice(0, 24), center, y + 149, { size: 15, color: MUTED, weight: 650 }) : ""}`;
  }
  if (moment.kind === "comparison") {
    const split = center;
    return `<line x1="${split}" y1="${y + 72}" x2="${split}" y2="${y + 152}" stroke="#65766C" stroke-width="2" opacity=".7"/>
      <rect x="${x + 38}" y="${y + 78}" width="${width / 2 - 55}" height="69" rx="17" fill="#1A2822" stroke="${accent}" stroke-opacity=".62"/>
      <rect x="${split + 17}" y="${y + 78}" width="${width / 2 - 55}" height="69" rx="17" fill="#25221E" stroke="#D27662" stroke-opacity=".62"/>
      ${text(label.slice(0, 16).toLocaleUpperCase("ru-RU"), x + width * 0.27, y + 105, { size: 15, color: WHITE, weight: 850 })}
      ${text(value || detail.slice(0, 16), x + width * 0.27, y + 130, { size: 13, color: accent, weight: 700 })}
      ${text((detail || "\u0414\u0420\u0423\u0413\u041E\u0419 \u0420\u0415\u0417\u0423\u041B\u042C\u0422\u0410\u0422").slice(0, 16).toLocaleUpperCase("ru-RU"), x + width * 0.73, y + 105, { size: 15, color: WHITE, weight: 850 })}
      ${text("\u0421\u0420\u0410\u0412\u041D\u0415\u041D\u0418\u0415", x + width * 0.73, y + 130, { size: 13, color: "#E39A84", weight: 700 })}`;
  }
  if (moment.kind === "timeline") {
    const points = [x + 74, center, x + width - 74];
    return `<line x1="${points[0]}" y1="${baseline}" x2="${points[2]}" y2="${baseline}" stroke="#718278" stroke-width="5" stroke-linecap="round"/>
      <line x1="${points[0]}" y1="${baseline}" x2="${(points[0] + (points[2] - points[0]) * clamp2(progress)).toFixed(1)}" y2="${baseline}" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>
      ${points.map((point, index) => `<circle cx="${point}" cy="${baseline}" r="${index / 2 <= progress ? 13 : 10}" fill="${index / 2 <= progress ? accent : "#293931"}" stroke="${index / 2 <= progress ? "#F1D18C" : "#53645B"}" stroke-width="2"/>`).join("")}
      ${text(value || detail.slice(0, 24), center, y + 152, { size: 14, color: MUTED, weight: 650 })}`;
  }
  if (moment.kind === "portfolio") {
    const assets = [
      { label: "\u0410\u041A\u0426\u0418\u0418", color: "#77C9A8" },
      { label: "\u041E\u0411\u041B\u0418\u0413\u0410\u0426\u0418\u0418", color: "#D8B16D" },
      { label: "\u0417\u041E\u041B\u041E\u0422\u041E", color: "#89A9DB" },
      { label: "\u0414\u0420\u0423\u0413\u0418\u0415 \u0410\u041A\u0422\u0418\u0412\u042B", color: "#C398D7" }
    ];
    return `<circle cx="${x + 53}" cy="${baseline}" r="35" fill="#18241E" stroke="${accent}" stroke-width="3"/>
      ${text("\u0424\u041E\u041D\u0414", x + 53, baseline + 5, { size: 16, color: WHITE, weight: 850 })}
      ${assets.map((asset, index) => {
      const tileX = x + 105 + index % 2 * 143;
      const tileY = y + 82 + Math.floor(index / 2) * 57;
      const reveal = clamp2(progress * 2.2 - index * 0.12);
      return `<path d="M${x + 88} ${baseline}L${tileX} ${tileY + 19}" stroke="${asset.color}" stroke-width="2" stroke-dasharray="4 6" opacity="${(reveal * 0.66).toFixed(2)}"/>
          <g opacity="${reveal.toFixed(3)}" transform="translate(0 ${(1 - reveal) * 7})">
            <rect x="${tileX}" y="${tileY}" width="132" height="38" rx="10" fill="${asset.color}" fill-opacity=".14" stroke="${asset.color}" stroke-width="2"/>
            ${text(asset.label, tileX + 66, tileY + 24, { size: asset.label.length > 9 ? 15 : 17, color: WHITE, weight: 800 })}
          </g>`;
    }).join("")}
      ${text("\u0414\u041E\u041B\u0418 \u041F\u041E\u0420\u0422\u0424\u0415\u041B\u042F \xB7 \u0421\u0425\u0415\u041C\u0410", center, y + 193, { size: 15, color: MUTED, weight: 700 })}`;
  }
  if (moment.kind === "ownership") {
    const shareholders = [
      { x: x + 286, y: y + 82, label: "\u0410\u041A\u0426\u0418\u041E\u041D\u0415\u0420 1" },
      { x: x + 286, y: y + 122, label: "\u0410\u041A\u0426\u0418\u041E\u041D\u0415\u0420 2" },
      { x: x + 286, y: y + 162, label: "\u0410\u041A\u0426\u0418\u041E\u041D\u0415\u0420 3" }
    ];
    const reveal = clamp2(progress * 2);
    return `<rect x="${x + 22}" y="${y + 91}" width="134" height="58" rx="15" fill="#142B26" stroke="${accent}" stroke-width="2.5"/>
      ${text("\u041A\u041E\u041C\u041F\u0410\u041D\u0418\u042F", x + 89, y + 126, { size: 16, color: WHITE, weight: 850 })}
      ${shareholders.map((shareholder, index) => {
      const itemReveal = clamp2(reveal - index * 0.12);
      return `<path d="M${x + 157} ${y + 120}L${shareholder.x - 8} ${shareholder.y}" stroke="${accent}" stroke-width="2" stroke-dasharray="4 6" opacity="${itemReveal.toFixed(2)}"/>
          <g opacity="${itemReveal.toFixed(3)}">
            <circle cx="${shareholder.x}" cy="${shareholder.y}" r="13" fill="#18241E" stroke="${accent}" stroke-width="2"/>
            <circle cx="${shareholder.x}" cy="${shareholder.y - 3}" r="4" fill="${accent}"/>
            <path d="M${shareholder.x - 6} ${shareholder.y + 7}Q${shareholder.x} ${shareholder.y + 1} ${shareholder.x + 6} ${shareholder.y + 7}" fill="none" stroke="${accent}" stroke-width="2"/>
            ${text(shareholder.label, shareholder.x + 21, shareholder.y + 5, { size: 14, color: WHITE, weight: 750, anchor: "start" })}
          </g>`;
    }).join("")}
      ${text("\u0410\u041A\u0426\u0418\u042F = \u0414\u041E\u041B\u042F \u0412 \u041A\u041E\u041C\u041F\u0410\u041D\u0418\u0418", center, y + 193, { size: 15, color: MUTED, weight: 750 })}`;
  }
  if (moment.kind === "risk") {
    const meterWidth = width - 140;
    const meterX = x + 70;
    return `<rect x="${meterX}" y="${baseline - 8}" width="${meterWidth}" height="16" rx="8" fill="#354239"/>
      <rect x="${meterX}" y="${baseline - 8}" width="${(meterWidth * clamp2(progress * 0.88 + 0.12)).toFixed(1)}" height="16" rx="8" fill="url(#moment-risk-gradient)"/>
      <path d="M${meterX + meterWidth * 0.66} ${baseline - 25}L${meterX + meterWidth * 0.66 + 14} ${baseline + 24}H${meterX + meterWidth * 0.66 - 14}Z" fill="#F2C979"/>
      ${text("\u0420\u0418\u0421\u041A", meterX + meterWidth * 0.66, y + 78, { size: 14, color: "#F2C979", weight: 900 })}
      ${text(detail || value || label, center, y + 153, { size: 15, color: WHITE, weight: 700 })}`;
  }
  if (moment.kind === "document" || moment.kind === "concept_card") {
    return `<rect x="${center - 47}" y="${y + 73}" width="94" height="73" rx="11" fill="#E8E0CE" stroke="#F8F0DE" stroke-width="2" transform="rotate(-4 ${center} ${y + 110})"/>
      <path d="M${center - 28} ${y + 96}H${center + 26}M${center - 28} ${y + 110}H${center + 18}M${center - 28} ${y + 124}H${center + 2}" stroke="#627064" stroke-width="4" stroke-linecap="round"/>
      <circle cx="${center + 27}" cy="${y + 130}" r="16" fill="${accent}" opacity=".88"/>
      ${text(value || "\u0424\u0410\u041A\u0422", center + 27, y + 135, { size: 11, color: "#17221D", weight: 900 })}
      ${detail ? text(detail.slice(0, 28), center, y + 159, { size: 14, color: MUTED, weight: 700 }) : ""}`;
  }
  if (moment.kind === "sticker") {
    return `<circle cx="${center}" cy="${baseline}" r="38" fill="${accent}" fill-opacity=".18" stroke="${accent}" stroke-width="3"/>
      <path d="M${center - 16} ${baseline}L${center - 3} ${baseline + 13}L${center + 20} ${baseline - 15}" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      ${detail ? text(detail.slice(0, 30), center, y + 158, { size: 14, color: WHITE, weight: 750 }) : ""}`;
  }
  const numberSize = (value || "").length > 11 ? 31 : (value || "").length > 7 ? 38 : 48;
  return `<circle cx="${center}" cy="${baseline}" r="37" fill="${accent}" fill-opacity=".14"/>
    ${text(value || label.slice(0, 14), center, baseline + 14, { size: value ? numberSize : 24, color: "#F0C579", weight: 900 })}
    ${detail ? text(detail.slice(0, 44), center, y + 181, { size: 12, color: MUTED, weight: 600 }) : ""}`;
}
function renderFinancialRasterLayer(moment, asset, x, y, width, height, accent) {
  const safeId = moment.id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const href = escapeXml2(asset.dataUri);
  if (asset.renderMode === "cutout") {
    const objectWidth = Math.min(width - 52, (height - 58) * 1.15);
    const objectHeight = height - 58;
    return `<ellipse cx="${x + width / 2}" cy="${y + height * 0.63}" rx="${objectWidth * 0.42}" ry="${objectHeight * 0.34}" fill="${accent}" opacity=".12"/>
      <image href="${href}" x="${x + (width - objectWidth) / 2}" y="${y + 48}" width="${objectWidth}" height="${objectHeight}" preserveAspectRatio="xMidYMid meet" filter="url(#moment-shadow)"/>`;
  }
  const imageX = x + 13;
  const imageY = y + 56;
  const imageWidth = width - 26;
  const imageHeight = height - 69;
  return `<defs><clipPath id="finance-media-${safeId}">
      <rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" rx="18"/>
    </clipPath></defs>
    <image href="${href}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#finance-media-${safeId})"/>
    <rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" rx="18" fill="#09151D" fill-opacity=".2"/>
    <rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" rx="18" fill="none" stroke="${accent}" stroke-opacity=".72" stroke-width="2"/>`;
}
function renderMicroObjectGlyph(label, x, y, accent) {
  const normalized = label.toLocaleLowerCase("ru-RU");
  if (/bitcoin|биткоин|\bbtc\b/u.test(normalized)) {
    return `<circle cx="${x}" cy="${y}" r="22" fill="#1A2119" stroke="${accent}" stroke-width="3"/>
      ${text("BTC", x, y + 6, { size: 14, color: WHITE, weight: 900 })}`;
  }
  if (/кошел|wallet/u.test(normalized)) {
    return `<rect x="${x - 24}" y="${y - 17}" width="48" height="34" rx="7" fill="#17231E" stroke="${accent}" stroke-width="3"/>
      <path d="M${x - 23} ${y - 5}H${x + 24}M${x + 8} ${y - 1}H${x + 24}V${y + 10}H${x + 8}Z" fill="none" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="${x + 13}" cy="${y + 5}" r="2.5" fill="${accent}"/>`;
  }
  if (/сеть|блокчейн|узел|node|network/u.test(normalized)) {
    return `<path d="M${x - 17} ${y - 11}L${x + 16} ${y - 12}L${x} ${y + 17}Z" fill="none" stroke="${accent}" stroke-width="3"/>
      <circle cx="${x - 17}" cy="${y - 11}" r="6" fill="#122019" stroke="${accent}" stroke-width="3"/>
      <circle cx="${x + 16}" cy="${y - 12}" r="6" fill="#122019" stroke="${accent}" stroke-width="3"/>
      <circle cx="${x}" cy="${y + 17}" r="6" fill="#122019" stroke="${accent}" stroke-width="3"/>`;
  }
  if (/бирж|обмен|exchange/u.test(normalized)) {
    return `<rect x="${x - 23}" y="${y - 18}" width="46" height="36" rx="6" fill="#17231E" stroke="${accent}" stroke-width="3"/>
      <path d="M${x - 13} ${y - 7}H${x + 10}L${x + 5} ${y - 12}M${x + 13} ${y + 7}H${x - 10}L${x - 5} ${y + 12}" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  const initial = [...label.trim()][0]?.toLocaleUpperCase("ru-RU") || "\u2022";
  return `<circle cx="${x}" cy="${y}" r="22" fill="#17231E" stroke="${accent}" stroke-width="3"/>
    ${text(initial, x, y + 9, { size: 28, color: WHITE, weight: 900 })}`;
}
function renderFinancialMicroBeat(moment, microBeat, progress, timeMs) {
  if (progress < microBeat.from || progress >= microBeat.to) return "";
  const eventProgress = clamp2((progress - microBeat.from) / Math.max(1e-3, microBeat.to - microBeat.from));
  const enter = ease2(clamp2(eventProgress / 0.28));
  const exitProgress = clamp2((eventProgress - 0.74) / 0.26);
  const leave = 1 - ease2(exitProgress);
  const position = {
    top_left: { x: 352, y: 325 },
    top_center: { x: 540, y: 322 },
    top_right: { x: 728, y: 325 },
    center_left: { x: 352, y: 510 },
    center: { x: 540, y: 510 },
    center_right: { x: 728, y: 510 },
    hero: { x: 540, y: 438 }
  }[moment.position];
  const requestedSide = microBeat.position.endsWith("left") ? "left" : "right";
  const momentSide = position.x < 450 ? "left" : position.x > 630 ? "right" : void 0;
  const side = momentSide === requestedSide ? requestedSide === "left" ? "right" : "left" : requestedSide;
  const centerX = side === "left" ? 186 : 894;
  const centerY = microBeat.position.startsWith("upper_") ? 340 : 760;
  const accent = momentAccent(moment.kind);
  const label = microBeat.text.toLocaleUpperCase("ru-RU");
  const width = Math.max(118, Math.min(238, 74 + label.length * 12));
  const height = microBeat.kind === "number" ? 82 : 70;
  const x = centerX - width / 2;
  const y = centerY - height / 2;
  let offsetX = 0;
  let offsetY = 0;
  let scale = 0.35 + enter * 0.65;
  let scaleX = 1;
  let rotation = microBeat.kind === "sticker" ? -4 : 0;
  switch (microBeat.enterAnimation) {
    case "slide_left":
    case "swipe":
      offsetX = -86 * (1 - enter);
      break;
    case "slide_right":
    case "notification":
      offsetX = 86 * (1 - enter);
      break;
    case "slide_top":
      offsetY = -58 * (1 - enter);
      break;
    case "slide_bottom":
      offsetY = 58 * (1 - enter);
      break;
    case "bounce":
      offsetY = -30 * (1 - enter) + Math.sin(enter * Math.PI * 3) * (1 - enter) * 9;
      scale = 0.76 + enter * 0.24;
      break;
    case "elastic_pop":
    case "spring":
      scale = 0.54 + enter * 0.46 + Math.sin(enter * Math.PI * 2) * (1 - enter) * 0.18;
      break;
    case "rotate_scale":
    case "sticker_pop":
      rotation += (1 - enter) * -13;
      scale = 0.42 + enter * 0.58;
      break;
    case "flip":
      scaleX = Math.max(0.04, enter);
      scale = 1;
      break;
    case "floating":
      offsetY = Math.sin(timeMs / 220) * 4;
      break;
    case "scale_pop":
    case "card_pop":
      scale = 0.48 + enter * 0.52 + (1 - enter) * 0.08;
      break;
    case "overshoot":
      scale = 0.38 + ease2(enter) * 0.62 + Math.sin(enter * Math.PI) * (1 - enter) * 0.24;
      break;
  }
  const exitOffset = 54 * exitProgress;
  if (microBeat.exitAnimation === "slide_left") offsetX -= exitOffset;
  if (microBeat.exitAnimation === "slide_right") offsetX += exitOffset;
  if (microBeat.exitAnimation === "slide_top") offsetY -= exitOffset;
  if (microBeat.exitAnimation === "slide_bottom") offsetY += exitOffset;
  if (microBeat.exitAnimation === "shrink") scale *= 1 - exitProgress * 0.5;
  const transform = `translate(${(centerX + offsetX).toFixed(1)} ${(centerY + offsetY).toFixed(1)}) rotate(${rotation.toFixed(2)}) scale(${(scale * scaleX).toFixed(3)} ${scale.toFixed(3)}) translate(${-centerX} ${-centerY})`;
  if (microBeat.kind === "arrow") {
    const direction = side === "left" ? -1 : 1;
    const draw = clamp2(eventProgress / 0.48);
    const startX = centerX - direction * 62;
    const endX = centerX + direction * 58;
    const arrowHead = direction === 1 ? `M${endX - 14} ${centerY - 11}L${endX} ${centerY}L${endX - 14} ${centerY + 11}Z` : `M${endX + 14} ${centerY - 11}L${endX} ${centerY}L${endX + 14} ${centerY + 11}Z`;
    return `<g pointer-events="none" opacity="${(enter * leave).toFixed(3)}" transform="${transform}">
      <path d="M${startX} ${centerY}Q${centerX} ${centerY - 30} ${endX} ${centerY}" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round" stroke-dasharray="180" stroke-dashoffset="${(180 * (1 - draw)).toFixed(1)}"/>
      <path d="${arrowHead}" fill="${accent}"/>
    </g>`;
  }
  const stickerShell = microBeat.kind === "sticker" ? `<path d="M${x + 19} ${y}H${x + width - 19}Q${x + width} ${y} ${x + width} ${y + 19}V${y + height - 19}Q${x + width} ${y + height} ${x + width - 19} ${y + height}H${x + 19}Q${x} ${y + height} ${x} ${y + height - 19}V${y + 19}Q${x} ${y} ${x + 19} ${y}Z" fill="#E7C582" stroke="#FFF0CF" stroke-width="3"/>
      <path d="M${x + width - 30} ${y + 11}L${x + width - 24} ${y + 23}L${x + width - 11} ${y + 25}L${x + width - 21} ${y + 34}L${x + width - 18} ${y + 47}L${x + width - 30} ${y + 40}L${x + width - 42} ${y + 47}L${x + width - 39} ${y + 34}L${x + width - 49} ${y + 25}L${x + width - 36} ${y + 23}Z" fill="#9A6F35"/>` : `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${microBeat.kind === "number" ? 24 : 18}" fill="#101B17" fill-opacity=".97" stroke="${accent}" stroke-width="${microBeat.kind === "highlight" ? 3 : 2}"/>`;
  const icon = microBeat.kind === "object" ? renderMicroObjectGlyph(microBeat.text, x + 34, centerY, accent) : "";
  const labelX = microBeat.kind === "object" ? x + 66 : centerX;
  const labelAnchor = microBeat.kind === "object" ? "start" : "middle";
  const labelColor = microBeat.kind === "sticker" ? "#172019" : microBeat.kind === "number" ? "#F0C579" : WHITE;
  const labelSize = microBeat.kind === "number" ? 30 : microBeat.kind === "keyword" ? 27 : 21;
  const centerTransform = `translate(${centerX} ${centerY}) scale(${scale.toFixed(3)}) translate(${-centerX} ${-centerY})`;
  const highlight = microBeat.kind === "highlight" ? `<path d="M${x + 18} ${y + height - 12}Q${centerX} ${y + height - 3} ${x + width - 18} ${y + height - 12}" fill="none" stroke="#D3A14D" stroke-width="7" stroke-linecap="round" stroke-dasharray="${width}" stroke-dashoffset="${(width * (1 - enter)).toFixed(1)}"/>` : "";
  return `<g pointer-events="none" opacity="${(enter * leave).toFixed(3)}" transform="${transform}">
    ${stickerShell}
    ${icon}
    ${text(label, labelX, centerY + 8, { size: labelSize, color: labelColor, weight: 900, anchor: labelAnchor, letterSpacing: microBeat.kind === "keyword" ? 1.1 : 0.2 })}
    ${highlight}
    ${microBeat.kind === "number" ? `<circle cx="${x + 14}" cy="${y + 14}" r="4" fill="${accent}"/>` : ""}
  </g>`;
}
function renderFinancialVisualMoment(moment, progress, timeMs, featured = false, asset) {
  const position = {
    top_left: { x: 352, y: 325 },
    top_center: { x: 540, y: 322 },
    top_right: { x: 728, y: 325 },
    center_left: { x: 352, y: 510 },
    center: { x: 540, y: 510 },
    center_right: { x: 728, y: 510 },
    hero: { x: 540, y: 438 }
  }[moment.position];
  const width = moment.position === "hero" ? 790 : moment.position === "center" ? 500 : 410;
  const height = moment.position === "hero" ? 248 : 214;
  const x = position.x - width / 2;
  const y = position.y - height / 2;
  const accent = momentAccent(moment.kind);
  const presentationStyle = moment.presentationStyle ?? "card";
  const enter = ease2(clamp2(progress / 0.16));
  const exitProgress = clamp2((progress - 0.83) / 0.17);
  const leave = moment.exitAnimation === "hold" ? 1 : 1 - ease2(exitProgress);
  let offsetX = 0;
  let offsetY = 0;
  let rotation = 0;
  let scaleX = 1;
  let scaleY = 1;
  let scale = 0.76 + enter * 0.24;
  const presentationScale = {
    card: 0.86,
    sticker: 0.78,
    image_sticker: 0.76,
    cutout_object: 0.8,
    document: 0.84,
    infographic: 0.88,
    notification: 0.78,
    icon_bubble: 0.8,
    highlighted_word: 0.85,
    number_counter: 0.76
  }[presentationStyle] * (moment.position === "hero" ? 0.84 : moment.position === "center" ? 0.9 : 1);
  const displacement = (1 - enter) * 118;
  switch (moment.enterAnimation) {
    case "slide_left":
    case "swipe":
      offsetX = -displacement;
      scale = 1;
      break;
    case "slide_right":
    case "notification":
      offsetX = displacement;
      scale = 1;
      break;
    case "slide_top":
      offsetY = -displacement;
      scale = 1;
      break;
    case "slide_bottom":
      offsetY = displacement;
      scale = 1;
      break;
    case "bounce":
      offsetY = (1 - enter) * -68 + Math.sin(enter * Math.PI * 3) * (1 - enter) * 13;
      break;
    case "elastic_pop":
    case "spring":
      scale = 0.72 + enter * 0.28 + Math.sin(enter * Math.PI * 2) * (1 - enter) * 0.12;
      break;
    case "rotate_scale":
    case "sticker_pop":
      rotation = (1 - enter) * -11;
      scale = 0.64 + enter * 0.36;
      break;
    case "flip":
      scaleX = Math.max(0.04, enter);
      scale = 1;
      break;
    case "floating":
      offsetY = Math.sin(timeMs / 240) * 7;
      break;
    case "scale_pop":
    case "card_pop":
      scale = 0.62 + enter * 0.38 + (1 - enter) * 0.06;
      break;
    case "overshoot":
      scale = 0.52 + ease2(enter) * 0.48 + Math.sin(enter * Math.PI) * (1 - enter) * 0.28;
      break;
  }
  if (featured) scale *= 1.08;
  const exitOffset = 94 * exitProgress;
  if (moment.exitAnimation === "slide_left") offsetX -= exitOffset;
  if (moment.exitAnimation === "slide_right") offsetX += exitOffset;
  if (moment.exitAnimation === "slide_top") offsetY -= exitOffset;
  if (moment.exitAnimation === "slide_bottom") offsetY += exitOffset;
  if (moment.exitAnimation === "shrink") scale *= 1 - exitProgress * 0.32;
  const opacity = leave;
  const radius = momentCardRadius(presentationStyle);
  const styleRotation = presentationStyle === "sticker" || presentationStyle === "image_sticker" ? -2.4 : presentationStyle === "cutout_object" ? 1.5 : presentationStyle === "document" ? -0.8 : 0;
  const labelX = x + (presentationStyle === "icon_bubble" || presentationStyle === "number_counter" ? 72 : 40);
  const transformScale = scale * presentationScale;
  const shell = renderMomentPresentationShell(
    presentationStyle,
    x,
    y,
    width,
    height,
    radius,
    accent,
    timeMs
  );
  const rasterLayer = asset ? renderFinancialRasterLayer(moment, asset, x, y, width, height, accent) : "";
  return `<g pointer-events="none" opacity="${opacity.toFixed(3)}" transform="translate(${(position.x + offsetX).toFixed(1)} ${(position.y + offsetY).toFixed(1)}) rotate(${(rotation + styleRotation).toFixed(2)}) scale(${(transformScale * scaleX).toFixed(3)} ${(transformScale * scaleY).toFixed(3)}) translate(${-position.x} ${-position.y})">
    <defs>
      <linearGradient id="moment-card-fill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1B2822" stop-opacity=".99"/>
        <stop offset="1" stop-color="#111A17" stop-opacity=".98"/>
      </linearGradient>
      <linearGradient id="moment-risk-gradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#7FC5A2"/>
        <stop offset=".62" stop-color="#E2B76E"/>
        <stop offset="1" stop-color="#D27662"/>
      </linearGradient>
      <marker id="moment-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M0 0L8 4L0 8Z" fill="${accent}"/>
      </marker>
      <filter id="moment-shadow" x="-30%" y="-30%" width="160%" height="180%">
        <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000000" flood-opacity=".35"/>
      </filter>
    </defs>
    <g filter="url(#moment-shadow)">${shell}</g>
    ${rasterLayer}
    ${text(moment.label.slice(0, 42).toLocaleUpperCase("ru-RU"), labelX, y + 42, { size: 20, color: WHITE, weight: 850, anchor: "start", letterSpacing: 0.6 })}
    ${asset ? "" : renderMomentGraphic(moment, x, y, width, progress, accent)}
    ${(moment.microBeats ?? []).map((microBeat) => renderFinancialMicroBeat(moment, microBeat, progress, timeMs)).join("")}
  </g>`;
}
function renderVisual(beat, progress, timeMs, beatStartMs, beatEndMs) {
  const entry = ease2(clamp2(progress * 1.7));
  const exit = clamp2((1 - progress) * 1.7);
  const actors = beat.concept === "futures_contract" || beat.concept === "compound_interest" ? "" : `${actor("investor", 170, 760, entry, timeMs)}${actor("company", 910, 760, entry, timeMs)}`;
  const livePulse = 1 + Math.sin(timeMs / 360) * 0.035;
  if (beat.visual === "ownership") return ownershipVisual(beat, progress, timeMs);
  if (beat.visual === "fund") return fundPoolVisual(beat, progress, timeMs);
  if (beat.visual === "distribution") return distributionVisual(beat, progress, timeMs);
  if (beat.visual === "compound_growth") return compoundGrowthVisual(beat, progress, timeMs);
  if (beat.visual === "contract") return contractVisual(beat, progress, timeMs);
  if (beat.visual === "leverage") return leverageVisual(beat, progress, timeMs);
  if (beat.visual === "payoff") return payoffVisual(beat, progress, timeMs);
  if (beat.visual === "comparison") return comparisonVisual(beat, progress, timeMs);
  if (beat.visual === "risk") return riskVisual(beat, progress, timeMs);
  if (beat.visual === "hook") {
    const flowProgress = clamp2((progress - 0.24) / 0.76);
    const heroWord = beat.entityLabel?.trim() || beat.title.replace(/[—–:!?.,]/gu, " ").trim().split(/\s+/u)[0] || "\u0424\u0418\u041D\u0410\u041D\u0421\u042B";
    const heroSize = Math.max(58, Math.min(96, 650 / Math.max(1, heroWord.length * 0.6)));
    const heroReveal = ease2(clamp2(progress / 0.2));
    const heroScale = 0.82 + heroReveal * 0.18;
    return `${actors}
      <circle cx="540" cy="625" r="${148 + Math.sin(timeMs / 230) * 5}" fill="#C28B43" opacity=".065"/>
      <circle cx="540" cy="625" r="168" fill="none" stroke="#D4A660" stroke-width="2" stroke-dasharray="5 18" stroke-dashoffset="${-Math.round(timeMs / 4)}" opacity=".44"/>
      <g opacity="${heroReveal.toFixed(3)}" transform="translate(540 625) scale(${heroScale.toFixed(3)}) translate(-540 -625)">
        ${text(heroWord.toLocaleUpperCase("ru-RU"), 540, 650, { size: heroSize, color: WHITE, weight: 900, letterSpacing: 1 })}
      </g>
      <path d="M285 780 C410 570 670 980 795 780" fill="none" stroke="${GREEN}" stroke-width="4" stroke-dasharray="12 18" opacity=".45"/>
      ${coinsAlongCurve(flowProgress, false, GREEN)}
      <path d="M310 730H770" stroke="#D4A660" stroke-width="2" stroke-dasharray="5 12" opacity=".46"/>
      ${text(beat.metricLabel ?? "\u041A\u041E\u041D\u0422\u0420\u0410\u041A\u0422 \u0418 \u0415\u0413\u041E \u0420\u0418\u0421\u041A", 540, 1110, { size: 28, color: MUTED, weight: 700, letterSpacing: 1.5 })}`;
  }
  if (beat.visual === "definition") {
    return `${actors}
      ${documentCard(entry, beat.entityLabel ?? "\u041E\u0411\u042F\u0417\u0410\u0422\u0415\u041B\u042C\u0421\u0422\u0412\u041E", beat.definitionCaption)}
      ${text(beat.entityLabel ?? "\u041E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u044F", 540, 1090, { size: 36, color: WHITE, weight: 800 })}
      ${text(beat.subtitle.length < 48 ? beat.subtitle : "\u043F\u043E\u043D\u044F\u0442\u043D\u0430\u044F \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u0430\u044F \u0441\u0445\u0435\u043C\u0430", 540, 1140, { size: 28, color: GREEN, weight: 700 })}`;
  }
  if (beat.visual === "flow") {
    const flowProgress = clamp2((progress - 0.15) / 0.72);
    return `${actors}
      <path d="M285 780 C410 570 670 980 795 780" fill="none" stroke="${GREEN}" stroke-width="5" stroke-dasharray="12 18" opacity=".58"/>
      ${coinsAlongCurve(flowProgress, false, GREEN)}
      ${badge(beat.entityLabel ?? "\u041E\u0411\u041B\u0418\u0413\u0410\u0426\u0418\u042F", 540, 465, GREEN, entry * livePulse, 350)}
      ${text(beat.subtitle.length < 48 ? beat.subtitle : "\u0418\u043D\u0432\u0435\u0441\u0442\u043E\u0440 \u2192 \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u044F", 540, 1100, { size: 30, color: WHITE, weight: 700 })}`;
  }
  if (beat.visual === "coupon") {
    const flowProgress = clamp2((progress - 0.12) / 0.76);
    return `${actors}
      <path d="M795 780 C670 570 410 980 285 780" fill="none" stroke="#B9F7D8" stroke-width="5" stroke-dasharray="12 18" opacity=".58"/>
      ${coinsAlongCurve(flowProgress, true, "#B9F7D8")}
      ${badge(beat.metricLabel ?? "\u041A\u0423\u041F\u041E\u041D\u041D\u0410\u042F \u0414\u041E\u0425\u041E\u0414\u041D\u041E\u0421\u0422\u042C", 540, 465, "#B9F7D8", entry * livePulse, 350)}
      ${text(beat.subtitle.length < 48 ? beat.subtitle : "\u0412\u044B\u043F\u043B\u0430\u0442\u0430 \u043F\u0440\u0438\u0445\u043E\u0434\u0438\u0442 \u043F\u043E \u0433\u0440\u0430\u0444\u0438\u043A\u0443", 540, 1100, { size: 29, color: WHITE, weight: 700 })}`;
  }
  if (beat.visual === "calendar" && beat.concept === "profit_distribution") {
    const stages = [
      { x: 290, label: "\u0420\u0415\u0428\u0415\u041D\u0418\u0415" },
      { x: 540, label: "\u0414\u0410\u0422\u0410 \u0424\u0418\u041A\u0421\u0410\u0426\u0418\u0418" },
      { x: 790, label: "\u0412\u042B\u041F\u041B\u0410\u0422\u0410" }
    ];
    return `${actors}
      ${panel(145, 490, 790, 400, "#0D1A22", PANEL_EDGE)}
      ${text("\u041A\u0410\u041B\u0415\u041D\u0414\u0410\u0420\u042C \u0414\u0418\u0412\u0418\u0414\u0415\u041D\u0414\u0410", 540, 565, { size: 30, color: GREEN, weight: 800, letterSpacing: 1.5 })}
      <line x1="290" y1="710" x2="790" y2="710" stroke="#35505B" stroke-width="8" stroke-linecap="round"/>
      <line x1="290" y1="710" x2="${290 + 500 * clamp2(progress)}" y2="710" stroke="${GREEN}" stroke-width="8" stroke-linecap="round"/>
      ${stages.map((stage, index) => {
      const active = index / (stages.length - 1) <= progress;
      const pulse = active ? 1 + Math.sin(timeMs / 280 + index) * 0.1 : 1;
      return `<circle cx="${stage.x}" cy="710" r="${19 * pulse}" fill="${active ? GREEN : "#20343F"}" stroke="${active ? GREEN : "#3A5360"}" stroke-width="4"/>${text(stage.label, stage.x, 785, { size: 19, color: active ? WHITE : MUTED, weight: 750 })}`;
    }).join("")}
      ${text("\u0414\u0415\u041D\u042C\u0413\u0418 \u2192 \u0410\u041A\u0426\u0418\u041E\u041D\u0415\u0420\u0410\u041C", 540, 875, { size: 27, color: GOLD, weight: 800, letterSpacing: 0.8 })}`;
  }
  if (beat.visual === "calendar") {
    const months = Math.round(clamp2(progress) * 12);
    return `${actors}
      ${panel(170, 490, 740, 400, "#0D1A22", PANEL_EDGE)}
      ${text("\u0413\u0420\u0410\u0424\u0418\u041A \u0412\u042B\u041F\u041B\u0410\u0422", 540, 565, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      <line x1="260" y1="720" x2="820" y2="720" stroke="#35505B" stroke-width="8" stroke-linecap="round"/>
      <line x1="260" y1="720" x2="${260 + 560 * clamp2(progress)}" y2="720" stroke="${GREEN}" stroke-width="8" stroke-linecap="round"/>
      ${Array.from({ length: 5 }, (_, index) => {
      const x = 260 + index * 140;
      const active = index / 4 <= progress;
      const pulse = active ? 1 + Math.sin(timeMs / 280 + index) * 0.12 : 1;
      return `<circle cx="${x}" cy="720" r="${22 * pulse}" fill="${active ? GREEN : "#20343F"}" stroke="${active ? GREEN : "#3A5360"}" stroke-width="4"/>${text(`${index * 3 || 1} \u043C\u0435\u0441.`, x, 790, { size: 20, color: active ? WHITE : MUTED, weight: 700 })}`;
    }).join("")}
      ${text(`${months || 1} / 12 \u043C\u0435\u0441\u044F\u0446\u0435\u0432`, 540, 965, { size: 36, color: WHITE, weight: 800 })}
      ${text("\u0412\u0440\u0435\u043C\u044F \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u043F\u043E \u043F\u043B\u0430\u043D\u0443", 540, 1100, { size: 28, color: GREEN, weight: 700 })}`;
  }
  if (beat.visual === "market") {
    return `${actors}${chartVisual(beat, progress, timeMs)}`;
  }
  if (beat.visual === "maturity") {
    const flowProgress = clamp2((progress - 0.18) / 0.7);
    return `${actors}
      <path d="M795 780 C670 570 410 980 285 780" fill="none" stroke="${GOLD}" stroke-width="5" stroke-dasharray="12 18" opacity=".58"/>
      ${coinsAlongCurve(flowProgress, true, GOLD)}
      ${badge(beat.maturityLabel ?? "\u0412\u041E\u0417\u0412\u0420\u0410\u0422 \u041D\u041E\u041C\u0418\u041D\u0410\u041B\u0410", 540, 465, GOLD, entry * livePulse, 330)}
      ${text(beat.subtitle.length < 48 ? beat.subtitle : "\u0413\u041B\u0410\u0412\u041D\u042B\u0419 \u0420\u0415\u0417\u0423\u041B\u042C\u0422\u0410\u0422", 540, 1100, { size: 28, color: WHITE, weight: 800, letterSpacing: 1 })}`;
  }
  const listEntry = ease2(clamp2(progress * 2));
  return `${panel(150, 430, 780, 660, "#0D1A22", PANEL_EDGE)}
    ${text("\u041F\u0415\u0420\u0415\u0414 \u041F\u041E\u041A\u0423\u041F\u041A\u041E\u0419 \u041F\u0420\u041E\u0412\u0415\u0420\u042C", 540, 525, { size: 24, color: GREEN, weight: 800, letterSpacing: 1.5 })}
    ${(beat.summaryItems ?? [
    ["01", "\u0421\u0440\u043E\u043A"],
    ["02", "\u0414\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C"],
    ["03", "\u0420\u0435\u0439\u0442\u0438\u043D\u0433 \u044D\u043C\u0438\u0442\u0435\u043D\u0442\u0430"],
    ["04", "\u0420\u0438\u0441\u043A"]
  ]).map((item, index) => {
    const [number, label] = item;
    const itemProgress = ease2(clamp2((progress - index * 0.12) * 3));
    const y = 640 + index * 110;
    return `<g opacity="${Math.max(0.88, itemProgress)}" transform="translate(${(1 - itemProgress) * 35} 0)">
        <circle cx="280" cy="${y - 10}" r="27" fill="${GREEN}" opacity=".16"/>
        ${text(number, 280, y - 2, { size: 18, color: GREEN, weight: 800 })}
        ${text(label, 340, y, { size: 31, color: WHITE, weight: 700, anchor: "start" })}
      </g>`;
  }).join("")}
    ${text("\u0414\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C \u0432\u044B\u0448\u0435 \u2014 \u0440\u0438\u0441\u043A \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0439 \u0432\u043D\u0438\u043C\u0430\u0442\u0435\u043B\u044C\u043D\u0435\u0435", 540, 1230, { size: 26, color: GOLD, weight: 700 })}`;
}
function renderFrame(timeMs, durationMs, beats, mainTitle = "\u0427\u0422\u041E \u0422\u0410\u041A\u041E\u0415 \u041E\u0411\u041B\u0418\u0413\u0410\u0426\u0418\u042F?", background = "grid", visualTheme = "premium_creator", inlinePresenter = false, visualAssets = {}) {
  const normalized = clamp2(timeMs / Math.max(1, durationMs));
  const beat = beats.find((candidate) => normalized >= candidate.from && normalized < candidate.to) ?? beats.at(-1);
  const beatIndex = Math.max(0, beats.indexOf(beat));
  const premiumCreator = visualTheme === "premium_creator";
  const sceneBackground = beat.background ?? background;
  const progress = localProgress(normalized, beat.from, beat.to);
  const activeMoment = beat.visualMoments?.find((moment) => progress >= moment.from && progress < moment.to) ?? beat.visualMoments?.at(-1);
  const activeMomentProgress = activeMoment ? localProgress(progress, activeMoment.from, activeMoment.to) : 0;
  const activeMomentIndex = activeMoment ? beat.visualMoments?.indexOf(activeMoment) ?? -1 : -1;
  const previousMoment = activeMomentIndex > 0 ? beat.visualMoments?.[activeMomentIndex - 1] : void 0;
  const startFocus = cameraFocalPoint(previousMoment?.position);
  const endFocus = cameraFocalPoint(activeMoment?.position);
  const momentFocusProgress = ease2(clamp2(activeMomentProgress / 0.34));
  const cameraFocusX = startFocus.x + (endFocus.x - startFocus.x) * momentFocusProgress;
  const cameraFocusY = startFocus.y + (endFocus.y - startFocus.y) * momentFocusProgress;
  const presenterLayout = presenterLayoutForBeat(beat);
  const beatStartMs = beat.from * durationMs;
  const beatEndMs = beat.to * durationMs;
  const sceneIntro = premiumCreator ? 1 : ease2(clamp2(progress / 0.14));
  const cameraProgress = ease2(progress);
  const requestedCameraAction = (beat.cameraAction ?? "").toLocaleLowerCase("en-US");
  const cameraAction = !requestedCameraAction || requestedCameraAction === "locked" ? premiumCreator ? "locked" : defaultCameraActionForVisual(beat.visual, beatIndex) : requestedCameraAction;
  const momentArc = Math.sin(Math.PI * clamp2(activeMomentProgress));
  const motionDirection = endFocus.x < startFocus.x ? -1 : 1;
  const panDirection = cameraAction.includes("pan_left") ? -1 : cameraAction.includes("pan_right") ? 1 : 0;
  const followsSubject = cameraAction.includes("follow_flow") || cameraAction.includes("tracking");
  const parallaxX = cameraAction.includes("parallax") ? motionDirection * momentArc * 14 : 0;
  const parallaxY = cameraAction.includes("parallax") ? -momentArc * 5 : 0;
  const focusPanX = cameraAction.includes("focus_shift") ? clamp2((540 - cameraFocusX) * 0.11, -28, 28) : 0;
  const focusPanY = cameraAction.includes("focus_shift") ? clamp2((780 - cameraFocusY) * 0.08, -26, 26) : 0;
  const cameraX = panDirection * cameraProgress * 28 + (followsSubject ? motionDirection * momentArc * 12 : 0) + parallaxX + focusPanX;
  const cameraY = (cameraAction.includes("push_in") ? -12 * cameraProgress : 0) + (cameraAction.includes("pull_back") ? 10 * cameraProgress : 0) + (cameraAction.includes("tracking") ? -momentArc * 5 : 0) + parallaxY + focusPanY;
  const directedScale = cameraAction.includes("push_in") ? 1 + cameraProgress * 0.03 : cameraAction.includes("pull_back") ? 1 - cameraProgress * 0.02 : cameraAction.includes("focus_shift") ? 1 + momentArc * 0.01 : 1;
  const cameraScale = directedScale;
  const cameraTranslationX = cameraX + WIDTH / 2 * (1 - cameraScale);
  const cameraTranslationY = cameraY + HEIGHT / 2 * (1 - cameraScale);
  const cameraRotation = cameraAction.includes("orbit") ? momentArc * 0.18 : 0;
  const subtitleLines = wrapText(beat.subtitle, 35);
  const hueRotation = premiumCreator ? 0 : sceneHueRotation(beat);
  const presenterAnimation = premiumCreator ? getPresenterAnimationState(beat, progress, Math.max(0, timeMs - beatStartMs)) : void 0;
  const presenterDataUri = inlinePresenter && presenterAnimation ? getFinancialPresenterDataUri(presenterAnimation) : void 0;
  const visualOffsetX = beat.composition === "presenter_left" ? 276 : beat.composition === "presenter_right" ? 176 : 226;
  const visualScale = beat.composition === "feature_card" ? 0.52 : 0.58;
  const sceneContent = premiumCreator ? `<g transform="translate(${visualOffsetX} -36) scale(${visualScale})" filter="url(#scene-hue)">
        ${renderVisual(beat, progress, timeMs, beatStartMs, beatEndMs)}
      </g>
      ${activeMoment ? renderFinancialVisualMoment(
    momentForComposition(activeMoment, beat.composition),
    activeMomentProgress,
    timeMs,
    beat.composition === "feature_card",
    activeMoment.assetId ? visualAssets[activeMoment.assetId] : void 0
  ) : ""}
      ${renderSpokenWordChips(beat, progress, timeMs)}
      ${renderFullPresenter(beat, progress, timeMs, presenterLayout)}` : `<g filter="url(#scene-hue)">
        ${renderVisual(beat, progress, timeMs, beatStartMs, beatEndMs)}
        ${renderSceneMotion(beat, progress, timeMs, false)}
      </g>`;
  const captionY = premiumCreator ? 1472 : 1390;
  const captionHeight = premiumCreator ? 344 : subtitleLines.length > 2 ? 230 : 190;
  const captionFill = premiumCreator ? "#121A1C" : "#0D1A22";
  const captionStroke = premiumCreator ? "#536054" : PANEL_EDGE;
  const captionTitleColor = premiumCreator ? "#E0B56F" : GREEN;
  const captionTextColor = premiumCreator ? "#F0ECE3" : WHITE;
  const headingLabelColor = premiumCreator ? "#C49A5D" : GREEN;
  const headingColor = premiumCreator ? "#F0EADF" : WHITE;
  const mutedColor = premiumCreator ? "#C9C1B3" : MUTED;
  const normalizedTitle = beat.title.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]/gu, "");
  const normalizedSubtitle = beat.subtitle.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]/gu, "");
  const captionSubtitle = normalizedTitle && normalizedTitle === normalizedSubtitle ? "" : beat.subtitle;
  const textAnimation = (beat.textAnimation ?? "reveal").toLocaleLowerCase("en-US");
  const titleBarWidth = 110 + 450 * ease2(clamp2(progress / 0.25));
  const titleEntry = !premiumCreator && beatIndex === 0 ? ease2(clamp2(progress / 0.34)) : 1;
  const transitionColor = beat.visual === "risk" || beat.visual === "leverage" ? "#C36D57" : beat.visual === "payoff" || beat.visual === "comparison" ? "#A882CF" : "#C28B43";
  const captionPanel = premiumCreator ? "" : `<g opacity="${clamp2(0.82 + progress * 0.18)}" transform="translate(0 ${(1 - sceneIntro) * 22})">
        <rect x="92" y="${captionY}" width="896" height="${captionHeight}" rx="34" fill="${captionFill}" stroke="${captionStroke}" stroke-width="2"/>
        <rect x="126" y="${captionY + 28}" width="160" height="4" rx="2" fill="${captionTitleColor}" opacity=".5"/>
        ${textLines(beat.title, 540, captionY + 60, 32, 40, { size: 25, color: captionTitleColor, weight: 800 })}
        ${captionSubtitle ? textLines(captionSubtitle, 540, captionY + 140, 35, 42, { size: 26, color: captionTextColor, weight: 600 }) : ""}
      </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0B151D"/>
        <stop offset="1" stop-color="#050A0E"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="42%" r="58%">
        <stop offset="0" stop-color="#1B6A4A" stop-opacity=".3"/>
        <stop offset="1" stop-color="#071016" stop-opacity="0"/>
      </radialGradient>
      <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
      <filter id="scene-hue"><feColorMatrix type="hueRotate" values="${hueRotation}"/></filter>
    </defs>
    ${premiumCreator ? `<g transform="translate(${(cameraX * 0.38).toFixed(1)} ${(cameraY * 0.38).toFixed(1)})">${renderPremiumCreatorBackground(timeMs)}</g>` : `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
        <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
        <g filter="url(#scene-hue)">${renderBackgroundLayer(sceneBackground, timeMs)}</g>
        <path d="M-120 1240 C220 1080 420 1380 760 1180 S1180 1080 1220 920" fill="none" stroke="${GREEN}" stroke-width="3" stroke-dasharray="8 34" opacity=".2" stroke-dashoffset="${-Math.round(timeMs / 8)}"/>`}
    <g transform="translate(${cameraTranslationX.toFixed(1)} ${cameraTranslationY.toFixed(1)}) rotate(${cameraRotation.toFixed(3)} ${WIDTH / 2} ${HEIGHT / 2}) scale(${cameraScale.toFixed(4)})">
      <circle cx="540" cy="760" r="380" fill="${GREEN}" opacity=".06" filter="url(#soft-glow)"/>
      ${text("FINANCE / EXPLAINER SHORT", 54, 88, { size: 20, color: headingLabelColor, weight: 700, anchor: "start", letterSpacing: 3 })}
      <g opacity="${titleEntry.toFixed(3)}" transform="translate(54 ${145 + (1 - titleEntry) * 16}) scale(${0.97 + titleEntry * 0.03}) translate(-54 -145)">
        ${text(mainTitle, 54, 145, { size: 38, color: headingColor, weight: 800, anchor: "start", letterSpacing: 1 })}
      </g>
      <g filter="url(#scene-hue)" opacity="${sceneIntro}" transform="translate(${(1 - sceneIntro) * 46} ${premiumCreator ? 0 : Math.sin(timeMs / 420) * 3})">
        ${sceneContent}
      </g>
      ${premiumCreator ? renderTransitionSweep(progress, transitionColor, beat.transitionIn ?? "cut") : `<rect x="${-80 + sceneIntro * 1240}" y="210" width="12" height="940" rx="6" fill="${GREEN}" opacity="${(1 - sceneIntro) * 0.32}"/>`}
      ${captionPanel}
      ${text(`${String(beatIndex + 1).padStart(2, "0")} / ${String(beats.length).padStart(2, "0")}`, 1024, 145, { size: 20, color: mutedColor, weight: 700, anchor: "end", letterSpacing: 2 })}
      ${!premiumCreator ? text("\u041E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0440\u043E\u043B\u0438\u043A \u2022 \u043D\u0435 \u0438\u043D\u0432\u0435\u0441\u0442\u0438\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u044F", 540, 1810, { size: 19, color: mutedColor, weight: 500 }) : ""}
    </g>
    ${premiumCreator && presenterDataUri ? renderPresenterImage(presenterDataUri, timeMs, presenterLayout) : ""}
    ${premiumCreator && inlinePresenter ? renderSpeechSubtitle(beat, progress) : ""}
    ${premiumCreator ? text("\u041E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0440\u043E\u043B\u0438\u043A \u2022 \u043D\u0435 \u0438\u043D\u0432\u0435\u0441\u0442\u0438\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u044F", 540, 1884, { size: 16, color: "#B8B0A1", weight: 500 }) : ""}
  </svg>`;
}
function renderSubtitleFrame(timeMs, durationMs, beats) {
  const normalized = clamp2(timeMs / Math.max(1, durationMs));
  const beat = beats.find((candidate) => normalized >= candidate.from && normalized < candidate.to) ?? beats.at(-1);
  const progress = localProgress(normalized, beat.from, beat.to);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${renderSpeechSubtitle(beat, progress)}
  </svg>`;
}
function presenterLayoutForBeat(beat) {
  if (beat.presenterLayout) return beat.presenterLayout;
  if (beat.composition === "presenter_left") return "left";
  if (beat.composition === "presenter_right") return "right";
  if (beat.composition === "feature_card") return "large";
  return "center";
}
function momentForComposition(moment, composition) {
  if (composition === "feature_card") {
    return {
      ...moment,
      position: moment.position === "center" ? "hero" : moment.position,
      exitAnimation: "shrink"
    };
  }
  if (composition === "presenter_left") {
    const rightPositions = {
      center: "center_right",
      hero: "center_right"
    };
    return { ...moment, position: rightPositions[moment.position] ?? moment.position };
  }
  if (composition === "presenter_right") {
    const leftPositions = {
      center: "center_left",
      hero: "center_left"
    };
    return { ...moment, position: leftPositions[moment.position] ?? moment.position };
  }
  return moment;
}
async function probeDurationMs(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath
  ]);
  const seconds = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043E\u0437\u0432\u0443\u0447\u043A\u0438.");
  return Math.round(seconds * 1e3);
}
async function writePresenterPoseSequence(dir, frameCount, durationMs, beats) {
  const sequenceDir = join(dir, "presenter-frames");
  await mkdir(sequenceDir, { recursive: true });
  let activePose;
  let activeMouthOpen;
  let lastPoseChangeMs = Number.NEGATIVE_INFINITY;
  let lastMouthChangeMs = Number.NEGATIVE_INFINITY;
  let previousBeatIndex = -1;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const timeMs = Math.min(durationMs - 1, Math.round(frame * 1e3 / FPS));
    const normalized = clamp2(timeMs / Math.max(1, durationMs));
    const beat = beats.find((candidate) => normalized >= candidate.from && normalized < candidate.to) ?? beats.at(-1);
    const progress = localProgress(normalized, beat.from, beat.to);
    const beatLocalTimeMs = Math.max(0, timeMs - beat.from * durationMs);
    const desiredState = getPresenterAnimationState(beat, progress, beatLocalTimeMs);
    const beatIndex = beats.indexOf(beat);
    if (beatIndex !== previousBeatIndex) {
      if (!activePose || timeMs - lastPoseChangeMs >= 5e3) {
        activePose = desiredState.pose;
        lastPoseChangeMs = timeMs;
      }
      activeMouthOpen = desiredState.mouthOpen;
      lastMouthChangeMs = timeMs;
      previousBeatIndex = beatIndex;
    } else {
      if (desiredState.pose !== activePose && timeMs - lastPoseChangeMs >= 5e3) {
        activePose = desiredState.pose;
        lastPoseChangeMs = timeMs;
      }
      if (desiredState.mouthOpen !== activeMouthOpen && timeMs - lastMouthChangeMs >= 150) {
        activeMouthOpen = desiredState.mouthOpen;
        lastMouthChangeMs = timeMs;
      }
    }
    const state = {
      pose: activePose ?? desiredState.pose,
      mouthOpen: activeMouthOpen ?? desiredState.mouthOpen
    };
    const framePath = join(sequenceDir, `pose-${String(frame).padStart(5, "0")}.png`);
    await symlink(getFinancialPresenterAssetPath(state), framePath);
  }
  return sequenceDir;
}
function presenterLayoutExpressions(beats, durationMs) {
  let scale = "900";
  let x = "90";
  let y = "950";
  for (const beat of [...beats].reverse()) {
    const layout = presenterLayoutForBeat(beat);
    if (layout === "center") continue;
    const start = (beat.from * durationMs / 1e3).toFixed(3);
    const end = (beat.to * durationMs / 1e3).toFixed(3);
    const values = layout === "left" ? { scale: "760", x: "10", y: "1050" } : layout === "right" ? { scale: "760", x: "310", y: "1050" } : { scale: "1080", x: "0", y: "790" };
    const inScene = `between(t,${start},${end})`;
    scale = `if(${inScene},${values.scale},${scale})`;
    x = `if(${inScene},${values.x},${x})`;
    y = `if(${inScene},${values.y},${y})`;
  }
  return { scale, x, y };
}
async function encodeShort(dir, durationMs, audioPath, beats, mainTitle, background = "grid", visualTheme = "premium_creator", copyAudioTrack = false, visualAssets = {}) {
  const frameCount = Math.ceil(durationMs / 1e3 * FPS);
  const hasPresenter = visualTheme === "premium_creator";
  const presenterSequenceDir = hasPresenter ? await writePresenterPoseSequence(dir, frameCount, durationMs, beats) : void 0;
  const presenterPositions = presenterLayoutExpressions(beats, durationMs);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const timeMs = Math.min(durationMs - 1, Math.round(frame * 1e3 / FPS));
    await writeFile(
      join(dir, `frame-${String(frame).padStart(5, "0")}.svg`),
      renderFrame(timeMs, durationMs, beats, mainTitle, background, visualTheme, false, visualAssets),
      "utf8"
    );
    await writeFile(
      join(dir, `subtitle-frame-${String(frame).padStart(5, "0")}.svg`),
      renderSubtitleFrame(timeMs, durationMs, beats),
      "utf8"
    );
  }
  const output = join(dir, "financial-explainer-short.mp4");
  const subtitleInputIndex = hasPresenter ? 2 : 1;
  const audioInputIndex = subtitleInputIndex + 1;
  const soundCues = beats.map((beat, index) => ({
    kind: soundCueKindForBeat(beat, index),
    delayMs: Math.max(0, Math.round(beat.from * durationMs + (index === 0 ? 90 : 45)))
  })).filter((cue) => cue.delayMs < durationMs - 260);
  const args = [
    "-y",
    "-framerate",
    String(FPS),
    "-start_number",
    "0",
    "-i",
    join(dir, "frame-%05d.svg"),
    ...presenterSequenceDir ? ["-framerate", String(FPS), "-start_number", "0", "-i", join(presenterSequenceDir, "pose-%05d.png")] : [],
    "-framerate",
    String(FPS),
    "-start_number",
    "0",
    "-i",
    join(dir, "subtitle-frame-%05d.svg"),
    "-i",
    audioPath
  ];
  soundCues.forEach((cue) => {
    args.push("-f", "lavfi", "-i", soundCueSource(cue.kind));
  });
  const filterChains = [];
  const preSubtitleVideoLabel = hasPresenter ? "host-video" : "0:v";
  if (hasPresenter) {
    const scale = `(${presenterPositions.scale})+12*sin(t*0.926)`;
    filterChains.push(`[1:v]scale=w='${scale}':h='${scale}':eval=frame:flags=lanczos,format=rgba[host]`);
    filterChains.push(`[0:v][host]overlay=x='(${presenterPositions.x})+7*sin(t*1.724)+4*sin(t*0.704)':y='(${presenterPositions.y})+8*sin(t*2.083)+4*sin(t*0.568)':eval=frame:shortest=1:format=auto[host-video]`);
  }
  filterChains.push(
    `[${preSubtitleVideoLabel}][${subtitleInputIndex}:v]overlay=0:0:eval=frame:shortest=1:format=auto[video]`
  );
  if (soundCues.length) {
    soundCues.forEach((cue, index) => {
      const inputIndex = audioInputIndex + 1 + index;
      filterChains.push(
        `[${inputIndex}:a]${soundCueFilter(cue.kind)},pan=stereo|c0=c0|c1=c0,adelay=${cue.delayMs}|${cue.delayMs}[sfx${index}]`
      );
    });
    const cueLabels = soundCues.map((_, index) => `[sfx${index}]`).join("");
    filterChains.push(
      `[${audioInputIndex}:a]${cueLabels}amix=inputs=${soundCues.length + 1}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.97:level=0[audio]`
    );
  }
  if (filterChains.length) args.push("-filter_complex", filterChains.join(";"));
  args.push(
    "-t",
    String(durationMs / 1e3),
    "-map",
    "[video]",
    "-map",
    soundCues.length ? "[audio]" : `${audioInputIndex}:a:0`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "19",
    "-pix_fmt",
    "yuv420p",
    ...copyAudioTrack && !soundCues.length ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", soundCues.length ? "192k" : "128k"],
    "-shortest",
    "-movflags",
    "+faststart",
    output
  );
  await execFileAsync("ffmpeg", args, { timeout: 30 * 60 * 1e3, maxBuffer: 20 * 1024 * 1024 });
  return readFile(output);
}
async function generateFinancialSpeech(text2) {
  return generateSpeech(
    prepareSpeechText(text2),
    getConfiguredVoiceId(),
    getElevenLabsModel(),
    {
      speed: 0.98,
      stability: 0.52,
      similarity: 0.78,
      style: 0.2,
      speakerBoost: true
    }
  );
}
async function concatenateAudio(dir, audioPaths) {
  const listPath = join(dir, "audio-list.txt");
  const list = audioPaths.map((path) => `file '${path.replaceAll("'", "'\\\\''")}'`).join("\n");
  await writeFile(listPath, `${list}
`, "utf8");
  const output = join(dir, "voice-segmented.mp3");
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c:a",
    "libmp3lame",
    "-q:a",
    "3",
    output
  ], { timeout: 10 * 60 * 1e3, maxBuffer: 20 * 1024 * 1024 });
  return output;
}
function soundCueKindForBeat(beat, index) {
  const requested = (beat.soundEffect ?? "").toLocaleLowerCase("ru-RU");
  if (/impact|hit|thump|удар|акцент|импакт/iu.test(requested)) return "impact";
  if (/tick|click|coin|bell|ping|монет|щелч|звон/iu.test(requested)) return "tick";
  if (/whoosh|sweep|swish|переход|свип|взмах/iu.test(requested)) return "whoosh";
  if (index === 0 || beat.visual === "hook" || beat.visual === "risk" || beat.visual === "leverage" || beat.visual === "summary") {
    return "impact";
  }
  if (beat.visual === "coupon" || beat.visual === "calendar" || beat.visual === "maturity") return "tick";
  return "whoosh";
}
function soundCueSource(kind) {
  if (kind === "whoosh") return "anoisesrc=color=pink:duration=0.34:sample_rate=48000";
  if (kind === "tick") return "sine=frequency=1000:duration=0.12:sample_rate=48000";
  return "sine=frequency=82:duration=0.24:sample_rate=48000";
}
function soundCueFilter(kind) {
  if (kind === "whoosh") {
    return "highpass=f=180,lowpass=f=3800,afade=t=in:st=0:d=0.035,afade=t=out:st=0.12:d=0.22,volume=0.035";
  }
  if (kind === "tick") {
    return "highpass=f=650,lowpass=f=7500,afade=t=in:st=0:d=0.003,afade=t=out:st=0.015:d=0.095,volume=0.045";
  }
  return "lowpass=f=190,afade=t=in:st=0:d=0.005,afade=t=out:st=0.04:d=0.19,volume=0.11";
}
async function renderPlan(plan2) {
  const dir = await mkdtemp(join(tmpdir(), "financial-short-"));
  try {
    let audioPath;
    let durationMs;
    let beats = plan2.beats;
    const canSegmentVoice = plan2.beats.length > 0 && plan2.beats.every((beat) => beat.voiceText?.trim());
    if (canSegmentVoice) {
      const segmentPaths = [];
      const segmentDurations = [];
      for (const [index, beat] of plan2.beats.entries()) {
        const voice = await generateFinancialSpeech(beat.voiceText);
        const segmentPath = join(dir, `voice-${String(index).padStart(2, "0")}.mp3`);
        await writeFile(segmentPath, voice);
        segmentPaths.push(segmentPath);
        segmentDurations.push(await probeDurationMs(segmentPath));
      }
      const segmentedDuration = segmentDurations.reduce((sum, value) => sum + value, 0);
      let elapsed = 0;
      beats = plan2.beats.map((beat, index) => {
        const from = elapsed / Math.max(1, segmentedDuration);
        elapsed += segmentDurations[index];
        const to = index === plan2.beats.length - 1 ? 1 : elapsed / Math.max(1, segmentedDuration);
        return { ...beat, from, to };
      });
      audioPath = await concatenateAudio(dir, segmentPaths);
      durationMs = await probeDurationMs(audioPath);
    } else {
      const voice = await generateFinancialSpeech(plan2.script);
      audioPath = join(dir, "voice.mp3");
      await writeFile(audioPath, voice);
      durationMs = await probeDurationMs(audioPath);
    }
    if (durationMs > 18e4) throw new Error("\u041E\u0437\u0432\u0443\u0447\u043A\u0430 \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u0430\u0441\u044C \u0434\u043B\u0438\u043D\u043D\u0435\u0435 \u043B\u0438\u043C\u0438\u0442\u0430 3 \u043C\u0438\u043D\u0443\u0442.");
    const buffer = await encodeShort(
      dir,
      durationMs,
      audioPath,
      beats,
      plan2.mainTitle,
      plan2.background,
      plan2.visualTheme,
      false,
      plan2.visualAssets
    );
    return { buffer, durationMs };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
async function renderFinancialTopicShort(plan2) {
  if (!plan2.beats.length) throw new Error("\u0424\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u044B\u0439 animation plan \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0441\u0446\u0435\u043D.");
  const rendered2 = await renderPlan(plan2);
  return {
    ...rendered2,
    sceneCount: plan2.beats.length,
    script: plan2.script
  };
}

// .tmp-bitcoin-render-runner.ts
var outputDir = resolve(process.cwd(), "../../attached_assets/bitcoin-short-qa");
var planPath = resolve(outputDir, "bitcoin-plan.json");
var plan = JSON.parse(await readFile2(planPath, "utf8"));
var rendered = await renderFinancialTopicShort(plan);
var videoPath = resolve(outputDir, "bitcoin-short.mp4");
await writeFile2(videoPath, rendered.buffer);
console.log(JSON.stringify({
  videoPath,
  durationMs: rendered.durationMs,
  sceneCount: rendered.sceneCount,
  bytes: rendered.buffer.length,
  script: rendered.script
}, null, 2));
