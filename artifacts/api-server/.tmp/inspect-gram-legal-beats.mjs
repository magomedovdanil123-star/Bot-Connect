// src/lib/video-pipeline/finance-long-style.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// src/lib/video-pipeline/ethereum-motion-design.ts
import { dirname, resolve } from "node:path";
var ETHEREUM_MOTION_FFMPEG_COLORS = {
  background: "0x070b16",
  coral: "0xff5a67",
  cyan: "0x16c7e8",
  yellow: "0xe5d438",
  inactive: "0x252b38",
  inactiveSecondary: "0x343a47",
  text: "0xf3f3f3"
};
var FINANCE_LONG_MOTION_EVENT_KINDS = [
  "TECHNICAL_GRID",
  "DATA_FLOW",
  "NETWORK_REVEAL",
  "FINANCIAL_CHART",
  "TIMELINE",
  "COMPARISON",
  "PARTICLE_FLOW",
  "NODE_SYSTEM",
  "MORPH_TRANSITION",
  "CAMERA_PUSH",
  "MOTION_TEXT"
];
var PROJECT_DOCUMENT_ROOTS = [
  process.cwd(),
  resolve(process.cwd(), "artifacts/api-server")
];
function parseFinanceLongMotionSequence(description) {
  const sequenceLine = description.split(/\r?\n/u).map((line) => line.trim()).find((line) => /^MOTION_SEQUENCE\s*:/iu.test(line));
  if (!sequenceLine) return [];
  const body = sequenceLine.replace(/^MOTION_SEQUENCE\s*:/iu, "").trim();
  return body.split("|").map((part) => {
    const match = part.trim().match(/^\[([A-Z_]+)\]\s*(.+)$/u);
    if (!match || !FINANCE_LONG_MOTION_EVENT_KINDS.includes(match[1])) {
      return null;
    }
    const event = {
      kind: match[1],
      description: match[2].trim()
    };
    return event.description ? event : null;
  }).filter((event) => event !== null);
}

// src/lib/video-pipeline/finance-long-style.ts
var execFileAsync = promisify(execFile);

// src/lib/video-pipeline/ethereum-motion-legal.ts
var colors = ETHEREUM_MOTION_FFMPEG_COLORS;
var activeColor = colors.text;
var mutedColor = colors.inactiveSecondary;

// src/lib/video-pipeline/ethereum-motion-graphics.ts
var MOTIF_TEXT_COLOR = ETHEREUM_MOTION_FFMPEG_COLORS.text;
var MOTIF_CORAL = ETHEREUM_MOTION_FFMPEG_COLORS.coral;
var MOTIF_CYAN = ETHEREUM_MOTION_FFMPEG_COLORS.cyan;
var MOTIF_YELLOW = ETHEREUM_MOTION_FFMPEG_COLORS.yellow;
var PANEL_COLOR = `${ETHEREUM_MOTION_FFMPEG_COLORS.inactive}@0.94`;
var GRID_COLOR = `${ETHEREUM_MOTION_FFMPEG_COLORS.inactiveSecondary}@0.62`;

