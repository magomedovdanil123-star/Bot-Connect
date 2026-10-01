export type CoinOverviewLongMotif =
  | "asset"
  | "market"
  | "record"
  | "network"
  | "timeline"
  | "access"
  | "risk";

export type CoinOverviewLongVoice = {
  sceneId: number;
  startTime: number | null;
  endTime: number | null;
  text: string;
  isFullVoice?: boolean;
};

export type CoinOverviewLongBeat = {
  sceneId: number;
  beatIndex: number;
  startMs: number;
  endMs: number;
  text: string;
  motif: CoinOverviewLongMotif;
};

type TimedWord = {
  text: string;
  startMs: number;
  endMs: number;
};

const MOTIFS: CoinOverviewLongMotif[] = [
  "asset",
  "market",
  "record",
  "network",
  "timeline",
  "access",
  "risk",
];

function normalizeDuration(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("Coin overview render duration must be a positive number");
  }
  return Math.max(1, Math.round(durationMs));
}

function classifyMotif(text: string, index: number): CoinOverviewLongMotif {
  const normalized = text.toLocaleLowerCase("ru-RU");
  if (/риск|угроз|уязв|ограничен|проблем|конкурен|неопредел|осторож|безопасн/.test(normalized)) return "risk";
  if (/истори|основан|создан|запуск|появил|начал|этап|год|раньше|сначала/.test(normalized)) return "timeline";
  if (/сеть|блокчейн|транзакц|валидат|протокол|инфраструктур|узл/.test(normalized)) return "network";
  if (/цен|курс|рынок|динамик|капитализац|объём|ликвид|волатил|торг|спрос|предложен/.test(normalized)) return "market";
  if (/смарт.?контракт|экосистем|приложен|разработ|кошел|токен|актив|монет/.test(normalized)) return "asset";
  if (/запис|реестр|данн|учёт|подпис|перевод/.test(normalized)) return "record";
  if (/ключ|доступ|хранен|владен|адрес/.test(normalized)) return "access";
  return MOTIFS[index % MOTIFS.length]!;
}

function wordTimings(voice: CoinOverviewLongVoice, durationMs: number): TimedWord[] {
  const words = voice.text.trim().split(/\s+/).filter(Boolean);
  const startMs = Math.max(0, Math.round(voice.startTime ?? 0));
  const endMs = Math.min(durationMs, Math.round(voice.endTime ?? durationMs));
  const availableMs = Math.max(0, endMs - startMs);
  if (!words.length || availableMs <= 0) return [];

  const weights = words.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, "").length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let previousWeight = 0;

  return words.map((text, index) => {
    const nextWeight = previousWeight + weights[index]!;
    const timing = {
      text,
      startMs: Math.round(startMs + availableMs * previousWeight / totalWeight),
      endMs: Math.round(startMs + availableMs * nextWeight / totalWeight),
    };
    previousWeight = nextWeight;
    return timing;
  });
}

function splitVoiceIntoPhrases(words: TimedWord[]): TimedWord[][] {
  const phrases: TimedWord[][] = [];
  let current: TimedWord[] = [];
  const flush = () => {
    if (current.length) phrases.push(current);
    current = [];
  };

  for (const word of words) {
    if (
      current.length
      && (
        word.endMs - current[0]!.startMs > 4_400
        || `${current.map((item) => item.text).join(" ")} ${word.text}`.length > 56
      )
    ) {
      flush();
    }
    current.push(word);
    if (/[.!?…;:]$/u.test(word.text) || (/[,…]$/u.test(word.text) && current.length >= 2)) {
      flush();
    }
  }
  flush();
  return phrases;
}

function appendIdleBeats(
  beats: CoinOverviewLongBeat[],
  startMs: number,
  endMs: number,
  motif: CoinOverviewLongMotif,
  sceneId: number,
): void {
  let cursor = startMs;
  let offset = 0;
  while (cursor < endMs) {
    const next = Math.min(endMs, cursor + 4_000);
    const motifIndex = MOTIFS.indexOf(motif);
    beats.push({
      sceneId,
      beatIndex: beats.length,
      startMs: cursor,
      endMs: next,
      text: "",
      motif: MOTIFS[(motifIndex + offset) % MOTIFS.length]!,
    });
    cursor = next;
    offset += 1;
  }
}

