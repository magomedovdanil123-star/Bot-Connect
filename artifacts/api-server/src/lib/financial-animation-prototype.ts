import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const DURATION_MS = 9_500;
const FONT = "DejaVu Sans";
const GREEN = "#35E69A";
const WHITE = "#F7FBFF";
const MUTED = "#92A4B5";
const PANEL = "#101B24";
const PANEL_EDGE = "#294051";

type EasingName = "linear" | "easeInOutCubic" | "easeOutCubic" | "easeOutBack";

export type FinancialAnimationKeyframe = {
  timeMs: number;
  x: number;
  y: number;
  scale?: number;
  opacity?: number;
  rotation?: number;
  easing?: EasingName;
};

export type FinancialAnimationObject = {
  id: string;
  kind: "investor" | "company" | "bond" | "money-label" | "coupon-label" | "term" | "principal" | "coin" | "particle";
  text?: string;
  color?: string;
  zIndex?: number;
  keyframes: FinancialAnimationKeyframe[];
};

export type FinancialAnimationScene = {
  id: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  objects: FinancialAnimationObject[];
};

type ObjectState = Required<Omit<FinancialAnimationKeyframe, "easing">>;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function ease(value: number, name: EasingName = "linear"): number {
  const t = clamp(value);
  if (name === "easeOutCubic") return 1 - (1 - t) ** 3;
  if (name === "easeInOutCubic") return t < 0.5
    ? 4 * t ** 3
    : 1 - ((-2 * t + 2) ** 3) / 2;
  if (name === "easeOutBack") {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  }
  return t;
}

function stateAt(object: FinancialAnimationObject, timeMs: number): ObjectState {
  const first = object.keyframes[0]!;
  if (timeMs <= first.timeMs) {
    return {
      timeMs: first.timeMs,
      x: first.x,
      y: first.y,
      scale: first.scale ?? 1,
      opacity: first.opacity ?? 1,
      rotation: first.rotation ?? 0,
    };
  }

  for (let index = 1; index < object.keyframes.length; index += 1) {
    const next = object.keyframes[index]!;
    const previous = object.keyframes[index - 1]!;
    if (timeMs > next.timeMs) continue;
    const progress = ease(
      (timeMs - previous.timeMs) / Math.max(1, next.timeMs - previous.timeMs),
      next.easing ?? "linear",
    );
    return {
      timeMs,
      x: previous.x + (next.x - previous.x) * progress,
      y: previous.y + (next.y - previous.y) * progress,
      scale: (previous.scale ?? 1) + ((next.scale ?? 1) - (previous.scale ?? 1)) * progress,
      opacity: (previous.opacity ?? 1) + ((next.opacity ?? 1) - (previous.opacity ?? 1)) * progress,
      rotation: (previous.rotation ?? 0) + ((next.rotation ?? 0) - (previous.rotation ?? 0)) * progress,
    };
  }

  const last = object.keyframes.at(-1)!;
  return {
    timeMs,
    x: last.x,
    y: last.y,
    scale: last.scale ?? 1,
    opacity: last.opacity ?? 1,
    rotation: last.rotation ?? 0,
  };
}

function keyframe(
  timeMs: number,
  x: number,
  y: number,
  options: Omit<FinancialAnimationKeyframe, "timeMs" | "x" | "y"> = {},
): FinancialAnimationKeyframe {
  return { timeMs, x, y, ...options };
}

function pointOnCurve(progress: number, reverse = false): { x: number; y: number } {
  const t = reverse ? 1 - clamp(progress) : clamp(progress);
  const start = { x: 285, y: 765 };
  const controlA = { x: 410, y: 575 };
  const controlB = { x: 670, y: 960 };
  const end = { x: 795, y: 765 };
  const inverse = (value: number) => 1 - value;
  const x = inverse(t) ** 3 * start.x
    + 3 * inverse(t) ** 2 * t * controlA.x
    + 3 * inverse(t) * t ** 2 * controlB.x
    + t ** 3 * end.x;
  const y = inverse(t) ** 3 * start.y
    + 3 * inverse(t) ** 2 * t * controlA.y
    + 3 * inverse(t) * t ** 2 * controlB.y
    + t ** 3 * end.y;
  return { x, y };
}

