import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  parseChainlinkEditorialBlueprint,
  type ChainlinkEditorialBlueprint,
} from "./chainlink-editorial-blueprints";

const execFileAsync = promisify(execFile);

const C = {
  blue: "0x18c7e8",
  blueDim: "0x18c7e8@0.28",
  green: "0x55d49b",
  greenDim: "0x55d49b@0.3",
  red: "0xff5968",
  redDim: "0xff5968@0.3",
  white: "0xeaf0f4",
  muted: "0x8796a6",
  grid: "0x344252@0.24",
  panel: "0x0d141d@0.92",
  panelSoft: "0x111b26@0.84",
  dark: "0x05090f",
} as const;

type VoiceTiming = {
  sceneId: number;
  startTime: number | null;
  endTime: number | null;
  text: string;
  isFullVoice?: boolean;
};

type SceneVisualDescription = { sceneId: number; description: string };

type Phase = { start: number; end: number; label: string };

type SceneContext = {
  width: number;
  height: number;
  sceneStart: number;
  sceneEnd: number;
  phases: Phase[];
  blueprint: ChainlinkEditorialBlueprint;
  filters: string[];
};

type VisualChunkInput = {
  width: number;
  height: number;
  frameRate: 30 | 60;
  voices: VoiceTiming[];
  sceneVisualDescriptions: SceneVisualDescription[];
  durationMs: number;
  chunkStartMs: number;
  chunkEndMs: number;
};

type RenderInput = Omit<VisualChunkInput, "chunkStartMs" | "chunkEndMs"> & {
  dir: string;
  frameRate: 30 | 60;
};

type SceneInterval = {
  sceneId: number;
  startMs: number;
  endMs: number;
  blueprint: ChainlinkEditorialBlueprint;
};

function ff(value: string): string {
  return `'${value
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll(",", "\\,")
    .replaceAll(":", "\\:")}'`;
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
  return `drawbox=x=${ff(String(input.x))}:y=${ff(String(input.y))}` +
    `:w=${ff(String(input.w))}:h=${ff(String(input.h))}` +
    `:color=${input.color}:t=${input.thickness ?? "fill"}:enable=${ff(input.enable)}`;
}

function drawText(input: {
  text: string;
  x: string | number;
  y: string | number;
  size: number;
  color: string;
  enable: string;
  align?: "left" | "center";
}): string {
  const safeText = input.text
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll(":", "\\:");
  const x = input.align === "center"
    ? `(${input.x})-text_w/2`
    : String(input.x);
  return `drawtext=font='DejaVu Sans':text='${safeText}'` +
    `:x=${ff(x)}:y=${ff(String(input.y))}:fontsize=${input.size}` +
    `:fontcolor=${input.color}:expansion=none:borderw=0:shadowcolor=black@0.55` +
    `:shadowx=3:shadowy=3:enable=${ff(input.enable)}`;
}

function enabledFrom(stepStart: number, sceneEnd: number): string {
  return `gte(t,${stepStart.toFixed(3)})*lt(t,${sceneEnd.toFixed(3)})`;
}

function revealAt(stepStart: number): string {
  return `min(max((t-${stepStart.toFixed(3)})/0.42,0),1)`;
}

function px(context: SceneContext, value: number): number {
  return Math.round(context.width * value);
}

function py(context: SceneContext, value: number): number {
  return Math.round(context.height * value);
}

function colorFor(context: SceneContext): string {
  if (context.blueprint.layout === "data-risk") return C.red;
  if (context.blueprint.layout === "scenarios") return C.green;
  return C.blue;
}

function phaseStart(context: SceneContext, step: number): number {
  return context.phases[Math.min(step, context.phases.length - 1)]!.start;
}

function phaseEnable(context: SceneContext, step: number): string {
  const phase = context.phases[Math.min(step, context.phases.length - 1)]!;
  return `gte(t,${phase.start.toFixed(3)})*lt(t,${phase.end.toFixed(3)})`;
}

function addRule(
  context: SceneContext,
  x: number,
  y: number,
  width: number,
  step: number,
  color: string = C.blue,
  height = 4,
): void {
  const start = phaseStart(context, step);
  context.filters.push(drawBox({
    x,
    y,
    w: `${width}*${revealAt(start)}`,
    h: height,
    color,
    enable: enabledFrom(start, context.sceneEnd),
  }));
}

function addVerticalRule(
  context: SceneContext,
  x: number,
  y: number,
  height: number,
  step: number,
  color: string = C.blue,
  width = 4,
): void {
  const start = phaseStart(context, step);
  context.filters.push(drawBox({
    x,
    y,
    w: width,
    h: `${height}*${revealAt(start)}`,
    color,
    enable: enabledFrom(start, context.sceneEnd),
  }));
}