export function buildCoinOverviewLongPhraseBeats(input: {
  voices: CoinOverviewLongVoice[];
  durationMs: number;
}): CoinOverviewLongBeat[] {
  const durationMs = normalizeDuration(input.durationMs);
  const rawBeats: CoinOverviewLongBeat[] = [];
  const voices = input.voices
    .filter((voice) => !voice.isFullVoice && voice.text.trim())
    .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));

  for (const voice of voices) {
    const words = wordTimings(voice, durationMs);
    for (const phrase of splitVoiceIntoPhrases(words)) {
      const startMs = phrase[0]!.startMs;
      const endMs = phrase.at(-1)!.endMs;
      if (endMs <= startMs) continue;
      const text = phrase.map((word) => word.text).join(" ");
      rawBeats.push({
        sceneId: voice.sceneId,
        beatIndex: rawBeats.length,
        startMs,
        endMs,
        text,
        motif: classifyMotif(text, rawBeats.length),
      });
    }
  }

  rawBeats.sort((a, b) => a.startMs - b.startMs || a.sceneId - b.sceneId);
  const beats: CoinOverviewLongBeat[] = [];
  let cursor = 0;
  let lastMotif = rawBeats[0]?.motif ?? "asset";
  const fallbackSceneId = voices[0]?.sceneId ?? 0;

  for (const beat of rawBeats) {
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
      endMs,
    });
    cursor = endMs;
    lastMotif = beat.motif;
  }

  if (cursor < durationMs) {
    appendIdleBeats(beats, cursor, durationMs, lastMotif, fallbackSceneId);
  }
  return beats;
}

export function buildCoinOverviewLongPhraseRenderChunks(input: {
  beats: CoinOverviewLongBeat[];
  durationMs: number;
  targetDurationMs?: number;
}): Array<{ startMs: number; endMs: number }> {
  const durationMs = normalizeDuration(input.durationMs);
  const targetDurationMs = Math.max(1, Math.round(input.targetDurationMs ?? 60_000));
  if (durationMs <= targetDurationMs) return [{ startMs: 0, endMs: durationMs }];

  const safeBoundaries = [...new Set(input.beats
    .map((beat) => beat.endMs)
    .filter((endMs) => Number.isFinite(endMs) && endMs > 0 && endMs < durationMs))]
    .sort((a, b) => a - b);
  const boundaries = [0];
  let chunkStartMs = 0;

  while (chunkStartMs + targetDurationMs < durationMs) {
    const targetMs = chunkStartMs + targetDurationMs;
    const candidates = safeBoundaries.filter((boundary) =>
      boundary > chunkStartMs
      && boundary >= chunkStartMs + targetDurationMs * 0.75
      && boundary <= chunkStartMs + targetDurationMs * 1.25,
    );
    const nextBoundary = candidates.length
      ? candidates.reduce((closest, candidate) =>
        Math.abs(candidate - targetMs) < Math.abs(closest - targetMs) ? candidate : closest,
      )
      : safeBoundaries.find((boundary) => boundary > targetMs)
        ?? safeBoundaries.filter((boundary) => boundary > chunkStartMs && boundary < targetMs).at(-1);

    if (nextBoundary === undefined || nextBoundary <= chunkStartMs) break;
    boundaries.push(nextBoundary);
    chunkStartMs = nextBoundary;
  }

  boundaries.push(durationMs);
  return boundaries.slice(0, -1).map((startMs, index) => ({
    startMs,
    endMs: boundaries[index + 1]!,
  }));
}

function filterExpression(value: string): string {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll(",", "\\,")}'`;
}

function drawBox(input: {
  x: string | number;
  y: string | number;
  w: string | number;
  h: string | number;
  color: string;
  thickness?: number | "fill";
  enable: string;
}): string {
  return `drawbox=x=${filterExpression(String(input.x))}:y=${filterExpression(String(input.y))}` +
    `:w=${filterExpression(String(input.w))}:h=${filterExpression(String(input.h))}` +
    `:color=${input.color}:t=${input.thickness ?? "fill"}:enable=${filterExpression(input.enable)}`;
}