function movingCoin(
  id: string,
  startMs: number,
  endMs: number,
  reverse: boolean,
  color: string,
  scale = 1,
): FinancialAnimationObject {
  const positions = [0, 0.22, 0.55, 0.82, 1].map((progress) => pointOnCurve(progress, reverse));
  return {
    id,
    kind: "coin",
    color,
    zIndex: 4,
    keyframes: [
      keyframe(startMs - 260, positions[0]!.x, positions[0]!.y, { scale: 0.25 * scale, opacity: 0 }),
      keyframe(startMs, positions[0]!.x, positions[0]!.y, { scale: scale, opacity: 1, easing: "easeOutBack" }),
      keyframe(startMs + (endMs - startMs) * 0.22, positions[1]!.x, positions[1]!.y, { scale, opacity: 1, rotation: 18, easing: "easeInOutCubic" }),
      keyframe(startMs + (endMs - startMs) * 0.55, positions[2]!.x, positions[2]!.y, { scale: scale * 1.05, opacity: 1, rotation: 42, easing: "easeInOutCubic" }),
      keyframe(startMs + (endMs - startMs) * 0.82, positions[3]!.x, positions[3]!.y, { scale, opacity: 1, rotation: 70, easing: "easeInOutCubic" }),
      keyframe(endMs, positions[4]!.x, positions[4]!.y, { scale: 0.75 * scale, opacity: 0.1, rotation: 90, easing: "easeOutCubic" }),
    ],
  };
}

function particle(
  id: string,
  x: number,
  y: number,
  startMs: number,
  driftX: number,
  driftY: number,
): FinancialAnimationObject {
  return {
    id,
    kind: "particle",
    color: GREEN,
    zIndex: 3,
    keyframes: [
      keyframe(startMs, x, y, { scale: 0.25, opacity: 0 }),
      keyframe(startMs + 140, x, y, { scale: 1, opacity: 0.95, easing: "easeOutBack" }),
      keyframe(startMs + 700, x + driftX, y + driftY, { scale: 0.4, opacity: 0, easing: "easeOutCubic" }),
    ],
  };
}

