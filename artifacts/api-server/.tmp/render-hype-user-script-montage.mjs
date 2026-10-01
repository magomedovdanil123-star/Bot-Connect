// scripts/render-hype-user-script-montage.ts
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

// src/lib/audio-generation/free-tts.ts
var DEFAULT_FREE_RUSSIAN_VOICE = "google-ru";
function getFreeTtsVoice() {
  return process.env["TTS_VOICE_ID"] || DEFAULT_FREE_RUSSIAN_VOICE;
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
function filterExpression(value) {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll(",", "\\,")}'`;
}
function drawBox(input) {
  return `drawbox=x=${filterExpression(String(input.x))}:y=${filterExpression(String(input.y))}:w=${filterExpression(String(input.w))}:h=${filterExpression(String(input.h))}:color=${input.color}:t=${input.thickness ?? "fill"}:enable=${filterExpression(input.enable)}`;
}
function drawText(input) {
  return `drawtext=font='DejaVu Sans':text='${input.text}':x=${filterExpression(String(input.x))}:y=${filterExpression(String(input.y))}:fontsize=${input.size}:fontcolor=${input.color}:borderw=0:shadowcolor=black@0.45:shadowx=4:shadowy=4:enable=${filterExpression(input.enable)}`;
}
var MOTION_PALETTES = [
  { background: "0x111820", primary: "0x8db7a4", secondary: "0xc7a775", contrast: "0xe6e0d6", title: "0xf2eee5", darkBackground: true },
  { background: "0x121920", primary: "0xc7a775", secondary: "0x8db7a4", contrast: "0xe6e0d6", title: "0xf2eee5", darkBackground: true },
  { background: "0x141b22", primary: "0x91b9a7", secondary: "0xaaa99c", contrast: "0xe4ded2", title: "0xf2eee5", darkBackground: true },
  { background: "0x111920", primary: "0xbca574", secondary: "0x85aa98", contrast: "0xe3ddd2", title: "0xf2eee5", darkBackground: true },
  { background: "0x151c23", primary: "0x8caf9f", secondary: "0xb69c72", contrast: "0xe8e2d8", title: "0xf2eee5", darkBackground: true },
  { background: "0x121a21", primary: "0xc2a879", secondary: "0x8aaf9d", contrast: "0xe8e2d8", title: "0xf2eee5", darkBackground: true },
  { background: "0x141b22", primary: "0x8db7a4", secondary: "0xb9a276", contrast: "0xe6e0d6", title: "0xf2eee5", darkBackground: true },
  { background: "0x111820", primary: "0xbca574", secondary: "0x91b9a7", contrast: "0xe6e0d6", title: "0xf2eee5", darkBackground: true },
  { background: "0x131a22", primary: "0x8caf9f", secondary: "0xc2a879", contrast: "0xe3ddd2", title: "0xf2eee5", darkBackground: true }
];
function getCoinOverviewLongMotionPalette(beat, _layout) {
  return MOTION_PALETTES[beat.beatIndex % MOTION_PALETTES.length];
}
function addGrowingLine(filters, input) {
  const revealSeconds = input.revealSeconds ?? 0.32;
  const lineStart = input.start + input.delay;
  const reveal = `min(max((t-${lineStart.toFixed(3)})/${revealSeconds.toFixed(3)},0),1)`;
  filters.push(drawBox({
    x: input.x,
    y: input.y,
    w: `${Math.max(1, input.width)}*${reveal}`,
    h: input.height,
    color: input.color,
    enable: `gte(t,${lineStart.toFixed(3)})*lt(t,${input.end.toFixed(3)})`
  }));
}
function addStepChart(input) {
  const { filters, width, height, start, end, color, nodeColor, variant, text } = input;
  const graphX = Math.round(width * 0.1);
  const graphY = Math.round(height * 0.2);
  const graphWidth = Math.round(width * 0.8);
  const graphHeight = Math.round(height * 0.48);
  const falling = /пад|сниж|обвал|прода|отток|выход|сокращ|потер|риск/iu.test(text);
  const minSide = Math.min(width, height);
  const lineThickness = Math.max(4, Math.round(minSide * 0.016));
  const gridThickness = Math.max(1, Math.round(minSide * 2e-3));
  const panelPadding = Math.max(5, Math.round(minSide * 0.018));
  const active = `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`;
  const chartPanelX = graphX - panelPadding;
  const chartPanelY = graphY - panelPadding;
  const chartPanelWidth = graphWidth + panelPadding * 2;
  const chartPanelHeight = graphHeight + panelPadding * 2;
  filters.push(drawBox({
    x: chartPanelX,
    y: chartPanelY,
    w: chartPanelWidth,
    h: chartPanelHeight,
    color: "0x1a242b@0.96",
    enable: active
  }));
  for (let row = 1; row <= 4; row += 1) {
    filters.push(drawBox({
      x: graphX,
      y: graphY + Math.round(graphHeight * row / 5),
      w: graphWidth,
      h: gridThickness,
      color: "0xb5b8b1@0.24",
      enable: active
    }));
  }
  for (let column = 1; column <= 6; column += 1) {
    filters.push(drawBox({
      x: graphX + Math.round(graphWidth * column / 7),
      y: graphY,
      w: gridThickness,
      h: graphHeight,
      color: "0xb5b8b1@0.18",
      enable: active
    }));
  }
  const barValues = [0.34, 0.49, 0.4, 0.62, 0.51, 0.7, 0.57, 0.74, 0.63];
  const barWidth = Math.max(8, Math.round(graphWidth * 0.045));
  const barStep = graphWidth / (barValues.length + 1);
  barValues.forEach((value, index) => {
    const revealStart = start + 0.06 + index * 0.055;
    const reveal = `min(max((t-${revealStart.toFixed(3)})/0.22,0),1)`;
    const barHeight = Math.round(graphHeight * value);
    filters.push(drawBox({
      x: Math.round(graphX + barStep * (index + 0.5) - barWidth / 2),
      y: `${graphY + graphHeight}-${barHeight}*${reveal}`,
      w: barWidth,
      h: `${barHeight}*${reveal}`,
      color: `${color}@0.38`,
      enable: `gte(t,${revealStart.toFixed(3)})*lt(t,${end.toFixed(3)})`
    }));
  });
  const points = Array.from({ length: 7 }, (_, index) => {
    const x = graphX + Math.round(graphWidth * index / 6);
    const trend = falling ? 0.28 : -0.28;
    const wave = [0, -0.045, 0.032, -0.065, 0.025, -0.055, 0][index];
    const y = Math.round(graphY + graphHeight * (0.62 + trend * (index / 6) + wave));
    return { x, y };
  });
  const drawSpan = Math.max(0.4, Math.min(1.24, (end - start) * 0.76));
  const pointDelay = drawSpan / (points.length - 1);
  const revealSeconds = Math.min(0.16, Math.max(0.1, pointDelay * 0.72));
  const nodeSize = Math.max(20, Math.round(minSide * 0.05));
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const delay = 0.08 + index * pointDelay;
    addGrowingLine(filters, {
      x: from.x,
      y: from.y,
      width: to.x - from.x,
      height: lineThickness,
      color,
      start,
      end,
      delay,
      revealSeconds
    });
    const verticalTop = Math.min(from.y, to.y);
    const verticalHeight = Math.max(lineThickness, Math.abs(to.y - from.y));
    filters.push(drawBox({
      x: to.x,
      y: verticalTop,
      w: lineThickness,
      h: verticalHeight,
      color,
      enable: `gte(t,${(start + delay + revealSeconds * 0.72).toFixed(3)})*lt(t,${end.toFixed(3)})`
    }));
    filters.push(drawText({
      text: "\u25CF",
      x: to.x - Math.round(nodeSize * 0.5),
      y: to.y - Math.round(nodeSize * 0.7),
      size: nodeSize,
      color: nodeColor,
      enable: `gte(t,${(start + delay + revealSeconds * 0.72).toFixed(3)})*lt(t,${end.toFixed(3)})`
    }));
  }
  const travel = Math.max(0.45, end - start - 0.1);
  const cursorX = `${graphX}+${graphWidth}*min(max((t-${(start + 0.08).toFixed(3)})/${travel.toFixed(3)},0),1)`;
  const cursorWidth = Math.max(4, Math.round(width * 4e-3));
  filters.push(
    drawBox({
      x: cursorX,
      y: graphY,
      w: cursorWidth,
      h: graphHeight,
      color: `${nodeColor}@0.3`,
      enable: active
    }),
    drawText({
      text: "\u25CF",
      x: `${cursorX}-${Math.round(nodeSize * 0.5)}`,
      y: `${graphY + Math.round(graphHeight * 0.48)}+sin((t-${start.toFixed(3)})*2.4)*${Math.round(graphHeight * 0.12)}`,
      size: nodeSize,
      color: nodeColor,
      enable: active
    })
  );
}
function addNetworkGraph(input) {
  const { filters, width, height, start, end, accent, highlight, variant } = input;
  const originX = Math.round(width * (variant % 2 === 0 ? 0.2 : 0.16));
  const originY = Math.round(height * 0.22);
  const graphWidth = Math.round(width * 0.64);
  const graphHeight = Math.round(height * 0.4);
  const nodes = [
    [0.02, 0.52],
    [0.25, 0.08],
    [0.49, 0.78],
    [0.72, 0.22],
    [0.98, 0.61]
  ];
  const pixels = nodes.map(([x, y]) => [
    originX + Math.round(graphWidth * x),
    originY + Math.round(graphHeight * y)
  ]);
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 2], [2, 4]];
  const unit = Math.max(2, Math.round(Math.min(width, height) * 7e-3));
  for (const [index, [fromIndex, toIndex]] of edges.entries()) {
    const [x1, y1] = pixels[fromIndex];
    const [x2, y2] = pixels[toIndex];
    const midX = Math.round((x1 + x2) / 2);
    const delay = 0.16 + index * 0.2;
    addGrowingLine(filters, {
      x: Math.min(x1, midX),
      y: y1,
      width: Math.abs(midX - x1),
      height: unit,
      color: accent,
      start,
      end,
      delay,
      revealSeconds: 0.28
    });
    filters.push(drawBox({
      x: midX,
      y: Math.min(y1, y2),
      w: unit,
      h: Math.max(unit, Math.abs(y2 - y1)),
      color: accent,
      enable: `gte(t,${(start + delay + 0.15).toFixed(3)})*lt(t,${end.toFixed(3)})`
    }));
    addGrowingLine(filters, {
      x: Math.min(midX, x2),
      y: y2,
      width: Math.abs(x2 - midX),
      height: unit,
      color: accent,
      start,
      end,
      delay: delay + 0.27,
      revealSeconds: 0.28
    });
  }
  pixels.forEach(([x, y], index) => {
    filters.push(drawText({
      text: index === 2 ? "\u25C9" : "\u25CB",
      x: x - Math.round(unit * 2.5),
      y: y - Math.round(unit * 4),
      size: Math.max(28, unit * 7),
      color: index === 2 ? highlight : accent,
      enable: `gte(t,${(start + 0.22 + index * 0.17).toFixed(3)})*lt(t,${end.toFixed(3)})`
    }));
  });
}
var KINETIC_STOP_WORDS = /* @__PURE__ */ new Set([
  "\u0430",
  "\u0431\u0435\u0437",
  "\u0431\u044B",
  "\u0432",
  "\u0432\u043E",
  "\u0434\u043B\u044F",
  "\u0434\u043E",
  "\u0435\u0441\u043B\u0438",
  "\u0436\u0435",
  "\u0437\u0430",
  "\u0438",
  "\u0438\u0437",
  "\u0438\u043B\u0438",
  "\u043A",
  "\u043A\u0430\u043A",
  "\u043B\u0438",
  "\u043D\u0430",
  "\u043D\u0430\u0434",
  "\u043D\u0435",
  "\u043D\u043E",
  "\u043E",
  "\u043E\u0431",
  "\u043E\u0442",
  "\u043F\u043E",
  "\u043F\u043E\u0434",
  "\u043F\u0440\u0438",
  "\u0441",
  "\u0441\u043E",
  "\u0443",
  "\u0447\u0442\u043E",
  "\u044D\u0442\u043E",
  "\u0437\u0434\u0435\u0441\u044C",
  "\u0435\u0441\u0442\u044C",
  "\u0442\u0430\u043A",
  "\u0441\u0430\u043C\u0430\u044F",
  "\u0441\u0430\u043C\u043E\u0439",
  "\u0441\u0430\u043C"
]);
function kineticWord(value, offset) {
  const words = value.split(/\s+/).map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}-]+$/gu, "")).filter((word) => word.length >= 3 && !KINETIC_STOP_WORDS.has(word.toLocaleLowerCase("ru-RU")));
  const preferred = [
    "HYPE",
    "\u0442\u043E\u043A\u0435\u043D\u043E\u043C\u0438\u043A\u0438",
    "\u0438\u043D\u0444\u0440\u0430\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430",
    "\u0432\u043E\u043B\u0430\u0442\u0438\u043B\u0435\u043D",
    "\u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0438",
    "\u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u0443\u0435\u0442",
    "\u0444\u0443\u043D\u0434\u0430\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0439",
    "Hyperliquid",
    "\u0434\u0435\u0440\u0438\u0432\u0430\u0442\u0438\u0432\u0430\u043C\u0438",
    "\u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0439",
    "\u044D\u043A\u043E\u0441\u0438\u0441\u0442\u0435\u043C\u044B",
    "\u0432\u043D\u0438\u043C\u0430\u043D\u0438\u044F",
    "\u0445\u0430\u0439\u043F\u043E\u0432\u044B\u0439"
  ];
  for (const target of preferred) {
    const match = words.find(
      (word) => word.toLocaleLowerCase("ru-RU").includes(target.toLocaleLowerCase("ru-RU"))
    );
    if (match) return match;
  }
  if (!words.length) return "HYPE";
  const candidates = [...words].sort((a, b) => b.length - a.length || words.indexOf(a) - words.indexOf(b));
  return candidates[offset % Math.min(candidates.length, 3)];
}
function addKineticWord(filters, input) {
  const { word, width, height, start, end, color, layout } = input;
  const active = `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`;
  const letters = Math.max(1, word.length);
  const size = Math.max(76, Math.min(
    Math.round(height * 0.17),
    Math.floor(width * 0.78 / (letters * 0.64))
  ));
  const centerX = Math.round(width * (layout === 1 ? 0.35 : layout === 2 ? 0.65 : 0.5));
  const centerY = Math.round(height * (layout === 1 ? 0.36 : layout === 2 ? 0.33 : 0.39));
  const travel = Math.round(width * (layout === 1 ? -0.13 : 0.13));
  const reveal = `min(max((t-${(start + 0.035).toFixed(3)})/0.17,0),1)`;
  const text = word.toLocaleUpperCase("ru-RU");
  filters.push(
    drawText({
      text,
      x: `${centerX}+${travel}*(1-${reveal})-text_w/2`,
      y: `${centerY}-text_h/2+sin((t-${start.toFixed(3)})*12)*${Math.round(height * 8e-3)}`,
      size,
      color,
      enable: active
    }),
    drawBox({
      x: `${centerX}-${Math.round(Math.min(width * 0.32, letters * size * 0.29))}`,
      y: centerY + Math.round(size * 0.7),
      w: `${Math.round(Math.min(width * 0.64, letters * size * 0.58))}*${reveal}`,
      h: Math.max(5, Math.round(height * 9e-3)),
      color,
      enable: active
    })
  );
}
function addKineticMotif(input) {
  const { filters, beat, width, height, start, end, palette, variant } = input;
  const active = `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`;
  const side = Math.min(width, height);
  const x = Math.round(width * (variant % 2 === 0 ? 0.26 : 0.66));
  const y = Math.round(height * 0.27);
  const accent = palette.primary;
  const scale = Math.round(side * 0.26);
  const motifIcon = {
    asset: "\u25CE",
    market: "\u2197",
    record: "\u25A4",
    network: "\u2318",
    timeline: "\u25C9",
    access: "\u25C6",
    risk: "!"
  };
  filters.push(
    drawText({
      text: motifIcon[beat.motif],
      x: `${x}+sin((t-${start.toFixed(3)})*8)*${Math.round(width * 0.012)}`,
      y: `${y}+sin((t-${start.toFixed(3)})*11)*${Math.round(height * 0.018)}`,
      size: scale,
      color: beat.motif === "risk" ? palette.secondary : accent,
      enable: active
    }),
    drawBox({
      x: `${Math.round(width * 0.12)}+${Math.round(width * 0.73)}*min(max((t-${(start + 0.08).toFixed(3)})/${Math.max(0.35, end - start - 0.12).toFixed(3)},0),1)`,
      y: Math.round(height * 0.79),
      w: Math.max(5, Math.round(width * 0.035)),
      h: Math.max(5, Math.round(height * 0.012)),
      color: beat.motif === "risk" ? palette.secondary : palette.primary,
      enable: active
    })
  );
}
function buildCoinOverviewLongMotionGraphics(input) {
  const { width, height, chunkStartMs, chunkEndMs } = input;
  const filters = [];
  const beats = input.beats.filter(
    (beat) => beat.endMs > chunkStartMs && beat.startMs < chunkEndMs
  );
  const holdSeconds = 1.25;
  for (const beat of beats) {
    const localStart = Math.max(0, beat.startMs - chunkStartMs) / 1e3;
    const localEnd = (Math.min(chunkEndMs, beat.endMs) - chunkStartMs) / 1e3;
    const endSeconds = Math.max(localStart + 0.04, localEnd);
    for (let localIndex = 0, segmentStart = localStart; segmentStart < endSeconds; localIndex += 1, segmentStart = localStart + localIndex * holdSeconds) {
      const segmentEnd = Math.min(endSeconds, segmentStart + holdSeconds);
      const eventIndex = Math.floor((chunkStartMs + segmentStart * 1e3) / (holdSeconds * 1e3));
      const phase = eventIndex % 6;
      const layout = Math.floor(eventIndex / 3) % 3;
      const palette = getCoinOverviewLongMotionPalette(
        { ...beat, beatIndex: eventIndex },
        layout
      );
      const active = `gte(t,${segmentStart.toFixed(3)})*lt(t,${segmentEnd.toFixed(3)})`;
      const reveal = `min(max((t-${segmentStart.toFixed(3)})/0.2,0),1)`;
      const backgroundIndex = eventIndex % 3;
      const backgrounds = ["0x111820", "0x141b21", "0x121a1e"];
      filters.push(
        drawBox({
          x: 0,
          y: 0,
          w: width,
          h: height,
          color: backgrounds[backgroundIndex],
          enable: active
        }),
        drawBox({
          x: 0,
          y: Math.round(height * 0.085),
          w: `${width}*${reveal}`,
          h: Math.max(4, Math.round(height * 7e-3)),
          color: palette.primary,
          enable: active
        })
      );
      const word = kineticWord(beat.text, eventIndex + beat.beatIndex);
      if (phase === 0 || phase === 3) {
        addKineticWord(filters, {
          word,
          width,
          height,
          start: segmentStart,
          end: segmentEnd,
          color: phase === 0 ? palette.title : palette.primary,
          layout
        });
      } else if (phase === 1 || phase === 5) {
        addStepChart({
          filters,
          width,
          height,
          start: segmentStart,
          end: segmentEnd,
          color: palette.primary,
          nodeColor: palette.contrast,
          variant: layout + phase,
          text: beat.text
        });
        if (phase === 1) {
          filters.push(drawText({
            text: "\u0421\u0425\u0415\u041C\u0410",
            x: Math.round(width * 0.11),
            y: Math.round(height * 0.11),
            size: Math.max(26, Math.round(height * 0.045)),
            color: palette.contrast,
            enable: active
          }));
        }
      } else if (phase === 2) {
        addNetworkGraph({
          filters,
          width,
          height,
          start: segmentStart,
          end: segmentEnd,
          accent: palette.primary,
          highlight: palette.contrast,
          variant: eventIndex + layout
        });
        addKineticWord(filters, {
          word,
          width,
          height,
          start: segmentStart,
          end: segmentEnd,
          color: palette.title,
          layout
        });
      } else {
        addKineticMotif({
          filters,
          beat,
          width,
          height,
          start: segmentStart,
          end: segmentEnd,
          palette,
          variant: eventIndex
        });
        addKineticWord(filters, {
          word,
          width,
          height,
          start: segmentStart,
          end: segmentEnd,
          color: palette.title,
          layout
        });
      }
    }
  }
  return filters.join(",");
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
var OUTPUT_PATH = resolve(
  process.argv[2] ?? "../../attached_assets/generated_video/coin-overview-long/hype-kinetic-script.mp4"
);
var MUSIC_PATH = resolve("../hype-market-focus/public/audio/bg_music.mp3");
var LOGO_PATH = resolve("../hype-market-focus/public/images/hype-token-logo.jpg");
async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "hype-kinetic-script-"));
  const voicePath = join(tempDir, "narration.mp3");
  const captionsPath = join(tempDir, "captions.ass");
  const filterGraphPath = join(tempDir, "filter-graph.txt");
  const outputTempPath = join(tempDir, "rendered.mp4");
  try {
    const narration = await generateFreeRussianSpeech(SCRIPT);
    await writeFile(voicePath, narration);
    const { stdout: audioProbe } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      voicePath
    ]);
    const durationMs = Math.round(Number(audioProbe.trim()) * 1e3);
    if (!Number.isFinite(durationMs) || durationMs < 1e4) {
      throw new Error("The generated narration is missing or unexpectedly short.");
    }
    const voices = [{
      sceneId: 1,
      startTime: 0,
      endTime: durationMs,
      text: SCRIPT
    }];
    const beats = buildCoinOverviewLongPhraseBeats({ voices, durationMs });
    const graphics = buildCoinOverviewLongMotionGraphics({
      width: WIDTH,
      height: HEIGHT,
      beats,
      chunkStartMs: 0,
      chunkEndMs: durationMs
    });
    const captions = buildCoinOverviewLongPhraseCaptions({
      voices,
      durationMs,
      width: WIDTH,
      height: HEIGHT,
      chunkStartMs: 0,
      chunkEndMs: durationMs
    });
    await writeFile(captionsPath, captions, "utf8");
    const logoMoments = beats.filter((beat) => /\bhype\b/iu.test(beat.text)).slice(0, 5).map((beat) => {
      const start = (beat.startMs / 1e3).toFixed(2);
      const end = (Math.min(beat.endMs, beat.startMs + 1e3) / 1e3).toFixed(2);
      return `between(t\\,${start}\\,${end})`;
    });
    const logoEnable = logoMoments.length ? logoMoments.join("+") : "between(t\\,0\\,1.2)";
    const durationSeconds = (durationMs / 1e3).toFixed(3);
    const musicFadeStart = Math.max(0, durationMs / 1e3 - 1.2).toFixed(3);
    const filterGraph = [
      `[0:v]${graphics},subtitles=${captionsPath}[captioned]`,
      `[3:v]scale=180:180[logo]`,
      `[captioned][logo]overlay=x=W-w-110+18*sin(t*8):y=125+15*sin(t*10):enable='${logoEnable}':eval=frame[video]`,
      `[1:a]volume=0.12,afade=t=in:d=0.6,afade=t=out:st=${musicFadeStart}:d=1.2[music]`,
      "[2:a]volume=1.0[voice]",
      "[voice][music]amix=inputs=2:duration=first:dropout_transition=0:weights='1 0.7':normalize=0,alimiter=limit=0.96[audio]"
    ].join(";\n");
    await writeFile(filterGraphPath, filterGraph, "utf8");
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x111820:s=${WIDTH}x${HEIGHT}:r=30:d=${durationSeconds}`,
      "-stream_loop",
      "-1",
      "-i",
      MUSIC_PATH,
      "-i",
      voicePath,
      "-loop",
      "1",
      "-framerate",
      "30",
      "-i",
      LOGO_PATH,
      "-filter_complex_script",
      filterGraphPath,
      "-map",
      "[video]",
      "-map",
      "[audio]",
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
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      outputTempPath
    ], { maxBuffer: 24 * 1024 * 1024 });
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
      frameRate: "30 FPS"
    }, null, 2));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