function addCard(
  context: SceneContext,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  step: number,
  accent: string = colorFor(context),
): void {
  const start = phaseStart(context, step);
  const reveal = revealAt(start);
  const slide = Math.round(context.width * 0.012);
  const animatedX = `${x}+${slide}*(1-${reveal})`;
  const enable = enabledFrom(start, context.sceneEnd);
  const textSize = Math.max(22, Math.min(34, Math.floor((width * 0.82) / Math.max(7, label.length * 0.62))));
  context.filters.push(
    drawBox({ x: animatedX, y, w: width, h: height, color: C.panel, enable }),
    drawBox({ x: animatedX, y, w: width, h: height, color: C.muted, thickness: 2, enable }),
    drawBox({ x: animatedX, y, w: 5, h: height, color: accent, enable }),
    drawText({
      text: label,
      x: `(${animatedX})+(${width}-text_w)/2`,
      y: y + Math.round(height * 0.37),
      size: textSize,
      color: C.white,
      enable,
    }),
  );
}

function addText(
  context: SceneContext,
  label: string,
  x: number,
  y: number,
  step: number,
  color: string = C.white,
  size = 30,
): void {
  const start = phaseStart(context, step);
  context.filters.push(drawText({
    text: label,
    x: `${x}+${Math.round(context.width * 0.01)}*(1-${revealAt(start)})`,
    y,
    size,
    color,
    enable: enabledFrom(start, context.sceneEnd),
  }));
}

function addPacket(
  context: SceneContext,
  xStart: number,
  xEnd: number,
  y: number,
  label: string,
  step: number,
  color: string = C.blue,
): void {
  const phase = context.phases[Math.min(step, context.phases.length - 1)]!;
  const boxW = px(context, 0.1);
  const boxH = py(context, 0.052);
  const progress = `min(max((t-${phase.start.toFixed(3)})/${Math.max(0.1, phase.end - phase.start).toFixed(3)},0),1)`;
  const x = `${xStart}+(${xEnd - xStart})*${progress}`;
  const enable = `gte(t,${phase.start.toFixed(3)})*lt(t,${phase.end.toFixed(3)})`;
  context.filters.push(
    drawBox({ x, y, w: boxW, h: boxH, color: C.panelSoft, enable }),
    drawBox({ x, y, w: boxW, h: boxH, color, thickness: 2, enable }),
    drawText({
      text: label,
      x: `(${x})+(${boxW}-text_w)/2`,
      y: y + Math.round(boxH * 0.26),
      size: Math.max(20, Math.round(context.height * 0.023)),
      color: C.white,
      enable,
    }),
  );
}

function addPhaseHeader(context: SceneContext, sceneId: number): void {
  const accent = colorFor(context);
  const titleSize = Math.round(context.height * 0.043);
  const titleY = py(context, 0.07);
  context.filters.push(
    drawText({
      text: context.blueprint.title,
      x: px(context, 0.075),
      y: titleY,
      size: titleSize,
      color: C.white,
      enable: enabledFrom(context.sceneStart, context.sceneEnd),
    }),
    drawText({
      text: String(sceneId).padStart(2, "0"),
      x: px(context, 0.925),
      y: titleY,
      size: Math.round(context.height * 0.032),
      color: accent,
      enable: enabledFrom(context.sceneStart, context.sceneEnd),
    }),
  );
  addRule(context, px(context, 0.075), py(context, 0.135), px(context, 0.85), 0, C.grid, 2);

  context.phases.forEach((phase, index) => {
    const markerW = px(context, 0.032);
    const markerGap = px(context, 0.008);
    const x = px(context, 0.075) + index * (markerW + markerGap);
    const enable = phaseEnable(context, index);
    context.filters.push(
      drawBox({ x, y: py(context, 0.155), w: markerW, h: 5, color: C.grid, enable: enabledFrom(context.sceneStart, context.sceneEnd) }),
      drawBox({ x, y: py(context, 0.155), w: markerW, h: 5, color: accent, enable }),
      drawText({
        text: phase.label,
        x: px(context, 0.075),
        y: py(context, 0.825),
        size: Math.round(context.height * 0.029),
        color: index === context.phases.length - 1 && context.blueprint.layout === "data-risk" ? C.red : C.white,
        enable,
      }),
    );
  });
}

function addGrid(filters: string[], width: number, height: number, start: number, end: number): void {
  const enable = `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`;
  for (let index = 1; index < 10; index += 1) {
    filters.push(drawBox({
      x: Math.round(width * index / 10),
      y: Math.round(height * 0.19),
      w: 1,
      h: Math.round(height * 0.65),
      color: C.grid,
      enable,
    }));
  }
  for (let index = 1; index < 5; index += 1) {
    filters.push(drawBox({
      x: Math.round(width * 0.055),
      y: Math.round(height * (0.2 + index * 0.13)),
      w: Math.round(width * 0.89),
      h: 1,
      color: C.grid,
      enable,
    }));
  }
  filters.push(drawBox({
    x: `mod(t*14,${width})`,
    y: Math.round(height * 0.19),
    w: 2,
    h: Math.round(height * 0.65),
    color: C.blueDim,
    enable,
  }));
}

