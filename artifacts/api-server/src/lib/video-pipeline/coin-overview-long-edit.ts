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

export const COIN_OVERVIEW_LONG_VISUAL_CHANGE_MS = 1_650;

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
  const groupedRawBeats: CoinOverviewLongBeat[] = [];
  for (const beat of rawBeats) {
    const previous = groupedRawBeats.at(-1);
    const mergedEnd = previous ? Math.max(previous.endMs, beat.endMs) : beat.endMs;
    if (
      previous
      && previous.sceneId === beat.sceneId
      && beat.startMs <= previous.endMs + 180
      && previous.endMs - previous.startMs < 2_800
      && mergedEnd - previous.startMs <= 5_200
    ) {
      previous.endMs = mergedEnd;
      previous.text = [previous.text, beat.text].filter(Boolean).join(" ");
      previous.motif = classifyMotif(previous.text, previous.beatIndex);
    } else {
      groupedRawBeats.push({
        ...beat,
        beatIndex: groupedRawBeats.length,
      });
    }
  }

  const beats: CoinOverviewLongBeat[] = [];
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

export type CoinOverviewLongMotionPalette = {
  background: string;
  primary: string;
  secondary: string;
  contrast: string;
  title: string;
  darkBackground: boolean;
};

const MOTION_PALETTES: CoinOverviewLongMotionPalette[] = [
  { background: "0x111218", primary: "0xeeff00", secondary: "0x16d8ff", contrast: "0xff4b63", title: "0xfbfaf6", darkBackground: true },
  { background: "0xeeff00", primary: "0x111218", secondary: "0xff4b63", contrast: "0x315cff", title: "0x111218", darkBackground: false },
  { background: "0xff4b63", primary: "0x111218", secondary: "0xeeff00", contrast: "0x16d8ff", title: "0xfbfaf6", darkBackground: false },
  { background: "0x111218", primary: "0x16d8ff", secondary: "0x315cff", contrast: "0xeeff00", title: "0xfbfaf6", darkBackground: true },
  { background: "0xf2f0e8", primary: "0x111218", secondary: "0xeeff00", contrast: "0xff4b63", title: "0x111218", darkBackground: false },
  { background: "0x1c1d27", primary: "0xeeff00", secondary: "0x7b50ff", contrast: "0x16d8ff", title: "0xfbfaf6", darkBackground: true },
  { background: "0x1b2344", primary: "0xeeff00", secondary: "0xff4b63", contrast: "0x16d8ff", title: "0xfbfaf6", darkBackground: true },
  { background: "0x111218", primary: "0xff4b63", secondary: "0x16d8ff", contrast: "0xeeff00", title: "0xfbfaf6", darkBackground: true },
  { background: "0xf2f0e8", primary: "0x111218", secondary: "0x16d8ff", contrast: "0xff4b63", title: "0x111218", darkBackground: false },
];

export function getCoinOverviewLongMotionPalette(
  beat: CoinOverviewLongBeat,
  _layout: number,
): CoinOverviewLongMotionPalette {
  return MOTION_PALETTES[beat.beatIndex % MOTION_PALETTES.length]!;
}

function addGrowingLine(
  filters: string[],
  input: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    start: number;
    end: number;
    delay: number;
    revealSeconds?: number;
  },
): void {
  const revealSeconds = input.revealSeconds ?? 0.32;
  const lineStart = input.start + input.delay;
  const reveal = `min(max((t-${lineStart.toFixed(3)})/${revealSeconds.toFixed(3)},0),1)`;
  filters.push(drawBox({
    x: input.x,
    y: input.y,
    w: `${Math.max(1, input.width)}*${reveal}`,
    h: input.height,
    color: input.color,
    enable: `gte(t,${lineStart.toFixed(3)})*lt(t,${input.end.toFixed(3)})`,
  }));
}

