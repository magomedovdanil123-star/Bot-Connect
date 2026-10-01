// scripts/render-hype-user-script-montage.ts
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

// src/lib/video-pipeline/coin-overview-long-edit.ts
var MOTIFS = [
  "asset",
  "market",
  "record",
  "network",
  "timeline",
  "access",
  "risk"
];
function normalizeDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("Coin overview render duration must be a positive number");
  }
  return Math.max(1, Math.round(durationMs));
}
function classifyMotif(text, index) {
  const normalized = text.toLocaleLowerCase("ru-RU");
  if (/риск|угроз|уязв|ограничен|проблем|конкурен|неопредел|осторож|безопасн/.test(normalized)) return "risk";
  if (/истори|основан|создан|запуск|появил|начал|этап|год|раньше|сначала/.test(normalized)) return "timeline";
  if (/сеть|блокчейн|транзакц|валидат|протокол|инфраструктур|узл/.test(normalized)) return "network";
  if (/цен|курс|рынок|динамик|капитализац|объём|ликвид|волатил|торг|спрос|предложен/.test(normalized)) return "market";
  if (/смарт.?контракт|экосистем|приложен|разработ|кошел|токен|актив|монет/.test(normalized)) return "asset";
  if (/запис|реестр|данн|учёт|подпис|перевод/.test(normalized)) return "record";
  if (/ключ|доступ|хранен|владен|адрес/.test(normalized)) return "access";
  return MOTIFS[index % MOTIFS.length];
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
function appendIdleBeats(beats, startMs, endMs, motif, sceneId) {
  let cursor = startMs;
  let offset = 0;
  while (cursor < endMs) {
    const next = Math.min(endMs, cursor + 4e3);
    const motifIndex = MOTIFS.indexOf(motif);
    beats.push({
      sceneId,
      beatIndex: beats.length,
      startMs: cursor,
      endMs: next,
      text: "",
      motif: MOTIFS[(motifIndex + offset) % MOTIFS.length]
    });
    cursor = next;
    offset += 1;
  }
}
function buildCoinOverviewLongPhraseBeats(input) {
  const durationMs = normalizeDuration(input.durationMs);
  const rawBeats = [];
  const voices = input.voices.filter((voice) => !voice.isFullVoice && voice.text.trim()).sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
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
        motif: classifyMotif(text, rawBeats.length)
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
      previous.motif = classifyMotif(previous.text, previous.beatIndex);
    } else {
      groupedRawBeats.push({
        ...beat,
        beatIndex: groupedRawBeats.length
      });
    }
  }
  const beats = [];
  let cursor = 0;
  let lastMotif = groupedRawBeats[0]?.motif ?? "asset";
  const fallbackSceneId = voices[0]?.sceneId ?? 0;
  for (const beat of groupedRawBeats) {
    if (beat.startMs > cursor + 180) {
      appendIdleBeats(beats, cursor, beat.startMs, lastMotif, beat.sceneId);
    }
    const startMs = Math.max(cursor, beat.startMs);
    const endMs = Math.min(durationMs, beat.endMs);
    if (endMs <= startMs) continue;
    beats.push({
      ...beat,
      beatIndex: beats.length,
      startMs,
      endMs
    });
    cursor = endMs;
    lastMotif = beat.motif;
  }
  if (cursor < durationMs) {
    appendIdleBeats(beats, cursor, durationMs, lastMotif, fallbackSceneId);
  }
  return beats;
}