function drawSplitLedger(c: SceneContext): void {
  const accent = C.blue;
  const leftX = px(c, 0.095);
  const rightX = px(c, 0.69);
  const cardW = px(c, 0.2);
  const cardH = py(c, 0.1);
  const rows = [0.3, 0.47, 0.64];
  c.blueprint.labels.slice(0, 3).forEach((label, i) => {
    addCard(c, leftX, py(c, rows[i]!), cardW, cardH, label, i, C.muted);
    addRule(c, leftX + cardW, py(c, rows[i]! + 0.048), px(c, 0.1), i, accent, 4);
    addCard(c, rightX, py(c, rows[i]!), cardW, cardH, i < 2 ? "ТОКЕН" : "СЕТЬ", Math.min(3, i + 1), accent);
  });
  addVerticalRule(c, px(c, 0.55), py(c, 0.27), py(c, 0.49), 2, accent, 5);
  addText(c, "ТРАДИЦИОННЫЕ ФИНАНСЫ", leftX, py(c, 0.23), 0, C.muted, 24);
  addText(c, "ОНЧЕЙН", rightX, py(c, 0.23), 2, accent, 26);
}

function drawIsolatedNetwork(c: SceneContext): void {
  const left = px(c, 0.12);
  const boxX = px(c, 0.53);
  const boxY = py(c, 0.29);
  const boxW = px(c, 0.33);
  const boxH = py(c, 0.43);
  c.filters.push(
    drawBox({ x: boxX, y: boxY, w: boxW, h: boxH, color: C.panelSoft, thickness: 3, enable: enabledFrom(c.sceneStart, c.sceneEnd) }),
    drawBox({ x: boxX + Math.round(boxW * 0.15), y: boxY + Math.round(boxH * 0.28), w: Math.round(boxW * 0.7), h: Math.round(boxH * 0.42), color: C.blueDim, thickness: 3, enable: enabledFrom(phaseStart(c, 0), c.sceneEnd) }),
  );
  addText(c, "БЛОКЧЕЙН", boxX + 20, boxY + 24, 0, C.muted, 25);
  addCard(c, boxX + Math.round(boxW * 0.22), boxY + Math.round(boxH * 0.39), Math.round(boxW * 0.56), Math.round(boxH * 0.18), c.blueprint.labels[0]!, 0);
  addCard(c, left, py(c, 0.45), px(c, 0.22), py(c, 0.13), c.blueprint.labels[1]!, 1, C.muted);
  addRule(c, left + px(c, 0.22), py(c, 0.515), boxX - left - px(c, 0.22), 2, C.blue, 5);
  addCard(c, px(c, 0.37), py(c, 0.39), px(c, 0.13), py(c, 0.12), c.blueprint.labels[2]!, 2);
  addCard(c, px(c, 0.7), py(c, 0.78), px(c, 0.12), py(c, 0.075), c.blueprint.labels[3]!, 3, C.white);
}

function drawOracleFlow(c: SceneContext): void {
  const y = [0.34, 0.49, 0.64];
  c.blueprint.labels.slice(0, 3).forEach((label, i) => {
    addCard(c, px(c, 0.08), py(c, y[i]!), px(c, 0.18), py(c, 0.095), label, i, C.muted);
    addRule(c, px(c, 0.26), py(c, y[i]! + 0.045), px(c, 0.17), i, C.blue, 4);
  });
  addCard(c, px(c, 0.43), py(c, 0.43), px(c, 0.2), py(c, 0.16), c.blueprint.labels[3]!, 1, C.blue);
  addRule(c, px(c, 0.63), py(c, 0.51), px(c, 0.12), 2, C.blue, 5);
  addCard(c, px(c, 0.75), py(c, 0.45), px(c, 0.17), py(c, 0.13), c.blueprint.labels[4]!, 3, C.white);
  addPacket(c, px(c, 0.62), px(c, 0.75), py(c, 0.39), "DATA", 2);
}

function drawDataRisk(c: SceneContext): void {
  addCard(c, px(c, 0.08), py(c, 0.34), px(c, 0.18), py(c, 0.12), c.blueprint.labels[0]!, 0, C.muted);
  addCard(c, px(c, 0.39), py(c, 0.29), px(c, 0.19), py(c, 0.12), c.blueprint.labels[1]!, 1, C.blue);
  addCard(c, px(c, 0.72), py(c, 0.34), px(c, 0.18), py(c, 0.12), c.blueprint.labels[2]!, 2, C.white);
  addRule(c, px(c, 0.26), py(c, 0.4), px(c, 0.13), 1, C.blue);
  addRule(c, px(c, 0.58), py(c, 0.4), px(c, 0.14), 2, C.blue);
  addVerticalRule(c, px(c, 0.66), py(c, 0.3), py(c, 0.2), 3, C.red, 5);
  addCard(c, px(c, 0.45), py(c, 0.61), px(c, 0.18), py(c, 0.09), c.blueprint.labels[3]!, 3, C.red);
  addText(c, "ПРОВЕРКА СИГНАЛА", px(c, 0.39), py(c, 0.25), 1, C.muted, 24);
}