function addStepChart(input: {
  filters: string[];
  width: number;
  height: number;
  start: number;
  end: number;
  color: string;
  nodeColor: string;
  variant: number;
  text: string;
}): void {
  const { filters, width, height, start, end, color, nodeColor, variant, text } = input;
  const graphX = Math.round(width * (variant % 2 === 0 ? 0.43 : 0.07));
  const graphY = Math.round(height * 0.14);
  const graphWidth = Math.round(width * 0.49);
  const graphHeight = Math.round(height * 0.3);
  const falling = /пад|сниж|обвал|прода|отток|выход|сокращ|потер|риск/iu.test(text);
  const points = Array.from({ length: 7 }, (_, index) => {
    const x = graphX + Math.round(graphWidth * index / 6);
    const trend = falling ? 0.19 : -0.19;
    const wave = [0, -0.045, 0.035, -0.075, 0.015, -0.08, 0][index]!;
    const y = Math.round(graphY + graphHeight * (0.52 + trend * (index / 6) + wave));
    return { x, y };
  });
  const unit = Math.max(2, Math.round(Math.min(width, height) * 0.008));

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    const delay = 0.18 + index * 0.2;
    addGrowingLine(filters, {
      x: from.x,
      y: from.y,
      width: to.x - from.x,
      height: unit,
      color,
      start,
      end,
      delay,
      revealSeconds: 0.22,
    });
    const verticalTop = Math.min(from.y, to.y);
    const verticalHeight = Math.max(unit, Math.abs(to.y - from.y));
    filters.push(drawBox({
      x: to.x,
      y: verticalTop,
      w: unit,
      h: verticalHeight,
      color,
      enable: `gte(t,${(start + delay + 0.18).toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }));
    filters.push(drawText({
      text: "●",
      x: to.x - unit * 2,
      y: to.y - unit * 4,
      size: Math.max(24, unit * 7),
      color: nodeColor,
      enable: `gte(t,${(start + delay + 0.16).toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }));
  }

  const travel = Math.max(0.7, end - start - 0.55);
  filters.push(drawBox({
    x: `${graphX}+${graphWidth}*min(max((t-${(start + 0.35).toFixed(3)})/${travel.toFixed(3)},0),1)`,
    y: `${graphY + Math.round(graphHeight * 0.52)}+sin((t-${start.toFixed(3)})*5)*${Math.max(4, unit * 2)}`,
    w: Math.max(8, unit * 2),
    h: Math.max(8, unit * 2),
    color: nodeColor,
    enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
  }));
}

function addNetworkGraph(input: {
  filters: string[];
  width: number;
  height: number;
  start: number;
  end: number;
  accent: string;
  highlight: string;
  variant: number;
}): void {
  const { filters, width, height, start, end, accent, highlight, variant } = input;
  const originX = Math.round(width * (variant % 2 === 0 ? 0.55 : 0.08));
  const originY = Math.round(height * 0.13);
  const graphWidth = Math.round(width * 0.36);
  const graphHeight = Math.round(height * 0.31);
  const nodes = [
    [0.02, 0.52], [0.25, 0.08], [0.49, 0.78], [0.72, 0.22], [0.98, 0.61],
  ] as const;
  const pixels = nodes.map(([x, y]) => [
    originX + Math.round(graphWidth * x),
    originY + Math.round(graphHeight * y),
  ] as const);
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 2], [2, 4]] as const;
  const unit = Math.max(2, Math.round(Math.min(width, height) * 0.007));

  for (const [index, [fromIndex, toIndex]] of edges.entries()) {
    const [x1, y1] = pixels[fromIndex]!;
    const [x2, y2] = pixels[toIndex]!;
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
      revealSeconds: 0.28,
    });
    filters.push(drawBox({
      x: midX,
      y: Math.min(y1, y2),
      w: unit,
      h: Math.max(unit, Math.abs(y2 - y1)),
      color: accent,
      enable: `gte(t,${(start + delay + 0.15).toFixed(3)})*lt(t,${end.toFixed(3)})`,
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
      revealSeconds: 0.28,
    });
  }

  pixels.forEach(([x, y], index) => {
    filters.push(drawText({
      text: index === 2 ? "◉" : "○",
      x: x - Math.round(unit * 2.5),
      y: y - Math.round(unit * 4),
      size: Math.max(28, unit * 7),
      color: index === 2 ? highlight : accent,
      enable: `gte(t,${(start + 0.22 + index * 0.17).toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }));
  });
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
  const maxVisualHoldSeconds = COIN_OVERVIEW_LONG_VISUAL_CHANGE_MS / 1000;

  for (const beat of relevantBeats) {
    const localStart = Math.max(0, beat.startMs - chunkStartMs) / 1000;
    const localEnd = (Math.min(chunkEndMs, beat.endMs) - chunkStartMs) / 1000;
    const endSeconds = Math.max(localStart + 0.04, localEnd);

    for (
      let microIndex = 0, segmentStart = localStart;
      segmentStart < endSeconds;
      microIndex += 1, segmentStart = localStart + microIndex * maxVisualHoldSeconds
    ) {
      const segmentEnd = Math.min(endSeconds, segmentStart + maxVisualHoldSeconds);
      const start = segmentStart.toFixed(3);
      const end = segmentEnd.toFixed(3);
      const duration = Math.max(0.04, segmentEnd - segmentStart);
      const visualPaletteIndex = Math.floor(
        (chunkStartMs + segmentStart * 1000) / COIN_OVERVIEW_LONG_VISUAL_CHANGE_MS,
      );
      const layout = visualPaletteIndex % 6;
      const palette = getCoinOverviewLongMotionPalette(
        { ...beat, beatIndex: visualPaletteIndex },
        layout,
      );
      const active = `gte(t,${start})*lt(t,${end})`;
      const unit = Math.max(3, Math.round(Math.min(width, height) * 0.01));
      const reveal = `min(max((t-${start})/0.24,0),1)`;

      filters.push(drawBox({
        x: 0,
        y: 0,
        w: `${width}*${reveal}`,
        h: height,
        color: palette.background,
        enable: active,
      }));

      if (layout % 3 === 1) {
        const panelWidth = Math.round(width * 0.34);
        filters.push(drawBox({
          x: `${width}-${panelWidth}*${reveal}`,
          y: 0,
          w: `${panelWidth}*${reveal}`,
          h: height,
          color: `${palette.secondary}@0.86`,
          enable: active,
        }));
      } else if (layout % 3 === 2) {
        const panelWidth = Math.round(width * 0.31);
        filters.push(drawBox({
          x: 0,
          y: 0,
          w: `${panelWidth}*${reveal}`,
          h: height,
          color: `${palette.contrast}@0.9`,
          enable: active,
        }));
      }

      for (let gridLine = 1; gridLine <= 5; gridLine += 1) {
        filters.push(drawBox({
          x: Math.round(width * (0.1 + gridLine * 0.14)),
          y: Math.round(height * 0.14),
          w: Math.max(1, unit / 5),
          h: Math.round(height * 0.36),
          color: `${palette.contrast}@0.12`,
          thickness: Math.max(1, unit / 5),
          enable: active,
        }));
      }

      filters.push(
        drawBox({
          x: Math.round(width * 0.055),
          y: Math.round(height * 0.09),
          w: `${Math.round(width * 0.89)}*${reveal}`,
          h: Math.max(3, unit / 2),
          color: palette.primary,
          enable: active,
        }),
        drawBox({
          x: `${Math.round(width * 0.055)}+${Math.round(width * 0.89)}*min(max((t-${start})/${Math.max(0.5, duration - 0.16).toFixed(3)},0),1)`,
          y: Math.round(height * 0.09) - unit,
          w: unit * 2,
          h: unit * 2,
          color: palette.contrast,
          enable: active,
        }),
      );

      for (let stripe = 0; stripe < 2; stripe += 1) {
        const stripeY = Math.round(height * (0.2 + stripe * 0.57));
        filters.push(drawBox({
          x: `mod((t-${start})*${Math.round(width * (0.78 + stripe * 0.12))}+${stripe * 317},${width + 240})-120`,
          y: stripeY,
          w: Math.round(width * (0.12 + stripe * 0.04)),
          h: Math.max(3, unit / 2),
          color: `${stripe === 0 ? palette.contrast : palette.secondary}@0.62`,
          thickness: Math.max(3, unit / 2),
          enable: active,
        }));
      }

      for (let particle = 0; particle < 3; particle += 1) {
        const particleSize = Math.max(34, Math.round(height * (particle === 0 ? 0.052 : 0.034)));
        filters.push(drawText({
          text: particle === 0 ? "●" : "○",
          x: `${Math.round(width * 0.1)}+${Math.round(width * 0.74)}*min(max((t-${start})/${Math.max(0.5, duration - 0.08).toFixed(3)},0),1)`,
          y: `${Math.round(height * (0.17 + particle * 0.11))}+${Math.round(height * 0.035)}*sin((t-${start})*7+${particle})`,
          size: particleSize,
          color: particle === 0 ? palette.contrast : palette.secondary,
          enable: active,
        }));
      }

      if (beat.motif === "market") {
        addStepChart({
          filters,
          width,
          height,
          start: segmentStart,
          end: segmentEnd,
          color: palette.primary,
          nodeColor: palette.contrast,
          variant: layout,
          text: beat.text,
        });
        const tokenY = Math.round(height * 0.14);
        for (let token = 0; token < 4; token += 1) {
          filters.push(drawText({
            text: token % 2 === 0 ? "●" : "◉",
            x: `mod((t-${start})*${Math.round(width * (0.52 + token * 0.08))}+${token * 270},${width + 120})-60`,
            y: `${tokenY + Math.round((token % 3) * height * 0.13)}+${Math.round(height * 0.035)}*sin((t-${start})*5+${token})`,
            size: Math.max(30, unit * (4 + token % 2)),
            color: token % 2 ? palette.contrast : palette.secondary,
            enable: active,
          }));
        }
      } else if (beat.motif === "network") {
        addNetworkGraph({
          filters,
          width,
          height,
          start: segmentStart,
          end: segmentEnd,
          accent: palette.primary,
          highlight: palette.contrast,
          variant: layout,
        });
      } else if (beat.motif === "record") {
        const ledgerX = Math.round(width * (layout % 2 === 0 ? 0.56 : 0.08));
        const ledgerY = Math.round(height * 0.15);
        const ledgerWidth = Math.round(width * 0.34);
        for (let row = 0; row < 5; row += 1) {
          addGrowingLine(filters, {
            x: ledgerX + Math.round(width * (row % 2 === 0 ? 0 : 0.05)),
            y: ledgerY + Math.round(height * row * 0.065),
            width: Math.round(ledgerWidth * (row % 2 === 0 ? 1 : 0.72)),
            height: row === 0 ? Math.max(5, unit) : Math.max(3, unit / 2),
            color: row === 0 ? palette.contrast : palette.primary,
            start: segmentStart,
            end: segmentEnd,
            delay: 0.12 + row * 0.13,
            revealSeconds: 0.3,
          });
        }
        filters.push(
          drawBox({
            x: ledgerX + Math.round(ledgerWidth * 0.82),
            y: `${ledgerY}+mod((t-${start})*${Math.max(90, Math.round(height * 0.5))},${Math.round(height * 0.25)})`,
            w: Math.max(10, unit * 2),
            h: Math.max(10, unit * 2),
            color: palette.contrast,
            enable: active,
          }),
          drawText({
            text: "▤",
            x: ledgerX + Math.round(ledgerWidth * 0.62),
            y: `${ledgerY - Math.round(height * 0.08)}+sin((t-${start})*5)*${Math.round(height * 0.012)}`,
            size: Math.max(38, Math.round(height * 0.1)),
            color: palette.secondary,
            enable: active,
          }),
        );
      } else if (beat.motif === "timeline") {
        const lineX = Math.round(width * 0.1);
        const lineW = Math.round(width * 0.8);
        const lineY = Math.round(height * (layout % 2 === 0 ? 0.36 : 0.32));
        addGrowingLine(filters, {
          x: lineX,
          y: lineY,
          width: lineW,
          height: Math.max(4, unit / 2),
          color: palette.primary,
          start: segmentStart,
          end: segmentEnd,
          delay: 0.1,
          revealSeconds: Math.min(0.82, Math.max(0.3, duration * 0.52)),
        });
        for (let marker = 0; marker < 5; marker += 1) {
          const x = lineX + Math.round(lineW * marker / 4);
          filters.push(drawText({
            text: marker === 4 ? "◉" : "○",
            x: x - Math.round(unit * 3),
            y: `${lineY - Math.round(unit * 4)}+sin((t-${start})*6+${marker})*${Math.round(height * 0.012)}`,
            size: Math.max(30, unit * 7),
            color: marker === 4 ? palette.contrast : palette.primary,
            enable: `gte(t,${(segmentStart + 0.12 + marker * 0.14).toFixed(3)})*lt(t,${end})`,
          }));
        }
        filters.push(drawBox({
          x: `${lineX}+${lineW}*min(max((t-${(segmentStart + 0.12).toFixed(3)})/${Math.max(0.5, duration - 0.16).toFixed(3)},0),1)`,
          y: lineY - unit,
          w: unit * 2,
          h: unit * 2,
          color: palette.contrast,
          enable: active,
        }));
      } else if (beat.motif === "risk") {
        const x = Math.round(width * (layout % 2 === 0 ? 0.64 : 0.12));
        const y = Math.round(height * 0.12);
        const iconSize = Math.round(Math.min(width, height) * 0.23);
        filters.push(
          drawText({
            text: "△",
            x: `${x}+sin((t-${start})*4)*${Math.round(width * 0.012)}`,
            y: `${y}+sin((t-${start})*5)*${Math.round(height * 0.015)}`,
            size: iconSize,
            color: palette.primary,
            enable: active,
          }),
          drawText({
            text: "!",
            x: x + Math.round(height * 0.052),
            y: y + Math.round(height * 0.055),
            size: Math.round(height * 0.12),
            color: palette.contrast,
            enable: active,
          }),
          drawBox({ x: x - unit * 3, y: y + Math.round(height * 0.28), w: Math.round(height * 0.22), h: Math.max(4, unit), color: palette.contrast, enable: active }),
        );
      } else if (beat.motif === "access") {
        const x = Math.round(width * (layout % 2 === 0 ? 0.64 : 0.12));
        const y = Math.round(height * 0.12);
        const size = Math.round(Math.min(width, height) * 0.24);
        filters.push(
          drawText({
            text: "◎",
            x: `${x}+sin((t-${start})*4)*${Math.round(width * 0.01)}`,
            y: `${y}+sin((t-${start})*5)*${Math.round(height * 0.014)}`,
            size,
            color: palette.primary,
            enable: active,
          }),
          drawBox({ x: x + Math.round(size * 0.2), y: y + Math.round(size * 0.68), w: Math.round(size * 0.58), h: Math.round(size * 0.38), color: palette.primary, thickness: Math.max(4, unit), enable: active }),
          drawBox({ x: x + Math.round(size * 0.4), y: y + Math.round(size * 0.78), w: Math.max(4, unit), h: Math.round(size * 0.18), color: palette.contrast, enable: active }),
          drawText({ text: "●", x: `${x}+mod((t-${start})*${Math.max(90, Math.round(height * 0.65))},${size})`, y: y + Math.round(size * 0.44), size: Math.max(30, unit * 5), color: palette.contrast, enable: active }),
        );
      } else {
        const x = Math.round(width * (layout % 2 === 0 ? 0.63 : 0.12));
        const y = Math.round(height * 0.12);
        const size = Math.round(Math.min(width, height) * 0.24);
        filters.push(
          drawText({
            text: "◉",
            x: `${x}+sin((t-${start})*4)*${Math.round(width * 0.01)}`,
            y: `${y}+sin((t-${start})*5)*${Math.round(height * 0.014)}`,
            size,
            color: palette.primary,
            enable: active,
          }),
          drawText({ text: "●", x: `${x}+${Math.round(size * 0.18)}+${Math.round(size * 0.52)}*${reveal}`, y: y + Math.round(size * 0.2), size: Math.round(size * 0.17), color: palette.contrast, enable: active }),
          drawBox({ x: x + Math.round(size * 0.04), y: y + Math.round(size * 0.72), w: `${Math.round(size * 0.86)}*${reveal}`, h: Math.max(4, unit / 2), color: palette.contrast, enable: active }),
        );
      }
    }
  }
  return filters.join(",");
}