// src/lib/video-pipeline/coin-overview-long-edit.ts
function normalizeDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("Coin overview render duration must be a positive number");
  }
  return Math.max(1, Math.round(durationMs));
}
function motifFromText(text) {
  const normalized = text.toLocaleLowerCase("ru-RU");
  if (/риск|угроз|уязв|ограничен|проблем|конкурен|неопредел|осторож|безопасн/.test(normalized)) return "risk";
  if (/цен|курс|рынок|динамик|капитализац|объём|ликвид|волатил|торг|спрос|предложен|график|котиров/.test(normalized)) return "market";
  if (/сеть|блокчейн|транзакц|валидат|протокол|инфраструктур|узл|соединен|связи/.test(normalized)) return "network";
  if (/запис|реестр|данн|учёт|подпис|перевод/.test(normalized)) return "record";
  if (/ключ|доступ|хранен|владен|адрес/.test(normalized)) return "access";
  if (/истори|основан|создан|запуск|появил|начал|этап|год|раньше|сначала/.test(normalized)) return "timeline";
  if (/пад|упал|упала|упало|упали|сниз|просел|обвал|коррекц|откат|вырос|рост|подня|увелич|укреп|отскок|восстанов|приток|отток/.test(normalized)) return "market";
  if (/смарт.?контракт|экосистем|приложен|разработ|кошел|токен|актив|монет|aptos|hyperliquid|hype/.test(normalized)) return "asset";
  return void 0;
}
function specificMotif(text, visualDescription = "") {
  return motifFromText(text) ?? motifFromText(visualDescription);
}
function classifyMotif(text, visualDescription = "") {
  return specificMotif(text, visualDescription) ?? "asset";
}
function wordTimings(voice, durationMs) {
  const words = voice.text.trim().split(/\s+/).filter(Boolean);
  const startMs = Math.max(0, Math.round(voice.startTime ?? 0));
  const endMs = Math.min(durationMs, Math.round(voice.endTime ?? durationMs));
  const availableMs = Math.max(0, endMs - startMs);
  if (!words.length || availableMs <= 0) return [];
  const weights = words.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, "").length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let previousWeight = 0;
  return words.map((text, index) => {
    const nextWeight = previousWeight + weights[index];
    const timing = {
      text,
      startMs: Math.round(startMs + availableMs * previousWeight / totalWeight),
      endMs: Math.round(startMs + availableMs * nextWeight / totalWeight)
    };
    previousWeight = nextWeight;
    return timing;
  });
}
function buildTimedMotionEventsByScene(voices, durationMs) {
  const voicesByScene = /* @__PURE__ */ new Map();
  for (const voice of voices) {
    if (voice.isFullVoice || !voice.text.trim()) continue;
    const sceneVoices = voicesByScene.get(voice.sceneId) ?? [];
    sceneVoices.push(voice);
    voicesByScene.set(voice.sceneId, sceneVoices);
  }
  const eventsByScene = /* @__PURE__ */ new Map();
  for (const [sceneId, sceneVoices] of voicesByScene) {
    const description = sceneVoices.find((voice) => voice.visualDescription?.trim())?.visualDescription ?? "";
    const events = parseFinanceLongMotionSequence(description);
    if (events.length < 5 || events.length > 8) continue;
    const startMs = Math.max(0, Math.round(Math.min(...sceneVoices.map((voice) => voice.startTime ?? 0))));
    const endMs = Math.min(
      durationMs,
      Math.round(Math.max(...sceneVoices.map((voice) => voice.endTime ?? durationMs)))
    );
    const sceneDurationMs = endMs - startMs;
    if (sceneDurationMs <= 0) continue;
    eventsByScene.set(sceneId, events.map((event, index) => ({
      ...event,
      startMs: Math.round(startMs + sceneDurationMs * index / events.length),
      endMs: Math.round(startMs + sceneDurationMs * (index + 1) / events.length)
    })));
  }
  return eventsByScene;
}
function splitVoiceIntoPhrases(words) {
  const phrases = [];
  let current = [];
  const flush = () => {
    if (current.length) phrases.push(current);
    current = [];
  };
  for (const word of words) {
    if (current.length && (word.endMs - current[0].startMs > 4400 || `${current.map((item) => item.text).join(" ")} ${word.text}`.length > 56)) {
      flush();
    }
    current.push(word);
    if (/[.!?…;:]$/u.test(word.text) || /[,…]$/u.test(word.text) && current.length >= 2) {
      flush();
    }
  }
  flush();
  return phrases;
}
function appendIdleBeats(beats2, startMs, endMs, motif, sceneId, motionEvents) {
  let cursor = startMs;
  while (cursor < endMs) {
    const next = Math.min(endMs, cursor + 4e3);
    beats2.push({
      sceneId,
      beatIndex: beats2.length,
      startMs: cursor,
      endMs: next,
      text: "",
      motif,
      ...motionEvents?.length ? { motionEvents } : {}
    });
    cursor = next;
  }
}
function buildCoinOverviewLongPhraseBeats(input) {
  const durationMs = normalizeDuration(input.durationMs);
  const rawBeats = [];
  const voices = input.voices.filter((voice) => !voice.isFullVoice && voice.text.trim()).sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
  const motionEventsByScene = input.useEthereumMotionSequence ? buildTimedMotionEventsByScene(voices, durationMs) : /* @__PURE__ */ new Map();
  for (const voice of voices) {
    const words = wordTimings(voice, durationMs);
    for (const phrase of splitVoiceIntoPhrases(words)) {
      const startMs = phrase[0].startMs;
      const endMs = phrase.at(-1).endMs;
      if (endMs <= startMs) continue;
      const text = phrase.map((word) => word.text).join(" ");
      rawBeats.push({
        sceneId: voice.sceneId,
        beatIndex: rawBeats.length,
        startMs,
        endMs,
        text,
        motif: classifyMotif(text, voice.visualDescription),
        visualDescription: voice.visualDescription,
        ...motionEventsByScene.get(voice.sceneId)?.length ? { motionEvents: motionEventsByScene.get(voice.sceneId) } : {}
      });
    }
  }
  rawBeats.sort((a, b) => a.startMs - b.startMs || a.sceneId - b.sceneId);
  const groupedRawBeats = [];
  for (const beat of rawBeats) {
    const previous = groupedRawBeats.at(-1);
    const mergedEnd = previous ? Math.max(previous.endMs, beat.endMs) : beat.endMs;
    if (previous && previous.sceneId === beat.sceneId && beat.startMs <= previous.endMs + 180 && previous.endMs - previous.startMs < 2800 && mergedEnd - previous.startMs <= 5200) {
      previous.endMs = mergedEnd;
      previous.text = [previous.text, beat.text].filter(Boolean).join(" ");
      previous.visualDescription = previous.visualDescription || beat.visualDescription;
      previous.motionEvents = previous.motionEvents ?? beat.motionEvents;
      previous.motif = classifyMotif(previous.text, previous.visualDescription);
    } else {
      groupedRawBeats.push({
        ...beat,
        beatIndex: groupedRawBeats.length
      });
    }
  }
  const beats2 = [];
  let cursor = 0;
  let lastMotif = groupedRawBeats[0]?.motif ?? "asset";
  const fallbackSceneId = voices[0]?.sceneId ?? 0;
  for (const beat of groupedRawBeats) {
    if (beat.startMs > cursor + 180) {
      appendIdleBeats(
        beats2,
        cursor,
        beat.startMs,
        lastMotif,
        beat.sceneId,
        motionEventsByScene.get(beat.sceneId)
      );
    }
    const startMs = Math.max(cursor, beat.startMs);
    const endMs = Math.min(durationMs, beat.endMs);
    if (endMs <= startMs) continue;
    beats2.push({
      ...beat,
      beatIndex: beats2.length,
      startMs,
      endMs
    });
    cursor = endMs;
    lastMotif = beat.motif;
  }
  if (cursor < durationMs) {
    appendIdleBeats(
      beats2,
      cursor,
      durationMs,
      lastMotif,
      fallbackSceneId,
      motionEventsByScene.get(fallbackSceneId)
    );
  }
  return beats2;
}
var ETHEREUM_MOTION_PALETTE = {
  background: ETHEREUM_MOTION_FFMPEG_COLORS.background,
  primary: ETHEREUM_MOTION_FFMPEG_COLORS.coral,
  secondary: ETHEREUM_MOTION_FFMPEG_COLORS.cyan,
  contrast: ETHEREUM_MOTION_FFMPEG_COLORS.yellow,
  title: ETHEREUM_MOTION_FFMPEG_COLORS.text,
  darkBackground: true
};