function drawCcipBridge(c: SceneContext): void {
  const left = px(c, 0.08);
  const right = px(c, 0.76);
  const y = py(c, 0.4);
  const boxW = px(c, 0.18);
  const boxH = py(c, 0.22);
  addCard(c, left, y, boxW, boxH, c.blueprint.labels[0]!, 0, C.muted);
  addCard(c, right, y, boxW, boxH, c.blueprint.labels[2]!, 0, C.muted);
  addRule(c, left + boxW, y + Math.round(boxH * 0.48), right - left - boxW, 1, C.blue, 7);
  addText(c, c.blueprint.labels[1]!, px(c, 0.46), py(c, 0.32), 1, C.blue, 34);
  addPacket(c, left + boxW, right - px(c, 0.1), py(c, 0.35), c.blueprint.labels[3]!, 2);
  addPacket(c, right - px(c, 0.1), left + boxW, py(c, 0.62), c.blueprint.labels[4]!, 3, C.green);
}

function drawNetworkMesh(c: SceneContext): void {
  const positions = [
    [0.13, 0.38], [0.34, 0.62], [0.52, 0.32], [0.72, 0.58], [0.83, 0.35],
  ];
  const labels = c.blueprint.labels;
  const links: Array<[number, number, number]> = [[0, 1, 1], [0, 2, 1], [1, 2, 2], [1, 3, 2], [2, 4, 3], [3, 4, 3]];
  for (const [from, to, step] of links) {
    const [x1, y1] = positions[from]!;
    const [x2, y2] = positions[to]!;
    const color = step === 3 ? C.green : C.blue;
    addRule(c, px(c, x1), py(c, Math.min(y1, y2) + 0.055), px(c, x2 - x1), step, color, 4);
    if (Math.abs(y1 - y2) > 0.08) {
      addVerticalRule(c, px(c, x1 + (x2 - x1) * 0.42), py(c, Math.min(y1, y2) + 0.05), py(c, Math.abs(y2 - y1)), step, color, 4);
    }
  }
  positions.forEach(([x, y], index) => {
    addCard(c, px(c, x), py(c, y), px(c, 0.17), py(c, 0.11), labels[index]!, Math.min(3, index), index === 4 ? C.green : C.blue);
  });
}

function drawTimeline(c: SceneContext): void {
  const x0 = px(c, 0.12);
  const x1 = px(c, 0.88);
  const y = py(c, 0.52);
  addRule(c, x0, y, x1 - x0, 0, C.muted, 5);
  addVerticalRule(c, px(c, 0.28), py(c, 0.4), py(c, 0.23), 1, C.blue, 5);
  addVerticalRule(c, px(c, 0.7), py(c, 0.4), py(c, 0.23), 1, C.green, 5);
  addCard(c, px(c, 0.11), py(c, 0.31), px(c, 0.28), py(c, 0.14), c.blueprint.labels[0]!, 1, C.muted);
  addCard(c, px(c, 0.61), py(c, 0.31), px(c, 0.29), py(c, 0.14), c.blueprint.labels[1]!, 2, C.green);
  addCard(c, px(c, 0.15), py(c, 0.66), px(c, 0.28), py(c, 0.095), "ПРОВЕРКИ", 2, C.blue);
  addCard(c, px(c, 0.58), py(c, 0.66), px(c, 0.31), py(c, 0.095), "ИСПОЛНЕНИЕ", 3, C.green);
}

function drawAssetTokenization(c: SceneContext): void {
  const labels = c.blueprint.labels;
  labels.forEach((label, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = px(c, 0.09 + col * 0.21);
    const y = py(c, 0.3 + row * 0.2);
    addCard(c, x, y, px(c, 0.17), py(c, 0.11), label, Math.min(index, 2), C.muted);
    addRule(c, x + px(c, 0.17), y + py(c, 0.05), px(c, 0.1), 2, C.blue);
    addCard(c, px(c, 0.69), y, px(c, 0.21), py(c, 0.11), "ЦИФРОВОЙ ТОКЕН", Math.min(3, index + 1), C.blue);
  });
  addVerticalRule(c, px(c, 0.62), py(c, 0.25), py(c, 0.5), 3, C.green, 5);
  addText(c, "РАЗНЫЕ СЕТИ", px(c, 0.7), py(c, 0.77), 3, C.green, 24);
}

function drawLinkUtility(c: SceneContext): void {
  const centerX = px(c, 0.42);
  const centerY = py(c, 0.43);
  const centerW = px(c, 0.18);
  const centerH = py(c, 0.2);
  addCard(c, centerX, centerY, centerW, centerH, "LINK", 0, C.blue);
  const points = [
    { x: 0.1, y: 0.32, label: c.blueprint.labels[1]! },
    { x: 0.72, y: 0.32, label: c.blueprint.labels[2]! },
    { x: 0.4, y: 0.7, label: c.blueprint.labels[3]! },
  ];
  points.forEach((point, index) => {
    const x = px(c, point.x);
    const y = py(c, point.y);
    if (index === 2) {
      addVerticalRule(c, centerX + Math.round(centerW * 0.5), centerY + centerH, y - centerY - centerH, index + 1, C.blue);
    } else {
      addRule(c, Math.min(x + px(c, 0.17), centerX + centerW), centerY + Math.round(centerH * 0.5), Math.abs(centerX - x - px(c, 0.17)), index + 1, C.blue);
    }
    addCard(c, x, y, px(c, 0.19), py(c, 0.12), point.label, index + 1, index === 2 ? C.green : C.blue);
  });
  addText(c, c.blueprint.labels[0]!, centerX + 5, centerY - py(c, 0.075), 0, C.blue, 24);
}