// src/lib/video-pipeline/coin-overview-long-captions.ts
function assTime(milliseconds) {
  const centiseconds = Math.max(0, Math.floor(milliseconds / 10));
  const seconds = Math.floor(centiseconds / 100);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
}
function assText(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}").replaceAll("\n", " ");
}
function wordTimings2(voice, durationMs) {
  const words = voice.text.trim().split(/\s+/).filter((word) => Boolean(word) && !/^[—–-]+$/u.test(word));
  const startMs = Math.max(0, voice.startTime ?? 0);
  const endMs = Math.min(durationMs, voice.endTime ?? durationMs);
  const availableMs = Math.max(0, endMs - startMs);
  if (!words.length || availableMs <= 0) return [];
  const weights = words.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, "").length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let previousWeight = 0;
  return words.map((text, index) => {
    const nextWeight = previousWeight + weights[index];
    const timing = {
      text,
      startMs: Math.round(startMs + availableMs * (previousWeight / totalWeight)),
      endMs: Math.round(startMs + availableMs * (nextWeight / totalWeight))
    };
    previousWeight = nextWeight;
    return timing;
  });
}
function wrapMotionCaption(value, maxCharacters) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && candidate.length > maxCharacters) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.join("\0");
}
function subtitlePhrases(words) {
  const phrases = [];
  let current = [];
  const flush = () => {
    if (current.length) phrases.push(current);
    current = [];
  };
  for (const word of words) {
    const candidate = [...current, word];
    const text = candidate.map((item) => item.text).join(" ");
    const elapsedMs = current.length ? word.endMs - current[0].startMs : 0;
    if (current.length && (text.length > 56 || elapsedMs > 4200 || current.length >= 10)) {
      flush();
    }
    current.push(word);
    if (/[.!?…]$/u.test(word.text) && current.length >= 3) flush();
  }
  flush();
  return phrases;
}
function buildCoinOverviewLongPhraseCaptions(input) {
  const chunkStartMs = Math.max(0, input.chunkStartMs ?? 0);
  const chunkEndMs = Math.min(input.durationMs, input.chunkEndMs ?? input.durationMs);
  const dialogues = [];
  const voices = input.voices.filter((voice) => !voice.isFullVoice && voice.text.trim()).sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
  for (const voice of voices) {
    for (const phrase of subtitlePhrases(wordTimings2(voice, input.durationMs))) {
      const phraseStartMs = phrase[0].startMs;
      const phraseEndMs = phrase.at(-1).endMs;
      const visibleStartMs = Math.max(chunkStartMs, phraseStartMs);
      const visibleEndMs = Math.min(chunkEndMs, phraseEndMs);
      if (visibleEndMs <= visibleStartMs) continue;
      const wrapped = wrapMotionCaption(
        phrase.map((word) => word.text).join(" "),
        48
      );
      const longestLine = Math.max(
        ...wrapped.split("\0").map((line) => line.length),
        1
      );
      const fontSize = Math.max(
        18,
        Math.min(
          48,
          Math.round(input.height * 0.045),
          Math.floor(input.width * 0.78 / (longestLine * 0.56))
        )
      );
      const x = Math.round(input.width / 2);
      const y = Math.round(input.height * 0.91);
      const override = `{\\an2\\pos(${x},${y})\\fs${fontSize}\\1c&H00F7F4EC&\\3c&H00101012&\\bord2.5\\shad1.5\\fad(90,110)}`;
      dialogues.push({
        startMs: visibleStartMs,
        text: `Dialogue: 0,${assTime(visibleStartMs - chunkStartMs)},${assTime(visibleEndMs - chunkStartMs)},Subtitle,,0,0,0,,${override}${assText(wrapped).replaceAll("\0", "\\N")}`
      });
    }
  }
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${input.width}`,
    `PlayResY: ${input.height}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Subtitle,DejaVu Sans,48,&H00F7F4EC,&H00F7F4EC,&H00101012,&H6407080C,0,0,1,2,1,2,96,96,0,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...dialogues.sort((a, b) => a.startMs - b.startMs).map((dialogue) => dialogue.text),
    ""
  ].join("\n");
}

