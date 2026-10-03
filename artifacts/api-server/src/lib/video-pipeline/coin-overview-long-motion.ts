type SketchMotif = "market" | "network" | "timeline" | "risk";

function sceneMotif(voiceText: string, sceneIndex: number): SketchMotif {
  const text = voiceText.toLocaleLowerCase("ru-RU");
  if (/риск|угроз|уязв|ограничен|проблем|конкурен|неопредел|осторож/.test(text)) return "risk";
  if (/истори|основан|создан|запуск|появил|начал|этап|год/.test(text)) return "timeline";
  if (/сеть|блокчейн|протокол|транзакц|валидатор|смарт.?контракт|инфраструктур/.test(text)) return "network";
  if (/цена|курс|рынок|динамик|капитализац|объём|ликвид|волатил|график/.test(text)) return "market";
  return (["network", "market", "timeline", "risk"] as const)[sceneIndex % 4]!;
}

function drawBox(input: {
  x: string | number;
  y: string | number;
  w: string | number;
  h: string | number;
  color: string;
  thickness?: number | "fill";
  enable?: string;
}): string {
  const x = typeof input.x === "number" ? input.x : `'${input.x}'`;
  const y = typeof input.y === "number" ? input.y : `'${input.y}'`;
  const w = typeof input.w === "number" ? input.w : `'${input.w}'`;
  const h = typeof input.h === "number" ? input.h : `'${input.h}'`;
  const enable = input.enable ? `:enable='${input.enable}'` : "";
  return `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${input.color}:t=${input.thickness ?? "fill"}${enable}`;
}

function sketchPoints(motif: SketchMotif, flip: boolean): Array<[number, number]> {
  const points: Record<SketchMotif, Array<[number, number]>> = {
    market: [[0.04, 0.62], [0.21, 0.34], [0.38, 0.51], [0.56, 0.27], [0.75, 0.47], [0.96, 0.30]],
    network: [[0.08, 0.68], [0.25, 0.25], [0.47, 0.54], [0.69, 0.20], [0.91, 0.63]],
    timeline: [[0.04, 0.48], [0.25, 0.48], [0.47, 0.48], [0.70, 0.48], [0.96, 0.48]],
    risk: [[0.04, 0.30], [0.23, 0.59], [0.43, 0.40], [0.65, 0.67], [0.96, 0.46]],
  };
  return points[motif].map(([x, y]) => [flip ? 1 - x : x, y]);
}

function escapeExpressionComma(value: string): string {
  return value.replaceAll(",", "\\,");
}

export function buildCoinOverviewLongSceneClipDurations(input: {
  sceneIds: number[];
  voices: Array<{ sceneId: number; startTime: number | null; endTime: number | null }>;
  durationMs: number;
  transitionDurationMs: number;
}): number[] {
  const durationMs = normalizeDuration(input.durationMs, input.sceneIds.length > 0);
  if (!input.sceneIds.length) return [];
  const sceneStarts = buildCoinOverviewLongSceneStarts(input.sceneIds, input.voices, durationMs);

  const transitionDurationMs = Math.max(0, input.transitionDurationMs);
  return sceneStarts.map((sceneStart, index) => {
    const sceneEnd = sceneStarts[index + 1] ?? durationMs;
    const sceneSpanMs = Math.max(1, sceneEnd - sceneStart);
    return sceneSpanMs + (index < sceneStarts.length - 1 ? transitionDurationMs : 0);
  });
}