function drawStakingAbstraction(c: SceneContext): void {
  addVerticalRule(c, px(c, 0.5), py(c, 0.27), py(c, 0.48), 0, C.grid, 2);
  addText(c, "ЭКОНОМИЧЕСКАЯ ГАРАНТИЯ", px(c, 0.1), py(c, 0.27), 0, C.muted, 23);
  addText(c, "ПЛАТЁЖНЫЙ ПОТОК", px(c, 0.57), py(c, 0.27), 0, C.muted, 23);
  addCard(c, px(c, 0.12), py(c, 0.4), px(c, 0.2), py(c, 0.14), "LINK", 0, C.blue);
  addRule(c, px(c, 0.32), py(c, 0.47), px(c, 0.1), 1, C.blue, 5);
  addCard(c, px(c, 0.42), py(c, 0.39), px(c, 0.16), py(c, 0.16), c.blueprint.labels[0]!, 1, C.green);
  addVerticalRule(c, px(c, 0.2), py(c, 0.56), py(c, 0.13), 2, C.green, 5);
  addCard(c, px(c, 0.58), py(c, 0.4), px(c, 0.17), py(c, 0.12), c.blueprint.labels[2]!, 2, C.muted);
  addRule(c, px(c, 0.75), py(c, 0.46), px(c, 0.1), 3, C.blue, 5);
  addCard(c, px(c, 0.82), py(c, 0.4), px(c, 0.12), py(c, 0.12), "LINK", 3, C.blue);
  addPacket(c, px(c, 0.58), px(c, 0.82), py(c, 0.6), "PAY", 3, C.green);
}

function drawReserveFlow(c: SceneContext): void {
  addCard(c, px(c, 0.1), py(c, 0.32), px(c, 0.22), py(c, 0.13), c.blueprint.labels[0]!, 0, C.muted);
  addCard(c, px(c, 0.1), py(c, 0.59), px(c, 0.22), py(c, 0.13), c.blueprint.labels[1]!, 1, C.muted);
  addRule(c, px(c, 0.32), py(c, 0.385), px(c, 0.18), 1, C.blue, 5);
  addRule(c, px(c, 0.32), py(c, 0.655), px(c, 0.18), 2, C.green, 5);
  addVerticalRule(c, px(c, 0.5), py(c, 0.385), py(c, 0.27), 2, C.blue, 5);
  addCard(c, px(c, 0.62), py(c, 0.42), px(c, 0.24), py(c, 0.23), c.blueprint.labels[3]!, 3, C.green);
  addText(c, "LINK", px(c, 0.7), py(c, 0.7), 3, C.white, 28);
}

function drawInfrastructureStack(c: SceneContext): void {
  const labels = c.blueprint.labels;
  labels.forEach((label, index) => {
    const y = py(c, 0.26 + index * 0.105);
    const offset = index % 2 === 0 ? 0 : px(c, 0.07);
    addCard(c, px(c, 0.18) + offset, y, px(c, 0.56), py(c, 0.075), label, Math.min(index, c.phases.length - 1), index === labels.length - 1 ? C.green : C.blue);
    addRule(c, px(c, 0.78) + offset, y + py(c, 0.035), px(c, 0.08), Math.min(index + 1, c.phases.length - 1), C.blue, 3);
  });
  addVerticalRule(c, px(c, 0.12), py(c, 0.28), py(c, 0.46), 2, C.green, 5);
}

function drawCompetition(c: SceneContext): void {
  addText(c, c.blueprint.labels[0]!, px(c, 0.17), py(c, 0.28), 0, C.blue, 28);
  addText(c, c.blueprint.labels[1]!, px(c, 0.64), py(c, 0.28), 0, C.muted, 28);
  addCard(c, px(c, 0.12), py(c, 0.38), px(c, 0.32), py(c, 0.21), "ORACLES + CCIP", 1, C.blue);
  addCard(c, px(c, 0.56), py(c, 0.38), px(c, 0.32), py(c, 0.21), "ORACLES + CCIP", 1, C.muted);
  addRule(c, px(c, 0.44), py(c, 0.485), px(c, 0.12), 2, C.red, 5);
  addVerticalRule(c, px(c, 0.5), py(c, 0.35), py(c, 0.35), 2, C.red, 4);
  addCard(c, px(c, 0.16), py(c, 0.68), px(c, 0.26), py(c, 0.1), c.blueprint.labels[2]!, 2, C.green);
  addCard(c, px(c, 0.58), py(c, 0.68), px(c, 0.26), py(c, 0.1), c.blueprint.labels[3]!, 3, C.red);
  addText(c, "НЕ АВТОМАТИЧЕСКИ", px(c, 0.42), py(c, 0.82), 3, C.red, 23);
}