// scripts/render-hype-user-script-montage.ts
var execFileAsync = promisify(execFile);
var SCRIPT = [
  "HYPE \u2014 \u044D\u0442\u043E \u043F\u0440\u043E\u0441\u0442\u043E \u043E\u0447\u0435\u0440\u0435\u0434\u043D\u043E\u0439 \u0445\u0430\u0439\u043F\u043E\u0432\u044B\u0439 \u0442\u043E\u043A\u0435\u043D \u0438\u043B\u0438 \u0437\u0434\u0435\u0441\u044C \u0435\u0441\u0442\u044C \u0447\u0442\u043E-\u0442\u043E \u0431\u043E\u043B\u044C\u0448\u0435\u0435?",
  "HYPE \u2014 \u043D\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u0442\u043E\u043A\u0435\u043D \u044D\u043A\u043E\u0441\u0438\u0441\u0442\u0435\u043C\u044B Hyperliquid, \u043E\u0434\u043D\u043E\u0439 \u0438\u0437 \u0441\u0430\u043C\u044B\u0445 \u0437\u0430\u043C\u0435\u0442\u043D\u044B\u0445 DeFi-\u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C \u0434\u043B\u044F \u0442\u043E\u0440\u0433\u043E\u0432\u043B\u0438 \u0434\u0435\u0440\u0438\u0432\u0430\u0442\u0438\u0432\u0430\u043C\u0438.",
  "\u0413\u043B\u0430\u0432\u043D\u0430\u044F \u0444\u0438\u0448\u043A\u0430 \u2014 \u0441\u0430\u043C\u0430 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0430 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0431\u044B\u0441\u0442\u0440\u043E, \u0430 \u0442\u043E\u0440\u0433\u043E\u0432\u0430\u044F \u0438\u043D\u0444\u0440\u0430\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u043F\u043E\u0441\u0442\u0440\u043E\u0435\u043D\u0430 \u0432\u043E\u043A\u0440\u0443\u0433 \u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0439 \u0441\u0435\u0442\u0438 Hyperliquid.",
  "\u041D\u043E \u0441\u0430\u043C\u043E\u0435 \u0438\u043D\u0442\u0435\u0440\u0435\u0441\u043D\u043E\u0435 \u043D\u0430\u0447\u0438\u043D\u0430\u0435\u0442\u0441\u044F \u0441 \u0442\u043E\u043A\u0435\u043D\u043E\u043C\u0438\u043A\u0438.",
  "HYPE \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0432 \u044D\u043A\u043E\u0441\u0438\u0441\u0442\u0435\u043C\u0435, \u0443\u0447\u0430\u0441\u0442\u0432\u0443\u0435\u0442 \u0432 \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0438 \u0438 \u0441\u0432\u044F\u0437\u0430\u043D \u0441 \u0440\u0430\u0437\u0432\u0438\u0442\u0438\u0435\u043C \u0432\u0441\u0435\u0439 \u0441\u0435\u0442\u0438.",
  "\u0418\u043C\u0435\u043D\u043D\u043E \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u0432\u043E\u043A\u0440\u0443\u0433 \u043C\u043E\u043D\u0435\u0442\u044B \u043F\u043E\u044F\u0432\u0438\u043B\u043E\u0441\u044C \u0441\u0442\u043E\u043B\u044C\u043A\u043E \u0432\u043D\u0438\u043C\u0430\u043D\u0438\u044F.",
  "\u041D\u043E \u0435\u0441\u0442\u044C \u0438 \u043E\u0431\u0440\u0430\u0442\u043D\u0430\u044F \u0441\u0442\u043E\u0440\u043E\u043D\u0430.",
  "\u041A\u0440\u0438\u043F\u0442\u043E\u0440\u044B\u043D\u043E\u043A \u043A\u0440\u0430\u0439\u043D\u0435 \u0432\u043E\u043B\u0430\u0442\u0438\u043B\u0435\u043D, \u0430 \u0441\u0438\u043B\u044C\u043D\u044B\u0439 \u0440\u043E\u0441\u0442 \u0438\u043D\u0442\u0435\u0440\u0435\u0441\u0430 \u043A \u0442\u043E\u043A\u0435\u043D\u0443 \u043D\u0435 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u0443\u0435\u0442 \u0434\u0430\u043B\u044C\u043D\u0435\u0439\u0448\u0435\u0433\u043E \u0440\u043E\u0441\u0442\u0430 \u0446\u0435\u043D\u044B.",
  "\u0422\u0430\u043A \u0447\u0442\u043E HYPE \u2014 \u044D\u0442\u043E \u0444\u0443\u043D\u0434\u0430\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0438\u043B\u0438 \u043E\u0447\u0435\u0440\u0435\u0434\u043D\u043E\u0439 \u0445\u0430\u0439\u043F?",
  "\u041D\u0430\u043F\u0438\u0448\u0438 \u0432 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u044F\u0445, \u0447\u0442\u043E \u0434\u0443\u043C\u0430\u0435\u0448\u044C \u043E HYPE, \u0438 \u043F\u043E\u0441\u0442\u0430\u0432\u044C \u043B\u0430\u0439\u043A, \u0435\u0441\u043B\u0438 \u0445\u043E\u0447\u0435\u0448\u044C \u0431\u043E\u043B\u044C\u0448\u0435 \u0440\u0430\u0437\u0431\u043E\u0440\u043E\u0432 \u043A\u0440\u0438\u043F\u0442\u044B."
].join(" ");
var WIDTH = 1920;
var HEIGHT = 1080;
var SOURCE_VIDEO_PATH = resolve(
  process.argv[2] ?? "../../attached_assets/generated_video/coin-overview-long/hype-kinetic-script.mp4"
);
var OUTPUT_PATH = resolve(process.argv[3] ?? SOURCE_VIDEO_PATH);
var MAX_VISUAL_HOLD_MS = 1350;
var BOLD_FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
var ACCENTS = [
  { hex: "#f3ef00", ffmpeg: "0xf3ef00" },
  { hex: "#11c9ff", ffmpeg: "0x11c9ff" },
  { hex: "#ff5b66", ffmpeg: "0xff5b66" },
  { hex: "#46edc3", ffmpeg: "0x46edc3" }
];
var DARK_FIELDS = ["0x081322", "0x0d1020", "0x0b1924", "0x11111b"];
var KINETIC_CUE_RULES = [
  { pattern: /хайп|хайпов/iu, motif: "token", cues: ["\u0425\u0410\u0419\u041F?", "HYPE", "\u0422\u041E\u041A\u0415\u041D"] },
  {
    pattern: /нативн|экосистем|hyperliquid|defi|дериватив/iu,
    motif: "platform",
    cues: ["\u041D\u0410\u0422\u0418\u0412\u041D\u042B\u0419 \u0422\u041E\u041A\u0415\u041D", "HYPERLIQUID", "DeFi", "\u0414\u0415\u0420\u0418\u0412\u0410\u0422\u0418\u0412\u042B"]
  },
  {
    pattern: /быстро|инфраструктур|собственн|сети/iu,
    motif: "network",
    cues: ["\u0411\u042B\u0421\u0422\u0420\u041E", "\u0418\u041D\u0424\u0420\u0410\u0421\u0422\u0420\u0423\u041A\u0422\u0423\u0420\u0410", "\u0421\u041E\u0411\u0421\u0422\u0412\u0415\u041D\u041D\u0410\u042F \u0421\u0415\u0422\u042C"]
  },
  { pattern: /токеномик/iu, motif: "tokenomics", cues: ["\u0422\u041E\u041A\u0415\u041D\u041E\u041C\u0418\u041A\u0410"] },
  {
    pattern: /используется|управлени|развитию|развити|сети/iu,
    motif: "tokenomics",
    cues: ["\u0418\u0421\u041F\u041E\u041B\u042C\u0417\u0423\u0415\u0422\u0421\u042F", "\u0423\u041F\u0420\u0410\u0412\u041B\u0415\u041D\u0418\u0415", "\u0420\u0410\u0417\u0412\u0418\u0422\u0418\u0415", "\u0421\u0415\u0422\u042C"]
  },
  { pattern: /внимани|монет/iu, motif: "attention", cues: ["\u0412\u041D\u0418\u041C\u0410\u041D\u0418\u0415", "\u041C\u041E\u041D\u0415\u0422\u0410"] },
  { pattern: /обратн|сторон/iu, motif: "risk", cues: ["\u041E\u0411\u0420\u0410\u0422\u041D\u0410\u042F", "\u0421\u0422\u041E\u0420\u041E\u041D\u0410"] },
  {
    pattern: /волатил|рост|не гарантиру|цен/iu,
    motif: "risk",
    cues: ["\u0412\u041E\u041B\u0410\u0422\u0418\u041B\u042C\u041D\u041E\u0421\u0422\u042C", "\u0420\u041E\u0421\u0422 \u0418\u041D\u0422\u0415\u0420\u0415\u0421\u0410", "\u041D\u0415 \u0413\u0410\u0420\u0410\u041D\u0422\u0418\u0420\u0423\u0415\u0422", "\u0420\u041E\u0421\u0422 \u0426\u0415\u041D\u042B"]
  },
  {
    pattern: /фундаментальн|проект|очередной/iu,
    motif: "question",
    cues: ["\u0424\u0423\u041D\u0414\u0410\u041C\u0415\u041D\u0422\u0410\u041B\u042C\u041D\u042B\u0419?", "\u041F\u0420\u041E\u0415\u041A\u0422?", "\u0425\u0410\u0419\u041F?"]
  },
  {
    pattern: /напиши|комментар|лайк|разбор/iu,
    motif: "cta",
    cues: ["\u041D\u0410\u041F\u0418\u0428\u0418", "\u041A\u041E\u041C\u041C\u0415\u041D\u0422\u0410\u0420\u0418\u0418", "HYPE", "\u041F\u041E\u0421\u0422\u0410\u0412\u042C \u041B\u0410\u0419\u041A", "\u0411\u041E\u041B\u042C\u0428\u0415 \u0420\u0410\u0417\u0411\u041E\u0420\u041E\u0412"]
  }
];
function quoteFilterValue(value) {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll(",", "\\,")}'`;
}
function ffTime(milliseconds) {
  return (milliseconds / 1e3).toFixed(3);
}
function chooseFallbackCue(text, index) {
  const stopWords = /* @__PURE__ */ new Set([
    "\u044D\u0442\u043E",
    "\u043F\u0440\u043E\u0441\u0442\u043E",
    "\u0437\u0434\u0435\u0441\u044C",
    "\u0435\u0441\u0442\u044C",
    "\u0447\u0442\u043E-\u0442\u043E",
    "\u0437\u0434\u0435\u0441\u044C",
    "\u043E\u0434\u043D\u043E\u0439",
    "\u0438\u0437",
    "\u0441\u0430\u043C\u044B\u0445",
    "\u0437\u0430\u043C\u0435\u0442\u043D\u044B\u0445",
    "\u0434\u043B\u044F",
    "\u043D\u043E",
    "\u0441\u0430\u043C\u043E\u0435",
    "\u0438\u043D\u0442\u0435\u0440\u0435\u0441\u043D\u043E\u0435",
    "\u043D\u0430\u0447\u0438\u043D\u0430\u0435\u0442\u0441\u044F",
    "\u0438",
    "\u0432\u0441\u0435\u0439",
    "\u0438\u043C\u0435\u043D\u043D\u043E",
    "\u043F\u043E\u044D\u0442\u043E\u043C\u0443",
    "\u0432\u043E\u043A\u0440\u0443\u0433",
    "\u043F\u043E\u044F\u0432\u0438\u043B\u043E\u0441\u044C",
    "\u0442\u0430\u043A",
    "\u0430",
    "\u043A\u0430\u043A",
    "\u0447\u0442\u043E",
    "\u0434\u0443\u043C\u0430\u0435\u0448\u044C",
    "\u0435\u0441\u043B\u0438",
    "\u0445\u043E\u0447\u0435\u0448\u044C",
    "\u0431\u043E\u043B\u044C\u0448\u0435",
    "\u0432",
    "\u043D\u0430",
    "\u0438\u043B\u0438",
    "\u0432\u0441\u044F",
    "\u0432\u0441\u044F",
    "\u0432\u0441\u044F"
  ]);
  const words = text.match(/[\p{L}\p{N}-]+/gu)?.filter((word) => word.length >= 4 && !stopWords.has(word.toLocaleLowerCase("ru-RU")));
  return words?.[index % words.length] ?? "HYPE";
}
function makeKineticBeats(phraseBeats, durationMs) {
  const result = [];
  for (const phrase of phraseBeats) {
    const phraseStart = Math.max(0, phrase.startMs);
    const phraseEnd = Math.min(durationMs, phrase.endMs);
    if (phraseEnd <= phraseStart) continue;
    const eventCount = Math.max(1, Math.ceil((phraseEnd - phraseStart) / MAX_VISUAL_HOLD_MS));
    const rule = KINETIC_CUE_RULES.find((candidate) => candidate.pattern.test(phrase.text));
    for (let index = 0; index < eventCount; index += 1) {
      const startMs = Math.round(phraseStart + (phraseEnd - phraseStart) * index / eventCount);
      const endMs = Math.round(phraseStart + (phraseEnd - phraseStart) * (index + 1) / eventCount);
      const cueIndex = Math.min(
        (rule?.cues.length ?? 1) - 1,
        Math.floor((index + 0.5) * (rule?.cues.length ?? 1) / eventCount)
      );
      const fallback = chooseFallbackCue(phrase.text, index);
      const cue = rule?.cues[cueIndex] ?? fallback;
      const accentByMotif = {
        token: 0,
        platform: 1,
        network: 1,
        tokenomics: 0,
        attention: 3,
        risk: 2,
        question: 0,
        cta: 1
      };
      result.push({
        startMs,
        endMs,
        text: cue.toLocaleUpperCase("ru-RU"),
        motif: rule?.motif ?? "token",
        accentIndex: accentByMotif[rule?.motif ?? "token"],
        side: result.length % 2 === 0 ? "right" : "left",
        layout: result.length % 4
      });
    }
  }
  return result;
}
async function createKineticPlates(tempDir) {
  const paths = [];
  const gridLines = Array.from({ length: 27 }, (_, index) => {
    const x = index * 72;
    return `<path d="M ${x} 0 V ${HEIGHT}" />`;
  }).join("");
  const horizontalLines = Array.from({ length: 16 }, (_, index) => {
    const y = index * 72;
    return `<path d="M 0 ${y} H ${WIDTH}" />`;
  }).join("");
  for (const accent of ACCENTS) {
    for (const side of ["left", "right"]) {
      const panel = side === "right" ? `1280,0 ${WIDTH},0 ${WIDTH},${HEIGHT} 620,${HEIGHT}` : `0,0 640,0 1300,${HEIGHT} 0,${HEIGHT}`;
      const slash = side === "right" ? `M 620 ${HEIGHT} L 1280 0` : `M 640 0 L 1300 ${HEIGHT}`;
      const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
        `<g fill="none" stroke="#80a6c4" stroke-width="1" opacity=".19">${gridLines}${horizontalLines}</g>`,
        `<polygon points="${panel}" fill="${accent.hex}" fill-opacity=".93"/>`,
        `<path d="${slash}" fill="none" stroke="#f7f5ed" stroke-width="5" stroke-opacity=".82"/>`,
        `<path d="M 0 ${HEIGHT - 100} L 360 ${HEIGHT - 180} M ${WIDTH - 360} 145 L ${WIDTH} 85" fill="none" stroke="${accent.hex}" stroke-width="3" stroke-opacity=".64"/>`,
        "</svg>"
      ].join("");
      const plateIndex = paths.length;
      const svgPath = join(tempDir, `plate-${plateIndex}.svg`);
      const pngPath = join(tempDir, `plate-${plateIndex}.png`);
      await writeFile(svgPath, svg, "utf8");
      await execFileAsync("magick", ["-background", "none", svgPath, "-alpha", "set", pngPath], {
        maxBuffer: 8 * 1024 * 1024
      });
      paths.push(pngPath);
    }
  }
  return paths;
}
function buildPlateSlideExpression(events, side) {
  const origin = side === "left" ? -1 : 1;
  return events.reduceRight((fallback, event) => {
    const start = ffTime(event.startMs);
    const end = ffTime(event.endMs);
    const active = `gte(t,${start})*lt(t,${end})`;
    const progress = `min(max((t-${start})/0.22,0),1)`;
    return `if(${active},${origin}*${WIDTH}*(1-${progress}),${fallback})`;
  }, "0");
}
function drawBox(input) {
  const enable = `gte(t,${ffTime(input.startMs)})*lt(t,${ffTime(input.endMs)})`;
  return `drawbox=x=${quoteFilterValue(String(input.x))}:y=${quoteFilterValue(String(input.y))}:w=${quoteFilterValue(String(input.w))}:h=${quoteFilterValue(String(input.h))}:color=${input.color}:t=${input.thickness ?? "fill"}:enable=${quoteFilterValue(enable)}`;
}
function drawText(input) {
  const enable = `gte(t,${ffTime(input.startMs)})*lt(t,${ffTime(input.endMs)})`;
  const text = input.text.replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll(":", "\\:");
  return `drawtext=fontfile=${BOLD_FONT_PATH}:text='${text}':x=${quoteFilterValue(input.x)}:y=${quoteFilterValue(String(input.y))}:fontsize=${quoteFilterValue(String(input.fontSize))}:fontcolor=${input.color}:borderw=${input.borderWidth ?? 3}:bordercolor=0x08101d:shadowcolor=0x000000@0.58:shadowx=4:shadowy=5:alpha=${quoteFilterValue(`min(min(max((t-${ffTime(input.startMs)})/0.07,0),1),min(max((${ffTime(input.endMs)}-t)/0.1,0),1))`)}:enable=${quoteFilterValue(enable)}`;
}
function buildKineticGraphics(events) {
  const backgroundFilters = [];
  const plateEvents = /* @__PURE__ */ new Map();
  events.forEach((event, index) => {
    const list = plateEvents.get(event.accentIndex * 2 + (event.side === "left" ? 0 : 1)) ?? [];
    list.push(event);
    plateEvents.set(event.accentIndex * 2 + (event.side === "left" ? 0 : 1), list);
    backgroundFilters.push(drawBox({
      x: 0,
      y: 0,
      w: WIDTH,
      h: HEIGHT,
      color: DARK_FIELDS[index % DARK_FIELDS.length],
      startMs: event.startMs,
      endMs: event.endMs
    }));
  });
  const plateEnable = new Map([...plateEvents].map(([plateIndex, plateList]) => [
    plateIndex,
    plateList.map((event) => `between(t,${ffTime(event.startMs)},${ffTime(event.endMs)})`).join("+")
  ]));
  const filters = [];
  events.forEach((event, index) => {
    const start = ffTime(event.startMs);
    const end = ffTime(event.endMs);
    const active = `gte(t,${start})*lt(t,${end})`;
    const localTime = `(t-${start})`;
    const textSideIsLeft = event.side === "right";
    const fontSize = event.text.length <= 4 ? 310 : event.text.length <= 8 ? 245 : event.text.length <= 13 ? 188 : 150;
    const yPositions = [310, 420, 250, 520];
    const y = yPositions[event.layout];
    const x = textSideIsLeft ? `92-48*(1-min(max(${localTime}/0.16,0),1))+if(lt(${localTime},0.12),8*sin(${localTime}*120),0)` : `${WIDTH}-92-text_w+48*(1-min(max(${localTime}/0.16,0),1))+if(lt(${localTime},0.12),8*sin(${localTime}*120),0)`;
    const titleColor = event.layout === 2 ? "0xf8f7f0" : ACCENTS[event.accentIndex].ffmpeg;
    filters.push(drawText({
      text: event.text,
      x,
      y,
      fontSize: `${fontSize}*(0.72+0.28*min(max(${localTime}/0.16,0),1))`,
      color: titleColor,
      startMs: event.startMs,
      endMs: event.endMs,
      borderWidth: 4
    }));
    const panelX = event.side === "right" ? 1320 : 120;
    const panelCenterX = panelX + 260;
    const panelCenterY = 360 + index % 3 * 58;
    const accent = ACCENTS[event.accentIndex].ffmpeg;
    const progress = `min(max((${localTime}-0.06)/0.32,0),1)`;
    if (event.motif === "network" || event.motif === "platform") {
      const nodes = [
        { x: panelX + 20, y: panelCenterY + 95 },
        { x: panelX + 185, y: panelCenterY - 15 },
        { x: panelX + 360, y: panelCenterY + 75 },
        { x: panelX + 245, y: panelCenterY + 235 }
      ];
      filters.push(
        drawBox({
          x: nodes[0].x,
          y: nodes[0].y,
          w: `${nodes[1].x - nodes[0].x}*${progress}`,
          h: 9,
          color: `${accent}@0.95`,
          startMs: event.startMs,
          endMs: event.endMs
        }),
        drawBox({
          x: nodes[1].x,
          y: nodes[1].y,
          w: `${nodes[2].x - nodes[1].x}*${progress}`,
          h: 9,
          color: `${accent}@0.95`,
          startMs: event.startMs + 90,
          endMs: event.endMs
        }),
        drawBox({
          x: nodes[2].x,
          y: nodes[2].y,
          w: 9,
          h: `${nodes[3].y - nodes[2].y}*${progress}`,
          color: `${accent}@0.95`,
          startMs: event.startMs + 160,
          endMs: event.endMs
        })
      );
      nodes.forEach((node, nodeIndex) => {
        filters.push(drawText({
          text: nodeIndex === 1 ? "\u25C9" : "\u25CF",
          x: `${node.x}-34`,
          y: `${node.y}-56`,
          fontSize: `76*min(max((${localTime}-${(0.12 + nodeIndex * 0.12).toFixed(2)})/0.11,0),1)`,
          color: nodeIndex === 1 ? "0xf8f7f0" : accent,
          startMs: event.startMs + 100,
          endMs: event.endMs,
          borderWidth: 0
        }));
      });
    } else if (event.motif === "risk") {
      const points = [
        { x: panelX + 10, y: panelCenterY + 80 },
        { x: panelX + 105, y: panelCenterY - 15 },
        { x: panelX + 205, y: panelCenterY + 115 },
        { x: panelX + 305, y: panelCenterY - 40 },
        { x: panelX + 410, y: panelCenterY + 40 }
      ];
      for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
        const from = points[pointIndex];
        const to = points[pointIndex + 1];
        const delay = 0.08 + pointIndex * 0.09;
        filters.push(
          drawBox({
            x: from.x,
            y: from.y,
            w: `${to.x - from.x}*min(max((${localTime}-${delay.toFixed(2)})/0.16,0),1)`,
            h: 11,
            color: "0xf3ef00",
            startMs: event.startMs + delay * 1e3,
            endMs: event.endMs
          }),
          drawBox({
            x: to.x,
            y: Math.min(from.y, to.y),
            w: 11,
            h: Math.abs(to.y - from.y),
            color: "0xf3ef00",
            startMs: event.startMs + (delay + 0.09) * 1e3,
            endMs: event.endMs
          })
        );
      }
      points.forEach((point, pointIndex) => {
        filters.push(drawText({
          text: "\u25CF",
          x: `${point.x}-20`,
          y: `${point.y}-42`,
          fontSize: `42*min(max((${localTime}-${(0.12 + pointIndex * 0.07).toFixed(2)})/0.12,0),1)`,
          color: pointIndex % 2 === 0 ? "0x11c9ff" : "0xf3ef00",
          startMs: event.startMs + 120,
          endMs: event.endMs,
          borderWidth: 1
        }));
      });
    } else if (event.motif === "token" || event.motif === "tokenomics") {
      filters.push(
        drawText({
          text: "\u25C9",
          x: `${panelCenterX - 124}+16*sin(${localTime}*4)`,
          y: `${panelCenterY - 150}+12*sin(${localTime}*5)`,
          fontSize: `250*(0.9+0.08*sin(${localTime}*5))`,
          color: accent,
          startMs: event.startMs,
          endMs: event.endMs,
          borderWidth: 0
        }),
        drawText({
          text: "\u25CF",
          x: `${panelCenterX}+135*cos(${localTime}*3.8)-25`,
          y: `${panelCenterY}+135*sin(${localTime}*3.8)-38`,
          fontSize: 58,
          color: "0xf8f7f0",
          startMs: event.startMs,
          endMs: event.endMs,
          borderWidth: 0
        }),
        drawBox({
          x: `${panelCenterX - 210}`,
          y: `${panelCenterY + 165}`,
          w: `420*${progress}`,
          h: 8,
          color: "0xf8f7f0@0.9",
          startMs: event.startMs,
          endMs: event.endMs
        })
      );
    } else if (event.motif === "cta") {
      filters.push(
        drawBox({
          x: panelCenterX - 165,
          y: panelCenterY - 70,
          w: 300,
          h: 190,
          color: `${accent}@0.16`,
          startMs: event.startMs,
          endMs: event.endMs,
          thickness: 8
        }),
        drawText({
          text: "?",
          x: `${panelCenterX + 62}+8*sin(${localTime}*9)`,
          y: panelCenterY - 175,
          fontSize: `210*(0.78+0.22*min(max(${localTime}/0.16,0),1))`,
          color: "0xf8f7f0",
          startMs: event.startMs,
          endMs: event.endMs,
          borderWidth: 0
        }),
        drawBox({
          x: panelCenterX - 200,
          y: panelCenterY + 165,
          w: `440*${progress}`,
          h: 12,
          color: accent,
          startMs: event.startMs,
          endMs: event.endMs
        })
      );
    } else if (event.motif === "question" || event.motif === "attention") {
      filters.push(
        drawText({
          text: event.motif === "question" ? "?" : "!",
          x: `${panelCenterX - 74}+10*sin(${localTime}*11)`,
          y: `${panelCenterY - 170}`,
          fontSize: `250*(0.72+0.28*min(max(${localTime}/0.14,0),1))`,
          color: accent,
          startMs: event.startMs,
          endMs: event.endMs,
          borderWidth: 0
        }),
        drawBox({
          x: panelCenterX - 170,
          y: panelCenterY + 150,
          w: `360*${progress}`,
          h: 10,
          color: "0xf8f7f0",
          startMs: event.startMs,
          endMs: event.endMs
        })
      );
    }
    if (index === 0 || event.motif === "risk" || event.motif === "question") {
      filters.push(drawBox({
        x: `mod((t-${start})*${WIDTH * 4},${WIDTH + 460})-260`,
        y: 100 + index % 2 * 90,
        w: 300,
        h: 13,
        color: `${accent}@0.84`,
        startMs: event.startMs,
        endMs: Math.min(event.endMs, event.startMs + 190)
      }));
      filters.push(drawBox({
        x: 0,
        y: 0,
        w: WIDTH,
        h: HEIGHT,
        color: "0xf8f7f0@0.55",
        startMs: event.startMs,
        endMs: Math.min(event.endMs, event.startMs + 55)
      }));
    }
    filters.push(drawBox({
      x: event.side === "right" ? 104 : WIDTH - 370,
      y: 840,
      w: `260*${progress}`,
      h: 9,
      color: accent,
      startMs: event.startMs,
      endMs: event.endMs
    }));
    filters.push(drawBox({
      x: event.side === "right" ? `${WIDTH}-300-${localTime}*${WIDTH * 5}` : `-300+${localTime}*${WIDTH * 5}`,
      y: 120 + index % 4 * 92,
      w: 300,
      h: 10,
      color: `${accent}@0.92`,
      startMs: event.startMs,
      endMs: Math.min(event.endMs, event.startMs + 400)
    }));
  });
  return { backgroundFilters, filters, plateEnable, plateEvents };
}
async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "hype-kinetic-script-"));
  const captionsPath = join(tempDir, "captions.ass");
  const filterGraphPath = join(tempDir, "filter-graph.txt");
  const outputTempPath = join(tempDir, "rendered.mp4");
  try {
    const { stdout: sourceProbeResult } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_name,codec_type,width,height,r_frame_rate",
      "-of",
      "json",
      SOURCE_VIDEO_PATH
    ]);
    const sourceProbe = JSON.parse(sourceProbeResult);
    const sourceDurationMs = Math.round(Number(sourceProbe.format?.duration) * 1e3);
    const sourceVideo = sourceProbe.streams?.find((stream) => stream.codec_type === "video");
    const sourceAudio = sourceProbe.streams?.find((stream) => stream.codec_type === "audio");
    if (!Number.isFinite(sourceDurationMs) || sourceDurationMs < 1e4 || !sourceVideo || sourceVideo.width !== WIDTH || sourceVideo.height !== HEIGHT || sourceAudio?.codec_name !== "aac") {
      throw new Error("The existing HYPE MP4 must contain the expected 1920x1080 video and AAC soundtrack.");
    }
    const durationMs = sourceDurationMs;
    const voices = [{
      sceneId: 1,
      startTime: 0,
      endTime: durationMs,
      text: SCRIPT
    }];
    const beats = buildCoinOverviewLongPhraseBeats({ voices, durationMs });
    const kineticBeats = makeKineticBeats(beats, durationMs);
    if (!kineticBeats.length || kineticBeats.some(
      (beat) => beat.endMs - beat.startMs > MAX_VISUAL_HOLD_MS + 1
    )) {
      throw new Error("The kinetic montage plan contains an empty beat or a visual hold longer than 1.35 seconds.");
    }
    const kinetic = buildKineticGraphics(kineticBeats);
    const plates = await createKineticPlates(tempDir);
    const captions = buildCoinOverviewLongPhraseCaptions({
      voices,
      durationMs,
      width: WIDTH,
      height: HEIGHT,
      chunkStartMs: 0,
      chunkEndMs: durationMs
    });
    await writeFile(captionsPath, captions, "utf8");
    const durationSeconds = (durationMs / 1e3).toFixed(3);
    const graph = [
      `[0:v]${kinetic.backgroundFilters.join(",")}[base]`
    ];
    let currentLabel = "base";
    for (let index = 0; index < plates.length; index += 1) {
      const enable = kinetic.plateEnable.get(index);
      if (!enable) continue;
      const plateInput = index + 2;
      const nextLabel = `plated${index}`;
      const side = index % 2 === 0 ? "left" : "right";
      const slideX = buildPlateSlideExpression(kinetic.plateEvents.get(index) ?? [], side);
      graph.push(`[${plateInput}:v]format=rgba[plate${index}]`);
      graph.push(
        `[${currentLabel}][plate${index}]overlay=x=${quoteFilterValue(slideX)}:y=0:format=auto:eof_action=repeat:enable=${quoteFilterValue(enable)}[${nextLabel}]`
      );
      currentLabel = nextLabel;
    }
    graph.push(
      `[${currentLabel}]${kinetic.filters.join(",")},subtitles=${captionsPath},fps=30,format=yuv420p[video]`
    );
    await writeFile(filterGraphPath, graph.join(";\n"), "utf8");
    const sourceAudioHash = await hashAudioStream(SOURCE_VIDEO_PATH);
    const ffmpegArgs = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x111820:s=${WIDTH}x${HEIGHT}:r=30:d=${durationSeconds}`,
      "-i",
      SOURCE_VIDEO_PATH
    ];
    for (const plate of plates) {
      ffmpegArgs.push("-loop", "1", "-framerate", "30", "-i", plate);
    }
    ffmpegArgs.push(
      "-filter_complex_script",
      filterGraphPath,
      "-map",
      "[video]",
      "-map",
      "1:a:0",
      "-t",
      durationSeconds,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "19",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      outputTempPath
    );
    await execFileAsync("ffmpeg", ffmpegArgs, { maxBuffer: 24 * 1024 * 1024 });
    const outputAudioHash = await hashAudioStream(outputTempPath);
    if (outputAudioHash !== sourceAudioHash) {
      throw new Error("The final MP4 audio differs from the original; refusing to replace the source.");
    }
    const { stdout: probeResult } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_name,width,height,r_frame_rate,codec_type",
      "-of",
      "json",
      outputTempPath
    ]);
    const probe = JSON.parse(probeResult);
    const video = probe.streams?.find((stream) => stream.codec_type === "video");
    const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
    if (video?.codec_name !== "h264" || video.width !== WIDTH || video.height !== HEIGHT || video.r_frame_rate !== "30/1" || audio?.codec_name !== "aac" || Number(probe.format?.duration) < durationMs / 1e3 - 0.2) {
      throw new Error("The finished MP4 did not pass duration, video, and audio checks.");
    }
    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await copyFile(outputTempPath, OUTPUT_PATH);
    console.log(JSON.stringify({
      outputPath: OUTPUT_PATH,
      durationMs,
      bytes: (await stat(OUTPUT_PATH)).size,
      beatCount: beats.length,
      resolution: `${WIDTH}x${HEIGHT}`,
      frameRate: "30 FPS",
      phraseBeatCount: beats.length,
      visualChangeCount: kineticBeats.length,
      maxVisualHoldMs: Math.max(...kineticBeats.map((beat) => beat.endMs - beat.startMs)),
      audioCopiedUnchanged: true
    }, null, 2));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
async function hashAudioStream(path) {
  const { stdout } = await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    path,
    "-map",
    "0:a:0",
    "-c:a",
    "copy",
    "-f",
    "hash",
    "-hash",
    "md5",
    "-"
  ], { maxBuffer: 2 * 1024 * 1024 });
  const hash = stdout.trim();
  if (!hash.startsWith("MD5=")) throw new Error("Could not verify the source audio stream.");
  return hash;
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