// scripts/inspect-gram-legal-beats.ts
var api = "http://127.0.0.1:8080";
var projectResponse = await fetch(`${api}/api/projects/87`);
if (!projectResponse.ok) throw new Error(`Read project 87 failed: ${projectResponse.status}`);
var project = await projectResponse.json();
var scene = project.script?.scenes?.find((item) => item.scene_number === 3);
if (!scene) throw new Error("Scene 3 is missing");
var voicesResponse = await fetch(`${api}/api/projects/87/voice`);
if (!voicesResponse.ok) throw new Error(`Read project 87 voices failed: ${voicesResponse.status}`);
var voiceRows = await voicesResponse.json();
var sourceVoice = voiceRows.find(
  (voice) => voice.scene_id === 3 && voice.is_active && voice.status === "completed" && !voice.is_full_voice
);
if (!sourceVoice || sourceVoice.text !== scene.voice_text) throw new Error("Approved voice mismatch");
var beats = buildCoinOverviewLongPhraseBeats({
  voices: [{
    sceneId: sourceVoice.scene_id,
    startTime: sourceVoice.start_time,
    endTime: sourceVoice.end_time,
    text: sourceVoice.text,
    isFullVoice: false,
    visualDescription: scene.visual_description
  }],
  durationMs: sourceVoice.end_time,
  useEthereumMotionSequence: true
});
console.log(JSON.stringify(beats.map((beat) => ({
  startMs: beat.startMs,
  endMs: beat.endMs,
  text: beat.text,
  motionEvents: beat.motionEvents?.map((event) => ({
    startMs: event.startMs,
    endMs: event.endMs,
    kind: event.kind,
    description: event.description
  }))
})), null, 2));