function drawSupply(c: SceneContext): void {
  addVerticalRule(c, px(c, 0.5), py(c, 0.27), py(c, 0.48), 0, C.blue, 5);
  addText(c, c.blueprint.labels[0]!, px(c, 0.12), py(c, 0.38), 1, C.white, Math.round(c.height * 0.075));
  addText(c, c.blueprint.labels[1]!, px(c, 0.57), py(c, 0.43), 2, C.blue, Math.round(c.height * 0.056));
  const count = 12;
  for (let i = 0; i < count; i += 1) {
    const active = i < 7 ? C.blue : C.grid;
    const x = px(c, 0.12 + i * 0.062);
    c.filters.push(drawBox({
      x,
      y: py(c, 0.64),
      w: px(c, 0.047),
      h: py(c, 0.1),
      color: active,
      enable: enabledFrom(phaseStart(c, Math.min(3, Math.floor(i / 3))), c.sceneEnd),
    }));
  }
  addText(c, "МАКСИМАЛЬНОЕ ПРЕДЛОЖЕНИЕ", px(c, 0.12), py(c, 0.77), 3, C.muted, 24);
}

function drawStandardFork(c: SceneContext): void {
  const originX = px(c, 0.15);
  const centerX = px(c, 0.5);
  const forkY = py(c, 0.52);
  addCard(c, originX, py(c, 0.45), px(c, 0.21), py(c, 0.15), c.blueprint.labels[0]!, 0, C.muted);
  addRule(c, originX + px(c, 0.21), forkY, centerX - originX - px(c, 0.21), 1, C.blue);
  addVerticalRule(c, centerX, py(c, 0.32), py(c, 0.4), 2, C.blue, 5);
  addRule(c, centerX, py(c, 0.32), px(c, 0.21), 2, C.green, 5);
  addRule(c, centerX, py(c, 0.7), px(c, 0.21), 3, C.red, 5);
  addCard(c, px(c, 0.71), py(c, 0.25), px(c, 0.23), py(c, 0.14), c.blueprint.labels[1]!, 2, C.green);
  addCard(c, px(c, 0.71), py(c, 0.63), px(c, 0.23), py(c, 0.14), c.blueprint.labels[2]!, 3, C.red);
}

function drawScenarios(c: SceneContext): void {
  const left = px(c, 0.08);
  const right = px(c, 0.53);
  const top = py(c, 0.29);
  const width = px(c, 0.39);
  const height = py(c, 0.46);
  c.filters.push(
    drawBox({ x: left, y: top, w: width, h: height, color: C.panel, enable: enabledFrom(phaseStart(c, 0), c.sceneEnd) }),
    drawBox({ x: left, y: top, w: width, h: height, color: C.green, thickness: 3, enable: enabledFrom(phaseStart(c, 0), c.sceneEnd) }),
    drawBox({ x: right, y: top, w: width, h: height, color: C.panel, enable: enabledFrom(phaseStart(c, 2), c.sceneEnd) }),
    drawBox({ x: right, y: top, w: width, h: height, color: C.red, thickness: 3, enable: enabledFrom(phaseStart(c, 2), c.sceneEnd) }),
  );
  addText(c, c.blueprint.labels[0]!, left + px(c, 0.025), top + py(c, 0.07), 0, C.green, 30);
  addText(c, "ТОКЕНИЗАЦИЯ  ·  СЕТИ  ·  ФИНАНСЫ", left + px(c, 0.025), top + py(c, 0.2), 1, C.white, 22);
  addText(c, c.blueprint.labels[1]!, right + px(c, 0.025), top + py(c, 0.07), 2, C.red, 28);
  addText(c, c.blueprint.labels[2]!, right + px(c, 0.025), top + py(c, 0.2), 3, C.white, 25);
}

function drawInvestmentThesis(c: SceneContext): void {
  addCard(c, px(c, 0.1), py(c, 0.32), px(c, 0.2), py(c, 0.12), c.blueprint.labels[0]!, 0, C.blue);
  addCard(c, px(c, 0.1), py(c, 0.58), px(c, 0.2), py(c, 0.12), c.blueprint.labels[1]!, 1, C.muted);
  addRule(c, px(c, 0.3), py(c, 0.38), px(c, 0.2), 2, C.blue, 5);
  addRule(c, px(c, 0.3), py(c, 0.64), px(c, 0.2), 2, C.green, 5);
  addVerticalRule(c, px(c, 0.5), py(c, 0.38), py(c, 0.26), 2, C.blue, 5);
  addCard(c, px(c, 0.61), py(c, 0.43), px(c, 0.24), py(c, 0.18), c.blueprint.labels[2]!, 3, C.blue);
  addText(c, c.blueprint.labels[3]!, px(c, 0.7), py(c, 0.69), 3, C.white, 32);
}

function drawResearchChecklist(c: SceneContext): void {
  const labels = c.blueprint.labels;
  labels.slice(0, 4).forEach((label, index) => {
    const x = px(c, index % 2 === 0 ? 0.12 : 0.54);
    const y = py(c, index < 2 ? 0.34 : 0.59);
    const step = index;
    c.filters.push(
      drawBox({ x, y, w: px(c, 0.32), h: py(c, 0.15), color: C.panel, enable: enabledFrom(phaseStart(c, step), c.sceneEnd) }),
      drawBox({ x, y, w: px(c, 0.32), h: py(c, 0.15), color: index === 2 ? C.red : C.blue, thickness: 2, enable: enabledFrom(phaseStart(c, step), c.sceneEnd) }),
      drawBox({ x: x + px(c, 0.025), y: y + py(c, 0.044), w: px(c, 0.03), h: py(c, 0.05), color: index === 2 ? C.red : C.green, thickness: 3, enable: enabledFrom(phaseStart(c, step), c.sceneEnd) }),
      drawText({ text: label, x: x + px(c, 0.075), y: y + py(c, 0.052), size: 27, color: C.white, enable: enabledFrom(phaseStart(c, step), c.sceneEnd) }),
    );
  });
}