function drawText(input: {
  text: string;
  x: string | number;
  y: string | number;
  size: number;
  color: string;
  enable: string;
}): string {
  return `drawtext=font='DejaVu Sans':text='${input.text}'` +
    `:x=${filterExpression(String(input.x))}:y=${filterExpression(String(input.y))}` +
    `:fontsize=${input.size}:fontcolor=${input.color}:borderw=0` +
    `:shadowcolor=black@0.45:shadowx=4:shadowy=4:enable=${filterExpression(input.enable)}`;
}

function motifColors(motif: CoinOverviewLongMotif): { background: string; accent: string; warm: string } {
  switch (motif) {
    case "market":
      return { background: "0x11191d@0.96", accent: "0x83e2be@0.86", warm: "0xf7d19a@0.88" };
    case "record":
      return { background: "0x13171b@0.96", accent: "0xd9f79c@0.84", warm: "0xe6bd70@0.88" };
    case "network":
      return { background: "0x0d1918@0.96", accent: "0x83e2be@0.88", warm: "0xf7d19a@0.88" };
    case "timeline":
      return { background: "0x171719@0.96", accent: "0xe6bd70@0.86", warm: "0x83e2be@0.84" };
    case "access":
      return { background: "0x111816@0.96", accent: "0xd9f79c@0.84", warm: "0xe6bd70@0.90" };
    case "risk":
      return { background: "0x1b1715@0.96", accent: "0xf7d19a@0.86", warm: "0xe8a78f@0.88" };
    default:
      return { background: "0x0c1716@0.96", accent: "0x83e2be@0.86", warm: "0xe6bd70@0.86" };
  }
}