export function buildCoinOverviewLongRenderChunks(input: {
  sceneIds: number[];
  voices: Array<{ sceneId: number; startTime: number | null; endTime: number | null }>;
  durationMs: number;
  targetDurationMs?: number;
}): Array<{ startMs: number; endMs: number }> {
  const durationMs = normalizeDuration(input.durationMs, input.sceneIds.length > 0);
  if (!input.sceneIds.length) return [{ startMs: 0, endMs: durationMs }];

  const targetDurationMs = Math.max(1, Math.round(input.targetDurationMs ?? 120_000));
  const sceneStarts = buildCoinOverviewLongSceneStarts(input.sceneIds, input.voices, durationMs);
  const voiceEnds = new Map(input.voices.map((voice) => [voice.sceneId, voice.endTime]));
  const safeSceneBoundaries = sceneStarts.filter((sceneStart, index) => {
    if (index === 0) return false;
    const previousSceneEnd = voiceEnds.get(input.sceneIds[index - 1]!);
    return previousSceneEnd !== null
      && previousSceneEnd !== undefined
      && Number.isFinite(previousSceneEnd)
      && previousSceneEnd <= sceneStart;
  });
  const boundaries = [0];
  let chunkStartMs = 0;

  while (chunkStartMs + targetDurationMs < durationMs) {
    const targetMs = chunkStartMs + targetDurationMs;
    const candidates = safeSceneBoundaries.filter((startMs) =>
      startMs > chunkStartMs
      && startMs < durationMs
      && startMs >= chunkStartMs + targetDurationMs * 0.75
      && startMs <= chunkStartMs + targetDurationMs * 1.25,
    );
    const nextBoundary = candidates.length
      ? candidates.reduce((closest, candidate) =>
        Math.abs(candidate - targetMs) < Math.abs(closest - targetMs) ? candidate : closest,
      )
      : safeSceneBoundaries.find((startMs) => startMs > targetMs && startMs < durationMs)
        ?? safeSceneBoundaries.filter((startMs) => startMs > chunkStartMs && startMs < targetMs).at(-1);

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

function normalizeDuration(durationMs: number, validate: boolean): number {
  if (!validate) return Math.max(1, Math.round(durationMs || 1));
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("Coin overview render duration must be a positive number");
  }
  return Math.max(1, Math.round(durationMs));
}

function buildCoinOverviewLongSceneStarts(
  sceneIds: number[],
  voices: Array<{ sceneId: number; startTime: number | null; endTime: number | null }>,
  durationMs: number,
): number[] {
  const voiceStarts = new Map<number, number>();
  for (const voice of voices) {
    if (voice.startTime !== null && Number.isFinite(voice.startTime)) {
      voiceStarts.set(voice.sceneId, Number(voice.startTime));
    }
  }
  const sceneStarts: number[] = [];
  let previousStart = 0;
  for (const [index, sceneId] of sceneIds.entries()) {
    const voiceStart = voiceStarts.get(sceneId);
    if (voiceStart === undefined) {
      throw new Error(`Coin overview visual scene ${sceneId} has no voice start time`);
    }
    if (index > 0 && voiceStart < previousStart) {
      throw new Error(`Coin overview voice timeline is out of order at scene ${sceneId}`);
    }
    const latestSafeStart = Math.max(previousStart, durationMs - 1);
    const sceneStart = index === 0
      ? 0
      : Math.max(previousStart, Math.min(latestSafeStart, voiceStart));
    sceneStarts.push(sceneStart);
    previousStart = sceneStart;
  }
  return sceneStarts;
}

export function buildCoinOverviewLongMotionGraphics(input: {
  width: number;
  height: number;
  durationSeconds: number;
  voiceText: string;
  sceneIndex: number;
}): string {
  const { width, height, durationSeconds, voiceText, sceneIndex } = input;
  const motif = sceneMotif(voiceText, sceneIndex);
  const flip = sceneIndex % 2 === 1;
  const boxWidth = Math.round(width * 0.235);
  const boxHeight = Math.round(height * 0.19);
  const boxX = Math.round(width * (flip ? 0.075 : 0.685));
  const boxY = Math.round(height * 0.245);
  const cycleSeconds = 9;
  const revealEnd = 4.7;
  const phase = `mod(t,${cycleSeconds})`;
  const visibleAfter = (start: number) =>
    `gte(${escapeExpressionComma(phase)},${start.toFixed(2)})*lt(${escapeExpressionComma(phase)},${revealEnd})`;
  const accent = motif === "timeline" ? "0xe6bd70@0.66" : "0x70dec8@0.62";
  const muted = "0xece6d8@0.21";
  const filters = [
    drawBox({
      x: 0,
      y: 10,
      w: `${width}*min(t/${Math.max(1, durationSeconds).toFixed(3)},1)`,
      h: 2,
      color: "0xd8ad4b@0.75",
    }),
    drawBox({
      x: `${boxX}+mod(t*${Math.max(1, Math.round(boxWidth / 3.2))},${boxWidth})`,
      y: boxY,
      w: 2,
      h: boxHeight,
      color: "0x76e3cf@0.25",
      enable: `lt(${escapeExpressionComma(`mod(t,6.5)`)},3.4)`,
    }),
    drawBox({
      x: boxX,
      y: boxY,
      w: boxWidth,
      h: 2,
      color: muted,
      thickness: 2,
      enable: visibleAfter(0),
    }),
    drawBox({
      x: boxX,
      y: boxY + boxHeight,
      w: boxWidth,
      h: 2,
      color: muted,
      thickness: 2,
      enable: visibleAfter(0),
    }),
  ];

  const points = sketchPoints(motif, flip).map(([x, y]) => [
    boxX + Math.round(x * boxWidth),
    boxY + Math.round(y * boxHeight),
  ] as const);
  const revealStep = Math.min(0.55, 2.5 / points.length);
  for (let index = 1; index < points.length; index += 1) {
    const [previousX, previousY] = points[index - 1]!;
    const [nextX, nextY] = points[index]!;
    const revealAt = (index - 1) * revealStep;
    const enabled = visibleAfter(revealAt);
    const left = Math.min(previousX, nextX);
    const top = Math.min(previousY, nextY);
    filters.push(
      drawBox({
        x: left,
        y: previousY,
        w: Math.max(2, Math.abs(nextX - previousX)),
        h: 2,
        color: accent,
        enable: enabled,
      }),
      drawBox({
        x: nextX,
        y: top,
        w: 2,
        h: Math.max(2, Math.abs(nextY - previousY)),
        color: accent,
        enable: enabled,
      }),
    );
  }

  points.forEach(([x, y], index) => {
    filters.push(drawBox({
      x: x - 4,
      y: y - 4,
      w: 8,
      h: 8,
      color: index === points.length - 1 ? "0xe6bd70@0.82" : accent,
      enable: visibleAfter(index * revealStep),
    }));
  });

  return filters.join(",");
}

export function buildCoinOverviewLongCameraFilter(input: {
  width: number;
  height: number;
  frames: number;
  sceneIndex: number;
}): string {
  const { width, height, frames, sceneIndex } = input;
  const progress = `min(on/${Math.max(1, frames - 1)},1)`;
  const zoom = sceneIndex % 2 === 0
    ? `1.03+0.065*${progress}`
    : `1.095-0.065*${progress}`;
  const panDirection = sceneIndex % 4 < 2 ? 1 : -1;
  const verticalDirection = sceneIndex % 2 === 0 ? -1 : 1;
  const panPhase = Math.max(75, Math.round(frames * 0.72));
  return `zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)+(${panDirection})*sin(on/${panPhase})*iw*0.014'` +
    `:y='ih/2-(ih/zoom/2)+(${verticalDirection})*sin(on/${panPhase})*ih*0.009':d=${frames}:s=${width}x${height}:fps=30`;
}