function drawStoryToUsage(c: SceneContext): void {
  addCard(c, px(c, 0.08), py(c, 0.39), px(c, 0.24), py(c, 0.19), c.blueprint.labels[0]!, 0, C.muted);
  addRule(c, px(c, 0.32), py(c, 0.48), px(c, 0.16), 1, C.blue, 5);
  addCard(c, px(c, 0.48), py(c, 0.39), px(c, 0.17), py(c, 0.19), c.blueprint.labels[1]!, 1, C.blue);
  addRule(c, px(c, 0.65), py(c, 0.48), px(c, 0.11), 2, C.green, 5);
  addCard(c, px(c, 0.76), py(c, 0.39), px(c, 0.17), py(c, 0.19), c.blueprint.labels[2]!, 2, C.green);
  addVerticalRule(c, px(c, 0.24), py(c, 0.61), py(c, 0.12), 3, C.muted, 4);
  addText(c, "ПРОВЕРЯЕМЫЕ ДЕЙСТВИЯ", px(c, 0.35), py(c, 0.72), 3, C.white, 26);
}

function drawFinalNetwork(c: SceneContext): void {
  const nodes = [
    [0.12, 0.34, "ETHEREUM"],
    [0.69, 0.3, "SOLANA"],
    [0.13, 0.65, "АКТИВЫ"],
    [0.69, 0.64, "ФИНАНСЫ"],
  ] as const;
  addCard(c, px(c, 0.4), py(c, 0.43), px(c, 0.2), py(c, 0.17), "CHAINLINK", 1, C.blue);
  nodes.forEach(([x, y, label], index) => {
    const centerY = py(c, 0.515);
    if (index % 2 === 0) {
      addRule(c, px(c, x) + px(c, 0.17), centerY, px(c, 0.11), Math.min(2, index), index === 2 ? C.green : C.blue, 4);
    } else {
      addRule(c, px(c, 0.6), centerY, px(c, x - 0.6), Math.min(2, index), C.blue, 4);
    }
    addCard(c, px(c, x), py(c, y), px(c, 0.17), py(c, 0.11), label, Math.min(2, index), index === 2 ? C.green : C.muted);
  });
  addText(c, "ДАННЫЕ  ·  СООБЩЕНИЯ  ·  АКТИВЫ", px(c, 0.3), py(c, 0.77), 3, C.green, 26);
  addPacket(c, px(c, 0.27), px(c, 0.4), py(c, 0.38), "LINK", 3, C.green);
}

function drawSceneDiagram(context: SceneContext): void {
  switch (context.blueprint.layout) {
    case "split-ledger": drawSplitLedger(context); break;
    case "isolated-network": drawIsolatedNetwork(context); break;
    case "oracle-flow": drawOracleFlow(context); break;
    case "data-risk": drawDataRisk(context); break;
    case "ccip-bridge": drawCcipBridge(context); break;
    case "network-mesh": drawNetworkMesh(context); break;
    case "ccip-timeline": drawTimeline(context); break;
    case "asset-tokenization": drawAssetTokenization(context); break;
    case "link-utility": drawLinkUtility(context); break;
    case "staking-abstraction": drawStakingAbstraction(context); break;
    case "reserve-flow": drawReserveFlow(context); break;
    case "infrastructure-stack": drawInfrastructureStack(context); break;
    case "competition": drawCompetition(context); break;
    case "supply": drawSupply(context); break;
    case "standard-fork": drawStandardFork(context); break;
    case "scenarios": drawScenarios(context); break;
    case "investment-thesis": drawInvestmentThesis(context); break;
    case "research-checklist": drawResearchChecklist(context); break;
    case "story-to-usage": drawStoryToUsage(context); break;
    case "final-network": drawFinalNetwork(context); break;
  }
}

function buildPhases(start: number, end: number, labels: string[]): Phase[] {
  const duration = end - start;
  const count = Math.max(2, Math.ceil(duration / 5.1));
  return Array.from({ length: count }, (_, index) => ({
    start: start + duration * index / count,
    end: start + duration * (index + 1) / count,
    label: labels[Math.round(index * (labels.length - 1) / Math.max(1, count - 1))]!,
  }));
}