function createScene(): FinancialAnimationScene {
  const objects: FinancialAnimationObject[] = [
    {
      id: "investor",
      kind: "investor",
      zIndex: 2,
      keyframes: [
        keyframe(0, 70, 650, { scale: 0.88, opacity: 0 }),
        keyframe(720, 170, 650, { scale: 1, opacity: 1, easing: "easeOutBack" }),
        keyframe(DURATION_MS, 170, 650, { scale: 1, opacity: 1 }),
      ],
    },
    {
      id: "company",
      kind: "company",
      zIndex: 2,
      keyframes: [
        keyframe(0, 1010, 650, { scale: 0.88, opacity: 0 }),
        keyframe(900, 910, 650, { scale: 1, opacity: 1, easing: "easeOutBack" }),
        keyframe(DURATION_MS, 910, 650, { scale: 1, opacity: 1 }),
      ],
    },
    {
      id: "bond",
      kind: "bond",
      text: "ОБЛИГАЦИЯ",
      zIndex: 3,
      keyframes: [
        keyframe(950, 540, 850, { scale: 0.2, opacity: 0 }),
        keyframe(1_550, 540, 850, { scale: 1, opacity: 1, easing: "easeOutBack" }),
        keyframe(2_050, 540, 850, { scale: 1, opacity: 1 }),
        keyframe(2_300, 540, 850, { scale: 0.8, opacity: 0, easing: "easeInOutCubic" }),
      ],
    },
    {
      id: "money-label",
      kind: "money-label",
      text: "10 000 ₽",
      zIndex: 5,
      keyframes: [
        keyframe(1_950, 540, 475, { scale: 0.7, opacity: 0 }),
        keyframe(2_300, 540, 475, { scale: 1, opacity: 1, easing: "easeOutBack" }),
        keyframe(4_050, 540, 475, { scale: 1, opacity: 1 }),
        keyframe(4_400, 540, 475, { scale: 0.75, opacity: 0, easing: "easeInOutCubic" }),
      ],
    },
    {
      id: "coupon-label",
      kind: "coupon-label",
      text: "КУПОН",
      zIndex: 5,
      keyframes: [
        keyframe(4_050, 540, 475, { scale: 0.7, opacity: 0 }),
        keyframe(4_450, 540, 475, { scale: 1, opacity: 1, easing: "easeOutBack" }),
        keyframe(5_250, 540, 475, { scale: 1, opacity: 1 }),
        keyframe(5_550, 540, 475, { scale: 0.75, opacity: 0, easing: "easeInOutCubic" }),
      ],
    },
    {
      id: "term",
      kind: "term",
      text: "СРОК: 1 ГОД",
      zIndex: 3,
      keyframes: [
        keyframe(5_150, 540, 1_220, { scale: 0.7, opacity: 0 }),
        keyframe(5_650, 540, 1_220, { scale: 1, opacity: 1, easing: "easeOutBack" }),
        keyframe(6_900, 540, 1_220, { scale: 1, opacity: 1 }),
        keyframe(7_100, 540, 1_220, { scale: 0.85, opacity: 0, easing: "easeInOutCubic" }),
      ],
    },
    {
      id: "principal",
      kind: "principal",
      text: "ВОЗВРАТ НОМИНАЛА",
      zIndex: 5,
      keyframes: [
        keyframe(7_050, 540, 1_220, { scale: 0.7, opacity: 0 }),
        keyframe(7_400, 540, 1_220, { scale: 1, opacity: 1, easing: "easeOutBack" }),
        keyframe(9_500, 540, 1_220, { scale: 1, opacity: 1 }),
      ],
    },
  ];

  for (let index = 0; index < 5; index += 1) {
    objects.push(movingCoin(`outgoing-coin-${index}`, 2_250 + index * 170, 3_850 + index * 170, false, GREEN, 0.9 + index * 0.05));
    objects.push(movingCoin(`coupon-coin-${index}`, 4_300 + index * 120, 5_300 + index * 120, true, "#B9F7D8", 0.72 + index * 0.04));
    objects.push(movingCoin(`return-coin-${index}`, 7_100 + index * 150, 8_650 + index * 150, true, "#F4D477", 0.85 + index * 0.04));
  }

  const particleSeeds = [
    [350, 700, 2_500, 18, -38],
    [500, 720, 2_850, -22, -52],
    [650, 820, 3_250, 28, 36],
    [720, 760, 4_500, -25, -40],
    [560, 690, 4_850, 24, -36],
    [430, 820, 7_350, -30, 42],
    [640, 760, 7_900, 32, -48],
    [700, 790, 8_250, -25, 44],
  ] as const;
  particleSeeds.forEach(([x, y, startMs, driftX, driftY], index) => {
    objects.push(particle(`particle-${index}`, x, y, startMs, driftX, driftY));
  });

  return {
    id: "bond-basics-object-animation",
    title: "Как работает облигация",
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
    durationMs: DURATION_MS,
    objects,
  };
}

export const financialAnimationPrototypeScene = createScene();

function svgText(
  value: string,
  x: number,
  y: number,
  options: { size?: number; color?: string; weight?: number; anchor?: "start" | "middle" | "end"; letterSpacing?: number } = {},
): string {
  return `<text x="${x}" y="${y}" fill="${options.color ?? WHITE}" font-family="${FONT}" font-size="${options.size ?? 30}" font-weight="${options.weight ?? 600}" text-anchor="${options.anchor ?? "middle"}${options.letterSpacing ? ` letter-spacing="${options.letterSpacing}"` : ""}>${escapeXml(value)}</text>`;
}