export function buildCoinOverviewLongMotionGraphics(input: {
  width: number;
  height: number;
  beats: CoinOverviewLongBeat[];
  chunkStartMs: number;
  chunkEndMs: number;
}): string {
  const { width, height, chunkStartMs, chunkEndMs } = input;
  const filters: string[] = [];
  const relevantBeats = input.beats.filter((beat) =>
    beat.endMs > chunkStartMs && beat.startMs < chunkEndMs,
  );

  for (const beat of relevantBeats) {
    const localStart = Math.max(0, beat.startMs - chunkStartMs) / 1000;
    const localEnd = Math.min(chunkEndMs, beat.endMs) - chunkStartMs;
    const endSeconds = Math.max(localStart + 0.04, localEnd / 1000);
    const start = localStart.toFixed(3);
    const end = endSeconds.toFixed(3);
    const active = `gte(t,${start})*lt(t,${end})`;
    const reveal = `min(max((t-${start})/0.42,0),1)`;
    const colors = motifColors(beat.motif);
    const variant = beat.beatIndex % 4;
    const panelFromRight = variant % 2 === 1;
    const panelX = panelFromRight ? `${width}*(1-${reveal})` : "0";
    const panelWidth = `${width}*${reveal}`;
    const symbolX = Math.round(width * (variant < 2 ? 0.65 : 0.08));
    const symbolY = Math.round(height * (variant % 2 === 0 ? 0.19 : 0.21));
    const unit = Math.max(1, Math.round(Math.min(width, height) * 0.01));

    filters.push(
      drawBox({
        x: panelX,
        y: 0,
        w: panelWidth,
        h: height,
        color: colors.background,
        enable: active,
      }),
      drawBox({
        x: 0,
        y: Math.max(6, Math.round(height * 0.018)),
        w: `${width}*${reveal}`,
        h: Math.max(2, unit / 3),
        color: colors.warm,
        enable: active,
      }),
    );

    if (beat.motif === "network") {
      const nodes = [
        [0.03, 0.18], [0.28, 0.04], [0.49, 0.32], [0.72, 0.13], [0.94, 0.36],
      ] as const;
      const graphWidth = Math.round(width * 0.34);
      const graphHeight = Math.round(height * 0.39);
      const x0 = Math.round(width * (variant < 2 ? 0.57 : 0.09));
      const y0 = Math.round(height * 0.29);
      const nodesInPixels = nodes.map(([x, y]) => [
        x0 + Math.round(x * graphWidth),
        y0 + Math.round(y * graphHeight),
      ] as const);
      const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 2], [2, 4]] as const;
      for (const [edgeIndex, [fromIndex, toIndex]] of edges.entries()) {
        const [x1, y1] = nodesInPixels[fromIndex]!;
        const [x2, y2] = nodesInPixels[toIndex]!;
        const midpointX = Math.round((x1 + x2) / 2);
        const lineStart = `${start}+${(0.22 + edgeIndex * 0.13).toFixed(2)}`;
        const lineEnable = `gte(t,${lineStart})*lt(t,${end})`;
        filters.push(
          drawBox({ x: Math.min(x1, x2), y: y1, w: Math.max(2, Math.abs(x2 - x1)), h: 2, color: `${colors.accent}`, enable: lineEnable }),
          drawBox({ x: midpointX, y: Math.min(y1, y2), w: 2, h: Math.max(2, Math.abs(y2 - y1)), color: `${colors.accent}`, enable: lineEnable }),
        );
      }
      nodesInPixels.forEach(([x, y], index) => {
        filters.push(drawText({
          text: index === 2 ? "◉" : "○",
          x: x - Math.round(unit * 2.5),
          y: y - Math.round(unit * 4),
          size: Math.max(24, unit * 7),
          color: index === 2 ? colors.warm : colors.accent,
          enable: `gte(t,${start}+${(0.15 + index * 0.16).toFixed(2)})*lt(t,${end})`,
        }));
      });
      const [firstX, firstY] = nodesInPixels[0]!;
      const [lastX, lastY] = nodesInPixels.at(-1)!;
      filters.push(drawBox({
        x: `${firstX}+(${lastX - firstX})*min(max((t-${start}-0.3)/${Math.max(0.5, endSeconds - localStart - 0.7).toFixed(3)},0),1)`,
        y: `${firstY}+(${lastY - firstY})*min(max((t-${start}-0.3)/${Math.max(0.5, endSeconds - localStart - 0.7).toFixed(3)},0),1)`,
        w: Math.max(3, unit),
        h: Math.max(3, unit),
        color: colors.warm,
        enable: active,
      }));
    } else if (beat.motif === "record") {
      const cardX = Math.round(width * (variant < 2 ? 0.09 : 0.57));
      const cardY = Math.round(height * 0.22);
      const cardW = Math.round(width * 0.34);
      const cardH = Math.round(height * 0.47);
      const lineH = Math.max(2, unit / 3);
      filters.push(
        drawBox({ x: cardX, y: cardY, w: cardW, h: lineH, color: colors.accent, enable: active }),
        drawBox({ x: cardX, y: cardY + cardH, w: cardW, h: lineH, color: colors.accent, enable: active }),
        drawBox({ x: cardX, y: cardY, w: lineH, h: cardH, color: colors.accent, enable: active }),
        drawBox({ x: cardX + cardW, y: cardY, w: lineH, h: cardH + lineH, color: colors.accent, enable: active }),
      );
      for (let row = 0; row < 4; row += 1) {
        filters.push(drawBox({
          x: cardX + Math.round(cardW * 0.12),
          y: cardY + Math.round(cardH * (0.22 + row * 0.16)),
          w: `${Math.round(cardW * (row % 2 === 0 ? 0.76 : 0.56))}*${reveal}`,
          h: Math.max(2, unit / 2),
          color: row === 0 ? colors.warm : colors.accent,
          enable: `gte(t,${start}+${(0.25 + row * 0.28).toFixed(2)})*lt(t,${end})`,
        }));
      }
      filters.push(drawText({
        text: "▤",
        x: cardX + Math.round(cardW * 0.7),
        y: cardY - Math.round(height * 0.12),
        size: Math.max(32, Math.round(height * 0.19)),
        color: colors.warm,
        enable: active,
      }));
    } else if (beat.motif === "timeline") {
      const lineX = Math.round(width * 0.1);
      const lineW = Math.round(width * 0.8);
      const lineY = Math.round(height * (variant % 2 === 0 ? 0.48 : 0.39));
      filters.push(drawBox({
        x: lineX,
        y: lineY,
        w: `${lineW}*${reveal}`,
        h: Math.max(3, unit / 2),
        color: colors.accent,
        enable: active,
      }));
      for (let marker = 0; marker < 5; marker += 1) {
        const x = lineX + Math.round(lineW * marker / 4);
        filters.push(drawText({
          text: marker === 4 ? "◉" : "○",
          x: x - Math.round(unit * 3),
          y: lineY - Math.round(unit * 4),
          size: Math.max(26, unit * 7),
          color: marker === 4 ? colors.warm : colors.accent,
          enable: `gte(t,${start}+${(0.18 + marker * 0.27).toFixed(2)})*lt(t,${end})`,
        }));
      }
      filters.push(drawBox({
        x: `${lineX}+${lineW}*min(max((t-${start}-0.2)/${Math.max(0.6, endSeconds - localStart - 0.4).toFixed(3)},0),1)`,
        y: lineY - Math.round(unit * 0.8),
        w: Math.max(3, unit),
        h: Math.max(3, unit),
        color: colors.warm,
        enable: active,
      }));
    } else if (beat.motif === "risk") {
      const x = Math.round(width * (variant < 2 ? 0.16 : 0.66));
      const y = Math.round(height * 0.22);
      const size = Math.round(Math.min(width, height) * 0.32);
      filters.push(
        drawText({ text: "△", x, y, size, color: colors.warm, enable: active }),
        drawText({ text: "!", x: x + Math.round(size * 0.39), y: y + Math.round(size * 0.25), size: Math.round(size * 0.55), color: colors.accent, enable: active }),
        drawBox({ x: x - unit * 2, y: y + size, w: Math.round(size * 1.15), h: Math.max(2, unit / 2), color: colors.warm, enable: active }),
      );
    } else if (beat.motif === "access") {
      const x = Math.round(width * (variant < 2 ? 0.66 : 0.13));
      const y = Math.round(height * 0.24);
      const size = Math.round(Math.min(width, height) * 0.34);
      filters.push(
        drawText({ text: "◎", x, y, size, color: colors.accent, enable: active }),
        drawBox({ x: x + Math.round(size * 0.31), y: y + Math.round(size * 0.68), w: Math.round(size * 0.38), h: Math.round(size * 0.42), color: colors.accent, thickness: Math.max(2, unit / 2), enable: active }),
        drawBox({ x: x + Math.round(size * 0.48), y: y + Math.round(size * 0.77), w: Math.max(2, unit / 2), h: Math.round(size * 0.16), color: colors.warm, enable: active }),
      );
    } else if (beat.motif === "market") {
      const x = Math.round(width * (variant < 2 ? 0.62 : 0.12));
      const y = Math.round(height * 0.25);
      const size = Math.round(Math.min(width, height) * 0.38);
      filters.push(
        drawText({ text: "◎", x, y, size, color: colors.accent, enable: active }),
        drawText({ text: "◌", x: x + Math.round(size * 0.6), y: y - Math.round(size * 0.14), size: Math.round(size * 0.48), color: colors.warm, enable: active }),
        drawBox({
          x: `${x}+${Math.round(size * 0.2)}+${Math.round(size * 0.48)}*${reveal}`,
          y: y + Math.round(size * 0.89),
          w: Math.max(3, unit),
          h: Math.max(3, unit),
          color: colors.warm,
          enable: active,
        }),
      );
    } else {
      const x = Math.round(width * (variant < 2 ? 0.65 : 0.12));
      const y = Math.round(height * 0.22);
      const size = Math.round(Math.min(width, height) * 0.38);
      filters.push(
        drawText({ text: "◎", x, y, size, color: colors.accent, enable: active }),
        drawText({ text: "●", x: x + Math.round(size * 0.19), y: y + Math.round(size * 0.18), size: Math.round(size * 0.18), color: colors.warm, enable: active }),
        drawBox({ x: x + Math.round(size * 0.1), y: y + Math.round(size * 1.02), w: `${Math.round(size * 0.82)}*${reveal}`, h: Math.max(2, unit / 2), color: colors.warm, enable: active }),
      );
    }
  }
  return filters.join(",");
}