function sceneIntervals(
  input: Pick<VisualChunkInput, "durationMs" | "voices" | "sceneVisualDescriptions">,
): SceneInterval[] {
  const descriptions = new Map(input.sceneVisualDescriptions.map(({ sceneId, description }) => [sceneId, description]));
  const voicesByScene = new Map<number, VoiceTiming[]>();
  for (const voice of input.voices) {
    if (voice.isFullVoice || !voice.text.trim()) continue;
    const group = voicesByScene.get(voice.sceneId) ?? [];
    group.push(voice);
    voicesByScene.set(voice.sceneId, group);
  }

  const scenes: SceneInterval[] = [];
  for (const [sceneId, voices] of voicesByScene) {
    const description = descriptions.get(sceneId) ?? "";
    const blueprint = parseChainlinkEditorialBlueprint(description);
    if (!blueprint) {
      throw new Error(`Chainlink editorial blueprint is missing for narrated scene ${sceneId}`);
    }
    const startMs = Math.max(0, Math.round(Math.min(...voices.map((voice) => voice.startTime ?? 0))));
    const endMs = Math.min(
      input.durationMs,
      Math.round(Math.max(...voices.map((voice) => voice.endTime ?? input.durationMs))),
    );
    if (endMs > startMs) scenes.push({ sceneId, startMs, endMs, blueprint });
  }
  return scenes.sort((a, b) => a.startMs - b.startMs || a.sceneId - b.sceneId);
}

export function buildChainlinkEditorialMotionGraphics(input: VisualChunkInput): string {
  const filters: string[] = [];
  const scenes = sceneIntervals(input).filter((scene) =>
    scene.endMs > input.chunkStartMs && scene.startMs < input.chunkEndMs,
  );
  const chunkStart = input.chunkStartMs / 1000;
  const chunkEnd = input.chunkEndMs / 1000;
  addGrid(filters, input.width, input.height, 0, chunkEnd - chunkStart);

  for (const scene of scenes) {
    const start = Math.max(0, scene.startMs - input.chunkStartMs) / 1000;
    const end = Math.min(input.chunkEndMs, scene.endMs) - input.chunkStartMs;
    const sceneEnd = Math.max(start + 0.04, end / 1000);
    const phases = buildPhases(start, sceneEnd, scene.blueprint.steps);
    const context: SceneContext = {
      width: input.width,
      height: input.height,
      sceneStart: start,
      sceneEnd,
      phases,
      blueprint: scene.blueprint,
      filters,
    };
    addPhaseHeader(context, scene.sceneId);
    drawSceneDiagram(context);
  }

  filters.push(
    `zoompan=z='1.007+0.003*sin(on/600)'` +
    `:x='iw/2-(iw/zoom/2)+2*sin(on/800)'` +
    `:y='ih/2-(ih/zoom/2)+2*cos(on/900)'` +
    `:d=1:s=${input.width}x${input.height}:fps=${input.frameRate}`,
  );
  return filters.join(",\n");
}

function buildChunks(durationMs: number, targetMs = 60_000): Array<{ startMs: number; endMs: number }> {
  const chunks: Array<{ startMs: number; endMs: number }> = [];
  for (let startMs = 0; startMs < durationMs; startMs += targetMs) {
    chunks.push({ startMs, endMs: Math.min(durationMs, startMs + targetMs) });
  }
  return chunks;
}

export async function renderChainlinkEditorialVideoOnly(input: RenderInput): Promise<string> {
  const scenes = sceneIntervals(input);
  if (scenes.length !== 20) {
    throw new Error(`Chainlink editorial render expected 20 narrated scenes, found ${scenes.length}`);
  }
  const chunks = buildChunks(input.durationMs);
  const clipFiles: string[] = [];

  for (const [index, chunk] of chunks.entries()) {
    const chunkSeconds = ((chunk.endMs - chunk.startMs) / 1000).toFixed(3);
    const filterPath = join(input.dir, `chainlink-editorial-${index}.filter`);
    const clipPath = join(input.dir, `chainlink-editorial-${index}.mp4`);
    const filter = buildChainlinkEditorialMotionGraphics({
      width: input.width,
      height: input.height,
      frameRate: input.frameRate,
      voices: input.voices,
      sceneVisualDescriptions: input.sceneVisualDescriptions,
      durationMs: input.durationMs,
      chunkStartMs: chunk.startMs,
      chunkEndMs: chunk.endMs,
    });
    if (!filter.trim()) throw new Error(`Chainlink editorial chunk ${index + 1} has no graphics`);
    await writeFile(filterPath, filter, "utf8");
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "lavfi",
      "-i", `color=c=${C.dark}:s=${input.width}x${input.height}:r=${input.frameRate}:d=${chunkSeconds}`,
      "-filter_script:v", filterPath,
      "-t", chunkSeconds,
      "-an",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-pix_fmt", "yuv420p",
      "-r", String(input.frameRate),
      clipPath,
    ], { maxBuffer: 10 * 1024 * 1024 });
    clipFiles.push(clipPath);
  }

  if (clipFiles.length === 1) return clipFiles[0]!;
  const concatList = join(input.dir, "chainlink-editorial-clips.txt");
  const videoOnly = join(input.dir, "chainlink-editorial-video-only.mp4");
  await writeFile(
    concatList,
    clipFiles.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"),
    "utf8",
  );
  await execFileAsync("ffmpeg", [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concatList,
    "-an",
    "-c:v", "copy",
    "-movflags", "+faststart",
    videoOnly,
  ], { maxBuffer: 10 * 1024 * 1024 });
  return videoOnly;
}