function panel(x: number, y: number, width: number, height: number, opacity: number): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="34" fill="${PANEL}" stroke="${PANEL_EDGE}" stroke-width="2" opacity="${opacity}"/>`;
}

function drawInvestor(object: FinancialAnimationObject, state: ObjectState): string {
  const opacity = state.opacity;
  return `<g transform="translate(${state.x} ${state.y}) rotate(${state.rotation}) scale(${state.scale})" opacity="${opacity}">
    ${panel(-135, -120, 270, 240, 1)}
    <rect x="-84" y="-45" width="168" height="105" rx="18" fill="#172936" stroke="${GREEN}" stroke-width="3"/>
    <path d="M-42 -10 L42 -10 M-42 20 L28 20" stroke="${GREEN}" stroke-width="8" stroke-linecap="round" opacity=".72"/>
    <circle cx="0" cy="82" r="18" fill="${GREEN}" opacity=".9"/>
    ${svgText("₽", 0, 91, { size: 25, color: "#092017", weight: 800 })}
    ${svgText("ИНВЕСТОР", 0, 155, { size: 26, color: WHITE, weight: 800, letterSpacing: 1 })}
  </g>`;
}

function drawCompany(object: FinancialAnimationObject, state: ObjectState): string {
  const opacity = state.opacity;
  return `<g transform="translate(${state.x} ${state.y}) rotate(${state.rotation}) scale(${state.scale})" opacity="${opacity}">
    ${panel(-135, -120, 270, 240, 1)}
    <path d="M-72 65 V-32 L0 -88 L72 -32 V65 Z" fill="#172936" stroke="${GREEN}" stroke-width="3"/>
    <path d="M-46 54 V3 H-10 V54 M10 54 V3 H46 V54 M-85 72 H85" fill="none" stroke="${GREEN}" stroke-width="9" stroke-linejoin="round" opacity=".78"/>
    ${svgText("КОМПАНИЯ", 0, 155, { size: 25, color: WHITE, weight: 800, letterSpacing: 1 })}
  </g>`;
}

function drawBond(object: FinancialAnimationObject, state: ObjectState): string {
  return `<g transform="translate(${state.x} ${state.y}) rotate(${state.rotation}) scale(${state.scale})" opacity="${state.opacity}">
    <rect x="-190" y="-46" width="380" height="92" rx="46" fill="#17372C" stroke="${GREEN}" stroke-width="3"/>
    <circle cx="-140" cy="0" r="22" fill="${GREEN}"/>
    ${svgText("₿", -140, 10, { size: 26, color: "#092017", weight: 800 })}
    ${svgText(object.text ?? "ОБЛИГАЦИЯ", 10, 11, { size: 30, color: WHITE, weight: 800, letterSpacing: 1 })}
  </g>`;
}

function drawLabel(object: FinancialAnimationObject, state: ObjectState, color: string, small = false): string {
  const width = small ? 305 : 330;
  return `<g transform="translate(${state.x} ${state.y}) rotate(${state.rotation}) scale(${state.scale})" opacity="${state.opacity}">
    <rect x="${-width / 2}" y="-42" width="${width}" height="84" rx="42" fill="#12261F" stroke="${color}" stroke-width="2"/>
    <circle cx="${-width / 2 + 34}" cy="0" r="10" fill="${color}"/>
    ${svgText(object.text ?? "", 18, 11, { size: small ? 24 : 29, color: WHITE, weight: 800, letterSpacing: small ? 0.5 : 1 })}
  </g>`;
}

function drawCoin(object: FinancialAnimationObject, state: ObjectState): string {
  const color = object.color ?? GREEN;
  const blur = state.opacity > 0.1 && state.opacity < 1 ? 2.8 : 0;
  return `<g transform="translate(${state.x} ${state.y}) rotate(${state.rotation}) scale(${state.scale})" opacity="${state.opacity}"${blur ? ` filter="url(#motion-blur)"` : ""}>
    <circle r="42" fill="#122C25" stroke="${color}" stroke-width="6"/>
    <circle r="31" fill="none" stroke="${color}" stroke-width="2" opacity=".55"/>
    ${svgText("₽", 0, 13, { size: 34, color, weight: 800 })}
  </g>`;
}

function drawParticle(object: FinancialAnimationObject, state: ObjectState): string {
  return `<circle cx="${state.x}" cy="${state.y}" r="${Math.max(3, 8 * state.scale)}" fill="${object.color ?? GREEN}" opacity="${state.opacity}"/>`;
}

function drawTerm(object: FinancialAnimationObject, state: ObjectState, progress: number): string {
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * clamp(progress);
  return `<g transform="translate(${state.x} ${state.y}) scale(${state.scale})" opacity="${state.opacity}">
    <circle r="142" fill="#0D1A22" stroke="${PANEL_EDGE}" stroke-width="2"/>
    <circle r="${radius}" fill="none" stroke="#20343F" stroke-width="15"/>
    <circle r="${radius}" fill="none" stroke="${GREEN}" stroke-width="15" stroke-linecap="round" stroke-dasharray="${dash} ${circumference}" transform="rotate(-90)"/>
    ${svgText(object.text ?? "СРОК: 1 ГОД", 0, 205, { size: 27, color: WHITE, weight: 800, letterSpacing: 1 })}
    ${svgText(`${Math.round(clamp(progress) * 100)}%`, 0, 14, { size: 35, color: GREEN, weight: 800 })}
  </g>`;
}

function drawPrincipal(object: FinancialAnimationObject, state: ObjectState): string {
  return `<g transform="translate(${state.x} ${state.y}) scale(${state.scale})" opacity="${state.opacity}">
    <rect x="-230" y="-62" width="460" height="124" rx="62" fill="#3C3320" stroke="#F4D477" stroke-width="3"/>
    <circle cx="-180" cy="0" r="15" fill="#F4D477"/>
    ${svgText(object.text ?? "ВОЗВРАТ НОМИНАЛА", 25, 10, { size: 27, color: WHITE, weight: 800, letterSpacing: 0.5 })}
  </g>`;
}

function renderObject(object: FinancialAnimationObject, timeMs: number): string {
  const state = stateAt(object, timeMs);
  if (state.opacity <= 0.001) return "";
  if (object.kind === "investor") return drawInvestor(object, state);
  if (object.kind === "company") return drawCompany(object, state);
  if (object.kind === "bond") return drawBond(object, state);
  if (object.kind === "money-label") return drawLabel(object, state, GREEN);
  if (object.kind === "coupon-label") return drawLabel(object, state, "#B9F7D8", true);
  if (object.kind === "term") {
    const progress = clamp((timeMs - 5_650) / 1_250);
    return drawTerm(object, state, progress);
  }
  if (object.kind === "principal") return drawPrincipal(object, state);
  if (object.kind === "coin") return drawCoin(object, state);
  return drawParticle(object, state);
}

function renderSceneSvg(scene: FinancialAnimationScene, timeMs: number): string {
  const cameraProgress = clamp((timeMs - 6_700) / 2_800);
  const cameraScale = 1 + 0.045 * ease(cameraProgress, "easeInOutCubic");
  const cameraX = -14 * ease(cameraProgress, "easeInOutCubic");
  const cameraY = -18 * ease(cameraProgress, "easeInOutCubic");
  const outgoingOpacity = clamp((timeMs - 1_900) / 400) * (1 - clamp((timeMs - 4_000) / 500));
  const couponOpacity = clamp((timeMs - 4_050) / 350) * (1 - clamp((timeMs - 5_250) / 450));
  const returnOpacity = clamp((timeMs - 7_000) / 350);

  const objects = [...scene.objects]
    .sort((left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0))
    .map((object) => renderObject(object, timeMs))
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0B151D"/>
        <stop offset="1" stop-color="#050A0E"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="42%" r="58%">
        <stop offset="0" stop-color="#1B6A4A" stop-opacity=".3"/>
        <stop offset="1" stop-color="#071016" stop-opacity="0"/>
      </radialGradient>
      <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="22"/>
      </filter>
      <filter id="motion-blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.8 1.2"/>
      </filter>
    </defs>
    <rect width="${scene.width}" height="${scene.height}" fill="url(#bg)"/>
    <rect width="${scene.width}" height="${scene.height}" fill="url(#glow)"/>
    <g opacity=".12">
      ${Array.from({ length: 16 }, (_, index) => `<line x1="${index * 72}" y1="0" x2="${index * 72}" y2="${HEIGHT}" stroke="${GREEN}" stroke-width="1"/>`).join("")}
      ${Array.from({ length: 28 }, (_, index) => `<line x1="0" y1="${index * 72}" x2="${WIDTH}" y2="${index * 72}" stroke="${GREEN}" stroke-width="1"/>`).join("")}
    </g>
    <g transform="translate(${cameraX} ${cameraY}) scale(${cameraScale})">
      <circle cx="540" cy="760" r="360" fill="${GREEN}" opacity=".06" filter="url(#soft-glow)"/>
      ${svgText("FINANCE / OBJECT ANIMATION", 54, 90, { size: 20, color: GREEN, weight: 700, anchor: "start", letterSpacing: 3 })}
      ${svgText("КАК РАБОТАЕТ ОБЛИГАЦИЯ", 54, 145, { size: 38, color: WHITE, weight: 800, anchor: "start", letterSpacing: 1 })}
      <path d="M285 765 C410 575 670 960 795 765" fill="none" stroke="${GREEN}" stroke-width="4" stroke-dasharray="12 18" opacity="${outgoingOpacity * 0.45}"/>
      <path d="M795 765 C670 575 410 960 285 765" fill="none" stroke="#B9F7D8" stroke-width="4" stroke-dasharray="12 18" opacity="${couponOpacity * 0.45}"/>
      <path d="M795 765 C670 575 410 960 285 765" fill="none" stroke="#F4D477" stroke-width="4" stroke-dasharray="12 18" opacity="${returnOpacity * 0.4}"/>
      <path d="M340 1020 H740" stroke="${GREEN}" stroke-width="2" opacity=".18"/>
      ${objects}
      ${svgText("Тестовый прототип • без AI, голоса и музыки", 540, 1810, { size: 20, color: MUTED, weight: 500 })}
    </g>
  </svg>`;
}

async function encodeFrames(dir: string, scene: FinancialAnimationScene): Promise<Buffer> {
  const frameCount = Math.ceil(scene.durationMs / 1_000 * scene.fps);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const timeMs = Math.min(scene.durationMs - 1, Math.round(frame * 1_000 / scene.fps));
    const svgPath = join(dir, `frame-${String(frame).padStart(4, "0")}.svg`);
    const pngPath = join(dir, `frame-${String(frame).padStart(4, "0")}.png`);
    await writeFile(svgPath, renderSceneSvg(scene, timeMs), "utf8");
    await execFileAsync("convert", [svgPath, pngPath], { maxBuffer: 10 * 1024 * 1024 });
  }

  const output = join(dir, "financial-animation-prototype.mp4");
  await execFileAsync("ffmpeg", [
    "-y",
    "-framerate", String(scene.fps),
    "-start_number", "0",
    "-i", join(dir, "frame-%04d.png"),
    "-t", String(scene.durationMs / 1_000),
    "-an",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "19",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    output,
  ], { timeout: 15 * 60 * 1_000, maxBuffer: 20 * 1024 * 1024 });
  return readFile(output);
}

export async function renderFinancialAnimationPrototype(
  scene: FinancialAnimationScene = financialAnimationPrototypeScene,
): Promise<{ buffer: Buffer; durationMs: number; sceneId: string; objectCount: number }> {
  const dir = await mkdtemp(join(tmpdir(), "financial-animation-"));
  try {
    const buffer = await encodeFrames(dir, scene);
    return {
      buffer,
      durationMs: scene.durationMs,
      sceneId: scene.id,
      objectCount: scene.objects.length,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}